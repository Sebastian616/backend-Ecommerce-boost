import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. Crear Usuario Admin
  const adminPassword = await bcrypt.hash('Admin12345', 10);
  await prisma.usuario.upsert({
    where: { email: 'admin@tienda.com' },
    update: {},
    create: {
      nombre: 'Admin',
      email: 'admin@tienda.com',
      password: adminPassword,
      rol: 'ADMIN',
      carrito: { create: {} },
    },
  });

  // 2. Crear Colores
  const colores = { Negro: '#000000', Blanco: '#FFFFFF', Azul: '#1E40AF' };
  for (const [nombre, hex] of Object.entries(colores)) {
    await prisma.color.upsert({
      where: { nombre },
      update: {},
      create: { nombre, hex },
    });
  }

  // 3. Crear Tallas
  const tallas = ['XS', 'S', 'M', 'L', 'XL'];
  for (const [i, nombre] of tallas.entries()) {
    await prisma.talla.upsert({
      where: { nombre },
      update: {},
      create: { nombre, orden: i },
    });
  }

  // 4. Crear Categoría de prueba
  const categoria = await prisma.categoria.upsert({
    where: { slug: 'deportiva' },
    update: {},
    create: { nombre: 'Ropa deportiva', slug: 'deportiva' },
  });

  // 5. Crear Productos y Variantes de prueba
  const productos = [
    { slug: 'top-deportivo-breeze', nombre: 'Top deportivo Breeze', precioBase: 89000, colores: ['Negro', 'Blanco'], tallas: ['S', 'M', 'L'] },
    { slug: 'legging-aura', nombre: 'Legging Aura', precioBase: 129000, colores: ['Negro', 'Azul'], tallas: ['S', 'M', 'L', 'XL'] },
    { slug: 'chaqueta-liviana-nova', nombre: 'Chaqueta liviana Nova', precioBase: 189000, colores: ['Azul'], tallas: ['M', 'L'] },
  ];

  for (const p of productos) {
    const prod = await prisma.producto.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        categoriaId: categoria.id,
        nombre: p.nombre,
        slug: p.slug,
        precioBase: p.precioBase,
        descripcion: 'Producto de prueba',
        imagenes: [
          `https://picsum.photos/seed/${p.slug}-1/600/800`,
          `https://picsum.photos/seed/${p.slug}-2/600/800`,
        ],
      },
    });

    for (const c of p.colores) {
      for (const t of p.tallas) {
        const color = await prisma.color.findUnique({ where: { nombre: c } });
        const talla = await prisma.talla.findUnique({ where: { nombre: t } });
        const sku = `${p.slug}-${c}-${t}`.toUpperCase();

        const existe = await prisma.productoVariante.findUnique({ where: { sku } });
        if (existe) continue;

        const stock = 10;
        const v = await prisma.productoVariante.create({
          data: { productoId: prod.id, colorId: color.id, tallaId: talla.id, sku, stock },
        });

        await prisma.inventarioMovimiento.create({
          data: { varianteId: v.id, tipo: 'ENTRADA', cantidad: stock, stockResultante: stock, nota: 'Stock inicial (demo)' },
        });
      }
    }
  }

  console.log('Seed ejecutado correctamente.');
  console.log('Admin: admin@tienda.com / Admin12345');
}

main()
  .catch((e) => {
    console.error('Error ejecutando el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });