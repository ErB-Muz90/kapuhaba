import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import { useProductStore } from './store/productStore';
import { useCustomerStore } from './store/customerStore';
import { useSupplierStore } from './store/supplierStore';
import { useStaffStore } from './store/staffStore';
import { useSaleStore } from './store/saleStore';
import { useExpenseStore } from './store/expenseStore';
import { useSettingsStore } from './store/settingsStore';
import { useShiftStore } from './store/shiftStore';
import { usePurchaseOrderStore } from './store/purchaseOrderStore';
import { useStockStore } from './store/stockStore';
import { useAccountsPayableStore } from './store/accountsPayableStore';
import { useLoyaltyStore } from './store/loyaltyStore';
import { hasPermission } from './permissions';
import type { PermissionKey } from './permissions';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Dashboard } from './pages/Dashboard';
import { POS } from './pages/POS';
import { Products } from './pages/Products';
import { Customers } from './pages/Customers';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { Staff } from './pages/Staff';
import { Suppliers } from './pages/Suppliers';
import { PurchaseOrders } from './pages/PurchaseOrders';
import { StockManagement } from './pages/StockManagement';
import { AccountsPayable } from './pages/AccountsPayable';
import { Loyalty } from './pages/Loyalty';
import { ShiftManagement } from './pages/ShiftManagement';
import { Expenses } from './pages/Expenses';
import { ZReport } from './pages/ZReport';
import { Returns } from './pages/Returns';
import { Layaways } from './pages/Layaways';

function PrivateRoute({ children, permission }: { children: React.ReactNode; permission?: PermissionKey }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const role = useAuthStore((state) => state.user?.role);
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (permission && !hasPermission(role, permission)) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}

function AppInit({ children }: { children: React.ReactNode }) {
  const init = useAuthStore((state) => state.init);
  const initialized = useAuthStore((state) => state.initialized);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const fetchProducts = useProductStore((state) => state.fetch);
  const fetchCustomers = useCustomerStore((state) => state.fetch);
  const fetchSuppliers = useSupplierStore((state) => state.fetch);
  const fetchStaff = useStaffStore((state) => state.fetch);
  const fetchSales = useSaleStore((state) => state.fetch);
  const fetchExpenses = useExpenseStore((state) => state.fetch);
  const fetchSettings = useSettingsStore((state) => state.fetch);
  const fetchShifts = useShiftStore((state) => state.fetch);
  const fetchPOs = usePurchaseOrderStore((state) => state.fetch);
  const fetchStock = useStockStore((state) => state.fetchAdjustments);
  const fetchAP = useAccountsPayableStore((state) => state.fetch);
  const fetchLoyalty = useLoyaltyStore((state) => state.fetch);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchProducts();
      fetchCustomers();
      fetchSuppliers();
      fetchStaff();
      fetchSales();
      fetchExpenses();
      fetchSettings();
      fetchShifts();
      fetchPOs();
      fetchStock();
      fetchAP();
      fetchLoyalty();
    }
  }, [isAuthenticated]);

  if (!initialized) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <AppInit>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#333',
            color: '#fff',
          },
          success: {
            iconTheme: {
              primary: '#22c55e',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicRoute>
              <Signup />
            </PublicRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/pos"
          element={
            <PrivateRoute permission="core.pos">
              <POS />
            </PrivateRoute>
          }
        />
        <Route
          path="/products"
          element={
            <PrivateRoute permission="inventory.view">
              <Products />
            </PrivateRoute>
          }
        />
        <Route
          path="/customers"
          element={
            <PrivateRoute permission="customers.view">
              <Customers />
            </PrivateRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <PrivateRoute permission="sales.history">
              <Reports />
            </PrivateRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <PrivateRoute permission="core.settings">
              <Settings />
            </PrivateRoute>
          }
        />
        <Route
          path="/staff"
          element={
            <PrivateRoute permission="staff.view">
              <Staff />
            </PrivateRoute>
          }
        />
        <Route
          path="/suppliers"
          element={
            <PrivateRoute permission="suppliers.view">
              <Suppliers />
            </PrivateRoute>
          }
        />
        <Route
          path="/purchase-orders"
          element={
            <PrivateRoute permission="purchase_orders.view">
              <PurchaseOrders />
            </PrivateRoute>
          }
        />
        <Route
          path="/stock"
          element={
            <PrivateRoute permission="inventory.view">
              <StockManagement />
            </PrivateRoute>
          }
        />
        <Route
          path="/accounts-payable"
          element={
            <PrivateRoute permission="accounts_payable.view">
              <AccountsPayable />
            </PrivateRoute>
          }
        />
        <Route
          path="/loyalty"
          element={
            <PrivateRoute permission="customers.view">
              <Loyalty />
            </PrivateRoute>
          }
        />
        <Route
          path="/shifts"
          element={
            <PrivateRoute permission="shifts.view">
              <ShiftManagement />
            </PrivateRoute>
          }
        />
        <Route
          path="/expenses"
          element={
            <PrivateRoute permission="reports.expenses">
              <Expenses />
            </PrivateRoute>
          }
        />
        <Route
          path="/z-report"
          element={
            <PrivateRoute permission="reports.z_report">
              <ZReport />
            </PrivateRoute>
          }
        />
        <Route
          path="/returns"
          element={
            <PrivateRoute permission="inventory.view">
              <Returns />
            </PrivateRoute>
          }
        />
        <Route
          path="/layaways"
          element={
            <PrivateRoute permission="inventory.view">
              <Layaways />
            </PrivateRoute>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      </AppInit>
    </BrowserRouter>
    </ErrorBoundary>
  );
}
