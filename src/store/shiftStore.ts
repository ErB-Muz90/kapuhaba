import { create } from 'zustand';
import { api } from '../api/client';
import type { Shift, CashMovement, TerminalSession, CashMovementType, CashDirection } from '../types';

interface ShiftStore {
  shifts: Shift[];
  cashMovements: CashMovement[];
  terminalSessions: TerminalSession[];
  activeShiftId: string | null;
  loading: boolean;
  fetch: () => Promise<void>;
  fetchMovements: () => Promise<void>;
  fetchSessions: () => Promise<void>;
  startShift: (staffId: string, staffName: string, terminalId: string, startingFloat: number) => Promise<Shift>;
  endShift: (shiftId: string, actualCash: number, notes?: string) => Promise<{ success: boolean; variance: number }>;
  getActiveShift: () => Shift | undefined;
  getShiftHistory: (staffId?: string) => Shift[];
  addCashMovement: (shiftId: string, type: CashMovementType, direction: CashDirection, amount: number, notes?: string, referenceId?: string, referenceType?: 'sale' | 'payable' | 'expense' | 'other') => Promise<CashMovement | null>;
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

export const useShiftStore = create<ShiftStore>()((set, get) => ({
  shifts: [],
  cashMovements: [],
  terminalSessions: [],
  activeShiftId: null,
  loading: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const [shifts, cashMovements, terminalSessions] = await Promise.all([
        api.get<Shift[]>('/shifts'),
        api.get<CashMovement[]>('/shifts/transactions'),
        api.get<TerminalSession[]>('/shifts/sessions'),
      ]);
      const active = shifts.find((s) => s.status === 'active');
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

  startShift: async (staffId, staffName, terminalId, startingFloat) => {
    const existing = get().shifts.find((s) => s.terminalId === terminalId && s.status === 'active');
    if (existing) {
      set({ activeShiftId: existing.id });
      return existing;
    }
    const shift = await api.post<Shift>('/shifts', {
      float: startingFloat,
      staffId, staffName, terminalId,
    });
    // Reload movements so the OPENING_FLOAT entry appears immediately
    const movements = await api.get<CashMovement[]>('/shifts/transactions');
    set((state) => ({ shifts: [shift, ...state.shifts], cashMovements: movements, activeShiftId: shift.id }));
    return shift;
  },

  endShift: async (shiftId, actualCash) => {
    const result = await api.post<{ expectedCash: number; actualCash: number; variance: number }>(`/shifts/${shiftId}/close`, { actualCash });
    // Refresh shifts from server to get updated values
    await get().fetch();
    return { success: true, variance: result.variance };
  },

  getActiveShift: () => {
    const { activeShiftId, shifts } = get();
    return shifts.find((s) => s.id === activeShiftId);
  },

  getShiftHistory: (staffId) => {
    const { shifts } = get();
    return staffId ? shifts.filter((s) => s.staffId === staffId) : shifts;
  },

  addCashMovement: async (shiftId, type, direction, amount, notes, referenceId, referenceType) => {
    try {
      const movement = await api.post<CashMovement>('/shifts/transactions', {
        shiftId, type, direction, amount, notes, referenceId, referenceType,
      });
      set((state) => ({ cashMovements: [...state.cashMovements, movement] }));
      return movement;
    } catch { return null; }
  },

  getCashBalance: (shiftId) => {
    const movements = get().getCashMovements(shiftId);
    const shift = get().shifts.find((s) => s.id === shiftId);
    if (!shift) return 0;
    let balance = 0;
    for (const m of movements) {
      if (m.direction === 'IN') balance += m.amount;
      if (m.direction === 'OUT') balance -= m.amount;
    }
    return Math.max(0, Number(balance.toFixed(2)));
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
    const cashSales = movements.filter((m) => m.type === 'SALE_CASH').reduce((s, m) => s + m.amount, 0);
    const cashPaidIn = movements.filter((m) => m.type === 'CASH_IN').reduce((s, m) => s + m.amount, 0);
    const cashPaidOut = movements.filter((m) => m.type === 'PAYOUT' || m.type === 'EXPENSE').reduce((s, m) => s + m.amount, 0);
    const cashBanked = movements.filter((m) => m.type === 'BANKING').reduce((s, m) => s + m.amount, 0);

    const expectedCash = openingFloat + cashSales + cashPaidIn - cashPaidOut - cashBanked;
    const actualCash = shift.actualCash ?? expectedCash;
    const variance = Number((actualCash - expectedCash).toFixed(2));
    const retainedFloat = openingFloat;
    const toBank = Math.max(0, Number((expectedCash - retainedFloat).toFixed(2)));

    return {
      openingFloat, cashSales, cashPaidIn, cashPaidOut, cashBanked,
      totalPaidIn: cashPaidIn, totalPaidOut: cashPaidOut,
      expectedCash: Number(expectedCash.toFixed(2)),
      actualCash: Number(actualCash.toFixed(2)),
      variance, retainedFloat, toBank,
    };
  },
}));
