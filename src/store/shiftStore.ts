import { create } from 'zustand';
import { api } from '../api/client';
import type { Shift, CashMovement, TerminalSession, CashMovementType, CashDirection } from '../types';

const PENDING_MOVEMENTS_KEY = 'pos-pending-cash-movements';
const OPEN_STATUSES = ['ACTIVE', 'SUSPENDED', 'CLOSING', 'active'];

type PendingMovement = {
  shiftId: string;
  type: CashMovementType;
  method: 'CASH' | 'MPESA' | 'CARD';
  direction: CashDirection;
  amount: number;
  notes?: string;
  referenceId?: string;
  referenceType?: 'sale' | 'payable' | 'expense' | 'other';
};

interface ShiftStore {
  shifts: Shift[];
  cashMovements: CashMovement[];
  terminalSessions: TerminalSession[];
  activeShiftId: string | null;
  loading: boolean;
  fetch: () => Promise<void>;
  fetchMovements: () => Promise<void>;
  fetchSessions: () => Promise<void>;
  startShift: (staffId: string, staffName: string, terminalId: string, startingFloat: number, zeroFloatConfirmed?: boolean) => Promise<Shift>;
  endShift: (shiftId: string, countedCash: number, retainedFloat: number, notes?: string) => Promise<{ success: boolean; variance: number }>;
  getActiveShift: () => Shift | undefined;
  getShiftHistory: (staffId?: string) => Shift[];
  addCashMovement: (shiftId: string, type: CashMovementType, direction: CashDirection, amount: number, notes?: string, referenceId?: string, referenceType?: 'sale' | 'payable' | 'expense' | 'other', allowNegativeDrawer?: boolean) => Promise<CashMovement | null>;
  getCashBalance: (shiftId: string) => number;
  getCashMovements: (shiftId: string) => CashMovement[];
  createSession: (staffId: string, staffName: string, terminalId: string) => Promise<TerminalSession>;
  endSession: (sessionId: string) => Promise<void>;
  getActiveSession: (terminalId: string) => TerminalSession | undefined;
  getShiftSummary: (shiftId: string) => {
    openingFloat: number;
    cashSales: number;
    cashPaidIn: number;
    cashPaidOut: number;
    cashBanked: number;
    totalPaidIn: number;
    totalPaidOut: number;
    expectedCash: number;
    actualCash: number;
    variance: number;
    retainedFloat: number;
    toBank: number;
  };
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function isOpenShift(status: string) {
  return OPEN_STATUSES.includes(status);
}

function normalizeMovementType(type: CashMovementType): CashMovementType {
  if (type === 'OPENING_FLOAT' || type === 'CASH_IN') return 'FLOAT';
  if (type === 'SALE_CASH') return 'SALE';
  return type;
}

function readPendingMovements(): PendingMovement[] {
  try {
    return JSON.parse(localStorage.getItem(PENDING_MOVEMENTS_KEY) || '[]');
  } catch {
    return [];
  }
}

function writePendingMovements(movements: PendingMovement[]) {
  localStorage.setItem(PENDING_MOVEMENTS_KEY, JSON.stringify(movements));
}

async function syncPendingMovements() {
  const pending = readPendingMovements();
  if (pending.length === 0) return;
  const remaining: PendingMovement[] = [];
  for (const movement of pending) {
    try {
      await api.post<CashMovement>('/shifts/transactions', movement);
    } catch {
      remaining.push(movement);
    }
  }
  writePendingMovements(remaining);
}

export const useShiftStore = create<ShiftStore>()((set, get) => ({
  shifts: [],
  cashMovements: [],
  terminalSessions: [],
  activeShiftId: null,
  loading: false,

  fetch: async () => {
    set({ loading: true });
    try {
      await syncPendingMovements();
      const [shifts, cashMovements, terminalSessions] = await Promise.all([
        api.get<Shift[]>('/shifts'),
        api.get<CashMovement[]>('/shifts/transactions'),
        api.get<TerminalSession[]>('/shifts/sessions'),
      ]);
      const active = shifts.find((s) => isOpenShift(s.status));
      set({ shifts, cashMovements, terminalSessions, activeShiftId: active?.id || null, loading: false });
    } catch { set({ loading: false }); }
  },

  fetchMovements: async () => {
    try {
      const movements = await api.get<CashMovement[]>('/shifts/transactions');
      set({ cashMovements: movements });
    } catch {}
  },

  fetchSessions: async () => {
    try {
      const sessions = await api.get<TerminalSession[]>('/shifts/sessions');
      set({ terminalSessions: sessions });
    } catch {}
  },

  startShift: async (staffId, staffName, terminalId, startingFloat, zeroFloatConfirmed = false) => {
    const existing = get().shifts.find((s) => s.terminalId === terminalId && isOpenShift(s.status));
    if (existing) {
      set({ activeShiftId: existing.id });
      return existing;
    }
    const shift = await api.post<Shift>('/shifts', {
      float: startingFloat,
      staffId, staffName, terminalId, zeroFloatConfirmed,
    });
    // Reload movements so the OPENING_FLOAT entry appears immediately
    const movements = await api.get<CashMovement[]>('/shifts/transactions');
    set((state) => ({ shifts: [shift, ...state.shifts], cashMovements: movements, activeShiftId: shift.id }));
    return shift;
  },

  endShift: async (shiftId, countedCash, retainedFloat, notes) => {
    const result = await api.post<Shift>(`/shifts/${shiftId}/close`, { countedCash, retainedFloat, notes });
    // Refresh shifts from server to get updated values
    await get().fetch();
    return { success: true, variance: result.variance ?? 0 };
  },

  getActiveShift: () => {
    const { activeShiftId, shifts } = get();
    return shifts.find((s) => s.id === activeShiftId);
  },

  getShiftHistory: (staffId) => {
    const { shifts } = get();
    return staffId ? shifts.filter((s) => s.staffId === staffId) : shifts;
  },

  addCashMovement: async (shiftId, type, direction, amount, notes, referenceId, referenceType, allowNegativeDrawer = false) => {
    const payload: PendingMovement & { allowNegativeDrawer?: boolean } = {
      shiftId,
      type: normalizeMovementType(type),
      method: 'CASH',
      direction,
      amount,
      notes,
      referenceId,
      referenceType,
      allowNegativeDrawer,
    };
    try {
      const movement = await api.post<CashMovement>('/shifts/transactions', payload);
      set((state) => ({ cashMovements: [movement, ...state.cashMovements] }));
      return movement;
    } catch {
      writePendingMovements([...readPendingMovements(), payload]);
      return null;
    }
  },

  getCashBalance: (shiftId) => {
    return get().getShiftSummary(shiftId).expectedCash;
  },

  getCashMovements: (shiftId) =>
    get().cashMovements
      .filter((m) => m.shiftId === shiftId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),

  createSession: async (staffId, staffName, terminalId) => {
    const existing = get().getActiveSession(terminalId);
    if (existing) get().endSession(existing.id);
    const activeShift = get().getActiveShift();
    const session = await api.post<TerminalSession>('/shifts/sessions', {
      staffId, staffName, terminalId, shiftId: activeShift?.id || null, startedAt: new Date().toISOString(), endedAt: null, status: 'active',
    });
    set((state) => ({ terminalSessions: [session, ...state.terminalSessions] }));
    return session;
  },

  endSession: async (sessionId) => {
    await api.put(`/shifts/sessions/${sessionId}`, { endedAt: new Date().toISOString(), status: 'closed' });
    set((state) => ({
      terminalSessions: state.terminalSessions.map((s) => s.id === sessionId ? { ...s, endedAt: new Date().toISOString(), status: 'closed' } : s),
    }));
  },

  getActiveSession: (terminalId) => get().terminalSessions.find((s) => s.terminalId === terminalId && s.status === 'active'),

  getShiftSummary: (shiftId) => {
    const shift = get().shifts.find((s) => s.id === shiftId);
    if (!shift) {
      return { openingFloat: 0, cashSales: 0, cashPaidIn: 0, cashPaidOut: 0, cashBanked: 0, totalPaidIn: 0, totalPaidOut: 0, expectedCash: 0, actualCash: 0, variance: 0, retainedFloat: 0, toBank: 0 };
    }
    const movements = get().getCashMovements(shiftId);

    const openingFloat = shift.startingFloat;
    const cashMovements = movements.filter((m) => (m.method || 'CASH') === 'CASH');
    const cashSales = cashMovements.filter((m) => normalizeMovementType(m.type) === 'SALE' && m.direction === 'IN').reduce((s, m) => s + m.amount, 0);
    const cashPaidIn = cashMovements.filter((m) => normalizeMovementType(m.type) === 'FLOAT' && m.direction === 'IN' && m.notes !== 'Opening float').reduce((s, m) => s + m.amount, 0);
    const cashPaidOut = cashMovements.filter((m) => normalizeMovementType(m.type) === 'PAYOUT' || normalizeMovementType(m.type) === 'EXPENSE' || (normalizeMovementType(m.type) === 'FLOAT' && m.direction === 'OUT')).reduce((s, m) => s + m.amount, 0);
    const cashBanked = cashMovements.filter((m) => normalizeMovementType(m.type) === 'BANKING').reduce((s, m) => s + m.amount, 0);

    const expectedCash = roundMoney(openingFloat + cashSales + cashPaidIn - cashPaidOut - cashBanked);
    const actualCash = shift.actualCash ?? expectedCash;
    const variance = roundMoney(actualCash - expectedCash);
    const retainedFloat = shift.retainedFloat ?? Math.min(openingFloat, actualCash);
    const toBank = shift.toBank ?? Math.max(0, roundMoney(actualCash - retainedFloat));

    return {
      openingFloat, cashSales, cashPaidIn, cashPaidOut, cashBanked,
      totalPaidIn: cashPaidIn, totalPaidOut: cashPaidOut,
      expectedCash,
      actualCash: roundMoney(actualCash),
      variance, retainedFloat, toBank,
    };
  },
}));
