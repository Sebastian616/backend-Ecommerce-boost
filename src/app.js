import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authR from './routes/auth.js';
import catalogoR from './routes/catalogo.js';
import inventarioR from './routes/inventario.js';
import usuarioR from './routes/usuario.js';
import ordenesR from './routes/ordenes.js';
import cuponesR from './routes/cupones.js';
import pagosR from './routes/pagos.js';
import { errorHandler } from './middleware/error.js';

const app = express();
app.use(helmet(), cors(), express.json());

app.get('/salud', (_q, res) => res.json({ ok: true }));
app.use('/api/auth', authR);
app.use('/api', catalogoR); // categorias, colores, tallas, productos
app.use('/api/inventario', inventarioR);
app.use('/api/me', usuarioR); // direcciones y carrito
app.use('/api/ordenes', ordenesR);
app.use('/api/cupones', cuponesR);
app.use('/api/pagos', pagosR);
app.use((_q, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use(errorHandler);

export default app;
