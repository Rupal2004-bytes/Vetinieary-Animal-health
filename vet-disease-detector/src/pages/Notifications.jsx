import React, { useState, useEffect } from 'react';
import { 
  getNotifications, 
  markNotificationRead, 
  markAllNotificationsRead, 
  getOutbreaks, 
  getGovAdvisories, 
  getInventory 
} from '../api/client.js';

const DISTRICT_COORDINATES = {
  'Pune': { x: 38, y: 55, talukas: ['Baramati', 'Haveli', 'Shirur', 'Khed', 'Indapur'] },
  'Ahmednagar': { x: 44, y: 44, talukas: ['Sangamner', 'Rahata', 'Nevasa', 'Parner'] },
  'Kolhapur': { x: 35, y: 80, talukas: ['Hatkangale', 'Karveer', 'Shirol', 'Kagal'] },
  'Thane': { x: 26, y: 46, talukas: ['Kalyan', 'Dombivli', 'Bhiwandi', 'Shahapur'] },
  'Mumbai': { x: 22, y: 50, talukas: ['Mumbai Suburban', 'Mumbai City'] },
  'Nagpur': { x: 80, y: 22, talukas: ['Nagpur Rural', 'Kamptee', 'Umred'] },
  'Nashik': { x: 34, y: 32, talukas: ['Niphad', 'Malegaon', 'Sinnar', 'Yeola'] },
  'Solapur': { x: 55, y: 68, talukas: ['Pandharpur', 'Barshi', 'Malshiras'] },
  'Satara': { x: 36, y: 66, talukas: ['Karad', 'Phaltan', 'Wai'] },
  'Sangli': { x: 42, y: 76, talukas: ['Miraj', 'Walwa', 'Tasgaon'] }
};

export default function Notifications({ setActivePage, user }) {
  const [activeTab, setActiveTab] = useState('sos'); // 'sos' | 'map' | 'advisories' | 'inventory'
  const [notifications, setNotifications] = useState([]);
  const [outbreaks, setOutbreaks] = useState([]);
  const [advisories, setAdvisories] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [selectedDistrict, setSelectedDistrict] = useState(user?.district || 'All');
  const [selectedSpecies, setSelectedSpecies] = useState('All');
  const [selectedOutbreak, setSelectedOutbreak] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllData();
  }, [selectedDistrict, selectedSpecies]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [notifs, outbs, advs, invs] = await Promise.all([
        getNotifications(),
        getOutbreaks(selectedDistrict === 'All' ? '' : selectedDistrict, selectedSpecies === 'All' ? '' : selectedSpecies),
        getGovAdvisories(selectedDistrict === 'All' ? '' : selectedDistrict),
        getInventory(selectedDistrict === 'All' ? '' : selectedDistrict)
      ]);
      setNotifications(notifs);
      setOutbreaks(outbs);
      setAdvisories(advs);
      setInventory(invs);
      if (outbs.length > 0 && !selectedOutbreak) {
        setSelectedOutbreak(outbs[0]);
      }
    } catch (err) {
      console.error('Failed to load surveillance data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const sosNotifications = notifications.filter(n => n.is_sos || n.severity === 'CRITICAL' || n.severity === 'URGENT');

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-red-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider animate-pulse flex items-center gap-1">
              <span>🚨</span> Live Outbreak Radar & SOS Hub
            </span>
            <span className="text-xs text-slate-300">
              {user?.district ? `📍 Monitoring Zone: ${user.district}` : '🌐 Statewide Surveillance (Maharashtra)'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black mt-2 text-white">
            Animal Health Surveillance & Outbreak Radar
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Early detection alerts, geospatial disease clustering, actionable herd defense protocols, and real-time medical relief inventory.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-colors border border-white/20"
            >
              ✓ Mark All As Read
            </button>
          )}
          {user?.role === 'vet' ? (
            <button
              onClick={() => setActivePage('consultations')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md transition-colors flex items-center gap-1.5"
            >
              <span>📋 Doctor Review Queue</span>
            </button>
          ) : (
            <button
              onClick={() => setActivePage('home')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md transition-colors"
            >
              🩺 Run New Scan
            </button>
          )}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {[
          { id: 'sos', label: `🚨 Urgent SOS Alerts (${sosNotifications.length})`, count: unreadCount },
          { id: 'map', label: `🗺️ Outbreak Map (${outbreaks.length} Clusters)` },
          { id: 'advisories', label: `📢 Government & NGO Directives (${advisories.length})` },
          { id: 'inventory', label: `📦 Emergency Medication & Tools (${inventory.length})` }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-slate-900 text-white shadow-sm ring-2 ring-slate-900/20'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count > 0 && tab.id === 'sos' && (
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: URGENT SOS NOTIFICATIONS */}
      {activeTab === 'sos' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800">Filter Location:</span>
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="All">All Maharashtra Districts</option>
                {Object.keys(DISTRICT_COORDINATES).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <span className="text-slate-400 font-semibold">{notifications.length} Active Broadcasts</span>
          </div>

          {notifications.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 shadow-sm space-y-3">
              <div className="text-4xl">🟢</div>
              <h3 className="font-bold text-slate-900 text-base">No Active Outbreak Alerts in Your Area</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No contagious disease clusters currently detected for your district. Continue routine biosecurity and preventive vaccination.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => {
                    markNotificationRead(n.id);
                    setNotifications(notifications.map(item => item.id === n.id ? { ...item, read: true } : item));
                    const matchedOutbreak = outbreaks.find(o => o.id === n.outbreak_id || (o.district && n.district && o.district.toLowerCase() === n.district.toLowerCase()));
                    setActivePage('outbreak-detail', {
                      outbreakId: n.outbreak_id || matchedOutbreak?.id || 1,
                      initialOutbreak: matchedOutbreak || (outbreaks[0] || null)
                    });
                  }}
                  className={`p-5 rounded-3xl border-2 transition-all cursor-pointer ${
                    n.is_sos || n.severity === 'CRITICAL'
                      ? 'bg-red-50/90 border-red-300 text-red-950 shadow-sm hover:border-red-400'
                      : n.severity === 'URGENT'
                      ? 'bg-amber-50/90 border-amber-300 text-amber-950 shadow-sm hover:border-amber-400'
                      : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
                  } ${!n.read ? 'ring-2 ring-red-500/20' : 'opacity-90'} hover:scale-[1.01]`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-current/10">
                    <div className="flex items-center space-x-2">
                      <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                        n.is_sos ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'
                      }`}>
                        {n.severity}
                      </span>
                      <span className="font-bold text-xs">{n.title}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span>📍 {n.district || 'Statewide'}</span>
                      <span>•</span>
                      <span>{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-red-600"></span>}
                    </div>
                  </div>
                  <p className="text-xs mt-3 leading-relaxed font-medium">{n.message}</p>
                  
                  <div className="mt-3 pt-2.5 border-t border-current/10 flex justify-between items-center text-[11px] font-bold text-emerald-800">
                    <span>🛡️ Tap to view Outbreak Map, Directives & Prevention Protocols</span>
                    <span>→</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: GEOSPATIAL OUTBREAK MAP & CLUSTER RADAR */}
      {activeTab === 'map' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Visual Interactive Map Canvas */}
          <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Geospatial Cluster Radar (Maharashtra)</h3>
                <p className="text-[11px] text-slate-400">Real-time disease density markers across active livestock blocks</p>
              </div>
              <div className="flex gap-2">
                <select
                  value={selectedSpecies}
                  onChange={(e) => setSelectedSpecies(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold"
                >
                  <option value="All">All Species</option>
                  <option value="Bovine">Bovine (Cattle/Buffalo)</option>
                  <option value="Canine">Canine (Dogs)</option>
                  <option value="Caprine">Caprine/Ovine (Goats/Sheep)</option>
                  <option value="Avian">Avian (Poultry)</option>
                </select>
              </div>
            </div>

            {/* SVG Interactive District Heatmap */}
            <div className="relative w-full h-80 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center p-4">
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px]"></div>
              
              {/* State Outline Label */}
              <div className="absolute top-3 left-3 text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-1 rounded border border-emerald-800">
                STATE SURVEILLANCE: MAHARASHTRA
              </div>

              {/* District Node Markers */}
              {Object.entries(DISTRICT_COORDINATES).map(([distName, coords]) => {
                const distOutbreaks = outbreaks.filter(o => o.district.toLowerCase() === distName.toLowerCase());
                const totalAffected = distOutbreaks.reduce((sum, o) => sum + o.affected_count, 0);
                const hasCritical = distOutbreaks.some(o => o.severity === 'CRITICAL');
                const hasUrgent = distOutbreaks.some(o => o.severity === 'URGENT');

                return (
                  <div
                    key={distName}
                    style={{ left: `${coords.x}%`, top: `${coords.y}%` }}
                    onClick={() => {
                      setSelectedDistrict(distName);
                      if (distOutbreaks.length > 0) {
                        setSelectedOutbreak(distOutbreaks[0]);
                      }
                    }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                  >
                    {/* Radar Pulse Ring */}
                    {totalAffected > 0 && (
                      <span className={`absolute -inset-2 rounded-full animate-ping opacity-75 ${
                        hasCritical ? 'bg-red-500' : hasUrgent ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}></span>
                    )}

                    {/* Node Core */}
                    <div className={`relative w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-black border-2 shadow-lg transition-transform group-hover:scale-125 ${
                      totalAffected > 0
                        ? hasCritical ? 'bg-red-600 border-red-300' : 'bg-amber-500 border-amber-200'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}>
                      {totalAffected > 0 ? totalAffected : '•'}
                    </div>

                    {/* Hover Tooltip */}
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 hidden group-hover:block z-20 bg-slate-900 text-white text-[10px] px-2.5 py-1 rounded-lg shadow-xl whitespace-nowrap border border-slate-700">
                      <strong>{distName}</strong>: {totalAffected > 0 ? `${totalAffected} Animals Affected` : 'Zero Outbreaks'}
                    </div>
                  </div>
                );
              })}

              <div className="absolute bottom-3 right-3 text-[9px] text-slate-400 bg-slate-900/90 px-2.5 py-1.5 rounded-lg border border-slate-800 flex items-center gap-3">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Critical Cluster</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Urgent Warning</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-700"></span> Monitored Stable</span>
              </div>
            </div>

            {/* Quick District Cluster Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {outbreaks.slice(0, 4).map(o => (
                <div 
                  key={o.id}
                  onClick={() => setSelectedOutbreak(o)}
                  className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                    selectedOutbreak?.id === o.id
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="text-[10px] text-slate-400">{o.district} ({o.taluka})</div>
                  <div className="font-bold truncate text-[11px] mt-0.5">{o.disease_name}</div>
                  <div className="text-[10px] text-red-600 font-bold mt-1">🔴 {o.affected_count} Affected</div>
                </div>
              ))}
            </div>
          </div>

          {/* Outbreak Details & Actionable Prevention Panel */}
          <div className="lg:col-span-5 space-y-4">
            {selectedOutbreak ? (
              <div className="bg-white p-6 rounded-3xl border-2 border-emerald-200 shadow-sm space-y-4 text-xs">
                <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                  <div>
                    <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                      selectedOutbreak.severity === 'CRITICAL' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'
                    }`}>
                      {selectedOutbreak.severity} OUTBREAK
                    </span>
                    <h3 className="font-black text-slate-900 text-base mt-2">{selectedOutbreak.disease_name}</h3>
                    <p className="text-slate-500 text-[11px]">Species Affected: <strong>{selectedOutbreak.species}</strong></p>
                  </div>
                  <span className="text-lg">🛡️</span>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <div><span className="text-slate-400 block text-[10px]">District & Taluka:</span><strong>{selectedOutbreak.district}, {selectedOutbreak.taluka}</strong></div>
                  <div><span className="text-slate-400 block text-[10px]">Index Locality / Farm:</span><strong className="text-emerald-800">{selectedOutbreak.farm_name || selectedOutbreak.village || 'Local Herd'}</strong></div>
                  <div><span className="text-slate-400 block text-[10px]">Reported Cases:</span><strong className="text-red-600">{selectedOutbreak.affected_count} Animals</strong></div>
                  <div><span className="text-slate-400 block text-[10px]">Status:</span><span className="uppercase font-bold text-emerald-700">{selectedOutbreak.status}</span></div>
                </div>

                {/* Prevention Protocol for Unaffected Herds */}
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl space-y-2 text-emerald-950">
                  <h4 className="font-black uppercase text-[11px] flex items-center gap-1.5">
                    <span>🛡️</span> Prevention Protocols for Unaffected Livestock:
                  </h4>
                  <p className="text-xs leading-relaxed font-medium">
                    {selectedOutbreak.prevention_guide}
                  </p>
                </div>

                <div className="pt-2 space-y-2">
                  <button
                    onClick={() => setActivePage('outbreak-detail', {
                      outbreakId: selectedOutbreak.id,
                      initialOutbreak: selectedOutbreak
                    })}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl transition-colors text-xs flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <span>🛡️ Full Outbreak Map, Directives & Herd Defense Guide →</span>
                  </button>
                  <button
                    onClick={() => setActivePage('home')}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl transition-colors text-xs flex items-center justify-center gap-1.5"
                  >
                    <span>🩺 Check My Animals For {selectedOutbreak.disease_name.split(' ')[0]}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center text-xs text-slate-400">
                Select an outbreak node on the map to inspect locality and biosecurity guidelines.
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 3: GOVERNMENT & NGO OFFICIAL ADVISORIES */}
      {activeTab === 'advisories' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {advisories.map(adv => (
              <div key={adv.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3 text-xs">
                <div className="flex justify-between items-start border-b border-slate-100 pb-2.5">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                      {adv.issuer}
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm mt-2">{adv.title}</h3>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">{adv.date_issued}</span>
                </div>
                <p className="text-slate-600 leading-relaxed font-medium">{adv.content}</p>
                <div className="flex items-center justify-between pt-2 text-[11px] text-slate-400">
                  <span>📍 Target: {adv.district}</span>
                  <span className="text-emerald-700 font-bold uppercase">Official Directive</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: REAL-TIME MEDICATION & TOOL INVENTORY */}
      {activeTab === 'inventory' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Dispensary & NGO Medical Supplies Inventory</h3>
              <p className="text-xs text-slate-500">Live dynamic stock of vaccines, antibiotics, and surgical tools in your district</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-bold">Region:</span>
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-bold focus:outline-none"
              >
                <option value="All">All Maharashtra</option>
                {Object.keys(DISTRICT_COORDINATES).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 font-bold text-[11px]">
                  <th className="py-3 px-4">Supply Item</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Providing Facility / NGO</th>
                  <th className="py-3 px-4">Available Qty</th>
                  <th className="py-3 px-4">Expiry</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inventory.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{item.item_name}</td>
                    <td className="py-3.5 px-4 text-slate-600 uppercase text-[10px] font-bold">{item.category}</td>
                    <td className="py-3.5 px-4 text-slate-700">{item.owner_name} ({item.district})</td>
                    <td className="py-3.5 px-4 font-extrabold text-slate-900">{item.quantity} {item.unit}</td>
                    <td className="py-3.5 px-4 text-slate-500">{item.expiry_date || 'N/A'}</td>
                    <td className="py-3.5 px-4 text-right">
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase ${
                        item.status === 'in_stock'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.status === 'low_stock'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {item.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
