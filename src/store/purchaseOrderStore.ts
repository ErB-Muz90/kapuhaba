import { create } from 'zustand';
import { api } from '../api/client';
import type { PurchaseOrder, POItem, POStatus } from '../types';
import { useProductStore } from './productStore';
import { useSupplierStore } from './supplierStore';

interface POStore {
  purchaseOrders: PurchaseOrder[];
  loading: boolean;
  fetch: () => Promise<void>;
  createPO: (po: Omit<PurchaseOrder, 'id' | 'poNumber' | 'createdAt' | 'updatedAt'>) => Promise<PurchaseOrder>;
  updatePO: (id: string, updates: Partial<PurchaseOrder>) => Promise<void>;
  deletePO: (id: string) => Promise<void>;
  getPO: (id: string) => PurchaseOrder | undefined;
  updatePOStatus: (id: string, status: POStatus) => Promise<void>;
  receivePO: (id: string, receivedItems: { productId: string; quantity: number }[]) => Promise<void>;
  getPOsBySupplier: (supplierId: string) => PurchaseOrder[];
  getPOsByStatus: (status: POStatus) => PurchaseOrder[];
  getPendingPOs: () => PurchaseOrder[];
}

export const usePurchaseOrderStore = create<POStore>()((set, get) => ({
  purchaseOrders: [],
  loading: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const data = await api.get<PurchaseOrder[]>('/purchase-orders');
      set({ purchaseOrders: data, loading: false });
    } catch { set({ loading: false }); }
  },

  createPO: async (poData) => {
    const poNumber = 'PO' + new Date().getFullYear().toString().slice(-2) +
      (new Date().getMonth() + 1).toString().padStart(2, '0') + '-' +
      (get().purchaseOrders.length + 1).toString().padStart(4, '0');
    const created = await api.post<PurchaseOrder>('/purchase-orders', { ...poData, poNumber });
    set((state) => ({ purchaseOrders: [...state.purchaseOrders, created] }));
    return created;
  },

  updatePO: async (id, updates) => {
    await api.put(`/purchase-orders/${id}`, updates);
    set((state) => ({
      purchaseOrders: state.purchaseOrders.map((po) =>
        po.id === id ? { ...po, ...updates, updatedAt: new Date().toISOString() } : po
      ),
    }));
  },

  deletePO: async (id) => {
    await api.delete(`/purchase-orders/${id}`);
    set((state) => ({ purchaseOrders: state.purchaseOrders.filter((po) => po.id !== id) }));
  },

  getPO: (id) => get().purchaseOrders.find((po) => po.id === id),

  updatePOStatus: async (id, status) => {
    await api.put(`/purchase-orders/${id}`, { status });
    set((state) => ({
      purchaseOrders: state.purchaseOrders.map((po) => po.id === id ? { ...po, status, updatedAt: new Date().toISOString() } : po),
    }));
  },

  receivePO: async (id, receivedItems) => {
    const po = get().getPO(id);
    if (!po) return;
    const productStore = useProductStore.getState();
    const supplierStore = useSupplierStore.getState();
    const updatedItems: POItem[] = po.items.map((item) => {
      const received = receivedItems.find((r) => r.productId === item.productId);
      const newReceivedQty = item.receivedQuantity + (received?.quantity || 0);
      if (received && received.quantity > 0) {
        const product = productStore.getProduct(item.productId);
        if (product) productStore.updateStock(item.productId, product.stockQuantity + received.quantity);
      }
      return { ...item, receivedQuantity: newReceivedQty };
    });
    const isFullyReceived = updatedItems.every((item) => item.receivedQuantity >= item.quantity);
    const isPartiallyReceived = updatedItems.some((item) => item.receivedQuantity > 0 && item.receivedQuantity < item.quantity);
    const newStatus: POStatus = isFullyReceived ? 'received' : isPartiallyReceived ? 'partial' : po.status;
    if (isFullyReceived) {
      supplierStore.updateSupplierStats(po.supplierId, po.total);
      // Auto-create Account Payable
      try {
        await api.post('/accounts-payable', {
          supplierId: po.supplierId,
          supplierName: po.supplierName,
          poId: po.id,
          poNumber: po.poNumber,
          invoiceNumber: 'INV-' + po.poNumber,
          invoiceDate: new Date().toISOString().split('T')[0],
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          amount: po.total,
          notes: `Auto-created from PO ${po.poNumber}`,
        });
      } catch {}
    }
    await api.put(`/purchase-orders/${id}`, {
      items: updatedItems,
      status: newStatus,
      receivedDate: isFullyReceived ? new Date().toISOString() : po.receivedDate,
    });
    set((state) => ({
      purchaseOrders: state.purchaseOrders.map((p) =>
        p.id === id ? { ...p, items: updatedItems, status: newStatus, receivedDate: isFullyReceived ? new Date().toISOString() : p.receivedDate, updatedAt: new Date().toISOString() } : p
      ),
    }));
  },

  getPOsBySupplier: (supplierId) => get().purchaseOrders.filter((po) => po.supplierId === supplierId),

  getPOsByStatus: (status) => get().purchaseOrders.filter((po) => po.status === status),

  getPendingPOs: () => get().purchaseOrders.filter((po) => ['pending', 'approved', 'ordered', 'partial'].includes(po.status)),
}));
