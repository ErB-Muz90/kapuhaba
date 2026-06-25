import { Router } from 'express';
import { prisma } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.delete('/all', async (req, res) => {
  if ((req as any).user?.role !== 'admin') {
    res.status(403).json({ error: 'Only admins can reset data' });
    return;
  }

  try {
    await prisma.$transaction([
      prisma.cashDrawerTransaction.deleteMany(),
      prisma.payment.deleteMany(),
      prisma.sale.deleteMany(),
      prisma.terminalSession.deleteMany(),
      prisma.shift.deleteMany(),
      prisma.payablePayment.deleteMany(),
      prisma.accountPayable.deleteMany(),
      prisma.purchaseOrder.deleteMany(),
      prisma.expense.deleteMany(),
      prisma.stockAdjustment.deleteMany(),
      prisma.stockCount.deleteMany(),
      prisma.staffOffDay.deleteMany(),
      prisma.staffShift.deleteMany(),
      prisma.staff.deleteMany(),
      prisma.loyaltyTransaction.deleteMany(),
      prisma.loyaltyAccount.deleteMany(),
      prisma.customer.deleteMany(),
      prisma.product.deleteMany(),
      prisma.supplier.deleteMany(),
      prisma.businessSettings.update({
        where: { id: 'default' },
        data: { name: '', address: '', phone: '', email: '', taxRate: 0.16, currency: 'KES', currencySymbol: 'KSh', defaultFloat: 0, loyaltyPointsPerCurrency: 100, loyaltyRedemptionRate: 1 },
      }),
    ]);

    res.json({ success: true, message: 'All data has been reset' });
  } catch (err: any) {
    console.error('Reset failed:', err);
    res.status(500).json({ error: err.message || 'Reset failed' });
  }
});

export default router;
