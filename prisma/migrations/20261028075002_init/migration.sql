-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('CLIENTE', 'ADMIN');

-- CreateEnum
CREATE TYPE "EstadoOrden" AS ENUM ('PENDIENTE', 'PAGADA', 'ENVIADA', 'ENTREGADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'REEMBOLSADO');

-- CreateEnum
CREATE TYPE "TipoCupon" AS ENUM ('PORCENTAJE', 'MONTO_FIJO');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('ENTRADA', 'SALIDA_VENTA', 'DEVOLUCION', 'AJUSTE');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'CLIENTE',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "direcciones" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "linea1" TEXT NOT NULL,
    "linea2" TEXT,
    "ciudad" TEXT NOT NULL,
    "departamento" TEXT NOT NULL,
    "pais" TEXT NOT NULL DEFAULT 'CO',
    "codigoPostal" TEXT,
    "principal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "direcciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "padreId" INTEGER,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos" (
    "id" SERIAL NOT NULL,
    "categoriaId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "descripcion" TEXT,
    "precioBase" DECIMAL(12,2) NOT NULL,
    "imagenes" TEXT[],
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colores" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "hex" TEXT NOT NULL,

    CONSTRAINT "colores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tallas" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tallas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producto_variantes" (
    "id" SERIAL NOT NULL,
    "productoId" INTEGER NOT NULL,
    "colorId" INTEGER NOT NULL,
    "tallaId" INTEGER NOT NULL,
    "sku" TEXT NOT NULL,
    "precio" DECIMAL(12,2),
    "stock" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "producto_variantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventario_movimientos" (
    "id" SERIAL NOT NULL,
    "varianteId" INTEGER NOT NULL,
    "ordenId" INTEGER,
    "tipo" "TipoMovimiento" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "stockResultante" INTEGER NOT NULL,
    "nota" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventario_movimientos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carritos" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carritos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carrito_items" (
    "id" SERIAL NOT NULL,
    "carritoId" INTEGER NOT NULL,
    "varianteId" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,

    CONSTRAINT "carrito_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordenes" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "direccionId" INTEGER NOT NULL,
    "estado" "EstadoOrden" NOT NULL DEFAULT 'PENDIENTE',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "descuento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "envio" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ordenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orden_detalle" (
    "id" SERIAL NOT NULL,
    "ordenId" INTEGER NOT NULL,
    "varianteId" INTEGER NOT NULL,
    "nombreProducto" TEXT NOT NULL,
    "precioUnitario" DECIMAL(12,2) NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "orden_detalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" SERIAL NOT NULL,
    "ordenId" INTEGER NOT NULL,
    "metodo" TEXT NOT NULL DEFAULT 'TARJETA',
    "proveedor" TEXT,
    "referencia" TEXT,
    "monto" DECIMAL(12,2) NOT NULL,
    "estado" "EstadoPago" NOT NULL DEFAULT 'PENDIENTE',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cupones" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" "TipoCupon" NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "compraMinima" DECIMAL(12,2),
    "maxUsos" INTEGER,
    "usosActuales" INTEGER NOT NULL DEFAULT 0,
    "maxUsosPorUsuario" INTEGER NOT NULL DEFAULT 1,
    "inicia" TIMESTAMP(3),
    "expira" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cupones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orden_cupones" (
    "id" SERIAL NOT NULL,
    "ordenId" INTEGER NOT NULL,
    "cuponId" INTEGER NOT NULL,
    "descuento" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "orden_cupones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cupon_usos" (
    "id" SERIAL NOT NULL,
    "cuponId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "ordenId" INTEGER NOT NULL,
    "usadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cupon_usos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "direcciones_usuarioId_idx" ON "direcciones"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_slug_key" ON "categorias"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "productos_slug_key" ON "productos"("slug");

-- CreateIndex
CREATE INDEX "productos_categoriaId_idx" ON "productos"("categoriaId");

-- CreateIndex
CREATE UNIQUE INDEX "colores_nombre_key" ON "colores"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "tallas_nombre_key" ON "tallas"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "producto_variantes_sku_key" ON "producto_variantes"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "producto_variantes_productoId_colorId_tallaId_key" ON "producto_variantes"("productoId", "colorId", "tallaId");

-- CreateIndex
CREATE INDEX "inventario_movimientos_varianteId_idx" ON "inventario_movimientos"("varianteId");

-- CreateIndex
CREATE UNIQUE INDEX "carritos_usuarioId_key" ON "carritos"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "carrito_items_carritoId_varianteId_key" ON "carrito_items"("carritoId", "varianteId");

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_numero_key" ON "ordenes"("numero");

-- CreateIndex
CREATE INDEX "ordenes_usuarioId_idx" ON "ordenes"("usuarioId");

-- CreateIndex
CREATE INDEX "ordenes_estado_creadoEn_idx" ON "ordenes"("estado", "creadoEn");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_referencia_key" ON "pagos"("referencia");

-- CreateIndex
CREATE UNIQUE INDEX "cupones_codigo_key" ON "cupones"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "orden_cupones_ordenId_cuponId_key" ON "orden_cupones"("ordenId", "cuponId");

-- CreateIndex
CREATE INDEX "cupon_usos_cuponId_usuarioId_idx" ON "cupon_usos"("cuponId", "usuarioId");

-- AddForeignKey
ALTER TABLE "direcciones" ADD CONSTRAINT "direcciones_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_padreId_fkey" FOREIGN KEY ("padreId") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_variantes" ADD CONSTRAINT "producto_variantes_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_variantes" ADD CONSTRAINT "producto_variantes_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "colores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_variantes" ADD CONSTRAINT "producto_variantes_tallaId_fkey" FOREIGN KEY ("tallaId") REFERENCES "tallas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario_movimientos" ADD CONSTRAINT "inventario_movimientos_varianteId_fkey" FOREIGN KEY ("varianteId") REFERENCES "producto_variantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario_movimientos" ADD CONSTRAINT "inventario_movimientos_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "ordenes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carritos" ADD CONSTRAINT "carritos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrito_items" ADD CONSTRAINT "carrito_items_carritoId_fkey" FOREIGN KEY ("carritoId") REFERENCES "carritos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrito_items" ADD CONSTRAINT "carrito_items_varianteId_fkey" FOREIGN KEY ("varianteId") REFERENCES "producto_variantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes" ADD CONSTRAINT "ordenes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes" ADD CONSTRAINT "ordenes_direccionId_fkey" FOREIGN KEY ("direccionId") REFERENCES "direcciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_detalle" ADD CONSTRAINT "orden_detalle_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "ordenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_detalle" ADD CONSTRAINT "orden_detalle_varianteId_fkey" FOREIGN KEY ("varianteId") REFERENCES "producto_variantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "ordenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_cupones" ADD CONSTRAINT "orden_cupones_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "ordenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_cupones" ADD CONSTRAINT "orden_cupones_cuponId_fkey" FOREIGN KEY ("cuponId") REFERENCES "cupones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cupon_usos" ADD CONSTRAINT "cupon_usos_cuponId_fkey" FOREIGN KEY ("cuponId") REFERENCES "cupones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cupon_usos" ADD CONSTRAINT "cupon_usos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cupon_usos" ADD CONSTRAINT "cupon_usos_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "ordenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
