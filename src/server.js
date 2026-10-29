import 'dotenv/config';
import app from './app.js';
import { expirarOrdenesPendientes } from './services/ordenes.service.js';

const port = process.env.PORT ?? 3000;
app.listen(port, () => console.log(`API en http://localhost:${port}`));

// Cada minuto libera el stock de órdenes que nunca se pagaron
setInterval(() => expirarOrdenesPendientes().catch(console.error), 60_000);
