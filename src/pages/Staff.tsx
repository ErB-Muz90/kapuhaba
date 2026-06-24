import React, { useState, useMemo } from 'react';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { useStaffStore } from '../store/staffStore';
import { useAuthStore } from '../store/authStore';
import { useFormatCurrency, escapeCSV } from '../utils/format';
import { ROLE_LABELS, ROLE_COLORS, ROLE_OPTIONS, PERMISSION_GROUPS, hasPermission } from '../permissions';
import type { Staff, StaffOffDay, UserRole } from '../types';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Users,
  UserCheck,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  Download,
  Shield,
  ShieldOff,
  Key,
  Ban,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

type StaffFormData = Omit<Staff, 'id' | 'createdAt' | 'updatedAt' | 'employeeId'>;

const initialFormData: StaffFormData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  role: 'cashier',
  salary: 0,
  hireDate: new Date().toISOString().split('T')[0],
  status: 'active',
  address: '',
  emergencyContact: '',
  hasSystemAccess: false,
};

const roleOptions = ROLE_OPTIONS;

const offDayTypeOptions = [
  { value: 'sick', label: 'Sick Leave' },
  { value: 'vacation', label: 'Vacation' },
  { value: 'personal', label: 'Personal' },
  { value: 'public_holiday', label: 'Public Holiday' },
  { value: 'other', label: 'Other' },
];

type Tab = 'staff' | 'offdays' | 'permissions';

export function Staff() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('staff');
  const isAdmin = user?.role === 'admin';

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
            <p className="text-gray-600">Manage employees, roles, permissions, and off days</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl shadow-sm p-1">
          <button
            onClick={() => setActiveTab('staff')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'staff'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Staff List
          </button>
          <button
            onClick={() => setActiveTab('offdays')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'offdays'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Calendar className="w-4 h-4 inline mr-2" />
            Off Days
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('permissions')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'permissions'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Shield className="w-4 h-4 inline mr-2" />
              Roles & Permissions
            </button>
          )}
        </div>

        {activeTab === 'staff' ? <StaffListTab /> : activeTab === 'offdays' ? <OffDaysTab /> : <PermissionsTab />}
      </div>
    </Layout>
  );
}

function StaffListTab() {
  const $c = useFormatCurrency();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [staffToDelete, setStaffToDelete] = useState<Staff | null>(null);
  const [staffForPassword, setStaffForPassword] = useState<Staff | null>(null);
  const [formData, setFormData] = useState<StaffFormData>(initialFormData);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const { staff, addStaff, updateStaff, deleteStaff, suspendStaff, activateStaff, generateEmployeeId } = useStaffStore();
  const { createStaffAuth, deleteAuthAccount } = useAuthStore();

  const filteredStaff = useMemo(() => {
    let result = staff;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.firstName.toLowerCase().includes(query) ||
          s.lastName.toLowerCase().includes(query) ||
          s.email.toLowerCase().includes(query) ||
          s.employeeId.toLowerCase().includes(query)
      );
    }

    if (roleFilter !== 'all') {
      result = result.filter((s) => s.role === roleFilter);
    }

    if (statusFilter !== 'all') {
      result = result.filter((s) => s.status === statusFilter);
    }

    return result;
  }, [staff, searchQuery, roleFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: staff.length,
    active: staff.filter((s) => s.status === 'active').length,
    suspended: staff.filter((s) => s.status === 'suspended').length,
    totalSalary: staff.filter((s) => s.status === 'active').reduce((sum, s) => sum + s.salary, 0),
  }), [staff]);

  const handleOpenModal = (staffMember?: Staff) => {
    if (staffMember) {
      setEditingStaff(staffMember);
      setFormData({
        firstName: staffMember.firstName,
        lastName: staffMember.lastName,
        email: staffMember.email,
        phone: staffMember.phone,
        role: staffMember.role,
        salary: staffMember.salary,
        hireDate: staffMember.hireDate,
        status: staffMember.status,
        address: staffMember.address || '',
        emergencyContact: staffMember.emergencyContact || '',
        hasSystemAccess: staffMember.hasSystemAccess,
      });
    } else {
      setEditingStaff(null);
      setFormData({
        ...initialFormData,
        hireDate: new Date().toISOString().split('T')[0],
      });
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingStaff(null);
    setFormData(initialFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.firstName || !formData.lastName || !formData.email) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (editingStaff) {
      updateStaff(editingStaff.id, formData);
      // If revoking system access, delete auth account
      if (!formData.hasSystemAccess && editingStaff.hasSystemAccess) {
        deleteAuthAccount(editingStaff.employeeId);
      }
      toast.success('Staff member updated successfully');
    } else {
      const employeeId = generateEmployeeId();
      const newStaff = addStaff({ ...formData, employeeId });

      // If system access requested, create auth with default password
      if (formData.hasSystemAccess) {
        const defaultPw = employeeId.toLowerCase() + '123';
        createStaffAuth(newStaff.id, employeeId, defaultPw, formData.role);
        toast.success(`Staff added. Default password: ${defaultPw}`, { duration: 6000 });
      } else {
        toast.success('Staff member added successfully');
      }
    }

    handleCloseModal();
  };

  const handleDelete = () => {
    if (staffToDelete) {
      // Also delete auth account if exists
      deleteAuthAccount(staffToDelete.employeeId);
      deleteStaff(staffToDelete.id);
      toast.success('Staff member deleted successfully');
      setDeleteModalOpen(false);
      setStaffToDelete(null);
    }
  };

  const handleOpenPasswordModal = (staffMember: Staff) => {
    setStaffForPassword(staffMember);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordModalOpen(true);
  };

  const handleSetPassword = async () => {
    if (!staffForPassword) return;

    if (newPassword.length < 4) {
      toast.error('Password must be at least 4 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    // First ensure auth account exists
    await createStaffAuth(staffForPassword.id, staffForPassword.employeeId, newPassword, staffForPassword.role);

    // Also update the staff to have system access
    if (!staffForPassword.hasSystemAccess) {
      updateStaff(staffForPassword.id, { hasSystemAccess: true });
    }

    toast.success(`Password set for ${staffForPassword.firstName} ${staffForPassword.lastName}`);
    setPasswordModalOpen(false);
    setStaffForPassword(null);
  };

  const handleToggleAccess = (staffMember: Staff) => {
    if (staffMember.hasSystemAccess) {
      deleteAuthAccount(staffMember.employeeId);
      updateStaff(staffMember.id, { hasSystemAccess: false });
      toast.success(`System access revoked for ${staffMember.firstName}`);
    } else {
      const defaultPw = staffMember.employeeId.toLowerCase() + '123';
      createStaffAuth(staffMember.id, staffMember.employeeId, defaultPw, staffMember.role);
      updateStaff(staffMember.id, { hasSystemAccess: true });
      toast.success(`System access granted. Default password: ${defaultPw}`, { duration: 6000 });
    }
  };

  const handleExportCSV = () => {
    const headers = ['Employee ID', 'Name', 'Email', 'Phone', 'Role', 'Salary', 'Hire Date', 'Status', 'System Access'];
    const rows = filteredStaff.map((s) => [
      s.employeeId,
      `${s.firstName} ${s.lastName}`,
      s.email,
      s.phone,
      s.role,
      s.salary,
      s.hireDate,
      s.status,
      s.hasSystemAccess ? 'Yes' : 'No',
    ]);

    const csv = [headers, ...rows].map((row) => row.map(escapeCSV).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'staff.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Staff data exported successfully');
  };

  const getRoleBadgeColor = (role: Staff['role']) => {
    const color = ROLE_COLORS[role];
    return color || 'bg-gray-100 text-gray-700';
  };

  const getStatusBadgeColor = (status: Staff['status']) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'inactive': return 'bg-yellow-100 text-yellow-700';
      case 'suspended': return 'bg-red-100 text-red-700';
      case 'terminated': return 'bg-gray-200 text-gray-600';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <>
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div />
        <div className="flex gap-3">
          <Button variant="secondary" onClick={handleExportCSV}>
            <Download className="w-4 h-4" />
            Export
          </Button>
          {isAdmin && (
            <Button onClick={() => handleOpenModal()}>
              <Plus className="w-4 h-4" />
              Add Staff
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Staff</p>
              <p className="text-xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <UserCheck className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active</p>
              <p className="text-xl font-bold text-gray-900">{stats.active}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Ban className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Suspended</p>
              <p className="text-xl font-bold text-gray-900">{stats.suspended}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Monthly Payroll</p>
              <p className="text-xl font-bold text-gray-900">{$c(stats.totalSalary)}</p>
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
              placeholder="Search by name, email, or employee ID"
              icon={<Search className="w-5 h-5" />}
            />
          </div>
          <div className="flex gap-3">
            <Select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              options={[
                { value: 'all', label: 'All Roles' },
                ...roleOptions,
              ]}
            />
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'suspended', label: 'Suspended' },
                { value: 'terminated', label: 'Terminated' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Staff Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStaff.length === 0 ? (
          <div className="col-span-full bg-white rounded-xl shadow-sm p-12 text-center">
            <Users className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">No staff members found</p>
          </div>
        ) : (
          filteredStaff.map((member) => (
            <div
              key={member.id}
              className={`bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow ${
                member.status === 'suspended' ? 'border-2 border-red-200' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    member.status === 'suspended'
                      ? 'bg-gradient-to-br from-red-400 to-red-500'
                      : 'bg-gradient-to-br from-blue-500 to-blue-600'
                  }`}>
                    <span className="text-lg font-semibold text-white">
                      {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {member.firstName} {member.lastName}
                    </h3>
                    <p className="text-sm text-gray-500">{member.employeeId}</p>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleOpenModal(member)}
                      className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setStaffToDelete(member);
                        setDeleteModalOpen(true);
                      }}
                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600 truncate">{member.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{member.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Hired: {format(new Date(member.hireDate), 'MMM d, yyyy')}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{$c(member.salary)}/month</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {member.hasSystemAccess ? (
                    <Shield className="w-4 h-4 text-green-500" />
                  ) : (
                    <ShieldOff className="w-4 h-4 text-gray-400" />
                  )}
                  <span className="text-gray-600">
                    {member.hasSystemAccess ? 'System access' : 'No system access'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(member.role)}`}>
                  {member.role.replace(/_/g, ' ')}
                </span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(member.status)}`}>
                  {member.status === 'suspended' ? 'Suspended' : member.status}
                </span>
              </div>

              {/* Admin Actions */}
              {isAdmin && (
                <div className="flex flex-wrap gap-2 pt-3 border-t">
                  {member.status === 'active' ? (
                    <button
                      onClick={() => suspendStaff(member.id)}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    >
                      <Ban className="w-3 h-3" />
                      Suspend
                    </button>
                  ) : (
                    <button
                      onClick={() => activateStaff(member.id)}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-50 rounded-md transition-colors"
                    >
                      <CheckCircle className="w-3 h-3" />
                      {member.status === 'suspended' ? 'Unsuspend' : 'Activate'}
                    </button>
                  )}
                  <button
                    onClick={() => handleToggleAccess(member)}
                    className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                      member.hasSystemAccess
                        ? 'text-orange-600 hover:bg-orange-50'
                        : 'text-green-600 hover:bg-green-50'
                    }`}
                  >
                    {member.hasSystemAccess ? <ShieldOff className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                    {member.hasSystemAccess ? 'Revoke Access' : 'Grant Access'}
                  </button>
                  {member.hasSystemAccess && (
                    <button
                      onClick={() => handleOpenPasswordModal(member)}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    >
                      <Key className="w-3 h-3" />
                      Set Password
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Staff Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="First Name *"
              type="text"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              placeholder="Enter first name"
              required
            />
            <Input
              label="Last Name *"
              type="text"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              placeholder="Enter last name"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Email *"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@example.com"
              required
            />
            <Input
              label="Phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+254 700 000 000"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <Select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as Staff['role'] })}
                options={roleOptions}
              />
            </div>
            <Input
              label="Salary (Monthly)"
              type="number"
              value={formData.salary}
              onChange={(e) => setFormData({ ...formData, salary: parseFloat(e.target.value) || 0 })}
              placeholder="0"
              min="0"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Hire Date"
              type="date"
              value={formData.hireDate}
              onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })}
            />
            <Input
              label="Emergency Contact"
              type="text"
              value={formData.emergencyContact || ''}
              onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
              placeholder="Emergency contact number"
            />
          </div>

          <Input
            label="Address"
            type="text"
            value={formData.address || ''}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="Enter address"
          />

          {/* System Access Toggle */}
          {!editingStaff && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.hasSystemAccess}
                  onChange={(e) => setFormData({ ...formData, hasSystemAccess: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <div>
                  <p className="font-medium text-blue-900">Grant System Access</p>
                  <p className="text-sm text-blue-700">
                    Staff will be able to log into the system using Employee ID as username.
                    A default password (EmployeeID + "123") will be generated.
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Show system access status when editing */}
          {editingStaff && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Employee ID</p>
                  <p className="text-sm text-gray-600">{editingStaff.employeeId}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  formData.hasSystemAccess
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {formData.hasSystemAccess ? 'Has System Access' : 'No System Access'}
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={handleCloseModal} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              {editingStaff ? 'Update Staff' : 'Add Staff'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setStaffToDelete(null);
        }}
        title="Delete Staff Member"
        size="sm"
      >
        <div className="p-6">
          <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
            <Trash2 className="w-6 h-6 text-red-600" />
          </div>
          <p className="text-center text-gray-600 mb-6">
            Are you sure you want to permanently delete{' '}
            <span className="font-semibold text-gray-900">
              {staffToDelete?.firstName} {staffToDelete?.lastName}
            </span>? This action cannot be undone. Their system access will also be removed.
          </p>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setDeleteModalOpen(false);
                setStaffToDelete(null);
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

      {/* Set Password Modal */}
      <Modal
        isOpen={passwordModalOpen}
        onClose={() => {
          setPasswordModalOpen(false);
          setStaffForPassword(null);
        }}
        title={`Set Password — ${staffForPassword?.firstName} ${staffForPassword?.lastName}`}
        size="md"
      >
        <div className="p-6 space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            <p className="font-medium mb-1">Employee ID: {staffForPassword?.employeeId}</p>
            <p>Staff will use their Employee ID as the username to log in.</p>
          </div>
          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter new password"
            icon={<Key className="w-5 h-5" />}
          />
          <Input
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            icon={<Key className="w-5 h-5" />}
          />
          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="secondary"
              onClick={() => {
                setPasswordModalOpen(false);
                setStaffForPassword(null);
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button onClick={handleSetPassword} className="flex-1">
              Set Password
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function PermissionsTab() {
  return (
    <div className="space-y-6">
      {/* Legend */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-6 h-6 text-blue-600" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Roles & Permissions</h2>
            <p className="text-sm text-gray-600">Permission matrix for all user roles in the system</p>
          </div>
        </div>
        <p className="text-sm text-gray-500">
          ✓ = has permission &nbsp;·&nbsp; — = no permission
        </p>
      </div>

      {/* Permissions Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600 w-64">Permission</th>
                {(['admin', 'cashier', 'supervisor', 'accountant'] as const).map((role) => (
                  <th key={role} className="text-center px-3 py-3 text-sm font-semibold">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${ROLE_COLORS[role]}`}>
                      {ROLE_LABELS[role]}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {PERMISSION_GROUPS.map((group, gi) => (
                <React.Fragment key={gi}>
                  {/* Group header */}
                  <tr className="bg-gray-50/50">
                    <td
                      colSpan={5}
                      className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider"
                    >
                      {group.group}
                    </td>
                  </tr>
                  {/* Permissions */}
                  {group.permissions.map((perm) => (
                    <tr key={perm.key} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-700">{perm.label}</td>
                      {(['admin', 'cashier', 'supervisor', 'accountant'] as UserRole[]).map((role) => (
                        <td key={role} className="px-3 py-3 text-center">
                          {hasPermission(role, perm.key) ? (
                            <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                          ) : (
                            <XCircle className="w-5 h-5 text-gray-300 mx-auto" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
        <p className="font-medium mb-1">About Roles</p>
        <ul className="space-y-1 list-disc list-inside">
          <li><strong>Administrator</strong> — Full access to all features and settings</li>
          <li><strong>Supervisor</strong> — Manages daily operations, can edit inventory, manage shifts</li>
          <li><strong>Cashier</strong> — Processes sales at the POS, views inventory and customers</li>
          <li><strong>Accountant</strong> — Financial oversight: payables, expenses, reports</li>
        </ul>
        <p className="mt-2">
          Assign roles to staff members in the <strong>Staff List</strong> tab when adding or editing.
        </p>
      </div>
    </div>
  );
}

function OffDaysTab() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const [modalOpen, setModalOpen] = useState(false);
  const [filterStaffId, setFilterStaffId] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [formData, setFormData] = useState<{
    staffId: string;
    type: StaffOffDay['type'];
    date: string;
    endDate: string;
    reason: string;
  }>({
    staffId: '',
    type: 'sick',
    date: new Date().toISOString().split('T')[0],
    endDate: '',
    reason: '',
  });

  const { staff, offDays, addOffDay, deleteOffDay, approveOffDay, rejectOffDay } = useStaffStore();

  const filteredOffDays = useMemo(() => {
    let result = offDays;

    if (filterStaffId !== 'all') {
      result = result.filter((o) => o.staffId === filterStaffId);
    }
    if (filterStatus !== 'all') {
      result = result.filter((o) => o.status === filterStatus);
    }

    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [offDays, filterStaffId, filterStatus]);

  const pendingCount = offDays.filter((o) => o.status === 'pending').length;

  const handleAddOffDay = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.staffId || !formData.date || !formData.reason) {
      toast.error('Please fill in all required fields');
      return;
    }

    const staffMember = staff.find((s) => s.id === formData.staffId);
    if (!staffMember) {
      toast.error('Staff member not found');
      return;
    }

    addOffDay({
      staffId: formData.staffId,
      staffName: `${staffMember.firstName} ${staffMember.lastName}`,
      type: formData.type,
      date: formData.date,
      endDate: formData.endDate || undefined,
      reason: formData.reason,
      status: 'pending',
    });

    toast.success('Off day request submitted for approval');
    setModalOpen(false);
    setFormData({
      staffId: '',
      type: 'sick',
      date: new Date().toISOString().split('T')[0],
      endDate: '',
      reason: '',
    });
  };

  const getOffDayBadgeColor = (status: StaffOffDay['status']) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'rejected': return 'bg-red-100 text-red-700';
    }
  };

  const getTypeBadgeColor = (type: StaffOffDay['type']) => {
    switch (type) {
      case 'sick': return 'bg-red-50 text-red-600';
      case 'vacation': return 'bg-blue-50 text-blue-600';
      case 'personal': return 'bg-purple-50 text-purple-600';
      case 'public_holiday': return 'bg-green-50 text-green-600';
      default: return 'bg-gray-50 text-gray-600';
    }
  };

  return (
    <>
      {/* Off Days Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800">{pendingCount} pending request(s)</span>
            </div>
          )}
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4" />
          Request Off Day
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <Select
            value={filterStaffId}
            onChange={(e) => setFilterStaffId(e.target.value)}
            options={[
              { value: 'all', label: 'All Staff' },
              ...staff.map((s) => ({
                value: s.id,
                label: `${s.firstName} ${s.lastName} (${s.employeeId})`,
              })),
            ]}
          />
          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'pending', label: 'Pending' },
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' },
            ]}
          />
        </div>
      </div>

      {/* Off Days List */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {filteredOffDays.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">No off day records found</p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredOffDays.map((offDay) => (
              <div key={offDay.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{offDay.staffName}</span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getTypeBadgeColor(offDay.type)}`}>
                        {offDay.type.replace(/_/g, ' ')}
                      </span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getOffDayBadgeColor(offDay.status)}`}>
                        {offDay.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        {format(new Date(offDay.date), 'MMM d, yyyy')}
                        {offDay.endDate && ` — ${format(new Date(offDay.endDate), 'MMM d, yyyy')}`}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{offDay.reason}</p>
                    {offDay.approvedBy && (
                      <p className="text-xs text-gray-400 mt-1">Approved by: {offDay.approvedBy}</p>
                    )}
                  </div>

                  {/* Admin Actions */}
                  {isAdmin && offDay.status === 'pending' && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => approveOffDay(offDay.id, user?.username || 'admin')}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Approve"
                      >
                        <CheckCircle className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => rejectOffDay(offDay.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Reject"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => {
                          deleteOffDay(offDay.id);
                          toast.success('Off day record deleted');
                        }}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Off Day Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Request Off Day"
        size="md"
      >
        <form onSubmit={handleAddOffDay} className="p-6 space-y-4">
          <Select
            label="Staff Member *"
            value={formData.staffId}
            onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
            options={[
              { value: '', label: 'Select staff member...' },
              ...staff.filter((s) => s.status === 'active').map((s) => ({
                value: s.id,
                label: `${s.firstName} ${s.lastName} (${s.employeeId})`,
              })),
            ]}
          />
          <Select
            label="Leave Type *"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as StaffOffDay['type'] })}
            options={offDayTypeOptions}
          />
          <Input
            label="Date *"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
          />
          <Input
            label="End Date (if multi-day)"
            type="date"
            value={formData.endDate}
            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
          />
          <Input
            label="Reason *"
            type="text"
            value={formData.reason}
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            placeholder="Enter reason for leave"
            required
          />
          <div className="flex gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Submit Request
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
