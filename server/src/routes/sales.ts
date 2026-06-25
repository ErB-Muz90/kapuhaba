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
  const data = await prisma.sale.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { payments: true },
  });
  res.json(data.map(s => ({ ...s, items: s.items ?? [], payments: s.payments ?? [] })));
});

router.get('/daily-summary', async (req, res) => {
  const { date } = req.query;
  const dayStart = new Date(date ? date as string : new Date().toISOString().split('T')[0]);
  const dayEnd = new Date(dayStart.getTime() + 86400000);
  const sales = await prisma.sale.findMany({
    where: { createdAt: { gte: dayStart, lt: dayEnd } },
    include: { payments: true },
  });
  const totalSales = sales.length;
  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
  const paymentBreakdown = { cash: 0, mpesa: 0, card: 0 };
  for (const s of sales) {
    for (const p of s.payments) {
      const key = p.method.toLowerCase() as keyof typeof paymentBreakdown;
      if (key in paymentBreakdown) paymentBreakdown[key] += p.amount;
    }
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
    const items = (sale.items as Array<{ productId: string; productName: string; quantity: number; total: number }>) ?? [];
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
  const data = await prisma.sale.findUnique({
    where: { id: req.params.id },
    include: { payments: true },
  });
  if (!data) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ ...data, items: data.items ?? [], payments: data.payments ?? [] });
});

router.post('/', async (req, res) => {
  const { payments, shiftId, ...saleData } = req.body;

  const sale = await prisma.sale.create({
    data: {
      ...saleData,
      payments: {
        create: (payments as Array<{ method: string; amount: number }>) ?? [],
      },
    },
    include: { payments: true },
  });

  // Only CASH payments create a cash drawer movement
  if (shiftId) {
    const cashPayments = (payments as Array<{ method: string; amount: number }>) ?? [];
    const totalCash = cashPayments
      .filter(p => p.method === 'CASH')
      .reduce((sum, p) => sum + p.amount, 0);

    if (totalCash > 0) {
      await prisma.cashDrawerTransaction.create({
        data: {
          shiftId,
          type: 'SALE_CASH',
          direction: 'IN',
          amount: totalCash,
          referenceId: sale.id,
          referenceType: 'sale',
          notes: `Sale ${sale.id.slice(0, 8)} - CASH`,
        },
      });
    }
  }

  for (const item of (saleData.items as Array<{ productId: string; quantity: number }>) ?? []) {
    await prisma.product.update({
      where: { id: item.productId },
      data: { stockQuantity: { decrement: item.quantity } },
    });
  }

  res.json({ ...sale, items: sale.items ?? [], payments: sale.payments ?? [] });
});

router.delete('/:id', async (req, res) => {
  await prisma.payment.deleteMany({ where: { saleId: req.params.id } });
  await prisma.sale.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

export default router;
