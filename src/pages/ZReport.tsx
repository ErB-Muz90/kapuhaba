import { useState, useMemo } from 'react';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { useShiftStore } from '../store/shiftStore';
import { useSaleStore } from '../store/saleStore';
import { useFormatCurrency, escapeCSV, safeFormat } from '../utils/format';
import {
  FileText,
  Printer,
  Download,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  AlertTriangle,
  Banknote,
  Smartphone,
  CreditCard,
  Building2,
  Clock,
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import toast from 'react-hot-toast';

export function ZReport() {
  const $c = useFormatCurrency();
  const [reportDate, setReportDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { shifts, getShiftSummary } = useShiftStore();
  const { sales } = useSaleStore();

  // Shifts for selected date
  const dailyShifts = useMemo(() => {
    const start = new Date(reportDate); start.setHours(0, 0, 0, 0);
    const end = new Date(reportDate); end.setHours(23, 59, 59, 999);
    return shifts.filter(s => {
      const d = new Date(s.startedAt);
      return d >= start && d <= end;
    });
  }, [shifts, reportDate]);

  // Sales for selected date
  const dailySales = useMemo(() => {
    const start = new Date(reportDate); start.setHours(0, 0, 0, 0);
    const end = new Date(reportDate); end.setHours(23, 59, 59, 999);
    return sales.filter(s => {
      const d = new Date(s.createdAt);
      return d >= start && d <= end;
    });
  }, [sales, reportDate]);

  const salesBreakdown = useMemo(() => ({
    count: dailySales.length,
    total: dailySales.reduce((s, x) => s + x.total, 0),
    cash: dailySales.filter(s => s.paymentMethod === 'cash').reduce((sum, x) => sum + x.total, 0),
    mpesa: dailySales.filter(s => s.paymentMethod === 'mpesa').reduce((sum, x) => sum + x.total, 0),
    card: dailySales.filter(s => s.paymentMethod === 'card').reduce((sum, x) => sum + x.total, 0),
  }), [dailySales]);

  // Per-shift summaries
  const shiftRows = useMemo(() =>
    dailyShifts.map(shift => {
      const summary = getShiftSummary(shift.id);
      return { shift, summary };
    }),
  [dailyShifts, getShiftSummary]);

  // Grand totals
  const grand = useMemo(() =>
    shiftRows.reduce((acc, { summary }) => ({
      openingFloat: acc.openingFloat + summary.openingFloat,
      cashSales: acc.cashSales + summary.cashSales,
      cashPaidIn: acc.cashPaidIn + summary.cashPaidIn,
      cashPaidOut: acc.cashPaidOut + summary.cashPaidOut,
      cashBanked: acc.cashBanked + summary.cashBanked,
      expectedCash: acc.expectedCash + summary.expectedCash,
      actualCash: acc.actualCash + summary.actualCash,
      variance: acc.variance + summary.variance,
      toBank: acc.toBank + summary.toBank,
      retainedFloat: acc.retainedFloat + summary.retainedFloat,
    }), { openingFloat: 0, cashSales: 0, cashPaidIn: 0, cashPaidOut: 0, cashBanked: 0, expectedCash: 0, actualCash: 0, variance: 0, toBank: 0, retainedFloat: 0 }),
  [shiftRows]);

  const handleExportCSV = () => {
    const h = ['Shift', 'Cashier', 'Start', 'End', 'Float', 'Cash Sales', 'Cash In', 'Cash Out', 'Banked', 'Expected', 'Actual', 'Variance'];
    const rows = shiftRows.map(({ shift, summary }) => [
      (shift.id ?? '').slice(0, 8), shift.staffName,
      safeFormat(shift.startedAt, 'HH:mm'), shift.endedAt ? safeFormat(shift.endedAt, 'HH:mm') : 'OPEN',
      summary.openingFloat, summary.cashSales, summary.cashPaidIn, summary.cashPaidOut,
      summary.cashBanked, summary.expectedCash, summary.actualCash, summary.variance,
    ]);
    const csv = [h, ...rows].map(r => r.map(escapeCSV).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Z-Report-${reportDate}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported');
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Z-Report</h1>
            <p className="text-gray-600">End-of-day financial summary</p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={handleExportCSV}><Download className="w-4 h-4" /> CSV</Button>
            <Button onClick={() => window.print()}><Printer className="w-4 h-4" /> Print</Button>
          </div>
        </div>

        {/* Date picker */}
        <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-wrap items-center gap-4">
          <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg" />
          <Button variant="ghost" onClick={() => setReportDate(format(new Date(), 'yyyy-MM-dd'))}>Today</Button>
          <Button variant="ghost" onClick={() => setReportDate(format(subDays(new Date(), 1), 'yyyy-MM-dd'))}>Yesterday</Button>
          <span className="text-lg font-bold text-gray-900 ml-auto">
            {format(new Date(reportDate), 'EEEE, MMMM d, yyyy')}
          </span>
        </div>

        {dailyShifts.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <FileText className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Shifts Found</h3>
            <p className="text-gray-500">No shifts were recorded on this date.</p>
          </div>
        ) : (
          <>
            {/* Sales Summary */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Sales Summary</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl text-center">
                  <p className="text-xs text-gray-500 uppercase">Transactions</p>
                  <p className="text-2xl font-extrabold text-gray-900">{salesBreakdown.count}</p>
                </div>
                <div className="p-4 bg-green-50 rounded-xl text-center">
                  <p className="text-xs text-green-600 uppercase flex items-center justify-center gap-1"><Banknote className="w-3 h-3" /> Cash</p>
                  <p className="text-2xl font-extrabold text-green-800">{$c(salesBreakdown.cash)}</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-xl text-center">
                  <p className="text-xs text-blue-600 uppercase flex items-center justify-center gap-1"><Smartphone className="w-3 h-3" /> M-Pesa</p>
                  <p className="text-2xl font-extrabold text-blue-800">{$c(salesBreakdown.mpesa)}</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-xl text-center">
                  <p className="text-xs text-purple-600 uppercase flex items-center justify-center gap-1"><CreditCard className="w-3 h-3" /> Card</p>
                  <p className="text-2xl font-extrabold text-purple-800">{$c(salesBreakdown.card)}</p>
                </div>
                <div className="p-4 bg-gray-900 rounded-xl text-center text-white">
                  <p className="text-xs uppercase opacity-80">Total Revenue</p>
                  <p className="text-2xl font-extrabold">{$c(salesBreakdown.total)}</p>
                </div>
              </div>
            </div>

            {/* Cash Drawer Summary */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Banknote className="w-4 h-4 text-green-600" /> Cash Drawer Summary (Physical Cash Only)
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-500 uppercase">Opening Float</p>
                  <p className="text-2xl font-extrabold text-gray-900">{$c(grand.openingFloat)}</p>
                </div>
                <div className="p-4 bg-green-50 rounded-xl">
                  <p className="text-xs text-green-600 uppercase flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Cash In</p>
                  <p className="text-2xl font-extrabold text-green-800">{$c(grand.cashPaidIn)}</p>
                </div>
                <div className="p-4 bg-red-50 rounded-xl">
                  <p className="text-xs text-red-600 uppercase flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Cash Out</p>
                  <p className="text-2xl font-extrabold text-red-800">{$c(grand.cashPaidOut)}</p>
                </div>
                <div className="p-4 bg-orange-50 rounded-xl">
                  <p className="text-xs text-orange-600 uppercase flex items-center gap-1"><Building2 className="w-3 h-3" /> Banked</p>
                  <p className="text-2xl font-extrabold text-orange-800">{$c(grand.cashBanked)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div className="p-4 bg-blue-50 rounded-xl">
                  <p className="text-xs text-blue-600 uppercase">Expected Cash</p>
                  <p className="text-2xl font-extrabold text-blue-800">{$c(grand.expectedCash)}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-500 uppercase">Actual Cash</p>
                  <p className="text-2xl font-extrabold text-gray-900">{$c(grand.actualCash)}</p>
                </div>
                <div className={`p-4 rounded-xl ${grand.variance === 0 ? 'bg-green-50' : Math.abs(grand.variance) <= 100 ? 'bg-yellow-50' : 'bg-red-50'}`}>
                  <p className="text-xs text-gray-600 uppercase flex items-center gap-1">
                    {grand.variance === 0 ? <CheckCircle className="w-3 h-3 text-green-600" /> : <AlertTriangle className="w-3 h-3 text-yellow-600" />} Variance
                  </p>
                  <p className={`text-2xl font-extrabold ${grand.variance === 0 ? 'text-green-700' : Math.abs(grand.variance) <= 100 ? 'text-yellow-700' : 'text-red-700'}`}>
                    {grand.variance >= 0 ? '+' : ''}{$c(grand.variance)}
                  </p>
                </div>
                <div className="p-4 bg-amber-50 rounded-xl">
                  <p className="text-xs text-amber-600 uppercase">Retained Float</p>
                  <p className="text-2xl font-extrabold text-amber-800">{$c(grand.retainedFloat)}</p>
                </div>
              </div>
            </div>

            {/* Per-Shift Table */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="p-6 border-b">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Shift Breakdown
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-gray-500">Cashier</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-500">Time</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-500">Status</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-500">Float</th>
                      <th className="text-right px-4 py-3 font-semibold text-green-600">Cash In</th>
                      <th className="text-right px-4 py-3 font-semibold text-red-600">Cash Out</th>
                      <th className="text-right px-4 py-3 font-semibold text-orange-600">Banked</th>
                      <th className="text-right px-4 py-3 font-semibold text-blue-600">Expected</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-500">Actual</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-500">Variance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {shiftRows.map(({ shift, summary }) => (
                      <tr key={shift.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{shift.staffName}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {safeFormat(shift.startedAt, 'HH:mm')}
                          {shift.endedAt ? ` – ${safeFormat(shift.endedAt, 'HH:mm')}` : ''}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${shift.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                            {shift.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">{$c(summary.openingFloat)}</td>
                        <td className="px-4 py-3 text-right text-green-600 font-semibold">{$c(summary.cashPaidIn)}</td>
                        <td className="px-4 py-3 text-right text-red-600 font-semibold">{$c(summary.cashPaidOut)}</td>
                        <td className="px-4 py-3 text-right text-orange-600 font-semibold">{$c(summary.cashBanked)}</td>
                        <td className="px-4 py-3 text-right text-blue-600 font-bold">{$c(summary.expectedCash)}</td>
                        <td className="px-4 py-3 text-right">{$c(summary.actualCash)}</td>
                        <td className={`px-4 py-3 text-right font-bold ${summary.variance === 0 ? 'text-green-600' : summary.variance > 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {summary.variance >= 0 ? '+' : ''}{$c(summary.variance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
