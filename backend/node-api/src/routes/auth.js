import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { authenticate } from '../middleware/authenticate.js';

const router = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function createSession(user) {
  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  return { token, user: { id: user.id, email: user.email } };
}

router.post('/register', async (request, response, next) => {
  const email = String(request.body?.email || '').trim().toLowerCase();
  const password = String(request.body?.password || '');
  if (!emailPattern.test(email)) return response.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 10) return response.status(400).json({ error: 'Use a password with at least 10 characters.' });
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ email, passwordHash });
    return response.status(201).json(createSession(user));
  } catch (error) {
    if (error.code === 11000) return response.status(409).json({ error: 'An account with this email already exists.' });
    return next(error);
  }
});

router.post('/login', async (request, response, next) => {
  const email = String(request.body?.email || '').trim().toLowerCase();
  const password = String(request.body?.password || '');
  try {
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return response.status(401).json({ error: 'Email or password is incorrect.' });
    }
    return response.json(createSession(user));
  } catch (error) {
    return next(error);
  }
});

router.get('/me', authenticate, async (request, response, next) => {
  try {
    const user = await User.findById(request.auth.userId).lean();
    if (!user) return response.status(401).json({ error: 'Account not found. Please sign in again.' });
    return response.json({ user: { id: user._id, email: user.email } });
  } catch (error) {
    return next(error);
  }
});

export default router;