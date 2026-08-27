import React, { useState } from 'react';

export default function History({ historyList = [], onSelectHistoryItem, setActivePage }) {
  const [filterSpecies, setFilterSpecies] = useState('all');
  const safeHistory = Array.isArray(historyList) ? historyList : [];

  const filteredHistory = safeHistory.filter(item => {
    if (!item) return false;
    const sp = String(item.species || '').toLowerCase();
    return filterSpecies === 'all' || sp.includes(filterSpecies.toLowerCase());
  });

  return (
    <div className="space-y-6">
      
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full uppercase">
            Clinical Diagnostic Records
          </span>
          <h1 className="text-2xl font-black text-slate-900 mt-1">Prediction & Triage History</h1>
          <p className="text-xs text-slate-500">Chronological history of evaluated animal differential cases</p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={filterSpecies}
            onChange={(e) => setFilterSpecies(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="all">All Species</option>
            <option value="dog">Canine (Dogs)</option>
            <option value="cat">Feline (Cats)</option>
            <option value="cattle">Bovine (Cattle)</option>
            <option value="horse">Equine (Horses)</option>
          </select>

          <button
            onClick={() => setActivePage('home')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors"
          >
            + New Scan
          </button>
        </div>
      </div>

      {filteredHistory.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center text-xs text-slate-400 space-y-3">
          <div className="text-4xl">🕒</div>
          <h3 className="text-sm font-bold text-slate-700">No Past Records Found</h3>
          <p>Run scans in the AI Scanner tab to store and review triage records.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredHistory.map(item => (
            <div
              key={item.id}
              onClick={() => onSelectHistoryItem(item)}
              className="bg-white p-5 rounded-3xl border border-slate-200 hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex justify-between items-start">
                  <div className="flex items-center space-x-2">
                    <span className="text-xl">🐾</span>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{item.patientName}</h3>
                      <span className="text-[11px] text-slate-400">{item.species} • {item.breed}</span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                    item.urgency === 'CRITICAL' || item.triageLevel === 'RED'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {item.triageLevel || item.urgency}
                  </span>
                </div>

                <div className="mt-3 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs">
                  <span className="text-slate-400 block font-semibold text-[10px] uppercase">Primary Predicted Condition:</span>
                  <div className="flex justify-between items-center mt-0.5">
                    <strong className="text-slate-900 font-black">{item.topDisease}</strong>
                    <span className="text-emerald-700 font-extrabold">{item.confidence}% Match</span>
                  </div>
                </div>

                <div className="mt-2 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">Observed Signs:</span> {item.symptoms?.slice(0, 4).map(s => s.replace(/_/g, ' ')).join(', ')}...
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-[11px] text-slate-400">
                <span>Evaluated: {item.date}</span>
                <span className="font-bold text-emerald-600 hover:underline">Open Triage Summary →</span>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
