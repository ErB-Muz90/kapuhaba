import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Building2, Lock, Mail, User, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export function Signup() {
  const [businessName, setBusinessName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const signup = useAuthStore((state) => state.signup);
  const login = useAuthStore((state) => state.login);
  const updateSettings = useSettingsStore((state) => state.updateSettings);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!businessName.trim() || !adminName.trim() || !email.trim() || !password.trim()) {
      setError('All fields are required');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const success = await signup({ username: adminName, email, password, role: 'admin' });
      if (success) {
        try {
          await updateSettings({ name: businessName, email, phone: '', address: '' });
        } catch {}
        await login(adminName, password);
        toast.success('Business set up successfully!');
        navigate('/settings');
      } else {
        setError('An account already exists. Please log in instead.');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl mb-4 shadow-lg">
            <span className="text-3xl font-extrabold text-white">K</span>
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">KAPU HABA</h1>
          <p className="text-blue-200 mt-2 font-medium">Set Up Your Business</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Create Admin Account</h2>

          {error && (
            <div className="flex items-center gap-2 p-4 mb-6 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Business Name"
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Your business name"
              icon={<Building2 className="w-5 h-5" />}
              required
            />

            <Input
              label="Admin Username"
              type="text"
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              placeholder="Choose a username"
              icon={<User className="w-5 h-5" />}
              required
            />

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              icon={<Mail className="w-5 h-5" />}
              required
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              icon={<Lock className="w-5 h-5" />}
              required
            />

            <Input
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat your password"
              icon={<Lock className="w-5 h-5" />}
              required
            />

            <Button
              type="submit"
              loading={loading}
              className="w-full"
              size="lg"
            >
              Set Up Business
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-800">
                Sign In
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-blue-200 text-sm mt-6">
          Built by <span className="font-semibold text-white">Eruns Technologies</span>
        </p>
      </div>
    </div>
  );
}
