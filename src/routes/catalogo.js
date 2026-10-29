import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { auth, soloAdmin } from '../middleware/auth.js';

const r = Router();
const admin = [auth, soloAdmin];
const conVariantes = { where: { activo: true }, include: { color: true, talla: true } };

// ---- Categorías
r.get('/categorias', async (_q, res) => res.json(await prisma.categoria.findMany({ include: { hijas: true } })));
r.post('/categorias', ...admin, async (req, res) => {
  const d = z.object({ nombre: z.string(), slug: z.string(), padreId: z.number().int().optional() }).parse(req.body);
  res.status(201).json(await prisma.categoria.create({ data: d }));
});

// ---- Colores y tallas
r.get('/colores', async (_q, res) => res.json(await prisma.color.findMany()));
r.post('/colores', ...admin, async (req, res) =>
  res.status(201).json(await prisma.color.create({ data: z.object({ nombre: z.string(), hex: z.string() }).parse(req.body) })));
r.get('/tallas', async (_q, res) => res.json(await prisma.talla.findMany({ orderBy: { orden: 'asc' } })));
r.post('/tallas', ...admin, async (req, res) =>
  res.status(201).json(await prisma.talla.create({ data: z.object({ nombre: z.string(), orden: z.number().int().default(0) }).parse(req.body) })));

// ---- Productos (público: solo activos)
r.get('/productos', async (req, res) => {
  const q = z.object({
    categoriaId: z.coerce.number().int().optional(),
    q: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }).parse(req.query);
  const where = {
    activo: true,
    ...(q.categoriaId && { categoriaId: q.categoriaId }),
    ...(q.q && { nombre: { contains: q.q, mode: 'insensitive' } }),
  };
  const [total, data] = await Promise.all([
    prisma.producto.count({ where }),
    prisma.producto.findMany({
      where, skip: (q.page - 1) * q.limit, take: q.limit, orderBy: { creadoEn: 'desc' },
      include: { variantes: conVariantes },
    }),
  ]);
  res.json({ total, page: q.page, data });
});

// ---- Productos (admin: incluye inactivos y todas las variantes)
r.get('/admin/productos', ...admin, async (req, res) => {
  const q = z.object({
    activo: z.enum(['true', 'false']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }).parse(req.query);
  const where = q.activo ? { activo: q.activo === 'true' } : {};
  const [total, data] = await Promise.all([
    prisma.producto.count({ where }),
    prisma.producto.findMany({
      where, skip: (q.page - 1) * q.limit, take: q.limit, orderBy: { creadoEn: 'desc' },
      include: { variantes: { include: { color: true, talla: true }, orderBy: { id: 'asc' } } },
    }),
  ]);
  res.json({ total, page: q.page, data });
});

r.get('/productos/:id', async (req, res) => {
  res.json(await prisma.producto.findFirstOrThrow({
    where: { id: Number(req.params.id), activo: true },
    include: { categoria: true, variantes: conVariantes },
  }));
});

const productoSchema = z.object({
  categoriaId: z.number().int(),
  nombre: z.string().min(1),
  slug: z.string().min(1),
  descripcion: z.string().optional(),
  precioBase: z.number().positive(),
  // Acepta URLs absolutas y rutas relativas (img/foto.jpg)
  imagenes: z.array(z.string().min(1)).default([]),
  activo: z.boolean().optional(),
});
r.post('/productos', ...admin, async (req, res) =>
  res.status(201).json(await prisma.producto.create({ data: productoSchema.parse(req.body) })));
r.put('/productos/:id', ...admin, async (req, res) =>
  res.json(await prisma.producto.update({ where: { id: Number(req.params.id) }, data: productoSchema.partial().parse(req.body) })));

// ---- Variantes
r.post('/productos/:id/variantes', ...admin, async (req, res) => {
  const d = z.object({
    colorId: z.number().int(),
    tallaId: z.number().int(),
    sku: z.string(),
    precio: z.number().positive().optional(),
    stock: z.number().int().min(0).default(0),
  }).parse(req.body);
  const v = await prisma.$transaction(async (tx) => {
    const v = await tx.productoVariante.create({ data: { ...d, productoId: Number(req.params.id) } });
    if (d.stock > 0)
      await tx.inventarioMovimiento.create({
        data: { varianteId: v.id, tipo: 'ENTRADA', cantidad: d.stock, stockResultante: d.stock, nota: 'Stock inicial' },
      });
    return v;
  });
  res.status(201).json(v);
});

// Editar variante: sku, precio, activo, y reposición de stock (agregarStock suma unidades
// y deja registro en el inventario).
r.put('/variantes/:id', ...admin, async (req, res) => {
  const { agregarStock, ...resto } = z.object({
    sku: z.string().min(1).optional(),
    precio: z.number().positive().optional(),
    activo: z.boolean().optional(),
    agregarStock: z.number().int().positive().optional(),
  }).parse(req.body);

  const v = await prisma.$transaction(async (tx) => {
    const v = await tx.productoVariante.update({
      where: { id: Number(req.params.id) },
      data: { ...resto, ...(agregarStock && { stock: { increment: agregarStock } }) },
    });
    if (agregarStock)
      await tx.inventarioMovimiento.create({
        data: { varianteId: v.id, tipo: 'ENTRADA', cantidad: agregarStock, stockResultante: v.stock, nota: 'Reposición desde panel' },
      });
    return v;
  });
  res.json(v);
});

export default r;