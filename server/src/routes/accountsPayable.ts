import { Router } from 'express';
import { prisma } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (_req, res) => {
  const data = await prisma.accountPayable.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(data);
});

router.post('/', async (req, res) => {
  const { amount, paidAmount = 0, ...rest } = req.body;
  const balance = amount - paidAmount;
  const status = balance <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'pending';
  const data = await prisma.accountPayable.create({
    data: { amount, paidAmount, balance, status, ...rest },
  });
  res.json(data);
});

router.put('/:id', async (req, res) => {
  const existing = await prisma.accountPayable.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
  const { paidAmount, ...rest } = req.body;
  const newPaidAmount = paidAmount ?? existing.paidAmount;
  const newBalance = existing.amount - newPaidAmount;
  const newStatus = newBalance <= 0 ? 'paid' : newPaidAmount > 0 ? 'partial' : 'pending';
  const data = await prisma.accountPayable.update({
    where: { id: req.params.id },
    data: { ...rest, paidAmount: newPaidAmount, balance: newBalance, status: newStatus },
  });
  res.json(data);
});

router.delete('/:id', async (req, res) => {
  await prisma.accountPayable.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

router.get('/payments', async (req, res) => {
  const { payableId } = req.query;
  const where = payableId ? { payableId: payableId as string } : {};
  const data = await prisma.payablePayment.findMany({ where, orderBy: { paidAt: 'desc' } });
  res.json(data);
});

router.post('/payments', async (req, res) => {
  const { payableId, amount } = req.body;
  const data = await prisma.payablePayment.create({ data: req.body });
  const payable = await prisma.accountPayable.findUnique({ where: { id: payableId } });
  if (payable) {
    const newPaidAmount = payable.paidAmount + amount;
    const newBalance = payable.amount - newPaidAmount;
    const newStatus = newBalance <= 0 ? 'paid' : 'partial';
    await prisma.accountPayable.update({
      where: { id: payableId },
      data: { paidAmount: newPaidAmount, balance: newBalance, status: newStatus },
    });
  }
  res.json(data);
});

export default router;
