import { useState, useMemo, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useShiftStore } from '../store/shiftStore';
import { useSaleStore } from '../store/saleStore';
import { useSettingsStore } from '../store/settingsStore';
import { useFormatCurrency } from '../utils/format';
import { useAuthStore } from '../store/authStore';
import { hasPermission } from '../permissions';
import {
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  History,
  Plus,
  Building2,
  Smartphone,
  Banknote,
  CreditCard,
  Package,
  Timer,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, differenceInMinutes } from 'date-fns';

export function ShiftManagement() {
  const $c = useFormatCurrency();
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [endModalOpen, setEndModalOpen] = useState(false);
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [floatAmount, setFloatAmount] = useState(0);
  const [closingCash, setClosingCash] = useState(0);
  const [txLogTab, setTxLogTab] = useState<'all' | 'cash' | 'digital'>('all');
  const [txForm, setTxForm] = useState({
    type: 'paid_in' as 'paid_in' | 'paid_out' | 'bank_deposit',
    amount: 0,
    notes: '',
  });
  const [elapsed, setElapsed] = useState('');

  const {
    startShift, endShift, getActiveShift, addCashDrawerTransaction,
    getCashDrawerBalance, getCashDrawerHistory, getShiftSummary, createSession,
  } = useShiftStore();
  const sales = useSaleStore((s) => s.sales);
  const settings = useSettingsStore((s) => s.settings);
  const user = useAuthStore((s) => s.user);
  const canManageShifts = hasPermission(user?.role, 'shifts.manage');

  const activeShift = getActiveShift();
  const cashBalance = activeShift ? getCashDrawerBalance(activeShift.id) : 0;
  const summary = activeShift ? getShiftSummary(activeShift.id) : null;

  // Shift sales by payment method
  const shiftSales = useMemo(() => {
    if (!activeShift) return { total: 0, cash: 0, mpesa: 0, card: 0, count: 0 };
    const shiftStart = new Date(activeShift.startedAt);
    return sales.filter((s) => new Date(s.createdAt) >= shiftStart).reduce(
      (acc, sale) => {
        acc.total += sale.total;
        acc.count++;
        if (sale.paymentMethod === 'cash') acc.cash += sale.total;
        else if (sale.paymentMethod === 'mpesa') acc.mpesa += sale.total;
        else if (sale.paymentMethod === 'card') acc.card += sale.total;
        return acc;
      },
      { total: 0, cash: 0, mpesa: 0, card: 0, count: 0 }
    );
  }, [sales, activeShift]);

  // Filtered transaction log
  const txLog = useMemo(() => {
    if (!activeShift) return [];
    const all = getCashDrawerHistory(activeShift.id);
    if (txLogTab === 'cash') return all.filter(t => t.method === 'cash');
    if (txLogTab === 'digital') return all.filter(t => t.method !== 'cash');
    return all;
  }, [activeShift, txLogTab, getCashDrawerHistory]);

  // Timer
  useEffect(() => {
    if (!activeShift) { setElapsed(''); return; }
    const tick = () => {
      const mins = differenceInMinutes(new Date(), new Date(activeShift.startedAt));
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      setElapsed(`${h}h ${m}m`);
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [activeShift]);

  const handleStartShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    startShift(user.id, user.username, 'TERMINAL-001', floatAmount);
    createSession(user.id, user.username, 'TERMINAL-001');
    toast.success(`Shift started · Float ${$c(floatAmount)}`);
    setStartModalOpen(false);
    setFloatAmount(0);
  };

  const handleEndShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift || !summary) return;
    endShift(activeShift.id, closingCash);
    toast.success('Shift closed');
    setEndModalOpen(false);
    setClosingCash(0);
  };

  const handleTx = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift || txForm.amount <= 0) { toast.error('Enter valid amount'); return; }
    const result = addCashDrawerTransaction(
      activeShift.id, txForm.type, txForm.amount, 'cash',
      txForm.notes || txForm.type.replace('_', ' '),
      undefined, 'other'
    );
    if (!result) { toast.error('Insufficient cash in drawer'); return; }
    toast.success('Transaction recorded');
    setTxModalOpen(false);
    setTxForm({ type: 'paid_in', amount: 0, notes: '' });
  };

  const varianceAmount = summary ? closingCash - summary.expectedCash : 0;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Shift Management</h1>
            <p className="text-gray-600">Cash drawer & shift control</p>
          </div>
          {!activeShift ? (
            canManageShifts && (
              <Button onClick={() => { setFloatAmount(settings.defaultFloat); setStartModalOpen(true); }}>
                <Clock className="w-4 h-4" /> Start Shift
              </Button>
            )
          ) : (
            canManageShifts && (
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setTxModalOpen(true)}>
                  <Plus className="w-4 h-4" /> Cash In / Out
                </Button>
                <Button variant="danger" onClick={() => { setClosingCash(0); setEndModalOpen(true); }}>
                  <XCircle className="w-4 h-4" /> End Shift
                </Button>
              </div>
            )
          )}
        </div>

        {/* No Shift */}
        {!activeShift && (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <Clock className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Active Shift</h3>
            <p className="text-gray-500 mb-6">Start a shift to begin processing sales</p>
            {canManageShifts && (
              <Button size="lg" onClick={() => { setFloatAmount(settings.defaultFloat); setStartModalOpen(true); }}>
                <Clock className="w-5 h-5" /> Start New Shift
              </Button>
            )}
          </div>
        )}

        {/* === ACTIVE SHIFT === */}
        {activeShift && summary && (
          <>
            {/* 1. SHIFT HEADER */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 text-white">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
                    <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold">{activeShift.staffName}</span>
                      <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-semibold rounded-full">ACTIVE</span>
                    </div>
                    <p className="text-slate-400 text-sm">
                      Started {format(new Date(activeShift.startedAt), 'MMM d, yyyy · HH:mm')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Duration</p>
                    <p className="text-lg font-bold flex items-center gap-1"><Timer className="w-4 h-4" /> {elapsed || '0h 0m'}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Transactions</p>
                    <p className="text-lg font-bold">{shiftSales.count}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Total Sales</p>
                    <p className="text-lg font-bold">{$c(shiftSales.total)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. SALES PANEL + CASH DRAWER + BANKING */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 2a. SALES PANEL (ALL PAYMENT METHODS) */}
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Package className="w-4 h-4" /> Sales Summary
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <Banknote className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Cash</p>
                        <p className="text-xl font-bold text-green-700">{$c(shiftSales.cash)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Smartphone className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">M-Pesa</p>
                        <p className="text-xl font-bold text-blue-700">{$c(shiftSales.mpesa)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Card</p>
                        <p className="text-xl font-bold text-purple-700">{$c(shiftSales.card)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="border-t pt-3 flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span>{$c(shiftSales.total)}</span>
                  </div>
                </div>
              </div>

              {/* 2b. CASH DRAWER (PHYSICAL CASH ONLY) */}
              <div className="bg-white rounded-2xl shadow-sm p-6 border-2 border-green-200">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-green-600" /> Cash Drawer
                  <span className="ml-auto px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full">PHYSICAL CASH ONLY</span>
                </h3>
                <div className="text-center mb-5">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Balance</p>
                  <p className="text-4xl font-extrabold text-gray-900 mt-1">{$c(cashBalance)}</p>
                </div>
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between py-1.5">
                    <span className="text-gray-600">Opening Float</span>
                    <span className="font-semibold">{$c(summary.openingFloat)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 text-green-600">
                    <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Cash Sales</span>
                    <span className="font-semibold">+{$c(summary.cashSales)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 text-green-600">
                    <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Other Cash In</span>
                    <span className="font-semibold">+{$c(Math.max(0, summary.cashPaidIn - summary.cashSales))}</span>
                  </div>
                  <div className="flex justify-between py-1.5 text-red-600">
                    <span className="flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Cash Out / Expenses</span>
                    <span className="font-semibold">-{$c(summary.cashPaidOut)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 text-orange-600">
                    <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> Banked</span>
                    <span className="font-semibold">-{$c(summary.cashBanked)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-bold">
                    <span>Expected Cash</span>
                    <span>{$c(summary.expectedCash)}</span>
                  </div>
                </div>
              </div>

              {/* 2c. BANKING & FLOAT */}
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Building2 className="w-4 h-4" /> Banking & Float
                </h3>
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-xl">
                    <p className="text-xs text-blue-600 font-semibold uppercase">To Bank</p>
                    <p className="text-3xl font-extrabold text-blue-800 mt-1">{$c(summary.toBank)}</p>
                    <p className="text-xs text-blue-600 mt-1">Expected cash minus retained float</p>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-xl">
                    <p className="text-xs text-amber-600 font-semibold uppercase">Retained Float</p>
                    <p className="text-3xl font-extrabold text-amber-800 mt-1">{$c(summary.retainedFloat)}</p>
                    <p className="text-xs text-amber-600 mt-1">Carries forward to next shift</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl text-sm">
                    <p className="text-gray-500">M-Pesa collected (not in drawer)</p>
                    <p className="font-bold text-gray-900">{$c(summary.mpesaTotal)}</p>
                    <p className="text-gray-500 mt-2">Card collected (not in drawer)</p>
                    <p className="font-bold text-gray-900">{$c(summary.cardTotal)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. TRANSACTION LOG */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="p-6 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <History className="w-5 h-5 text-gray-400" /> Transaction Log
                </h2>
                <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                  {(['all', 'cash', 'digital'] as const).map(tab => (
                    <button key={tab} onClick={() => setTxLogTab(tab)}
                      className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${txLogTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >{tab}</button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto max-h-96">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Method</th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Amount</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Reference</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {txLog.length === 0 ? (
                      <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">No transactions yet</td></tr>
                    ) : txLog.map(tx => {
                      const isIn = tx.type === 'paid_in' || tx.type === 'mpesa_deposit';
                      return (
                        <tr key={tx.id} className="hover:bg-gray-50">
                          <td className="px-6 py-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full ${isIn ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {isIn ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {tx.type.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-3">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${tx.method === 'cash' ? 'bg-green-50 text-green-700' : tx.method === 'mpesa' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                              {tx.method}
                            </span>
                          </td>
                          <td className={`px-6 py-3 text-right font-semibold ${isIn ? 'text-green-600' : 'text-red-600'}`}>
                            {isIn ? '+' : '-'}{$c(tx.amount)}
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-500 truncate max-w-[200px]">{tx.notes || '-'}</td>
                          <td className="px-6 py-3 text-sm text-gray-500">{format(new Date(tx.createdAt), 'HH:mm:ss')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* === MODALS === */}

      {/* Start Shift */}
      <Modal isOpen={startModalOpen} onClose={() => setStartModalOpen(false)} title="Start Shift" size="sm">
        <form onSubmit={handleStartShift} className="p-6 space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
            Enter the cash amount physically placed in the drawer.
          </div>
          <Input label="Opening Float" type="number" value={floatAmount}
            onChange={(e) => setFloatAmount(parseFloat(e.target.value) || 0)}
            placeholder="0.00" min="0" step="0.01" required
          />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setStartModalOpen(false)} className="flex-1">Cancel</Button>
            <Button type="submit" className="flex-1"><Clock className="w-4 h-4" /> Start</Button>
          </div>
        </form>
      </Modal>

      {/* End Shift */}
      <Modal isOpen={endModalOpen} onClose={() => setEndModalOpen(false)} title="End Shift · Cash Count" size="lg">
        {activeShift && summary && (
          <form onSubmit={handleEndShift} className="p-6 space-y-5">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl text-sm">
              <div><p className="text-gray-500">Opening Float</p><p className="font-bold text-lg">{$c(summary.openingFloat)}</p></div>
              <div><p className="text-gray-500">Cash Sales</p><p className="font-bold text-lg text-green-700">{$c(summary.cashSales)}</p></div>
              <div><p className="text-gray-500">Cash Paid Out</p><p className="font-bold text-lg text-red-700">{$c(summary.cashPaidOut)}</p></div>
              <div><p className="text-gray-500">Banked</p><p className="font-bold text-lg text-orange-700">{$c(summary.cashBanked)}</p></div>
            </div>

            <div className="p-4 bg-blue-50 rounded-xl">
              <p className="text-sm text-blue-700">Expected Cash in Drawer</p>
              <p className="text-3xl font-extrabold text-blue-900">{$c(summary.expectedCash)}</p>
            </div>

            {/* Cash count input */}
            <div className="p-4 border-2 border-dashed border-gray-300 rounded-xl">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Count the physical cash and enter total below
              </label>
              <input type="number" value={closingCash}
                onChange={(e) => setClosingCash(parseFloat(e.target.value) || 0)}
                placeholder="0.00" min="0" step="0.01" required
                className="w-full px-4 py-3 text-2xl font-bold text-center border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Variance */}
            {(closingCash > 0 || summary?.expectedCash === 0) && (
              <div className={`p-4 rounded-xl flex items-center gap-3 ${
                varianceAmount === 0 ? 'bg-green-50 border border-green-200' :
                Math.abs(varianceAmount) <= 100 ? 'bg-yellow-50 border border-yellow-200' :
                'bg-red-50 border border-red-200'
              }`}>
                {varianceAmount === 0 ? <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" /> :
                 <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0" />}
                <div>
                  <p className="font-bold text-lg">
                    Variance: {varianceAmount >= 0 ? '+' : ''}{$c(varianceAmount)}
                  </p>
                  <p className="text-sm text-gray-600">
                    {varianceAmount === 0 ? 'Perfect match!' :
                     varianceAmount > 0 ? 'Over — investigate excess cash' :
                     'Short — investigate missing cash'}
                  </p>
                </div>
              </div>
            )}

            {/* Non-cash summary */}
            <div className="p-4 bg-gray-50 rounded-xl text-sm">
              <p className="font-semibold text-gray-700 mb-2">Digital Payments (not in drawer)</p>
              <div className="flex gap-6">
                <div><span className="text-gray-500">M-Pesa:</span> <span className="font-bold text-blue-700">{$c(shiftSales.mpesa)}</span></div>
                <div><span className="text-gray-500">Card:</span> <span className="font-bold text-purple-700">{$c(shiftSales.card)}</span></div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => setEndModalOpen(false)} className="flex-1">Cancel</Button>
              <Button type="submit" variant="danger" className="flex-1" disabled={closingCash < 0}>
                <XCircle className="w-4 h-4" /> Close Shift
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Cash In / Out */}
      <Modal isOpen={txModalOpen} onClose={() => setTxModalOpen(false)} title="Cash Drawer Transaction" size="sm">
        <form onSubmit={handleTx} className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {([
              { type: 'paid_in' as const, label: 'Cash In', color: 'green' },
              { type: 'paid_out' as const, label: 'Cash Out', color: 'red' },
              { type: 'bank_deposit' as const, label: 'To Bank', color: 'blue' },
            ]).map(opt => (
              <button key={opt.type} type="button" onClick={() => setTxForm({ ...txForm, type: opt.type })}
                className={`p-3 rounded-xl border-2 text-center text-sm font-semibold transition-colors ${
                  txForm.type === opt.type
                    ? `border-${opt.color}-500 bg-${opt.color}-50 text-${opt.color}-700`
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
                style={txForm.type === opt.type ? {
                  borderColor: opt.color === 'green' ? '#22c55e' : opt.color === 'red' ? '#ef4444' : '#3b82f6',
                  backgroundColor: opt.color === 'green' ? '#f0fdf4' : opt.color === 'red' ? '#fef2f2' : '#eff6ff',
                  color: opt.color === 'green' ? '#15803d' : opt.color === 'red' ? '#b91c1c' : '#1d4ed8',
                } : {}}
              >{opt.label}</button>
            ))}
          </div>

          <Input label="Amount" type="number" value={txForm.amount || ''}
            onChange={(e) => setTxForm({ ...txForm, amount: parseFloat(e.target.value) || 0 })}
            placeholder="0.00" min="0.01" step="0.01" required
          />

          {(txForm.type === 'paid_out' || txForm.type === 'bank_deposit') && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              Available cash: <strong>{$c(cashBalance)}</strong>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={txForm.notes} onChange={(e) => setTxForm({ ...txForm, notes: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm" rows={2} placeholder="Reason..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setTxModalOpen(false)} className="flex-1">Cancel</Button>
            <Button type="submit" className="flex-1">Record</Button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
