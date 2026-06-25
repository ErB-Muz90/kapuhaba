import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useSaleStore } from '../store/saleStore';
import { useProductStore } from '../store/productStore';
import { useFormatCurrency, safeFormat } from '../utils/format';
import {
  DollarSign,
  ShoppingCart,
  Package,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { format, startOfDay, endOfDay, isWithinInterval, subDays } from 'date-fns';

export function Dashboard() {
  const $c = useFormatCurrency();
  const sales = useSaleStore((state) => state.sales);
  const products = useProductStore((state) => state.products);
  // Calculate today's summary
  const todaySummary = useMemo(() => {
    const today = new Date();
    const start = startOfDay(today);
    const end = endOfDay(today);
    
    const todaySales = sales.filter((sale) => {
      const saleDate = new Date(sale.createdAt);
      return isWithinInterval(saleDate, { start, end });
    });
    
    const totalRevenue = todaySales.reduce((sum, sale) => sum + sale.total, 0);
    const paymentBreakdown = {
      cash: todaySales.filter((s) => s.paymentMethod === 'cash').reduce((sum, s) => sum + s.total, 0),
      mpesa: todaySales.filter((s) => s.paymentMethod === 'mpesa').reduce((sum, s) => sum + s.total, 0),
      card: todaySales.filter((s) => s.paymentMethod === 'card').reduce((sum, s) => sum + s.total, 0),
    };
    
    return {
      totalSales: todaySales.length,
      totalRevenue,
      paymentBreakdown,
    };
  }, [sales]);
  
  // Get recent sales
  const recentSales = useMemo(() => {
    return [...sales]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [sales]);
  
  // Get top products from last 7 days
  const topProducts = useMemo(() => {
    const startDate = subDays(new Date(), 7);
    const recentSales = sales.filter(
      (sale) => new Date(sale.createdAt) >= startDate
    );
    
    const productStats: Record<string, { name: string; quantity: number; revenue: number }> = {};
    
    for (const sale of recentSales) {
      for (const item of sale.items) {
        if (!productStats[item.productId]) {
          productStats[item.productId] = {
            name: item.productName,
            quantity: 0,
            revenue: 0,
          };
        }
        productStats[item.productId].quantity += item.quantity;
        productStats[item.productId].revenue += item.total;
      }
    }
    
    return Object.entries(productStats)
      .map(([productId, stats]) => ({
        productId,
        productName: stats.name,
        quantitySold: stats.quantity,
        revenue: stats.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [sales]);
  
  // Get low stock products
  const lowStockProducts = useMemo(() => {
    return products.filter((p) => p.stockQuantity <= p.lowStockThreshold);
  }, [products]);

  // Yesterday summary for comparison
  const yesterdaySummary = useMemo(() => {
    const yesterday = subDays(new Date(), 1);
    const start = startOfDay(yesterday);
    const end = endOfDay(yesterday);
    
    const yesterdaySales = sales.filter((sale) => {
      const saleDate = new Date(sale.createdAt);
      return isWithinInterval(saleDate, { start, end });
    });
    
    return {
      totalSales: yesterdaySales.length,
      totalRevenue: yesterdaySales.reduce((sum, sale) => sum + sale.total, 0),
    };
  }, [sales]);

  const revenueChange = yesterdaySummary.totalRevenue > 0
    ? ((todaySummary.totalRevenue - yesterdaySummary.totalRevenue) / yesterdaySummary.totalRevenue) * 100
    : 0;

  const salesChange = yesterdaySummary.totalSales > 0
    ? ((todaySummary.totalSales - yesterdaySummary.totalSales) / yesterdaySummary.totalSales) * 100
    : 0;

  const stats = [
    {
      title: "Today's Revenue",
      value: $c(todaySummary.totalRevenue),
      icon: DollarSign,
      color: 'bg-green-500',
      change: `${revenueChange >= 0 ? '+' : ''}${revenueChange.toFixed(1)}%`,
      positive: revenueChange >= 0,
    },
    {
      title: "Today's Sales",
      value: todaySummary.totalSales.toString(),
      icon: ShoppingCart,
      color: 'bg-blue-500',
      change: `${salesChange >= 0 ? '+' : ''}${salesChange.toFixed(1)}%`,
      positive: salesChange >= 0,
    },
    {
      title: 'Total Products',
      value: products.length.toString(),
      icon: Package,
      color: 'bg-purple-500',
    },
    {
      title: 'Low Stock Items',
      value: lowStockProducts.length.toString(),
      icon: AlertTriangle,
      color: 'bg-orange-500',
      alert: lowStockProducts.length > 0,
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600">Welcome to KAPU HABA Dashboard</p>
          </div>
          <Link
            to="/pos"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ShoppingCart className="w-5 h-5" />
            New Sale
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.title}
              className={`bg-white rounded-xl shadow-sm p-6 ${
                stat.alert ? 'ring-2 ring-orange-500' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                  {stat.change && (
                    <p
                      className={`text-sm mt-1 ${
                        stat.positive ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      <TrendingUp className="w-4 h-4 inline mr-1" />
                      {stat.change}
                    </p>
                  )}
                </div>
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Sales */}
          <div className="bg-white rounded-xl shadow-sm">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Recent Sales</h2>
              <Link
                to="/reports"
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                View All <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="divide-y">
              {recentSales.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  No sales yet today. Start selling!
                </div>
              ) : (
                recentSales.map((sale) => (
                  <div key={sale.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <ShoppingCart className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {sale.items.length} item{sale.items.length > 1 ? 's' : ''}
                          </p>
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {safeFormat(sale.createdAt, 'HH:mm')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">
                          {$c(sale.total)}
                        </p>
                        <p className="text-xs text-gray-500 capitalize">
                          {sale.paymentMethod}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Top Products */}
          <div className="bg-white rounded-xl shadow-sm">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Top Products (7 days)</h2>
              <Link
                to="/products"
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                View All <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="divide-y">
              {topProducts.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  No sales data available yet.
                </div>
              ) : (
                topProducts.map((product, index) => (
                  <div key={product.productId} className="p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-semibold text-gray-600">
                          {index + 1}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {product.productName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {product.quantitySold} sold
                          </p>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">
                        {$c(product.revenue)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Low Stock Alert */}
        {lowStockProducts.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-orange-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-orange-800">
                  Low Stock Alert
                </h3>
                <p className="text-sm text-orange-700 mt-1">
                  {lowStockProducts.length} product{lowStockProducts.length > 1 ? 's' : ''}{' '}
                  running low on stock
                </p>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {lowStockProducts.slice(0, 6).map((product) => (
                    <div
                      key={product.id}
                      className="bg-white rounded-lg p-3 border border-orange-200"
                    >
                      <p className="text-sm font-medium text-gray-900">{product.name}</p>
                      <p className="text-xs text-orange-600 mt-1">
                        Only {product.stockQuantity} left (threshold: {product.lowStockThreshold})
                      </p>
                    </div>
                  ))}
                </div>
                <Link
                  to="/products"
                  className="inline-flex items-center gap-1 mt-4 text-sm font-medium text-orange-700 hover:text-orange-800"
                >
                  Manage Inventory <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Payment Breakdown */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Today's Payment Breakdown
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm font-medium text-green-800">Cash</p>
              <p className="text-2xl font-bold text-green-900 mt-1">
                {$c(todaySummary.paymentBreakdown.cash)}
              </p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm font-medium text-blue-800">M-Pesa</p>
              <p className="text-2xl font-bold text-blue-900 mt-1">
                {$c(todaySummary.paymentBreakdown.mpesa)}
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm font-medium text-purple-800">Card</p>
              <p className="text-2xl font-bold text-purple-900 mt-1">
                {$c(todaySummary.paymentBreakdown.card)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
