import { create } from 'zustand';
import { api } from '../api/client';
import type { AccountPayable, PayablePayment, PayableStatus } from '../types';
import { addDays, isAfter, parseISO } from 'date-fns';

interface AccountsPayableStore {
  payables: AccountPayable[];
  payments: PayablePayment[];
  loading: boolean;
  fetch: () => Promise<void>;
  fetchPayments: () => Promise<void>;
  createPayable: (payable: Omit<AccountPayable, 'id' | 'paidAmount' | 'balance' | 'status' | 'createdAt' | 'updatedAt'>) => Promise<AccountPayable>;
  updatePayable: (id: string, updates: Partial<AccountPayable>) => Promise<void>;
  deletePayable: (id: string) => Promise<void>;
  getPayable: (id: string) => AccountPayable | undefined;
  recordPayment: (payableId: string, amount: number, method: PayablePayment['paymentMethod'], reference: string, paidBy: string) => Promise<PayablePayment | null>;
  getPayablePayments: (payableId: string) => PayablePayment[];
  getPayablesBySupplier: (supplierId: string) => AccountPayable[];
  getPayablesByStatus: (status: PayableStatus) => AccountPayable[];
  getOverduePayables: () => AccountPayable[];
  getDueThisWeek: () => AccountPayable[];
  getTotalOutstanding: () => number;
  getTotalOverdue: () => number;
  getAgingReport: () => { current: number; days30: number; days60: number; days90Plus: number };
  updateOverdueStatuses: () => void;
}

export const useAccountsPayableStore = create<AccountsPayableStore>()((set, get) => ({
  payables: [],
  payments: [],
  loading: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const payables = await api.get<AccountPayable[]>('/accounts-payable');
      set({ payables, loading: false });
    } catch { set({ loading: false }); }
  },

  fetchPayments: async () => {
    try {
      const payments = await api.get<PayablePayment[]>('/accounts-payable/payments');
      set({ payments });
    } catch {}
  },

  createPayable: async (payableData) => {
    const created = await api.post<AccountPayable>('/accounts-payable', payableData);
    set((state) => ({ payables: [...state.payables, created] }));
    return created;
  },

  updatePayable: async (id, updates) => {
    await api.put(`/accounts-payable/${id}`, updates);
    set((state) => ({
      payables: state.payables.map((p) => p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p),
    }));
  },

  deletePayable: async (id) => {
    await api.delete(`/accounts-payable/${id}`);
    set((state) => ({
      payables: state.payables.filter((p) => p.id !== id),
      payments: state.payments.filter((p) => p.payableId !== id),
    }));
  },

  getPayable: (id) => get().payables.find((p) => p.id === id),

  recordPayment: async (payableId, amount, method, reference, paidBy) => {
    const payment = await api.post<PayablePayment>('/accounts-payable/payments', {
      payableId, amount, paymentMethod: method, reference, paidBy,
    });
    set((state) => ({ payments: [...state.payments, payment] }));
    get().fetch();
    return payment;
  },

  getPayablePayments: (payableId) => get().payments.filter((p) => p.payableId === payableId),

  getPayablesBySupplier: (supplierId) => get().payables.filter((p) => p.supplierId === supplierId),

  getPayablesByStatus: (status) => get().payables.filter((p) => p.status === status),

  getOverduePayables: () => {
    const today = new Date();
    return get().payables.filter((p) => p.status !== 'paid' && isAfter(today, parseISO(p.dueDate)));
  },

  getDueThisWeek: () => {
    const today = new Date();
    const nextWeek = addDays(today, 7);
    return get().payables.filter(
      (p) => p.status !== 'paid' && !isAfter(today, parseISO(p.dueDate)) && !isAfter(parseISO(p.dueDate), nextWeek)
    );
  },

  getTotalOutstanding: () => get().payables.filter((p) => p.status !== 'paid').reduce((sum, p) => sum + p.balance, 0),

  getTotalOverdue: () => get().getOverduePayables().reduce((sum, p) => sum + p.balance, 0),

  getAgingReport: () => {
    const today = new Date();
    const payables = get().payables.filter((p) => p.status !== 'paid');
    let current = 0, days30 = 0, days60 = 0, days90Plus = 0;
    payables.forEach((p) => {
      const daysPastDue = Math.floor((today.getTime() - parseISO(p.dueDate).getTime()) / (1000 * 60 * 60 * 24));
      if (daysPastDue <= 0) current += p.balance;
      else if (daysPastDue <= 30) days30 += p.balance;
      else if (daysPastDue <= 60) days60 += p.balance;
      else days90Plus += p.balance;
    });
    return { current, days30, days60, days90Plus };
  },

  updateOverdueStatuses: () => {
    const today = new Date();
    set((state) => ({
      payables: state.payables.map((p) => {
        if (p.status !== 'paid' && p.status !== 'overdue' && isAfter(today, parseISO(p.dueDate))) {
          return { ...p, status: 'overdue' as PayableStatus };
        }
        return p;
      }),
    }));
  },
}));
