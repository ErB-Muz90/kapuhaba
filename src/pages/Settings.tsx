import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  Percent,
  DollarSign,
  Save,
  Users,
  Shield,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';

export function Settings() {
  const { settings, updateSettings } = useSettingsStore();
  const { user } = useAuthStore();
  const [formData, setFormData] = useState(settings);

  const handleSaveSettings = () => {
    updateSettings(formData);
    toast.success('Settings saved successfully');
  };

  const handleResetData = () => {
    if (confirm('Are you sure you want to reset all data? This will clear all products, customers, and sales. This action cannot be undone.')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  // Only admins can access this page
  if (user?.role !== 'admin') {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Shield className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900">Access Denied</h2>
            <p className="text-gray-600 mt-2">
              You don't have permission to access this page.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">Manage your business settings</p>
        </div>

        {/* Business Information */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-6 border-b">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Business Information</h2>
                <p className="text-sm text-gray-600">Update your business details</p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Business Name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter business name"
                icon={<Building2 className="w-5 h-5" />}
              />
              <Input
                label="Phone Number"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+254 700 000 000"
                icon={<Phone className="w-5 h-5" />}
              />
            </div>
            <Input
              label="Email Address"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="info@business.com"
              icon={<Mail className="w-5 h-5" />}
            />
            <Input
              label="Address"
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Enter business address"
              icon={<MapPin className="w-5 h-5" />}
            />
          </div>
        </div>

        {/* Tax & Currency */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-6 border-b">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Tax & Currency</h2>
                <p className="text-sm text-gray-600">Configure tax rate and currency</p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>VAT-Inclusive Pricing:</strong> All selling prices include VAT.
                The system automatically extracts the VAT-exclusive subtotal and VAT amount at checkout.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="VAT Rate (%)"
                type="number"
                value={(formData.taxRate * 100).toFixed(0)}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    taxRate: parseFloat(e.target.value) / 100 || 0,
                  })
                }
                placeholder="16"
                min="0"
                max="100"
                icon={<Percent className="w-5 h-5" />}
              />
              <Input
                label="Currency Code"
                type="text"
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                placeholder="KES"
              />
              <Input
                label="Currency Symbol"
                type="text"
                value={formData.currencySymbol}
                onChange={(e) =>
                  setFormData({ ...formData, currencySymbol: e.target.value })
                }
                placeholder="KSh"
              />
            </div>
            
            {/* Loyalty Settings */}
            <div className="mt-6 pt-6 border-t">
              <h4 className="font-medium text-gray-900 mb-4">Loyalty Program Settings</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Points per Currency Unit"
                  type="number"
                  value={formData.loyaltyPointsPerCurrency}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      loyaltyPointsPerCurrency: parseInt(e.target.value) || 100,
                    })
                  }
                  placeholder="100"
                  min="1"
                />
                <Input
                  label="Point Redemption Value"
                  type="number"
                  value={formData.loyaltyRedemptionRate}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      loyaltyRedemptionRate: parseFloat(e.target.value) || 1,
                    })
                  }
                  placeholder="1"
                  min="0.01"
                  step="0.01"
                />
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Customers earn 1 point for every {formData.loyaltyPointsPerCurrency} {formData.currency} spent.
                Each point is worth {formData.currencySymbol} {formData.loyaltyRedemptionRate} when redeemed.
              </p>
            </div>
            
            {/* Shift & Float Settings */}
            <div className="mt-6 pt-6 border-t">
              <h4 className="font-medium text-gray-900 mb-4">Shift & Cash Drawer Settings</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Default Starting Float"
                  type="number"
                  value={formData.defaultFloat}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      defaultFloat: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="5000"
                  min="0"
                />
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Default amount to start each shift with. Can be overridden when starting a shift.
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSaveSettings} size="lg">
            <Save className="w-4 h-4" />
            Save Settings
          </Button>
        </div>

        {/* User Info */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Staff & System Access</h2>
                <p className="text-sm text-gray-600">
                  User management has moved to the{' '}
                  <Link to="/staff" className="text-blue-600 hover:text-blue-800 underline font-medium">Staff Management</Link> page.
                  Add staff members, grant system access, and manage passwords there.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-red-50 border border-red-200 rounded-xl">
          <div className="p-6 border-b border-red-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-red-900">Danger Zone</h2>
                <p className="text-sm text-red-700">Irreversible actions</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-red-900">Reset All Data</p>
                <p className="text-sm text-red-700">
                  This will delete all products, customers, sales, and settings.
                </p>
              </div>
              <Button variant="danger" onClick={handleResetData}>
                Reset Data
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
