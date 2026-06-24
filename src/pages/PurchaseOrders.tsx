import { useState, useMemo } from 'react';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { usePurchaseOrderStore } from '../store/purchaseOrderStore';
import { useSupplierStore } from '../store/supplierStore';
import { useProductStore } from '../store/productStore';
import { useFormatCurrency } from '../utils/format';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { hasPermission } from '../permissions';
import type { PurchaseOrder, POItem, POStatus } from '../types';
import {
  Search,
  Plus,
  Trash2,
  FileText,
  Package,
  Truck,
  CheckCircle,
  Clock,
  AlertCircle,
  Eye,
  PackageCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

// Note: Buying prices from suppliers are VAT-INCLUSIVE
// We extract VAT for accounting purposes but don't add it to the total

const statusOptions: { value: POStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'ordered', label: 'Ordered' },
  { value: 'partial', label: 'Partially Received' },
  { value: 'received', label: 'Received' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function PurchaseOrders() {
  const $c = useFormatCurrency();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [formData, setFormData] = useState({
    supplierId: '',
    items: [] as POItem[],
    shippingCost: 0,
    expectedDelivery: '',
    notes: '',
  });
  const [receivingItems, setReceivingItems] = useState<{ productId: string; quantity: number }[]>([]);

  const { purchaseOrders, createPO, updatePOStatus, receivePO, getPendingPOs } = usePurchaseOrderStore();
  const { suppliers, getSupplier } = useSupplierStore();
  const { products } = useProductStore();
  const { user } = useAuthStore();
  const canManagePO = hasPermission(user?.role, 'purchase_orders.manage');

  const filteredPOs = useMemo(() => {
    let result = purchaseOrders;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (po) =>
          po.poNumber.toLowerCase().includes(query) ||
          po.supplierName.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter((po) => po.status === statusFilter);
    }

    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [purchaseOrders, searchQuery, statusFilter]);

  const stats = useMemo(() => ({
    total: purchaseOrders.length,
    pending: getPendingPOs().length,
    totalValue: purchaseOrders.reduce((sum, po) => sum + po.total, 0),
  }), [purchaseOrders, getPendingPOs]);

  const handleAddItem = () => {
    if (products.length === 0) return;
    const newItem: POItem = {
      productId: products[0].id,
      productName: products[0].name,
      sku: products[0].sku,
      quantity: 1,
      receivedQuantity: 0,
      unitCost: products[0].buyingPrice,
      total: products[0].buyingPrice,
    };
    setFormData({ ...formData, items: [...formData.items, newItem] });
  };

  const handleUpdateItem = (index: number, field: keyof POItem, value: string | number) => {
    const updatedItems = [...formData.items];
    
    if (field === 'productId') {
      const product = products.find((p) => p.id === value);
      if (product) {
        updatedItems[index] = {
          ...updatedItems[index],
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          unitCost: product.buyingPrice,
          total: product.buyingPrice * updatedItems[index].quantity,
        };
      }
    } else if (field === 'quantity') {
      const qty = Number(value) || 0;
      updatedItems[index] = {
        ...updatedItems[index],
        quantity: qty,
        total: updatedItems[index].unitCost * qty,
      };
    } else if (field === 'unitCost') {
      const cost = Number(value) || 0;
      updatedItems[index] = {
        ...updatedItems[index],
        unitCost: cost,
        total: cost * updatedItems[index].quantity,
      };
    }
    
    setFormData({ ...formData, items: updatedItems });
  };

  // Get stock information for a product
  const getProductStockInfo = (productId: string, orderQuantity: number = 0, receivedQuantity: number = 0) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return null;
    
    const currentStock = product.stockQuantity;
    const newReceivable = orderQuantity - receivedQuantity;
    const newTotal = currentStock + orderQuantity;
    
    return {
      current: currentStock,
      receivable: newReceivable,
      newTotal,
    };
  };

  const handleRemoveItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    });
  };

  const calculateTotals = () => {
    // Buying prices are VAT-INCLUSIVE
    // Total is the sum of buying prices (what we pay supplier)
    const total = formData.items.reduce((sum, item) => sum + item.total, 0) + formData.shippingCost;
    
    // Extract VAT from total for accounting: VAT = Total - (Total / 1.16)
    const itemsTotal = formData.items.reduce((sum, item) => sum + item.total, 0);
    const taxRate = useSettingsStore.getState().settings.taxRate || 0.16;
    const vatExcluded = itemsTotal / (1 + taxRate);
    const tax = itemsTotal - vatExcluded;
    
    // Subtotal for accounting (VAT-excluded amount)
    const subtotal = vatExcluded;
    
    return { subtotal, tax, total };
  };

  const handleCreatePO = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.supplierId || formData.items.length === 0) {
      toast.error('Please select a supplier and add at least one item');
      return;
    }

    const supplier = getSupplier(formData.supplierId);
    if (!supplier) return;

    const { subtotal, tax, total } = calculateTotals();

    createPO({
      supplierId: formData.supplierId,
      supplierName: supplier.name,
      items: formData.items,
      subtotal,
      tax,
      shippingCost: formData.shippingCost,
      total,
      status: 'draft',
      expectedDelivery: formData.expectedDelivery || undefined,
      notes: formData.notes || undefined,
      createdBy: user?.username || 'Unknown',
    });

    toast.success('Purchase order created successfully');
    setModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      supplierId: '',
      items: [],
      shippingCost: 0,
      expectedDelivery: '',
      notes: '',
    });
  };

  const handleReceive = () => {
    if (!selectedPO) return;

    receivePO(selectedPO.id, receivingItems);
    toast.success('Stock received and updated');
    setReceiveModalOpen(false);
    setSelectedPO(null);
    setReceivingItems([]);
  };

  const openReceiveModal = (po: PurchaseOrder) => {
    setSelectedPO(po);
    setReceivingItems(
      po.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity - item.receivedQuantity,
      }))
    );
    setReceiveModalOpen(true);
  };

  const getStatusColor = (status: POStatus) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'approved': return 'bg-blue-100 text-blue-700';
      case 'ordered': return 'bg-purple-100 text-purple-700';
      case 'partial': return 'bg-orange-100 text-orange-700';
      case 'received': return 'bg-green-100 text-green-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: POStatus) => {
    switch (status) {
      case 'draft': return <FileText className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'approved': return <CheckCircle className="w-4 h-4" />;
      case 'ordered': return <Truck className="w-4 h-4" />;
      case 'partial': return <Package className="w-4 h-4" />;
      case 'received': return <PackageCheck className="w-4 h-4" />;
      case 'cancelled': return <AlertCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
            <p className="text-gray-600">Manage purchase orders to suppliers</p>
          </div>
          {canManagePO && (
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="w-4 h-4" />
              Create PO
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total POs</p>
                <p className="text-xl font-bold text-gray-900">{stats.total}</p>
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
                <p className="text-xl font-bold text-gray-900">{stats.pending}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Package className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Value</p>
                <p className="text-xl font-bold text-gray-900">{$c(stats.totalValue)}</p>
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
                placeholder="Search by PO number or supplier"
                icon={<Search className="w-5 h-5" />}
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[{ value: 'all', label: 'All Status' }, ...statusOptions]}
            />
          </div>
        </div>

        {/* PO Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">PO Number</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Supplier</th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-gray-600">Items</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">Total</th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-gray-600">Status</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Date</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredPOs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No purchase orders found</p>
                    </td>
                  </tr>
                ) : (
                  filteredPOs.map((po) => (
                    <tr key={po.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{po.poNumber}</p>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{po.supplierName}</td>
                      <td className="px-6 py-4 text-center text-gray-600">{po.items.length}</td>
                      <td className="px-6 py-4 text-right font-medium text-gray-900">
                        {$c(po.total)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(po.status)}`}>
                          {getStatusIcon(po.status)}
                          {po.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {format(new Date(po.createdAt), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedPO(po);
                              setViewModalOpen(true);
                            }}
                            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {canManagePO && ['ordered', 'partial'].includes(po.status) && (
                            <button
                              onClick={() => openReceiveModal(po)}
                              className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg"
                              title="Receive"
                            >
                              <PackageCheck className="w-4 h-4" />
                            </button>
                          )}
                          {canManagePO && po.status === 'draft' && (
                            <button
                              onClick={() => {
                                updatePOStatus(po.id, 'pending');
                                toast.success('PO submitted for approval');
                              }}
                              className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg"
                              title="Submit"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          {canManagePO && po.status === 'pending' && (
                            <>
                              <button
                                onClick={() => {
                                  updatePOStatus(po.id, 'approved');
                                  toast.success('PO approved');
                                }}
                                className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg"
                                title="Approve"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  updatePOStatus(po.id, 'cancelled');
                                  toast.success('PO cancelled');
                                }}
                                className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                title="Cancel"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {canManagePO && po.status === 'approved' && (
                            <button
                              onClick={() => {
                                updatePOStatus(po.id, 'ordered');
                                toast.success('PO marked as ordered');
                              }}
                              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                              title="Mark Ordered"
                            >
                              <Truck className="w-4 h-4" />
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

      {/* Create PO Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          resetForm();
        }}
        title="Create Purchase Order"
        size="full"
      >
        <form onSubmit={handleCreatePO} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              label="Supplier *"
              value={formData.supplierId}
              onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
              options={[
                { value: '', label: 'Select supplier' },
                ...suppliers.filter((s) => s.status === 'active').map((s) => ({
                  value: s.id,
                  label: s.name,
                })),
              ]}
            />
            <Input
              label="Expected Delivery"
              type="date"
              value={formData.expectedDelivery}
              onChange={(e) => setFormData({ ...formData, expectedDelivery: e.target.value })}
            />
            <Input
              label="Shipping Cost"
              type="number"
              value={formData.shippingCost}
              onChange={(e) => setFormData({ ...formData, shippingCost: parseFloat(e.target.value) || 0 })}
              min="0"
              step="0.01"
            />
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900">Items</h3>
              <Button type="button" variant="secondary" size="sm" onClick={handleAddItem}>
                <Plus className="w-4 h-4" />
                Add Item
              </Button>
            </div>
            
            {formData.items.length === 0 ? (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500">
                No items added. Click "Add Item" to start.
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2 text-sm font-medium text-gray-600">Product</th>
                      <th className="text-center px-4 py-2 text-sm font-medium text-gray-600">Quantity</th>
                      <th className="text-right px-4 py-2 text-sm font-medium text-gray-600">Unit Cost</th>
                      <th className="text-right px-4 py-2 text-sm font-medium text-gray-600">Total</th>
                      <th className="text-center px-4 py-2 text-sm font-medium text-gray-600">Stock Info</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {formData.items.map((item, index) => {
                      const stockInfo = getProductStockInfo(item.productId, item.quantity, item.receivedQuantity);
                      return (
                        <tr key={index}>
                          <td className="px-4 py-2">
                            <select
                              value={item.productId}
                              onChange={(e) => handleUpdateItem(index, 'productId', e.target.value)}
                              className="w-full px-3 py-1.5 border rounded-lg text-sm"
                            >
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => handleUpdateItem(index, 'quantity', e.target.value)}
                              className="w-20 px-3 py-1.5 border rounded-lg text-sm text-center"
                              min="1"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              value={item.unitCost}
                              onChange={(e) => handleUpdateItem(index, 'unitCost', e.target.value)}
                              className="w-28 px-3 py-1.5 border rounded-lg text-sm text-right"
                              min="0"
                              step="0.01"
                            />
                          </td>
                          <td className="px-4 py-2 text-right text-sm font-medium">
                            {$c(item.total)}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {stockInfo ? (
                              <div className="text-xs space-y-1">
                                <div className="flex items-center justify-center gap-1">
                                  <span className="text-gray-500">Current:</span>
                                  <span className="font-medium text-gray-700">{stockInfo.current}</span>
                                </div>
                                <div className="flex items-center justify-center gap-1">
                                  <span className="text-gray-500">Receivable:</span>
                                  <span className="font-medium text-blue-600">+{stockInfo.receivable}</span>
                                </div>
                                <div className="flex items-center justify-center gap-1 bg-green-50 px-2 py-0.5 rounded">
                                  <span className="text-gray-600">New:</span>
                                  <span className="font-bold text-green-700">{stockInfo.newTotal}</span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>
                            <td className="px-4 py-2">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(index)}
                                className="p-1 text-red-500 hover:bg-red-50 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Totals */}
          {formData.items.length > 0 && (
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span>{$c(calculateTotals().subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">VAT (16%):</span>
                  <span>{$c(calculateTotals().tax)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Shipping:</span>
                  <span>{$c(formData.shippingCost)}</span>
                </div>
                <div className="flex justify-between font-bold border-t pt-2">
                  <span>Total:</span>
                  <span>{$c(calculateTotals().total)}</span>
                </div>
              </div>
            </div>
          )}

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
            <Button type="button" variant="secondary" onClick={() => { setModalOpen(false); resetForm(); }} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Create Purchase Order
            </Button>
          </div>
        </form>
      </Modal>

      {/* View PO Modal */}
      <Modal
        isOpen={viewModalOpen}
        onClose={() => {
          setViewModalOpen(false);
          setSelectedPO(null);
        }}
        title={`Purchase Order: ${selectedPO?.poNumber}`}
        size="lg"
      >
        {selectedPO && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Supplier</p>
                <p className="font-medium">{selectedPO.supplierName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(selectedPO.status)}`}>
                  {getStatusIcon(selectedPO.status)}
                  {selectedPO.status}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-500">Created</p>
                <p className="font-medium">{format(new Date(selectedPO.createdAt), 'MMM d, yyyy HH:mm')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Created By</p>
                <p className="font-medium">{selectedPO.createdBy}</p>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">Items</h4>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2 text-sm font-medium text-gray-600">Product</th>
                      <th className="text-center px-4 py-2 text-sm font-medium text-gray-600">Ordered</th>
                      <th className="text-center px-4 py-2 text-sm font-medium text-gray-600">Received</th>
                      <th className="text-right px-4 py-2 text-sm font-medium text-gray-600">Unit Cost</th>
                      <th className="text-right px-4 py-2 text-sm font-medium text-gray-600">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedPO.items.map((item, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2">
                          <p className="font-medium">{item.productName}</p>
                          <p className="text-xs text-gray-500">{item.sku}</p>
                        </td>
                        <td className="px-4 py-2 text-center">{item.quantity}</td>
                        <td className="px-4 py-2 text-center">
                          <span className={item.receivedQuantity >= item.quantity ? 'text-green-600' : 'text-orange-600'}>
                            {item.receivedQuantity}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">{$c(item.unitCost)}</td>
                        <td className="px-4 py-2 text-right font-medium">{$c(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span>{$c(selectedPO.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">VAT (16%):</span>
                  <span>{$c(selectedPO.tax)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Shipping:</span>
                  <span>{$c(selectedPO.shippingCost)}</span>
                </div>
                <div className="flex justify-between font-bold border-t pt-2">
                  <span>Total:</span>
                  <span>{$c(selectedPO.total)}</span>
                </div>
              </div>
            </div>

            <Button variant="secondary" onClick={() => { setViewModalOpen(false); setSelectedPO(null); }} className="w-full">
              Close
            </Button>
          </div>
        )}
      </Modal>

      {/* Receive Modal */}
      <Modal
        isOpen={receiveModalOpen}
        onClose={() => {
          setReceiveModalOpen(false);
          setSelectedPO(null);
          setReceivingItems([]);
        }}
        title={`Receive Stock: ${selectedPO?.poNumber}`}
        size="lg"
      >
        {selectedPO && (
          <div className="p-6 space-y-6">
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2 text-sm font-medium text-gray-600">Product</th>
                    <th className="text-center px-4 py-2 text-sm font-medium text-gray-600">Ordered</th>
                    <th className="text-center px-4 py-2 text-sm font-medium text-gray-600">Previously Received</th>
                    <th className="text-center px-4 py-2 text-sm font-medium text-gray-600">Receiving Now</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {selectedPO.items.map((item, index) => {
                    const remaining = item.quantity - item.receivedQuantity;
                    return (
                      <tr key={index}>
                        <td className="px-4 py-2">
                          <p className="font-medium">{item.productName}</p>
                        </td>
                        <td className="px-4 py-2 text-center">{item.quantity}</td>
                        <td className="px-4 py-2 text-center">{item.receivedQuantity}</td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            value={receivingItems.find((r) => r.productId === item.productId)?.quantity || 0}
                            onChange={(e) => {
                              const qty = Math.min(Math.max(0, parseInt(e.target.value) || 0), remaining);
                              setReceivingItems(
                                receivingItems.map((r) =>
                                  r.productId === item.productId ? { ...r, quantity: qty } : r
                                )
                              );
                            }}
                            className="w-20 px-3 py-1.5 border rounded-lg text-sm text-center mx-auto block"
                            min="0"
                            max={remaining}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => { setReceiveModalOpen(false); setSelectedPO(null); }} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleReceive} className="flex-1">
                <PackageCheck className="w-4 h-4" />
                Receive Stock
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  );
}
