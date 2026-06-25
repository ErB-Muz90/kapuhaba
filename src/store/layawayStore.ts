import { create } from 'zustand';
import { api } from '../api/client';
import type { Layaway, LayawayStatus, LayawayPayment } from '../types';

interface LayawayStore {
  layaways: Layaway[];
  loading: boolean;
  fetch: () => Promise<void>;
  createLayaway: (data: {
    customerId?: string; customerName?: string;
    items: { productId: string; productName: string; quantity: number; unitPrice: number; total: number }[];
    totalAmount: number; depositAmount: number; balanceDue: number;
    dueDate?: string; cashierId: string; cashierName: string; notes?: string;
  }) => Promise<Layaway>;
  addPayment: (id: string, payment: LayawayPayment, newPaidAmount: number, newBalanceDue: number, newStatus: LayawayStatus) => Promise<void>;
  updateStatus: (id: string, status: LayawayStatus) => Promise<void>;
  deleteLayaway: (id: string) => Promise<void>;
  getLayaway: (id: string) => Layaway | undefined;
}

export const useLayawayStore = create<LayawayStore>()((set, get) => ({
  layaways: [],
  loading: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const data = await api.get<Layaway[]>('/layaways');
      set({ layaways: data, loading: false });
    } catch { set({ loading: false }); }
  },

  createLayaway: async (data) => {
    const created = await api.post<Layaway>('/layaways', {
      ...data,
      payments: [],
      paidAmount: data.depositAmount,
      status: 'active',
    });
    set((state) => ({ layaways: [created, ...state.layaways] }));
    return created;
  },

  addPayment: async (id, payment, newPaidAmount, newBalanceDue, newStatus) => {
    const layaway = get().layaways.find((l) => l.id === id);
    if (!layaway) return;

    const updatedPayments = [...(layaway.payments || []), payment];

    await api.put(`/layaways/${id}`, {
      payments: updatedPayments,
      paidAmount: newPaidAmount,
      balanceDue: newBalanceDue,
      status: newStatus,
    });

    set((state) => ({
      layaways: state.layaways.map((l) =>
        l.id === id ? { ...l, payments: updatedPayments, paidAmount: newPaidAmount, balanceDue: newBalanceDue, status: newStatus, updatedAt: new Date().toISOString() } : l
      ),
    }));
  },

  updateStatus: async (id, status) => {
    await api.put(`/layaways/${id}`, { status });
    set((state) => ({
      layaways: state.layaways.map((l) => l.id === id ? { ...l, status, updatedAt: new Date().toISOString() } : l),
    }));
  },

  deleteLayaway: async (id) => {
    await api.delete(`/layaways/${id}`);
    set((state) => ({ layaways: state.layaways.filter((l) => l.id !== id) }));
  },

  getLayaway: (id) => get().layaways.find((l) => l.id === id),
}));
