import { useState, useMemo, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { useExpenseStore } from '../store/expenseStore';
import { useAuthStore } from '../store/authStore';
import { useFormatCurrency } from '../utils/format';
import type { Expense, ExpenseCategory, ExpenseStatus } from '../types';
import {
  Search,
  Plus,
  DollarSign,
  CheckCircle,
  Clock,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const categoryOptions = [
  { value: 'rent', label: 'Rent' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'salaries', label: 'Salaries' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'other', label: 'Other' },
];

const statusOptions = [
  { value: 'all', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'paid', label: 'Paid' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function Expenses() {
  const $c = useFormatCurrency();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    category: 'other' as ExpenseCategory,
    description: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    dueDate: '',
    supplier: '',
    status: 'pending' as ExpenseStatus,
    notes: '',
  });

  const { expenses, fetch: fetchExpenses, addExpense, approveExpense, payExpense, deleteExpense } = useExpenseStore();
  const { user } = useAuthStore();

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payingExpense, setPayingExpense] = useState<Expense | null>(null);
  const [payForm, setPayForm] = useState({
    method: 'cash' as 'cash' | 'bank_transfer' | 'cheque' | 'mpesa',
    reference: '',
  });

  const filteredExpenses = useMemo(() => {
    let result = expenses;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.description.toLowerCase().includes(query) ||
          e.supplier?.toLowerCase().includes(query)
      );
    }

    if (categoryFilter !== 'all') {
      result = result.filter((e) => e.category === categoryFilter);
    }

    if (statusFilter !== 'all') {
      result = result.filter((e) => e.status === statusFilter);
    }

    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, searchQuery, categoryFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: expenses.reduce((sum, e) => sum + e.amount, 0),
    pending: expenses.filter((e) => e.status === 'pending').reduce((sum, e) => sum + e.amount, 0),
    approved: expenses.filter((e) => e.status === 'approved').reduce((sum, e) => sum + e.amount, 0),
    paid: expenses.filter((e) => e.status === 'paid').reduce((sum, e) => sum + e.amount, 0),
  }), [expenses]);

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.description || formData.amount <= 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    addExpense(formData);

    toast.success('Expense added successfully');
    setModalOpen(false);
    setFormData({
      category: 'other',
      description: '',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      dueDate: '',
      supplier: '',
      status: 'pending',
      notes: '',
    });
  };

  const handlePayExpense = (expense: Expense) => {
    if (!user) return;
    setPayingExpense(expense);
    setPayForm({ method: 'cash', reference: '' });
    setPayModalOpen(true);
  };

  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingExpense || !user) return;
    payExpense(payingExpense.id, payForm.method, user.username, payForm.reference || undefined);
    toast.success('Expense marked as paid');
    setPayModalOpen(false);
    setPayingExpense(null);
  };

  const getStatusColor = (status: ExpenseStatus) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'approved': return 'bg-blue-100 text-blue-700';
      case 'paid': return 'bg-green-100 text-green-700';
      case 'cancelled': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
            <p className="text-gray-600">Track and manage business expenses</p>
          </div>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4" />
            Add Expense
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Expenses</p>
                <p className="text-xl font-bold text-gray-900">{$c(stats.total)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-xl font-bold text-gray-900">{$c(stats.pending)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Approved</p>
                <p className="text-xl font-bold text-gray-900">{$c(stats.approved)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Paid</p>
                <p className="text-xl font-bold text-gray-900">{$c(stats.paid)}</p>
              </div>
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
                placeholder="Search expenses by description or supplier"
                icon={<Search className="w-5 h-5" />}
              />
            </div>
            <div className="flex gap-3">
              <Select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                options={[{ value: 'all', label: 'All Categories' }, ...categoryOptions]}
              />
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={statusOptions}
              />
            </div>
          </div>
        </div>

        {/* Expenses Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Description</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Category</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Supplier</th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-gray-600">Date</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">Amount</th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-gray-600">Status</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No expenses found</p>
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((expense) => (
                    <tr key={expense.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{expense.description}</p>
                        <p className="text-sm text-gray-500">{format(new Date(expense.date), 'MMM d, yyyy')}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded-full capitalize">
                          {expense.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {expense.supplier || '-'}
                      </td>
                      <td className="px-6 py-4 text-center text-gray-600">
                        {format(new Date(expense.date), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-gray-900">
                        {$c(expense.amount)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(expense.status)}`}>
                          {expense.status === 'paid' && <CheckCircle className="w-3 h-3" />}
                          {expense.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {expense.status === 'pending' && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                if (user) approveExpense(expense.id, user.username);
                                toast.success('Expense approved');
                              }}
                            >
                              Approve
                            </Button>
                          )}
                          {expense.status === 'approved' && (
                            <Button
                              size="sm"
                              onClick={() => handlePayExpense(expense)}
                            >
                              Pay
                            </Button>
                          )}
                          {expense.status !== 'paid' && expense.status !== 'cancelled' && (
                            <button
                              onClick={() => {
                                if (confirm('Delete this expense?')) {
                                  deleteExpense(expense.id);
                                  toast.success('Expense deleted');
                                }
                              }}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
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

      {/* Add Expense Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Expense"
        size="md"
      >
        <form onSubmit={handleAddExpense} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Category *"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value as ExpenseCategory })}
              options={categoryOptions}
            />
            <Input
              label="Date *"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>

          <Input
            label="Description *"
            type="text"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Expense description"
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Amount *"
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
              placeholder="0.00"
              min="0.01"
              step="0.01"
              required
            />
            <Input
              label="Due Date"
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
            />
          </div>

          <Input
            label="Supplier"
            type="text"
            value={formData.supplier}
            onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
            placeholder="Supplier name"
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
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Add Expense
            </Button>
          </div>
        </form>
      </Modal>

      {/* Pay Expense Modal */}
      <Modal
        isOpen={payModalOpen}
        onClose={() => {
          setPayModalOpen(false);
          setPayingExpense(null);
        }}
        title="Pay Expense"
        size="sm"
      >
        <form onSubmit={handleSubmitPayment} className="p-6 space-y-4">
          {payingExpense && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                Paying: <strong>{payingExpense.description}</strong>
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Amount: <strong>{$c(payingExpense.amount)}</strong>
              </p>
            </div>
          )}

          <Select
            label="Payment Method *"
            value={payForm.method}
            onChange={(e) => setPayForm({ ...payForm, method: e.target.value as any })}
            options={[
              { value: 'cash', label: 'Cash' },
              { value: 'bank_transfer', label: 'Bank Transfer' },
              { value: 'cheque', label: 'Cheque' },
              { value: 'mpesa', label: 'M-Pesa' },
            ]}
          />

          <Input
            label="Reference / Transaction ID"
            type="text"
            value={payForm.reference}
            onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })}
            placeholder="Enter reference number"
          />

          <div className="flex gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setPayModalOpen(false);
                setPayingExpense(null);
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              <CheckCircle className="w-4 h-4" />
              Confirm Payment
            </Button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
