import { create } from 'zustand';
import { api } from '../api/client';
import type { Return, ReturnStatus, RefundMethod, ReturnItem } from '../types';
import { useProductStore } from './productStore';
import { useShiftStore } from './shiftStore';

interface ReturnStore {
  returns: Return[];
  loading: boolean;
  fetch: () => Promise<void>;
  createReturn: (data: {
    saleId?: string; saleNumber?: string; customerId?: string; customerName?: string;
    items: Omit<ReturnItem, 'condition'>[]; subtotal: number; tax: number; total: number;
    refundMethod?: RefundMethod; cashierId: string; cashierName: string; notes?: string;
  }) => Promise<Return>;
  approveReturn: (id: string) => Promise<void>;
  completeReturn: (id: string, refundMethod: RefundMethod) => Promise<void>;
  rejectReturn: (id: string, reason?: string) => Promise<void>;
  deleteReturn: (id: string) => Promise<void>;
  getReturn: (id: string) => Return | undefined;
}

export const useReturnStore = create<ReturnStore>()((set, get) => ({
  returns: [],
  loading: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const data = await api.get<Return[]>('/returns');
      set({ returns: data, loading: false });
    } catch { set({ loading: false }); }
  },

  createReturn: async (data) => {
    const created = await api.post<Return>('/returns', { ...data, status: 'pending' });
    set((state) => ({ returns: [created, ...state.returns] }));
    return created;
  },

  approveReturn: async (id) => {
    await api.put(`/returns/${id}`, { status: 'approved' });
    set((state) => ({
      returns: state.returns.map((r) => r.id === id ? { ...r, status: 'approved' as ReturnStatus, updatedAt: new Date().toISOString() } : r),
    }));
  },

  completeReturn: async (id, refundMethod) => {
    const ret = get().returns.find((r) => r.id === id);
    if (!ret) return;

    // Restock products
    const productStore = useProductStore.getState();
    for (const item of ret.items) {
      const product = productStore.getProduct(item.productId);
      if (product) {
        productStore.updateStock(item.productId, product.stockQuantity + item.quantity);
      }
    }

    // Create PAYOUT cash movement if refunding with cash
    if (refundMethod === 'cash') {
      const shiftStore = useShiftStore.getState();
      const shift = shiftStore.getActiveShift();
      if (shift) {
        shiftStore.addCashMovement(shift.id, 'PAYOUT', 'OUT', ret.total, `Return: ${ret.saleNumber || ret.id.slice(0, 8)}`, id, 'other');
      }
    }

    await api.put(`/returns/${id}`, { status: 'completed', refundMethod });
    set((state) => ({
      returns: state.returns.map((r) => r.id === id ? { ...r, status: 'completed' as ReturnStatus, refundMethod, updatedAt: new Date().toISOString() } : r),
    }));
  },

  rejectReturn: async (id, reason) => {
    await api.put(`/returns/${id}`, { status: 'rejected', notes: reason });
    set((state) => ({
      returns: state.returns.map((r) => r.id === id ? { ...r, status: 'rejected' as ReturnStatus, notes: reason, updatedAt: new Date().toISOString() } : r),
    }));
  },

  deleteReturn: async (id) => {
    await api.delete(`/returns/${id}`);
    set((state) => ({ returns: state.returns.filter((r) => r.id !== id) }));
  },

  getReturn: (id) => get().returns.find((r) => r.id === id),
}));
