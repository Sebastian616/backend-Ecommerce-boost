import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/errors.js';
import { auth, soloAdmin } from '../middleware/auth.js';
import { crearOrden, cancelarOrden } from '../services/ordenes.service.js';

const r = Router();
r.use(auth);
const incluir = {
  detalles: {
    include: {
      variante: {
        select: {
          sku: true,
          color: { select: { nombre: true } },
          talla: { select: { nombre: true } },
          producto: { select: { id: true, imagenes: true } },
        },
      },
    },
  },
  pagos: true,
  cupones: { include: { cupon: { select: { codigo: true } } } },
  direccion: true,
};

// Checkout: crea la orden y descuenta el stock automáticamente
r.post('/', async (req, res) => {
  const d = z.object({
    direccionId: z.number().int(),
    cuponCodigo: z.string().optional(),
    metodo: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'TARJETA']).default('EFECTIVO'),
  }).parse(req.body);
  res.status(201).json(await crearOrden(req.user.id, d));
});

r.get('/', async (req, res) =>
  res.json(await prisma.orden.findMany({
    where: req.user.rol === 'ADMIN' && req.query.todas ? {} : { usuarioId: req.user.id },
    include: incluir,
    orderBy: { creadoEn: 'desc' },
  })));

r.get('/:id', async (req, res) => {
  const o = await prisma.orden.findUnique({ where: { id: Number(req.params.id) }, include: incluir });
  if (!o || (o.usuarioId !== req.user.id && req.user.rol !== 'ADMIN'))
    throw new HttpError(404, 'Orden no encontrada');
  res.json(o);
});

// Cancelar: devuelve el stock
r.post('/:id/cancelar', async (req, res) =>
  res.json(await cancelarOrden(Number(req.params.id), {
    usuarioId: req.user.id,
    esAdmin: req.user.rol === 'ADMIN',
  })));

// Admin: confirma un pago manual (transferencia o efectivo)
r.patch('/:id/confirmar-pago', soloAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await prisma.$transaction(async (tx) => {
    const n = await tx.orden.updateMany({ where: { id, estado: 'PENDIENTE' }, data: { estado: 'PAGADA' } });
    if (!n.count) throw new HttpError(409, 'La orden no está pendiente de pago');
    await tx.pago.updateMany({ where: { ordenId: id, estado: 'PENDIENTE' }, data: { estado: 'APROBADO' } });
  });
  res.json(await prisma.orden.findUnique({ where: { id } }));
});

// Admin: PAGADA -> ENVIADA -> ENTREGADA
r.patch('/:id/estado', soloAdmin, async (req, res) => {
  const { estado } = z.object({ estado: z.enum(['ENVIADA', 'ENTREGADA']) }).parse(req.body);
  const previo = estado === 'ENVIADA' ? 'PAGADA' : 'ENVIADA';
  const n = await prisma.orden.updateMany({ where: { id: Number(req.params.id), estado: previo }, data: { estado } });
  if (!n.count) throw new HttpError(409, `La orden debe estar ${previo} para pasar a ${estado}`);
  res.json(await prisma.orden.findUnique({ where: { id: Number(req.params.id) } }));
});

export default r;