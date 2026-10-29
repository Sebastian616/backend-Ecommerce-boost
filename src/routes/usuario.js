import { Router } from 'express';
import { z } from 'zod';
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
const getCarrito = (usuarioId) =>
  prisma.carrito.upsert({
    where: { usuarioId },
    update: {},
    create: { usuarioId },
    include: { items: { include: { variante: { include: { producto: true, color: true, talla: true } } } } },
  });

r.get('/carrito', async (req, res) => {
  const c = await getCarrito(req.user.id);
  const total = c.items.reduce(
    (s, i) => s + Number(i.variante.precio ?? i.variante.producto.precioBase) * i.cantidad, 0);
  res.json({ ...c, total });
});

r.post('/carrito/items', async (req, res) => {
  const d = z.object({ varianteId: z.number().int(), cantidad: z.number().int().min(1) }).parse(req.body);
  const v = await prisma.productoVariante.findFirst({ where: { id: d.varianteId, activo: true } });
  if (!v) throw new HttpError(404, 'Variante no encontrada');
  const c = await getCarrito(req.user.id);
  const actual = c.items.find((i) => i.varianteId === d.varianteId)?.cantidad ?? 0;
  if (actual + d.cantidad > v.stock) throw new HttpError(409, `Solo hay ${v.stock} unidades disponibles`);
  await prisma.carritoItem.upsert({
    where: { carritoId_varianteId: { carritoId: c.id, varianteId: d.varianteId } },
    update: { cantidad: { increment: d.cantidad } },
    create: { carritoId: c.id, varianteId: d.varianteId, cantidad: d.cantidad },
  });
  res.status(201).json(await getCarrito(req.user.id));
});

r.patch('/carrito/items/:varianteId', async (req, res) => {
  const { cantidad } = z.object({ cantidad: z.number().int().min(1) }).parse(req.body);
  const varianteId = Number(req.params.varianteId);
  const v = await prisma.productoVariante.findUniqueOrThrow({ where: { id: varianteId } });
  if (cantidad > v.stock) throw new HttpError(409, `Solo hay ${v.stock} unidades disponibles`);
  const c = await getCarrito(req.user.id);
  await prisma.carritoItem.update({
    where: { carritoId_varianteId: { carritoId: c.id, varianteId } },
    data: { cantidad },
  });
  res.json(await getCarrito(req.user.id));
});

r.delete('/carrito/items/:varianteId', async (req, res) => {
  const c = await getCarrito(req.user.id);
  await prisma.carritoItem.deleteMany({ where: { carritoId: c.id, varianteId: Number(req.params.varianteId) } });
  res.status(204).end();
});

export default r;
