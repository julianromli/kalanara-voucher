import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const AdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { showToast } = useToast();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Hardcoded credentials for demo purposes
    if (email === 'admin@test.com' && password === 'admin123') {
      login(email, 'ADMIN');
      showToast('Welcome back, Manager', 'success');
      navigate('/admin/dashboard');
    } 
    else if (email === 'staff@test.com' && password === 'staff123') {
      login(email, 'STAFF');
      showToast('Welcome back, Staff', 'success');
      navigate('/admin/dashboard');
    }
    else {
      setError('Invalid email or password');
      showToast('Login failed', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-sage-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-sage-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="text-sage-700" size={24} />
          </div>
          <h1 className="font-serif text-2xl text-sage-900">Staff Access</h1>
          <p className="text-sage-500 text-sm mt-2">Please sign in to continue</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2 border border-red-100">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-sage-700 mb-1">Email</label>
            <input 
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 rounded-lg border border-sage-200 bg-white text-sage-900 placeholder:text-sage-400 focus:ring-2 focus:ring-sage-500 outline-none transition-all"
              placeholder="admin@test.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-sage-700 mb-1">Password</label>
            <input 
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 rounded-lg border border-sage-200 bg-white text-sage-900 placeholder:text-sage-400 focus:ring-2 focus:ring-sage-500 outline-none transition-all"
              placeholder="••••••••"
            />
          </div>
          <button 
            type="submit"
            className="w-full bg-sage-800 text-white py-3 rounded-lg font-medium hover:bg-sage-700 transition mt-2 shadow-lg"
          >
            Sign In
          </button>
          <div className="text-center mt-4">
            <p className="text-xs text-sage-400">
              Demo Access:<br/>
              Admin: admin@test.com / admin123<br/>
              Staff: staff@test.com / staff123
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;