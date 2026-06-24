import { create } from 'zustand';
import { api } from '../api/client';
import type { LoyaltyAccount, LoyaltyTransaction, LoyaltyTier } from '../types';
import { useSettingsStore } from './settingsStore';

const LOYALTY_TIERS: LoyaltyTier[] = [
  { name: 'bronze', minPoints: 0, multiplier: 1, benefits: ['Earn 1 point per 100 KSh spent', 'Birthday bonus points'] },
  { name: 'silver', minPoints: 1000, multiplier: 1.25, benefits: ['Earn 1.25x points', 'Early access to sales', 'Free gift wrapping'] },
  { name: 'gold', minPoints: 5000, multiplier: 1.5, benefits: ['Earn 1.5x points', 'Priority support', 'Exclusive discounts', 'Free delivery'] },
  { name: 'platinum', minPoints: 15000, multiplier: 2, benefits: ['Earn 2x points', 'VIP support', 'Exclusive events', 'Personal shopper'] },
];

interface LoyaltyStore {
  accounts: LoyaltyAccount[];
  transactions: LoyaltyTransaction[];
  tiers: LoyaltyTier[];
  loading: boolean;
  fetch: () => Promise<void>;
  fetchTransactions: () => Promise<void>;
  createAccount: (customerId: string, customerName: string, phone: string) => Promise<LoyaltyAccount>;
  getAccount: (customerId: string) => LoyaltyAccount | undefined;
  getAccountByPhone: (phone: string) => LoyaltyAccount | undefined;
  earnPoints: (customerId: string, saleAmount: number, saleId: string) => Promise<number>;
  redeemPoints: (customerId: string, points: number, saleId: string) => Promise<boolean>;
  adjustPoints: (customerId: string, points: number, description: string) => Promise<void>;
  getTransactions: (customerId: string) => LoyaltyTransaction[];
  getRecentTransactions: (limit: number) => LoyaltyTransaction[];
  calculateTier: (totalPointsEarned: number) => LoyaltyTier['name'];
  getTierInfo: (tierName: LoyaltyTier['name']) => LoyaltyTier | undefined;
  getTotalActiveMembers: () => number;
  getTotalPointsOutstanding: () => number;
  getMembersByTier: () => Record<LoyaltyTier['name'], number>;
}

export const useLoyaltyStore = create<LoyaltyStore>()((set, get) => ({
  accounts: [],
  transactions: [],
  tiers: LOYALTY_TIERS,
  loading: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const accounts = await api.get<LoyaltyAccount[]>('/loyalty');
      set({ accounts, loading: false });
    } catch { set({ loading: false }); }
  },

  fetchTransactions: async () => {
    try {
      const transactions = await api.get<LoyaltyTransaction[]>('/loyalty/transactions');
      set({ transactions });
    } catch {}
  },

  createAccount: async (customerId, customerName, phone) => {
    const existing = get().getAccount(customerId);
    if (existing) return existing;
    const account = await api.post<LoyaltyAccount>('/loyalty', {
      customerId, customerName, phone, pointsBalance: 0, totalPointsEarned: 0, totalPointsRedeemed: 0, tier: 'bronze',
      joinDate: new Date().toISOString(), lastActivity: new Date().toISOString(),
    });
    set((state) => ({ accounts: [...state.accounts, account] }));
    return account;
  },

  getAccount: (customerId) => get().accounts.find((a) => a.customerId === customerId),

  getAccountByPhone: (phone) => get().accounts.find((a) => a.phone === phone),

  earnPoints: async (customerId, saleAmount, saleId) => {
    const account = get().getAccount(customerId);
    if (!account) return 0;
    const settings = useSettingsStore.getState().settings;
    const tier = get().getTierInfo(account.tier);
    const basePoints = Math.floor(saleAmount / settings.loyaltyPointsPerCurrency);
    const earnedPoints = Math.floor(basePoints * (tier?.multiplier || 1));
    const newTotalEarned = account.totalPointsEarned + earnedPoints;
    const newTier = get().calculateTier(newTotalEarned);

    const tx = await api.post<LoyaltyTransaction>('/loyalty/transactions', {
      customerId, type: 'earned', points: earnedPoints, saleId, description: `Earned ${earnedPoints} points from purchase`,
      createdAt: new Date().toISOString(),
    });

    await api.put(`/loyalty/${customerId}`, {
      pointsBalance: account.pointsBalance + earnedPoints,
      totalPointsEarned: newTotalEarned, tier: newTier, lastActivity: new Date().toISOString(),
    });

    set((state) => ({
      accounts: state.accounts.map((a) => a.customerId === customerId ? {
        ...a, pointsBalance: a.pointsBalance + earnedPoints, totalPointsEarned: newTotalEarned, tier: newTier, lastActivity: new Date().toISOString(),
      } : a),
      transactions: [tx, ...state.transactions],
    }));

    return earnedPoints;
  },

  redeemPoints: async (customerId, points, saleId) => {
    const account = get().getAccount(customerId);
    if (!account || account.pointsBalance < points) return false;

    await api.post<LoyaltyTransaction>('/loyalty/transactions', {
      customerId, type: 'redeemed', points: -points, saleId, description: `Redeemed ${points} points for discount`,
      createdAt: new Date().toISOString(),
    });

    await api.put(`/loyalty/${customerId}`, {
      pointsBalance: account.pointsBalance - points,
      totalPointsRedeemed: account.totalPointsRedeemed + points, lastActivity: new Date().toISOString(),
    });

    set((state) => ({
      accounts: state.accounts.map((a) => a.customerId === customerId ? {
        ...a, pointsBalance: a.pointsBalance - points, totalPointsRedeemed: a.totalPointsRedeemed + points, lastActivity: new Date().toISOString(),
      } : a),
    }));

    get().fetchTransactions();
    return true;
  },

  adjustPoints: async (customerId, points, description) => {
    const account = get().getAccount(customerId);
    if (!account) return;
    const newBalance = account.pointsBalance + points;
    if (newBalance < 0) return;

    await api.post<LoyaltyTransaction>('/loyalty/transactions', {
      customerId, type: 'adjustment', points, description, createdAt: new Date().toISOString(),
    });

    await api.put(`/loyalty/${customerId}`, {
      pointsBalance: newBalance,
      totalPointsEarned: points > 0 ? account.totalPointsEarned + points : account.totalPointsEarned,
      lastActivity: new Date().toISOString(),
    });

    set((state) => ({
      accounts: state.accounts.map((a) => a.customerId === customerId ? {
        ...a, pointsBalance: newBalance, totalPointsEarned: points > 0 ? a.totalPointsEarned + points : a.totalPointsEarned, lastActivity: new Date().toISOString(),
      } : a),
    }));

    get().fetchTransactions();
  },

  getTransactions: (customerId) => get().transactions.filter((t) => t.customerId === customerId),

  getRecentTransactions: (limit) => get().transactions.slice(0, limit),

  calculateTier: (totalPointsEarned) => {
    let currentTier: LoyaltyTier['name'] = 'bronze';
    for (const tier of get().tiers) {
      if (totalPointsEarned >= tier.minPoints) currentTier = tier.name;
    }
    return currentTier;
  },

  getTierInfo: (tierName) => get().tiers.find((t) => t.name === tierName),

  getTotalActiveMembers: () => get().accounts.length,

  getTotalPointsOutstanding: () => get().accounts.reduce((sum, a) => sum + a.pointsBalance, 0),

  getMembersByTier: () => {
    const result: Record<LoyaltyTier['name'], number> = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
    get().accounts.forEach((a) => { result[a.tier]++; });
    return result;
  },
}));
