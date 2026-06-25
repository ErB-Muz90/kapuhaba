import { Router } from 'express';
import { prisma } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

const OPEN_STATUSES = ['ACTIVE', 'SUSPENDED', 'CLOSING', 'active'];
const CASH_METHOD = 'CASH';
const LEGACY_TYPES: Record<string, string> = {
  OPENING_FLOAT: 'FLOAT',
  SALE_CASH: 'SALE',
  CASH_IN: 'FLOAT',
};

function normalizeStatus(status?: string | null) {
  return (status || '').toUpperCase();
}

function normalizeType(type?: string | null) {
  const value = (type || '').toUpperCase();
  return LEGACY_TYPES[value] || value;
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function isCashDrawerMovement(method: string, direction: string) {
  return method === CASH_METHOD && (direction === 'IN' || direction === 'OUT');
}

async function calculateExpectedCash(
  tx: {
    cashDrawerTransaction: {
      findMany: (args: { where: { shiftId: string } }) => Promise<Array<{ type: string; method: string; direction: string; amount: number }>>;
    };
  },
  shiftId: string,
) {
  const movements = await tx.cashDrawerTransaction.findMany({ where: { shiftId } });
  return roundMoney(movements.reduce((sum, movement) => {
    const type = normalizeType(movement.type);
    const method = (movement.method || CASH_METHOD).toUpperCase();
    if (!isCashDrawerMovement(method, movement.direction)) return sum;
    if (type === 'SALE' || type === 'FLOAT') return movement.direction === 'IN' ? sum + movement.amount : sum - movement.amount;
    if (type === 'EXPENSE' || type === 'PAYOUT' || type === 'BANKING') return sum - movement.amount;
    return sum;
  }, 0));
}

router.get('/', async (_req, res) => {
  const data = await prisma.shift.findMany({ orderBy: { startedAt: 'desc' } });
  res.json(data);
});

router.get('/active', async (_req, res) => {
  const data = await prisma.shift.findFirst({ where: { status: { in: OPEN_STATUSES } } });
  res.json(data);
});

router.post('/', async (req, res) => {
  const { float, staffId, staffName, terminalId, zeroFloatConfirmed } = req.body;
  const openingFloat = Number(float ?? 0);
  if (!Number.isFinite(openingFloat) || openingFloat < 0) {
    res.status(400).json({ error: 'Opening float must be zero or a positive amount' });
    return;
  }
  if (openingFloat === 0 && zeroFloatConfirmed !== true) {
    res.status(400).json({ error: 'Confirm zero opening float before starting shift' });
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.shift.findFirst({
      where: { terminalId, status: { in: OPEN_STATUSES } },
      orderBy: { startedAt: 'desc' },
    });
    if (existing) return existing;

    const shift = await tx.shift.create({
      data: {
        staffId,
        staffName,
        terminalId,
        startingFloat: openingFloat,
        status: 'ACTIVE',
      },
    });

    await tx.cashDrawerTransaction.create({
      data: {
        shiftId: shift.id,
        type: 'FLOAT',
        method: CASH_METHOD,
        direction: 'IN',
        amount: openingFloat,
        referenceType: 'other',
        notes: 'Opening float',
      },
    });

    return shift;
  });

  res.json(result);
});

router.put('/:id', async (req, res) => {
  const existing = await prisma.shift.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ error: 'Shift not found' }); return; }
  if (normalizeStatus(existing.status) === 'CLOSED') { res.status(400).json({ error: 'Cannot modify closed shift' }); return; }

  // Prevent closing via PUT — use POST /:id/close instead
  const { status, endedAt, actualCash, expectedCash, variance, retainedFloat, toBank, startingFloat, ...safe } = req.body;
  const data = await prisma.shift.update({ where: { id: req.params.id }, data: safe });
  res.json(data);
});

// Close shift with ledger-based expected cash calculation
router.post('/:id/close', async (req, res) => {
  const { countedCash, actualCash, retainedFloat = 0, notes } = req.body;
  const shiftId = req.params.id;
  const cashCount = countedCash ?? actualCash;
  const counted = Number(cashCount);
  const retained = Number(retainedFloat);

  if (!Number.isFinite(counted) || counted < 0) {
    res.status(400).json({ error: 'Counted cash is required and cannot be negative' });
    return;
  }
  if (!Number.isFinite(retained) || retained < 0 || retained > counted) {
    res.status(400).json({ error: 'Retained float must be between zero and counted cash' });
    return;
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const shift = await tx.shift.findUnique({ where: { id: shiftId } });
      if (!shift) throw new Error('SHIFT_NOT_FOUND');
      if (normalizeStatus(shift.status) === 'CLOSED') throw new Error('SHIFT_CLOSED');

      await tx.shift.update({ where: { id: shiftId }, data: { status: 'CLOSING' } });
      const expectedCash = await calculateExpectedCash(tx, shiftId);
      const variance = roundMoney(counted - expectedCash);
      const toBank = roundMoney(counted - retained);

      return tx.shift.update({
        where: { id: shiftId },
        data: {
          status: 'CLOSED',
          endedAt: new Date(),
          expectedCash,
          actualCash: roundMoney(counted),
          variance,
          retainedFloat: roundMoney(retained),
          toBank,
          notes,
        },
      });
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === 'SHIFT_NOT_FOUND') { res.status(404).json({ error: 'Shift not found' }); return; }
    if (error instanceof Error && error.message === 'SHIFT_CLOSED') { res.status(400).json({ error: 'Shift already closed' }); return; }
    res.status(500).json({ error: 'Failed to close shift' });
  }
});

// Cash movements
router.get('/transactions', async (req, res) => {
  const { shiftId } = req.query;
  const where = shiftId ? { shiftId: shiftId as string } : {};
  const data = await prisma.cashDrawerTransaction.findMany({ where, orderBy: { createdAt: 'desc' } });
  res.json(data);
});

router.post('/transactions', async (req, res) => {
  const { shiftId, direction, notes, referenceId, referenceType, allowNegativeDrawer } = req.body;
  const type = normalizeType(req.body.type);
  const method = (req.body.method || CASH_METHOD).toUpperCase();
  const amount = Number(req.body.amount);

  // Validate direction matches type
  const validDirections: Record<string, string> = {
    SALE: 'IN',
    FLOAT: direction === 'OUT' ? 'OUT' : 'IN',
    EXPENSE: 'OUT',
    PAYOUT: 'OUT',
    BANKING: 'OUT',
  };

  if (!validDirections[type]) {
    res.status(400).json({ error: `Unknown movement type: ${type}. Allowed: ${Object.keys(validDirections).join(', ')}` });
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: 'Amount must be greater than zero' });
    return;
  }
  if (!['CASH', 'MPESA', 'CARD'].includes(method)) {
    res.status(400).json({ error: 'Invalid payment method' });
    return;
  }

  if (validDirections[type] !== direction) {
    res.status(400).json({
      error: `Invalid direction for type ${type}. Expected ${validDirections[type]}, got ${direction}`,
    });
    return;
  }

  try {
    const data = await prisma.$transaction(async (tx) => {
      const shift = await tx.shift.findUnique({ where: { id: shiftId } });
      if (!shift) throw new Error('SHIFT_NOT_FOUND');
      if (normalizeStatus(shift.status) === 'CLOSED') throw new Error('SHIFT_CLOSED');

      let anomaly = false;
      if (method === CASH_METHOD && direction === 'OUT') {
        const expectedCash = await calculateExpectedCash(tx, shiftId);
        if (roundMoney(expectedCash - amount) < 0) {
          if (allowNegativeDrawer !== true) throw new Error('NEGATIVE_DRAWER');
          anomaly = true;
        }
      }

      return tx.cashDrawerTransaction.create({
        data: { shiftId, type, method, direction, amount, notes, referenceId, referenceType, anomaly },
      });
    });

    res.json(data);
  } catch (error) {
    if (error instanceof Error && error.message === 'SHIFT_NOT_FOUND') { res.status(404).json({ error: 'Shift not found' }); return; }
    if (error instanceof Error && error.message === 'SHIFT_CLOSED') { res.status(400).json({ error: 'Cannot edit a closed shift' }); return; }
    if (error instanceof Error && error.message === 'NEGATIVE_DRAWER') { res.status(400).json({ error: 'Transaction would make the cash drawer negative' }); return; }
    res.status(500).json({ error: 'Failed to record drawer transaction' });
  }
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
