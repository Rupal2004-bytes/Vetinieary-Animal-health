import React, { useState } from 'react';
import { signupAccount } from '../api/client.js';

const MAHARASHTRA_DISTRICTS = [
  'Pune', 'Ahmednagar', 'Kolhapur', 'Thane', 'Mumbai', 'Nagpur', 'Nashik', 
  'Solapur', 'Satara', 'Sangli', 'Aurangabad (Chhatrapati Sambhajinagar)', 
  'Amravati', 'Nanded', 'Jalgaon', 'Latur', 'Dhule', 'Palghar', 'Raigad', 'Ratnagiri'
];

export default function Signup({ setActivePage, onAuthSuccess, setUser }) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'pet_owner',
    phone: '',
    address: '',
    city: '',
    district: 'Pune',
    state: 'Maharashtra',
    pincode: '',
    farmName: '',
    farmVillage: '',
    farmTaluka: '',
    livestockTypes: 'Cattle & Buffalo',
    herdSize: 10,
    clinicName: '',
    clinicAddress: '',
    clinicHours: '09:00 AM - 07:00 PM',
    clinicAvailability: 'Open Today'
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const auth = await signupAccount({
        name: formData.fullName,
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        phone: formData.phone,
        address: formData.address,
        city: formData.city,
        district: formData.district,
        state: formData.state,
        pincode: formData.pincode,
        farm_name: formData.farmName,
        farm_village: formData.farmVillage,
        farm_taluka: formData.farmTaluka,
        livestock_types: formData.livestockTypes,
        herd_size: Number(formData.herdSize) || 0,
        clinic_name: formData.clinicName,
        clinic_address: formData.clinicAddress,
        clinic_hours: formData.clinicHours,
        clinic_availability: formData.clinicAvailability
      });
      if (onAuthSuccess) {
        onAuthSuccess(auth);
      } else if (setUser) {
        setUser(auth.user);
        setActivePage('home');
      }
    } catch (err) {
      setError(err.message || 'Could not create account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto my-8 bg-white p-8 sm:p-10 rounded-3xl border border-slate-200 shadow-2xl space-y-6">
      <div className="text-center space-y-2">
        <div className="w-14 h-14 bg-emerald-600 rounded-2xl text-white text-3xl flex items-center justify-center mx-auto shadow-md shadow-emerald-500/20">
          🐾
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900">Create PashuRakshak Account</h2>
        <p className="text-xs text-slate-500">
          Register with your location for real-time outbreak mapping, clinical triage, and urgent SOS alerts
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Role Selector */}
        <div>
          <label className="block font-bold text-slate-700 mb-1">Select Account Type</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'pet_owner', label: '🐶 Pet Owner', sub: 'Companion Care' },
              { id: 'farmer', label: '🐄 Farmer', sub: 'Livestock & Herd' },
              { id: 'vet', label: '🩺 Veterinarian', sub: 'Clinic & Hospital' },
              { id: 'ngo', label: '🏢 NGO / Gov', sub: 'Relief & Support' }
            ].map(r => (
              <button
                type="button"
                key={r.id}
                onClick={() => setFormData({ ...formData, role: r.id })}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  formData.role === r.id
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold ring-2 ring-emerald-500/30'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="text-xs font-black">{r.label}</div>
                <div className="text-[10px] text-slate-500 font-normal">{r.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Basic Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
            <input
              type="text"
              required
              placeholder={formData.role === 'vet' ? 'Dr. Sarah Jenkins, DVM' : 'Full Name'}
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Phone Number *</label>
            <input
              type="tel"
              required
              placeholder="+91 98765 43210"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Email Address *</label>
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
            <label className="block font-bold text-slate-700 mb-1">Password *</label>
            <input
              type="password"
              required
              placeholder="Minimum 6 characters"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Location Mapping (District / State) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
          <div>
            <label className="block font-bold text-slate-700 mb-1">District (Outbreak Hub) *</label>
            <select
              value={formData.district}
              onChange={(e) => setFormData({ ...formData, district: e.target.value })}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {MAHARASHTRA_DISTRICTS.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">City / Town</label>
            <input
              type="text"
              placeholder="City / Locality"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Pin Code</label>
            <input
              type="text"
              placeholder="411001"
              value={formData.pincode}
              onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Role-Specific Fields */}
        {formData.role === 'pet_owner' && (
          <div className="bg-emerald-50/70 border border-emerald-100 p-4 rounded-2xl space-y-3">
            <h4 className="font-bold text-emerald-950 text-xs">🏡 Pet Guardian Residence</h4>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Street Address</label>
              <input
                type="text"
                placeholder="Apartment / Society / Street Address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        {formData.role === 'farmer' && (
          <div className="bg-amber-50/70 border border-amber-200/80 p-4 rounded-2xl space-y-3">
            <h4 className="font-bold text-amber-950 text-xs">🚜 Livestock & Farm Location Mapping</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Farm / Dairy Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sahyadri Dairy Farm #2"
                  value={formData.farmName}
                  onChange={(e) => setFormData({ ...formData, farmName: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Taluka / Block *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Baramati, Sangamner, Haveli"
                  value={formData.farmTaluka}
                  onChange={(e) => setFormData({ ...formData, farmTaluka: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Village Name (गावाचे नाव)</label>
                <input
                  type="text"
                  placeholder="e.g. Malegaon Budruk"
                  value={formData.farmVillage}
                  onChange={(e) => setFormData({ ...formData, farmVillage: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Herd Size (Approx. Animals)</label>
                <input
                  type="number"
                  min="1"
                  value={formData.herdSize}
                  onChange={(e) => setFormData({ ...formData, herdSize: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {formData.role === 'vet' && (
          <div className="bg-blue-50/70 border border-blue-200/80 p-4 rounded-2xl space-y-3">
            <h4 className="font-bold text-blue-950 text-xs">🩺 Clinic & Doctor Management Profile</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Veterinary Clinic / Hospital Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Central Emergency Pet & Cattle Hospital"
                  value={formData.clinicName}
                  onChange={(e) => setFormData({ ...formData, clinicName: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Consultation / Clinic Hours</label>
                <input
                  type="text"
                  placeholder="08:00 AM - 08:00 PM (Mon-Sat)"
                  value={formData.clinicHours}
                  onChange={(e) => setFormData({ ...formData, clinicHours: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Clinic Full Address</label>
              <input
                type="text"
                placeholder="Plot 42, Near Market Yard, Pune"
                value={formData.clinicAddress}
                onChange={(e) => setFormData({ ...formData, clinicAddress: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        {formData.role === 'ngo' && (
          <div className="bg-purple-50/70 border border-purple-200/80 p-4 rounded-2xl space-y-3">
            <h4 className="font-bold text-purple-950 text-xs">🏢 NGO / Government Dispensary Unit</h4>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Organization / Department Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Animal Relief Taskforce / Taluka Dispensary"
                value={formData.clinicName}
                onChange={(e) => setFormData({ ...formData, clinicName: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        <div className="flex items-start pt-1">
          <input type="checkbox" required id="agree" className="w-4 h-4 mt-0.5 text-emerald-600 rounded border-slate-300" />
          <label htmlFor="agree" className="ml-2 text-slate-600 select-none text-[11px] leading-tight">
            I consent to sharing location metadata for infectious disease surveillance and emergency veterinary triage response.
          </label>
        </div>

        {error && <p className="text-red-700 bg-red-50 border border-red-100 rounded-xl p-3 font-semibold">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-md transition-colors text-sm disabled:opacity-60"
        >
          {submitting ? 'Registering & Mapping Account...' : 'Complete Registration →'}
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
