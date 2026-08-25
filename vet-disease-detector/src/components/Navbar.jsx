import React from 'react';

export default function Navbar({ activePage, setActivePage, user, setUser, onLogout }) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const navItems = [
    { id: 'home', label: 'Home', icon: '🏠' },
    { id: 'prediction', label: 'AI Prediction', icon: '🩺' },
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'animal-info', label: 'Animal Info', icon: '🐾' },
    { id: 'disease-info', label: 'Disease Info', icon: '📚' },
    { id: 'history', label: 'History', icon: '🕒' },
    { id: 'emergency', label: 'Emergency', icon: '🚨' },
    { id: 'about', label: 'About', icon: 'ℹ️' },
    { id: 'contact', label: 'Contact', icon: '📞' }
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo */}
          <div 
            className="flex items-center space-x-3 cursor-pointer select-none"
            onClick={() => setActivePage('home')}
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white text-xl shadow-md shadow-emerald-500/20">
              🐾
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-lg font-black tracking-tight text-slate-900">VetScan</span>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-1.5 py-0.5 rounded tracking-wider uppercase">AI React</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Veterinary Disease Detection</p>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden xl:flex items-center space-x-1">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activePage === item.id 
                    ? 'bg-emerald-600 text-white shadow-sm' 
                    : item.id === 'emergency'
                    ? 'text-red-700 hover:bg-red-50'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          {/* Auth & Emergency CTA */}
          <div className="hidden sm:flex items-center space-x-2.5">
            <button
              onClick={() => setActivePage('emergency')}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors flex items-center gap-1.5"
            >
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
              24/7 SOS
            </button>

            {user ? (
              <div className="flex items-center space-x-2 pl-2 border-l border-slate-200">
                <span className="text-xs font-semibold text-slate-700">{user.name}</span>
                <button
                  onClick={() => {
                    if (onLogout) onLogout();
                    else setUser(null);
                  }}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-500 hover:text-red-600 rounded-md hover:bg-slate-100"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setActivePage('login')}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  Log In
                </button>
                <button
                  onClick={() => setActivePage('signup')}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                >
                  Sign Up
                </button>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex xl:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <span className="text-xl">{mobileMenuOpen ? '✕' : '☰'}</span>
            </button>
          </div>

        </div>

        {/* Mobile Dropdown Navigation */}
        {mobileMenuOpen && (
          <div className="xl:hidden py-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 gap-1.5 pb-4">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => {
                  setActivePage(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`p-2 rounded-lg text-xs font-bold text-left flex items-center gap-2 ${
                  activePage === item.id
                    ? 'bg-emerald-600 text-white'
                    : item.id === 'emergency'
                    ? 'text-red-700 bg-red-50'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
            {!user ? (
              <>
                <button
                  onClick={() => { setActivePage('login'); setMobileMenuOpen(false); }}
                  className="p-2 text-xs font-bold text-center bg-slate-100 rounded-lg text-slate-800"
                >
                  Log In
                </button>
                <button
                  onClick={() => { setActivePage('signup'); setMobileMenuOpen(false); }}
                  className="p-2 text-xs font-bold text-center bg-emerald-600 text-white rounded-lg"
                >
                  Sign Up
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  if (onLogout) onLogout();
                  else setUser(null);
                  setMobileMenuOpen(false);
                }}
                className="p-2 text-xs font-bold text-center text-red-600 bg-red-50 rounded-lg"
              >
                Logout
              </button>
            )}
          </div>
        )}

      </div>
    </header>
  );
}
