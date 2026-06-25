import { useMemo, useState } from 'react';
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

const sections: { title: string; items: NavItem[] }[] = [
  {
    title: 'CORE',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'core.dashboard' },
      { path: '/pos', label: 'POS', icon: ShoppingCart, permission: 'core.pos' },
    ],
  },
  {
    title: 'INVENTORY',
    items: [
      { path: '/products', label: 'Products', icon: Package, permission: 'inventory.view' },
      { path: '/stock', label: 'Stock Management', icon: Warehouse, permission: 'inventory.view' },
      {
        label: 'Purchasing',
        icon: Truck,
        children: [
          { path: '/suppliers', label: 'Suppliers', icon: Truck, permission: 'suppliers.view' },
          { path: '/purchase-orders', label: 'Purchase Orders', icon: FileText, permission: 'purchase_orders.view' },
        ],
      },
    ],
  },
  {
    title: 'PEOPLE',
    items: [
      { path: '/customers', label: 'Customers', icon: Users, permission: 'customers.view' },
      { path: '/loyalty', label: 'Loyalty Program', icon: Gift, permission: 'customers.view' },
      { path: '/staff', label: 'Staff', icon: UserCog, permission: 'staff.view' },
    ],
  },
  {
    title: 'SALES',
    items: [
      { path: '/returns', label: 'Returns', icon: RotateCcw, permission: 'inventory.view' },
      { path: '/layaways', label: 'Layaways', icon: Package, permission: 'inventory.view' },
    ],
  },
  {
    title: 'FINANCE',
    items: [
      { path: '/shifts', label: 'Shift Management', icon: Clock, permission: 'shifts.view' },
      { path: '/expenses', label: 'Expenses', icon: DollarSign, permission: 'reports.expenses' },
      { path: '/accounts-payable', label: 'Accounts Payable', icon: CreditCard, permission: 'accounts_payable.view' },
    ],
  },
  {
    title: 'REPORTING',
    items: [
      { path: '/z-report', label: 'Z-Report (EOD)', icon: FileText, permission: 'reports.z_report' },
      { path: '/reports', label: 'Reports & Analytics', icon: BarChart3, permission: 'sales.history' },
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      { path: '/settings', label: 'Settings', icon: Settings, permission: 'core.settings' },
    ],
  },
];

function isCurrentPath(path: string | undefined, currentPath: string) {
  return Boolean(path && (currentPath === path || currentPath.startsWith(`${path}/`)));
}

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

  const filteredSections = useMemo(
    () =>
      sections
        .map((section) => ({
          title: section.title,
          items: section.items
            .map((item) => {
              const children = item.children?.filter(
                (child) => !child.permission || hasPermission(user?.role, child.permission)
              );

              return { ...item, children };
            })
            .filter((item) => {
              const canViewItem = !item.permission || hasPermission(user?.role, item.permission);
              const hasVisibleChildren = Boolean(item.children?.length);

              return canViewItem && (!item.children || hasVisibleChildren);
            }),
        }))
        .filter((section) => section.items.length > 0),
    [user?.role]
  );

  const activeGroupLabels = filteredSections.flatMap((section) =>
    section.items
      .filter((item) => item.children?.some((child) => isCurrentPath(child.path, location.pathname)))
      .map((item) => item.label)
  );

  const expandedGroups = new Set([...openGroups, ...activeGroupLabels]);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        aria-label="Primary navigation"
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-slate-900 transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } flex flex-col`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-700 px-4">
          <Link
            to="/dashboard"
            onClick={() => setSidebarOpen(false)}
            className="flex min-w-0 items-center gap-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 shadow-md">
              <span className="text-white font-extrabold text-sm">K</span>
            </div>
            <span className="truncate text-xl font-extrabold text-white tracking-tight">KAPU HABA</span>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation menu"
            className="rounded-md p-1 text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-900 lg:hidden"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Sidebar menu">
          {filteredSections.map((section) => (
            <section key={section.title} aria-labelledby={`sidebar-${section.title.toLowerCase()}`}>
              <h2
                id={`sidebar-${section.title.toLowerCase()}`}
                className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400"
              >
                {section.title}
              </h2>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = isCurrentPath(item.path, location.pathname);

                  if (item.children?.length) {
                    const isGroupActive = item.children.some((child) => isCurrentPath(child.path, location.pathname));
                    const isOpen = expandedGroups.has(item.label);

                    return (
                      <div key={item.label}>
                        <button
                          type="button"
                          onClick={() =>
                            setOpenGroups((prev) =>
                              prev.includes(item.label)
                                ? prev.filter((label) => label !== item.label)
                                : [...prev, item.label]
                            )
                          }
                          aria-expanded={isOpen}
                          className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                            isGroupActive
                              ? 'bg-slate-800 text-white'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.label}</span>
                          <ChevronDown
                            className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                            aria-hidden="true"
                          />
                        </button>
                        {isOpen && (
                          <div className="mt-1 space-y-1 border-l border-slate-700 pl-3 ml-5">
                            {item.children.map((child) => {
                              const ChildIcon = child.icon;
                              const childActive = isCurrentPath(child.path, location.pathname);

                              return (
                                <Link
                                  key={child.path}
                                  to={child.path!}
                                  onClick={() => setSidebarOpen(false)}
                                  aria-current={childActive ? 'page' : undefined}
                                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                                    childActive
                                      ? 'bg-blue-600 text-white'
                                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                  }`}
                                >
                                  <ChildIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                                  <span className="min-w-0 truncate font-medium">{child.label}</span>
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
                      aria-current={isActive ? 'page' : undefined}
                      className={`flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 truncate text-sm font-medium">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>

        <div className="shrink-0 border-t border-slate-700 p-4">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            <LogOut className="h-5 w-5" aria-hidden="true" />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-30 h-16 bg-white shadow-sm">
          <div className="flex items-center justify-between h-full px-4">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation menu"
              className="rounded-md p-1 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 lg:hidden"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex-1 lg:flex-none" />

            <div className="flex items-center gap-4">
              {/* Notifications */}
              <div className="relative">
                <button
                  type="button"
                  aria-label={lowStockCount > 0 ? `${lowStockCount} low stock notifications` : 'Notifications'}
                  className="relative rounded-full p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
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
                  type="button"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  aria-expanded={userMenuOpen}
                  aria-haspopup="menu"
                  className="flex items-center gap-2 rounded-lg p-2 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
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
                      role="presentation"
                      className="fixed inset-0 z-40"
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 z-50 mt-2 w-48 rounded-lg border bg-white shadow-lg" role="menu">
                      <div className="p-3 border-b">
                        <p className="text-sm font-medium text-gray-900">{user?.username}</p>
                        <p className="text-xs text-gray-500">{user?.email}</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleLogout}
                        role="menuitem"
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-blue-600"
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
