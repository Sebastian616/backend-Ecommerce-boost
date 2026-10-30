import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/errors.js';
import { auth } from '../middleware/auth.js';

const r = Router();
r.use(auth);

// ---- Direcciones
const dirSchema = z.object({
  nombre: z.string(),
  telefono: z.string(),
  linea1: z.string(),
  linea2: z.string().optional(),
  ciudad: z.string(),
  departamento: z.string(),
  pais: z.string().default('CO'),
  codigoPostal: z.string().optional(),
  principal: z.boolean().default(false),
});
r.get('/direcciones', async (req, res) =>
  res.json(await prisma.direccion.findMany({ where: { usuarioId: req.user.id } })));
r.post('/direcciones', async (req, res) => {
  const d = dirSchema.parse(req.body);
  const dir = await prisma.$transaction(async (tx) => {
    if (d.principal)
      await tx.direccion.updateMany({ where: { usuarioId: req.user.id }, data: { principal: false } });
    return tx.direccion.create({ data: { ...d, usuarioId: req.user.id } });
  });
  res.status(201).json(dir);
});
r.delete('/direcciones/:id', async (req, res) => {
  const n = await prisma.direccion.deleteMany({ where: { id: Number(req.params.id), usuarioId: req.user.id } });
  if (!n.count) throw new HttpError(404, 'Dirección no encontrada');
  res.status(204).end();
});

// ---- Carrito
// Una sola consulta liviana (solo los campos necesarios). El servidor calcula
// precioUnitario, subtotal y total: el frontend no tiene que adivinar precios.
const itemSelect = {
  varianteId: true,
  cantidad: true,
  variante: {
    select: {
      id: true, sku: true, stock: true, precio: true,
      color: { select: { nombre: true } },
      talla: { select: { nombre: true } },
      producto: { select: { id: true, nombre: true, precioBase: true, imagenes: true } },
    },
  },
};

function formatCarrito(c) {
  const items = (c?.items ?? []).map((i) => {
    const precio = new Prisma.Decimal(i.variante.precio ?? i.variante.producto.precioBase);
    return {
      varianteId: i.varianteId,
      cantidad: i.cantidad,
      precioUnitario: precio.toNumber(),
      subtotal: precio.mul(i.cantidad).toNumber(),
      variante: i.variante,
    };
  });
  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  return {
    id: c?.id ?? null,
    items,
    cantidadTotal: items.reduce((s, i) => s + i.cantidad, 0),
    subtotal,
    total: subtotal, // el envío se calcula al crear la orden
  };
}

async function carritoDe(usuarioId) {
  const c = await prisma.carrito.findUnique({
    where: { usuarioId },
    select: { id: true, items: { select: itemSelect, orderBy: { id: 'asc' } } },
  });
  return formatCarrito(c);
}

async function carritoId(usuarioId) {
  const c = await prisma.carrito.findUnique({ where: { usuarioId }, select: { id: true } });
  return c ? c.id : (await prisma.carrito.create({ data: { usuarioId }, select: { id: true } })).id;
}

r.get('/carrito', async (req, res) => res.json(await carritoDe(req.user.id)));

r.post('/carrito/items', async (req, res) => {
  const d = z.object({ varianteId: z.number().int(), cantidad: z.number().int().min(1) }).parse(req.body);
  const [v, cid] = await Promise.all([
    prisma.productoVariante.findFirst({
      where: { id: d.varianteId, activo: true, producto: { activo: true } },
      select: { id: true, stock: true },
    }),
    carritoId(req.user.id),
  ]);
  if (!v) throw new HttpError(404, 'Variante no encontrada');

  const existente = await prisma.carritoItem.findUnique({
    where: { carritoId_varianteId: { carritoId: cid, varianteId: d.varianteId } },
    select: { cantidad: true },
  });
  const nueva = (existente?.cantidad ?? 0) + d.cantidad;
  if (nueva > v.stock) throw new HttpError(409, `Solo hay ${v.stock} unidades disponibles`);

  await prisma.carritoItem.upsert({
    where: { carritoId_varianteId: { carritoId: cid, varianteId: d.varianteId } },
    update: { cantidad: nueva },
    create: { carritoId: cid, varianteId: d.varianteId, cantidad: d.cantidad },
  });
  res.status(201).json(await carritoDe(req.user.id));
});

r.patch('/carrito/items/:varianteId', async (req, res) => {
  const { cantidad } = z.object({ cantidad: z.number().int().min(1) }).parse(req.body);
  const varianteId = Number(req.params.varianteId);
  const [v, cid] = await Promise.all([
    prisma.productoVariante.findUnique({ where: { id: varianteId }, select: { stock: true } }),
    carritoId(req.user.id),
  ]);
  if (!v) throw new HttpError(404, 'Variante no encontrada');
  if (cantidad > v.stock) throw new HttpError(409, `Solo hay ${v.stock} unidades disponibles`);

  const n = await prisma.carritoItem.updateMany({ where: { carritoId: cid, varianteId }, data: { cantidad } });
  if (!n.count) throw new HttpError(404, 'El producto no está en tu carrito');
  res.json(await carritoDe(req.user.id));
});

r.delete('/carrito/items/:varianteId', async (req, res) => {
  const cid = await carritoId(req.user.id);
  await prisma.carritoItem.deleteMany({ where: { carritoId: cid, varianteId: Number(req.params.varianteId) } });
  res.json(await carritoDe(req.user.id));
});

export default r;