import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db.js';
import { generateToken, authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/signup-check', async (_req, res) => {
  try {
    const count = await prisma.user.count();
    res.json({ canSignup: count === 0 });
  } catch {
    res.json({ canSignup: true });
  }
});

router.post('/signup', async (req, res) => {
  try {
    const { username, email, password, role = 'admin' } = req.body;
    const existing = await prisma.user.count();
    if (existing > 0) {
      res.status(400).json({ error: 'Admin already exists' });
      return;
    }
    const hashed = await bcrypt.hash(password, 10);
    const employeeId = 'EMP' + Date.now().toString(36).toUpperCase();
    const user = await prisma.user.create({
      data: { username, email, password: hashed, role, employeeId },
    });
    const token = generateToken({ userId: user.id, username: user.username, employeeId: user.employeeId, role: user.role });
    res.json({
      token,
      user: { id: user.id, username: user.username, employeeId: user.employeeId, email: user.email, role: user.role, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString() },
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(400).json({ error: err instanceof Error ? err.message : 'Signup failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { employeeId: username }],
      },
    });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    const token = generateToken({ userId: user.id, username: user.username, employeeId: user.employeeId, role: user.role });
    res.json({
      token,
      user: { id: user.id, username: user.username, employeeId: user.employeeId, email: user.email, role: user.role, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString() },
    });
  } catch {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({ id: user.id, username: user.username, employeeId: user.employeeId, email: user.email, role: user.role, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString() });
});

router.get('/users', authMiddleware, async (_req, res) => {
  const users = await prisma.user.findMany({ select: { id: true, username: true, employeeId: true, staffId: true, email: true, role: true, createdAt: true, updatedAt: true } });
  res.json(users);
});

router.post('/staff-auth', authMiddleware, async (req, res) => {
  try {
    const { staffId, employeeId, password, role = 'cashier' } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const existing = await prisma.user.findUnique({ where: { employeeId } });
    if (existing) {
      await prisma.user.update({ where: { employeeId }, data: { password: hashed, role } });
    } else {
      await prisma.user.create({
        data: { username: employeeId, employeeId, staffId, email: `${employeeId.toLowerCase()}@kapuhaba.local`, role, password: hashed },
      });
    }
    res.json({ success: true });
  } catch {
    res.status(400).json({ error: 'Failed to create staff auth' });
  }
});

router.put('/staff-password', authMiddleware, async (req, res) => {
  try {
    const { employeeId, password } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.update({ where: { employeeId }, data: { password: hashed } });
    res.json({ success: true });
  } catch {
    res.status(400).json({ error: 'Failed to update password' });
  }
});

router.delete('/users/:employeeId', authMiddleware, async (req, res) => {
  try {
    const { employeeId } = req.params;
    if (typeof employeeId !== 'string') {
      res.status(400).json({ error: 'Invalid employee ID' });
      return;
    }

    await prisma.user.delete({ where: { employeeId } });
    res.json({ success: true });
  } catch {
    res.status(404).json({ error: 'User not found' });
  }
});

export default router;
