import { useState, useMemo, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { useLayawayStore } from '../store/layawayStore';
import { useProductStore } from '../store/productStore';
import { useAuthStore } from '../store/authStore';
import { useFormatCurrency } from '../utils/format';
import { hasPermission } from '../permissions';
import type { Layaway, LayawayStatus, LayawayPayment } from '../types';
import {
  Search, Plus, RotateCcw, CheckCircle, XCircle, AlertTriangle, Package, Eye, Printer, Ban,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const statusOptions = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'defaulted', label: 'Defaulted' },
];

export function Layaways() {
  const $c = useFormatCurrency();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedLayaway, setSelectedLayaway] = useState<Layaway | null>(null);
  const [formData, setFormData] = useState({
    customerName: '',
    items: [] as { productId: string; productName: string; quantity: number; unitPrice: number; total: number }[],
    depositAmount: 0,
    dueDate: '',
    notes: '',
  });
  const [paymentData, setPaymentData] = useState({ amount: 0, method: 'cash' as 'cash' | 'mpesa' | 'card' });

  const { layaways, fetch: fetchLayaways, createLayaway, addPayment, updateStatus } = useLayawayStore();
  const { products } = useProductStore();
  const { user } = useAuthStore();
  const canManage = hasPermission(user?.role, 'pos.layaway');

  useEffect(() => { fetchLayaways(); }, [fetchLayaways]);

  const filteredLayaways = useMemo(() => {
    let result = layaways;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((l) =>
        l.customerName?.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') result = result.filter((l) => l.status === statusFilter);
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [layaways, searchQuery, statusFilter]);

  const stats = useMemo(() => ({
    total: layaways.length,
    active: layaways.filter((l) => l.status === 'active').length,
    completed: layaways.filter((l) => l.status === 'completed').length,
    totalOutstanding: layaways.filter((l) => l.status === 'active').reduce((s, l) => s + l.balanceDue, 0),
  }), [layaways]);

  const handleAddItem = () => {
    if (products.length === 0) return;
    const p = products[0];
    setFormData({
      ...formData,
      items: [...formData.items, { productId: p.id, productName: p.name, quantity: 1, unitPrice: p.sellingPrice, total: p.sellingPrice }],
    });
  };

  const handleUpdateItem = (index: number, field: string, value: string | number) => {
    const items = [...formData.items];
    if (field === 'productId') {
      const p = products.find((pr) => pr.id === value);
      if (p) items[index] = { ...items[index], productId: p.id, productName: p.name, unitPrice: p.sellingPrice, total: p.sellingPrice * items[index].quantity };
    } else if (field === 'quantity') {
      const q = Math.max(1, Number(value) || 1);
      items[index] = { ...items[index], quantity: q, total: items[index].unitPrice * q };
    } else if (field === 'unitPrice') {
      const p = Number(value) || 0;
      items[index] = { ...items[index], unitPrice: p, total: p * items[index].quantity };
    }
    setFormData({ ...formData, items });
  };

  const handleRemoveItem = (index: number) => {
    setFormData({ ...formData, items: formData.items.filter((_, i) => i !== index) });
  };

  const handleCreateLayaway = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.items.length === 0 || !user) { toast.error('Add at least one item'); return; }

    const totalAmount = formData.items.reduce((s, i) => s + i.total, 0);
    const deposit = formData.depositAmount || 0;
    const balanceDue = totalAmount - deposit;

    createLayaway({
      customerName: formData.customerName || undefined,
      items: formData.items,
      totalAmount, depositAmount: deposit, balanceDue,
      dueDate: formData.dueDate || undefined,
      cashierId: user.id,
      cashierName: user.username,
      notes: formData.notes || undefined,
    });

    toast.success('Layaway created');
    setCreateModalOpen(false);
    setFormData({ customerName: '', items: [], depositAmount: 0, dueDate: '', notes: '' });
  };

  const handleAddPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLayaway || paymentData.amount <= 0) { toast.error('Enter a valid payment amount'); return; }

    const newPaidAmount = selectedLayaway.paidAmount + paymentData.amount;
    const newBalanceDue = Math.max(0, selectedLayaway.balanceDue - paymentData.amount);
    const newStatus: LayawayStatus = newBalanceDue <= 0 ? 'completed' : 'active';

    const payment: LayawayPayment = {
      amount: paymentData.amount,
      method: paymentData.method,
      date: new Date().toISOString(),
    };

    addPayment(selectedLayaway.id, payment, newPaidAmount, newBalanceDue, newStatus);
    toast.success(`Payment of ${$c(paymentData.amount)} recorded`);
    setPaymentModalOpen(false);
    setPaymentData({ amount: 0, method: 'cash' });
  };

  const handleCancelOrDefault = async (id: string, status: 'cancelled' | 'defaulted') => {
    await updateStatus(id, status);
    toast.success(`Layaway ${status}`);
  };

  const handlePrint = (layaway: Layaway) => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html><head><title>Layaway Receipt</title>
      <style>body{font-family:monospace;padding:20px;max-width:300px;margin:auto}
      h1{font-size:18px;text-align:center}
      table{width:100%;border-collapse:collapse;margin:10px 0}
      th,td{text-align:left;padding:4px 0}
      .right{text-align:right}
      .center{text-align:center}
      hr{border:0;border-top:1px dashed #000}
      </style></head><body>
      <h1>LAWAYAY RECEIPT</h1>
      <p class="center">#${layaway.id.slice(0, 8).toUpperCase()}</p>
      <p class="center">${format(new Date(layaway.createdAt), 'MMM d, yyyy HH:mm')}</p>
      ${layaway.customerName ? `<p>Customer: ${layaway.customerName}</p>` : ''}
      <hr/>
      <table>
        <tr><th>Item</th><th class="right">Qty</th><th class="right">Amount</th></tr>
        ${layaway.items.map((item: any) => `
          <tr><td>${item.productName}</td><td class="right">${item.quantity}</td><td class="right">${$c(item.total)}</td></tr>
        `).join('')}
      </table>
      <hr/>
      <p><strong>Total: ${$c(layaway.totalAmount)}</strong></p>
      <p>Deposit: ${$c(layaway.depositAmount)}</p>
      <p>Paid: ${$c(layaway.paidAmount)}</p>
      <p>Balance: ${$c(layaway.balanceDue)}</p>
      <p>Status: ${layaway.status}</p>
      ${layaway.dueDate ? `<p>Due: ${format(new Date(layaway.dueDate), 'MMM d, yyyy')}</p>` : ''}
      <hr/>
      <p class="center">Cashier: ${layaway.cashierName}</p>
      <p class="center">Thank you!</p>
      <script>window.print()</script>
      </body></html>
    `);
    w.document.close();
  };

  const getStatusColor = (status: LayawayStatus) => {
    switch (status) {
      case 'active': return 'bg-blue-100 text-blue-700';
      case 'completed': return 'bg-green-100 text-green-700';
      case 'cancelled': return 'bg-yellow-100 text-yellow-700';
      case 'defaulted': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Layaways</h1>
            <p className="text-gray-600">Manage customer layaway plans</p>
          </div>
          {canManage && (
            <Button onClick={() => setCreateModalOpen(true)}>
              <Plus className="w-4 h-4" />
              New Layaway
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg"><Package className="w-5 h-5 text-blue-600" /></div>
              <div><p className="text-sm text-gray-600">Total Layaways</p><p className="text-xl font-bold text-gray-900">{stats.total}</p></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg"><AlertTriangle className="w-5 h-5 text-blue-600" /></div>
              <div><p className="text-sm text-gray-600">Active</p><p className="text-xl font-bold text-gray-900">{stats.active}</p></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg"><CheckCircle className="w-5 h-5 text-green-600" /></div>
              <div><p className="text-sm text-gray-600">Completed</p><p className="text-xl font-bold text-gray-900">{stats.completed}</p></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg"><RotateCcw className="w-5 h-5 text-red-600" /></div>
              <div><p className="text-sm text-gray-600">Outstanding</p><p className="text-xl font-bold text-gray-900">{$c(stats.totalOutstanding)}</p></div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <Input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by customer name or ID" icon={<Search className="w-5 h-5" />} />
            </div>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={statusOptions} />
          </div>
        </div>

        {/* Layaways Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Layaway ID</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Customer</th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-gray-600">Items</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">Total</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">Paid</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">Balance</th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-gray-600">Status</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Date</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredLayaways.length === 0 ? (
                  <tr><td colSpan={9} className="px-6 py-12 text-center text-gray-500"><Package className="w-12 h-12 mx-auto mb-2 opacity-50" /><p>No layaways found</p></td></tr>
                ) : (
                  filteredLayaways.map((layaway) => (
                    <tr key={layaway.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4"><p className="font-medium text-gray-900">#{layaway.id.slice(0, 8).toUpperCase()}</p></td>
                      <td className="px-6 py-4 text-gray-600">{layaway.customerName || '-'}</td>
                      <td className="px-6 py-4 text-center text-gray-600">{layaway.items.length}</td>
                      <td className="px-6 py-4 text-right font-medium text-gray-900">{$c(layaway.totalAmount)}</td>
                      <td className="px-6 py-4 text-right text-green-600 font-medium">{$c(layaway.paidAmount)}</td>
                      <td className="px-6 py-4 text-right text-red-600 font-medium">{$c(layaway.balanceDue)}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(layaway.status)}`}>{layaway.status}</span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{format(new Date(layaway.createdAt), 'MMM d, yyyy')}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => { setSelectedLayaway(layaway); setViewModalOpen(true); }} className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="View"><Eye className="w-4 h-4" /></button>
                          <button onClick={() => handlePrint(layaway)} className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg" title="Print"><Printer className="w-4 h-4" /></button>
                          {layaway.status === 'active' && <>
                            <Button size="sm" onClick={() => { setSelectedLayaway(layaway); setPaymentData({ amount: layaway.balanceDue, method: 'cash' }); setPaymentModalOpen(true); }}>Pay</Button>
                          </>}
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

      {/* Create Layaway Modal */}
      <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} title="New Layaway" size="lg">
        <form onSubmit={handleCreateLayaway} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Customer Name" type="text" value={formData.customerName} onChange={(e) => setFormData({ ...formData, customerName: e.target.value })} placeholder="Customer name" />
            <Input label="Deposit Amount" type="number" value={formData.depositAmount} onChange={(e) => setFormData({ ...formData, depositAmount: Number(e.target.value) || 0 })} min="0" step="0.01" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Due Date (optional)" type="date" value={formData.dueDate} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900">Items</h3>
              <Button type="button" variant="secondary" size="sm" onClick={handleAddItem}><Plus className="w-4 h-4" /> Add Item</Button>
            </div>
            {formData.items.length === 0 ? (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500">No items added</div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2 text-sm font-medium text-gray-600">Product</th>
                      <th className="text-center px-4 py-2 text-sm font-medium text-gray-600">Qty</th>
                      <th className="text-right px-4 py-2 text-sm font-medium text-gray-600">Price</th>
                      <th className="text-right px-4 py-2 text-sm font-medium text-gray-600">Total</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {formData.items.map((item, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2">
                          <select value={item.productId} onChange={(e) => handleUpdateItem(i, 'productId', e.target.value)} className="w-full px-3 py-1.5 border rounded-lg text-sm">
                            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-2"><input type="number" value={item.quantity} onChange={(e) => handleUpdateItem(i, 'quantity', e.target.value)} className="w-20 px-3 py-1.5 border rounded-lg text-sm text-center" min="1" /></td>
                        <td className="px-4 py-2"><input type="number" value={item.unitPrice} onChange={(e) => handleUpdateItem(i, 'unitPrice', e.target.value)} className="w-28 px-3 py-1.5 border rounded-lg text-sm text-right" min="0" step="0.01" /></td>
                        <td className="px-4 py-2 text-right text-sm font-medium">{$c(item.total)}</td>
                        <td className="px-4 py-2"><button type="button" onClick={() => handleRemoveItem(i)} className="p-1 text-red-500 hover:bg-red-50 rounded"><XCircle className="w-4 h-4" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {formData.items.length > 0 && (
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between">
                  <span>Total:</span><span>{$c(formData.items.reduce((s, i) => s + i.total, 0))}</span>
                </div>
                <div className="flex justify-between">
                  <span>Deposit:</span><span>{$c(formData.depositAmount)}</span>
                </div>
                <div className="flex justify-between font-bold border-t pt-2">
                  <span>Balance Due:</span><span>{$c(Math.max(0, formData.items.reduce((s, i) => s + i.total, 0) - formData.depositAmount))}</span>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg" rows={2} placeholder="Additional notes..." />
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={() => setCreateModalOpen(false)} className="flex-1">Cancel</Button>
            <Button type="submit" className="flex-1">Create Layaway</Button>
          </div>
        </form>
      </Modal>

      {/* View Layaway Modal */}
      <Modal isOpen={viewModalOpen} onClose={() => { setViewModalOpen(false); setSelectedLayaway(null); }} title={`Layaway #${selectedLayaway?.id.slice(0, 8).toUpperCase()}`} size="md">
        {selectedLayaway && (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Customer:</span> <span className="font-medium">{selectedLayaway.customerName || 'N/A'}</span></div>
              <div><span className="text-gray-500">Date:</span> <span className="font-medium">{format(new Date(selectedLayaway.createdAt), 'MMM d, yyyy HH:mm')}</span></div>
              <div><span className="text-gray-500">Cashier:</span> <span className="font-medium">{selectedLayaway.cashierName}</span></div>
              <div><span className="text-gray-500">Due Date:</span> <span className="font-medium">{selectedLayaway.dueDate ? format(new Date(selectedLayaway.dueDate), 'MMM d, yyyy') : 'N/A'}</span></div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50"><tr><th className="text-left px-4 py-2 text-sm font-medium text-gray-600">Product</th><th className="text-center px-4 py-2 text-sm font-medium text-gray-600">Qty</th><th className="text-right px-4 py-2 text-sm font-medium text-gray-600">Amount</th></tr></thead>
                <tbody className="divide-y">
                  {selectedLayaway.items.map((item: any, i: number) => (
                    <tr key={i}><td className="px-4 py-2">{item.productName}</td><td className="px-4 py-2 text-center">{item.quantity}</td><td className="px-4 py-2 text-right">{$c(item.total)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-gray-50 rounded-lg p-3"><p className="text-sm text-gray-600">Total</p><p className="text-lg font-bold text-gray-900">{$c(selectedLayaway.totalAmount)}</p></div>
              <div className="bg-green-50 rounded-lg p-3"><p className="text-sm text-gray-600">Paid</p><p className="text-lg font-bold text-green-600">{$c(selectedLayaway.paidAmount)}</p></div>
              <div className="bg-red-50 rounded-lg p-3"><p className="text-sm text-gray-600">Balance</p><p className="text-lg font-bold text-red-600">{$c(selectedLayaway.balanceDue)}</p></div>
            </div>

            {/* Payment History */}
            {selectedLayaway.payments && selectedLayaway.payments.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Payment History</h4>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50"><tr><th className="text-left px-4 py-2 text-sm font-medium text-gray-600">Date</th><th className="text-right px-4 py-2 text-sm font-medium text-gray-600">Amount</th><th className="text-center px-4 py-2 text-sm font-medium text-gray-600">Method</th></tr></thead>
                    <tbody className="divide-y">
                      {selectedLayaway.payments.map((p: any, i: number) => (
                        <tr key={i}><td className="px-4 py-2 text-sm">{format(new Date(p.date), 'MMM d, yyyy HH:mm')}</td><td className="px-4 py-2 text-right font-medium text-green-600">{$c(p.amount)}</td><td className="px-4 py-2 text-center text-sm">{p.method}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Status:</span>
              <span className={`font-medium ${getStatusColor(selectedLayaway.status)} px-2 py-0.5 rounded-full text-xs`}>{selectedLayaway.status}</span>
            </div>
            {selectedLayaway.notes && <p className="text-sm text-gray-500">Notes: {selectedLayaway.notes}</p>}

            <div className="flex gap-3 pt-4">
              {selectedLayaway.status === 'active' && <>
                <Button variant="success" onClick={() => { setPaymentModalOpen(true); setViewModalOpen(false); }} className="flex-1">Record Payment</Button>
                <Button variant="danger" onClick={() => { handleCancelOrDefault(selectedLayaway.id, 'cancelled'); setViewModalOpen(false); }} className="flex-1"><XCircle className="w-4 h-4" /> Cancel</Button>
                <Button variant="danger" onClick={() => { handleCancelOrDefault(selectedLayaway.id, 'defaulted'); setViewModalOpen(false); }} className="flex-1"><Ban className="w-4 h-4" /> Default</Button>
              </>}
              <Button variant="secondary" onClick={() => { setViewModalOpen(false); setSelectedLayaway(null); }}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Payment Modal */}
      <Modal isOpen={paymentModalOpen} onClose={() => setPaymentModalOpen(false)} title="Record Payment" size="sm">
        <form onSubmit={handleAddPayment} className="p-6 space-y-4">
          {selectedLayaway && (
            <div className="text-sm text-gray-600 space-y-1">
              <p>Customer: <span className="font-medium">{selectedLayaway.customerName || 'N/A'}</span></p>
              <p>Balance Due: <span className="font-medium text-red-600">{$c(selectedLayaway.balanceDue)}</span></p>
            </div>
          )}
          <Input label="Payment Amount" type="number" value={paymentData.amount || ''} onChange={(e) => setPaymentData({ ...paymentData, amount: Number(e.target.value) || 0 })} min="0.01" step="0.01" required />
          <Select label="Payment Method" value={paymentData.method} onChange={(e) => setPaymentData({ ...paymentData, method: e.target.value as 'cash' | 'mpesa' | 'card' })}
            options={[
              { value: 'cash', label: 'Cash' },
              { value: 'mpesa', label: 'M-Pesa' },
              { value: 'card', label: 'Card' },
            ]}
          />
          <div className="flex gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={() => setPaymentModalOpen(false)} className="flex-1">Cancel</Button>
            <Button type="submit" className="flex-1">Record Payment</Button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
