import { create } from 'zustand';
import { api } from '../api/client';
import type { Shift, CashDrawerTransaction, TerminalSession } from '../types';

interface ShiftStore {
  shifts: Shift[];
  cashDrawerTransactions: CashDrawerTransaction[];
  terminalSessions: TerminalSession[];
  activeShiftId: string | null;
  loading: boolean;
  fetch: () => Promise<void>;
  fetchTransactions: () => Promise<void>;
  fetchSessions: () => Promise<void>;
  startShift: (staffId: string, staffName: string, terminalId: string, startingFloat: number) => Promise<Shift>;
  endShift: (shiftId: string, closingCash: number, notes?: string) => Promise<{ success: boolean; variance: number }>;
  getActiveShift: () => Shift | undefined;
  getShiftHistory: (staffId?: string) => Shift[];
  addCashDrawerTransaction: (shiftId: string, type: 'paid_in' | 'paid_out' | 'bank_deposit' | 'mpesa_deposit', amount: number, method: 'cash' | 'mpesa' | 'bank', notes?: string, referenceId?: string, referenceType?: 'sale' | 'payable' | 'expense' | 'other') => Promise<CashDrawerTransaction | null>;
  getCashDrawerBalance: (shiftId: string) => number;
  getCashDrawerHistory: (shiftId: string) => CashDrawerTransaction[];
  linkSaleToCashDrawer: (shiftId: string, saleId: string, amount: number, paymentMethod: 'cash' | 'mpesa' | 'card') => void;
  createSession: (staffId: string, staffName: string, terminalId: string) => Promise<TerminalSession>;
  endSession: (sessionId: string) => Promise<void>;
  getActiveSession: (terminalId: string) => TerminalSession | undefined;
  getShiftSummary: (shiftId: string) => {
    openingFloat: number; totalSales: number; cashSales: number; mpesaSales: number; cardSales: number;
    cashPaidIn: number; cashPaidOut: number; cashBanked: number;
    totalPaidIn: number; totalPaidOut: number; totalDeposits: number;
    expectedCash: number; actualCash: number; variance: number;
    retainedFloat: number; toBank: number; mpesaTotal: number; cardTotal: number;
  };
}

export const useShiftStore = create<ShiftStore>()((set, get) => ({
  shifts: [],
  cashDrawerTransactions: [],
  terminalSessions: [],
  activeShiftId: null,
  loading: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const shifts = await api.get<Shift[]>('/shifts');
      const active = shifts.find((s) => s.status === 'active');
      set({ shifts, activeShiftId: active?.id || null, loading: false });
    } catch { set({ loading: false }); }
  },

  fetchTransactions: async () => {
    try {
      const transactions = await api.get<CashDrawerTransaction[]>('/shifts/transactions');
      set({ cashDrawerTransactions: transactions });
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
      staffId, staffName, terminalId, startingFloat,
      openingCash: startingFloat, closingCash: 0, status: 'active',
      startedAt: new Date().toISOString(), endedAt: null,
    });
    set((state) => ({ shifts: [shift, ...state.shifts], activeShiftId: shift.id }));
    return shift;
  },

  endShift: async (shiftId, closingCash, notes) => {
    const summary = get().getShiftSummary(shiftId);
    await api.put(`/shifts/${shiftId}`, {
      closingCash, status: 'closed', endedAt: new Date().toISOString(), notes,
    });
    set((state) => ({
      shifts: state.shifts.map((s) =>
        s.id === shiftId ? { ...s, closingCash, status: 'closed' as const, endedAt: new Date().toISOString(), notes } : s
      ),
      activeShiftId: null,
    }));
    return { success: true, variance: summary.variance };
  },

  getActiveShift: () => {
    const { activeShiftId, shifts } = get();
    return shifts.find((s) => s.id === activeShiftId);
  },

  getShiftHistory: (staffId) => {
    const { shifts } = get();
    return staffId ? shifts.filter((s) => s.staffId === staffId) : shifts;
  },

  addCashDrawerTransaction: async (shiftId, type, amount, method, notes, referenceId, referenceType) => {
    try {
      const tx = await api.post<CashDrawerTransaction>('/shifts/transactions', {
        shiftId, type, amount, method, notes, referenceId, referenceType, createdAt: new Date().toISOString(),
      });
      set((state) => ({ cashDrawerTransactions: [...state.cashDrawerTransactions, tx] }));
      return tx;
    } catch { return null; }
  },

  getCashDrawerBalance: (shiftId) => {
    const transactions = get().getCashDrawerHistory(shiftId).filter((t) => t.method === 'cash');
    const shift = get().shifts.find((s) => s.id === shiftId);
    if (!shift) return 0;
    let balance = shift.startingFloat;
    transactions.forEach((t) => {
      if (t.type === 'paid_in') balance += t.amount;
      else if (t.type === 'paid_out' || t.type === 'bank_deposit') balance -= t.amount;
    });
    return Math.max(0, Number(balance.toFixed(2)));
  },

  getCashDrawerHistory: (shiftId) =>
    get().cashDrawerTransactions.filter((t) => t.shiftId === shiftId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),

  linkSaleToCashDrawer: (shiftId, saleId, amount, paymentMethod) => {
    const method = paymentMethod === 'cash' ? 'cash' : paymentMethod === 'mpesa' ? 'mpesa' : 'bank';
    const type = paymentMethod === 'cash' ? 'paid_in' : paymentMethod === 'mpesa' ? 'mpesa_deposit' : 'paid_in';
    get().addCashDrawerTransaction(shiftId, type as any, amount, method as any, `Sale ${saleId.slice(0, 8)} - ${paymentMethod.toUpperCase()}`, saleId, 'sale');
  },

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
      return { openingFloat: 0, totalSales: 0, cashSales: 0, mpesaSales: 0, cardSales: 0, cashPaidIn: 0, cashPaidOut: 0, cashBanked: 0, totalPaidIn: 0, totalPaidOut: 0, totalDeposits: 0, expectedCash: 0, actualCash: 0, variance: 0, retainedFloat: 0, toBank: 0, mpesaTotal: 0, cardTotal: 0 };
    }
    const transactions = get().getCashDrawerHistory(shiftId);
    const cashSales = transactions.filter((t) => t.type === 'paid_in' && t.method === 'cash' && t.referenceType === 'sale').reduce((s, t) => s + t.amount, 0);
    const mpesaSales = transactions.filter((t) => t.method === 'mpesa' && t.referenceType === 'sale').reduce((s, t) => s + t.amount, 0);
    const cardSales = transactions.filter((t) => t.method === 'bank' && t.referenceType === 'sale').reduce((s, t) => s + t.amount, 0);
    const cashPaidIn = transactions.filter((t) => t.type === 'paid_in' && t.method === 'cash').reduce((s, t) => s + t.amount, 0);
    const cashPaidOut = transactions.filter((t) => t.type === 'paid_out' && t.method === 'cash').reduce((s, t) => s + t.amount, 0);
    const cashBanked = transactions.filter((t) => t.type === 'bank_deposit').reduce((s, t) => s + t.amount, 0);
    const openingFloat = shift.startingFloat;
    const expectedCash = openingFloat + cashPaidIn - cashPaidOut - cashBanked;
    const actualCash = shift.closingCash || expectedCash;
    const variance = Number((actualCash - expectedCash).toFixed(2));
    const retainedFloat = openingFloat;
    const toBank = Math.max(0, Number((expectedCash - retainedFloat).toFixed(2)));
    return { openingFloat, totalSales: cashSales + mpesaSales + cardSales, cashSales, mpesaSales, cardSales, cashPaidIn, cashPaidOut, cashBanked, totalPaidIn: cashPaidIn, totalPaidOut: cashPaidOut, totalDeposits: cashBanked, expectedCash: Number(expectedCash.toFixed(2)), actualCash: Number(actualCash.toFixed(2)), variance, retainedFloat, toBank, mpesaTotal: mpesaSales, cardTotal: cardSales };
  },
}));
