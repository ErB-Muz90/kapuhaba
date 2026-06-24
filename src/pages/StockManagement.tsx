import { useState, useMemo } from 'react';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { useStockStore } from '../store/stockStore';
import { useProductStore } from '../store/productStore';
import { useFormatCurrency } from '../utils/format';
import { useAuthStore } from '../store/authStore';
import { hasPermission } from '../permissions';
import type { StockAdjustmentType } from '../types';
import {
  Package,
  Plus,
  Minus,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ClipboardList,
  History,
  DollarSign,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const adjustmentTypes: { value: StockAdjustmentType; label: string }[] = [
  { value: 'adjustment', label: 'Stock Adjustment' },
  { value: 'damage', label: 'Damaged Goods' },
  { value: 'theft', label: 'Theft/Loss' },
  { value: 'return', label: 'Customer Return' },
  { value: 'correction', label: 'Count Correction' },
  { value: 'transfer', label: 'Transfer' },
];

export function StockManagement() {
  const $c = useFormatCurrency();
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [countModalOpen, setCountModalOpen] = useState(false);
  const [adjustmentForm, setAdjustmentForm] = useState({
    productId: '',
    type: 'adjustment' as StockAdjustmentType,
    quantityChange: 0,
    reason: '',
  });

  const { adjustments, createAdjustment, startStockCount, getStockValueByCategory, getTotalStockValue } = useStockStore();
  const { products } = useProductStore();
  const { user } = useAuthStore();
  const canEditInventory = hasPermission(user?.role, 'inventory.edit');

  const recentAdjustments = useMemo(() => adjustments.slice(0, 20), [adjustments]);
  const stockValueByCategory = useMemo(() => getStockValueByCategory(), [products]);
  const totalStockValue = useMemo(() => getTotalStockValue(), [products]);

  const lowStockProducts = useMemo(() => 
    products.filter((p) => p.stockQuantity <= p.lowStockThreshold),
    [products]
  );

  const outOfStockProducts = useMemo(() => 
    products.filter((p) => p.stockQuantity === 0),
    [products]
  );

  const handleCreateAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!adjustmentForm.productId || adjustmentForm.quantityChange === 0 || !adjustmentForm.reason) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      await createAdjustment({
        productId: adjustmentForm.productId,
        productName: selectedProduct?.name || '',
        type: adjustmentForm.type,
        quantityChange: adjustmentForm.quantityChange,
        reason: adjustmentForm.reason,
        performedBy: user?.username || 'Unknown',
      });
      toast.success('Stock adjustment recorded successfully');
      setAdjustmentModalOpen(false);
      setAdjustmentForm({
        productId: '',
        type: 'adjustment',
        quantityChange: 0,
        reason: '',
      });
    } catch {
      toast.error('Failed to create adjustment');
    }
  };

  const handleStartStockCount = async () => {
    if (!user) return;

    try {
      await startStockCount({
        performedBy: user.username,
        date: new Date().toISOString(),
        status: 'in_progress',
        items: [],
      });
      toast.success('Stock count started');
      setCountModalOpen(false);
    } catch {
      toast.error('Failed to start stock count');
    }
  };

  const getAdjustmentColor = (change: number) => {
    if (change > 0) return 'text-green-600 bg-green-100';
    if (change < 0) return 'text-red-600 bg-red-100';
    return 'text-gray-600 bg-gray-100';
  };

  const selectedProduct = products.find((p) => p.id === adjustmentForm.productId);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Stock Management</h1>
            <p className="text-gray-600">Manage inventory levels and adjustments</p>
          </div>
          <div className="flex gap-3">
            {canEditInventory && (
              <Button variant="secondary" onClick={() => setCountModalOpen(true)}>
                <ClipboardList className="w-4 h-4" />
                Stock Count
              </Button>
            )}
            {canEditInventory && (
              <Button onClick={() => setAdjustmentModalOpen(true)}>
                <RefreshCw className="w-4 h-4" />
                Adjust Stock
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Products</p>
                <p className="text-xl font-bold text-gray-900">{products.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Stock Value</p>
                <p className="text-xl font-bold text-gray-900">{$c(totalStockValue)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Low Stock</p>
                <p className="text-xl font-bold text-gray-900">{lowStockProducts.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <Package className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Out of Stock</p>
                <p className="text-xl font-bold text-gray-900">{outOfStockProducts.length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stock Value by Category */}
          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Stock Value by Category</h2>
            </div>
            <div className="p-6">
              {stockValueByCategory.length === 0 ? (
                <p className="text-gray-500 text-center">No stock data</p>
              ) : (
                <div className="space-y-3">
                  {stockValueByCategory.map((cat) => (
                    <div key={cat.category} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{cat.category}</p>
                        <p className="text-sm text-gray-500">{cat.count} units</p>
                      </div>
                      <p className="font-semibold text-gray-900">{$c(cat.value)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Low Stock Alert */}
          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                Low Stock Items
              </h2>
            </div>
            <div className="divide-y max-h-80 overflow-y-auto">
              {lowStockProducts.length === 0 ? (
                <p className="p-6 text-gray-500 text-center">All items are well stocked</p>
              ) : (
                lowStockProducts.slice(0, 10).map((product) => (
                  <div key={product.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <p className="text-sm text-gray-500">{product.sku}</p>
                    </div>
                    <span className={`px-2 py-1 text-sm font-medium rounded-full ${
                      product.stockQuantity === 0 
                        ? 'bg-red-100 text-red-700' 
                        : 'bg-orange-100 text-orange-700'
                    }`}>
                      {product.stockQuantity} left
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Adjustments */}
          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <History className="w-5 h-5 text-gray-500" />
                Recent Adjustments
              </h2>
            </div>
            <div className="divide-y max-h-80 overflow-y-auto">
              {recentAdjustments.length === 0 ? (
                <p className="p-6 text-gray-500 text-center">No adjustments yet</p>
              ) : (
                recentAdjustments.map((adj) => (
                  <div key={adj.id} className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-gray-900 truncate">{adj.productName}</p>
                      <span className={`flex items-center gap-1 px-2 py-0.5 text-sm font-medium rounded-full ${getAdjustmentColor(adj.quantityChange)}`}>
                        {adj.quantityChange > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {adj.quantityChange > 0 ? '+' : ''}{adj.quantityChange}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{adj.type} - {adj.reason}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {format(new Date(adj.createdAt), 'MMM d, HH:mm')} by {adj.performedBy}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Product Stock Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900">All Products Stock</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Product</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Category</th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-gray-600">Current Stock</th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-gray-600">Threshold</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">Stock Value</th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <p className="text-sm text-gray-500">{product.sku}</p>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{product.category}</td>
                    <td className="px-6 py-4 text-center font-medium text-gray-900">
                      {product.stockQuantity}
                    </td>
                    <td className="px-6 py-4 text-center text-gray-600">
                      {product.lowStockThreshold}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-900">
                      {$c(product.buyingPrice * product.stockQuantity)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        product.stockQuantity === 0
                          ? 'bg-red-100 text-red-700'
                          : product.stockQuantity <= product.lowStockThreshold
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {product.stockQuantity === 0 ? 'Out of Stock' : 
                         product.stockQuantity <= product.lowStockThreshold ? 'Low Stock' : 'In Stock'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Stock Adjustment Modal */}
      <Modal
        isOpen={adjustmentModalOpen}
        onClose={() => {
          setAdjustmentModalOpen(false);
          setAdjustmentForm({ productId: '', type: 'adjustment', quantityChange: 0, reason: '' });
        }}
        title="Stock Adjustment"
        size="md"
      >
        <form onSubmit={handleCreateAdjustment} className="p-6 space-y-4">
          <Select
            label="Product *"
            value={adjustmentForm.productId}
            onChange={(e) => setAdjustmentForm({ ...adjustmentForm, productId: e.target.value })}
            options={[
              { value: '', label: 'Select product' },
              ...products.map((p) => ({ value: p.id, label: `${p.name} (Stock: ${p.stockQuantity})` })),
            ]}
          />

          {selectedProduct && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Current Stock: <strong>{selectedProduct.stockQuantity}</strong></p>
            </div>
          )}

          <Select
            label="Adjustment Type *"
            value={adjustmentForm.type}
            onChange={(e) => setAdjustmentForm({ ...adjustmentForm, type: e.target.value as StockAdjustmentType })}
            options={adjustmentTypes}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity Change *</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAdjustmentForm({ ...adjustmentForm, quantityChange: Math.abs(adjustmentForm.quantityChange) })}
                className={`px-4 py-2 rounded-lg border-2 flex items-center gap-2 ${
                  adjustmentForm.quantityChange >= 0 
                    ? 'border-green-500 bg-green-50 text-green-700' 
                    : 'border-gray-300 text-gray-600'
                }`}
              >
                <Plus className="w-4 h-4" /> Add
              </button>
              <button
                type="button"
                onClick={() => setAdjustmentForm({ ...adjustmentForm, quantityChange: -Math.abs(adjustmentForm.quantityChange) })}
                className={`px-4 py-2 rounded-lg border-2 flex items-center gap-2 ${
                  adjustmentForm.quantityChange < 0 
                    ? 'border-red-500 bg-red-50 text-red-700' 
                    : 'border-gray-300 text-gray-600'
                }`}
              >
                <Minus className="w-4 h-4" /> Remove
              </button>
            </div>
            <Input
              type="number"
              value={Math.abs(adjustmentForm.quantityChange)}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 0;
                setAdjustmentForm({ 
                  ...adjustmentForm, 
                  quantityChange: adjustmentForm.quantityChange < 0 ? -val : val 
                });
              }}
              placeholder="Enter quantity"
              min="0"
              className="mt-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
            <textarea
              value={adjustmentForm.reason}
              onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
              rows={3}
              placeholder="Enter reason for adjustment"
              required
            />
          </div>

          {selectedProduct && adjustmentForm.quantityChange !== 0 && (
            <div className={`p-3 rounded-lg ${adjustmentForm.quantityChange > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <p className="text-sm">
                New Stock: <strong>{selectedProduct.stockQuantity + adjustmentForm.quantityChange}</strong>
                {' '}({adjustmentForm.quantityChange > 0 ? '+' : ''}{adjustmentForm.quantityChange})
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={() => setAdjustmentModalOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Apply Adjustment
            </Button>
          </div>
        </form>
      </Modal>

      {/* Stock Count Modal */}
      <Modal
        isOpen={countModalOpen}
        onClose={() => setCountModalOpen(false)}
        title="Start Stock Count"
        size="sm"
      >
        <div className="p-6">
          <p className="text-gray-600 mb-6">
            This will create a new stock count session for all products. 
            You can count inventory and apply corrections as needed.
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setCountModalOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleStartStockCount} className="flex-1">
              <ClipboardList className="w-4 h-4" />
              Start Count
            </Button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}
