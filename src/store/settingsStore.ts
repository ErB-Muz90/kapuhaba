import { create } from 'zustand';
import { api } from '../api/client';
import type { BusinessSettings } from '../types';

interface SettingsStore {
  settings: BusinessSettings;
  loading: boolean;
  fetch: () => Promise<void>;
  updateSettings: (settings: Partial<BusinessSettings>) => Promise<void>;
}

const DEFAULT_SETTINGS: BusinessSettings = {
  name: '',
  address: '',
  phone: '',
  email: '',
  taxRate: 0,
  currency: 'KES',
  currencySymbol: 'KSh',
  loyaltyPointsPerCurrency: 100,
  loyaltyRedemptionRate: 1,
  defaultFloat: 0,
};

export const useSettingsStore = create<SettingsStore>()((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loading: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const settings = await api.get<BusinessSettings>('/settings');
      set({ settings, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  updateSettings: async (updates) => {
    const res = await api.put<BusinessSettings>('/settings', updates);
    set({ settings: res });
  },
}));
