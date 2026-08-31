import React from 'react';

export default function Footer({ setActivePage }) {
  return (
    <footer className="bg-slate-900 text-slate-400 text-xs py-10 border-t border-slate-800 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Brand Info */}
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center space-x-2 text-white font-bold text-base">
              <span className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center text-sm">🐾</span>
              <span>PashuRakshak (पशुरक्षक)</span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed max-w-md">
              Comprehensive animal health & epidemic surveillance grid with Pashu Aadhaar records, verified vet lab results, and instant triage in alignment with Maharashtra PS ID 26128.
            </p>
            <div className="flex items-center space-x-3 text-slate-300 text-xs pt-1">
              <span className="bg-slate-800 px-2.5 py-1 rounded">🛡️ Pashu Aadhaar Registry</span>
              <span className="bg-slate-800 px-2.5 py-1 rounded">⚡ 99.4% Uptime</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-2">
            <h4 className="text-white font-bold uppercase tracking-wider text-xs">Diagnostic Suite</h4>
            <ul className="space-y-1.5 text-xs">
              <li><button onClick={() => setActivePage('home')} className="hover:text-emerald-400 transition-colors">Symptom Checker</button></li>
              <li><button onClick={() => setActivePage('home')} className="hover:text-emerald-400 transition-colors">Visual Screening</button></li>
              <li><button onClick={() => setActivePage('disease-info')} className="hover:text-emerald-400 transition-colors">Disease Encyclopedia</button></li>
              <li><button onClick={() => setActivePage('emergency')} className="hover:text-red-400 transition-colors">Emergency Triage SOS</button></li>
            </ul>
          </div>

          {/* Species & Support */}
          <div className="space-y-2">
            <h4 className="text-white font-bold uppercase tracking-wider text-xs">Support & Legal</h4>
            <ul className="space-y-1.5 text-xs">
              <li><button onClick={() => setActivePage('animal-info')} className="hover:text-emerald-400 transition-colors">Species Vitals Guide</button></li>
              <li><button onClick={() => setActivePage('about')} className="hover:text-emerald-400 transition-colors">About PashuRakshak</button></li>
              <li><button onClick={() => setActivePage('contact')} className="hover:text-emerald-400 transition-colors">Contact Support</button></li>
              <li><a href="tel:1962" className="text-emerald-400 font-bold hover:underline">📞 Helpline: 1962 (Toll Free)</a></li>
            </ul>
          </div>

        </div>

        {/* Disclaimer Banner */}
        <div className="pt-6 border-t border-slate-800/80 text-[11px] text-slate-400 leading-relaxed bg-slate-950/50 p-4 rounded-xl">
          <strong className="text-slate-200">VETERINARY MEDICAL & TRIAGE DISCLAIMER:</strong> PashuRakshak is designed for educational, research, and diagnostic decision-support purposes. It does not replace in-person physical clinical examinations, diagnostic cytology, biopsy, or direct veterinary prescription by a licensed practitioner. If your animal is in critical distress, immediately transport them to an emergency veterinary polyclinic or call 1962.
        </div>

        {/* Bottom copyright */}
        <div className="flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 pt-2 gap-2">
          <p>© 2026 PashuRakshak. Built in alignment with Govt. of Maharashtra PS ID 26128.</p>
          <div className="flex space-x-4">
            <button onClick={() => setActivePage('about')} className="hover:text-slate-300">Privacy Policy</button>
            <button onClick={() => setActivePage('about')} className="hover:text-slate-300">Terms of Clinical Use</button>
            <button onClick={() => setActivePage('contact')} className="hover:text-slate-300">API Documentation</button>
          </div>
        </div>

      </div>
    </footer>
  );
}
