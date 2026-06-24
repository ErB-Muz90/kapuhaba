import { create } from 'zustand';
import { api } from '../api/client';
import type { Expense, ExpenseCategory, ExpenseStatus } from '../types';

interface ExpenseStore {
  expenses: Expense[];
  loading: boolean;
  fetch: () => Promise<void>;
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Expense>;
  updateExpense: (id: string, updates: Partial<Expense>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  getExpense: (id: string) => Expense | undefined;
  approveExpense: (id: string, approvedBy: string) => Promise<void>;
  payExpense: (id: string, paymentMethod: Expense['paymentMethod'], paidBy: string, reference?: string) => Promise<void>;
  cancelExpense: (id: string) => Promise<void>;
  getExpensesByCategory: (category: ExpenseCategory) => Expense[];
  getExpensesByStatus: (status: ExpenseStatus) => Expense[];
  getPendingExpenses: () => Expense[];
  getExpensesByDateRange: (startDate: string, endDate: string) => Expense[];
  getTotalExpenses: (startDate?: string, endDate?: string) => number;
  getExpensesByCategorySummary: (startDate?: string, endDate?: string) => { category: string; total: number; count: number }[];
  getMonthlyExpenses: (month: number, year: number) => Expense[];
}

export const useExpenseStore = create<ExpenseStore>()((set, get) => ({
  expenses: [],
  loading: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const expenses = await api.get<Expense[]>('/expenses');
      set({ expenses, loading: false });
    } catch { set({ loading: false }); }
  },

  addExpense: async (expenseData) => {
    const created = await api.post<Expense>('/expenses', expenseData);
    set((state) => ({ expenses: [created, ...state.expenses] }));
    return created;
  },

  updateExpense: async (id, updates) => {
    await api.put(`/expenses/${id}`, updates);
    set((state) => ({
      expenses: state.expenses.map((e) => e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e),
    }));
  },

  deleteExpense: async (id) => {
    await api.delete(`/expenses/${id}`);
    set((state) => ({ expenses: state.expenses.filter((e) => e.id !== id) }));
  },

  getExpense: (id) => get().expenses.find((e) => e.id === id),

  approveExpense: async (id, approvedBy) => {
    await api.put(`/expenses/${id}`, { status: 'approved', approvedBy });
    set((state) => ({
      expenses: state.expenses.map((e) => e.id === id ? { ...e, status: 'approved' as ExpenseStatus, approvedBy, updatedAt: new Date().toISOString() } : e),
    }));
  },

  payExpense: async (id, paymentMethod, paidBy, reference) => {
    await api.put(`/expenses/${id}`, { status: 'paid', paymentMethod, paidBy, reference, paidAt: new Date().toISOString() });
    set((state) => ({
      expenses: state.expenses.map((e) =>
        e.id === id ? { ...e, status: 'paid' as ExpenseStatus, paymentMethod, paidBy, reference, paidAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : e
      ),
    }));
  },

  cancelExpense: async (id) => {
    await api.put(`/expenses/${id}`, { status: 'cancelled' });
    set((state) => ({
      expenses: state.expenses.map((e) => e.id === id ? { ...e, status: 'cancelled' as ExpenseStatus, updatedAt: new Date().toISOString() } : e),
    }));
  },

  getExpensesByCategory: (category) => get().expenses.filter((e) => e.category === category),

  getExpensesByStatus: (status) => get().expenses.filter((e) => e.status === status),

  getPendingExpenses: () => get().expenses.filter((e) => e.status === 'pending'),

  getExpensesByDateRange: (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return get().expenses.filter((e) => { const d = new Date(e.date); return d >= start && d <= end; });
  },

  getTotalExpenses: (startDate, endDate) => {
    let exps = get().expenses.filter((e) => e.status !== 'cancelled');
    if (startDate && endDate) exps = get().getExpensesByDateRange(startDate, endDate);
    return exps.reduce((sum, e) => sum + e.amount, 0);
  },

  getExpensesByCategorySummary: (startDate, endDate) => {
    let exps = get().expenses.filter((e) => e.status !== 'cancelled');
    if (startDate && endDate) exps = get().getExpensesByDateRange(startDate, endDate);
    const summary: Record<string, { total: number; count: number }> = {};
    exps.forEach((e) => {
      if (!summary[e.category]) summary[e.category] = { total: 0, count: 0 };
      summary[e.category].total += e.amount;
      summary[e.category].count += 1;
    });
    return Object.entries(summary).map(([category, d]) => ({ category, ...d }));
  },

  getMonthlyExpenses: (month, year) =>
    get().expenses.filter((e) => { const d = new Date(e.date); return d.getMonth() === month - 1 && d.getFullYear() === year; }),
}));
