import { Router } from 'express';
import { prisma } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (_req, res) => {
  let settings = await prisma.businessSettings.findUnique({ where: { id: 'default' } });
  if (!settings) {
    settings = await prisma.businessSettings.create({ data: { id: 'default' } });
  }
  res.json(settings);
});

router.put('/', async (req, res) => {
  const data = await prisma.businessSettings.upsert({
    where: { id: 'default' },
    update: req.body,
    create: { id: 'default', ...req.body },
  });
  res.json(data);
});

export default router;
