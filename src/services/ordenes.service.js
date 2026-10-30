import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/errors.js';

const D = (n) => new Prisma.Decimal(n);

export function calcularDescuento(cupon, subtotal) {
  let d = cupon.tipo === 'PORCENTAJE' ? subtotal.mul(cupon.valor).div(100) : D(cupon.valor);
  if (d.gt(subtotal)) d = subtotal;
  return d.toDecimalPlaces(2);
}

export async function validarCupon(tx, codigo, usuarioId, subtotal) {
  const cupon = await tx.cupon.findUnique({ where: { codigo: codigo.toUpperCase() } });
  const ahora = new Date();
  if (!cupon || !cupon.activo) throw new HttpError(400, 'Cupón inválido');
  if (cupon.inicia && cupon.inicia > ahora) throw new HttpError(400, 'El cupón aún no está vigente');
  if (cupon.expira && cupon.expira < ahora) throw new HttpError(400, 'El cupón expiró');
  if (cupon.compraMinima && subtotal.lt(cupon.compraMinima))
    throw new HttpError(400, `Compra mínima de ${cupon.compraMinima} para este cupón`);
  if (cupon.maxUsos !== null && cupon.usosActuales >= cupon.maxUsos)
    throw new HttpError(400, 'El cupón agotó sus usos');
  const usosUsuario = await tx.cuponUso.count({ where: { cuponId: cupon.id, usuarioId } });
  if (usosUsuario >= cupon.maxUsosPorUsuario) throw new HttpError(400, 'Ya usaste este cupón');
  return cupon;
}

/**
 * Crea la orden y DESCUENTA EL STOCK automáticamente, todo en una transacción.
 * El descuento es atómico (UPDATE ... WHERE stock >= cantidad): dos compras
 * simultáneas nunca pueden dejar el stock en negativo (sin overselling).
 */
export async function crearOrden(usuarioId, { direccionId, cuponCodigo, metodo = 'EFECTIVO' }) {
  return prisma.$transaction(async (tx) => {
    const direccion = await tx.direccion.findFirst({ where: { id: direccionId, usuarioId } });
    if (!direccion) throw new HttpError(404, 'Dirección no encontrada');

    const carrito = await tx.carrito.findUnique({
      where: { usuarioId },
      include: { items: { include: { variante: { include: { producto: true } } } } },
    });
    if (!carrito || carrito.items.length === 0) throw new HttpError(400, 'El carrito está vacío');

    let subtotal = D(0);
    const detalles = carrito.items.map((it) => {
      const v = it.variante;
      if (!v.activo || !v.producto.activo)
        throw new HttpError(400, `"${v.producto.nombre}" ya no está disponible`);
      const precio = D(v.precio ?? v.producto.precioBase);
      const sub = precio.mul(it.cantidad);
      subtotal = subtotal.add(sub);
      return {
        varianteId: v.id,
        nombreProducto: v.producto.nombre,
        precioUnitario: precio,
        cantidad: it.cantidad,
        subtotal: sub,
      };
    });

    let cupon = null;
    let descuento = D(0);
    if (cuponCodigo) {
      cupon = await validarCupon(tx, cuponCodigo, usuarioId, subtotal);
      descuento = calcularDescuento(cupon, subtotal);
    }
    // Envío gratis desde ENVIO_GRATIS_DESDE (sobre el subtotal, igual que el aviso del carrito)
    const gratisDesde = Number(process.env.ENVIO_GRATIS_DESDE ?? 0);
    const envio = gratisDesde > 0 && subtotal.gte(gratisDesde) ? D(0) : D(process.env.COSTO_ENVIO ?? 0);
    const total = subtotal.sub(descuento).add(envio);

    const orden = await tx.orden.create({
      data: {
        numero: `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        usuarioId,
        direccionId,
        subtotal,
        descuento,
        envio,
        total,
        detalles: { create: detalles },
        pagos: { create: { monto: total, metodo } },
      },
    });

    // ===== REDUCCIÓN AUTOMÁTICA DE STOCK =====
    for (const d of detalles) {
      const r = await tx.productoVariante.updateMany({
        where: { id: d.varianteId, stock: { gte: d.cantidad } },
        data: { stock: { decrement: d.cantidad } },
      });
      if (r.count === 0) throw new HttpError(409, `Stock insuficiente para "${d.nombreProducto}"`);
      const { stock } = await tx.productoVariante.findUnique({ where: { id: d.varianteId } });
      await tx.inventarioMovimiento.create({
        data: {
          varianteId: d.varianteId,
          ordenId: orden.id,
          tipo: 'SALIDA_VENTA',
          cantidad: -d.cantidad,
          stockResultante: stock,
          nota: `Venta ${orden.numero}`,
        },
      });
    }

    if (cupon) {
      const ok = await tx.cupon.updateMany({
        where:
          cupon.maxUsos === null
            ? { id: cupon.id }
            : { id: cupon.id, usosActuales: { lt: cupon.maxUsos } },
        data: { usosActuales: { increment: 1 } },
      });
      if (ok.count === 0) throw new HttpError(400, 'El cupón agotó sus usos');
      await tx.ordenCupon.create({ data: { ordenId: orden.id, cuponId: cupon.id, descuento } });
      await tx.cuponUso.create({ data: { cuponId: cupon.id, usuarioId, ordenId: orden.id } });
    }

    await tx.carritoItem.deleteMany({ where: { carritoId: carrito.id } });

    return tx.orden.findUnique({
      where: { id: orden.id },
      include: { detalles: true, pagos: true, cupones: true },
    });
  });
}

/** Cancela la orden y DEVUELVE el stock y el uso del cupón. Idempotente. */
export async function cancelarOrden(ordenId, { usuarioId = null, esAdmin = false } = {}) {
  return prisma.$transaction(async (tx) => {
    const orden = await tx.orden.findUnique({ where: { id: ordenId }, include: { detalles: true } });
    if (!orden || (!esAdmin && orden.usuarioId !== usuarioId))
      throw new HttpError(404, 'Orden no encontrada');

    const permitidos = esAdmin ? ['PENDIENTE', 'PAGADA'] : ['PENDIENTE'];
    // Cambio de estado condicional: evita devolver el stock dos veces
    const r = await tx.orden.updateMany({
      where: { id: ordenId, estado: { in: permitidos } },
      data: { estado: 'CANCELADA' },
    });
    if (r.count === 0) throw new HttpError(409, 'La orden no puede cancelarse en su estado actual');

    for (const d of orden.detalles) {
      const v = await tx.productoVariante.update({
        where: { id: d.varianteId },
        data: { stock: { increment: d.cantidad } },
      });
      await tx.inventarioMovimiento.create({
        data: {
          varianteId: d.varianteId,
          ordenId,
          tipo: 'DEVOLUCION',
          cantidad: d.cantidad,
          stockResultante: v.stock,
          nota: `Cancelación ${orden.numero}`,
        },
      });
    }

    const usos = await tx.cuponUso.findMany({ where: { ordenId } });
    for (const u of usos)
      await tx.cupon.update({ where: { id: u.cuponId }, data: { usosActuales: { decrement: 1 } } });
    await tx.cuponUso.deleteMany({ where: { ordenId } });

    await tx.pago.updateMany({ where: { ordenId, estado: 'PENDIENTE' }, data: { estado: 'RECHAZADO' } });
    return tx.orden.findUnique({ where: { id: ordenId } });
  });
}

/**
 * Libera el stock de órdenes que nunca se pagaron:
 *  - TARJETA: tras MINUTOS_EXPIRACION_ORDEN (30 por defecto)
 *  - TRANSFERENCIA: tras HORAS_EXPIRACION_TRANSFERENCIA (24 por defecto)
 *  - EFECTIVO: nunca expira (se paga al recibir)
 */
export async function expirarOrdenesPendientes() {
  const ahora = Date.now();
  const limiteTarjeta = new Date(ahora - Number(process.env.MINUTOS_EXPIRACION_ORDEN ?? 30) * 60000);
  const limiteTransf = new Date(ahora - Number(process.env.HORAS_EXPIRACION_TRANSFERENCIA ?? 24) * 3600000);
  const vencidas = await prisma.orden.findMany({
    where: {
      estado: 'PENDIENTE',
      OR: [
        { creadoEn: { lt: limiteTarjeta }, pagos: { some: { metodo: 'TARJETA' } } },
        { creadoEn: { lt: limiteTransf }, pagos: { some: { metodo: 'TRANSFERENCIA' } } },
      ],
    },
    select: { id: true },
  });
  for (const o of vencidas) {
    try {
      await cancelarOrden(o.id, { esAdmin: true });
    } catch (e) {
      console.error('expirar', o.id, e.message);
    }
  }
  return vencidas.length;
}