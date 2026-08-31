import React, { useState } from 'react';

export default function Navbar({ activePage, setActivePage, user, setUser, onLogout, unreadAlertsCount = 0 }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isNGOorGov = user?.role === 'ngo' || user?.role === 'gov';
  const isVet = user?.role === 'vet';

  const navItems = isNGOorGov
    ? [
        { id: 'dashboard', label: 'Directives & Dashboard', icon: '📢' },
        { 
          id: 'notifications', 
          label: 'Outbreak Radar', 
          icon: '🚨', 
          hasBadge: true,
          badgeCount: unreadAlertsCount
        },
        { id: 'inventory', label: 'Relief Inventory', icon: '📦' },
        { id: 'consultations', label: 'Vet Directory', icon: '🩺' },
        { id: 'emergency', label: '1962 Helpline', icon: '📞' }
      ]
    : isVet
    ? [
        { id: 'consultations', label: 'Doctor Review Queue', icon: '🩺' },
        { 
          id: 'notifications', 
          label: 'Outbreak Radar', 
          icon: '🚨', 
          hasBadge: true,
          badgeCount: unreadAlertsCount
        },
        { id: 'inventory', label: 'Clinic Inventory', icon: '📦' },
        { id: 'dashboard', label: 'Clinical Dashboard', icon: '📊' },
        { id: 'history', label: 'Case Records', icon: '🕒' },
        { id: 'emergency', label: '1962 Helpline', icon: '📞' }
      ]
    : [
        { id: 'home', label: 'AI Scanner', icon: '⚡' },
        { 
          id: 'notifications', 
          label: 'Outbreak Radar', 
          icon: '🚨', 
          hasBadge: true,
          badgeCount: unreadAlertsCount
        },
        { id: 'consultations', label: 'Vet Consult', icon: '🩺' },
        { id: 'inventory', label: 'Supply Inventory', icon: '📦' },
        ...(user ? [{ id: 'dashboard', label: 'Dashboard', icon: '📊' }] : []),
        { id: 'history', label: 'Reports', icon: '🕒' },
        { id: 'disease-info', label: 'Library', icon: '📚' },
        { id: 'emergency', label: '1962 Helpline', icon: '📞' }
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
            onClick={() => handleNavClick(isNGOorGov ? 'dashboard' : isVet ? 'consultations' : 'home')}
          >
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white text-xl shadow-md shadow-emerald-500/20">
              🐾
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-lg font-black tracking-tight text-slate-900">PashuRakshak</span>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">पशुरक्षक</span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Animal Health & Outbreak Surveillance Grid</p>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`relative px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activePage === item.id 
                    ? 'bg-emerald-600 text-white shadow-sm' 
                    : item.id === 'notifications'
                    ? 'text-red-700 hover:bg-red-50'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
                {item.hasBadge && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Auth CTA */}
          <div className="hidden sm:flex items-center space-x-2.5">
            {user ? (
              <div className="flex items-center space-x-2 pl-2 border-l border-slate-200">
                <button
                  onClick={() => handleNavClick('profile')}
                  title="View & Edit Profile Information, Location and Password"
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 px-3 py-1.5 rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  <span>{user?.role === 'vet' ? '🩺' : user?.role === 'farmer' ? '🚜' : '👤'}</span>
                  <span>{user?.name || 'My Account'}</span>
                </button>
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
