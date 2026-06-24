import { Router } from 'express';
import { prisma } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (_req, res) => {
  const data = await prisma.shift.findMany({ orderBy: { startedAt: 'desc' } });
  res.json(data);
});

router.get('/active', async (_req, res) => {
  const data = await prisma.shift.findFirst({ where: { status: 'active' } });
  res.json(data);
});

router.post('/', async (req, res) => {
  const data = await prisma.shift.create({ data: req.body });
  res.json(data);
});

router.put('/:id', async (req, res) => {
  const data = await prisma.shift.update({ where: { id: req.params.id }, data: req.body });
  res.json(data);
});

router.get('/transactions', async (req, res) => {
  const { shiftId } = req.query;
  const where = shiftId ? { shiftId: shiftId as string } : {};
  const data = await prisma.cashDrawerTransaction.findMany({ where, orderBy: { createdAt: 'desc' } });
  res.json(data);
});

router.post('/transactions', async (req, res) => {
  const data = await prisma.cashDrawerTransaction.create({ data: req.body });
  res.json(data);
});

router.get('/sessions', async (_req, res) => {
  const data = await prisma.terminalSession.findMany({ orderBy: { startedAt: 'desc' } });
  res.json(data);
});

router.post('/sessions', async (req, res) => {
  const data = await prisma.terminalSession.create({ data: req.body });
  res.json(data);
});

router.put('/sessions/:id', async (req, res) => {
  const data = await prisma.terminalSession.update({ where: { id: req.params.id }, data: req.body });
  res.json(data);
});

export default router;
