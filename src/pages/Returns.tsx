import { useState, useMemo, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { useReturnStore } from '../store/returnStore';
import { useProductStore } from '../store/productStore';
import { useAuthStore } from '../store/authStore';
import { useFormatCurrency } from '../utils/format';
import { hasPermission } from '../permissions';
import type { Return, ReturnStatus, RefundMethod } from '../types';
import {
  Search, Plus, RotateCcw, CheckCircle, XCircle, AlertTriangle, Package, Eye, Printer,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const statusOptions = [
  { value: 'all', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
];

export function Returns() {
  const $c = useFormatCurrency();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<Return | null>(null);
  const [formData, setFormData] = useState({
    saleNumber: '',
    customerName: '',
    items: [] as { productId: string; productName: string; sku: string; quantity: number; unitPrice: number; total: number; reason: string; condition: 'good' | 'damaged' | 'defective' }[],
    refundMethod: 'cash' as RefundMethod,
    notes: '',
  });

  const { returns, fetch: fetchReturns, createReturn, approveReturn, completeReturn, rejectReturn } = useReturnStore();
  const { products } = useProductStore();
  const { user } = useAuthStore();
  const canManage = hasPermission(user?.role, 'pos.returns');

  useEffect(() => { fetchReturns(); }, [fetchReturns]);

  const filteredReturns = useMemo(() => {
    let result = returns;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) =>
        r.saleNumber?.toLowerCase().includes(q) ||
        r.customerName?.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') result = result.filter((r) => r.status === statusFilter);
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [returns, searchQuery, statusFilter]);

  const stats = useMemo(() => ({
    total: returns.length,
    pending: returns.filter((r) => r.status === 'pending').length,
    completed: returns.filter((r) => r.status === 'completed').length,
    totalRefunded: returns.filter((r) => r.status === 'completed').reduce((s, r) => s + r.total, 0),
  }), [returns]);

  const handleAddItem = () => {
    if (products.length === 0) return;
    const p = products[0];
    setFormData({
      ...formData,
      items: [...formData.items, { productId: p.id, productName: p.name, sku: p.sku, quantity: 1, unitPrice: p.sellingPrice, total: p.sellingPrice, reason: '', condition: 'good' as const }],
    });
  };

  const handleUpdateItem = (index: number, field: string, value: string | number) => {
    const items = [...formData.items];
    if (field === 'productId') {
      const p = products.find((pr) => pr.id === value);
      if (p) items[index] = { ...items[index], productId: p.id, productName: p.name, sku: p.sku, unitPrice: p.sellingPrice, total: p.sellingPrice * items[index].quantity };
    } else if (field === 'quantity') {
      const q = Math.max(1, Number(value) || 1);
      items[index] = { ...items[index], quantity: q, total: items[index].unitPrice * q };
    } else if (field === 'unitPrice') {
      const p = Number(value) || 0;
      items[index] = { ...items[index], unitPrice: p, total: p * items[index].quantity };
    } else if (field === 'reason' || field === 'condition') {
      (items[index] as any)[field] = value;
    }
    setFormData({ ...formData, items });
  };

  const handleRemoveItem = (index: number) => {
    setFormData({ ...formData, items: formData.items.filter((_, i) => i !== index) });
  };

  const handleCreateReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.items.length === 0 || !user) { toast.error('Add at least one item'); return; }

    const subtotal = formData.items.reduce((s, i) => s + i.total, 0);
    createReturn({
      saleNumber: formData.saleNumber || undefined,
      customerName: formData.customerName || undefined,
      items: formData.items.map(({ condition: _, ...rest }) => rest),
      subtotal, tax: 0, total: subtotal,
      refundMethod: formData.refundMethod,
      cashierId: user.id, cashierName: user.username,
      notes: formData.notes || undefined,
    });

    toast.success('Return created');
    setCreateModalOpen(false);
    setFormData({ saleNumber: '', customerName: '', items: [], refundMethod: 'cash', notes: '' });
  };

  const handleApprove = async (id: string) => {
    await approveReturn(id);
    toast.success('Return approved');
  };

  const handleComplete = async (ret: Return) => {
    const method = ret.refundMethod || 'cash';
    await completeReturn(ret.id, method);
    toast.success(`Return completed — ${$c(ret.total)} refunded via ${method}`);
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Reason for rejection:');
    if (reason === null) return;
    await rejectReturn(id, reason || undefined);
    toast.success('Return rejected');
  };

  const handlePrint = (ret: Return) => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html><head><title>Return Receipt</title>
      <style>body{font-family:monospace;padding:20px;max-width:300px;margin:auto}
      h1{font-size:18px;text-align:center}
      table{width:100%;border-collapse:collapse;margin:10px 0}
      th,td{text-align:left;padding:4px 0}
      .right{text-align:right}
      .center{text-align:center}
      hr{border:0;border-top:1px dashed #000}
      .status{font-weight:bold;text-transform:uppercase}
      </style></head><body>
      <h1>RETURN RECEIPT</h1>
      <p class="center">#${ret.id.slice(0, 8).toUpperCase()}</p>
      <p class="center">${format(new Date(ret.createdAt), 'MMM d, yyyy HH:mm')}</p>
      ${ret.saleNumber ? `<p>Original Sale: ${ret.saleNumber}</p>` : ''}
      ${ret.customerName ? `<p>Customer: ${ret.customerName}</p>` : ''}
      <hr/>
      <table>
        <tr><th>Item</th><th class="right">Qty</th><th class="right">Amount</th></tr>
        ${ret.items.map((item: any) => `
          <tr><td>${item.productName}</td><td class="right">${item.quantity}</td><td class="right">${$c(item.total)}</td></tr>
          <tr><td colspan="3" style="font-size:11px;color:#666">${item.reason}</td></tr>
        `).join('')}
      </table>
      <hr/>
      <p><strong>Total Refund: ${$c(ret.total)}</strong></p>
      <p>Method: ${ret.refundMethod || 'N/A'}</p>
      <p>Status: <span class="status">${ret.status}</span></p>
      <hr/>
      <p class="center">Cashier: ${ret.cashierName}</p>
      <p class="center">Thank you!</p>
      <script>window.print()</script>
      </body></html>
    `);
    w.document.close();
  };

  const getStatusColor = (status: ReturnStatus) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'approved': return 'bg-blue-100 text-blue-700';
      case 'completed': return 'bg-green-100 text-green-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Returns</h1>
            <p className="text-gray-600">Manage customer returns and refunds</p>
          </div>
          {canManage && (
            <Button onClick={() => setCreateModalOpen(true)}>
              <Plus className="w-4 h-4" />
              New Return
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg"><RotateCcw className="w-5 h-5 text-blue-600" /></div>
              <div><p className="text-sm text-gray-600">Total Returns</p><p className="text-xl font-bold text-gray-900">{stats.total}</p></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg"><AlertTriangle className="w-5 h-5 text-yellow-600" /></div>
              <div><p className="text-sm text-gray-600">Pending</p><p className="text-xl font-bold text-gray-900">{stats.pending}</p></div>
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
              <div className="p-2 bg-red-100 rounded-lg"><Package className="w-5 h-5 text-red-600" /></div>
              <div><p className="text-sm text-gray-600">Total Refunded</p><p className="text-xl font-bold text-gray-900">{$c(stats.totalRefunded)}</p></div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <Input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by return ID, sale number, or customer" icon={<Search className="w-5 h-5" />} />
            </div>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={statusOptions} />
          </div>
        </div>

        {/* Returns Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Return ID</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Customer</th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-gray-600">Items</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">Refund</th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-gray-600">Status</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Date</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredReturns.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500"><RotateCcw className="w-12 h-12 mx-auto mb-2 opacity-50" /><p>No returns found</p></td></tr>
                ) : (
                  filteredReturns.map((ret) => (
                    <tr key={ret.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4"><p className="font-medium text-gray-900">#{ret.id.slice(0, 8).toUpperCase()}</p>{ret.saleNumber ? <p className="text-xs text-gray-500">Sale: {ret.saleNumber}</p> : null}</td>
                      <td className="px-6 py-4 text-gray-600">{ret.customerName || '-'}</td>
                      <td className="px-6 py-4 text-center text-gray-600">{ret.items.length}</td>
                      <td className="px-6 py-4 text-right font-medium text-red-600">{$c(ret.total)}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(ret.status)}`}>{ret.status}</span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{format(new Date(ret.createdAt), 'MMM d, yyyy')}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => { setSelectedReturn(ret); setViewModalOpen(true); }} className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="View"><Eye className="w-4 h-4" /></button>
                          <button onClick={() => handlePrint(ret)} className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg" title="Print"><Printer className="w-4 h-4" /></button>
                          {ret.status === 'pending' && <>
                            <Button size="sm" variant="success" onClick={() => handleApprove(ret.id)}>Approve</Button>
                            <Button size="sm" variant="danger" onClick={() => handleReject(ret.id)}>Reject</Button>
                          </>}
                          {ret.status === 'approved' && <Button size="sm" onClick={() => handleComplete(ret)}>Complete</Button>}
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

      {/* Create Return Modal */}
      <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} title="New Return" size="lg">
        <form onSubmit={handleCreateReturn} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Original Sale #" type="text" value={formData.saleNumber} onChange={(e) => setFormData({ ...formData, saleNumber: e.target.value })} placeholder="Receipt number" />
            <Input label="Customer Name" type="text" value={formData.customerName} onChange={(e) => setFormData({ ...formData, customerName: e.target.value })} placeholder="Customer name" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900">Return Items</h3>
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
                      <th className="text-left px-4 py-2 text-sm font-medium text-gray-600">Reason</th>
                      <th className="text-center px-4 py-2 text-sm font-medium text-gray-600">Condition</th>
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
                        <td className="px-4 py-2"><input type="text" value={item.reason} onChange={(e) => handleUpdateItem(i, 'reason', e.target.value)} className="w-full px-3 py-1.5 border rounded-lg text-sm" placeholder="Reason" /></td>
                        <td className="px-4 py-2">
                          <select value={item.condition} onChange={(e) => handleUpdateItem(i, 'condition', e.target.value)} className="w-full px-3 py-1.5 border rounded-lg text-sm">
                            <option value="good">Good</option>
                            <option value="damaged">Damaged</option>
                            <option value="defective">Defective</option>
                          </select>
                        </td>
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
                <div className="flex justify-between font-bold border-t pt-2">
                  <span>Total Refund:</span><span>{$c(formData.items.reduce((s, i) => s + i.total, 0))}</span>
                </div>
              </div>
            </div>
          )}

          <Select label="Refund Method" value={formData.refundMethod} onChange={(e) => setFormData({ ...formData, refundMethod: e.target.value as RefundMethod })}
            options={[
              { value: 'cash', label: 'Cash' },
              { value: 'mpesa', label: 'M-Pesa' },
              { value: 'card', label: 'Card' },
              { value: 'store_credit', label: 'Store Credit' },
            ]}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg" rows={2} placeholder="Additional notes..." />
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={() => setCreateModalOpen(false)} className="flex-1">Cancel</Button>
            <Button type="submit" className="flex-1">Create Return</Button>
          </div>
        </form>
      </Modal>

      {/* View Return Modal */}
      <Modal isOpen={viewModalOpen} onClose={() => { setViewModalOpen(false); setSelectedReturn(null); }} title={`Return #${selectedReturn?.id.slice(0, 8).toUpperCase()}`} size="md">
        {selectedReturn && (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Sale:</span> <span className="font-medium">{selectedReturn.saleNumber || 'N/A'}</span></div>
              <div><span className="text-gray-500">Customer:</span> <span className="font-medium">{selectedReturn.customerName || 'N/A'}</span></div>
              <div><span className="text-gray-500">Date:</span> <span className="font-medium">{format(new Date(selectedReturn.createdAt), 'MMM d, yyyy HH:mm')}</span></div>
              <div><span className="text-gray-500">Cashier:</span> <span className="font-medium">{selectedReturn.cashierName}</span></div>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50"><tr><th className="text-left px-4 py-2 text-sm font-medium text-gray-600">Product</th><th className="text-center px-4 py-2 text-sm font-medium text-gray-600">Qty</th><th className="text-right px-4 py-2 text-sm font-medium text-gray-600">Amount</th><th className="text-left px-4 py-2 text-sm font-medium text-gray-600">Reason</th></tr></thead>
                <tbody className="divide-y">
                  {selectedReturn.items.map((item: any, i: number) => (
                    <tr key={i}><td className="px-4 py-2">{item.productName}</td><td className="px-4 py-2 text-center">{item.quantity}</td><td className="px-4 py-2 text-right">{$c(item.total)}</td><td className="px-4 py-2 text-sm text-gray-500">{item.reason}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between font-bold text-lg"><span>Total Refund:</span><span className="text-red-600">{$c(selectedReturn.total)}</span></div>
            <div className="flex justify-between text-sm"><span>Refund Method:</span><span>{selectedReturn.refundMethod || 'N/A'}</span></div>
            <div className="flex justify-between text-sm"><span>Status:</span><span className={`font-medium ${getStatusColor(selectedReturn.status)} px-2 py-0.5 rounded-full text-xs`}>{selectedReturn.status}</span></div>
            {selectedReturn.notes && <p className="text-sm text-gray-500">Notes: {selectedReturn.notes}</p>}
            <div className="flex gap-3 pt-4">
              {selectedReturn.status === 'pending' && <>
                <Button variant="success" onClick={() => { handleApprove(selectedReturn.id); setViewModalOpen(false); }} className="flex-1"><CheckCircle className="w-4 h-4" /> Approve</Button>
                <Button variant="danger" onClick={() => { handleReject(selectedReturn.id); setViewModalOpen(false); }} className="flex-1"><XCircle className="w-4 h-4" /> Reject</Button>
              </>}
              {selectedReturn.status === 'approved' && <Button onClick={() => { handleComplete(selectedReturn); setViewModalOpen(false); }} className="flex-1">Complete Refund</Button>}
              <Button variant="secondary" onClick={() => { setViewModalOpen(false); setSelectedReturn(null); }}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  );
}
