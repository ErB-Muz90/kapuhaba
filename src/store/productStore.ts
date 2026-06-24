import { create } from 'zustand';
import { api } from '../api/client';
import type { Product } from '../types';

interface ImportResult {
  imported: number;
  skipped: number;
  updated: number;
  errors: { row: number; message: string }[];
}

interface ProductStore {
  products: Product[];
  loading: boolean;
  fetch: () => Promise<void>;
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateProduct: (id: string, product: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  getProduct: (id: string) => Product | undefined;
  searchProducts: (query: string) => Product[];
  getLowStockProducts: () => Product[];
  updateStock: (id: string, quantity: number) => Promise<void>;
  deductStock: (id: string, quantity: number) => boolean;
  generateSKU: (name: string, category: string) => string;
  importProducts: (rows: Array<{
    name: string; sku: string; barcode: string; category: string;
    buyingPrice: number; sellingPrice: number; stockQuantity: number; lowStockThreshold: number;
  }>) => Promise<ImportResult>;
}

function abbreviate(text: string, maxLen = 4): string {
  return text.split(/[\s-]+/).map((w) => w.charAt(0).toUpperCase()).filter((c) => /[A-Z0-9]/.test(c)).join('').slice(0, maxLen);
}

function categoryCode(category: string): string {
  if (!category) return 'GEN';
  const words = category.split(/[\s-]+/);
  if (words.length === 1) return category.slice(0, 3).toUpperCase();
  return words.map((w) => w.charAt(0).toUpperCase()).join('').slice(0, 3);
}

export const useProductStore = create<ProductStore>()((set, get) => ({
  products: [],
  loading: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const products = await api.get<Product[]>('/products');
      set({ products, loading: false });
    } catch { set({ loading: false }); }
  },

  generateSKU: (name, category) => {
    const prefix = categoryCode(category);
    const nameAbbr = abbreviate(name, 4);
    const existing = get().products;
    let maxNum = 0;
    const regex = new RegExp(`^${prefix}-${nameAbbr}-(\\d+)$`);
    for (const p of existing) {
      const m = p.sku.match(regex);
      if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
    }
    return `${prefix}-${nameAbbr}-${(maxNum + 1).toString().padStart(3, '0')}`;
  },

  addProduct: async (product) => {
    const sku = product.sku || get().generateSKU(product.name, product.category);
    const created = await api.post<Product>('/products', { ...product, sku });
    set((state) => ({ products: [...state.products, created] }));
  },

  updateProduct: async (id, updates) => {
    await api.put(`/products/${id}`, updates);
    set((state) => ({
      products: state.products.map((p) =>
        p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
      ),
    }));
  },

  deleteProduct: async (id) => {
    await api.delete(`/products/${id}`);
    set((state) => ({ products: state.products.filter((p) => p.id !== id) }));
  },

  getProduct: (id) => get().products.find((p) => p.id === id),

  searchProducts: (query) => {
    const q = query.toLowerCase();
    return get().products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode.includes(q) || p.category.toLowerCase().includes(q)
    );
  },

  getLowStockProducts: () => get().products.filter((p) => p.stockQuantity <= p.lowStockThreshold),

  updateStock: async (id, quantity) => {
    await api.put(`/products/${id}`, { stockQuantity: quantity });
    set((state) => ({
      products: state.products.map((p) => p.id === id ? { ...p, stockQuantity: quantity, updatedAt: new Date().toISOString() } : p),
    }));
  },

  deductStock: (id, quantity) => {
    const product = get().getProduct(id);
    if (!product || product.stockQuantity < quantity) return false;
    const newQty = product.stockQuantity - quantity;
    api.put(`/products/${id}`, { stockQuantity: newQty }).catch(() => {});
    set((state) => ({
      products: state.products.map((p) => p.id === id ? { ...p, stockQuantity: newQty, updatedAt: new Date().toISOString() } : p),
    }));
    return true;
  },

  importProducts: async (rows) => {
    const existing = get().products;
    let imported = 0, skipped = 0, updated = 0;
    const errors: ImportResult['errors'] = [];
    const newProducts: Product[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const now = new Date().toISOString();
      const existingProduct = existing.find((p) => p.sku.toLowerCase() === row.sku.toLowerCase());

      if (existingProduct) {
        await api.put(`/products/${existingProduct.id}`, row);
        updated++;
        set((state) => ({
          products: state.products.map((p) =>
            p.id === existingProduct.id ? { ...p, ...row, updatedAt: now } : p
          ),
        }));
        continue;
      }

      const dup = newProducts.find((p) => p.sku.toLowerCase() === row.sku.toLowerCase());
      if (dup) {
        errors.push({ row: i + 1, message: `Row ${i + 1}: Duplicate SKU "${row.sku}" in import batch` });
        skipped++;
        continue;
      }

      if (!row.name || !row.sku) {
        errors.push({ row: i + 1, message: `Row ${i + 1}: Name and SKU are required` });
        skipped++;
        continue;
      }

      const created = await api.post<Product>('/products', { ...row, createdAt: now, updatedAt: now });
      newProducts.push(created);
      imported++;
    }

    if (newProducts.length > 0) {
      set((state) => ({ products: [...state.products, ...newProducts] }));
    }

    return { imported, skipped, updated, errors };
  },
}));
