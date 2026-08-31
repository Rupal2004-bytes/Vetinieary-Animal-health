import React, { useState, useEffect } from 'react';
import { 
  getVetConsultations, 
  reviewVetConsultation, 
  getVets, 
  updateUserProfile, 
  mediaURL 
} from '../api/client.js';

const MAHARASHTRA_DISTRICTS = [
  'All', 'Pune', 'Ahmednagar', 'Kolhapur', 'Thane', 'Mumbai', 'Nagpur', 
  'Nashik', 'Solapur', 'Satara', 'Sangli'
];

export default function VetConsultations({ user, setUser, setActivePage }) {
  const isVet = user?.role === 'vet';
  
  // Default tab based on role
  const [activeTab, setActiveTab] = useState(isVet ? 'cases' : 'directory'); // 'directory' | 'cases' | 'manage_clinic'
  
  // Cases State
  const [consultations, setConsultations] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [reviewForm, setReviewForm] = useState({
    diagnosis: '',
    suggestion: '',
    prescription: ''
  });
  const [statusFilter, setStatusFilter] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [loadingCases, setLoadingCases] = useState(true);

  // Vets & Clinics Directory State
  const [vetsList, setVetsList] = useState([]);
  const [selectedDistrict, setSelectedDistrict] = useState(user?.district || 'All');
  const [loadingVets, setLoadingVets] = useState(true);

  // Vet Clinic Management State (for isVet)
  const [clinicHours, setClinicHours] = useState(user?.clinic_hours || '08:00 AM - 08:00 PM (Mon-Sat)');
  const [clinicAvailability, setClinicAvailability] = useState(user?.clinic_availability || 'open');
  const [visitingLocation, setVisitingLocation] = useState(user?.clinic_visiting_location || '');
  const [unavailabilityNotice, setUnavailabilityNotice] = useState(user?.unavailability_notice || '');
  const [savingClinicStatus, setSavingClinicStatus] = useState(false);
  const [clinicSaveMsg, setClinicSaveMsg] = useState('');

  useEffect(() => {
    if (user) {
      setClinicHours(user.clinic_hours || '08:00 AM - 08:00 PM (Mon-Sat)');
      setClinicAvailability(user.clinic_availability || 'open');
      setVisitingLocation(user.clinic_visiting_location || '');
      setUnavailabilityNotice(user.unavailability_notice || '');
    }
  }, [user]);

  useEffect(() => {
    loadConsultations();
  }, [statusFilter]);

  useEffect(() => {
    loadVets();
  }, [selectedDistrict]);

  const loadConsultations = async () => {
    setLoadingCases(true);
    try {
      const data = await getVetConsultations(statusFilter);
      setConsultations(data);
      if (data.length > 0 && !selectedCase) {
        setSelectedCase(data[0]);
      }
    } catch (err) {
      console.error('Failed to load consultations:', err);
    } finally {
      setLoadingCases(false);
    }
  };

  const loadVets = async () => {
    setLoadingVets(true);
    try {
      const districtQuery = selectedDistrict === 'All' ? '' : selectedDistrict;
      const data = await getVets(districtQuery);
      setVetsList(data);
    } catch (err) {
      console.error('Failed to load vets directory:', err);
    } finally {
      setLoadingVets(false);
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCase) return;
    setSubmittingReview(true);
    try {
      const updated = await reviewVetConsultation({
        id: selectedCase.id,
        diagnosis: reviewForm.diagnosis,
        suggestion: reviewForm.suggestion,
        prescription: reviewForm.prescription
      });
      setConsultations(consultations.map(c => c.id === selectedCase.id ? updated : c));
      setSelectedCase(updated);
      alert('Case review and clinical suggestions submitted successfully.');
    } catch (err) {
      alert('Failed to submit review: ' + err.message);
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleUpdateClinicStatus = async (e) => {
    e.preventDefault();
    setSavingClinicStatus(true);
    setClinicSaveMsg('');
    try {
      const updated = await updateUserProfile({
        name: user?.name,
        role: 'vet',
        clinic_name: user?.clinic_name,
        clinic_address: user?.clinic_address,
        district: user?.district,
        phone: user?.phone,
        clinic_hours: clinicHours,
        clinic_availability: clinicAvailability,
        clinic_visiting_location: visitingLocation,
        unavailability_notice: unavailabilityNotice
      });
      if (setUser) {
        setUser(updated);
      }
      setClinicSaveMsg('✅ Clinic working hours and real-time availability updated successfully!');
      await loadVets();
    } catch (err) {
      setClinicSaveMsg('Failed to update clinic status: ' + err.message);
    } finally {
      setSavingClinicStatus(false);
    }
  };

  const getStatusBadge = (status) => {
    const s = String(status || 'open').toLowerCase().trim();
    if (s === 'visiting' || s.includes('field') || s.includes('visit')) {
      return <span className="bg-amber-100 text-amber-800 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-amber-200">🟡 On Field Duty</span>;
    }
    if (s === 'vacation' || s.includes('leave') || s.includes('vacation')) {
      return <span className="bg-purple-100 text-purple-800 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-purple-200">🏖️ On Leave</span>;
    }
    if (s === 'closed' || s.includes('close')) {
      return <span className="bg-rose-100 text-rose-800 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-rose-200">🔴 Closed</span>;
    }
    return <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-emerald-200">🟢 Open Now</span>;
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 rounded-3xl border border-blue-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-blue-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
              {isVet ? '🩺 Veterinarian Decision Hub' : '🏥 Veterinary Consultation & Clinic Network'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black mt-2 text-white">
            {isVet ? 'Doctor Case Queue & Clinic Duty Management' : 'Nearby Vets, Clinics & Second Opinion Consultations'}
          </h1>
          <p className="text-xs text-blue-200 mt-1 max-w-xl">
            {isVet 
              ? 'Review suspected disease cases from farmers & pet parents, manage your clinic operating hours, and broadcast field duty / leave updates in real time.'
              : 'Find registered licensed veterinarians and polyclinics in your district with live availability hours, contact information, and request second opinions.'}
          </p>
        </div>

        {isVet && (
          <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 text-xs space-y-1">
            <span className="text-slate-300 text-[10px] block">Your Current Status:</span>
            <div className="flex items-center gap-2">
              {getStatusBadge(user?.clinic_availability || 'open')}
              <span className="font-bold text-white text-[11px]">{user?.clinic_name || 'My Clinic'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        
        {/* Tab: Nearby Vets & Clinics Directory */}
        <button
          onClick={() => setActiveTab('directory')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'directory'
              ? 'bg-slate-900 text-white shadow-sm ring-2 ring-slate-900/20'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <span>🏥</span>
          <span>Nearby Vets & Clinics Directory</span>
          <span className="bg-blue-100 text-blue-900 text-[10px] px-2 py-0.5 rounded-full font-black">
            {vetsList.length}
          </span>
        </button>

        {/* Tab: Consultations / Review Queue */}
        <button
          onClick={() => setActiveTab('cases')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'cases'
              ? 'bg-slate-900 text-white shadow-sm ring-2 ring-slate-900/20'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <span>📋</span>
          <span>{isVet ? 'Doctor Case Review Queue' : 'My Submitted Scans & Reviews'}</span>
          <span className="bg-emerald-100 text-emerald-900 text-[10px] px-2 py-0.5 rounded-full font-black">
            {consultations.length}
          </span>
        </button>

        {/* Tab: Vet Clinic Management (For Vets) */}
        {isVet && (
          <button
            onClick={() => setActiveTab('manage_clinic')}
            className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'manage_clinic'
                ? 'bg-slate-900 text-white shadow-sm ring-2 ring-slate-900/20'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <span>⚙️</span>
            <span>Clinic Hours & Availability Management</span>
          </button>
        )}

      </div>

      {/* TAB 1: NEARBY VETS & CLINICS DIRECTORY */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700">Filter By District:</span>
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {MAHARASHTRA_DISTRICTS.map(d => (
                  <option key={d} value={d}>{d === 'All' ? 'All Maharashtra Districts' : d}</option>
                ))}
              </select>
            </div>
            <span className="text-slate-400 font-semibold">{vetsList.length} Verified Practitioners</span>
          </div>

          {loadingVets ? (
            <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 shadow-sm text-xs text-slate-500">
              Loading veterinary registry...
            </div>
          ) : vetsList.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 shadow-sm space-y-3">
              <div className="text-4xl">🏥</div>
              <h3 className="font-bold text-slate-900 text-base">No Vets Found in Selected District</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No registered clinics currently listed for {selectedDistrict}. You can call the 1962 Toll-Free Government Mobile Hospital Helpline.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {vetsList.map(vet => (
                <div 
                  key={vet.id}
                  className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3 text-xs">
                    
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white text-xl font-bold shadow-md shadow-blue-500/20">
                          🩺
                        </div>
                        <div>
                          <h3 className="font-black text-slate-900 text-sm">{vet.name}</h3>
                          <p className="text-slate-500 font-medium text-[11px]">{vet.clinic_name || 'Veterinary Clinic'}</p>
                        </div>
                      </div>
                      {getStatusBadge(vet.clinic_availability || 'open')}
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-slate-100 text-slate-600">
                      <p className="flex items-start gap-2">
                        <span>📍</span>
                        <span>{vet.clinic_address || vet.address || `${vet.district || 'Pune'}, Maharashtra`}</span>
                      </p>
                      
                      <p className="flex items-center gap-2 font-medium">
                        <span>🕒</span>
                        <span>Working Hours: <strong>{vet.clinic_hours || '08:00 AM - 08:00 PM'}</strong></span>
                      </p>

                      {vet.phone && (
                        <p className="flex items-center gap-2">
                          <span>📞</span>
                          <a href={`tel:${vet.phone}`} className="text-blue-600 font-bold hover:underline">
                            {vet.phone}
                          </a>
                        </p>
                      )}

                      {/* Current Field Visiting Location */}
                      {vet.clinic_visiting_location && (
                        <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-amber-950 text-[11px]">
                          <span className="font-bold block">🚜 Current Field Duty Location:</span>
                          <span>{vet.clinic_visiting_location}</span>
                        </div>
                      )}

                      {/* Leave Notice */}
                      {vet.unavailability_notice && (
                        <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-xl text-rose-950 text-[11px]">
                          <span className="font-bold block">🏖️ Leave / Unavailability Notice:</span>
                          <span>{vet.unavailability_notice}</span>
                        </div>
                      )}
                    </div>

                  </div>

                  <div className="flex gap-2 pt-2 border-t border-slate-100">
                    {vet.phone && (
                      <a
                        href={`tel:${vet.phone}`}
                        className={`${isVet ? 'w-full' : 'w-1/2'} bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 rounded-xl text-xs text-center transition-colors shadow-sm flex items-center justify-center gap-1`}
                      >
                        <span>📞 Call Doctor</span>
                      </a>
                    )}
                    {!isVet && (
                      <button
                        onClick={() => setActivePage('prediction')}
                        className={`${vet.phone ? 'w-1/2' : 'w-full'} bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl text-xs text-center transition-colors shadow-sm`}
                      >
                        🩺 AI Scan & Review
                      </button>
                    )}
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CONSULTATIONS & CLINICAL REVIEW QUEUE */}
      {activeTab === 'cases' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: List of cases */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-xs">
              <span className="font-bold text-slate-700">Patient Case List</span>
              <span className="text-slate-400 font-semibold">{consultations.length} Cases</span>
            </div>

            {consultations.length === 0 ? (
              <div className="bg-white p-8 text-center rounded-3xl border border-slate-200 text-xs text-slate-400">
                No consultations found matching criteria.
              </div>
            ) : (
              consultations.map(c => (
                <div
                  key={c.id}
                  onClick={() => setSelectedCase(c)}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                    selectedCase?.id === c.id 
                      ? 'border-blue-600 bg-blue-50/50 shadow-md ring-2 ring-blue-500/20' 
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        c.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {c.status === 'pending' ? '⏳ Pending Review' : '✓ Reviewed'}
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm mt-1">{c.animal_name} ({c.species})</h4>
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold">{new Date(c.created_at).toLocaleDateString()}</span>
                  </div>

                  <p className="text-xs text-slate-600 mt-2 line-clamp-1 font-medium">
                    Owner: <strong>{c.user_name}</strong> • Locality: {c.location || 'Maharashtra'}
                  </p>

                  <div className="mt-2 text-[11px] text-blue-900 bg-blue-50 p-2 rounded-xl border border-blue-100">
                    Suspected: <strong>{c.ai_diagnosis || 'Clinical Assessment'}</strong>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Right Column: Case Details & Doctor Feedback */}
          <div className="lg:col-span-7 space-y-4">
            {selectedCase ? (
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6 text-xs">
                
                <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full">
                      Case #{selectedCase.id} • {selectedCase.species}
                    </span>
                    <h2 className="text-xl font-black text-slate-900 mt-2">{selectedCase.animal_name}</h2>
                    <p className="text-xs text-slate-500">
                      Submitted by <strong>{selectedCase.user_name} ({selectedCase.user_role})</strong> • Locality: <strong>{selectedCase.location}</strong>
                    </p>
                  </div>

                  <span className={`text-xs font-black uppercase px-3 py-1 rounded-xl ${
                    selectedCase.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {selectedCase.status === 'pending' ? 'Pending Doctor Review' : 'Feedback Provided'}
                  </span>
                </div>

                {/* Media Preview if attached */}
                {selectedCase.media_url && (
                  <div>
                    <span className="font-bold text-slate-700 block mb-1.5">Submitted Clinical Media:</span>
                    <div className="rounded-2xl overflow-hidden border border-slate-200 max-h-64 bg-slate-950 flex items-center justify-center">
                      <img 
                        src={mediaURL(selectedCase.media_url)} 
                        alt="Patient Case" 
                        className="max-h-64 object-contain"
                      />
                    </div>
                  </div>
                )}

                {/* Owner's Clinical Question & Symptoms */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Reported Symptoms & Diagnostic Doubt:</h4>
                  <p className="text-slate-800 font-medium leading-relaxed">{selectedCase.owner_notes || 'Second opinion requested on AI scan symptoms.'}</p>
                  
                  {selectedCase.symptoms && selectedCase.symptoms.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {selectedCase.symptoms.map((s, idx) => (
                        <span key={idx} className="bg-white border border-slate-200 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-lg">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Veterinarian Feedback Section */}
                {isVet ? (
                  <form onSubmit={handleReviewSubmit} className="space-y-4 pt-2 border-t border-slate-100">
                    <h3 className="font-black text-slate-900 text-sm">Doctor Clinical Evaluation & Prescription</h3>
                    
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Confirmed Clinical Diagnosis *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Foot-and-Mouth Disease (FMD) with secondary bacterial pododermatitis"
                        value={reviewForm.diagnosis || selectedCase.vet_diagnosis || ''}
                        onChange={(e) => setReviewForm({ ...reviewForm, diagnosis: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Veterinary Suggestion & Biosecurity Advice *</label>
                      <textarea
                        rows={3}
                        required
                        placeholder="e.g. Immediately isolate cow from herd. Wash ulcers with 1% potassium permanganate solution twice daily."
                        value={reviewForm.suggestion || selectedCase.vet_suggestion || ''}
                        onChange={(e) => setReviewForm({ ...reviewForm, suggestion: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">℞ Prescriptions & Dosage Protocols</label>
                      <textarea
                        rows={3}
                        placeholder="1. Inj. Oxytetracycline LA @ 20mg/kg deep IM&#10;2. Topicure spray on hooves twice daily"
                        value={reviewForm.prescription || selectedCase.vet_prescriptions || ''}
                        onChange={(e) => setReviewForm({ ...reviewForm, prescription: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submittingReview}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-2xl shadow-md transition-colors"
                    >
                      {submittingReview ? 'Submitting Review...' : '✓ Submit Clinical Second Opinion'}
                    </button>
                  </form>
                ) : (
                  <div>
                    {selectedCase.status === 'reviewed' ? (
                      <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl space-y-3 text-emerald-950">
                        <div className="flex justify-between items-center">
                          <h3 className="font-black text-sm">🩺 Doctor Feedback ({selectedCase.vet_name || 'Licensed Veterinarian'})</h3>
                          <span className="text-[10px] font-bold text-emerald-700">Verified Second Opinion</span>
                        </div>
                        <div>
                          <span className="font-bold text-[10px] uppercase block text-emerald-800">Confirmed Diagnosis:</span>
                          <p className="font-bold">{selectedCase.vet_diagnosis}</p>
                        </div>
                        <div>
                          <span className="font-bold text-[10px] uppercase block text-emerald-800">Clinical Suggestions:</span>
                          <p className="font-medium">{selectedCase.vet_suggestion}</p>
                        </div>
                        {selectedCase.vet_prescriptions && (
                          <div className="bg-white/80 p-3 rounded-xl border border-emerald-200">
                            <span className="font-black text-[10px] uppercase block text-emerald-900 mb-1">℞ Prescriptions:</span>
                            <pre className="font-mono text-xs whitespace-pre-wrap text-emerald-950">{selectedCase.vet_prescriptions}</pre>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl text-amber-950 text-center space-y-1">
                        <h4 className="font-bold">⏳ Awaiting Doctor Review</h4>
                        <p className="text-xs">Your case is in the active veterinarian queue. You will receive an instant notification as soon as doctor feedback is submitted.</p>
                      </div>
                    )}
                  </div>
                )}

              </div>
            ) : (
              <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 text-xs text-slate-400">
                Select a patient case on the left to inspect symptoms, media, and clinical notes.
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 3: VET CLINIC & AVAILABILITY MANAGEMENT (FOR VETS) */}
      {isVet && activeTab === 'manage_clinic' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6 max-w-2xl">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-lg font-black text-slate-900">Clinic Hours, Field Duty & Availability Management</h2>
            <p className="text-xs text-slate-500">
              Update your clinic open/closed status, current field visiting location, or scheduled vacation so farmers and pet owners see accurate live availability.
            </p>
          </div>

          {clinicSaveMsg && (
            <div className={`p-4 rounded-2xl text-xs font-bold ${
              clinicSaveMsg.includes('✅') ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-red-50 text-red-900 border border-red-200'
            }`}>
              {clinicSaveMsg}
            </div>
          )}

          <form onSubmit={handleUpdateClinicStatus} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Current Real-Time Clinic Availability *</label>
              <select
                value={clinicAvailability}
                onChange={(e) => setClinicAvailability(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="open">🟢 Open Now / Available at Clinic</option>
                <option value="visiting">🟡 On Field Duty / Visiting Livestock Farms</option>
                <option value="closed">🔴 Closed / Emergency On-Call</option>
                <option value="vacation">🏖️ On Vacation / Leave</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Clinic Working Hours</label>
              <input
                type="text"
                value={clinicHours}
                onChange={(e) => setClinicHours(e.target.value)}
                placeholder="08:00 AM - 08:00 PM (Mon-Sat)"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Current Field Visiting Location (Which area are you visiting currently?)</label>
              <input
                type="text"
                value={visitingLocation}
                onChange={(e) => setVisitingLocation(e.target.value)}
                placeholder="e.g. Currently visiting dairy herds in Malegaon Budruk & Khed block"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Visible to farmers and pet owners on the Nearby Vets Directory.</span>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Vacation & Future Unavailability Notice</label>
              <input
                type="text"
                value={unavailabilityNotice}
                onChange={(e) => setUnavailabilityNotice(e.target.value)}
                placeholder="e.g. On leave from Sept 2 - Sept 5. Contact Dr. Deshmukh for emergency coverage."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={savingClinicStatus}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-xs py-3 rounded-2xl shadow-md transition-colors"
              >
                {savingClinicStatus ? 'Updating Status...' : '💾 Publish Live Clinic & Duty Updates'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
