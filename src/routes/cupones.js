import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { auth, soloAdmin } from '../middleware/auth.js';
import { validarCupon, calcularDescuento } from '../services/ordenes.service.js';

const r = Router();
r.use(auth);

// Vista previa del descuento sobre el carrito actual
r.post('/validar', async (req, res) => {
  const { codigo } = z.object({ codigo: z.string() }).parse(req.body);
  const carrito = await prisma.carrito.findUnique({
    where: { usuarioId: req.user.id },
    include: { items: { include: { variante: { include: { producto: true } } } } },
  });
  const subtotal = (carrito?.items ?? []).reduce(
    (s, i) => s.add(new Prisma.Decimal(i.variante.precio ?? i.variante.producto.precioBase).mul(i.cantidad)),
    new Prisma.Decimal(0));
  const cupon = await validarCupon(prisma, codigo, req.user.id, subtotal);
  res.json({ codigo: cupon.codigo, descuento: calcularDescuento(cupon, subtotal), subtotal });
});

const schema = z.object({
  codigo: z.string().min(3).transform((s) => s.toUpperCase()),
  tipo: z.enum(['PORCENTAJE', 'MONTO_FIJO']),
  valor: z.number().positive(),
  compraMinima: z.number().optional(),
  maxUsos: z.number().int().optional(),
  maxUsosPorUsuario: z.number().int().min(1).default(1),
  inicia: z.coerce.date().optional(),
  expira: z.coerce.date().optional(),
  activo: z.boolean().optional(),
}).refine((d) => d.tipo !== 'PORCENTAJE' || d.valor <= 100, { message: 'Porcentaje máximo 100' });

r.get('/', soloAdmin, async (_q, res) => res.json(await prisma.cupon.findMany()));
r.post('/', soloAdmin, async (req, res) =>
  res.status(201).json(await prisma.cupon.create({ data: schema.parse(req.body) })));
r.put('/:id', soloAdmin, async (req, res) =>
  res.json(await prisma.cupon.update({ where: { id: Number(req.params.id) }, data: schema.partial().parse(req.body) })));

export default r;
