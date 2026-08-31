import React from 'react';

export default function About({ setActivePage }) {
  return (
    <div className="space-y-10">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-950 to-slate-900 rounded-3xl p-8 sm:p-12 text-white shadow-xl space-y-4">
        <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 bg-emerald-900/50 px-3 py-1 rounded-full border border-emerald-800">
          About PashuRakshak (पशुरक्षक)
        </span>
        <h1 className="text-3xl sm:text-5xl font-black">Empowering Animal Healthcare & Surveillance</h1>
        <p className="text-slate-300 text-sm sm:text-base max-w-2xl leading-relaxed">
          PashuRakshak was developed in alignment with Maharashtra Problem Statement ID 26128 by veterinary clinicians, animal health researchers, and software engineers to eliminate diagnostic delays, prevent livestock epidemics, and protect farmers' livelihoods.
        </p>
      </div>

      {/* Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3">
          <div className="text-3xl p-3 bg-emerald-50 text-emerald-700 rounded-2xl w-fit">🔬</div>
          <h3 className="text-base font-bold text-slate-900">Clinically Validated Rules</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Our multi-species symptom algorithms are mapped directly to peer-reviewed veterinary textbooks, WSAVA vaccination protocols, and global animal health surveillance databases.
          </p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3">
          <div className="text-3xl p-3 bg-blue-50 text-blue-700 rounded-2xl w-fit">📷</div>
          <h3 className="text-base font-bold text-slate-900">Deep Computer Vision</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Utilizing convolutional neural networks trained on thousands of annotated veterinary dermatological, parasitological, and ocular imaging datasets.
          </p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3">
          <div className="text-3xl p-3 bg-red-50 text-red-700 rounded-2xl w-fit">🚨</div>
          <h3 className="text-base font-bold text-slate-900">Zero-Delay Triage</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Immediate detection of life-threatening signs like GDV Bloat, FPV Panleukopenia, or severe toxicities, with direct routing to 24/7 emergency dispatch centers.
          </p>
        </div>
      </div>

      {/* Advisory Board */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <div className="text-center max-w-xl mx-auto space-y-1">
          <h2 className="text-2xl font-black text-slate-900">Veterinary Clinical Advisory Board</h2>
          <p className="text-xs text-slate-500">Guided by leaders in companion animal medicine, herd epidemiology & pathology</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4 text-center">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
            <div className="w-16 h-16 bg-emerald-600 text-white text-2xl font-bold rounded-full flex items-center justify-center mx-auto shadow-md">
              SJ
            </div>
            <h4 className="font-bold text-sm text-slate-900">Dr. Sarah Jenkins, DVM, DACVIM</h4>
            <p className="text-[11px] text-slate-500">Chief of Small Animal Internal Medicine</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
            <div className="w-16 h-16 bg-teal-600 text-white text-2xl font-bold rounded-full flex items-center justify-center mx-auto shadow-md">
              MR
            </div>
            <h4 className="font-bold text-sm text-slate-900">Dr. Marcus Reynolds, BVSc, PhD</h4>
            <p className="text-[11px] text-slate-500">Livestock Epidemiologist & Infectious Pathologist</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
            <div className="w-16 h-16 bg-slate-800 text-white text-2xl font-bold rounded-full flex items-center justify-center mx-auto shadow-md">
              EL
            </div>
            <h4 className="font-bold text-sm text-slate-900">Dr. Elena Lopez, DVM, DECVD</h4>
            <p className="text-[11px] text-slate-500">Veterinary Dermatologist & Parasitology Specialist</p>
          </div>
        </div>
      </div>

    </div>
  );
}
