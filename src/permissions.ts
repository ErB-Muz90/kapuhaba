import type { UserRole } from './types';

// ──────────────────────────────────────────────
// Permission Keys – map to existing features
// ──────────────────────────────────────────────

export type PermissionKey =
  // Core Access
  | 'core.dashboard'
  | 'core.pos'
  | 'core.settings'
  // POS Actions
  | 'pos.returns'
  | 'pos.expenditures'
  | 'pos.orders'
  | 'pos.held_receipts'
  | 'pos.open_drawer'
  // Inventory
  | 'inventory.view'
  | 'inventory.edit'
  | 'inventory.delete'
  // Purchasing & Suppliers
  | 'purchase_orders.view'
  | 'purchase_orders.manage'
  | 'suppliers.view'
  | 'suppliers.manage'
  | 'accounts_payable.view'
  | 'accounts_payable.manage'
  // Sales & Customers
  | 'sales.history'
  | 'customers.view'
  | 'customers.manage'
  // Staff & Reporting
  | 'staff.view'
  | 'staff.manage'
  | 'shifts.view'
  | 'shifts.manage'
  | 'reports.payment_summary'
  | 'reports.expenses'
  | 'reports.z_report';

// ──────────────────────────────────────────────
// Permission Matrix
// ──────────────────────────────────────────────

type PermissionMap = Record<UserRole, PermissionKey[]>;

export const ROLE_PERMISSIONS: PermissionMap = {
  admin: [
    // Core — full access
    'core.dashboard', 'core.pos', 'core.settings',
    // POS
    'pos.returns', 'pos.expenditures', 'pos.orders',
    'pos.held_receipts', 'pos.open_drawer',
    // Inventory
    'inventory.view', 'inventory.edit', 'inventory.delete',
    // Purchasing
    'purchase_orders.view', 'purchase_orders.manage',
    'suppliers.view', 'suppliers.manage',
    'accounts_payable.view', 'accounts_payable.manage',
    // Sales & Customers
    'sales.history', 'customers.view', 'customers.manage',
    // Staff & Reporting
    'staff.view', 'staff.manage',
    'shifts.view', 'shifts.manage',
    'reports.payment_summary',
    'reports.expenses', 'reports.z_report',
  ],

  cashier: [
    // Core
    'core.dashboard', 'core.pos',
    // Inventory - view only
    'inventory.view',
    // Sales & Customers - view only
    'sales.history', 'customers.view',
    // Staff - view only
    'staff.view',
    // Shifts - view only
    'shifts.view',
  ],

  supervisor: [
    // Core
    'core.dashboard', 'core.pos',
    // POS
    'pos.returns', 'pos.expenditures', 'pos.orders',
    'pos.held_receipts', 'pos.open_drawer',
    // Inventory
    'inventory.view', 'inventory.edit',
    // Purchasing & Suppliers
    'purchase_orders.view', 'purchase_orders.manage',
    'suppliers.view', 'suppliers.manage',
    // Sales & Customers
    'sales.history', 'customers.view', 'customers.manage',
    // Staff - view only
    'staff.view',
    // Shifts
    'shifts.view', 'shifts.manage',
    // Reports
    'reports.payment_summary',
  ],

  accountant: [
    // Core
    'core.dashboard',
    // Inventory - view only
    'inventory.view',
    // Purchasing & Suppliers - view only
    'purchase_orders.view',
    'suppliers.view',
    'accounts_payable.view', 'accounts_payable.manage',
    // Sales & Customers
    'sales.history', 'customers.view',
    // Staff - view only
    'staff.view',
    // Shifts - view only
    'shifts.view',
    // Reports
    'reports.payment_summary',
    'reports.expenses', 'reports.z_report',
  ],
};

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/** Check if a user role has a specific permission */
export function hasPermission(role: UserRole | undefined, permission: PermissionKey): boolean {
  if (!role) return false;
  if (role === 'admin') return true; // Admin has everything
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Check if a user role has ANY of the given permissions */
export function hasAnyPermission(role: UserRole | undefined, permissions: PermissionKey[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

/** Check if a user role has ALL of the given permissions */
export function hasAllPermissions(role: UserRole | undefined, permissions: PermissionKey[]): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

// ──────────────────────────────────────────────
// Role display / UI helpers
// ──────────────────────────────────────────────

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrator',
  cashier: 'Cashier',
  supervisor: 'Supervisor',
  accountant: 'Accountant',
};

export const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([value, label]) => ({
  value: value as UserRole,
  label,
}));

export const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-purple-100 text-purple-700',
  cashier: 'bg-green-100 text-green-700',
  supervisor: 'bg-blue-100 text-blue-700',
  accountant: 'bg-orange-100 text-orange-700',
};

// ──────────────────────────────────────────────
// Permission Grouping for the UI table
// ──────────────────────────────────────────────

export interface PermissionGroup {
  group: string;
  permissions: {
    key: PermissionKey;
    label: string;
  }[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    group: 'Core Access',
    permissions: [
      { key: 'core.dashboard', label: 'View Dashboard' },
      { key: 'core.pos', label: 'Access Point of Sale' },
      { key: 'core.settings', label: 'View Settings' },
    ],
  },    {
    group: 'Point of Sale Actions',
    permissions: [
      { key: 'pos.returns', label: 'Process Returns' },
      { key: 'pos.expenditures', label: 'Manage Expenditures' },
      { key: 'pos.orders', label: 'Manage Sales Orders' },
      { key: 'pos.held_receipts', label: 'View Held Receipts' },
      { key: 'pos.open_drawer', label: 'Open Cash Drawer Manually' },
    ],
  },
  {
    group: 'Inventory & Products',
    permissions: [
      { key: 'inventory.view', label: 'View Inventory' },
      { key: 'inventory.edit', label: 'Edit Inventory (add, update stock)' },
      { key: 'inventory.delete', label: 'Delete Inventory Items' },
    ],
  },
  {
    group: 'Purchasing & Suppliers',
    permissions: [
      { key: 'purchase_orders.view', label: 'View Purchase Orders' },
      { key: 'purchase_orders.manage', label: 'Manage Purchase Orders' },
      { key: 'suppliers.view', label: 'View Suppliers' },
      { key: 'suppliers.manage', label: 'Manage Suppliers' },
      { key: 'accounts_payable.view', label: 'View Accounts Payable' },
      { key: 'accounts_payable.manage', label: 'Manage Accounts Payable' },
    ],
  },    {
    group: 'Sales & Customers',
    permissions: [
      { key: 'sales.history', label: 'View Sales History' },
      { key: 'customers.view', label: 'View Customers' },
      { key: 'customers.manage', label: 'Manage Customers' },
    ],
  },    {
    group: 'Staff & Reporting',
    permissions: [
      { key: 'staff.view', label: 'View Staff Members' },
      { key: 'staff.manage', label: 'Manage Staff Members' },
      { key: 'shifts.view', label: 'View Shift Reports' },
      { key: 'shifts.manage', label: 'Manage Shifts' },
      { key: 'reports.payment_summary', label: 'View Payment Summary' },
      { key: 'reports.expenses', label: 'View Expenses' },
      { key: 'reports.z_report', label: 'View Z-Report' },
    ],
  },
];
