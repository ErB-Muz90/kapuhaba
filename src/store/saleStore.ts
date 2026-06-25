import { create } from 'zustand';
import { api } from '../api/client';
import type { Sale, CartItem, PaymentMethod, SaleItem, TopProduct, DailySummary } from '../types';
import { useProductStore } from './productStore';
import { useShiftStore } from './shiftStore';
import { useSettingsStore } from './settingsStore';
import { format, startOfDay, endOfDay, isWithinInterval, subDays } from 'date-fns';

interface SaleStore {
  sales: Sale[];
  cart: CartItem[];
  selectedCustomerId: string | null;
  loading: boolean;
  fetch: () => Promise<void>;
  addToCart: (item: CartItem) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getCartTotal: () => { subtotal: number; tax: number; total: number };
  setSelectedCustomer: (customerId: string | null) => void;
  completeSale: (paymentMethod: PaymentMethod, cashierId: string, cashierName: string, customerName?: string) => Promise<Sale | null>;
  getSale: (id: string) => Sale | undefined;
  getDailySales: (date: Date) => Sale[];
  getDailySummary: (date: Date) => DailySummary;
  getTopProducts: (days: number, limit: number) => TopProduct[];
  getRecentSales: (limit: number) => Sale[];
  getSalesInRange: (startDate: Date, endDate: Date) => Sale[];
}

function getTaxRate(): number {
  return useSettingsStore.getState().settings.taxRate || 0.16;
}

export const useSaleStore = create<SaleStore>()((set, get) => ({
  sales: [],
  cart: [],
  selectedCustomerId: null,
  loading: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const sales = await api.get<Sale[]>('/sales');
      set({ sales: sales.map(s => ({ ...s, items: s.items ?? [] })), loading: false });
    } catch { set({ loading: false }); }
  },

  addToCart: (item) => {
    set((state) => {
      const idx = state.cart.findIndex((i) => i.product.id === item.product.id);
      if (idx >= 0) {
        const updated = [...state.cart];
        updated[idx].quantity += item.quantity;
        return { cart: updated };
      }
      return { cart: [...state.cart, item] };
    });
  },

  removeFromCart: (productId) => {
    set((state) => ({ cart: state.cart.filter((i) => i.product.id !== productId) }));
  },

  updateCartQuantity: (productId, quantity) => {
    if (quantity <= 0) { get().removeFromCart(productId); return; }
    set((state) => ({
      cart: state.cart.map((i) => i.product.id === productId ? { ...i, quantity } : i),
    }));
  },

  clearCart: () => set({ cart: [], selectedCustomerId: null }),

  getCartTotal: () => {
    const { cart } = get();
    const total = cart.reduce((sum, item) => sum + item.product.sellingPrice * item.quantity, 0);
    const rate = getTaxRate();
    const subtotal = total / (1 + rate);
    const tax = total - subtotal;
    return { subtotal, tax, total };
  },

  setSelectedCustomer: (customerId) => set({ selectedCustomerId: customerId }),

  completeSale: async (paymentMethod, cashierId, cashierName, customerName) => {
    const { cart, selectedCustomerId, getCartTotal, clearCart } = get();
    const productStore = useProductStore.getState();
    if (cart.length === 0) return null;

    for (const item of cart) {
      const product = productStore.getProduct(item.product.id);
      if (!product || product.stockQuantity < item.quantity) return null;
    }

    for (const item of cart) {
      productStore.deductStock(item.product.id, item.quantity);
    }

    const { subtotal, tax, total } = getCartTotal();
    const saleItems: SaleItem[] = cart.map((item) => ({
      productId: item.product.id,
      productName: item.product.name,
      quantity: item.quantity,
      unitPrice: item.product.sellingPrice,
      total: item.product.sellingPrice * item.quantity,
    }));

    try {
      const sale = await api.post<Sale>('/sales', {
        items: saleItems,
        subtotal, tax, total,
        paymentMethod,
        customerId: selectedCustomerId || undefined,
        customerName: customerName || undefined,
        cashierId, cashierName,
        createdAt: new Date().toISOString(),
      });

      set((state) => ({ sales: [...state.sales, { ...sale, items: sale.items ?? [] }] }));
      clearCart();

      const activeShift = useShiftStore.getState().getActiveShift();
      if (activeShift) {
        useShiftStore.getState().linkSaleToCashDrawer(activeShift.id, sale.id, total, paymentMethod);
      }

      return sale;
    } catch {
      return null;
    }
  },

  getSale: (id) => get().sales.find((s) => s.id === id),

  getDailySales: (date) => {
    const start = startOfDay(date);
    const end = endOfDay(date);
    return get().sales.filter((sale) => isWithinInterval(new Date(sale.createdAt), { start, end }));
  },

  getDailySummary: (date) => {
    const dailySales = get().getDailySales(date);
    const totalRevenue = dailySales.reduce((sum, sale) => sum + sale.total, 0);
    const totalProfit = dailySales.reduce((sum, sale) => {
      let profit = 0;
      for (const item of sale.items) {
        const product = useProductStore.getState().getProduct(item.productId);
        if (product) profit += (item.unitPrice - product.buyingPrice) * item.quantity;
      }
      return sum + profit;
    }, 0);
    const paymentBreakdown = {
      cash: dailySales.filter((s) => s.paymentMethod === 'cash').reduce((sum, s) => sum + s.total, 0),
      mpesa: dailySales.filter((s) => s.paymentMethod === 'mpesa').reduce((sum, s) => sum + s.total, 0),
      card: dailySales.filter((s) => s.paymentMethod === 'card').reduce((sum, s) => sum + s.total, 0),
    };
    return { date: format(date, 'yyyy-MM-dd'), totalSales: dailySales.length, totalRevenue, totalProfit, paymentBreakdown };
  },

  getTopProducts: (days, limit) => {
    const startDate = subDays(new Date(), days);
    const sales = get().sales.filter((s) => new Date(s.createdAt) >= startDate);
    const stats: Record<string, { name: string; quantity: number; revenue: number }> = {};
    for (const sale of sales) {
      for (const item of sale.items) {
        if (!stats[item.productId]) stats[item.productId] = { name: item.productName, quantity: 0, revenue: 0 };
        stats[item.productId].quantity += item.quantity;
        stats[item.productId].revenue += item.total;
      }
    }
    return Object.entries(stats).map(([productId, s]) => ({ productId, ...s }))
      .sort((a, b) => b.revenue - a.revenue).slice(0, limit);
  },

  getRecentSales: (limit) =>
    [...get().sales].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, limit),

  getSalesInRange: (startDate, endDate) => {
    const start = startOfDay(startDate);
    const end = endOfDay(endDate);
    return get().sales.filter((sale) => isWithinInterval(new Date(sale.createdAt), { start, end }));
  },
}));
