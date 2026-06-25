import { useState } from 'react';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useCustomerStore } from '../store/customerStore';
import { useAuthStore } from '../store/authStore';
import { hasPermission } from '../permissions';
import type { Customer } from '../types';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  User,
  Phone,
  Mail,
  Download,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { safeFormat } from '../utils/format';
import { escapeCSV } from '../utils/format';

type CustomerFormData = Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>;

const initialFormData: CustomerFormData = {
  name: '',
  phone: '',
  email: '',
};

export function Customers() {
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<CustomerFormData>(initialFormData);

  const { user } = useAuthStore();
  const canManage = hasPermission(user?.role, 'customers.manage');

  const { customers, addCustomer, updateCustomer, deleteCustomer, searchCustomers } =
    useCustomerStore();

  const filteredCustomers = searchQuery ? searchCustomers(searchQuery) : customers;

  const handleOpenModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        name: customer.name,
        phone: customer.phone,
        email: customer.email || '',
      });
    } else {
      setEditingCustomer(null);
      setFormData(initialFormData);
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingCustomer(null);
    setFormData(initialFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.phone) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (editingCustomer) {
      updateCustomer(editingCustomer.id, formData);
      toast.success('Customer updated successfully');
    } else {
      addCustomer(formData);
      toast.success('Customer added successfully');
    }

    handleCloseModal();
  };

  const handleDelete = () => {
    if (customerToDelete) {
      deleteCustomer(customerToDelete.id);
      toast.success('Customer deleted successfully');
      setDeleteModalOpen(false);
      setCustomerToDelete(null);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Name', 'Phone', 'Email', 'Created At'];
    const rows = filteredCustomers.map((c) => [
      c.name,
      c.phone,
      c.email || '',
      safeFormat(c.createdAt, 'yyyy-MM-dd HH:mm:ss'),
    ]);

    const csv = [headers, ...rows].map((row) => row.map(escapeCSV).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customers.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Customers exported successfully');
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
            <p className="text-gray-600">Manage your customer database</p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={handleExportCSV}>
              <Download className="w-4 h-4" />
              Export
            </Button>
            {canManage && (
              <Button onClick={() => handleOpenModal()}>
                <Plus className="w-4 h-4" />
                Add Customer
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Customers</p>
                <p className="text-xl font-bold text-gray-900">{customers.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Phone className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">With Phone</p>
                <p className="text-xl font-bold text-gray-900">
                  {customers.filter((c) => c.phone).length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Mail className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">With Email</p>
                <p className="text-xl font-bold text-gray-900">
                  {customers.filter((c) => c.email).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customers by name, phone, or email"
            icon={<Search className="w-5 h-5" />}
          />
        </div>

        {/* Customers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.length === 0 ? (
            <div className="col-span-full bg-white rounded-xl shadow-sm p-12 text-center">
              <User className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600">No customers found</p>
            </div>
          ) : (
            filteredCustomers.map((customer) => (
              <div
                key={customer.id}
                className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{customer.name}</h3>
                      <p className="text-sm text-gray-500">
                        Added {safeFormat(customer.createdAt, 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {canManage && (
                      <button
                        onClick={() => handleOpenModal(customer)}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                    {canManage && (
                      <button
                        onClick={() => {
                          setCustomerToDelete(customer);
                          setDeleteModalOpen(true);
                        }}
                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">{customer.phone}</span>
                  </div>
                  {customer.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">{customer.email}</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add/Edit Customer Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={editingCustomer ? 'Edit Customer' : 'Add Customer'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Input
            label="Full Name *"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Enter customer name"
            icon={<User className="w-5 h-5" />}
            required
          />

          <Input
            label="Phone Number *"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+254 700 000 000"
            icon={<Phone className="w-5 h-5" />}
            required
          />

          <Input
            label="Email Address"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="customer@example.com"
            icon={<Mail className="w-5 h-5" />}
          />

          <div className="flex gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={handleCloseModal} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              {editingCustomer ? 'Update Customer' : 'Add Customer'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setCustomerToDelete(null);
        }}
        title="Delete Customer"
        size="sm"
      >
        <div className="p-6">
          <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
            <Trash2 className="w-6 h-6 text-red-600" />
          </div>
          <p className="text-center text-gray-600 mb-6">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-gray-900">{customerToDelete?.name}</span>? This
            action cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setDeleteModalOpen(false);
                setCustomerToDelete(null);
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
