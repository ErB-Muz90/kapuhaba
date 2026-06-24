import { Router } from 'express';
import { prisma } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (_req, res) => {
  const data = await prisma.loyaltyAccount.findMany();
  res.json(data);
});

router.get('/:customerId', async (req, res) => {
  const data = await prisma.loyaltyAccount.findUnique({ where: { customerId: req.params.customerId } });
  if (!data) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(data);
});

router.post('/', async (req, res) => {
  const data = await prisma.loyaltyAccount.create({ data: req.body });
  res.json(data);
});

router.put('/:customerId', async (req, res) => {
  const data = await prisma.loyaltyAccount.update({ where: { customerId: req.params.customerId }, data: req.body });
  res.json(data);
});

router.get('/transactions', async (req, res) => {
  const { customerId } = req.query;
  const where = customerId ? { customerId: customerId as string } : {};
  const data = await prisma.loyaltyTransaction.findMany({ where, orderBy: { createdAt: 'desc' } });
  res.json(data);
});

router.post('/transactions', async (req, res) => {
  const { customerId, points } = req.body;
  const tx = await prisma.loyaltyTransaction.create({ data: req.body });
  if (req.body.type === 'earned') {
    await prisma.loyaltyAccount.upsert({
      where: { customerId },
      update: { pointsBalance: { increment: points }, totalPointsEarned: { increment: points }, lastActivity: new Date() },
      create: { customerId, customerName: req.body.customerName || '', phone: '', pointsBalance: points, totalPointsEarned: points, totalPointsRedeemed: 0, tier: 'bronze' },
    });
  } else if (req.body.type === 'redeemed') {
    await prisma.loyaltyAccount.update({
      where: { customerId },
      data: { pointsBalance: { decrement: points }, totalPointsRedeemed: { increment: points }, lastActivity: new Date() },
    });
  }
  res.json(tx);
});

export default router;
