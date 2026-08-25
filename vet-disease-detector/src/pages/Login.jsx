import React, { useState } from 'react';
import { loginAccount } from '../api/client.js';

export default function Login({ setActivePage, onAuthSuccess }) {
  const [email, setEmail] = useState('vet.doctor@agricare.org');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('veterinarian');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const auth = await loginAccount({ email, password, role });
      onAuthSuccess?.(auth);
    } catch (err) {
      setError(err.message || 'Could not sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-8 bg-white p-8 rounded-3xl border border-slate-200 shadow-xl space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 bg-emerald-600 rounded-2xl text-white text-2xl flex items-center justify-center mx-auto shadow-md shadow-emerald-500/20">
          🐾
        </div>
        <h2 className="text-2xl font-black text-slate-900">Welcome Back</h2>
        <p className="text-xs text-slate-500">Access your patient diagnostic portal and prediction history</p>
      </div>

      {/* Role Toggle */}
      <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-bold">
        <button
          type="button"
          onClick={() => setRole('owner')}
          className={`py-2 rounded-lg transition-all ${role === 'owner' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
        >
          Pet Owner
        </button>
        <button
          type="button"
          onClick={() => setRole('farmer')}
          className={`py-2 rounded-lg transition-all ${role === 'farmer' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
        >
          Livestock / Farm
        </button>
        <button
          type="button"
          onClick={() => setRole('veterinarian')}
          className={`py-2 rounded-lg transition-all ${role === 'veterinarian' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
        >
          Veterinarian
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block font-bold text-slate-700 mb-1">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="font-bold text-slate-700">Password</label>
            <a href="#forgot" onClick={(e) => { e.preventDefault(); alert('Password reset link sent to registered email.'); }} className="text-emerald-600 hover:underline">Forgot password?</a>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Enter your password"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center">
          <input type="checkbox" id="remember" defaultChecked className="w-4 h-4 text-emerald-600 rounded border-slate-300" />
          <label htmlFor="remember" className="ml-2 text-slate-600 select-none">Remember this device</label>
        </div>

        {error && <p className="text-red-700 bg-red-50 border border-red-100 rounded-xl p-3 font-semibold">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-md transition-colors text-sm"
        >
          {submitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <div className="text-center pt-2 border-t border-slate-100 text-xs text-slate-500">
        Don't have an account?{' '}
        <button
          onClick={() => setActivePage('signup')}
          className="font-bold text-emerald-600 hover:underline"
        >
          Register for Free
        </button>
      </div>
    </div>
  );
}
