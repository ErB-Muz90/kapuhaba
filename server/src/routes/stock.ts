import { Router } from 'express';
import { prisma } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/adjustments', async (_req, res) => {
  const data = await prisma.stockAdjustment.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(data);
});

router.post('/adjustments', async (req, res) => {
  const { productId, quantityChange, ...rest } = req.body;
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) { res.status(404).json({ error: 'Product not found' }); return; }
  const previousQuantity = product.stockQuantity;
  const newQuantity = previousQuantity + quantityChange;
  await prisma.product.update({ where: { id: productId }, data: { stockQuantity: newQuantity } });
  const data = await prisma.stockAdjustment.create({
    data: { productId, previousQuantity, newQuantity, quantityChange, ...rest },
  });
  res.json(data);
});

router.get('/counts', async (_req, res) => {
  const data = await prisma.stockCount.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(data);
});

router.post('/counts', async (req, res) => {
  const data = await prisma.stockCount.create({ data: req.body });
  res.json(data);
});

router.put('/counts/:id', async (req, res) => {
  const data = await prisma.stockCount.update({ where: { id: req.params.id }, data: req.body });
  res.json(data);
});

export default router;
