import React, { useState } from 'react';
import AnimalCard from '../components/AnimalCard.jsx';

export default function AnimalInfo({ speciesList, selectedSpecies, setSelectedSpecies, setActivePage }) {
  const [activeTab, setActiveTab] = useState(selectedSpecies || 'dog');

  const currentAnimal = speciesList.find(s => s.id === activeTab) || speciesList[0];

  return (
    <div className="space-y-8">
      
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full uppercase">
            Veterinary Anatomy & Physiology Portal
          </span>
          <h1 className="text-2xl font-black text-slate-900 mt-2">Species Care & Baseline Vitals</h1>
          <p className="text-xs text-slate-500">Normal physiological parameters, common breed vulnerabilities, and vaccination protocols</p>
        </div>
        <button
          onClick={() => {
            setSelectedSpecies(activeTab);
            setActivePage('home');
          }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm transition-colors self-start sm:self-auto"
        >
          Check Symptoms for {currentAnimal.name.split(' ')[0]} →
        </button>
      </div>

      {/* Species Selector Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {speciesList.map(sp => (
          <button
            key={sp.id}
            onClick={() => setActiveTab(sp.id)}
            className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center justify-center text-center ${
              activeTab === sp.id
                ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold shadow-sm'
                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
            }`}
          >
            <span className="text-2xl mb-1">{sp.icon}</span>
            <span className="text-xs truncate w-full">{sp.name.split(' ')[0]}</span>
          </button>
        ))}
      </div>

      {/* Animal Detail Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-center space-x-4">
            <div className="text-5xl p-3 bg-emerald-50 rounded-2xl">{currentAnimal.icon}</div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-2xl font-black text-slate-900">{currentAnimal.name}</h2>
                <span className="text-xs uppercase font-extrabold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {currentAnimal.category}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">{currentAnimal.desc}</p>
            </div>
          </div>
        </div>

        {/* Normal Physiological Vitals Grid */}
        <div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Normal Physiological Vitals Range</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <span className="text-slate-400 block mb-1 font-semibold">Body Temperature</span>
              <span className="text-base font-black text-emerald-700">{currentAnimal.vitals?.temp || '38.3 - 39.2 °C'}</span>
              <p className="text-[11px] text-slate-500 mt-1">Normal rectal temperature</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <span className="text-slate-400 block mb-1 font-semibold">Heart Rate (Pulse)</span>
              <span className="text-base font-black text-slate-900">{currentAnimal.vitals?.heartRate || '60 - 140 bpm'}</span>
              <p className="text-[11px] text-slate-500 mt-1">Beats per minute at rest</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <span className="text-slate-400 block mb-1 font-semibold">Respiratory Rate</span>
              <span className="text-base font-black text-slate-900">{currentAnimal.vitals?.respRate || '10 - 30 bpm'}</span>
              <p className="text-[11px] text-slate-500 mt-1">Breaths per minute</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <span className="text-slate-400 block mb-1 font-semibold">Capillary Refill Time</span>
              <span className="text-base font-black text-slate-900">{currentAnimal.vitals?.crt || '&lt; 2 seconds'}</span>
              <p className="text-[11px] text-slate-500 mt-1">Gum perfusion test</p>
            </div>
          </div>
        </div>

        {/* Clinical Care & Vaccination Roadmap */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <div className="bg-emerald-50/60 p-5 rounded-2xl border border-emerald-100 text-xs space-y-3">
            <h4 className="font-bold text-emerald-950 text-sm">🛡️ Core Preventive Vaccination Protocol</h4>
            <ul className="space-y-2 text-emerald-900 list-disc list-inside">
              <li><strong>Puppy / Kitten / Calf Core:</strong> Initial series starting at 6-8 weeks with boosters every 3-4 weeks until 16 weeks.</li>
              <li><strong>Rabies Vaccine:</strong> Mandatory at 12-16 weeks with annual or triennial boosters.</li>
              <li><strong>Deworming & Parasites:</strong> Broad-spectrum anthelmintic every 3 months; monthly ectoparasite prevention.</li>
            </ul>
          </div>

          <div className="bg-amber-50/60 p-5 rounded-2xl border border-amber-100 text-xs space-y-3">
            <h4 className="font-bold text-amber-950 text-sm">⚠️ High Priority Species Vulnerabilities</h4>
            <ul className="space-y-2 text-amber-900 list-disc list-inside">
              <li><strong>Critical Emergencies:</strong> Bloat / GDV (Large dogs), Urethral blockage (Male cats), Acute Colic (Horses), Mastitis/FMD (Cattle).</li>
              <li><strong>Toxic Hazards:</strong> Toxic human analgesics (Acetaminophen, Ibuprofen), Chocolate, Xylitol, Lilies for cats.</li>
            </ul>
          </div>
        </div>

      </div>

    </div>
  );
}
