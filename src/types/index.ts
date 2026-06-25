// User & Auth Types
export type UserRole = 'admin' | 'cashier' | 'supervisor' | 'accountant';

export interface User {
  id: string;
  username: string;
  employeeId: string;        // Links to Staff.employeeId
  staffId?: string;          // Links to Staff.id
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

// Product Types
export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  buyingPrice: number;
  sellingPrice: number;
  stockQuantity: number;
  category: string;
  lowStockThreshold: number;
  createdAt: string;
  updatedAt: string;
}

// Customer Types
export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  createdAt: string;
  updatedAt: string;
}

// Cart Types
export interface CartItem {
  product: Product;
  quantity: number;
}

// Sale Types

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: PaymentMethod;
  payments?: Payment[];
  shiftId?: string;
  customerId?: string;
  customerName?: string;
  cashierId: string;
  cashierName: string;
  createdAt: string;
}

// Report Types
export interface DailySummary {
  date: string;
  totalSales: number;
  totalRevenue: number;
  totalProfit: number;
  paymentBreakdown: {
    cash: number;
    mpesa: number;
    card: number;
  };
}

export interface TopProduct {
  productId: string;
  productName: string;
  quantitySold: number;
  revenue: number;
}

// Settings
export interface BusinessSettings {
  name: string;
  address: string;
  phone: string;
  email: string;
  taxRate: number;
  currency: string;
  currencySymbol: string;
  loyaltyPointsPerCurrency: number; // e.g., 1 point per 100 KSh spent
  loyaltyRedemptionRate: number; // e.g., 1 point = 1 KSh discount
  defaultFloat: number; // Default starting float for shifts
}

// Payment Types
export type PaymentMethod = 'cash' | 'mpesa' | 'card';

export interface Payment {
  id: string;
  saleId: string;
  method: 'CASH' | 'MPESA' | 'CARD';
  amount: number;
  createdAt: string;
}

// Shift & Cash Drawer Types
export type ShiftStatus = 'IDLE' | 'ACTIVE' | 'SUSPENDED' | 'CLOSING' | 'CLOSED' | 'active' | 'closed';
export type CashMovementType = 'SALE' | 'EXPENSE' | 'PAYOUT' | 'FLOAT' | 'BANKING' | 'OPENING_FLOAT' | 'SALE_CASH' | 'CASH_IN';
export type CashDirection = 'IN' | 'OUT';

export interface Shift {
  id: string;
  staffId: string;
  staffName: string;
  terminalId: string;
  startingFloat: number;
  status: ShiftStatus;
  startedAt: string;
  endedAt: string | null;
  expectedCash?: number;
  actualCash?: number;
  variance?: number;
  retainedFloat?: number;
  toBank?: number;
  notes?: string;
}

export interface CashMovement {
  id: string;
  shiftId: string;
  type: CashMovementType;
  method?: 'CASH' | 'MPESA' | 'CARD';
  direction: CashDirection;
  amount: number;
  notes?: string;
  referenceId?: string;
  referenceType?: 'sale' | 'payable' | 'expense' | 'other';
  anomaly?: boolean;
  createdAt: string;
}

export interface TerminalSession {
  id: string;
  staffId: string;
  staffName: string;
  terminalId: string;
  shiftId: string | null;
  startedAt: string;
  endedAt: string | null;
  status: 'active' | 'closed';
}

// Expense Types
export type ExpenseCategory = 'rent' | 'utilities' | 'salaries' | 'supplies' | 'maintenance' | 'marketing' | 'other';
export type ExpenseStatus = 'pending' | 'approved' | 'paid' | 'cancelled';

export interface Expense {
  id: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  date: string;
  dueDate?: string;
  supplier?: string;
  paymentMethod?: 'cash' | 'bank_transfer' | 'cheque' | 'mpesa';
  reference?: string;
  status: ExpenseStatus;
  approvedBy?: string;
  paidBy?: string;
  paidAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// COGS & Profit Types
export interface COGSRecord {
  id: string;
  saleId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  unitPrice: number;
  totalRevenue: number;
  grossProfit: number;
  profitMargin: number;
  date: string;
}

export interface ProfitSummary {
  period: string;
  totalRevenue: number;
  totalCOGS: number;
  grossProfit: number;
  grossMarginPercent: number;
  totalExpenses: number;
  netProfit: number;
  netMarginPercent: number;
}

// Discount Types
export interface Discount {
  id: string;
  saleId: string;
  productId?: string;
  productName?: string;
  discountType: 'percentage' | 'fixed' | 'buy_x_get_y' | 'bulk';
  discountValue: number;
  discountAmount: number;
  originalAmount: number;
  appliedBy: string;
  reason?: string;
  createdAt: string;
}

export interface DiscountSummary {
  period: string;
  totalDiscounts: number;
  discountCount: number;
  averageDiscount: number;
  discountsByCategory: { category: string; amount: number; count: number }[];
  discountsByReason: { reason: string; amount: number; count: number }[];
}

// Financial Report Types
export interface FinancialReport {
  period: string;
  startDate: string;
  endDate: string;
  revenue: {
    totalSales: number;
    cashSales: number;
    mpesaSales: number;
    cardSales: number;
    totalRevenue: number;
  };
  cogs: {
    totalCOGS: number;
    averageCOGSPercent: number;
  };
  grossProfit: {
    amount: number;
    margin: number;
  };
  expenses: {
    totalExpenses: number;
    byCategory: { category: string; amount: number }[];
  };
  netProfit: {
    amount: number;
    margin: number;
  };
  cashFlow: {
    openingFloat: number;
    cashIn: number;
    cashOut: number;
    bankDeposits: number;
    closingCash: number;
    variance: number;
  };
  discounts: {
    totalDiscounts: number;
    discountCount: number;
  };
}

// Staff Management Types
export type StaffStatus = 'active' | 'inactive' | 'suspended' | 'terminated';
export type OffDayType = 'sick' | 'vacation' | 'personal' | 'public_holiday' | 'other';
export type OffDayStatus = 'approved' | 'pending' | 'rejected';

export interface Staff {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: UserRole;
  employeeId: string;
  salary: number;
  hireDate: string;
  status: StaffStatus;
  address?: string;
  emergencyContact?: string;
  authUserId?: string;        // Links to auth user account
  hasSystemAccess: boolean;   // Whether this staff can log in
  createdAt: string;
  updatedAt: string;
}

export interface StaffOffDay {
  id: string;
  staffId: string;
  staffName: string;
  type: OffDayType;
  date: string;               // Single day or start date
  endDate?: string;           // For multi-day off
  reason: string;
  status: OffDayStatus;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StaffShift {
  id: string;
  staffId: string;
  staffName: string;
  date: string;
  startTime: string;
  endTime: string;
  hoursWorked: number;
  status: 'scheduled' | 'completed' | 'absent';
  notes?: string;
}

// Supplier Types
export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  taxId?: string;
  paymentTerms: number; // days
  status: 'active' | 'inactive';
  notes?: string;
  totalOrders: number;
  totalSpent: number;
  createdAt: string;
  updatedAt: string;
}

// Purchase Order Types
export type POStatus = 'draft' | 'pending' | 'approved' | 'ordered' | 'partial' | 'received' | 'cancelled';

export interface POItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  receivedQuantity: number;
  unitCost: number;
  total: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  items: POItem[];
  subtotal: number;
  tax: number;
  shippingCost: number;
  total: number;
  status: POStatus;
  expectedDelivery?: string;
  receivedDate?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// Stock Management Types
export type StockAdjustmentType = 'adjustment' | 'damage' | 'theft' | 'return' | 'correction' | 'transfer';

export interface StockAdjustment {
  id: string;
  productId: string;
  productName: string;
  type: StockAdjustmentType;
  quantityChange: number; // positive or negative
  previousQuantity: number;
  newQuantity: number;
  reason: string;
  reference?: string; // PO number, return ID, etc.
  performedBy: string;
  createdAt: string;
}

export interface StockCount {
  id: string;
  date: string;
  status: 'in_progress' | 'completed';
  items: StockCountItem[];
  performedBy: string;
  notes?: string;
  createdAt: string;
  completedAt?: string;
}

export interface StockCountItem {
  productId: string;
  productName: string;
  systemQuantity: number;
  countedQuantity: number;
  variance: number;
}

// Accounts Payable Types
export type PayableStatus = 'pending' | 'partial' | 'paid' | 'overdue';

export interface AccountPayable {
  id: string;
  supplierId: string;
  supplierName: string;
  poId?: string;
  poNumber?: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  balance: number;
  status: PayableStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayablePayment {
  id: string;
  payableId: string;
  amount: number;
  paymentMethod: 'cash' | 'bank_transfer' | 'cheque' | 'mpesa';
  reference?: string;
  paidBy: string;
  paidAt: string;
}

// Customer Loyalty Types
export interface LoyaltyAccount {
  customerId: string;
  customerName: string;
  phone: string;
  pointsBalance: number;
  totalPointsEarned: number;
  totalPointsRedeemed: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  joinDate: string;
  lastActivity: string;
}

export interface LoyaltyTransaction {
  id: string;
  customerId: string;
  type: 'earned' | 'redeemed' | 'expired' | 'adjustment';
  points: number;
  saleId?: string;
  description: string;
  createdAt: string;
}

export interface LoyaltyTier {
  name: 'bronze' | 'silver' | 'gold' | 'platinum';
  minPoints: number;
  multiplier: number; // e.g., 1.5x points for gold
  benefits: string[];
}

// Return Types
export type ReturnStatus = 'pending' | 'approved' | 'completed' | 'rejected';
export type RefundMethod = 'cash' | 'mpesa' | 'card' | 'store_credit';

export interface ReturnItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  total: number;
  reason: string;
  condition: 'good' | 'damaged' | 'defective';
}

export interface Return {
  id: string;
  saleId?: string;
  saleNumber?: string;
  customerId?: string;
  customerName?: string;
  items: ReturnItem[];
  subtotal: number;
  tax: number;
  total: number;
  refundMethod?: RefundMethod;
  cashierId: string;
  cashierName: string;
  status: ReturnStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Layaway Types
export type LayawayStatus = 'active' | 'completed' | 'cancelled' | 'defaulted';

export interface LayawayItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface LayawayPayment {
  amount: number;
  method: 'cash' | 'mpesa' | 'card';
  date: string;
  reference?: string;
}

export interface Layaway {
  id: string;
  customerId?: string;
  customerName?: string;
  items: LayawayItem[];
  totalAmount: number;
  depositAmount: number;
  paidAmount: number;
  balanceDue: number;
  dueDate?: string;
  payments: LayawayPayment[];
  status: LayawayStatus;
  cashierId: string;
  cashierName: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
