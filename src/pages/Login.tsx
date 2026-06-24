import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Lock, AlertCircle, IdCard } from 'lucide-react';
import toast from 'react-hot-toast';

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Accept username OR employee ID
      const success = await login(username, password);
      if (success) {
        toast.success('Login successful!');
        navigate('/dashboard');
      } else {
        setError('Invalid username/Employee ID or password');
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
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl mb-4 shadow-lg">
            <span className="text-3xl font-extrabold text-white">K</span>
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">KAPU HABA</h1>
          <p className="text-blue-200 mt-2 font-medium">Smart Point of Sale System</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Welcome Back</h2>

          {error && (
            <div className="flex items-center gap-2 p-4 mb-6 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Username / Employee ID"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username or Employee ID (e.g., EMP001)"
              icon={<IdCard className="w-5 h-5" />}
              required
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              icon={<Lock className="w-5 h-5" />}
              required
            />

            <Button
              type="submit"
              loading={loading}
              className="w-full"
              size="lg"
            >
              Sign In
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              No account?{' '}
              <a href="/signup" className="font-semibold text-blue-600 hover:text-blue-800">
                Set up your business
              </a>
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
