import { useState, useMemo } from 'react';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { useSupplierStore } from '../store/supplierStore';
import { useFormatCurrency, escapeCSV } from '../utils/format';
import { useAuthStore } from '../store/authStore';
import { hasPermission } from '../permissions';
import type { Supplier } from '../types';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Truck,
  Phone,
  Mail,
  MapPin,
  Building2,
  Download,
  ShoppingBag,
} from 'lucide-react';
import toast from 'react-hot-toast';

type SupplierFormData = Omit<Supplier, 'id' | 'totalOrders' | 'totalSpent' | 'createdAt' | 'updatedAt'>;

const initialFormData: SupplierFormData = {
  name: '',
  contactPerson: '',
  email: '',
  phone: '',
  address: '',
  taxId: '',
  paymentTerms: 30,
  status: 'active',
  notes: '',
};

export function Suppliers() {
  const $c = useFormatCurrency();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState<SupplierFormData>(initialFormData);

  const { user } = useAuthStore();
  const canManage = hasPermission(user?.role, 'suppliers.manage');

  const { suppliers, addSupplier, updateSupplier, deleteSupplier, searchSuppliers } = useSupplierStore();

  const filteredSuppliers = useMemo(() => {
    let result = searchQuery ? searchSuppliers(searchQuery) : suppliers;

    if (statusFilter !== 'all') {
      result = result.filter((s) => s.status === statusFilter);
    }

    return result;
  }, [suppliers, searchQuery, statusFilter, searchSuppliers]);

  const stats = useMemo(() => ({
    total: suppliers.length,
    active: suppliers.filter((s) => s.status === 'active').length,
    totalSpent: suppliers.reduce((sum, s) => sum + s.totalSpent, 0),
    totalOrders: suppliers.reduce((sum, s) => sum + s.totalOrders, 0),
  }), [suppliers]);

  const handleOpenModal = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({
        name: supplier.name,
        contactPerson: supplier.contactPerson,
        email: supplier.email,
        phone: supplier.phone,
        address: supplier.address,
        taxId: supplier.taxId || '',
        paymentTerms: supplier.paymentTerms,
        status: supplier.status,
        notes: supplier.notes || '',
      });
    } else {
      setEditingSupplier(null);
      setFormData(initialFormData);
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingSupplier(null);
    setFormData(initialFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.phone) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (editingSupplier) {
      updateSupplier(editingSupplier.id, formData);
      toast.success('Supplier updated successfully');
    } else {
      addSupplier(formData);
      toast.success('Supplier added successfully');
    }

    handleCloseModal();
  };

  const handleDelete = () => {
    if (supplierToDelete) {
      deleteSupplier(supplierToDelete.id);
      toast.success('Supplier deleted successfully');
      setDeleteModalOpen(false);
      setSupplierToDelete(null);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Name', 'Contact Person', 'Email', 'Phone', 'Payment Terms', 'Total Orders', 'Total Spent', 'Status'];
    const rows = filteredSuppliers.map((s) => [
      s.name,
      s.contactPerson,
      s.email,
      s.phone,
      `${s.paymentTerms} days`,
      s.totalOrders,
      s.totalSpent,
      s.status,
    ]);

    const csv = [headers, ...rows].map((row) => row.map(escapeCSV).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'suppliers.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Suppliers exported successfully');
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
            <p className="text-gray-600">Manage your suppliers and vendors</p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={handleExportCSV}>
              <Download className="w-4 h-4" />
              Export
            </Button>
            {canManage && (
              <Button onClick={() => handleOpenModal()}>
                <Plus className="w-4 h-4" />
                Add Supplier
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Truck className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Suppliers</p>
                <p className="text-xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Building2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Active</p>
                <p className="text-xl font-bold text-gray-900">{stats.active}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <ShoppingBag className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Orders</p>
                <p className="text-xl font-bold text-gray-900">{stats.totalOrders}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Truck className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Purchased</p>
                <p className="text-xl font-bold text-gray-900">{$c(stats.totalSpent)}</p>
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
                placeholder="Search suppliers by name, contact, or email"
                icon={<Search className="w-5 h-5" />}
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
            />
          </div>
        </div>

        {/* Suppliers Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Supplier</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Contact</th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-gray-600">Payment Terms</th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-gray-600">Orders</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">Total Spent</th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-gray-600">Status</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      <Truck className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No suppliers found</p>
                    </td>
                  </tr>
                ) : (
                  filteredSuppliers.map((supplier) => (
                    <tr key={supplier.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{supplier.name}</p>
                            <p className="text-sm text-gray-500">{supplier.contactPerson}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="text-sm text-gray-600 flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {supplier.email}
                          </p>
                          <p className="text-sm text-gray-600 flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {supplier.phone}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">
                          {supplier.paymentTerms} days
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-600">
                        {supplier.totalOrders}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                        {$c(supplier.totalSpent)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          supplier.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {supplier.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {canManage && (
                            <button
                              onClick={() => handleOpenModal(supplier)}
                              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {canManage && (
                            <button
                              onClick={() => {
                                setSupplierToDelete(supplier);
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

      {/* Add/Edit Supplier Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Company Name *"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter company name"
              required
            />
            <Input
              label="Contact Person *"
              type="text"
              value={formData.contactPerson}
              onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
              placeholder="Contact person name"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Email *"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="supplier@example.com"
              required
            />
            <Input
              label="Phone *"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+254 700 000 000"
              required
            />
          </div>

          <Input
            label="Address"
            type="text"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="Enter supplier address"
            icon={<MapPin className="w-5 h-5" />}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Tax ID / KRA PIN"
              type="text"
              value={formData.taxId || ''}
              onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
              placeholder="A123456789"
            />
            <Input
              label="Payment Terms (days)"
              type="number"
              value={formData.paymentTerms}
              onChange={(e) => setFormData({ ...formData, paymentTerms: parseInt(e.target.value) || 30 })}
              placeholder="30"
              min="0"
            />
            <Select
              label="Status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as Supplier['status'] })}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes about this supplier"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={handleCloseModal} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              {editingSupplier ? 'Update Supplier' : 'Add Supplier'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setSupplierToDelete(null);
        }}
        title="Delete Supplier"
        size="sm"
      >
        <div className="p-6">
          <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
            <Trash2 className="w-6 h-6 text-red-600" />
          </div>
          <p className="text-center text-gray-600 mb-6">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-gray-900">{supplierToDelete?.name}</span>? This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setDeleteModalOpen(false);
                setSupplierToDelete(null);
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
    </Layout>
  );
}
