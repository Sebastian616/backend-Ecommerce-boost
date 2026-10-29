import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/errors.js';
import { cancelarOrden } from '../services/ordenes.service.js';

const r = Router();

/**
 * Webhook del proveedor de pagos (Wompi, MercadoPago, Stripe, PayU...).
 * En producción: valida la FIRMA real del proveedor en vez del secreto simple.
 */
r.post('/webhook', async (req, res) => {
  if (req.headers['x-webhook-secret'] !== process.env.PAYMENT_WEBHOOK_SECRET)
    throw new HttpError(401, 'Firma inválida');
  const d = z.object({
    ordenId: z.number().int(),
    referencia: z.string(),
    proveedor: z.string().optional(),
    estado: z.enum(['APROBADO', 'RECHAZADO']),
  }).parse(req.body);

  if (d.estado === 'APROBADO') {
    await prisma.$transaction(async (tx) => {
      const n = await tx.orden.updateMany({ where: { id: d.ordenId, estado: 'PENDIENTE' }, data: { estado: 'PAGADA' } });
      if (n.count === 0) return; // idempotente: ya procesada o cancelada
      await tx.pago.updateMany({
        where: { ordenId: d.ordenId, estado: 'PENDIENTE' },
        data: { estado: 'APROBADO', referencia: d.referencia, proveedor: d.proveedor },
      });
    });
  } else {
    await cancelarOrden(d.ordenId, { esAdmin: true }).catch(() => {}); // devuelve stock
  }
  res.json({ recibido: true });
});

export default r;
