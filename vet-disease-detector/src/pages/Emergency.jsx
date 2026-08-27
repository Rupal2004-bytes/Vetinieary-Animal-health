import React, { useState } from 'react';

export default function Emergency({ setActivePage }) {
  const [selectedEmergency, setSelectedEmergency] = useState(null);

  const emergencyProtocols = [
    {
      id: 'bloat',
      title: 'Gastric Dilatation-Volvulus (GDV / Bloat)',
      target: 'Large & Deep-Chested Dogs',
      signs: 'Distended drum-like hard abdomen, retching without vomit, restlessness, sudden collapse.',
      doFirst: 'Immediate surgical emergency! Keep dog lying on side or standing calmly. Transport immediately to 24/7 ER.',
      doNot: 'Do NOT give water, food, or press forcefully on the belly.'
    },
    {
      id: 'blocked_cat',
      title: 'Urethral Obstruction (Blocked Male Cat)',
      target: 'Male Cats',
      signs: 'Frequent painful straining in litterbox with zero urine produced, vocalizing, vomiting.',
      doFirst: 'Immediate medical catheterization required within hours to prevent fatal bladder rupture and cardiac arrest.',
      doNot: 'Do NOT press hard on the lower abdomen.'
    },
    {
      id: 'toxicity_poison',
      title: 'Acute Toxicity (Lily, Xylitol, Antifreeze, Rat Poison)',
      target: 'All Species (Cats: Lilies, Dogs: Xylitol/Chocolate)',
      signs: 'Sudden tremors, vomiting, seizures, hypoglycemia collapse, dark brown gums.',
      doFirst: 'Bring the packaging/plant sample with you. Rush to emergency vet hospital for antidotes (Fomepizole, IV Dextrose, NAC).',
      doNot: 'Do NOT induce vomiting with salt water or caustic substances.'
    },
    {
      id: 'colic_horse',
      title: 'Acute Equine Colic Crisis',
      target: 'Horses & Foals',
      signs: 'Violent rolling, pawing ground, kicking at belly, sweating, absence of gut sounds.',
      doFirst: 'Walk horse gently to prevent violent rolling injuries. Call equine field emergency vet.',
      doNot: 'Do NOT administer unprescribed painkillers before vet examination.'
    }
  ];

  return (
    <div className="space-y-8">
      
      {/* Red Alert Emergency Banner */}
      <div className="bg-red-950 rounded-3xl p-8 sm:p-10 text-white shadow-2xl border-2 border-red-800 space-y-4">
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-full bg-red-500 animate-ping"></span>
          <span className="text-xs font-black uppercase tracking-widest text-red-300">
            24/7 Critical Emergency Veterinary Dispatch
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black">Emergency Triage & SOS Guide</h1>
        <p className="text-red-200 text-xs sm:text-sm max-w-2xl leading-relaxed">
          If your animal has suffered trauma, is unresponsive, experiencing difficulty breathing, or exhibits acute poisoning signs, immediate emergency hospital transport is mandatory.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <a
            href="tel:1800555911"
            className="bg-red-600 hover:bg-red-700 text-white font-black text-sm px-6 py-3.5 rounded-xl shadow-lg transition-all flex items-center gap-2"
          >
            <span>📞 Call 24/7 Emergency Vet: 1-800-555-VET</span>
          </a>
          <a
            href="tel:18884264435"
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-5 py-3.5 rounded-xl border border-slate-700 transition-all"
          >
            ☠️ Animal Poison Control Hotline
          </a>
        </div>
      </div>

      {/* Triage Level Protocols */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Red */}
        <div className="bg-white rounded-3xl border-2 border-red-300 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="bg-red-600 text-white text-xs font-black px-3 py-1 rounded-full uppercase">
                🔴 RED: EMERGENCY
              </span>
              <span className="text-xs font-bold text-red-600">Immediate</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Life Threatening (&lt; 1 hr)</h3>
            <p className="text-xs text-slate-600 mb-3">Severe respiratory failure, blue gums, unconsciousness, severe hemorrhaging, or active bloat.</p>
          </div>
          <a href="tel:1800555911" className="w-full text-center bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2.5 rounded-xl transition-colors">
            Call Trauma Center
          </a>
        </div>

        {/* Amber */}
        <div className="bg-white rounded-3xl border-2 border-amber-300 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="bg-amber-500 text-white text-xs font-black px-3 py-1 rounded-full uppercase">
                🟡 AMBER: URGENT
              </span>
              <span className="text-xs font-bold text-amber-700">&lt; 24 Hours</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Acute Veterinary Exam</h3>
            <p className="text-xs text-slate-600 mb-3">Cloudy painful eye, high fever with lethargy, sudden severe limping, persistent diarrhea.</p>
          </div>
          <button onClick={() => setActivePage('home')} className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-2.5 rounded-xl transition-colors">
            Run Symptom Checker
          </button>
        </div>

        {/* Green */}
        <div className="bg-white rounded-3xl border-2 border-emerald-300 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="bg-emerald-600 text-white text-xs font-black px-3 py-1 rounded-full uppercase">
                🟢 GREEN: ROUTINE
              </span>
              <span className="text-xs font-bold text-emerald-700">Scheduled</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Home Monitoring</h3>
            <p className="text-xs text-slate-600 mb-3">Mild scratching, routine health checks, wellness booster shots, minor ear cleaning.</p>
          </div>
          <button onClick={() => setActivePage('animal-info')} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 rounded-xl transition-colors">
            Inspect Vitals Guide
          </button>
        </div>

      </div>

      {/* Critical First-Aid Protocols */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <h2 className="text-lg font-bold text-slate-900">Critical First-Aid & Transport Protocols</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {emergencyProtocols.map(proto => (
            <div key={proto.id} className="p-5 rounded-2xl border border-red-100 bg-red-50/40 space-y-2 text-xs">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-red-950 text-sm">{proto.title}</h3>
                <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">{proto.target}</span>
              </div>
              <p className="text-slate-700"><span className="font-semibold text-slate-900">Signs:</span> {proto.signs}</p>
              <div className="bg-white p-3 rounded-xl border border-red-100 space-y-1">
                <p className="text-emerald-900 font-semibold">✅ <span className="underline">Action:</span> {proto.doFirst}</p>
                <p className="text-red-900 font-semibold">🚫 <span className="underline">Caution:</span> {proto.doNot}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
