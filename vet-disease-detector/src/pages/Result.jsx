import React, { useEffect, useState } from 'react';
import PredictionCard from '../components/PredictionCard.jsx';
import { getNearbyClinics, mediaURL } from '../api/client.js';

export default function Result({
  activeResult,
  setActivePage,
  onOpenDiseaseModal
}) {
  const [clinics, setClinics] = useState([]);
  const [clinicError, setClinicError] = useState('');

  useEffect(() => {
    if (!activeResult) return;
    getNearbyClinics(activeResult.assessment?.urgency || activeResult.urgency || 'moderate')
      .then(setClinics)
      .catch((error) => setClinicError(error.message || 'Could not load veterinary services.'));
  }, [activeResult]);

  if (!activeResult) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-lg mx-auto my-12 space-y-4">
        <div className="text-5xl">🩺</div>
        <h2 className="text-xl font-bold text-slate-900">No Active Diagnosis Results</h2>
        <p className="text-xs text-slate-500">Run a new prediction check from the AI Prediction portal to see differential matches.</p>
        <button
          onClick={() => setActivePage('prediction')}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md"
        >
          Go to AI Prediction →
        </button>
      </div>
    );
  }

  const { patient, topMatches, triageStatus, evaluatedAt, scannerOverride } = activeResult;
  const assessment = activeResult.assessment || {};
  const visual = activeResult.visualAnalysis || {};

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full uppercase">
              Differential Assessment
            </span>
            <span className="text-xs text-slate-400">Generated {evaluatedAt}</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-1">Diagnostic Prediction Report</h1>
          <p className="text-xs text-slate-500">Patient: <strong className="text-slate-800">{patient?.name || 'Patient'}</strong> ({patient?.species?.toUpperCase()} • {patient?.breed})</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-1.5"
          >
            <span>📄 Print / Export PDF</span>
          </button>
          <button
            onClick={() => setActivePage('emergency')}
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-1.5"
          >
            <span>🚨 Emergency SOS</span>
          </button>
        </div>
      </div>

      {/* Triage Urgency Level Card */}
      <div className={`p-6 rounded-3xl border-2 ${
        triageStatus.level === 'RED'
          ? 'bg-red-50/90 border-red-300 text-red-950 badge-pulse-red'
          : triageStatus.level === 'AMBER'
          ? 'bg-amber-50/90 border-amber-300 text-amber-950'
          : 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-current/10">
          <div className="flex items-center space-x-3">
            <span className="text-xs font-black uppercase px-3 py-1 rounded-full bg-white shadow-sm">
              ● {triageStatus.level} TRIAGE LEVEL
            </span>
            <h2 className="text-lg font-black">{triageStatus.title}</h2>
          </div>
          <span className="text-xs font-semibold">Immediate Assessment</span>
        </div>
        <p className="text-xs sm:text-sm mt-3 leading-relaxed">{triageStatus.message}</p>
        
        {triageStatus.hasRedFlags && triageStatus.redFlagList && triageStatus.redFlagList.length > 0 && (
          <div className="mt-4 pt-3 border-t border-red-200">
            <span className="text-xs font-black uppercase text-red-800 block mb-1.5">Critical Red Flags Detected:</span>
            <div className="flex flex-wrap gap-1.5">
              {triageStatus.redFlagList.map((rf, idx) => (
                <span key={idx} className="bg-red-200 text-red-900 font-bold text-xs px-2.5 py-1 rounded-lg">
                  ⚠️ {rf}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Patient Summary & Symptoms Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-2 text-xs">
          <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] pb-2 border-b border-slate-100">
            Patient Parameters
          </h3>
          <div className="space-y-1.5 text-slate-700">
            <div><span className="text-slate-400">Species:</span> <strong>{patient?.species?.toUpperCase()}</strong></div>
            <div><span className="text-slate-400">Breed:</span> {patient?.breed}</div>
            <div><span className="text-slate-400">Age:</span> {patient?.age}</div>
            <div><span className="text-slate-400">Weight:</span> {patient?.weight}</div>
            <div><span className="text-slate-400">Vaccine:</span> {patient?.vaccineStatus}</div>
            <div><span className="text-slate-400">Onset:</span> {patient?.duration}</div>
          </div>
        </div>

        <div className="md:col-span-2 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-2 text-xs">
          <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] pb-2 border-b border-slate-100">
            Reported Clinical Signs ({activeResult.symptoms?.length || 0})
          </h3>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {activeResult.symptoms && activeResult.symptoms.map((s, idx) => (
              <span key={idx} className="bg-slate-100 text-slate-800 px-3 py-1 rounded-xl font-semibold">
                ● {s.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      </div>

      {(visual.visible_abnormalities || assessment.summary) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {activeResult.mediaUrl && (
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] pb-2 border-b border-slate-100">
                Submitted Media
              </h3>
              {activeResult.backendScreening?.media_type === 'video' ? (
                <video src={mediaURL(activeResult.mediaUrl)} controls className="mt-3 w-full rounded-2xl bg-slate-900 max-h-72" />
              ) : (
                <img src={mediaURL(activeResult.mediaUrl)} alt="Submitted animal health media" className="mt-3 w-full rounded-2xl bg-slate-100 max-h-72 object-contain" />
              )}
            </div>
          )}

          <div className="lg:col-span-2 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div>
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] pb-2 border-b border-slate-100">
                What The AI Observed
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 text-xs">
                {(visual.visible_abnormalities || []).map((item, idx) => (
                  <div key={idx} className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 font-semibold text-slate-700">• {item}</div>
                ))}
              </div>
              {visual.lesion_description && <p className="text-xs text-slate-600 leading-relaxed mt-3">{visual.lesion_description}</p>}
            </div>

            {assessment.summary && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-xs text-emerald-950">
                <strong className="block mb-1">Overall Assessment</strong>
                <p className="leading-relaxed">{assessment.summary}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Differential Predictions List */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Calculated Differential Diagnoses</h2>
            <p className="text-xs text-slate-500">Ranked by weighted symptom correlation and clinical danger</p>
          </div>
          <span className="text-xs font-semibold text-emerald-600">{topMatches.length} Differential Matches</span>
        </div>

        <div className="space-y-4">
          {topMatches.map((disease, idx) => (
            <PredictionCard
              key={disease.id || idx}
              prediction={disease}
              rank={idx + 1}
              onOpenDetails={() => onOpenDiseaseModal && onOpenDiseaseModal(disease)}
              onBookVet={() => setActivePage('emergency')}
            />
          ))}
        </div>
      </div>

      {assessment.recommended_next_steps && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Recommended Next Steps</h2>
            <ol className="space-y-2 text-xs text-slate-700">
              {assessment.recommended_next_steps.map((step, idx) => (
                <li key={idx} className="flex gap-3 bg-slate-50 border border-slate-100 rounded-2xl p-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black shrink-0">{idx + 1}</span>
                  <span className="leading-relaxed font-semibold">{step}</span>
                </li>
              ))}
            </ol>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                <strong className="block text-blue-950 mb-1">Supportive Care</strong>
                <ul className="space-y-1 text-blue-900 list-disc list-inside">{(assessment.supportive_care || []).map((item, idx) => <li key={idx}>{item}</li>)}</ul>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
                <strong className="block text-red-950 mb-1">Avoid</strong>
                <ul className="space-y-1 text-red-900 list-disc list-inside">{(assessment.avoid || []).map((item, idx) => <li key={idx}>{item}</li>)}</ul>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3">
            <h2 className="text-lg font-bold text-slate-900">Veterinary Attention</h2>
            <p className="text-xs leading-relaxed text-slate-700">{assessment.veterinary_attention}</p>
            <p className="text-[11px] leading-relaxed text-slate-500 bg-slate-50 border border-slate-100 rounded-2xl p-3">{assessment.disclaimer}</p>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Nearby Veterinary Services</h2>
            <p className="text-xs text-slate-500">Demo clinic provider, ready to swap for Maps or Places APIs.</p>
          </div>
        </div>
        {clinicError ? (
          <p className="text-xs font-semibold text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">{clinicError}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {clinics.map(clinic => (
              <div key={clinic.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs space-y-2">
                <div className="flex justify-between gap-2">
                  <strong className="text-slate-900">{clinic.name}</strong>
                  <span className={clinic.open ? 'text-emerald-700 font-bold' : 'text-slate-400 font-bold'}>{clinic.open ? 'Open' : 'Closed'}</span>
                </div>
                <p className="text-slate-500">{clinic.distance} • {clinic.rating} rating</p>
                <p className="text-slate-600">{clinic.address}</p>
                <div className="flex gap-2 pt-2">
                  <a href={`tel:${clinic.phone}`} className="flex-1 text-center bg-emerald-600 text-white font-bold rounded-xl py-2">Call</a>
                  <a href={clinic.directions} target="_blank" rel="noreferrer" className="flex-1 text-center bg-slate-900 text-white font-bold rounded-xl py-2">Directions</a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Printable Report Hidden Layout */}
      <div id="printableReportArea" className="hidden">
        <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px' }}>
          <h1 style={{ color: '#065f46', fontSize: '24px', margin: 0 }}>VetScan AI - Veterinary Triage Summary</h1>
          <p style={{ color: '#64748b', fontSize: '12px' }}>Generated: {evaluatedAt}</p>
          <hr style={{ margin: '15px 0' }} />
          <h3>Patient: {patient?.name} ({patient?.species?.toUpperCase()} - {patient?.breed})</h3>
          <p><strong>Triage Level:</strong> {triageStatus.level} ({triageStatus.title})</p>
          <p><strong>Reported Symptoms:</strong> {activeResult.symptoms?.join(', ')}</p>
          <hr style={{ margin: '15px 0' }} />
          <h4>Top Differential Diagnoses:</h4>
          {topMatches.slice(0, 3).map((d, i) => (
            <div key={i} style={{ marginBottom: '10px' }}>
              <strong>#{i+1} {d.name} ({d.confidence}%)</strong> - {d.urgencyLevel}
              <p style={{ margin: '2px 0', fontSize: '12px' }}>{d.description}</p>
            </div>
          ))}
          <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '20px' }}>
            Disclaimer: Educational diagnostic decision support only. Consult a licensed veterinarian for confirmed medical testing.
          </p>
        </div>
      </div>

    </div>
  );
}
