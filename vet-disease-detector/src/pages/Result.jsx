import React, { useEffect, useState } from 'react';
import PredictionCard from '../components/PredictionCard.jsx';
import { getNearbyClinics, mediaURL, requestVetConsultation } from '../api/client.js';

export default function Result({
  activeResult,
  setActivePage,
  onOpenDiseaseModal
}) {
  const [clinics, setClinics] = useState([]);
  const [clinicError, setClinicError] = useState('');
  const [showVetReviewModal, setShowVetReviewModal] = useState(false);
  const [vetDoubtReason, setVetDoubtReason] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    if (!activeResult) return;
    getNearbyClinics(activeResult.assessment?.urgency || activeResult.urgency || 'moderate')
      .then(setClinics)
      .catch((error) => setClinicError(error.message || 'Could not load veterinary services.'));
  }, [activeResult]);

  const handleRequestVetReview = async (e) => {
    e.preventDefault();
    setSubmittingReview(true);
    try {
      await requestVetConsultation({
        screening_id: activeResult.id || 0,
        species: activeResult.visualAnalysis?.animal || activeResult.patient?.species || 'Animal Subject',
        media_url: activeResult.mediaUrl || '',
        symptoms: typeof activeResult.symptoms === 'string' ? activeResult.symptoms : (activeResult.symptoms?.symptoms || []).join(', ') || 'AI scan requiring second opinion',
        doubt_reason: vetDoubtReason
      });
      setShowVetReviewModal(false);
      setVetDoubtReason('');
      alert('Diagnostic case successfully sent to veterinary queue. Redirecting to your consultations portal.');
      setActivePage('consultations');
    } catch (err) {
      alert('Could not submit case: ' + err.message);
    } finally {
      setSubmittingReview(false);
    }
  };

  if (!activeResult) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-lg mx-auto my-12 space-y-4">
        <div className="text-5xl">🩺</div>
        <h2 className="text-xl font-bold text-slate-900">No Active Diagnosis Results</h2>
        <p className="text-xs text-slate-500">Run a new prediction check from the AI Scanner to see differential matches.</p>
        <button
          onClick={() => setActivePage('home')}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md"
        >
          Go to AI Scanner →
        </button>
      </div>
    );
  }

  const patient = activeResult.patient || {};
  const topMatches = Array.isArray(activeResult.topMatches) ? activeResult.topMatches : [];
  const triageStatus = activeResult.triageStatus || { level: 'GREEN', title: 'Routine Triage', message: 'No critical acute conditions flagged.' };
  const evaluatedAt = activeResult.evaluatedAt || new Date().toLocaleString();
  const assessment = activeResult.assessment || {};
  const visual = activeResult.visualAnalysis || {};

  const handlePrint = () => {
    const triageColor = triageStatus.level === 'RED' ? '#dc2626' : triageStatus.level === 'AMBER' ? '#d97706' : '#16a34a';
    const triageBg = triageStatus.level === 'RED' ? '#fef2f2' : triageStatus.level === 'AMBER' ? '#fffbeb' : '#f0fdf4';

    const differentialsHTML = topMatches.map((d, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding: 10px; font-weight: bold; color: #0f172a; font-size: 11pt;">#${idx + 1}</td>
        <td style="padding: 10px;">
          <strong style="color: #0f172a; font-size: 11.5pt;">${d.name || 'Condition'}</strong>
          <div style="font-size: 9.5pt; color: #475569; margin-top: 3px;">${d.description || ''}</div>
        </td>
        <td style="padding: 10px; text-align: center;">
          <span style="display: inline-block; background: #e0e7ff; color: #3730a3; font-weight: 800; font-size: 10pt; padding: 3px 8px; border-radius: 6px;">
            ${d.confidence || 0}%
          </span>
        </td>
        <td style="padding: 10px;">
          <span style="font-weight: 800; font-size: 9.5pt; text-transform: uppercase; color: ${d.urgencyLevel === 'CRITICAL' || d.urgencyLevel === 'EMERGENCY' || d.urgencyLevel === 'RED' ? '#dc2626' : d.urgencyLevel === 'URGENT' || d.urgencyLevel === 'AMBER' || d.urgencyLevel === 'HIGH' ? '#d97706' : '#16a34a'};">
            ${d.urgencyLevel || 'MODERATE'}
          </span>
        </td>
        <td style="padding: 10px; font-size: 9.5pt; color: #334155;">
          ${Array.isArray(d.clinicalDiagnostics) ? d.clinicalDiagnostics.join(', ') : (d.clinicalDiagnostics || 'CBC, Biochemistry, Cytology')}
        </td>
      </tr>
    `).join('');

    const nextStepsHTML = (assessment.recommended_next_steps || []).map((step, i) => `
      <li style="margin-bottom: 6px; font-size: 9.5pt;"><strong>${i + 1}.</strong> ${step}</li>
    `).join('');

    const supportiveHTML = (assessment.supportive_care || []).map(item => `<li style="font-size: 9pt;">${item}</li>`).join('');
    const avoidHTML = (assessment.avoid || []).map(item => `<li style="font-size: 9pt;">${item}</li>`).join('');
    const redFlagsHTML = (triageStatus.redFlagList || []).map(rf => `<span style="display: inline-block; background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-size: 9pt; font-weight: bold; margin: 2px;">⚠️ ${rf}</span>`).join('');
    const symptomsList = activeResult.symptoms || [];

    const printContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>PashuRakshak (पशुरक्षक) - Clinical Triage & Diagnostic Report</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 15mm 12mm 15mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 0; font-size: 10pt; line-height: 1.45; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid #059669; padding-bottom: 12px; margin-bottom: 14px; }
    .logo-title { font-size: 20pt; font-weight: 900; color: #064e3b; margin: 0; letter-spacing: -0.5px; }
    .badge { display: inline-block; font-size: 8pt; font-weight: 800; text-transform: uppercase; background: #d1fae5; color: #065f46; padding: 3px 8px; border-radius: 4px; margin-bottom: 4px; }
    .patient-grid { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; font-size: 9pt; }
    .triage-banner { background: ${triageBg}; border-left: 6px solid ${triageColor}; padding: 12px 14px; border-radius: 0 8px 8px 0; margin-bottom: 14px; }
    h3 { font-size: 11pt; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 4px; margin: 14px 0 8px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 9.5pt; }
    th { background: #f1f5f9; text-align: left; padding: 8px 10px; font-weight: 700; border-bottom: 2px solid #cbd5e1; color: #334155; font-size: 8.5pt; text-transform: uppercase; }
    ul, ol { margin: 4px 0; padding-left: 18px; }
    .disclaimer { font-size: 8pt; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 18px; line-height: 1.35; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="badge">🐾 PashuRakshak (पशुरक्षक) • Clinical Triage</div>
      <h1 class="logo-title">Diagnostic & Assessment Report</h1>
    </div>
    <div style="text-align: right; font-size: 8.5pt; color: #64748b;">
      <strong>Date Generated:</strong> ${evaluatedAt}<br>
      <strong>Report Ref:</strong> PRK-${Date.now().toString().slice(-8)}
    </div>
  </div>

  <div class="patient-grid">
    <div><strong style="color:#64748b; display:block; font-size:7.5pt; text-transform:uppercase;">Identified Species</strong><strong style="color:#0f172a; font-size:9.5pt;">${visual?.animal || patient?.species || 'Animal Subject'}</strong></div>
    <div><strong style="color:#64748b; display:block; font-size:7.5pt; text-transform:uppercase;">Patient Name</strong><strong style="color:#0f172a; font-size:9.5pt;">${patient?.name || 'Patient'}</strong></div>
    <div><strong style="color:#64748b; display:block; font-size:7.5pt; text-transform:uppercase;">Breed / Traits</strong><strong style="color:#0f172a; font-size:9.5pt;">${patient?.breed || 'Not Specified'}</strong></div>
    <div><strong style="color:#64748b; display:block; font-size:7.5pt; text-transform:uppercase;">Reported Clinical Signs</strong><strong style="color:#0f172a; font-size:9.5pt;">${symptomsList.length > 0 ? symptomsList.join(', ') : 'Visual Inspection'}</strong></div>
  </div>

  <div class="triage-banner">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <strong style="font-size: 12pt; color: ${triageColor}; font-weight: 900;">● ${triageStatus.level} TRIAGE — ${triageStatus.title}</strong>
      <span style="font-weight: 800; font-size: 9pt; color: #334155; text-transform: uppercase;">${assessment.urgency ? 'Urgency: ' + assessment.urgency : ''}</span>
    </div>
    <p style="margin: 4px 0 0 0; font-size: 9.5pt; color: #334155;">${triageStatus.message}</p>
    ${redFlagsHTML ? `<div style="margin-top: 6px;">${redFlagsHTML}</div>` : ''}
  </div>

  <h3>👁️ Computer Vision & Physical Observations</h3>
  <div style="font-size: 9pt; margin-bottom: 8px;">
    <p style="margin: 2px 0;"><strong>Observations:</strong> ${(visual?.visible_abnormalities || []).join(' • ') || 'No gross visible abnormalities flagged.'}</p>
    ${visual?.lesion_description ? `<p style="margin: 2px 0; color: #475569;"><strong>Morphology & Lesions:</strong> ${visual.lesion_description}</p>` : ''}
    ${assessment.summary ? `<p style="margin: 6px 0 0 0; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 8px 12px; border-radius: 6px; color: #064e3b;"><strong>AI Clinical Summary:</strong> ${assessment.summary}</p>` : ''}
  </div>

  <h3>🩺 Differential Diagnoses & Clinical Workup</h3>
  <table>
    <thead>
      <tr>
        <th style="width: 5%;">#</th>
        <th style="width: 35%;">Condition / Etiology</th>
        <th style="width: 15%; text-align: center;">Confidence</th>
        <th style="width: 15%;">Urgency</th>
        <th style="width: 30%;">Prescribed Confirmatory Diagnostics</th>
      </tr>
    </thead>
    <tbody>
      ${differentialsHTML || '<tr><td colspan="5" style="padding: 10px; text-align: center;">No differential matches calculated.</td></tr>'}
    </tbody>
  </table>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; font-size: 9pt;">
    ${nextStepsHTML ? `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px;">
        <strong style="color: #0f172a; display: block; margin-bottom: 4px; text-transform: uppercase; font-size: 8pt;">Recommended Action Plan</strong>
        <ol style="margin: 0; padding-left: 16px;">${nextStepsHTML}</ol>
      </div>
    ` : ''}
    <div>
      ${supportiveHTML ? `
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 6px 10px; margin-bottom: 6px;">
          <strong style="color: #1e40af; font-size: 8pt; text-transform: uppercase;">Supportive Care Protocol</strong>
          <ul style="margin: 2px 0; padding-left: 16px; color: #1e3a8a;">${supportiveHTML}</ul>
        </div>
      ` : ''}
      ${avoidHTML ? `
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 6px 10px;">
          <strong style="color: #991b1b; font-size: 8pt; text-transform: uppercase;">Contraindications / Avoid</strong>
          <ul style="margin: 2px 0; padding-left: 16px; color: #7f1d1d;">${avoidHTML}</ul>
        </div>
      ` : ''}
    </div>
  </div>

  ${assessment.veterinary_attention ? `
    <div style="margin-top: 10px; font-size: 8.5pt; background: #fffbeb; border: 1px solid #fde68a; padding: 6px 10px; border-radius: 6px; color: #92400e;">
      <strong>Clinical Attention Notice:</strong> ${assessment.veterinary_attention}
    </div>
  ` : ''}

  <div class="disclaimer">
    <strong>VETERINARY MEDICAL DISCLAIMER:</strong> This report is generated by the PashuRakshak clinical screening engine for educational, triage, and decision-support purposes in alignment with Maharashtra PS ID 26128. It does not replace formal in-person physical clinical examination, cytology, histology, or direct prescription by a licensed veterinarian.
  </div>
</body>
</html>`;

    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    try {
      const frameDoc = printFrame.contentWindow.document;
      frameDoc.open();
      frameDoc.write(printContent);
      frameDoc.close();

      printFrame.contentWindow.focus();
      setTimeout(() => {
        printFrame.contentWindow.print();
        setTimeout(() => {
          if (document.body.contains(printFrame)) {
            document.body.removeChild(printFrame);
          }
        }, 1500);
      }, 350);
    } catch (e) {
      console.error('Print Frame error, falling back to window.print():', e);
      window.print();
      if (document.body.contains(printFrame)) {
        document.body.removeChild(printFrame);
      }
    }
  };

  return (
    <div className="space-y-8">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full uppercase">
              AI Veterinary Diagnostic Assessment
            </span>
            <span className="text-xs text-slate-400">Generated {evaluatedAt}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
            Diagnostic & Triage Assessment Report
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-slate-500 font-semibold">Identified Species:</span>
            <span className="text-xs font-black uppercase text-emerald-950 bg-emerald-100/90 border border-emerald-300 px-3 py-1 rounded-xl shadow-sm">
              🐾 {visual?.animal || patient?.species || 'Animal Subject'}
            </span>
            {visual?.image_quality && <span className="text-xs text-slate-400">({visual.image_quality})</span>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowVetReviewModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-1.5 transition-colors"
          >
            <span>🩺 Request Vet Review</span>
          </button>
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

      {/* Vet Review Request Modal */}
      {showVetReviewModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 text-xs animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-slate-900 text-base">Request Vet Second Opinion</h3>
                <p className="text-[11px] text-slate-500">Send this diagnostic scan to licensed veterinary doctors</p>
              </div>
              <button onClick={() => setShowVetReviewModal(false)} className="text-slate-400 hover:text-slate-700 text-lg font-bold">✕</button>
            </div>

            <form onSubmit={handleRequestVetReview} className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Specific Doubt or Clinical Concern</label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. The animal isn't responding to saline wash, or I suspect a secondary foot infection. Please advise on proper dosage."
                  value={vetDoubtReason}
                  onChange={(e) => setVetDoubtReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowVetReviewModal(false)}
                  className="w-1/3 bg-slate-100 text-slate-700 font-bold py-2.5 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="w-2/3 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl shadow-md transition-colors"
                >
                  {submittingReview ? 'Sending to Queue...' : '✓ Submit To Vet Queue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Triage Urgency Level Card */}
      <div className={`p-6 sm:p-8 rounded-3xl border-2 shadow-sm ${
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

      {/* Visual Observation & Clinical Signs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3 text-xs">
          <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] pb-2 border-b border-slate-100">
            Detected Anatomical Profile
          </h3>
          <div className="space-y-2 text-slate-700">
            <div><span className="text-slate-400">Identified Species:</span> <strong className="text-slate-900">{visual?.animal || patient?.species || 'Animal Subject'}</strong></div>
            {visual?.affected_body_parts && visual.affected_body_parts.length > 0 && (
              <div><span className="text-slate-400">Affected Regions:</span> <strong className="text-slate-900">{visual.affected_body_parts.join(', ')}</strong></div>
            )}
            {visual?.severity_of_visible_symptoms && (
              <div><span className="text-slate-400">Visual Severity:</span> <span className="uppercase font-bold text-emerald-800">{visual.severity_of_visible_symptoms}</span></div>
            )}
            {visual?.image_quality && (
              <div><span className="text-slate-400">Image Quality:</span> <span>{visual.image_quality}</span></div>
            )}
          </div>
        </div>

        <div className="md:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3 text-xs">
          <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] pb-2 border-b border-slate-100">
            Computer Vision Clinical Observations
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {(visual?.visible_abnormalities || []).map((item, idx) => (
              <div key={idx} className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 font-semibold text-slate-700">
                • {item}
              </div>
            ))}
          </div>
          {visual?.lesion_description && (
            <p className="bg-emerald-50/50 border border-emerald-100/60 rounded-xl p-3 text-slate-700 leading-relaxed mt-2">
              {visual.lesion_description}
            </p>
          )}
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
            {(Array.isArray(clinics) ? clinics : []).map(clinic => (
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

    </div>
  );
}
