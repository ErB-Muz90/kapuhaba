import { create } from 'zustand';
import { api } from '../api/client';
import type { Staff, StaffOffDay, StaffShift } from '../types';

interface StaffStore {
  staff: Staff[];
  offDays: StaffOffDay[];
  staffShifts: StaffShift[];
  loading: boolean;
  fetch: () => Promise<void>;
  fetchOffDays: () => Promise<void>;
  fetchShifts: () => Promise<void>;
  addStaff: (s: Omit<Staff, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Staff>;
  updateStaff: (id: string, updates: Partial<Staff>) => Promise<void>;
  deleteStaff: (id: string) => Promise<void>;
  getStaff: (id: string) => Staff | undefined;
  getStaffByEmployeeId: (employeeId: string) => Staff | undefined;
  searchStaff: (query: string) => Staff[];
  addOffDay: (o: Omit<StaffOffDay, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateOffDay: (id: string, updates: Partial<StaffOffDay>) => Promise<void>;
  deleteOffDay: (id: string) => Promise<void>;
  addShift: (s: Omit<StaffShift, 'id'>) => Promise<void>;
  updateShift: (id: string, updates: Partial<StaffShift>) => Promise<void>;
  deleteShift: (id: string) => Promise<void>;
}

export const useStaffStore = create<StaffStore>()((set, get) => ({
  staff: [],
  offDays: [],
  staffShifts: [],
  loading: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const staff = await api.get<Staff[]>('/staff');
      set({ staff, loading: false });
    } catch { set({ loading: false }); }
  },

  fetchOffDays: async () => {
    try {
      const offDays = await api.get<StaffOffDay[]>('/staff/off-days');
      set({ offDays });
    } catch {}
  },

  fetchShifts: async () => {
    try {
      const staffShifts = await api.get<StaffShift[]>('/staff/shifts');
      set({ staffShifts });
    } catch {}
  },

  addStaff: async (data) => {
    const created = await api.post<Staff>('/staff', data);
    set((state) => ({ staff: [...state.staff, created] }));
    return created;
  },

  updateStaff: async (id, updates) => {
    await api.put(`/staff/${id}`, updates);
    set((state) => ({
      staff: state.staff.map((s) => s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s),
    }));
  },

  deleteStaff: async (id) => {
    await api.delete(`/staff/${id}`);
    set((state) => ({ staff: state.staff.filter((s) => s.id !== id) }));
  },

  getStaff: (id) => get().staff.find((s) => s.id === id),

  getStaffByEmployeeId: (employeeId) => get().staff.find((s) => s.employeeId === employeeId),

  searchStaff: (query) => {
    const q = query.toLowerCase();
    return get().staff.filter(
      (s) => s.firstName.toLowerCase().includes(q) || s.lastName.toLowerCase().includes(q) || s.employeeId.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
    );
  },

  addOffDay: async (data) => {
    const created = await api.post<StaffOffDay>('/staff/off-days', data);
    set((state) => ({ offDays: [...state.offDays, created] }));
  },

  updateOffDay: async (id, updates) => {
    await api.put(`/staff/off-days/${id}`, updates);
    set((state) => ({
      offDays: state.offDays.map((o) => o.id === id ? { ...o, ...updates, updatedAt: new Date().toISOString() } : o),
    }));
  },

  deleteOffDay: async (id) => {
    await api.delete(`/staff/off-days/${id}`);
    set((state) => ({ offDays: state.offDays.filter((o) => o.id !== id) }));
  },

  addShift: async (data) => {
    const created = await api.post<StaffShift>('/staff/shifts', data);
    set((state) => ({ staffShifts: [...state.staffShifts, created] }));
  },

  updateShift: async (id, updates) => {
    await api.put(`/staff/shifts/${id}`, updates);
    set((state) => ({
      staffShifts: state.staffShifts.map((s) => s.id === id ? { ...s, ...updates } : s),
    }));
  },

  deleteShift: async (id) => {
    await api.delete(`/staff/shifts/${id}`);
    set((state) => ({ staffShifts: state.staffShifts.filter((s) => s.id !== id) }));
  },
}));
