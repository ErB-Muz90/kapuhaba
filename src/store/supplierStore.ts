import { create } from 'zustand';
import { api } from '../api/client';
import type { Supplier } from '../types';

interface SupplierStore {
  suppliers: Supplier[];
  loading: boolean;
  fetch: () => Promise<void>;
  addSupplier: (supplier: Omit<Supplier, 'id' | 'totalOrders' | 'totalSpent' | 'createdAt' | 'updatedAt'>) => Promise<Supplier>;
  updateSupplier: (id: string, updates: Partial<Supplier>) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;
  getSupplier: (id: string) => Supplier | undefined;
  getActiveSuppliers: () => Supplier[];
  searchSuppliers: (query: string) => Supplier[];
  updateSupplierStats: (id: string, orderAmount: number) => Promise<void>;
}

export const useSupplierStore = create<SupplierStore>()((set, get) => ({
  suppliers: [],
  loading: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const suppliers = await api.get<Supplier[]>('/suppliers');
      set({ suppliers, loading: false });
    } catch { set({ loading: false }); }
  },

  addSupplier: async (supplierData) => {
    const created = await api.post<Supplier>('/suppliers', { ...supplierData, totalOrders: 0, totalSpent: 0 });
    set((state) => ({ suppliers: [...state.suppliers, created] }));
    return created;
  },

  updateSupplier: async (id, updates) => {
    await api.put(`/suppliers/${id}`, updates);
    set((state) => ({
      suppliers: state.suppliers.map((s) => s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s),
    }));
  },

  deleteSupplier: async (id) => {
    await api.delete(`/suppliers/${id}`);
    set((state) => ({ suppliers: state.suppliers.filter((s) => s.id !== id) }));
  },

  getSupplier: (id) => get().suppliers.find((s) => s.id === id),

  getActiveSuppliers: () => get().suppliers.filter((s) => s.status === 'active'),

  searchSuppliers: (query) => {
    const q = query.toLowerCase();
    return get().suppliers.filter(
      (s) => s.name.toLowerCase().includes(q) || s.contactPerson.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
    );
  },

  updateSupplierStats: async (id, orderAmount) => {
    await api.put(`/suppliers/${id}`, { totalOrders: { increment: 1 }, totalSpent: { increment: orderAmount } });
    set((state) => ({
      suppliers: state.suppliers.map((s) =>
        s.id === id ? { ...s, totalOrders: s.totalOrders + 1, totalSpent: s.totalSpent + orderAmount, updatedAt: new Date().toISOString() } : s
      ),
    }));
  },
}));
