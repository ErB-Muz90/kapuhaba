import { Router } from 'express';
import { prisma } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  const { startDate, endDate } = req.query;
  const where: Record<string, unknown> = {};
  if (startDate && endDate) {
    where.createdAt = { gte: new Date(startDate as string), lte: new Date(endDate as string) };
  }
  const data = await prisma.sale.findMany({ where, orderBy: { createdAt: 'desc' } });
  res.json(data);
});

router.get('/daily-summary', async (req, res) => {
  const { date } = req.query;
  const dayStart = new Date(date ? date as string : new Date().toISOString().split('T')[0]);
  const dayEnd = new Date(dayStart.getTime() + 86400000);
  const sales = await prisma.sale.findMany({
    where: { createdAt: { gte: dayStart, lt: dayEnd } },
  });
  const totalSales = sales.length;
  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
  const paymentBreakdown = { cash: 0, mpesa: 0, card: 0 };
  for (const s of sales) {
    const method = s.paymentMethod as keyof typeof paymentBreakdown;
    if (method in paymentBreakdown) paymentBreakdown[method] += s.total;
  }
  res.json({ date: dayStart.toISOString().split('T')[0], totalSales, totalRevenue, totalProfit: 0, paymentBreakdown });
});

router.get('/top-products', async (req, res) => {
  const { startDate, endDate } = req.query;
  const where: Record<string, unknown> = {};
  if (startDate && endDate) {
    where.createdAt = { gte: new Date(startDate as string), lte: new Date(endDate as string) };
  }
  const sales = await prisma.sale.findMany({ where });
  const productMap = new Map<string, { quantitySold: number; revenue: number }>();
  for (const sale of sales) {
    const items = sale.items as Array<{ productId: string; productName: string; quantity: number; total: number }>;
    for (const item of items) {
      const existing = productMap.get(item.productId) || { quantitySold: 0, revenue: 0 };
      existing.quantitySold += item.quantity;
      existing.revenue += item.total;
      productMap.set(item.productId, existing);
    }
  }
  const result = Array.from(productMap.entries()).map(([productId, data]) => ({
    productId,
    productName: '',
    ...data,
  }));
  res.json(result);
});

router.get('/:id', async (req, res) => {
  const data = await prisma.sale.findUnique({ where: { id: req.params.id } });
  if (!data) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(data);
});

router.post('/', async (req, res) => {
  const data = await prisma.sale.create({ data: req.body });
  for (const item of (req.body.items as Array<{ productId: string; quantity: number }>)) {
    await prisma.product.update({
      where: { id: item.productId },
      data: { stockQuantity: { decrement: item.quantity } },
    });
  }
  res.json(data);
});

router.delete('/:id', async (req, res) => {
  await prisma.sale.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

export default router;
