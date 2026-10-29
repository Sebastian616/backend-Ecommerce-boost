# Ecommerce API

Node.js + Express 5 + Prisma + PostgreSQL.

## Inicio
```bash
npm install
cp .env.example .env        # edita DATABASE_URL y secretos
npx prisma migrate dev --name init
npm run db:seed             # admin + colores + tallas
npm run dev
```

## Flujo principal
1. `POST /api/auth/registro` · `POST /api/auth/login` → token (Bearer)
2. `GET /api/productos` · `GET /api/productos/:id`
3. `POST /api/me/direcciones`
4. `POST /api/me/carrito/items` `{ varianteId, cantidad }`
5. `POST /api/cupones/validar` `{ codigo }` (opcional)
6. `POST /api/ordenes` `{ direccionId, cuponCodigo? }` → **crea la orden y descuenta el stock**
7. `POST /api/pagos/webhook` (header `x-webhook-secret`) → marca PAGADA o cancela y devuelve stock

## Admin
- `POST /api/categorias|colores|tallas|productos`, `POST /api/productos/:id/variantes`
- `POST /api/inventario/ajuste` · `GET /api/inventario/movimientos/:varianteId` · `GET /api/inventario/bajo-stock`
- `POST/PUT/GET /api/cupones`
- `PATCH /api/ordenes/:id/estado` (ENVIADA / ENTREGADA)
