import { Router } from 'express';
import { prisma } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (_req, res) => {
  const data = await prisma.shift.findMany({ orderBy: { startedAt: 'desc' } });
  res.json(data);
});

router.get('/active', async (_req, res) => {
  const data = await prisma.shift.findFirst({ where: { status: 'active' } });
  res.json(data);
});

router.post('/', async (req, res) => {
  const { float, staffId, staffName, terminalId } = req.body;
  const shift = await prisma.shift.create({
    data: {
      staffId,
      staffName,
      terminalId,
      startingFloat: float ?? 0,
      status: 'active',
    },
  });

  // Record opening float as a cash movement
  await prisma.cashDrawerTransaction.create({
    data: {
      shiftId: shift.id,
      type: 'OPENING_FLOAT',
      direction: 'IN',
      amount: float ?? 0,
      referenceType: 'other',
      notes: 'Opening float',
    },
  });

  res.json(shift);
});

router.put('/:id', async (req, res) => {
  const data = await prisma.shift.update({ where: { id: req.params.id }, data: req.body });
  res.json(data);
});

// Close shift with ledger-based expected cash calculation
router.post('/:id/close', async (req, res) => {
  const { actualCash } = req.body;
  const shiftId = req.params.id;

  const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!shift) { res.status(404).json({ error: 'Shift not found' }); return; }
  if (shift.status === 'closed') { res.status(400).json({ error: 'Shift already closed' }); return; }

  // Calculate expected cash from the ledger
  const movements = await prisma.cashDrawerTransaction.findMany({ where: { shiftId } });
  let expectedCash = 0;
  for (const m of movements) {
    if (m.direction === 'IN') expectedCash += m.amount;
    if (m.direction === 'OUT') expectedCash -= m.amount;
  }

  const variance = actualCash - expectedCash;

  const updated = await prisma.shift.update({
    where: { id: shiftId },
    data: {
      status: 'closed',
      endedAt: new Date(),
      expectedCash,
      actualCash,
      variance,
    },
  });

  res.json({ ...updated, expectedCash, actualCash, variance });
});

// Cash movements
router.get('/transactions', async (req, res) => {
  const { shiftId } = req.query;
  const where = shiftId ? { shiftId: shiftId as string } : {};
  const data = await prisma.cashDrawerTransaction.findMany({ where, orderBy: { createdAt: 'desc' } });
  res.json(data);
});

router.post('/transactions', async (req, res) => {
  const { shiftId, type, direction, amount, notes, referenceId, referenceType } = req.body;

  // Validate direction matches type
  const validDirections: Record<string, string> = {
    OPENING_FLOAT: 'IN',
    SALE_CASH: 'IN',
    CASH_IN: 'IN',
    EXPENSE: 'OUT',
    PAYOUT: 'OUT',
    BANKING: 'OUT',
  };

  if (validDirections[type] && validDirections[type] !== direction) {
    res.status(400).json({
      error: `Invalid direction for type ${type}. Expected ${validDirections[type]}, got ${direction}`,
    });
    return;
  }

  const data = await prisma.cashDrawerTransaction.create({
    data: { shiftId, type, direction, amount, notes, referenceId, referenceType },
  });
  res.json(data);
});

// Sessions
router.get('/sessions', async (_req, res) => {
  const data = await prisma.terminalSession.findMany({ orderBy: { startedAt: 'desc' } });
  res.json(data);
});

router.post('/sessions', async (req, res) => {
  const data = await prisma.terminalSession.create({ data: req.body });
  res.json(data);
});

router.put('/sessions/:id', async (req, res) => {
  const data = await prisma.terminalSession.update({ where: { id: req.params.id }, data: req.body });
  res.json(data);
});

export default router;
