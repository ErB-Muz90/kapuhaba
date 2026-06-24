import { create } from 'zustand';
import { api } from '../api/client';
import type { User, UserRole } from '../types';

const TOKEN_KEY = 'pos-auth-token';

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  initialized: boolean;
  init: () => Promise<void>;
  login: (usernameOrEmployeeId: string, password: string) => Promise<boolean>;
  signup: (data: { username: string; email: string; password: string; role?: string }) => Promise<boolean>;
  logout: () => void;
  canSignup: () => Promise<boolean>;
  createStaffAuth: (staffId: string, employeeId: string, password: string, role?: UserRole) => Promise<boolean>;
  setStaffPassword: (employeeId: string, newPassword: string) => Promise<boolean>;
  deleteAuthAccount: (employeeId: string) => Promise<void>;
  getStoredUsers: () => Promise<(User)[]>;
}

export const useAuthStore = create<AuthStore>()((set) => ({
  user: null,
  isAuthenticated: false,
  loading: false,
  initialized: false,

  init: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      set({ initialized: true });
      return;
    }
    try {
      const user = await api.get<User>('/auth/me');
      set({ user, isAuthenticated: true, initialized: true });
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      set({ initialized: true });
    }
  },

  canSignup: async () => {
    try {
      const res = await fetch('/api/auth/signup-check');
      const data = await res.json();
      return data.canSignup;
    } catch {
      return false;
    }
  },

  login: async (usernameOrEmployeeId: string, password: string) => {
    try {
      const res = await api.post<{ token: string; user: User }>('/auth/login', {
        username: usernameOrEmployeeId,
        password,
      });
      localStorage.setItem(TOKEN_KEY, res.token);
      set({ user: res.user, isAuthenticated: true });
      return true;
    } catch {
      return false;
    }
  },

  signup: async (data) => {
    try {
      const res = await api.post<{ token: string; user: User }>('/auth/signup', data);
      localStorage.setItem(TOKEN_KEY, res.token);
      set({ user: res.user, isAuthenticated: true });
      return true;
    } catch {
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    set({ user: null, isAuthenticated: false });
  },

  createStaffAuth: async (staffId, employeeId, password, role) => {
    try {
      await api.post('/auth/staff-auth', { staffId, employeeId, password, role });
      return true;
    } catch {
      return false;
    }
  },

  setStaffPassword: async (employeeId, newPassword) => {
    try {
      await api.put('/auth/staff-password', { employeeId, password: newPassword });
      return true;
    } catch {
      return false;
    }
  },

  deleteAuthAccount: async (employeeId) => {
    await api.delete(`/auth/users/${employeeId}`);
  },

  getStoredUsers: async () => {
    try {
      return await api.get<User[]>('/auth/users');
    } catch {
      return [];
    }
  },
}));
