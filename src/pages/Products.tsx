import { useState, useMemo, useRef, useCallback } from 'react';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { useProductStore } from '../store/productStore';
import { useFormatCurrency, escapeCSV, parseImportCSV, IMPORT_HEADER_DISPLAY } from '../utils/format';
import { useAuthStore } from '../store/authStore';
import { hasPermission } from '../permissions';
import type { Product } from '../types';
import type { ParsedImportRow } from '../utils/format';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Package,
  AlertTriangle,
  Download,
  Upload,
  Barcode,
  FileUp,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';

type ProductFormData = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>;

const initialFormData: ProductFormData = {
  name: '',
  sku: '',
  barcode: '',
  buyingPrice: 0,
  sellingPrice: 0,
  stockQuantity: 0,
  category: '',
  lowStockThreshold: 5,
};

export function Products() {
  const $c = useFormatCurrency();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(initialFormData);

  // Import state
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<{
    valid: ParsedImportRow[];
    errors: { row: number; message: string }[];
  } | null>(null);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    updated: number;
    errors: { row: number; message: string }[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { user } = useAuthStore();
  const { products, addProduct, updateProduct, deleteProduct, searchProducts, importProducts } = useProductStore();
  const canEdit = hasPermission(user?.role, 'inventory.edit');
  const canDelete = hasPermission(user?.role, 'inventory.delete');

  const categories = useMemo(() => {
    return ['all', ...new Set(products.map((p) => p.category))];
  }, [products]);

  const filteredProducts = useMemo(() => {
    let result = searchQuery ? searchProducts(searchQuery) : products;

    if (categoryFilter !== 'all') {
      result = result.filter((p) => p.category === categoryFilter);
    }

    if (stockFilter === 'low') {
      result = result.filter((p) => p.stockQuantity <= p.lowStockThreshold && p.stockQuantity > 0);
    } else if (stockFilter === 'out') {
      result = result.filter((p) => p.stockQuantity === 0);
    } else if (stockFilter === 'in') {
      result = result.filter((p) => p.stockQuantity > p.lowStockThreshold);
    }

    return result;
  }, [products, searchQuery, categoryFilter, stockFilter, searchProducts]);

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        buyingPrice: product.buyingPrice,
        sellingPrice: product.sellingPrice,
        stockQuantity: product.stockQuantity,
        category: product.category,
        lowStockThreshold: product.lowStockThreshold,
      });
    } else {
      setEditingProduct(null);
      setFormData(initialFormData);
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingProduct(null);
    setFormData(initialFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.sku) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formData.sellingPrice > 0 && formData.buyingPrice > formData.sellingPrice) {
      toast.error('Selling price must be greater than buying price');
      return;
    }

    if (formData.name.length > 200) {
      toast.error('Product name must be under 200 characters');
      return;
    }

    if (editingProduct) {
      updateProduct(editingProduct.id, formData);
      toast.success('Product updated successfully');
    } else {
      addProduct(formData);
      toast.success('Product added successfully');
    }

    handleCloseModal();
  };

  const handleDelete = () => {
    if (productToDelete) {
      deleteProduct(productToDelete.id);
      toast.success('Product deleted successfully');
      setDeleteModalOpen(false);
      setProductToDelete(null);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Name', 'SKU', 'Barcode', 'Category', 'Buying Price', 'Selling Price', 'Stock', 'Low Stock Threshold'];
    const rows = filteredProducts.map((p) => [
      p.name,
      p.sku,
      p.barcode,
      p.category,
      p.buyingPrice,
      p.sellingPrice,
      p.stockQuantity,
      p.lowStockThreshold,
    ]);

    const csv = [headers, ...rows].map((row) => row.map(escapeCSV).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Products exported successfully');
  };

  // --- Import Handlers ---

  const handleFileSelect = useCallback((file: File) => {
    setImportResult(null);
    setImportPreview(null);

    if (!file.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        toast.error('Failed to read file');
        return;
      }
      const parsed = parseImportCSV(text);
      setImportPreview(parsed);

      if (parsed.errors.length > 0 && parsed.valid.length === 0) {
        toast.error(`Found ${parsed.errors.length} error(s) — check the preview for details`);
      } else if (parsed.valid.length > 0) {
        toast.success(`${parsed.valid.length} product(s) ready to import`);
      }
    };
    reader.onerror = () => toast.error('Failed to read file');
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleImport = async () => {
    if (!importPreview || importPreview.valid.length === 0) return;

    setImporting(true);
    try {
      const result = await importProducts(importPreview.valid);
      setImportResult(result);
      setImportPreview(null);

      const total = result.imported + result.updated;
      if (total > 0) {
        toast.success(`${total} product(s) imported/updated successfully`);
      }
      if (result.errors.length > 0) {
        toast.error(`${result.errors.length} error(s) during import`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed');
    }
    setImporting(false);
  };

  const handleCloseImport = () => {
    setImportModalOpen(false);
    setImportPreview(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const lowStockCount = products.filter((p) => p.stockQuantity <= p.lowStockThreshold && p.stockQuantity > 0).length;
  const outOfStockCount = products.filter((p) => p.stockQuantity === 0).length;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Products</h1>
            <p className="text-gray-600">Manage your inventory</p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={handleExportCSV}>
              <Download className="w-4 h-4" />
              Export
            </Button>
            <Button variant="secondary" onClick={() => setImportModalOpen(true)}>
              <Upload className="w-4 h-4" />
              Import
            </Button>
            {canEdit && (
              <Button onClick={() => handleOpenModal()}>
                <Plus className="w-4 h-4" />
                Add Product
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
                <Package className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">In Stock</p>
                <p className="text-xl font-bold text-gray-900">
                  {products.length - lowStockCount - outOfStockCount}
                </p>
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
                <p className="text-xl font-bold text-gray-900">{lowStockCount}</p>
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
                <p className="text-xl font-bold text-gray-900">{outOfStockCount}</p>
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
                placeholder="Search products by name, SKU, or barcode"
                icon={<Search className="w-5 h-5" />}
              />
            </div>
            <div className="flex gap-3">
              <Select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                options={categories.map((c) => ({
                  value: c,
                  label: c === 'all' ? 'All Categories' : c,
                }))}
              />
              <Select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value)}
                options={[
                  { value: 'all', label: 'All Stock' },
                  { value: 'in', label: 'In Stock' },
                  { value: 'low', label: 'Low Stock' },
                  { value: 'out', label: 'Out of Stock' },
                ]}
              />
            </div>
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                    Product
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                    SKU / Barcode
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                    Category
                  </th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">
                    Buying Price
                  </th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">
                    Selling Price (Incl. VAT)
                  </th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-gray-600">
                    Stock
                  </th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No products found</p>
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Package className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{product.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-900">{product.sku}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Barcode className="w-3 h-3" />
                          {product.barcode}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">
                          {product.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-600">
                        {$c(product.buyingPrice)}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                        {$c(product.sellingPrice)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-sm font-medium ${
                            product.stockQuantity === 0
                              ? 'bg-red-100 text-red-700'
                              : product.stockQuantity <= product.lowStockThreshold
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {product.stockQuantity === 0 && (
                            <AlertTriangle className="w-3 h-3 mr-1" />
                          )}
                          {product.stockQuantity}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {canEdit && (
                            <button
                              onClick={() => handleOpenModal(product)}
                              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => {
                                setProductToDelete(product);
                                setDeleteModalOpen(true);
                              }}
                              className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
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

      {/* Add/Edit Product Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={editingProduct ? 'Edit Product' : 'Add Product'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Product Name *"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter product name"
              maxLength={200}
              required
            />
            <Input
              label="Category"
              type="text"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              placeholder="e.g., Electronics"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Input
                label="SKU"
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="Leave empty to auto-generate"
              />
              {!editingProduct && (
                <button
                  type="button"
                  onClick={() => {
                    const gen = useProductStore.getState().generateSKU(formData.name, formData.category);
                    setFormData({ ...formData, sku: gen });
                  }}
                  className="absolute right-2 top-8 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                  title="Auto-generate SKU"
                >
                  <Barcode className="w-4 h-4" />
                </button>
              )}
            </div>
            <Input
              label="Barcode"
              type="text"
              value={formData.barcode}
              onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
              placeholder="e.g., 1234567890123"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Buying Price (VAT Incl.)"
              type="number"
              value={formData.buyingPrice}
              onChange={(e) =>
                setFormData({ ...formData, buyingPrice: parseFloat(e.target.value) || 0 })
              }
              placeholder="0.00"
              min="0"
              step="0.01"
            />
            <Input
              label="Selling Price (VAT Incl.) *"
              type="number"
              value={formData.sellingPrice}
              onChange={(e) =>
                setFormData({ ...formData, sellingPrice: parseFloat(e.target.value) || 0 })
              }
              placeholder="0.00"
              min="0"
              step="0.01"
              required
            />
          </div>
          <p className="text-sm text-gray-500 mt-2">
            <strong>Note:</strong> Both buying and selling prices are VAT-inclusive. 
            VAT (16%) will be extracted for accounting purposes.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Stock Quantity"
              type="number"
              value={formData.stockQuantity}
              onChange={(e) =>
                setFormData({ ...formData, stockQuantity: parseInt(e.target.value) || 0 })
              }
              placeholder="0"
              min="0"
            />
            <Input
              label="Low Stock Threshold"
              type="number"
              value={formData.lowStockThreshold}
              onChange={(e) =>
                setFormData({ ...formData, lowStockThreshold: parseInt(e.target.value) || 0 })
              }
              placeholder="5"
              min="0"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={handleCloseModal} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              {editingProduct ? 'Update Product' : 'Add Product'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setProductToDelete(null);
        }}
        title="Delete Product"
        size="sm"
      >
        <div className="p-6">
          <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
            <Trash2 className="w-6 h-6 text-red-600" />
          </div>
          <p className="text-center text-gray-600 mb-6">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-gray-900">{productToDelete?.name}</span>? This
            action cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setDeleteModalOpen(false);
                setProductToDelete(null);
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} className="flex-1">
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Import Modal */}
      <Modal
        isOpen={importModalOpen}
        onClose={handleCloseImport}
        title="Import Inventory (CSV)"
        size="full"
      >
        <div className="p-6 space-y-6">
          {/* Instructions */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800 space-y-2">
            <p className="font-semibold flex items-center gap-2">
              <FileUp className="w-4 h-4" />
              CSV Format Instructions
            </p>
            <p>Upload a CSV file with the following columns. The header row is required.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
              {IMPORT_HEADER_DISPLAY.map((col) => (
                <span key={col} className="px-2 py-1 bg-blue-100 rounded text-xs font-medium">
                  {col}
                </span>
              ))}
            </div>
            <p className="text-blue-600 text-xs">
              Required columns: <strong>Name, SKU, Buying Price, Selling Price</strong>.
              Products with matching SKUs will be <strong>updated</strong> instead of duplicated.
            </p>
          </div>

          {/* Upload Area */}
          {!importPreview && !importResult && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
            >
              <FileUp className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-700 mb-1">
                Drop your CSV file here, or click to browse
              </p>
              <p className="text-sm text-gray-500 mb-4">
                File must be a .csv with proper header row
              </p>
              <Button type="button" variant="secondary">
                <Upload className="w-4 h-4" />
                Select CSV File
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
              />
            </div>
          )}

          {/* Preview */}
          {importPreview && (
            <>
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-center">
                  <p className="text-2xl font-bold text-green-700">{importPreview.valid.length}</p>
                  <p className="text-sm text-green-600">Ready to Import</p>
                </div>
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-center">
                  <p className="text-2xl font-bold text-yellow-700">{importPreview.errors.length}</p>
                  <p className="text-sm text-yellow-600">Errors</p>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-center">
                  <p className="text-2xl font-bold text-blue-700">
                    {importPreview.valid.length + importPreview.errors.length}
                  </p>
                  <p className="text-sm text-blue-600">Total Rows</p>
                </div>
              </div>

              {/* Parse Errors */}
              {importPreview.errors.length > 0 && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                  <h4 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    Parse Errors
                  </h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {importPreview.errors.map((err, i) => (
                      <p key={i} className="text-sm text-red-700">• {err.message}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview Table */}
              {importPreview.valid.length > 0 && (
                <div className="border rounded-xl overflow-hidden">
                  <div className="overflow-x-auto max-h-80 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-left px-4 py-3 font-semibold text-gray-600">#</th>
                          <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
                          <th className="text-left px-4 py-3 font-semibold text-gray-600">SKU</th>
                          <th className="text-left px-4 py-3 font-semibold text-gray-600">Category</th>
                          <th className="text-right px-4 py-3 font-semibold text-gray-600">Buying</th>
                          <th className="text-right px-4 py-3 font-semibold text-gray-600">Selling</th>
                          <th className="text-center px-4 py-3 font-semibold text-gray-600">Stock</th>
                          <th className="text-center px-4 py-3 font-semibold text-gray-600">Threshold</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {importPreview.valid.map((row, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 text-gray-500">{i + 1}</td>
                            <td className="px-4 py-2.5 font-medium text-gray-900">{row.name}</td>
                            <td className="px-4 py-2.5 text-gray-700">{row.sku}</td>
                            <td className="px-4 py-2.5">
                              {row.category ? (
                                <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                                  {row.category}
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right text-gray-700">
                              {$c(row.buyingPrice)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                              {$c(row.sellingPrice)}
                            </td>
                            <td className="px-4 py-2.5 text-center">{row.stockQuantity}</td>
                            <td className="px-4 py-2.5 text-center">{row.lowStockThreshold}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <Button variant="secondary" onClick={handleCloseImport} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={importPreview.valid.length === 0 || importing}
                  className="flex-1"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Import {importPreview.valid.length} Product{importPreview.valid.length !== 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {/* Import Result */}
          {importResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-center">
                  <CheckCircle className="w-6 h-6 mx-auto text-green-600 mb-1" />
                  <p className="text-2xl font-bold text-green-700">{importResult.imported}</p>
                  <p className="text-sm text-green-600">New Products</p>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-center">
                  <AlertTriangle className="w-6 h-6 mx-auto text-blue-600 mb-1" />
                  <p className="text-2xl font-bold text-blue-700">{importResult.updated}</p>
                  <p className="text-sm text-blue-600">Updated (SKU match)</p>
                </div>
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-center">
                  <XCircle className="w-6 h-6 mx-auto text-yellow-600 mb-1" />
                  <p className="text-2xl font-bold text-yellow-700">{importResult.skipped}</p>
                  <p className="text-sm text-yellow-600">Skipped</p>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                  <h4 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Import Errors
                  </h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {importResult.errors.map((err, i) => (
                      <p key={i} className="text-sm text-red-700">• {err.message}</p>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t">
                <Button variant="secondary" onClick={handleCloseImport} className="flex-1">
                  Close
                </Button>
                <Button onClick={() => { setImportResult(null); setImportPreview(null); }} className="flex-1">
                  <Upload className="w-4 h-4" />
                  Import Another File
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </Layout>
  );
}
