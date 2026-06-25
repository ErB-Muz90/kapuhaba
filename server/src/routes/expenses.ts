import { Router } from 'express';
import { prisma } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (_req, res) => {
  const data = await prisma.expense.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(data);
});

router.post('/', async (req, res) => {
  const body = { ...req.body };
  // Convert date-only strings to ISO-8601 DateTime
  if (body.date && typeof body.date === 'string' && body.date.length === 10) {
    body.date = new Date(body.date + 'T00:00:00.000Z').toISOString();
  }
  if (body.dueDate && typeof body.dueDate === 'string' && body.dueDate.length === 10) {
    body.dueDate = new Date(body.dueDate + 'T00:00:00.000Z').toISOString();
  }
  // Remove empty string dueDate so Prisma stores NULL
  if (body.dueDate === '') body.dueDate = undefined;
  const data = await prisma.expense.create({ data: body });
  res.json(data);
});

router.put('/:id', async (req, res) => {
  const body = { ...req.body };
  if (body.date && typeof body.date === 'string' && body.date.length === 10) {
    body.date = new Date(body.date + 'T00:00:00.000Z').toISOString();
  }
  if (body.dueDate && typeof body.dueDate === 'string' && body.dueDate.length === 10) {
    body.dueDate = new Date(body.dueDate + 'T00:00:00.000Z').toISOString();
  }
  if (body.dueDate === '') body.dueDate = undefined;
  const data = await prisma.expense.update({ where: { id: req.params.id }, data: body });
  res.json(data);
});

router.delete('/:id', async (req, res) => {
  await prisma.expense.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

export default router;
