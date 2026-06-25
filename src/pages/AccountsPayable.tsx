import { useState, useMemo, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { useAccountsPayableStore } from '../store/accountsPayableStore';
import { useSupplierStore } from '../store/supplierStore';
import { useFormatCurrency } from '../utils/format';
import { useAuthStore } from '../store/authStore';
import { hasPermission } from '../permissions';
import type { AccountPayable, PayableStatus } from '../types';
import {
  Search,
  Plus,
  CreditCard,
  AlertTriangle,
  Clock,
  CheckCircle,
  DollarSign,
  Calendar,
  Building2,
  FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, addDays } from 'date-fns';

export function AccountsPayable() {
  const $c = useFormatCurrency();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedPayable, setSelectedPayable] = useState<AccountPayable | null>(null);
  const [formData, setFormData] = useState({
    supplierId: '',
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    amount: 0,
    notes: '',
  });
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    method: 'bank_transfer' as 'cash' | 'bank_transfer' | 'cheque' | 'mpesa',
    reference: '',
  });

  const { 
    payables, 
    payments,
    fetch: fetchPayables,
    fetchPayments,
    createPayable, 
    recordPayment, 
    getPayablePayments,
    getOverduePayables, 
    getTotalOutstanding, 
    getTotalOverdue,
    getAgingReport,
    updateOverdueStatuses,
  } = useAccountsPayableStore();
  const { suppliers, getSupplier } = useSupplierStore();
  const { user } = useAuthStore();
  const canManageAP = hasPermission(user?.role, 'accounts_payable.manage');

  // Fetch data on mount
  useEffect(() => {
    fetchPayables();
    fetchPayments();
  }, [fetchPayables, fetchPayments]);

  // Update overdue statuses on mount
  useEffect(() => {
    updateOverdueStatuses();
  }, [updateOverdueStatuses]);

  const filteredPayables = useMemo(() => {
    let result = payables;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.invoiceNumber.toLowerCase().includes(query) ||
          p.supplierName.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter((p) => p.status === statusFilter);
    }

    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [payables, searchQuery, statusFilter]);

  const totalOutstanding = useMemo(() => getTotalOutstanding(), [payables]);
  const totalOverdue = useMemo(() => getTotalOverdue(), [payables]);
  const overdueCount = useMemo(() => getOverduePayables().length, [payables]);
  const agingReport = useMemo(() => getAgingReport(), [payables]);

  const handleCreatePayable = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.supplierId || !formData.invoiceNumber || formData.amount <= 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    const supplier = getSupplier(formData.supplierId);
    if (!supplier) return;

    const dueDate = addDays(new Date(formData.invoiceDate), supplier.paymentTerms);

    createPayable({
      supplierId: formData.supplierId,
      supplierName: supplier.name,
      invoiceNumber: formData.invoiceNumber,
      invoiceDate: formData.invoiceDate,
      dueDate: dueDate.toISOString().split('T')[0],
      amount: formData.amount,
      notes: formData.notes || undefined,
    });

    toast.success('Invoice added successfully');
    setCreateModalOpen(false);
    setFormData({
      supplierId: '',
      invoiceNumber: '',
      invoiceDate: new Date().toISOString().split('T')[0],
      amount: 0,
      notes: '',
    });
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPayable || paymentData.amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (paymentData.amount > selectedPayable.balance) {
      toast.error('Payment amount cannot exceed balance');
      return;
    }

    try {
      await recordPayment(
        selectedPayable.id,
        paymentData.amount,
        paymentData.method,
        paymentData.reference,
        user?.username || 'Unknown'
      );
      toast.success('Payment recorded successfully');
      setPaymentModalOpen(false);
      setSelectedPayable(null);
      setPaymentData({ amount: 0, method: 'bank_transfer', reference: '' });
    } catch (err: any) {
      toast.error(err?.message || 'Payment failed');
    }
  };

  const openPaymentModal = (payable: AccountPayable) => {
    setSelectedPayable(payable);
    setPaymentData({ amount: payable.balance, method: 'bank_transfer', reference: '' });
    setPaymentModalOpen(true);
  };

  const getStatusColor = (status: PayableStatus) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'partial': return 'bg-blue-100 text-blue-700';
      case 'paid': return 'bg-green-100 text-green-700';
      case 'overdue': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Accounts Payable</h1>
            <p className="text-gray-600">Manage supplier invoices and payments</p>
          </div>
          {canManageAP && (
            <Button onClick={() => setCreateModalOpen(true)}>
              <Plus className="w-4 h-4" />
              Add Invoice
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Outstanding</p>
                <p className="text-xl font-bold text-gray-900">{$c(totalOutstanding)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Overdue</p>
                <p className="text-xl font-bold text-red-600">{$c(totalOverdue)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Overdue Invoices</p>
                <p className="text-xl font-bold text-gray-900">{overdueCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <FileText className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Invoices</p>
                <p className="text-xl font-bold text-gray-900">{payables.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Aging Report */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Aging Report</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-green-700">Current</p>
              <p className="text-xl font-bold text-green-800">{$c(agingReport.current)}</p>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg">
              <p className="text-sm text-yellow-700">1-30 Days</p>
              <p className="text-xl font-bold text-yellow-800">{$c(agingReport.days30)}</p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <p className="text-sm text-orange-700">31-60 Days</p>
              <p className="text-xl font-bold text-orange-800">{$c(agingReport.days60)}</p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg">
              <p className="text-sm text-red-700">60+ Days</p>
              <p className="text-xl font-bold text-red-800">{$c(agingReport.days90Plus)}</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by invoice number or supplier"
                icon={<Search className="w-5 h-5" />}
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'pending', label: 'Pending' },
                { value: 'partial', label: 'Partial' },
                { value: 'overdue', label: 'Overdue' },
                { value: 'paid', label: 'Paid' },
              ]}
            />
          </div>
        </div>

        {/* Payables Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Invoice</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Supplier</th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-gray-600">Due Date</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">Amount</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">Balance</th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-gray-600">Status</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredPayables.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No invoices found</p>
                    </td>
                  </tr>
                ) : (
                  filteredPayables.map((payable) => (
                    <tr key={payable.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{payable.invoiceNumber}</p>
                        <p className="text-sm text-gray-500">
                          {format(new Date(payable.invoiceDate), 'MMM d, yyyy')}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600">{payable.supplierName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className={payable.status === 'overdue' ? 'text-red-600' : 'text-gray-600'}>
                            {format(new Date(payable.dueDate), 'MMM d, yyyy')}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-gray-900">
                        {$c(payable.amount)}
                      </td>
                      <td className="px-6 py-4 text-right font-medium">
                        <span className={payable.balance > 0 ? 'text-red-600' : 'text-green-600'}>
                          {$c(payable.balance)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(payable.status)}`}>
                          {payable.status === 'paid' && <CheckCircle className="w-3 h-3" />}
                          {payable.status === 'overdue' && <AlertTriangle className="w-3 h-3" />}
                          {payable.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {canManageAP && payable.status !== 'paid' && (
                            <Button
                              size="sm"
                              onClick={() => openPaymentModal(payable)}
                            >
                              <CreditCard className="w-4 h-4" />
                              Pay
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setSelectedPayable(payable);
                              setHistoryModalOpen(true);
                            }}
                          >
                            <FileText className="w-4 h-4" />
                            History
                          </Button>
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

      {/* Create Invoice Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Add Supplier Invoice"
        size="md"
      >
        <form onSubmit={handleCreatePayable} className="p-6 space-y-4">
          <Select
            label="Supplier *"
            value={formData.supplierId}
            onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
            options={[
              { value: '', label: 'Select supplier' },
              ...suppliers.filter((s) => s.status === 'active').map((s) => ({
                value: s.id,
                label: `${s.name} (${s.paymentTerms} days terms)`,
              })),
            ]}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Invoice Number *"
              type="text"
              value={formData.invoiceNumber}
              onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
              placeholder="INV-001"
              required
            />
            <Input
              label="Invoice Date *"
              type="date"
              value={formData.invoiceDate}
              onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
              required
            />
          </div>

          <Input
            label="Amount *"
            type="number"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
            placeholder="0.00"
            min="0"
            step="0.01"
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
              rows={2}
              placeholder="Additional notes..."
            />
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={() => setCreateModalOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Add Invoice
            </Button>
          </div>
        </form>
      </Modal>

      {/* Payment Modal */}
      <Modal
        isOpen={paymentModalOpen}
        onClose={() => {
          setPaymentModalOpen(false);
          setSelectedPayable(null);
        }}
        title="Record Payment"
        size="md"
      >
        {selectedPayable && (
          <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Invoice:</span>
                <span className="font-medium">{selectedPayable.invoiceNumber}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Supplier:</span>
                <span className="font-medium">{selectedPayable.supplierName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Outstanding Balance:</span>
                <span className="font-bold text-red-600">{$c(selectedPayable.balance)}</span>
              </div>
            </div>

            <Input
              label="Payment Amount *"
              type="number"
              value={paymentData.amount}
              onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) || 0 })}
              max={selectedPayable.balance}
              min="0.01"
              step="0.01"
              required
            />

            <Select
              label="Payment Method *"
              value={paymentData.method}
              onChange={(e) => setPaymentData({ ...paymentData, method: e.target.value as any })}
              options={[
                { value: 'bank_transfer', label: 'Bank Transfer' },
                { value: 'cheque', label: 'Cheque' },
                { value: 'mpesa', label: 'M-Pesa' },
                { value: 'cash', label: 'Cash' },
              ]}
            />

            <Input
              label="Reference / Transaction ID"
              type="text"
              value={paymentData.reference}
              onChange={(e) => setPaymentData({ ...paymentData, reference: e.target.value })}
              placeholder="Enter reference number"
            />

            <div className="flex gap-3 pt-4 border-t">
              <Button type="button" variant="secondary" onClick={() => setPaymentModalOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" className="flex-1">
                <CreditCard className="w-4 h-4" />
                Record Payment
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Payment History Modal */}
      <Modal
        isOpen={historyModalOpen}
        onClose={() => {
          setHistoryModalOpen(false);
          setSelectedPayable(null);
        }}
        title={`Payment History: ${selectedPayable?.invoiceNumber}`}
        size="md"
      >
        {selectedPayable && (
          <div className="p-6 space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Supplier:</span>
                <span className="font-medium">{selectedPayable.supplierName}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Invoice Amount:</span>
                <span className="font-medium">{$c(selectedPayable.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Outstanding Balance:</span>
                <span className={`font-bold ${selectedPayable.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {$c(selectedPayable.balance)}
                </span>
              </div>
            </div>

            {getPayablePayments(selectedPayable.id).length === 0 ? (
              <div className="text-center py-8 text-gray-500">No payments recorded yet</div>
            ) : (
              <div className="space-y-3">
                {getPayablePayments(selectedPayable.id).map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{$c(payment.amount)}</p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(payment.paidAt), 'MMM d, yyyy HH:mm')} — {payment.paymentMethod}
                        {payment.reference ? ` (${payment.reference})` : ''}
                      </p>
                    </div>
                    <span className="text-xs text-gray-500">by {payment.paidBy}</span>
                  </div>
                ))}
              </div>
            )}

            <Button variant="secondary" onClick={() => { setHistoryModalOpen(false); setSelectedPayable(null); }} className="w-full">
              Close
            </Button>
          </div>
        )}
      </Modal>
    </Layout>
  );
}
