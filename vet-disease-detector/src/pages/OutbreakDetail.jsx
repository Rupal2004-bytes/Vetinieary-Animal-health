import React, { useState, useEffect } from 'react';
import { 
  getOutbreak, 
  getGovAdvisories, 
  getInventory, 
  reportOutbreakRecovery, 
  resolveOutbreak 
} from '../api/client.js';

const DISTRICT_COORDINATES = {
  'Pune': { x: 38, y: 55 },
  'Ahmednagar': { x: 44, y: 44 },
  'Kolhapur': { x: 35, y: 80 },
  'Thane': { x: 26, y: 46 },
  'Mumbai': { x: 22, y: 50 },
  'Nagpur': { x: 80, y: 22 },
  'Nashik': { x: 34, y: 32 },
  'Solapur': { x: 55, y: 68 },
  'Satara': { x: 36, y: 66 },
  'Sangli': { x: 42, y: 76 }
};

export default function OutbreakDetail({ outbreakId, initialOutbreak, setActivePage, user }) {
  const [outbreak, setOutbreak] = useState(initialOutbreak || null);
  const [advisories, setAdvisories] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Recovery Report Modal
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveredCount, setRecoveredCount] = useState(1);
  const [recoveryNotes, setRecoveryNotes] = useState('');
  const [submittingRecovery, setSubmittingRecovery] = useState(false);

  // Official Resolve Modal
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveNotes, setResolveNotes] = useState('');
  const [submittingResolve, setSubmittingResolve] = useState(false);

  const isVetOrStaff = user?.role === 'vet' || user?.role === 'ngo' || user?.role === 'gov';

  useEffect(() => {
    loadDetails();
  }, [outbreakId]);

  const loadDetails = async () => {
    setLoading(true);
    try {
      let ob = initialOutbreak;
      if (outbreakId) {
        ob = await getOutbreak(outbreakId);
      }
      setOutbreak(ob);

      const district = ob?.district || user?.district || 'Pune';
      const [advs, invs] = await Promise.all([
        getGovAdvisories(district),
        getInventory(district)
      ]);
      setAdvisories(advs);
      setInventory(invs);
    } catch (err) {
      console.error('Failed to load outbreak details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReportRecovery = async (e) => {
    e.preventDefault();
    if (!outbreak) return;
    setSubmittingRecovery(true);
    try {
      const updated = await reportOutbreakRecovery({
        outbreak_id: outbreak.id,
        recovered_count: Number(recoveredCount) || 1,
        notes: recoveryNotes || 'Herd recovered and out of contagious period'
      });
      setOutbreak(updated);
      setShowRecoveryModal(false);
      setRecoveryNotes('');
      alert(updated.status === 'resolved' 
        ? '🎉 Excellent news! Outbreak count reached 0 and is now officially RESOLVED across the district.' 
        : `Recovery recorded. Active affected count updated to ${updated.affected_count}.`);
    } catch (err) {
      alert('Could not update recovery: ' + err.message);
    } finally {
      setSubmittingRecovery(false);
    }
  };

  const handleOfficialResolve = async (e) => {
    e.preventDefault();
    if (!outbreak) return;
    setSubmittingResolve(true);
    try {
      const updated = await resolveOutbreak({
        outbreak_id: outbreak.id,
        notes: resolveNotes || 'Quarantine protocols successfully completed and veterinary clearance issued.'
      });
      setOutbreak(updated);
      setShowResolveModal(false);
      setResolveNotes('');
      alert('Outbreak officially marked as contained & resolved.');
    } catch (err) {
      alert('Could not resolve outbreak: ' + err.message);
    } finally {
      setSubmittingResolve(false);
    }
  };

  if (!outbreak && !loading) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm max-w-lg mx-auto my-8 space-y-4">
        <div className="text-4xl">🗺️</div>
        <h3 className="font-black text-slate-900 text-lg">Outbreak Details Not Found</h3>
        <p className="text-xs text-slate-500">The selected outbreak cluster may have been archived or resolved.</p>
        <button
          onClick={() => setActivePage('notifications')}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl"
        >
          ← Back to Outbreak Radar
        </button>
      </div>
    );
  }

  const coords = DISTRICT_COORDINATES[outbreak?.district] || { x: 40, y: 50 };
  const isResolved = outbreak?.status === 'resolved';

  return (
    <div className="space-y-8">
      
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <button
            onClick={() => setActivePage('notifications')}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5 mb-2 transition-colors"
          >
            <span>←</span> Back to Live Outbreak Radar
          </button>
          
          <div className="flex items-center space-x-2">
            <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
              isResolved 
                ? 'bg-emerald-100 text-emerald-800' 
                : outbreak?.severity === 'CRITICAL' 
                ? 'bg-red-600 text-white animate-pulse' 
                : 'bg-amber-500 text-white'
            }`}>
              {isResolved ? '🟢 RESOLVED OUTBREAK' : `🚨 ${outbreak?.severity || 'URGENT'} OUTBREAK CLUSTER`}
            </span>
            <span className="text-xs text-slate-400">Locality: <strong>{outbreak?.district}, {outbreak?.taluka}</strong></span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
            {outbreak?.disease_name}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Target Host: <strong>{outbreak?.species}</strong> • Index Locality: <strong>{outbreak?.farm_name || outbreak?.village || 'District Cluster'}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isResolved && (
            <button
              onClick={() => setShowRecoveryModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-1.5 transition-colors"
            >
              <span>🐄 Report Herd Recovered</span>
            </button>
          )}

          {isVetOrStaff && !isResolved && (
            <button
              onClick={() => setShowResolveModal(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-1.5"
            >
              <span>✓ Official Clearance</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid: Map & Outbreak Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Outbreak Locality Pin Map */}
        <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-black text-slate-900 text-sm">Geospatial Quarantine Zone Map</h3>
              <p className="text-[11px] text-slate-400">Radius of infection in {outbreak?.district} ({outbreak?.taluka})</p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-500">5 KM BIOSECURITY RING</span>
          </div>

          {/* SVG Map Canvas */}
          <div className="relative w-full h-80 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center p-4">
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px]"></div>
            
            {/* Outbreak Focal Center Marker */}
            <div 
              style={{ left: `${coords.x}%`, top: `${coords.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
            >
              {/* Pulsating Biosecurity Ring */}
              {!isResolved && (
                <div className="absolute w-32 h-32 rounded-full border-2 border-red-500/40 bg-red-500/10 animate-ping pointer-events-none"></div>
              )}
              <div className="absolute w-24 h-24 rounded-full border border-dashed border-red-400/60 bg-red-950/30 flex items-center justify-center pointer-events-none">
                <span className="text-[9px] font-mono text-red-300">5km Ring</span>
              </div>

              {/* Center Pin Node */}
              <div className={`relative w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-black shadow-2xl border-2 ${
                isResolved ? 'bg-emerald-600 border-emerald-300' : 'bg-red-600 border-red-200'
              }`}>
                {isResolved ? '✓' : '🚨'}
              </div>

              <div className="absolute top-full mt-2 bg-slate-900 text-white text-[10px] px-3 py-1.5 rounded-xl border border-slate-700 shadow-2xl whitespace-nowrap z-20">
                <strong>{outbreak?.district}</strong>: {outbreak?.farm_name || outbreak?.village}
                <div className="text-[9px] text-red-300">{outbreak?.affected_count} Animals Infected</div>
              </div>
            </div>

            <div className="absolute bottom-3 left-3 text-[10px] text-slate-400 bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-800">
              Statewide Node: <strong>Maharashtra Animal Health Grid</strong>
            </div>
          </div>
        </div>

        {/* Outbreak Metrics & Verification Status */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 text-xs">
            <h3 className="font-black text-slate-900 text-sm border-b border-slate-100 pb-2">
              Cluster Metadata & Consensus
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <span className="text-slate-400 block text-[10px]">Active Affected Count:</span>
                <strong className={`text-base font-black ${isResolved ? 'text-emerald-700' : 'text-red-600'}`}>
                  {outbreak?.affected_count} Animals
                </strong>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <span className="text-slate-400 block text-[10px]">Outbreak Status:</span>
                <strong className="text-base font-black uppercase text-slate-900">
                  {outbreak?.status}
                </strong>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <span className="text-slate-400 block text-[10px]">Vet Confirmations:</span>
                <strong className="text-sm font-bold text-blue-900">
                  🩺 {outbreak?.verified_by_vets || 0} Licensed Vets
                </strong>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <span className="text-slate-400 block text-[10px]">Farmer Reports:</span>
                <strong className="text-sm font-bold text-amber-900">
                  🚜 {outbreak?.reported_by_farmers || 1} Farms Flagged
                </strong>
              </div>
            </div>

            {outbreak?.resolution_notes && (
              <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl text-emerald-950">
                <span className="text-[10px] uppercase font-bold text-emerald-800 block">Resolution & Recovery Log:</span>
                <p className="font-medium mt-1">{outbreak.resolution_notes}</p>
                {outbreak.resolved_at && <span className="text-[10px] text-emerald-700 mt-1 block">Resolved on {new Date(outbreak.resolved_at).toLocaleDateString()}</span>}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* CRITICAL SECTION: PREVENTION & BIOSECURITY METHODS FOR UNAFFECTED LIVESTOCK */}
      <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-emerald-800 space-y-6">
        <div className="border-b border-emerald-800/80 pb-4">
          <span className="bg-emerald-500 text-slate-950 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
            🛡️ Crucial Biosecurity Defense Guide
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white mt-2">
            Actionable Prevention Protocols for Unaffected Livestock & Pets in {outbreak?.district}
          </h2>
          <p className="text-xs text-emerald-200 mt-1 max-w-2xl leading-relaxed">
            If your animals are currently healthy, immediately execute these preventative measures to establish a biological firewall against {outbreak?.disease_name}.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          
          <div className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/10 space-y-2">
            <div className="text-xl">🚫</div>
            <h4 className="font-bold text-white text-sm">1. Strict Perimeter & Herd Quarantine</h4>
            <p className="text-emerald-100 leading-relaxed">
              Stop all livestock movement within 5 km of {outbreak?.village || outbreak?.taluka}. Prohibit visiting neighboring cattle sheds and do not purchase new animals until the quarantine is lifted.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/10 space-y-2">
            <div className="text-xl">🧪</div>
            <h4 className="font-bold text-white text-sm">2. Floor & Shed Disinfection Regimen</h4>
            <p className="text-emerald-100 leading-relaxed">
              Wash all stable floors, gates, and vehicle tires twice daily with <strong>4% Sodium Carbonate (Washing Soda)</strong> or <strong>1% Potassium Permanganate</strong> solution.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/10 space-y-2">
            <div className="text-xl">💧</div>
            <h4 className="font-bold text-white text-sm">3. Dedicated Water & Feeding Troughs</h4>
            <p className="text-emerald-100 leading-relaxed">
              Never share communal ponds, river watering spots, or grazing pasture. Provide clean, chlorinated borehole water and fresh dry fodder in elevated mangers.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/10 space-y-2">
            <div className="text-xl">💉</div>
            <h4 className="font-bold text-white text-sm">4. Immediate Ring Vaccination</h4>
            <p className="text-emerald-100 leading-relaxed">
              Vaccinate all healthy, uninfected livestock with the official preventive vaccine ({outbreak?.disease_name.includes('FMD') ? 'FMD Quadrivalent Vaccine' : 'Species Protective Vaccine'}) via your local taluka dispensary.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/10 space-y-2">
            <div className="text-xl">🪰</div>
            <h4 className="font-bold text-white text-sm">5. Vector & Biting Fly Control</h4>
            <p className="text-emerald-100 leading-relaxed">
              Apply herbal fly repellents (neem oil) or cypermethrin sprays around barns to eliminate mosquitoes, stable flies, and ticks that transmit viral particles mechanically.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/10 space-y-2">
            <div className="text-xl">🩺</div>
            <h4 className="font-bold text-white text-sm">6. Daily Oral & Gait Monitoring</h4>
            <p className="text-emerald-100 leading-relaxed">
              Inspect mouth mucosa for blisters, monitor rectal body temperatures (normal bovine: 101.5°F), and report any sudden drooling, lameness, or lethargy immediately.
            </p>
          </div>

        </div>
      </div>

      {/* GOVERNMENT DIRECTIVES & NGO CIRCULARS */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4 text-xs">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="font-black text-slate-900 text-base">Government of Maharashtra & NGO Directives ({advisories.length})</h3>
          <p className="text-slate-500">Official circulars, ring vaccination camps, and animal husbandry helpline notifications</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {advisories.map(adv => (
            <div key={adv.id} className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">{adv.issuer}</span>
                <span className="text-[10px] text-slate-400 font-bold">{adv.date_issued}</span>
              </div>
              <h4 className="font-bold text-slate-900 text-sm">{adv.title}</h4>
              <p className="text-slate-600 leading-relaxed font-medium">{adv.content}</p>
            </div>
          ))}
        </div>
      </div>

      {/* REAL-TIME PREVENTIVE SUPPLIES INVENTORY */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4 text-xs">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="font-black text-slate-900 text-base">Available Preventative Supplies in {outbreak?.district}</h3>
          <p className="text-slate-500">Real-time stock of vaccines, antiseptic wound sprays, and antibiotics at nearby dispensaries</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold text-[11px]">
                <th className="py-3 px-4">Supply Item</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Providing Facility</th>
                <th className="py-3 px-4">Stock Quantity</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inventory.slice(0, 5).map(item => (
                <tr key={item.id} className="hover:bg-slate-50/60">
                  <td className="py-3 px-4 font-bold text-slate-900">{item.item_name}</td>
                  <td className="py-3 px-4 uppercase text-[10px] text-slate-600 font-bold">{item.category}</td>
                  <td className="py-3 px-4 text-slate-700">{item.owner_name}</td>
                  <td className="py-3 px-4 font-black text-slate-900">{item.quantity} {item.unit}</td>
                  <td className="py-3 px-4 text-right">
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase ${
                      item.status === 'in_stock' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
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

      {/* Recovery Report Modal */}
      {showRecoveryModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 text-xs animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-base">Report Livestock Recovery</h3>
              <button onClick={() => setShowRecoveryModal(false)} className="text-slate-400 hover:text-slate-700 text-lg font-bold">✕</button>
            </div>

            <form onSubmit={handleReportRecovery} className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Number of Animals Fully Recovered *</label>
                <input
                  type="number"
                  min="1"
                  max={outbreak?.affected_count || 100}
                  required
                  value={recoveredCount}
                  onChange={(e) => setRecoveredCount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Current active cases in cluster: {outbreak?.affected_count}</span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Recovery & Disinfection Notes</label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Blisters completely healed, feeding resumed normally, shed disinfected with washing soda."
                  value={recoveryNotes}
                  onChange={(e) => setRecoveryNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRecoveryModal(false)}
                  className="w-1/3 bg-slate-100 text-slate-700 font-bold py-2.5 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRecovery}
                  className="w-2/3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl shadow-md transition-colors"
                >
                  {submittingRecovery ? 'Updating Records...' : '✓ Submit Recovery Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Official Resolve Modal */}
      {showResolveModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 text-xs animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-base">Issue Official Outbreak Clearance</h3>
              <button onClick={() => setShowResolveModal(false)} className="text-slate-400 hover:text-slate-700 text-lg font-bold">✕</button>
            </div>

            <form onSubmit={handleOfficialResolve} className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Clearance Certificate / Official Notes *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Ring vaccination completed for all herds in Baramati block. No active cases reported for 14 consecutive days."
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResolveModal(false)}
                  className="w-1/3 bg-slate-100 text-slate-700 font-bold py-2.5 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingResolve}
                  className="w-2/3 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl shadow-md transition-colors"
                >
                  {submittingResolve ? 'Clearing Outbreak...' : '✓ Declare Outbreak Resolved'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
