import React, { useState, useEffect } from 'react';
import { updateUserProfile, changeUserPassword } from '../api/client.js';

const MAHARASHTRA_DISTRICTS = [
  'Pune', 'Ahmednagar', 'Kolhapur', 'Thane', 'Mumbai', 'Nagpur', 
  'Nashik', 'Solapur', 'Satara', 'Sangli', 'Aurangabad (Chhatrapati Sambhaji Nagar)', 
  'Jalgaon', 'Amravati', 'Nanded', 'Latur', 'Dhule', 'Palghar', 'Ratnagiri'
];

export default function Profile({ user, setUser, setActivePage }) {
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'password' | 'about'
  
  // Profile Form State
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [district, setDistrict] = useState(user?.district || 'Pune');
  const [address, setAddress] = useState(user?.address || '');
  const [city, setCity] = useState(user?.city || '');
  const [state, setState] = useState(user?.state || 'Maharashtra');
  const [pincode, setPincode] = useState(user?.pincode || '');

  // Farmer specific fields
  const [farmName, setFarmName] = useState(user?.farm_name || '');
  const [farmVillage, setFarmVillage] = useState(user?.farm_village || '');
  const [farmTaluka, setFarmTaluka] = useState(user?.farm_taluka || '');
  const [livestockTypes, setLivestockTypes] = useState(user?.livestock_types || 'Cattle, Buffalo');
  const [herdSize, setHerdSize] = useState(user?.herd_size || 10);

  // Vet specific fields
  const [clinicName, setClinicName] = useState(user?.clinic_name || '');
  const [clinicAddress, setClinicAddress] = useState(user?.clinic_address || '');
  const [clinicHours, setClinicHours] = useState(user?.clinic_hours || '08:00 AM - 08:00 PM');
  const [clinicAvailability, setClinicAvailability] = useState(user?.clinic_availability || 'open');
  const [clinicVisitingLocation, setClinicVisitingLocation] = useState(user?.clinic_visiting_location || '');
  const [unavailabilityNotice, setUnavailabilityNotice] = useState(user?.unavailability_notice || '');

  // Password Form State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI state
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
      setDistrict(user.district || 'Pune');
      setAddress(user.address || '');
      setCity(user.city || '');
      setState(user.state || 'Maharashtra');
      setPincode(user.pincode || '');
      setFarmName(user.farm_name || '');
      setFarmVillage(user.farm_village || '');
      setFarmTaluka(user.farm_taluka || '');
      setLivestockTypes(user.livestock_types || 'Cattle, Buffalo');
      setHerdSize(user.herd_size || 10);
      setClinicName(user.clinic_name || '');
      setClinicAddress(user.clinic_address || '');
      setClinicHours(user.clinic_hours || '08:00 AM - 08:00 PM');
      setClinicAvailability(user.clinic_availability || 'open');
      setClinicVisitingLocation(user.clinic_visiting_location || '');
      setUnavailabilityNotice(user.unavailability_notice || '');
    }
  }, [user]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg({ type: '', text: '' });
    try {
      const updated = await updateUserProfile({
        name,
        role: user?.role || 'pet_owner',
        phone,
        address,
        city,
        district,
        state,
        pincode,
        farm_name: farmName,
        farm_village: farmVillage,
        farm_taluka: farmTaluka,
        livestock_types: livestockTypes,
        herd_size: Number(herdSize) || 0,
        clinic_name: clinicName,
        clinic_address: clinicAddress,
        clinic_hours: clinicHours,
        clinic_availability: clinicAvailability,
        clinic_visiting_location: clinicVisitingLocation,
        unavailability_notice: unavailabilityNotice
      });
      setUser(updated);
      setProfileMsg({ type: 'success', text: '✅ Profile information updated successfully!' });
    } catch (err) {
      setProfileMsg({ type: 'error', text: 'Failed to update profile: ' + err.message });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    if (newPassword.length < 4) {
      setPasswordMsg({ type: 'error', text: 'New password must be at least 4 characters.' });
      return;
    }
    setSavingPassword(true);
    setPasswordMsg({ type: '', text: '' });
    try {
      await changeUserPassword({ oldPassword, newPassword });
      setPasswordMsg({ type: 'success', text: '✅ Password changed successfully!' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordMsg({ type: 'error', text: err.message || 'Could not change password.' });
    } finally {
      setSavingPassword(false);
    }
  };

  const getRoleBadge = () => {
    switch (user?.role) {
      case 'vet':
        return <span className="bg-blue-100 text-blue-800 text-[11px] font-black uppercase px-3 py-1 rounded-full border border-blue-200">🩺 Licensed Veterinarian</span>;
      case 'farmer':
        return <span className="bg-amber-100 text-amber-800 text-[11px] font-black uppercase px-3 py-1 rounded-full border border-amber-200">🚜 Livestock Farmer</span>;
      case 'ngo':
        return <span className="bg-purple-100 text-purple-800 text-[11px] font-black uppercase px-3 py-1 rounded-full border border-purple-200">🤝 Animal Relief NGO</span>;
      default:
        return <span className="bg-emerald-100 text-emerald-800 text-[11px] font-black uppercase px-3 py-1 rounded-full border border-emerald-200">🐾 Pet Parent / Owner</span>;
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      
      {/* Top Banner & User Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950 rounded-3xl p-6 sm:p-10 text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-600 flex items-center justify-center text-white text-3xl font-black shadow-lg shadow-emerald-500/20">
            {user?.role === 'vet' ? '🩺' : user?.role === 'farmer' ? '🚜' : '🐾'}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black">{user?.name || 'Account User'}</h1>
              {getRoleBadge()}
            </div>
            <p className="text-xs text-slate-300 mt-1 font-mono">
              {user?.email} • Region: <strong>{user?.district || 'Pune'}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActivePage(user?.role === 'vet' ? 'consultations' : 'home')}
            className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors border border-white/10"
          >
            ← Back to Home
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'profile'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <span>👤</span>
          <span>Edit Profile & Location</span>
        </button>

        <button
          onClick={() => setActiveTab('password')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'password'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <span>🔒</span>
          <span>Security & Password</span>
        </button>

        <button
          onClick={() => setActiveTab('about')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'about'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <span>ℹ️</span>
          <span>About PashuRakshak (पशुरक्षक)</span>
        </button>
      </div>

      {/* TAB 1: EDIT PROFILE */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-lg font-black text-slate-900">Personal & Geographic Information</h2>
            <p className="text-xs text-slate-500">
              Keep your farm/clinic location accurate so outbreak alerts and consultations are properly mapped.
            </p>
          </div>

          {profileMsg.text && (
            <div className={`p-4 rounded-2xl text-xs font-bold ${
              profileMsg.type === 'success' ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-red-50 text-red-900 border border-red-200'
            }`}>
              {profileMsg.text}
            </div>
          )}

          <form onSubmit={handleUpdateProfile} className="space-y-6">
            
            {/* General Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Contact Phone Number *</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98220 12345"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">District (Maharashtra) *</label>
                <select
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {MAHARASHTRA_DISTRICTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">City / Taluka</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Baramati, Haveli, Kalyan"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* FARMER SPECIFIC SECTION */}
            {user?.role === 'farmer' && (
              <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-amber-900">
                  <span className="text-lg">🚜</span>
                  <h3 className="font-bold text-xs uppercase tracking-wider">Livestock Farm Details (गावाचे नाव आणि शेती)</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Farm / Dairy Name *</label>
                    <input
                      type="text"
                      required
                      value={farmName}
                      onChange={(e) => setFarmName(e.target.value)}
                      placeholder="e.g. Sahyadri Dairy Farm #4"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Village Name (गावाचे नाव) *</label>
                    <input
                      type="text"
                      required
                      value={farmVillage}
                      onChange={(e) => setFarmVillage(e.target.value)}
                      placeholder="e.g. Malegaon Budruk, Khed Shivapur"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Taluka / Block</label>
                    <input
                      type="text"
                      value={farmTaluka}
                      onChange={(e) => setFarmTaluka(e.target.value)}
                      placeholder="e.g. Baramati, Sangamner"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Total Herd Size</label>
                    <input
                      type="number"
                      min="1"
                      value={herdSize}
                      onChange={(e) => setHerdSize(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* VETERINARIAN SPECIFIC SECTION */}
            {user?.role === 'vet' && (
              <div className="bg-blue-50/60 border border-blue-200/80 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-blue-900">
                  <span className="text-lg">🩺</span>
                  <h3 className="font-bold text-xs uppercase tracking-wider">Veterinary Clinic & Availability Management</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Clinic / Hospital Name *</label>
                    <input
                      type="text"
                      required
                      value={clinicName}
                      onChange={(e) => setClinicName(e.target.value)}
                      placeholder="e.g. Baramati Veterinary Polyclinic"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Clinic Address & Landmark</label>
                    <input
                      type="text"
                      value={clinicAddress}
                      onChange={(e) => setClinicAddress(e.target.value)}
                      placeholder="e.g. Near Agricultural College, Baramati"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Clinic Working Hours</label>
                    <input
                      type="text"
                      value={clinicHours}
                      onChange={(e) => setClinicHours(e.target.value)}
                      placeholder="08:00 AM - 08:00 PM (Mon-Sat)"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Current Real-Time Status *</label>
                    <select
                      value={clinicAvailability}
                      onChange={(e) => setClinicAvailability(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="open">🟢 Open Now / Available for Consultations</option>
                      <option value="visiting">🟡 On Field Duty / Visiting Farms</option>
                      <option value="closed">🔴 Closed / Emergency On-Call Only</option>
                      <option value="vacation">🏖️ On Leave / Vacation</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Current Visiting Field Location (Where are you visiting now?)</label>
                    <input
                      type="text"
                      value={clinicVisitingLocation}
                      onChange={(e) => setClinicVisitingLocation(e.target.value)}
                      placeholder="e.g. Currently visiting dairy herds in Malegaon Budruk block"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Vacation & Future Unavailability Notice</label>
                    <input
                      type="text"
                      value={unavailabilityNotice}
                      onChange={(e) => setUnavailabilityNotice(e.target.value)}
                      placeholder="e.g. On leave from Sept 2 - Sept 5. Contact Dr. Deshmukh for emergencies."
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={savingProfile}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-6 py-3 rounded-2xl shadow-md transition-colors flex items-center gap-2"
              >
                <span>{savingProfile ? 'Saving Changes...' : '💾 Save Profile Information'}</span>
              </button>
            </div>

          </form>
        </div>
      )}

      {/* TAB 2: SECURITY & PASSWORD */}
      {activeTab === 'password' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6 max-w-xl">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-lg font-black text-slate-900">Change Password</h2>
            <p className="text-xs text-slate-500">
              Ensure your account uses a secure password with bcrypt encryption.
            </p>
          </div>

          {passwordMsg.text && (
            <div className={`p-4 rounded-2xl text-xs font-bold ${
              passwordMsg.type === 'success' ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-red-50 text-red-900 border border-red-200'
            }`}>
              {passwordMsg.text}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Current Password *</label>
              <input
                type="password"
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">New Password *</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Minimum 4 characters</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Confirm New Password *</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={savingPassword}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black text-xs py-3 rounded-2xl shadow-md transition-colors"
              >
                {savingPassword ? 'Updating Password...' : '🔒 Update Password'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: ABOUT PLATFORM */}
      {activeTab === 'about' && (
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-xl font-black text-slate-900">About PashuRakshak (पशुरक्षक) Surveillance Platform</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              PashuRakshak is an advanced animal health and syndromic surveillance system built in alignment with <strong>Problem Statement ID 26128 (Government of Maharashtra & Maharashtra State Innovation Society)</strong>. It provides unified early detection, biosecurity defense protocols, and coordinated outbreak response across village, block, and district levels.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <span className="text-xl">🚨</span>
                <h4 className="font-bold text-slate-900 text-xs">Outbreak Radar & SOS</h4>
                <p className="text-[11px] text-slate-500">Autonomous consensus clustering from paravets and licensed doctors.</p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <span className="text-xl">🩺</span>
                <h4 className="font-bold text-slate-900 text-xs">Doctor Second Opinion</h4>
                <p className="text-[11px] text-slate-500">Direct escalation of doubtful symptoms to registered veterinarians.</p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <span className="text-xl">📦</span>
                <h4 className="font-bold text-slate-900 text-xs">Dynamic Supply Inventory</h4>
                <p className="text-[11px] text-slate-500">Dispensary vaccine tracking and emergency relief stock.</p>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
