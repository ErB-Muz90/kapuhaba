import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { hasPermission } from '../permissions';
import type { PermissionKey } from '../permissions';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  ChevronDown,
  UserCog,
  Truck,
  FileText,
  Warehouse,
  CreditCard,
  Gift,
  Clock,
  DollarSign,
  RotateCcw,
  // Optional: add an expand icon for groups
} from 'lucide-react';
import { useProductStore } from '../store/productStore';

interface LayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  path?: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: PermissionKey;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'core.dashboard' },
  { path: '/pos', label: 'POS', icon: ShoppingCart, permission: 'core.pos' },
  {
    label: 'Inventory',
    icon: Package,
    children: [
      { path: '/products', label: 'Products', icon: Package, permission: 'inventory.view' },
      { path: '/stock', label: 'Stock Management', icon: Warehouse, permission: 'inventory.view' },
    ],
  },
  {
    label: 'People',
    icon: Users,
    children: [
      { path: '/customers', label: 'Customers', icon: Users, permission: 'customers.view' },
      { path: '/loyalty', label: 'Loyalty Program', icon: Gift, permission: 'customers.view' },
      { path: '/staff', label: 'Staff', icon: UserCog, permission: 'staff.view' },
      { path: '/shifts', label: 'Shift Management', icon: Clock, permission: 'shifts.view' },
    ],
  },
  {
    label: 'Purchasing',
    icon: Truck,
    children: [
      { path: '/suppliers', label: 'Suppliers', icon: Truck, permission: 'suppliers.view' },
      { path: '/purchase-orders', label: 'Purchase Orders', icon: FileText, permission: 'purchase_orders.view' },
      { path: '/accounts-payable', label: 'Accounts Payable', icon: CreditCard, permission: 'accounts_payable.view' },
    ],
  },
  {
    label: 'Sales',
    icon: RotateCcw,
    children: [
      { path: '/returns', label: 'Returns', icon: RotateCcw, permission: 'inventory.view' },
      { path: '/layaways', label: 'Layaways', icon: Package, permission: 'inventory.view' },
      { path: '/expenses', label: 'Expenses', icon: DollarSign, permission: 'reports.expenses' },
      { path: '/z-report', label: 'Z-Report (EOD)', icon: FileText, permission: 'reports.z_report' },
    ],
  },
  { path: '/reports', label: 'Reports & Analytics', icon: BarChart3, permission: 'sales.history' },
  { path: '/settings', label: 'Settings', icon: Settings, permission: 'core.settings' },
];

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<string[]>([]);

  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const products = useProductStore((state) => state.products);
  const lowStockCount = products.filter((p) => p.stockQuantity <= p.lowStockThreshold).length;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const filteredNavItems = navItems.filter((item) => {
    if (!item.permission) return true;
    return hasPermission(user?.role, item.permission);
  });

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-slate-900 transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-700">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
              <span className="text-white font-extrabold text-sm">K</span>
            </div>
            <span className="text-xl font-extrabold text-white tracking-tight">KAPU HABA</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

          <nav className="p-4 space-y-1">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              if (item.children && item.children.length > 0) {
                const isOpen = openGroups.includes(item.label);
                return (
                  <div key={item.label}>
                    <button
                      onClick={() => setOpenGroups((prev) => prev.includes(item.label) ? prev.filter((l) => l !== item.label) : [...prev, item.label])}
                      className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-colors ${
                        isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-slate-800 hover:text-white'}
                      `}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-medium flex-1 text-left">{item.label}</span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="ml-4 mt-1 space-y-1">
                        {item.children.filter((child) => !child.permission || hasPermission(user?.role, child.permission)).map((child) => {
                          const ChildIcon = child.icon;
                          const childActive = location.pathname === child.path;
                          return (
                            <Link
                              key={child.path}
                              to={child.path!}
                              onClick={() => setSidebarOpen(false)}
                              className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                                childActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-slate-800 hover:text-white'}
                              `}
                            >
                              <ChildIcon className="w-4 h-4" />
                              <span className="font-medium">{child.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <Link
                  key={item.path}
                  to={item.path!}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 text-gray-300 hover:bg-slate-800 hover:text-white rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-30 h-16 bg-white shadow-sm">
          <div className="flex items-center justify-between h-full px-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-gray-600 hover:text-gray-900"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex-1 lg:flex-none" />

            <div className="flex items-center gap-4">
              {/* Notifications */}
              <div className="relative">
                <button className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full">
                  <Bell className="w-5 h-5" />
                  {lowStockCount > 0 && (
                    <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {lowStockCount}
                    </span>
                  )}
                </button>
              </div>

              {/* User menu */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg"
                >
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-sm font-semibold text-white">
                      {user?.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium text-gray-900">{user?.username}</p>
                    <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>

                {userMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border z-50">
                      <div className="p-3 border-b">
                        <p className="text-sm font-medium text-gray-900">{user?.username}</p>
                        <p className="text-xs text-gray-500">{user?.email}</p>
                      </div>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6 pb-2">{children}</main>

        {/* Footer */}
        <footer className="px-4 lg:px-6 py-3 text-center border-t border-gray-200 bg-white">
          <p className="text-xs text-gray-500">
            Built by <span className="font-semibold text-gray-700">Eruns Technologies</span>
          </p>
        </footer>
      </div>
    </div>
  );
}
