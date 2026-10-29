import jwt from 'jsonwebtoken';
import { HttpError } from '../lib/errors.js';

export function auth(req, _res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) throw new HttpError(401, 'Token requerido');
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new HttpError(401, 'Token inválido o expirado');
  }
  next();
}

export function soloAdmin(req, _res, next) {
  if (req.user?.rol !== 'ADMIN') throw new HttpError(403, 'Solo administradores');
  next();
}
