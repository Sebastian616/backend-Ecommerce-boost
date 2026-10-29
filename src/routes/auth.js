import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/errors.js';

const r = Router();
const token = (u) => jwt.sign({ id: u.id, rol: u.rol }, process.env.JWT_SECRET, { expiresIn: '7d' });

r.post('/registro', async (req, res) => {
  const d = z
    .object({ nombre: z.string().min(2), email: z.string().email(), password: z.string().min(8) })
    .parse(req.body);
  const u = await prisma.usuario.create({
    data: {
      ...d,
      email: d.email.toLowerCase(),
      password: await bcrypt.hash(d.password, 10),
      carrito: { create: {} },
    },
  });
  res.status(201).json({ token: token(u), usuario: { id: u.id, nombre: u.nombre, email: u.email } });
});

r.post('/login', async (req, res) => {
  const d = z.object({ email: z.string().email(), password: z.string() }).parse(req.body);
  const u = await prisma.usuario.findUnique({ where: { email: d.email.toLowerCase() } });
  if (!u || !u.activo || !(await bcrypt.compare(d.password, u.password)))
    throw new HttpError(401, 'Credenciales incorrectas');
  res.json({ token: token(u), usuario: { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol } });
});

export default r;
