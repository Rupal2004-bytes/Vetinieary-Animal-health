import React, { useState } from 'react';
import { createAnimal } from '../api/client.js';

export default function Dashboard({ setActivePage, user, historyList, onSelectHistoryItem, animals = [], onRefresh }) {
  const fallbackPatients = [
    { id: 'p1', name: 'Buddy', species: 'Dog (Canine)', breed: 'Golden Retriever', age: '2 yrs', weight: '28 kg', lastCheck: 'Today', status: 'Under Evaluation', statusColor: 'bg-amber-100 text-amber-800' },
    { id: 'p2', name: 'Luna', species: 'Cat (Feline)', breed: 'Persian Mix', age: '3 yrs', weight: '4.2 kg', lastCheck: 'Yesterday', status: 'Stable', statusColor: 'bg-emerald-100 text-emerald-800' },
    { id: 'p3', name: 'Daisy (Herd #402)', species: 'Cattle (Bovine)', breed: 'Holstein Dairy', age: '4 yrs', weight: '550 kg', lastCheck: '3 days ago', status: 'Vaccinated', statusColor: 'bg-blue-100 text-blue-800' },
  ];
  const patients = animals.length > 0 ? animals.map(a => ({
    ...a,
    species: a.species,
    lastCheck: 'Saved profile',
    status: 'Registered',
    statusColor: 'bg-emerald-100 text-emerald-800'
  })) : fallbackPatients;

  const [showAddModal, setShowAddModal] = useState(false);
  const [newPatient, setNewPatient] = useState({ name: '', species: 'dog', breed: '', age: '', weight: '', sex: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleAddPatient = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await createAnimal(newPatient);
      await onRefresh?.();
      setShowAddModal(false);
      setNewPatient({ name: '', species: 'dog', breed: '', age: '', weight: '', sex: '', notes: '' });
    } catch (err) {
      setError(err.message || 'Could not save animal.');
    } finally {
      setSaving(false);
    }
  };

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
            Overview of monitored animals, recent disease predictions, and diagnostic activity
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
          >
            <span>➕ Add Animal Profile</span>
          </button>
          <button
            onClick={() => setActivePage('prediction')}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
          >
            <span>🩺 New Diagnostic Scan</span>
          </button>
        </div>
      </div>

      {/* Analytics Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Monitored Animals</span>
            <span className="p-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm">🐾</span>
          </div>
          <span className="text-3xl font-black text-slate-900">{patients.length}</span>
          <p className="text-[11px] text-slate-400 mt-1">Active profiles in your care</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Total Predictions</span>
            <span className="p-2 bg-blue-50 text-blue-700 rounded-lg text-sm">🔬</span>
          </div>
          <span className="text-3xl font-black text-slate-900">{historyList.length}</span>
          <p className="text-[11px] text-slate-400 mt-1">AI differential checks run</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Emergency Flags</span>
            <span className="p-2 bg-red-50 text-red-700 rounded-lg text-sm">🚨</span>
          </div>
          <span className="text-3xl font-black text-red-600">
            {historyList.filter(h => h.urgency === 'CRITICAL' || h.triageLevel === 'RED').length}
          </span>
          <p className="text-[11px] text-slate-400 mt-1">Critical red-flag triage cases</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Resolved Cases</span>
            <span className="p-2 bg-purple-50 text-purple-700 rounded-lg text-sm">✅</span>
          </div>
          <span className="text-3xl font-black text-slate-900">92%</span>
          <p className="text-[11px] text-slate-400 mt-1">Under managed clinical care</p>
        </div>
      </div>

      {/* Patient List */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Your Animal Patients / Livestock</h2>
            <p className="text-xs text-slate-500">Manage individual profiles and quickly trigger differential tests</p>
          </div>
          <span className="text-xs font-semibold text-slate-500">{patients.length} Registered</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200">
                <th className="py-3 px-4">Patient</th>
                <th className="py-3 px-4">Species & Breed</th>
                <th className="py-3 px-4">Age / Weight</th>
                <th className="py-3 px-4">Last Evaluation</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {patients.map(p => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                      {p.name.charAt(0)}
                    </span>
                    <span>{p.name}</span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-700">
                    <div className="font-semibold">{p.species}</div>
                    <div className="text-[11px] text-slate-400">{p.breed}</div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">{p.age} • {p.weight}</td>
                  <td className="py-3.5 px-4 text-slate-500">{p.lastCheck}</td>
                  <td className="py-3.5 px-4">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.statusColor}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right space-x-2">
                    <button
                      onClick={() => setActivePage('prediction')}
                      className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-bold transition-colors"
                    >
                      Run Scan
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Prediction Activity */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Recent Disease Predictions & Scans</h2>
            <p className="text-xs text-slate-500">History of analyzed cases and triage scores</p>
          </div>
          <button
            onClick={() => setActivePage('history')}
            className="text-xs font-bold text-emerald-600 hover:underline"
          >
            View Full History ({historyList.length}) →
          </button>
        </div>

        {historyList.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            No prediction scans run yet. Click "New Diagnostic Scan" to run your first check!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {historyList.slice(0, 4).map(item => (
              <div
                key={item.id}
                onClick={() => onSelectHistoryItem && onSelectHistoryItem(item)}
                className="p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-emerald-300 transition-all cursor-pointer space-y-2 text-xs"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center space-x-2">
                    <span className="text-base">🐾</span>
                    <span className="font-bold text-slate-900">{item.patientName} ({item.species})</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    item.urgency === 'CRITICAL' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {item.urgency}
                  </span>
                </div>
                <div className="text-slate-700">
                  <span className="text-slate-400">Diagnosis:</span> <strong className="text-emerald-800">{item.topDisease}</strong> ({item.confidence}%)
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-200">
                  <span>{item.date}</span>
                  <span className="text-emerald-600 font-semibold">View Result Summary →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Patient Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Add New Animal Patient</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleAddPatient} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Animal / Pet Name or Tag #</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Max / Tag #204"
                  value={newPatient.name}
                  onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Species</label>
                <select
                  value={newPatient.species}
                  onChange={(e) => setNewPatient({ ...newPatient, species: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="dog">Dog (Canine)</option>
                  <option value="cat">Cat (Feline)</option>
                  <option value="cattle">Cattle (Bovine)</option>
                  <option value="goat">Goat</option>
                  <option value="sheep">Sheep</option>
                  <option value="poultry">Poultry / Bird</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Breed</label>
                  <input
                    type="text"
                    placeholder="e.g. German Shepherd"
                    value={newPatient.breed}
                    onChange={(e) => setNewPatient({ ...newPatient, breed: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Age</label>
                  <input
                    type="text"
                    placeholder="e.g. 2 years"
                    value={newPatient.age}
                    onChange={(e) => setNewPatient({ ...newPatient, age: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Weight (kg)</label>
                <input
                  type="text"
                  placeholder="e.g. 25 kg"
                  value={newPatient.weight}
                  onChange={(e) => setNewPatient({ ...newPatient, weight: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Sex</label>
                  <select
                    value={newPatient.sex}
                    onChange={(e) => setNewPatient({ ...newPatient, sex: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Unknown</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Notes</label>
                  <input
                    type="text"
                    placeholder="Optional"
                    value={newPatient.notes}
                    onChange={(e) => setNewPatient({ ...newPatient, notes: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {error && <p className="text-xs font-semibold text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">{error}</p>}

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
