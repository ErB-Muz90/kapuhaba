import { create } from 'zustand';
import { api } from '../api/client';
import type { StockAdjustment, StockCount } from '../types';
import { useProductStore } from './productStore';

interface StockStore {
  adjustments: StockAdjustment[];
  counts: StockCount[];
  loading: boolean;
  fetchAdjustments: () => Promise<void>;
  fetchCounts: () => Promise<void>;
  createAdjustment: (data: Omit<StockAdjustment, 'id' | 'previousQuantity' | 'newQuantity' | 'createdAt'>) => Promise<void>;
  startStockCount: (data: Omit<StockCount, 'id' | 'createdAt'>) => Promise<void>;
  completeCount: (id: string, items: StockCount['items']) => Promise<void>;
  getStockValueByCategory: () => { category: string; value: number; count: number }[];
  getTotalStockValue: () => number;
}

export const useStockStore = create<StockStore>()((set, get) => ({
  adjustments: [],
  counts: [],
  loading: false,

  fetchAdjustments: async () => {
    set({ loading: true });
    try {
      const adjustments = await api.get<StockAdjustment[]>('/stock/adjustments');
      set({ adjustments, loading: false });
    } catch { set({ loading: false }); }
  },

  fetchCounts: async () => {
    try {
      const counts = await api.get<StockCount[]>('/stock/counts');
      set({ counts });
    } catch {}
  },

  createAdjustment: async (data) => {
    await api.post('/stock/adjustments', data);
    get().fetchAdjustments();
  },

  startStockCount: async (data) => {
    const created = await api.post<StockCount>('/stock/counts', data);
    set((state) => ({ counts: [...state.counts, created] }));
  },

  completeCount: async (id, items) => {
    const productStore = useProductStore.getState();
    for (const item of items) {
      if (item.variance !== 0) {
        productStore.updateStock(item.productId, item.countedQuantity);
      }
    }
    await api.put(`/stock/counts/${id}`, { items, status: 'completed', completedAt: new Date().toISOString() });
    set((state) => ({
      counts: state.counts.map((c) => c.id === id ? { ...c, items, status: 'completed' as const, completedAt: new Date().toISOString() } : c),
    }));
  },

  getStockValueByCategory: () => {
    const productStore = useProductStore.getState();
    const map = new Map<string, { value: number; count: number }>();
    for (const p of productStore.products) {
      const existing = map.get(p.category) || { value: 0, count: 0 };
      existing.value += p.buyingPrice * p.stockQuantity;
      existing.count += p.stockQuantity;
      map.set(p.category, existing);
    }
    return Array.from(map.entries()).map(([category, { value, count }]) => ({ category, value, count }));
  },

  getTotalStockValue: () => {
    const productStore = useProductStore.getState();
    return productStore.products.reduce((sum, p) => sum + p.buyingPrice * p.stockQuantity, 0);
  },
}));
