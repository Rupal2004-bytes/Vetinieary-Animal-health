import React, { useState } from 'react';
import { signupAccount } from '../api/client.js';

export default function Signup({ setActivePage, onAuthSuccess, setUser }) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'owner',
    clinicName: ''
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const auth = await signupAccount({
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password,
        role: formData.role
      });
      if (onAuthSuccess) {
        onAuthSuccess(auth);
      } else if (setUser) {
        setUser(auth.user);
        setActivePage('dashboard');
      }
    } catch (err) {
      setError(err.message || 'Could not create account.');
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
        <h2 className="text-2xl font-black text-slate-900">Create Your Account</h2>
        <p className="text-xs text-slate-500">Join thousands of veterinarians, pet parents, and farmers</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block font-bold text-slate-700 mb-1">Account Type</label>
          <select
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            <option value="owner">Pet Owner / Guardian</option>
            <option value="farmer">Livestock Farmer / Herd Manager</option>
            <option value="veterinarian">Licensed Veterinarian / DVM</option>
            <option value="student">Veterinary Student / Researcher</option>
          </select>
        </div>

        <div>
          <label className="block font-bold text-slate-700 mb-1">Full Name</label>
          <input
            type="text"
            required
            placeholder="Dr. John Doe / Jane Smith"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-700 mb-1">Email Address</label>
          <input
            type="email"
            required
            placeholder="name@example.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-700 mb-1">Password</label>
          <input
            type="password"
            required
            placeholder="Minimum 8 characters"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        <div className="flex items-start">
          <input type="checkbox" required id="agree" className="w-4 h-4 mt-0.5 text-emerald-600 rounded border-slate-300" />
          <label htmlFor="agree" className="ml-2 text-slate-600 select-none text-[11px] leading-tight">
            I agree to the <a href="#terms" onClick={(e) => { e.preventDefault(); alert('Terms of clinical decision-support and data privacy.'); }} className="text-emerald-600 font-bold hover:underline">Terms of Service</a> and understand this platform is a diagnostic decision-support tool.
          </label>
        </div>

        {error && <p className="text-red-700 bg-red-50 border border-red-100 rounded-xl p-3 font-semibold">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-md transition-colors text-sm disabled:opacity-60"
        >
          {submitting ? 'Registering...' : 'Complete Registration'}
        </button>
      </form>

      <div className="text-center pt-2 border-t border-slate-100 text-xs text-slate-500">
        Already have an account?{' '}
        <button
          onClick={() => setActivePage('login')}
          className="font-bold text-emerald-600 hover:underline"
        >
          Sign In
        </button>
      </div>
    </div>
  );
}
