import { useState, useMemo } from 'react';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useLoyaltyStore } from '../store/loyaltyStore';
import { useCustomerStore } from '../store/customerStore';
import { useSettingsStore } from '../store/settingsStore';
import {
  Search,
  Plus,
  Gift,
  Star,
  TrendingUp,
  Users,
  Award,
  Coins,
  History,
  Crown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export function Loyalty() {
  const [searchQuery, setSearchQuery] = useState('');
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [adjustmentForm, setAdjustmentForm] = useState({
    points: 0,
    description: '',
  });

  const { 
    accounts, 
    transactions, 
    tiers,
    createAccount, 
    adjustPoints,
    getTotalActiveMembers,
    getTotalPointsOutstanding,
    getMembersByTier,
  } = useLoyaltyStore();
  const { customers } = useCustomerStore();
  const { settings } = useSettingsStore();

  const filteredAccounts = useMemo(() => {
    if (!searchQuery) return accounts;
    const query = searchQuery.toLowerCase();
    return accounts.filter(
      (a) =>
        a.customerName.toLowerCase().includes(query) ||
        a.phone.includes(searchQuery)
    );
  }, [accounts, searchQuery]);

  const stats = useMemo(() => ({
    totalMembers: getTotalActiveMembers(),
    totalPoints: getTotalPointsOutstanding(),
    membersByTier: getMembersByTier(),
  }), [accounts]);

  const recentTransactions = useMemo(() => 
    transactions.slice(0, 20),
    [transactions]
  );

  // Customers not yet enrolled
  const eligibleCustomers = useMemo(() => 
    customers.filter((c) => !accounts.find((a) => a.customerId === c.id)),
    [customers, accounts]
  );

  const handleEnroll = (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return;

    createAccount(customer.id, customer.name, customer.phone);
    toast.success(`${customer.name} enrolled in loyalty program!`);
    setEnrollModalOpen(false);
  };

  const handleAdjustPoints = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAccount || adjustmentForm.points === 0 || !adjustmentForm.description) {
      toast.error('Please fill in all fields');
      return;
    }

    adjustPoints(selectedAccount, adjustmentForm.points, adjustmentForm.description);
    toast.success('Points adjusted successfully');
    setAdjustModalOpen(false);
    setSelectedAccount(null);
    setAdjustmentForm({ points: 0, description: '' });
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'bronze': return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'silver': return 'bg-gray-100 text-gray-700 border-gray-300';
      case 'gold': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'platinum': return 'bg-purple-100 text-purple-700 border-purple-300';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'platinum': return <Crown className="w-4 h-4" />;
      case 'gold': return <Award className="w-4 h-4" />;
      case 'silver': return <Star className="w-4 h-4" />;
      default: return <Star className="w-4 h-4" />;
    }
  };

  const formatPoints = (points: number) => {
    return (points ?? 0).toLocaleString();
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Customer Loyalty</h1>
            <p className="text-gray-600">Manage loyalty program and rewards</p>
          </div>
          <Button onClick={() => setEnrollModalOpen(true)}>
            <Plus className="w-4 h-4" />
            Enroll Customer
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Members</p>
                <p className="text-xl font-bold text-gray-900">{stats.totalMembers}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Coins className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Points Outstanding</p>
                <p className="text-xl font-bold text-gray-900">{formatPoints(stats.totalPoints)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Award className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Gold+ Members</p>
                <p className="text-xl font-bold text-gray-900">
                  {stats.membersByTier.gold + stats.membersByTier.platinum}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Gift className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Point Value</p>
                <p className="text-xl font-bold text-gray-900">
                  {settings.currencySymbol} {(stats.totalPoints * settings.loyaltyRedemptionRate).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tier Distribution */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Membership Tiers</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {tiers.map((tier) => (
              <div key={tier.name} className={`p-4 rounded-lg border-2 ${getTierColor(tier.name)}`}>
                <div className="flex items-center gap-2 mb-2">
                  {getTierIcon(tier.name)}
                  <span className="font-semibold capitalize">{tier.name}</span>
                </div>
                <p className="text-2xl font-bold">{stats.membersByTier[tier.name]}</p>
                <p className="text-sm opacity-75">{tier.multiplier}x points</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Member List */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Members</h2>
              </div>
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or phone"
                icon={<Search className="w-5 h-5" />}
              />
            </div>
            <div className="divide-y max-h-[500px] overflow-y-auto">
              {filteredAccounts.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No members found</p>
                </div>
              ) : (
                filteredAccounts.map((account) => (
                  <div key={account.customerId} className="p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold">
                            {account.customerName.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{account.customerName}</p>
                          <p className="text-sm text-gray-500">{account.phone}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${getTierColor(account.tier)}`}>
                            {getTierIcon(account.tier)}
                            {account.tier}
                          </span>
                        </div>
                        <p className="text-lg font-bold text-gray-900">
                          {formatPoints(account.pointsBalance)} pts
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="text-gray-500">
                        Total earned: {formatPoints(account.totalPointsEarned)} pts
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedAccount(account.customerId);
                          setAdjustModalOpen(true);
                        }}
                      >
                        Adjust Points
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <History className="w-5 h-5 text-gray-500" />
                Recent Activity
              </h2>
            </div>
            <div className="divide-y max-h-[500px] overflow-y-auto">
              {recentTransactions.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No activity yet</p>
                </div>
              ) : (
                recentTransactions.map((tx) => {
                  const account = accounts.find((a) => a.customerId === tx.customerId);
                  return (
                    <div key={tx.id} className="p-4">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-gray-900 truncate">
                          {account?.customerName || 'Unknown'}
                        </p>
                        <span className={`text-sm font-semibold ${
                          tx.points > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {tx.points > 0 ? '+' : ''}{formatPoints(tx.points)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">{tx.description}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {format(new Date(tx.createdAt), 'MMM d, HH:mm')}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Program Info */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-sm p-6 text-white">
          <h3 className="text-lg font-semibold mb-4">Loyalty Program Rules</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Coins className="w-5 h-5" />
                <span className="font-medium">Earning Points</span>
              </div>
              <p className="text-sm text-blue-100">
                Customers earn 1 point for every {settings.currencySymbol} {settings.loyaltyPointsPerCurrency} spent.
                Higher tiers earn bonus multipliers!
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Gift className="w-5 h-5" />
                <span className="font-medium">Redeeming Points</span>
              </div>
              <p className="text-sm text-blue-100">
                1 point = {settings.currencySymbol} {settings.loyaltyRedemptionRate} discount.
                Points can be redeemed at checkout.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5" />
                <span className="font-medium">Tier Benefits</span>
              </div>
              <p className="text-sm text-blue-100">
                Bronze: 1x • Silver: 1.25x • Gold: 1.5x • Platinum: 2x points multiplier
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Enroll Customer Modal */}
      <Modal
        isOpen={enrollModalOpen}
        onClose={() => setEnrollModalOpen(false)}
        title="Enroll Customer in Loyalty Program"
        size="md"
      >
        <div className="p-6">
          {eligibleCustomers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p className="text-gray-600">All customers are already enrolled!</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {eligibleCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div>
                    <p className="font-medium text-gray-900">{customer.name}</p>
                    <p className="text-sm text-gray-500">{customer.phone}</p>
                  </div>
                  <Button size="sm" onClick={() => handleEnroll(customer.id)}>
                    Enroll
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 pt-4 border-t">
            <Button variant="secondary" onClick={() => setEnrollModalOpen(false)} className="w-full">
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Adjust Points Modal */}
      <Modal
        isOpen={adjustModalOpen}
        onClose={() => {
          setAdjustModalOpen(false);
          setSelectedAccount(null);
          setAdjustmentForm({ points: 0, description: '' });
        }}
        title="Adjust Points"
        size="sm"
      >
        <form onSubmit={handleAdjustPoints} className="p-6 space-y-4">
          {selectedAccount && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                Current Balance:{' '}
                <strong>
                  {formatPoints(accounts.find((a) => a.customerId === selectedAccount)?.pointsBalance || 0)} pts
                </strong>
              </p>
            </div>
          )}

          <Input
            label="Points (+ to add, - to remove)"
            type="number"
            value={adjustmentForm.points}
            onChange={(e) => setAdjustmentForm({ ...adjustmentForm, points: parseInt(e.target.value) || 0 })}
            placeholder="e.g., 100 or -50"
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
            <textarea
              value={adjustmentForm.description}
              onChange={(e) => setAdjustmentForm({ ...adjustmentForm, description: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
              rows={2}
              placeholder="e.g., Birthday bonus, Compensation, etc."
              required
            />
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={() => setAdjustModalOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Apply
            </Button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
