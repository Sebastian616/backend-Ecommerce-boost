import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/errors.js';
import { auth, soloAdmin } from '../middleware/auth.js';

const r = Router();
r.use(auth, soloAdmin);

// Ajuste manual: cantidad positiva = entrada, negativa = salida/merma
r.post('/ajuste', async (req, res) => {
  const d = z.object({
    varianteId: z.number().int(),
    cantidad: z.number().int().refine((n) => n !== 0),
    tipo: z.enum(['ENTRADA', 'AJUSTE']).default('ENTRADA'),
    nota: z.string().optional(),
  }).parse(req.body);

  const mov = await prisma.$transaction(async (tx) => {
    const ok = await tx.productoVariante.updateMany({
      where: { id: d.varianteId, ...(d.cantidad < 0 && { stock: { gte: -d.cantidad } }) },
      data: { stock: { increment: d.cantidad } },
    });
    if (ok.count === 0) throw new HttpError(409, 'Stock insuficiente para ese ajuste');
    const { stock } = await tx.productoVariante.findUnique({ where: { id: d.varianteId } });
    return tx.inventarioMovimiento.create({
      data: { varianteId: d.varianteId, tipo: d.tipo, cantidad: d.cantidad, stockResultante: stock, nota: d.nota },
    });
  });
  res.status(201).json(mov);
});

r.get('/movimientos/:varianteId', async (req, res) =>
  res.json(await prisma.inventarioMovimiento.findMany({
    where: { varianteId: Number(req.params.varianteId) },
    orderBy: { creadoEn: 'desc' },
    take: 100,
  })));

r.get('/bajo-stock', async (req, res) =>
  res.json(await prisma.productoVariante.findMany({
    where: { stock: { lte: Number(req.query.umbral ?? 5) }, activo: true },
    include: { producto: { select: { nombre: true } }, color: true, talla: true },
  })));

export default r;
