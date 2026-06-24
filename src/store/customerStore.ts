import { create } from 'zustand';
import { api } from '../api/client';
import type { Customer } from '../types';

interface CustomerStore {
  customers: Customer[];
  loading: boolean;
  fetch: () => Promise<void>;
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Customer>;
  updateCustomer: (id: string, customer: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  getCustomer: (id: string) => Customer | undefined;
  searchCustomers: (query: string) => Customer[];
}

export const useCustomerStore = create<CustomerStore>()((set, get) => ({
  customers: [],
  loading: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const customers = await api.get<Customer[]>('/customers');
      set({ customers, loading: false });
    } catch { set({ loading: false }); }
  },

  addCustomer: async (customer) => {
    const created = await api.post<Customer>('/customers', customer);
    set((state) => ({ customers: [...state.customers, created] }));
    return created;
  },

  updateCustomer: async (id, updates) => {
    await api.put(`/customers/${id}`, updates);
    set((state) => ({
      customers: state.customers.map((c) => c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c),
    }));
  },

  deleteCustomer: async (id) => {
    await api.delete(`/customers/${id}`);
    set((state) => ({ customers: state.customers.filter((c) => c.id !== id) }));
  },

  getCustomer: (id) => get().customers.find((c) => c.id === id),

  searchCustomers: (query) => {
    const q = query.toLowerCase();
    return get().customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.includes(query) || (c.email && c.email.toLowerCase().includes(q))
    );
  },
}));
