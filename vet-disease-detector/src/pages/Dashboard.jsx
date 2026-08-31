import React, { useState, useEffect } from 'react';
import {
  createAnimal,
  updateAnimal,
  deleteAnimal,
  getAnimals,
  getHealthHistory,
  getClinicTestResults,
  publishClinicTestResult,
  getGovAdvisories,
  publishGovAdvisory,
  getNotifications
} from '../api/client.js';

export default function Dashboard({
  setActivePage,
  user,
  historyList = [],
  onSelectHistoryItem,
  animals = [],
  onRefresh,
  selectedPatient,
  setSelectedPatient
}) {
  const isNGOorGov = user?.role === 'ngo' || user?.role === 'gov';
  const isVet = user?.role === 'vet';
  const safeAnimals = Array.isArray(animals) ? animals : [];
  const safeHistory = Array.isArray(historyList) ? historyList : [];

  // NGO / Gov State
  const [advisories, setAdvisories] = useState([]);
  const [loadingAdvisories, setLoadingAdvisories] = useState(false);
  const [advisoryForm, setAdvisoryForm] = useState({
    title: '',
    issuer: user?.clinic_name || user?.name || (user?.role === 'gov' ? 'Maharashtra Dept. of Animal Husbandry' : 'District Animal Welfare NGO'),
    district: user?.district || 'Statewide',
    category: 'Ring Vaccination Directive',
    urgency: 'HIGH',
    content: ''
  });
  const [publishingAdvisory, setPublishingAdvisory] = useState(false);
  const [publishSuccessMsg, setPublishSuccessMsg] = useState('');

  // Animal Profile Edit & Add State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [newPatient, setNewPatient] = useState({
    name: '',
    species: 'cattle',
    breed: '',
    age: '',
    weight: '',
    sex: '',
    tag_number: '',
    village: user?.farm_village || '',
    taluka: user?.farm_taluka || '',
    district: user?.district || '',
    notes: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Digital Health Passport Modal State
  const [selectedPassportAnimal, setSelectedPassportAnimal] = useState(null);
  const [passportTab, setPassportTab] = useState('labs'); // 'labs' | 'screenings' | 'vaccines'
  const [passportScreenings, setPassportScreenings] = useState([]);
  const [passportLabResults, setPassportLabResults] = useState([]);
  const [loadingPassport, setLoadingPassport] = useState(false);

  // Vet Lab Test Result Publishing State
  const [showPublishLabModal, setShowPublishLabModal] = useState(false);
  const [publishingLab, setPublishingLab] = useState(false);
  const [labSuccessMsg, setLabSuccessMsg] = useState('');
  const [labForm, setLabForm] = useState({
    animal_id: '',
    animal_name: '',
    test_type: 'Complete Blood Count (CBC)',
    sample_date: new Date().toISOString().split('T')[0],
    test_parameters_json: '',
    interpretation: '',
    status: 'Normal',
    recommendation: ''
  });

  // Outbreak Alerts matching user's species
  const [matchedOutbreak, setMatchedOutbreak] = useState(null);

  // Vet Search State by Pashu Aadhaar Tag or Query
  const [vetSearchQuery, setVetSearchQuery] = useState('');
  const [vetSearchedAnimals, setVetSearchedAnimals] = useState([]);
  const [searchingVet, setSearchingVet] = useState(false);

  useEffect(() => {
    if (isVet && !vetSearchQuery) {
      setVetSearchedAnimals(safeAnimals);
    }
  }, [isVet, safeAnimals]);

  const handleVetSearch = async (e) => {
    if (e) e.preventDefault();
    setSearchingVet(true);
    try {
      const res = await getAnimals({ q: vetSearchQuery, tag_number: vetSearchQuery });
      setVetSearchedAnimals(res);
    } catch (err) {
      console.error('Failed to search animals for vet:', err);
    } finally {
      setSearchingVet(false);
    }
  };

  useEffect(() => {
    if (isNGOorGov) {
      loadAdvisories();
    } else {
      checkSpeciesOutbreaks();
    }
  }, [isNGOorGov, safeAnimals.length]);

  const loadAdvisories = async () => {
    setLoadingAdvisories(true);
    try {
      const data = await getGovAdvisories();
      setAdvisories(data);
    } catch (err) {
      console.error('Failed to load advisories:', err);
    } finally {
      setLoadingAdvisories(false);
    }
  };

  const checkSpeciesOutbreaks = async () => {
    try {
      const notifs = await getNotifications();
      if (Array.isArray(notifs)) {
        const outbreakAlert = notifs.find(n => n.outbreak_id && (n.is_sos || n.severity === 'CRITICAL' || n.severity === 'URGENT'));
        if (outbreakAlert) {
          setMatchedOutbreak(outbreakAlert);
        }
      }
    } catch (err) {
      console.warn('Failed to check species outbreaks:', err);
    }
  };

  const handlePublishDirective = async (e) => {
    e.preventDefault();
    setPublishingAdvisory(true);
    setPublishSuccessMsg('');
    try {
      await publishGovAdvisory(advisoryForm);
      setPublishSuccessMsg('✅ Official directive and statewide notification published successfully!');
      setAdvisoryForm({
        title: '',
        issuer: user?.clinic_name || user?.name || (user?.role === 'gov' ? 'Maharashtra Dept. of Animal Husbandry' : 'District Animal Welfare NGO'),
        district: user?.district || 'Statewide',
        category: 'Ring Vaccination Directive',
        urgency: 'HIGH',
        content: ''
      });
      await loadAdvisories();
    } catch (err) {
      alert('Failed to publish directive: ' + err.message);
    } finally {
      setPublishingAdvisory(false);
    }
  };

  const handleAddPatient = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await createAnimal(newPatient);
      await onRefresh?.();
      setShowAddModal(false);
      setNewPatient({
        name: '',
        species: 'cattle',
        breed: '',
        age: '',
        weight: '',
        sex: '',
        tag_number: '',
        village: user?.farm_village || '',
        taluka: user?.farm_taluka || '',
        district: user?.district || '',
        notes: ''
      });
    } catch (err) {
      setError(err.message || 'Could not save animal.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEdit = (patient) => {
    setEditingPatient(patient);
    setNewPatient({
      id: patient.id,
      name: patient.name || '',
      species: patient.species || 'cattle',
      breed: patient.breed || '',
      age: patient.age || '',
      weight: patient.weight || '',
      sex: patient.sex || '',
      tag_number: patient.tag_number || '',
      village: patient.village || user?.farm_village || '',
      taluka: patient.taluka || user?.farm_taluka || '',
      district: patient.district || user?.district || '',
      notes: patient.notes || ''
    });
    setShowEditModal(true);
  };

  const handleUpdatePatient = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await updateAnimal(newPatient);
      await onRefresh?.();
      setShowEditModal(false);
      setEditingPatient(null);
    } catch (err) {
      setError(err.message || 'Could not update animal profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePatient = async (id, name) => {
    if (!window.confirm(`Are you sure you want to remove ${name || 'this animal profile'} from your monitored patients?`)) return;
    try {
      await deleteAnimal(id);
      await onRefresh?.();
    } catch (err) {
      alert('Failed to delete animal profile: ' + err.message);
    }
  };

  const handleOpenPassport = async (animal) => {
    setSelectedPassportAnimal(animal);
    setPassportTab('labs');
    setLoadingPassport(true);
    try {
      const [screenings, labs] = await Promise.all([
        getHealthHistory(animal.id),
        getClinicTestResults(animal.id)
      ]);
      setPassportScreenings(screenings);
      setPassportLabResults(labs);
    } catch (err) {
      console.error('Failed to load animal passport data:', err);
    } finally {
      setLoadingPassport(false);
    }
  };

  const handlePublishLabResult = async (e) => {
    e.preventDefault();
    setPublishingLab(true);
    setLabSuccessMsg('');
    try {
      const payload = {
        ...labForm,
        animal_id: Number(labForm.animal_id) || (selectedPassportAnimal?.id || 0)
      };
      await publishClinicTestResult(payload);
      setLabSuccessMsg('✅ Official clinical laboratory report published and delivered to owner!');
      setLabForm({
        animal_id: '',
        animal_name: '',
        test_type: 'Complete Blood Count (CBC)',
        sample_date: new Date().toISOString().split('T')[0],
        test_parameters_json: '',
        interpretation: '',
        status: 'Normal',
        recommendation: ''
      });
      if (selectedPassportAnimal) {
        const labs = await getClinicTestResults(selectedPassportAnimal.id);
        setPassportLabResults(labs);
      }
      setTimeout(() => setShowPublishLabModal(false), 1500);
    } catch (err) {
      alert('Failed to publish lab result: ' + err.message);
    } finally {
      setPublishingLab(false);
    }
  };

  const getSpeciesIcon = (species = '') => {
    const s = species.toLowerCase();
    if (s.includes('cow') || s.includes('cattle') || s.includes('bovine')) return '🐄';
    if (s.includes('buffalo')) return '🐃';
    if (s.includes('goat')) return '🐐';
    if (s.includes('sheep')) return '🐑';
    if (s.includes('dog') || s.includes('canine')) return '🐕';
    if (s.includes('cat') || s.includes('feline')) return '🐈';
    if (s.includes('horse') || s.includes('equine')) return '🐎';
    if (s.includes('poultry') || s.includes('chicken') || s.includes('bird')) return '🐓';
    return '🐾';
  };

  const getVaccineProtocol = (species = '') => {
    const s = species.toLowerCase();
    if (s.includes('cow') || s.includes('cattle') || s.includes('buffalo') || s.includes('bovine')) {
      return [
        { name: 'Foot-and-Mouth Disease (FMD) Trivalent', frequency: 'Bi-annual (May & Nov)', mandate: 'State Mandated' },
        { name: 'Lumpy Skin Disease (Goat Pox Vaccine)', frequency: 'Annual (Pre-Monsoon)', mandate: 'Outbreak Ring' },
        { name: 'Haemorrhagic Septicaemia (HS) + BQ', frequency: 'Annual (June)', mandate: 'High Priority' },
        { name: 'Brucellosis (Cotton Strain 19)', frequency: 'Once in Lifetime (Female Calves 4-8 mos)', mandate: 'National Mission' }
      ];
    }
    if (s.includes('goat') || s.includes('sheep')) {
      return [
        { name: 'Peste des Petits Ruminants (PPR)', frequency: 'Once every 3 years', mandate: 'Eradication Drive' },
        { name: 'Enterotoxaemia (ET) Vaccine', frequency: 'Annual (Pre-Monsoon)', mandate: 'Critical' },
        { name: 'Goat Pox Vaccine', frequency: 'Annual (December)', mandate: 'Recommended' }
      ];
    }
    if (s.includes('dog') || s.includes('canine')) {
      return [
        { name: 'Anti-Rabies Vaccine (ARV)', frequency: 'Annual Booster', mandate: 'Legal Mandate' },
        { name: 'DHPPiL 9-in-1 (Parvo, Distemper, Hepatitis)', frequency: 'Annual Booster', mandate: 'Core Essential' }
      ];
    }
    return [
      { name: 'Anti-Rabies Vaccine', frequency: 'Annual', mandate: 'Essential' },
      { name: 'Broad-Spectrum Deworming (Albendazole/Ivermectin)', frequency: 'Every 3 Months', mandate: 'Routine' }
    ];
  };

  if (isNGOorGov) {
    return (
      <div className="space-y-8">
        
        {/* NGO / Gov Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-emerald-950 text-white p-6 sm:p-10 rounded-3xl border border-teal-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-teal-500/20 text-teal-300 text-xs font-black uppercase px-3 py-1 rounded-full border border-teal-400/30">
              <span>🏛️ {user?.role === 'gov' ? 'Government Animal Husbandry Department' : 'Animal Welfare NGO & Relief Authority'}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white">
              Official Directives & Outbreak Crisis Portal
            </h1>
            <p className="text-teal-200 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Broadcast binding disease containment orders, ring-vaccination mandates, quarantine perimeters, and emergency advisories directly to all field veterinarians, para-vets, and livestock farmers across Maharashtra.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => setActivePage('notifications')}
              className="bg-red-600 hover:bg-red-500 text-white font-black text-xs px-5 py-3 rounded-2xl shadow-lg transition-all flex items-center gap-2"
            >
              <span>🚨 Outbreak Radar</span>
            </button>
            <button
              onClick={() => setActivePage('inventory')}
              className="bg-purple-600 hover:bg-purple-500 text-white font-black text-xs px-5 py-3 rounded-2xl shadow-lg transition-all flex items-center gap-2"
            >
              <span>📦 Relief Inventory</span>
            </button>
          </div>
        </div>

        {/* Analytics Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase">Published Directives</span>
              <span className="p-2 bg-teal-50 text-teal-700 rounded-lg text-sm">📢</span>
            </div>
            <span className="text-3xl font-black text-slate-900">{advisories.length}</span>
            <p className="text-[11px] text-slate-400 mt-1">Official circulars on record</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase">Target Jurisdiction</span>
              <span className="p-2 bg-blue-50 text-blue-700 rounded-lg text-sm">📍</span>
            </div>
            <span className="text-xl font-black text-slate-900 truncate">{user?.district || 'Statewide'}</span>
            <p className="text-[11px] text-slate-400 mt-1">Active regulatory zone</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase">Outbreak Alerts</span>
              <span className="p-2 bg-red-50 text-red-700 rounded-lg text-sm">🚨</span>
            </div>
            <span className="text-3xl font-black text-red-600">Active</span>
            <p className="text-[11px] text-slate-400 mt-1">Real-time syndromic radar</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase">Mobile Helpline</span>
              <span className="p-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm">📞</span>
            </div>
            <span className="text-3xl font-black text-emerald-700">1962</span>
            <p className="text-[11px] text-slate-400 mt-1">Toll-free emergency dispatch</p>
          </div>
        </div>

        {/* Publish Directive Form Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <span className="text-[10px] font-black uppercase bg-teal-100 text-teal-800 px-3 py-1 rounded-full border border-teal-200">
              Broadcast System
            </span>
            <h2 className="text-xl font-black text-slate-900 mt-2">Publish Official Directive, Circular or Outbreak Update</h2>
            <p className="text-xs text-slate-500 mt-1">
              Directives published here are instantly broadcasted as high-priority push alerts to registered livestock farmers, veterinarians, and dispensaries in the selected district.
            </p>
          </div>

          {publishSuccessMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 p-4 rounded-2xl text-xs font-bold animate-in fade-in duration-200">
              {publishSuccessMsg}
            </div>
          )}

          <form onSubmit={handlePublishDirective} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Directive / Circular Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Immediate Ring Vaccination Directive: Foot-and-Mouth Disease (FMD)"
                  value={advisoryForm.title}
                  onChange={(e) => setAdvisoryForm({ ...advisoryForm, title: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Issuing Authority / Agency *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Commissionerate of Animal Husbandry, Govt. of Maharashtra"
                  value={advisoryForm.issuer}
                  onChange={(e) => setAdvisoryForm({ ...advisoryForm, issuer: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">District Scope</label>
                <select
                  value={advisoryForm.district}
                  onChange={(e) => setAdvisoryForm({ ...advisoryForm, district: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                >
                  <option value="Statewide">Statewide (All Maharashtra)</option>
                  <option value="Pune">Pune</option>
                  <option value="Ahmednagar">Ahmednagar</option>
                  <option value="Kolhapur">Kolhapur</option>
                  <option value="Thane">Thane</option>
                  <option value="Nagpur">Nagpur</option>
                  <option value="Nashik">Nashik</option>
                  <option value="Solapur">Solapur</option>
                  <option value="Satara">Satara</option>
                  <option value="Sangli">Sangli</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Category</label>
                <select
                  value={advisoryForm.category}
                  onChange={(e) => setAdvisoryForm({ ...advisoryForm, category: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                >
                  <option value="Ring Vaccination Directive">Ring Vaccination Directive</option>
                  <option value="Quarantine & Movement Restriction">Quarantine & Movement Restriction</option>
                  <option value="Emergency Medication Distribution">Emergency Medication Distribution</option>
                  <option value="Biosecurity & Farm Sanitization">Biosecurity & Farm Sanitization</option>
                  <option value="Livestock Market Closure Notice">Livestock Market Closure Notice</option>
                  <option value="General Public Health Advisory">General Public Health Advisory</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Urgency Priority</label>
                <select
                  value={advisoryForm.urgency}
                  onChange={(e) => setAdvisoryForm({ ...advisoryForm, urgency: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none font-bold"
                >
                  <option value="CRITICAL">🚨 CRITICAL (Urgent Outbreak SOS)</option>
                  <option value="HIGH">⚠️ HIGH (Priority Advisory)</option>
                  <option value="ROUTINE">ℹ️ ROUTINE (General Guidance)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Directive Details & Action Protocols *</label>
              <textarea
                rows={4}
                required
                placeholder="Specify containment measures, mandatory vaccination perimeters (e.g. 5km buffer), disinfection instructions, emergency helpline dispatch, and penalty/compliance notes..."
                value={advisoryForm.content}
                onChange={(e) => setAdvisoryForm({ ...advisoryForm, content: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none leading-relaxed"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={publishingAdvisory}
                className="bg-teal-600 hover:bg-teal-700 text-white font-black text-xs px-6 py-3 rounded-2xl shadow-lg transition-colors flex items-center gap-2"
              >
                <span>📢</span>
                <span>{publishingAdvisory ? 'Broadcasting Directive...' : 'Publish & Broadcast Official Directive Statewide'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* List of Published Directives & Advisories */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-black text-slate-900 text-base">Active Government & NGO Directives Feed</h3>
              <p className="text-xs text-slate-500">Official circulars currently visible across Maharashtra</p>
            </div>
            <button
              onClick={loadAdvisories}
              className="text-xs font-bold text-teal-600 hover:text-teal-700"
            >
              🔄 Refresh List
            </button>
          </div>

          {loadingAdvisories ? (
            <div className="text-center py-8 text-xs text-slate-400">Loading circulars...</div>
          ) : advisories.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">No directives published yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {advisories.map(adv => (
                <div key={adv.id} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-white transition-all space-y-2.5 text-xs">
                  <div className="flex justify-between items-start gap-2">
                    <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                      adv.urgency === 'CRITICAL'
                        ? 'bg-red-100 text-red-800 border border-red-200'
                        : adv.urgency === 'HIGH'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-blue-100 text-blue-800 border border-blue-200'
                    }`}>
                      {adv.urgency}
                    </span>
                    <span className="text-[11px] font-bold text-slate-500">📍 {adv.district}</span>
                  </div>

                  <h4 className="font-black text-slate-900 text-sm leading-snug">{adv.title}</h4>
                  <p className="text-slate-700 leading-relaxed font-medium line-clamp-3">{adv.content}</p>

                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-[11px] text-slate-500">
                    <span className="font-semibold">🏛️ {adv.issuer}</span>
                    <span>{adv.date_issued}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    );
  }

  return (
    <div className="space-y-8">
      
      {/* Dashboard Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-black text-slate-900">
              {user ? `Welcome back, ${user.name}` : 'Clinical Dashboard'}
            </h1>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full uppercase">
              {user?.role || 'Guest Mode'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Digital Health Passports, longitudinal diagnostic histories, and verified veterinary lab records
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              setNewPatient({
                name: '',
                species: 'cattle',
                breed: '',
                age: '',
                weight: '',
                sex: '',
                tag_number: '',
                village: user?.farm_village || '',
                taluka: user?.farm_taluka || '',
                district: user?.district || '',
                notes: ''
              });
              setShowAddModal(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
          >
            <span>➕ Add Animal Profile</span>
          </button>

          {isVet ? (
            <>
              <button
                onClick={() => setShowPublishLabModal(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
              >
                <span>🧪 Issue Lab Report</span>
              </button>
              <button
                onClick={() => setActivePage('consultations')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
              >
                <span>📋 Doctor Case Review Queue</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => setActivePage('home')}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
            >
              <span>🩺 New Diagnostic Scan</span>
            </button>
          )}
        </div>
      </div>

      {/* Outbreak Vulnerability Alert Cross-Referencing */}
      {matchedOutbreak && (
        <div className="bg-gradient-to-r from-red-950 via-red-900 to-amber-950 text-white p-5 sm:p-6 rounded-3xl border border-red-700 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-300">
          <div className="flex items-start gap-3.5">
            <span className="text-3xl p-2 bg-red-800/60 rounded-2xl border border-red-500/30">🚨</span>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider bg-red-500/30 px-2 py-0.5 rounded-full border border-red-400/40 text-red-200">
                Herd Vulnerability Alert • {matchedOutbreak.district || user?.district || 'Active District'}
              </span>
              <h3 className="text-base font-black text-white mt-1">
                {matchedOutbreak.title}
              </h3>
              <p className="text-xs text-red-200 mt-0.5 line-clamp-2">
                {matchedOutbreak.message}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActivePage('notifications')}
            className="bg-white text-red-900 hover:bg-red-50 font-black text-xs px-4 py-2.5 rounded-xl shadow-md transition-colors whitespace-nowrap self-stretch sm:self-auto text-center"
          >
            Open Outbreak Radar →
          </button>
        </div>
      )}

      {/* Analytics Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Monitored Animals</span>
            <span className="p-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm">🐾</span>
          </div>
          <span className="text-3xl font-black text-slate-900">{safeAnimals.length}</span>
          <p className="text-[11px] text-slate-400 mt-1">Registered Digital Passports</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Total AI Scans</span>
            <span className="p-2 bg-blue-50 text-blue-700 rounded-lg text-sm">🔬</span>
          </div>
          <span className="text-3xl font-black text-slate-900">{safeHistory.length}</span>
          <p className="text-[11px] text-slate-400 mt-1">Longitudinal screenings</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Critical Flags</span>
            <span className="p-2 bg-red-50 text-red-700 rounded-lg text-sm">🚨</span>
          </div>
          <span className="text-3xl font-black text-red-600">
            {safeHistory.filter(h => h && (h.urgency === 'CRITICAL' || h.triageLevel === 'RED')).length}
          </span>
          <p className="text-[11px] text-slate-400 mt-1">High-priority triage cases</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Location Scope</span>
            <span className="p-2 bg-purple-50 text-purple-700 rounded-lg text-sm">📍</span>
          </div>
          <span className="text-xl font-black text-slate-900 truncate">
            {user?.farm_village || user?.district || 'Maharashtra'}
          </span>
          <p className="text-[11px] text-slate-400 mt-1">Monitored territory</p>
        </div>
      </div>

      {/* Registered Patients & Animals Section */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-black text-slate-900">
              {isVet ? 'Regional Patients Directory & Pashu Aadhaar Registry' : 'Your Monitored Patients & Livestock Profiles'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isVet
                ? 'Search any animal across Maharashtra by 12-digit Pashu Aadhaar ear tag, inspect its Digital Health Passport, or issue verified clinic lab test results.'
                : 'Click any animal to view its Digital Health Passport, verified lab reports, vaccination calendar, or trigger a prefilled diagnostic scan.'}
            </p>
          </div>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full self-start sm:self-auto">
            {((isVet && (vetSearchQuery.trim() !== '' || vetSearchedAnimals.length > 0)) ? vetSearchedAnimals : safeAnimals).length} Available Patients
          </span>
        </div>

        {/* Pashu Aadhaar Search Bar for Veterinarians */}
        {isVet && (
          <div className="bg-gradient-to-r from-purple-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl border border-purple-800 shadow-md space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl p-2 bg-purple-800/60 rounded-xl border border-purple-500/30">🏷️</span>
              <div>
                <h3 className="text-sm font-black text-white">Pashu Aadhaar & Regional Animal Search</h3>
                <p className="text-[11px] text-purple-200">
                  Search by 12-digit Pashu Aadhaar Ear Tag # (e.g. 100458920112), animal name, breed, village, or district.
                </p>
              </div>
            </div>

            <form onSubmit={handleVetSearch} className="flex flex-col sm:flex-row gap-2 pt-1">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Enter 12-Digit Pashu Aadhaar Tag #, Name, or Village..."
                  value={vetSearchQuery}
                  onChange={(e) => setVetSearchQuery(e.target.value)}
                  className="w-full bg-slate-900/90 border border-purple-700/80 rounded-xl px-4 py-2.5 text-xs text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-400 font-medium"
                />
                {vetSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setVetSearchQuery('');
                      setVetSearchedAnimals(safeAnimals);
                    }}
                    className="absolute right-3 top-2.5 text-xs text-purple-300 hover:text-white"
                  >
                    ✕ Clear
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={searchingVet}
                className="bg-purple-500 hover:bg-purple-400 text-slate-950 font-black text-xs px-5 py-2.5 rounded-xl shadow transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <span>🔍</span>
                <span>{searchingVet ? 'Searching Registry...' : 'Search Pashu Aadhaar'}</span>
              </button>
            </form>
          </div>
        )}

        {((isVet && (vetSearchQuery.trim() !== '' || vetSearchedAnimals.length > 0)) ? vetSearchedAnimals : safeAnimals).length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs space-y-3">
            <span className="text-4xl block">🐾</span>
            <p className="font-bold text-slate-600 text-sm">
              {isVet ? 'No animal profiles found matching your search' : 'No animal profiles registered yet'}
            </p>
            <p className="max-w-md mx-auto text-slate-400">
              {isVet
                ? 'Try entering another Pashu Aadhaar ear tag number, name, or clear the search filter to view all registered livestock.'
                : 'Create an animal profile to link multimodal AI screenings, track lab test results from veterinarians, and manage vaccination reminders.'}
            </p>
            {!isVet && (
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md transition-colors"
              >
                + Create First Animal Profile
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {((isVet && (vetSearchQuery.trim() !== '' || vetSearchedAnimals.length > 0)) ? vetSearchedAnimals : safeAnimals).map(animal => {
              const icon = getSpeciesIcon(animal.species);
              return (
                <div
                  key={animal.id}
                  className="bg-slate-50/70 hover:bg-white rounded-2xl border border-slate-200 hover:border-emerald-300 p-5 transition-all shadow-sm hover:shadow-md space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl p-2 bg-white rounded-2xl border border-slate-200 shadow-sm">{icon}</span>
                        <div>
                          <h3 className="text-base font-black text-slate-900 leading-snug">{animal.name}</h3>
                          <span className="text-[11px] font-bold text-emerald-800 capitalize bg-emerald-100/80 px-2 py-0.5 rounded-md">
                            {animal.species} • {animal.breed || 'Mixed'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {(!isVet || animal.user_id === user?.id) && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(animal)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Edit Profile"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDeletePatient(animal.id, animal.name)}
                              className="p-1.5 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Profile"
                            >
                              🗑️
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {animal.tag_number && (
                      <div className="inline-flex items-center gap-1.5 bg-purple-100 text-purple-900 border border-purple-200 text-[11px] font-black px-2.5 py-1 rounded-lg">
                        <span>🏷️ Pashu Aadhaar:</span>
                        <span className="font-mono tracking-wide">{animal.tag_number}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-white p-3 rounded-xl border border-slate-200 text-slate-700">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Age / Weight:</span>
                        <strong className="text-slate-900">{animal.age || 'N/A'} • {animal.weight || 'N/A'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Sex / Tag:</span>
                        <strong className="text-slate-900 truncate block">{animal.sex || animal.tag_number || 'Registered'}</strong>
                      </div>
                      {(animal.village || animal.taluka || animal.district) && (
                        <div className="col-span-2 pt-1 border-t border-slate-100 text-slate-500">
                          📍 {animal.village ? `${animal.village}, ` : ''}{animal.taluka ? `${animal.taluka}, ` : ''}{animal.district || ''}
                        </div>
                      )}
                    </div>

                    {animal.notes && (
                      <p className="text-[11px] text-slate-600 italic line-clamp-2">
                        &quot;{animal.notes}&quot;
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleOpenPassport(animal)}
                      className="bg-slate-100 hover:bg-emerald-50 text-slate-800 hover:text-emerald-800 font-bold text-xs py-2 px-3 rounded-xl border border-slate-200 transition-colors flex items-center justify-center gap-1"
                    >
                      <span>📋</span> Health Passport
                    </button>
                    {isVet ? (
                      <button
                        onClick={() => {
                          setLabForm(prev => ({
                            ...prev,
                            animal_id: animal.id,
                            animal_name: animal.name
                          }));
                          setShowPublishLabModal(true);
                        }}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-2 px-3 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1"
                      >
                        <span>🧪</span> Issue Lab
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedPatient?.(animal);
                          setActivePage('home');
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1"
                      >
                        <span>📸</span> Scan Animal
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Predictions & Screenings */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-black text-slate-900">Recent Differential Scans & Triage Assessments</h2>
            <p className="text-xs text-slate-500">Historical AI multimodal screening records</p>
          </div>
          <button
            onClick={() => setActivePage('history')}
            className="text-xs font-bold text-emerald-600 hover:underline"
          >
            View Full Records ({safeHistory.length}) →
          </button>
        </div>

        {safeHistory.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            No prediction scans run yet. Click "New Diagnostic Scan" to run your first check!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {safeHistory.slice(0, 4).map(item => (
              <div
                key={item?.id || Math.random()}
                onClick={() => onSelectHistoryItem && item && onSelectHistoryItem(item)}
                className="p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-emerald-300 transition-all cursor-pointer space-y-2 text-xs"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center space-x-2">
                    <span className="text-base">🐾</span>
                    <span className="font-bold text-slate-900">{item?.patientName || 'Patient'} ({item?.species || 'Animal'})</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    item?.urgency === 'CRITICAL' || item?.triageLevel === 'RED' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {item?.urgency || item?.triageLevel || 'MODERATE'}
                  </span>
                </div>
                <div className="text-slate-700">
                  <span className="text-slate-400">Diagnosis:</span> <strong className="text-emerald-800">{item?.topDisease || 'Clinical Assessment'}</strong> ({item?.confidence || 85}%)
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-200">
                  <span>{item?.date || 'Recent'}</span>
                  <span className="text-emerald-600 font-semibold">View Result Summary →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Animal Patient Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-900">
                {showEditModal ? `✏️ Edit Profile: ${editingPatient?.name || 'Animal'}` : '➕ Add Animal Profile & Digital Passport'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                }}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={showEditModal ? handleUpdatePatient : handleAddPatient} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Animal / Pet Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Gauri / Max / Lakshmi"
                    value={newPatient.name}
                    onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Species *</label>
                  <select
                    value={newPatient.species}
                    onChange={(e) => setNewPatient({ ...newPatient, species: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  >
                    <option value="cattle">Cow / Cattle (Bovine)</option>
                    <option value="buffalo">Buffalo (Murrah/Jafarabadi)</option>
                    <option value="goat">Goat (Caprine)</option>
                    <option value="sheep">Sheep (Ovine)</option>
                    <option value="dog">Dog (Canine)</option>
                    <option value="cat">Cat (Feline)</option>
                    <option value="horse">Horse (Equine)</option>
                    <option value="poultry">Poultry / Broiler / Layer</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Breed</label>
                  <input
                    type="text"
                    placeholder="e.g. Gir / HF Cross"
                    value={newPatient.breed}
                    onChange={(e) => setNewPatient({ ...newPatient, breed: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Age</label>
                  <input
                    type="text"
                    placeholder="e.g. 3 years"
                    value={newPatient.age}
                    onChange={(e) => setNewPatient({ ...newPatient, age: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Weight</label>
                  <input
                    type="text"
                    placeholder="e.g. 350 kg"
                    value={newPatient.weight}
                    onChange={(e) => setNewPatient({ ...newPatient, weight: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Pashu Aadhaar / Tag #</label>
                  <input
                    type="text"
                    placeholder="12-digit Ear Tag (e.g. 100234891023)"
                    value={newPatient.tag_number}
                    onChange={(e) => setNewPatient({ ...newPatient, tag_number: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Sex</label>
                  <select
                    value={newPatient.sex}
                    onChange={(e) => setNewPatient({ ...newPatient, sex: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Unknown</option>
                    <option value="Female">Female (Lactating/Heifer)</option>
                    <option value="Male">Male (Bull/Sire/Castrated)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Village / Town</label>
                  <input
                    type="text"
                    placeholder="e.g. Baramati"
                    value={newPatient.village}
                    onChange={(e) => setNewPatient({ ...newPatient, village: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">District</label>
                  <input
                    type="text"
                    placeholder="e.g. Pune"
                    value={newPatient.district}
                    onChange={(e) => setNewPatient({ ...newPatient, district: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Clinical Notes & Prior History</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Prior mild mastitis in right rear quarter in 2025, vaccinated for FMD."
                  value={newPatient.notes}
                  onChange={(e) => setNewPatient({ ...newPatient, notes: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed"
                />
              </div>

              {error && <p className="text-xs font-semibold text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">{error}</p>}

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-60 shadow-md"
                >
                  {saving ? 'Saving...' : showEditModal ? 'Save Changes' : 'Create Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Digital Health Passport Modal */}
      {selectedPassportAnimal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <span className="text-4xl p-2.5 bg-emerald-50 rounded-2xl border border-emerald-200">
                  {getSpeciesIcon(selectedPassportAnimal.species)}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-black text-slate-900">{selectedPassportAnimal.name}</h3>
                    <span className="text-[10px] font-black uppercase px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                      Digital Health Passport
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedPassportAnimal.species} • {selectedPassportAnimal.breed || 'Mixed'} • {selectedPassportAnimal.age || 'Age unrecorded'} • {selectedPassportAnimal.weight || ''} • Tag: {selectedPassportAnimal.tag_number || 'Unassigned'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPassportAnimal(null)}
                className="text-slate-400 hover:text-slate-700 font-bold text-xl"
              >
                ✕
              </button>
            </div>

            {/* Passport Tabs */}
            <div className="flex border-b border-slate-200 text-xs font-bold space-x-4">
              <button
                onClick={() => setPassportTab('labs')}
                className={`pb-3 px-2 transition-all border-b-2 flex items-center gap-1.5 ${
                  passportTab === 'labs'
                    ? 'border-purple-600 text-purple-700 font-black'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>🧪</span>
                <span>Verified Vet Lab Results ({passportLabResults.length})</span>
              </button>
              <button
                onClick={() => setPassportTab('screenings')}
                className={`pb-3 px-2 transition-all border-b-2 flex items-center gap-1.5 ${
                  passportTab === 'screenings'
                    ? 'border-emerald-600 text-emerald-700 font-black'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>🩺</span>
                <span>AI Diagnostic Screenings ({passportScreenings.length})</span>
              </button>
              <button
                onClick={() => setPassportTab('vaccines')}
                className={`pb-3 px-2 transition-all border-b-2 flex items-center gap-1.5 ${
                  passportTab === 'vaccines'
                    ? 'border-blue-600 text-blue-700 font-black'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>💉</span>
                <span>Vaccine & Deworming Protocol</span>
              </button>
            </div>

            {/* Tab 1: Verified Veterinary Laboratory Results */}
            {passportTab === 'labs' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-xs text-slate-500">
                    Confidential laboratory test reports issued exclusively for this animal by licensed veterinary polyclinics.
                  </p>
                  {isVet && (
                    <button
                      onClick={() => {
                        setLabForm(prev => ({
                          ...prev,
                          animal_id: selectedPassportAnimal.id,
                          animal_name: selectedPassportAnimal.name
                        }));
                        setShowPublishLabModal(true);
                      }}
                      className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-sm"
                    >
                      + Issue New Lab Report
                    </button>
                  )}
                </div>

                {loadingPassport ? (
                  <div className="text-center py-8 text-xs text-slate-400">Loading verified lab reports...</div>
                ) : passportLabResults.length === 0 ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-400 space-y-2">
                    <span className="text-3xl block">🧪</span>
                    <p className="font-bold text-slate-600">No laboratory test reports on record</p>
                    <p>When a field veterinarian or clinic conducts a blood panel, milk somatic cell count, or PCR assay, the results will appear here securely.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {passportLabResults.map(lab => (
                      <div key={lab.id} className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-3 text-xs">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-black text-slate-900 text-sm">{lab.test_type}</h4>
                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                lab.status === 'Critical'
                                  ? 'bg-red-100 text-red-800'
                                  : lab.status === 'Abnormal'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {lab.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Sample Date: {lab.sample_date} • Issued by Dr. {lab.vet_name} ({lab.clinic_name || 'Veterinary Polyclinic'})
                            </p>
                          </div>
                        </div>

                        {lab.test_parameters_json && (
                          <div className="bg-white p-3 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-800 leading-relaxed whitespace-pre-wrap">
                            <strong>Diagnostic Parameters:</strong>
                            <div className="mt-1">{lab.test_parameters_json}</div>
                          </div>
                        )}

                        <div className="text-slate-800 leading-relaxed">
                          <strong className="text-slate-600 block text-[10px] uppercase">Clinical Interpretation & Findings:</strong>
                          {lab.interpretation}
                        </div>

                        {lab.recommendation && (
                          <div className="bg-purple-50 border border-purple-200 p-3 rounded-xl text-purple-950 text-[11px] leading-relaxed">
                            <strong>Veterinary Action / Prescription:</strong> {lab.recommendation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: AI Diagnostic Screenings */}
            {passportTab === 'screenings' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-500">
                  Longitudinal history of AI multimodal screening scans and lesion progression.
                </p>

                {passportScreenings.length === 0 ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-400 space-y-2">
                    <span className="text-3xl block">🩺</span>
                    <p className="font-bold text-slate-600">No previous AI scans attached to this animal</p>
                    <p>Select this animal before scanning to automatically link future differential assessments to this passport.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {passportScreenings.map(sc => (
                      <div key={sc.id} className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-2 text-xs">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 block">{sc.created_at || 'Previous Scan'}</span>
                            <h4 className="font-black text-slate-900 text-sm">
                              {sc.assessment?.possible_conditions?.[0]?.name || 'Clinical Screening'}
                            </h4>
                          </div>
                          <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                            sc.urgency === 'CRITICAL' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {sc.urgency || 'MODERATE'}
                          </span>
                        </div>

                        <p className="text-slate-700 leading-relaxed">{sc.assessment?.summary}</p>

                        {sc.visual_analysis?.lesion_description && (
                          <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200">
                            <strong>Visual Observation:</strong> {sc.visual_analysis.lesion_description}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Vaccination & Deworming Schedule */}
            {passportTab === 'vaccines' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-500">
                  Recommended preventive immunizations and deworming schedule for {selectedPassportAnimal.species} in Maharashtra.
                </p>

                <div className="space-y-2.5">
                  {getVaccineProtocol(selectedPassportAnimal.species).map((vac, idx) => (
                    <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
                      <div>
                        <h4 className="font-bold text-slate-900">{vac.name}</h4>
                        <span className="text-[11px] text-slate-500">Recommended Frequency: {vac.frequency}</span>
                      </div>
                      <span className="text-[10px] font-black uppercase bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full">
                        {vac.mandate}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedPassportAnimal(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-5 py-2.5 rounded-xl transition-colors"
              >
                Close Passport
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Veterinarian Lab Test Result Publishing Modal */}
      {showPublishLabModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-black uppercase bg-purple-100 text-purple-800 px-2.5 py-0.5 rounded-full">
                  Veterinary Diagnostic Portal
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-1">Issue Official Clinical Lab Report</h3>
              </div>
              <button onClick={() => setShowPublishLabModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">✕</button>
            </div>

            {labSuccessMsg && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 p-4 rounded-2xl text-xs font-bold animate-in fade-in duration-200">
                {labSuccessMsg}
              </div>
            )}

            <form onSubmit={handlePublishLabResult} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Target Patient Animal *</label>
                  <select
                    required
                    value={labForm.animal_id}
                    onChange={(e) => {
                      const selected = safeAnimals.find(a => String(a.id) === e.target.value);
                      setLabForm({
                        ...labForm,
                        animal_id: e.target.value,
                        animal_name: selected?.name || ''
                      });
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none font-bold"
                  >
                    <option value="">-- Select Registered Animal --</option>
                    {safeAnimals.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.species} • Tag: {a.tag_number || a.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Test Classification *</label>
                  <select
                    value={labForm.test_type}
                    onChange={(e) => setLabForm({ ...labForm, test_type: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  >
                    <option value="Complete Blood Count (CBC)">Complete Blood Count (CBC)</option>
                    <option value="California Mastitis Test (CMT)">California Mastitis Test (CMT)</option>
                    <option value="Skin Scraping & Cytology">Skin Scraping & Cytology</option>
                    <option value="RT-PCR Antigen Assay">RT-PCR Viral / Bacterial Antigen</option>
                    <option value="Blood Smear Protozoan Exam">Blood Smear Protozoan Exam</option>
                    <option value="Serum Biochemistry & Electrolytes">Serum Biochemistry & Electrolytes</option>
                    <option value="Fecal Egg Count / Floatation">Fecal Egg Count / Floatation</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Sample Date</label>
                  <input
                    type="date"
                    required
                    value={labForm.sample_date}
                    onChange={(e) => setLabForm({ ...labForm, sample_date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Diagnostic Status *</label>
                  <select
                    value={labForm.status}
                    onChange={(e) => setLabForm({ ...labForm, status: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none font-bold"
                  >
                    <option value="Normal">🟢 Normal / Clear</option>
                    <option value="Abnormal">🟡 Abnormal (Requires Treatment)</option>
                    <option value="Critical">🔴 Critical (Immediate Quarantine / Intervention)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Key Diagnostic Markers & Parameter Values</label>
                <input
                  type="text"
                  placeholder="e.g. WBC: 15.2 x10^3/uL (Elevated), Somatic Cells: >800,000 cells/mL, Platelets: Normal"
                  value={labForm.test_parameters_json}
                  onChange={(e) => setLabForm({ ...labForm, test_parameters_json: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Doctor's Clinical Interpretation & Findings *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Positive indication for subclinical mastitis in left front quarter. Mild leukocytosis with neutrophil shift."
                  value={labForm.interpretation}
                  onChange={(e) => setLabForm({ ...labForm, interpretation: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Prescription & Follow-up Recommendation</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Administer intramammary cephalosporin for 3 days. Disinfect teat cups with chlorhexidine 0.5%."
                  value={labForm.recommendation}
                  onChange={(e) => setLabForm({ ...labForm, recommendation: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none leading-relaxed"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPublishLabModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={publishingLab}
                  className="px-6 py-2.5 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 disabled:opacity-60 shadow-md flex items-center gap-1.5"
                >
                  <span>📢</span>
                  <span>{publishingLab ? 'Publishing Report...' : 'Publish & Deliver Lab Report'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
