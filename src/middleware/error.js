import { ZodError } from 'zod';

export function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError)
    return res.status(400).json({ error: 'Datos inválidos', detalles: err.flatten().fieldErrors });
  if (err.code === 'P2002') return res.status(409).json({ error: 'Registro duplicado', campo: err.meta?.target });
  if (err.code === 'P2025') return res.status(404).json({ error: 'No encontrado' });
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Error interno' });
}
