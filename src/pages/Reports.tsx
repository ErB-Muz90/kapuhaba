import { useState, useMemo, useRef } from 'react';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Receipt } from '../components/Receipt';
import { useSaleStore } from '../store/saleStore';
import { useFormatCurrency, escapeCSV, safeFormat } from '../utils/format';
import type { Sale } from '../types';
import {
  Calendar,
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Download,
  Eye,
  Printer,
  CreditCard,
  Smartphone,
  Banknote,
  ArrowUpRight,
  ArrowDownRight,
  Package,
} from 'lucide-react';
import { format, subDays, eachDayOfInterval, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import toast from 'react-hot-toast';

export function Reports() {
  const $c = useFormatCurrency();
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd'),
  });
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  
  const receiptRef = useRef<HTMLDivElement>(null);
  
  const allSales = useSaleStore((state) => state.sales);

  // Filter sales by date range
  const sales = useMemo(() => {
    const start = startOfDay(new Date(dateRange.start));
    const end = endOfDay(new Date(dateRange.end));
    
    return allSales
      .filter((sale) => {
        const saleDate = new Date(sale.createdAt);
        return isWithinInterval(saleDate, { start, end });
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [dateRange, allSales]);

  // Calculate today's summary
  const todaySummary = useMemo(() => {
    const today = new Date();
    const start = startOfDay(today);
    const end = endOfDay(today);
    
    const todaySales = allSales.filter((sale) => {
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
  }, [allSales]);

  // Calculate yesterday's summary
  const yesterdaySummary = useMemo(() => {
    const yesterday = subDays(new Date(), 1);
    const start = startOfDay(yesterday);
    const end = endOfDay(yesterday);
    
    const yesterdaySales = allSales.filter((sale) => {
      const saleDate = new Date(sale.createdAt);
      return isWithinInterval(saleDate, { start, end });
    });
    
    return {
      totalSales: yesterdaySales.length,
      totalRevenue: yesterdaySales.reduce((sum, sale) => sum + sale.total, 0),
    };
  }, [allSales]);

  // Get top products from last 7 days
  const topProducts = useMemo(() => {
    const startDate = subDays(new Date(), 7);
    const recentSales = allSales.filter(
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
      .slice(0, 10);
  }, [allSales]);

  // Calculate daily data for chart
  const dailyData = useMemo(() => {
    const days = eachDayOfInterval({
      start: new Date(dateRange.start),
      end: new Date(dateRange.end),
    });
    
    return days.map((day) => {
      const start = startOfDay(day);
      const end = endOfDay(day);
      
      const daySales = allSales.filter((sale) => {
        const saleDate = new Date(sale.createdAt);
        return isWithinInterval(saleDate, { start, end });
      });
      
      return {
        date: format(day, 'MMM d'),
        revenue: daySales.reduce((sum, sale) => sum + sale.total, 0),
        sales: daySales.length,
      };
    });
  }, [dateRange, allSales]);

  const totalRevenue = useMemo(
    () => sales.reduce((sum, sale) => sum + sale.total, 0),
    [sales]
  );
  const totalSales = sales.length;
  const averageOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;

  const revenueChange =
    yesterdaySummary.totalRevenue > 0
      ? ((todaySummary.totalRevenue - yesterdaySummary.totalRevenue) /
          yesterdaySummary.totalRevenue) *
        100
      : 0;

  const handleExportCSV = () => {
    const headers = ['ID', 'Date', 'Items', 'Subtotal', 'Tax', 'Total', 'Payment', 'Customer', 'Cashier'];
    const rows = sales.map((sale) => [
      sale.id,
      safeFormat(sale.createdAt, 'yyyy-MM-dd HH:mm:ss'),
      sale.items.length,
      sale.subtotal.toFixed(2),
      sale.tax.toFixed(2),
      sale.total.toFixed(2),
      sale.paymentMethod,
      sale.customerName || 'Walk-in',
      sale.cashierName,
    ]);

    const csv = [headers, ...rows].map((row) => row.map(escapeCSV).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-report-${dateRange.start}-to-${dateRange.end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report exported successfully');
  };

  const handlePrintReceipt = () => {
    if (receiptRef.current) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Receipt</title>
              <style>
                @page { margin: 0; size: 80mm auto; }
                body { font-family: monospace; padding: 4mm; }
                @media print { body { padding: 0; } }
              </style>
            </head>
            <body>
              ${receiptRef.current.innerHTML}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  // Find max value for chart scaling
  const maxRevenue = Math.max(...dailyData.map((d) => d.revenue), 1);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
            <p className="text-gray-600">Sales analytics and transaction history</p>
          </div>
          <Button onClick={handleExportCSV}>
            <Download className="w-4 h-4" />
            Export Report
          </Button>
        </div>

        {/* Date Range */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Date Range:</span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              />
              <span className="text-gray-500">to</span>
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setDateRange({
                    start: format(new Date(), 'yyyy-MM-dd'),
                    end: format(new Date(), 'yyyy-MM-dd'),
                  });
                }}
                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Today
              </button>
              <button
                onClick={() => {
                  setDateRange({
                    start: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
                    end: format(new Date(), 'yyyy-MM-dd'),
                  });
                }}
                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Last 7 days
              </button>
              <button
                onClick={() => {
                  setDateRange({
                    start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
                    end: format(new Date(), 'yyyy-MM-dd'),
                  });
                }}
                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Last 30 days
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Today's Revenue</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {$c(todaySummary.totalRevenue)}
                </p>
                <div
                  className={`flex items-center gap-1 mt-2 text-sm ${
                    revenueChange >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {revenueChange >= 0 ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4" />
                  )}
                  <span>{Math.abs(revenueChange).toFixed(1)}% vs yesterday</span>
                </div>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Period Revenue</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {$c(totalRevenue)}
                </p>
                <p className="text-sm text-gray-500 mt-2">{totalSales} transactions</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Average Order</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {$c(averageOrderValue)}
                </p>
                <p className="text-sm text-gray-500 mt-2">Per transaction</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <ShoppingCart className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Today's Sales</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {todaySummary.totalSales}
                </p>
                <p className="text-sm text-gray-500 mt-2">Transactions</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <ShoppingCart className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue Chart */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend</h2>
            <div className="h-64 flex items-end gap-2">
              {dailyData.map((day, index) => (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div className="w-full flex flex-col items-center justify-end h-48">
                    <div
                      className="w-full max-w-8 bg-blue-500 rounded-t-md transition-all hover:bg-blue-600"
                      style={{
                        height: `${(day.revenue / maxRevenue) * 100}%`,
                        minHeight: day.revenue > 0 ? '4px' : '0px',
                      }}
                      title={`${day.date}: ${$c(day.revenue)}`}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2 whitespace-nowrap">{day.date}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Methods */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Methods</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Banknote className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-green-900">Cash</span>
                </div>
                <span className="font-bold text-green-900">
                  {$c(todaySummary.paymentBreakdown.cash)}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-blue-900">M-Pesa</span>
                </div>
                <span className="font-bold text-blue-900">
                  {$c(todaySummary.paymentBreakdown.mpesa)}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-purple-600" />
                  <span className="font-medium text-purple-900">Card</span>
                </div>
                <span className="font-bold text-purple-900">
                  {$c(todaySummary.paymentBreakdown.card)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Products */}
          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Top Products (7 days)</h2>
            </div>
            <div className="divide-y max-h-96 overflow-y-auto">
              {topProducts.length === 0 ? (
                <div className="p-6 text-center text-gray-500">No sales data available</div>
              ) : (
                topProducts.map((product, index) => (
                  <div key={product.productId} className="p-4 flex items-center gap-4">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-semibold text-gray-600">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{product.productName}</p>
                      <p className="text-sm text-gray-500">{product.quantitySold} sold</p>
                    </div>
                    <p className="font-semibold text-gray-900">
                      {$c(product.revenue)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Recent Transactions</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-6 py-3 text-sm font-semibold text-gray-600">
                      ID
                    </th>
                    <th className="text-left px-6 py-3 text-sm font-semibold text-gray-600">
                      Date
                    </th>
                    <th className="text-center px-6 py-3 text-sm font-semibold text-gray-600">
                      Items
                    </th>
                    <th className="text-right px-6 py-3 text-sm font-semibold text-gray-600">
                      Total
                    </th>
                    <th className="text-center px-6 py-3 text-sm font-semibold text-gray-600">
                      Payment
                    </th>
                    <th className="text-right px-6 py-3 text-sm font-semibold text-gray-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sales.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                        <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No transactions found</p>
                      </td>
                    </tr>
                  ) : (
                    sales.slice(0, 10).map((sale) => (
                      <tr key={sale.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-mono text-gray-600">
                          #{(sale.id ?? '').slice(0, 8).toUpperCase()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {safeFormat(sale.createdAt, 'MMM d, HH:mm')}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 text-center">
                          {sale.items.length}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">
                          {$c(sale.total)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              sale.paymentMethod === 'cash'
                                ? 'bg-green-100 text-green-700'
                                : sale.paymentMethod === 'mpesa'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-purple-100 text-purple-700'
                            }`}
                          >
                            {sale.paymentMethod.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setSelectedSale(sale);
                                setReceiptModalOpen(true);
                              }}
                              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                              title="View Receipt"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Receipt Modal */}
      <Modal
        isOpen={receiptModalOpen}
        onClose={() => {
          setReceiptModalOpen(false);
          setSelectedSale(null);
        }}
        title="Transaction Receipt"
        size="lg"
      >
        <div className="p-6">
          {selectedSale && (
            <>
              <div className="border rounded-lg overflow-hidden mb-4">
                <div className="max-h-96 overflow-y-auto flex justify-center bg-gray-50 p-4">
                  <Receipt ref={receiptRef} sale={selectedSale} type="thermal" />
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setReceiptModalOpen(false);
                    setSelectedSale(null);
                  }}
                  className="flex-1"
                >
                  Close
                </Button>
                <Button onClick={handlePrintReceipt} className="flex-1">
                  <Printer className="w-4 h-4" />
                  Print Receipt
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </Layout>
  );
}
