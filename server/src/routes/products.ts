import { Router } from 'express';
import { prisma } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (_req, res) => {
  const data = await prisma.product.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(data);
});

router.get('/:id', async (req, res) => {
  const data = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!data) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(data);
});

router.post('/', async (req, res) => {
  const data = await prisma.product.create({ data: req.body });
  res.json(data);
});

router.put('/:id', async (req, res) => {
  const data = await prisma.product.update({ where: { id: req.params.id }, data: req.body });
  res.json(data);
});

router.delete('/:id', async (req, res) => {
  await prisma.product.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

export default router;
