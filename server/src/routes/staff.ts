import { Router } from 'express';
import { prisma } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (_req, res) => {
  const data = await prisma.staff.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(data);
});

router.get('/off-days', async (_req, res) => {
  const data = await prisma.staffOffDay.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(data);
});

router.get('/shifts', async (_req, res) => {
  const data = await prisma.staffShift.findMany({ orderBy: { date: 'desc' } });
  res.json(data);
});

router.get('/:id', async (req, res) => {
  const data = await prisma.staff.findUnique({ where: { id: req.params.id } });
  if (!data) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(data);
});

router.post('/', async (req, res) => {
  const data = await prisma.staff.create({ data: req.body });
  res.json(data);
});

router.put('/:id', async (req, res) => {
  const data = await prisma.staff.update({ where: { id: req.params.id }, data: req.body });
  res.json(data);
});

router.delete('/:id', async (req, res) => {
  await prisma.staff.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

router.post('/off-days', async (req, res) => {
  const data = await prisma.staffOffDay.create({ data: req.body });
  res.json(data);
});

router.put('/off-days/:id', async (req, res) => {
  const data = await prisma.staffOffDay.update({ where: { id: req.params.id }, data: req.body });
  res.json(data);
});

router.delete('/off-days/:id', async (req, res) => {
  await prisma.staffOffDay.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

router.post('/shifts', async (req, res) => {
  const data = await prisma.staffShift.create({ data: req.body });
  res.json(data);
});

router.put('/shifts/:id', async (req, res) => {
  const data = await prisma.staffShift.update({ where: { id: req.params.id }, data: req.body });
  res.json(data);
});

router.delete('/shifts/:id', async (req, res) => {
  await prisma.staffShift.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

export default router;
