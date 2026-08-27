import React, { useState } from 'react';

export default function Navbar({ activePage, setActivePage, user, setUser, onLogout }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'home', label: 'AI Scanner', icon: '⚡' },
    ...(user ? [{ id: 'dashboard', label: 'Dashboard', icon: '📊' }] : []),
    { id: 'disease-info', label: 'Disease Library', icon: '📚' },
    { id: 'animal-info', label: 'Vitals Guide', icon: '🐾' },
    { id: 'history', label: 'Reports', icon: '🕒' },
    { id: 'emergency', label: '24/7 SOS', icon: '🚨' }
  ];

  const handleNavClick = (id) => {
    setActivePage(id);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo */}
          <div 
            className="flex items-center space-x-3 cursor-pointer select-none"
            onClick={() => handleNavClick('home')}
          >
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white text-xl shadow-md shadow-emerald-500/20">
              🐾
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-lg font-black tracking-tight text-slate-900">VetMyPet</span>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">AI 2.0</span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Multimodal Veterinary Triage</p>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activePage === item.id 
                    ? 'bg-emerald-600 text-white shadow-sm' 
                    : item.id === 'emergency'
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          {/* Auth CTA */}
          <div className="hidden sm:flex items-center space-x-2.5">
            {user ? (
              <div className="flex items-center space-x-2 pl-2 border-l border-slate-200">
                <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl">{user?.name || 'Veterinarian'}</span>
                <button
                  onClick={() => {
                    if (onLogout) onLogout();
                    else setUser(null);
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-red-600 rounded-xl hover:bg-red-50 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleNavClick('login')}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Sign In
                </button>
                <button
                  onClick={() => handleNavClick('signup')}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 shadow-sm transition-colors"
                >
                  Register
                </button>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xl font-bold"
            >
              {mobileMenuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white p-4 space-y-2 shadow-xl">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activePage === item.id 
                  ? 'bg-emerald-600 text-white' 
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
          <div className="pt-3 border-t border-slate-100 flex gap-2">
            {user ? (
              <button
                onClick={() => {
                  if (onLogout) onLogout();
                  else setUser(null);
                  setMobileMenuOpen(false);
                }}
                className="w-full text-center py-2 text-xs font-bold text-red-600 bg-red-50 rounded-xl"
              >
                Sign Out
              </button>
            ) : (
              <>
                <button
                  onClick={() => handleNavClick('login')}
                  className="flex-1 py-2 text-xs font-bold text-slate-700 bg-slate-100 rounded-xl text-center"
                >
                  Sign In
                </button>
                <button
                  onClick={() => handleNavClick('signup')}
                  className="flex-1 py-2 text-xs font-bold text-white bg-emerald-600 rounded-xl text-center"
                >
                  Register
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
