import React, { useEffect, useRef, useState } from 'react';
import { uploadHealthMedia } from '../api/client.js';

export default function Prediction({
  speciesList,
  symptomCategories,
  diseasesDatabase,
  scannerPresets,
  selectedSpecies,
  setSelectedSpecies,
  onRunPrediction,
  setActivePage,
  animals = [],
  apiError = '',
  isAnalyzing = false
}) {
  const [activeMode, setActiveMode] = useState('symptoms'); // 'symptoms' or 'scanner'
  const [patient, setPatient] = useState({
    name: 'Buddy',
    species: selectedSpecies || 'dog',
    breed: 'Golden Retriever',
    age: '2 years',
    weight: '28 kg',
    vaccineStatus: 'up_to_date',
    duration: '1-3 Days'
  });
  const [selectedSymptoms, setSelectedSymptoms] = useState(new Set(['fever', 'lethargy', 'vomiting']));
  const [symptomDetails, setSymptomDetails] = useState({
    duration: '1-3 Days',
    getting_worse: false,
    recent_injury: false,
    recent_vaccination: true,
    contact_sick_animals: false,
    other: ''
  });

  // Scanner state
  const [scanImage, setScanImage] = useState(null);
  const [mediaId, setMediaId] = useState(0);
  const [mediaFileName, setMediaFileName] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scannerResult, setScannerResult] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => () => stopCamera(), []);

  const toggleSymptom = (symId) => {
    const next = new Set(selectedSymptoms);
    if (next.has(symId)) next.delete(symId);
    else next.add(symId);
    setSelectedSymptoms(next);
  };

  const handlePredictSubmit = async (e) => {
    e.preventDefault();
    if (selectedSymptoms.size === 0) {
      alert('Please select at least 1 observed symptom to run the differential AI diagnostic algorithm.');
      return;
    }
    await onRunPrediction({
      patient: { ...patient, species: selectedSpecies },
      symptoms: Array.from(selectedSymptoms),
      symptomDetails: { ...symptomDetails, duration: patient.duration, symptoms: Array.from(selectedSymptoms) },
      mediaId
    });
  };

  const handlePresetScan = (preset) => {
    setScanImage(preset.thumbnail);
    setIsScanning(true);
    setScannerResult(null);

    setTimeout(() => {
      setIsScanning(false);
      setScannerResult(preset);
    }, 1600);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await uploadAndPreview(file);
  };

  const uploadAndPreview = async (file) => {
    setUploadError('');
    const reader = new FileReader();
    reader.onload = (event) => {
      setScanImage(event.target.result);
      setIsScanning(true);
    };
    reader.readAsDataURL(file);
    try {
      const media = await uploadHealthMedia(file);
      setMediaId(media.id);
      setMediaFileName(file.name);
      setScannerResult({
        id: `media_${media.id}`,
        detectedDisease: 'Ready for AI health screening',
        confidence: 0,
        lesionType: 'Media uploaded to backend. Run full assessment to combine visual analysis, symptoms, and animal history.',
        severity: 'PENDING FULL ASSESSMENT',
        recommendedTest: 'Veterinary exam if symptoms persist or worsen.',
        actionPlan: 'Continue to the full AI health assessment.',
        species: patient.species
      });
    } catch (error) {
      setUploadError(error.message || 'Upload failed.');
      setScanImage(null);
    } finally {
      setIsScanning(false);
    }
  };

  const startCamera = async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current = stream;
      setCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 0);
    } catch (error) {
      setCameraError('Camera permission denied. You can upload an existing image instead.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  };

  const captureImage = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `camera-capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
      stopCamera();
      await uploadAndPreview(file);
    }, 'image/jpeg', 0.9);
  };

  const runVisualAssessment = async () => {
    if (!mediaId && !scanImage) {
      setUploadError('Upload or capture an image/video before running visual analysis.');
      return;
    }
    await onRunPrediction({
      patient: { ...patient, species: selectedSpecies },
      symptoms: Array.from(selectedSymptoms),
      symptomDetails: { ...symptomDetails, duration: patient.duration, symptoms: Array.from(selectedSymptoms) },
      mediaId
    });
  };

  return (
    <div className="space-y-8">
      
      {/* Header Mode Toggle */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full uppercase">
            AI Clinical Prediction Engine
          </span>
          <h1 className="text-2xl font-black text-slate-900 mt-1.5">Disease Detection Suite</h1>
          <p className="text-xs text-slate-500">Choose between multi-symptom differential analysis or visual lesion photo scanning</p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveMode('symptoms')}
            className={`px-4 py-2 rounded-lg transition-all ${activeMode === 'symptoms' ? 'bg-white text-emerald-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            🩺 Symptom Checker
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('scanner')}
            className={`px-4 py-2 rounded-lg transition-all ${activeMode === 'scanner' ? 'bg-white text-emerald-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            📷 Visual AI Scanner
          </button>
        </div>
      </div>

      {/* MODE 1: SYMPTOM CHECKER */}
      {activeMode === 'symptoms' && (
        <form onSubmit={handlePredictSubmit} className="space-y-8">
          
          {/* Step 1: Species Selection */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">Step 1: Choose Animal Species</h2>
                <p className="text-xs text-slate-500">Pathology rules and diagnostic scores adapt to species physiology</p>
              </div>
              <span className="text-xs font-semibold text-emerald-600">Active: {selectedSpecies.toUpperCase()}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
              {speciesList.map(sp => (
                <button
                  type="button"
                  key={sp.id}
                  onClick={() => {
                    setSelectedSpecies(sp.id);
                    setPatient({ ...patient, species: sp.id });
                  }}
                  className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center justify-center text-center ${
                    selectedSpecies === sp.id
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold shadow-sm'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="text-2xl mb-1">{sp.icon}</span>
                  <span className="text-xs truncate w-full">{sp.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Patient Profile Inputs */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
              Step 2: Patient Information
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              {animals.length > 0 && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Saved Animal</label>
                  <select
                    value={patient.id || ''}
                    onChange={(e) => {
                      const animal = animals.find(a => String(a.id) === e.target.value);
                      if (animal) {
                        setPatient({ ...patient, ...animal, duration: patient.duration, vaccineStatus: patient.vaccineStatus });
                        setSelectedSpecies(animal.species);
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">New animal</option>
                    {animals.map(animal => <option key={animal.id} value={animal.id}>{animal.name} ({animal.species})</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Name / Tag</label>
                <input
                  type="text"
                  value={patient.name}
                  onChange={(e) => setPatient({ ...patient, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Breed</label>
                <input
                  type="text"
                  value={patient.breed}
                  onChange={(e) => setPatient({ ...patient, breed: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Age</label>
                <select
                  value={patient.age}
                  onChange={(e) => setPatient({ ...patient, age: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option>Young / Puppy / Calf (&lt; 1 yr)</option>
                  <option>Adult (1 - 7 yrs)</option>
                  <option>Senior (&gt; 7 yrs)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Weight</label>
                <input
                  type="text"
                  value={patient.weight}
                  onChange={(e) => setPatient({ ...patient, weight: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Vaccination</label>
                <select
                  value={patient.vaccineStatus}
                  onChange={(e) => setPatient({ ...patient, vaccineStatus: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="up_to_date">Fully Vaccinated</option>
                  <option value="partially">Partially Vaccinated</option>
                  <option value="unvaccinated">Unvaccinated</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Duration</label>
                <select
                  value={patient.duration}
                  onChange={(e) => setPatient({ ...patient, duration: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option>Sudden / Acute (&lt; 24h)</option>
                  <option>1-3 Days</option>
                  <option>4-7 Days</option>
                  <option>Chronic (&gt; 1 Week)</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs pt-3 border-t border-slate-100">
              <label className="flex items-center gap-2 font-semibold text-slate-700"><input type="checkbox" checked={symptomDetails.getting_worse} onChange={(e) => setSymptomDetails({ ...symptomDetails, getting_worse: e.target.checked })} /> Getting worse</label>
              <label className="flex items-center gap-2 font-semibold text-slate-700"><input type="checkbox" checked={symptomDetails.recent_injury} onChange={(e) => setSymptomDetails({ ...symptomDetails, recent_injury: e.target.checked })} /> Recent injury</label>
              <label className="flex items-center gap-2 font-semibold text-slate-700"><input type="checkbox" checked={symptomDetails.recent_vaccination} onChange={(e) => setSymptomDetails({ ...symptomDetails, recent_vaccination: e.target.checked })} /> Recent vaccination</label>
              <label className="flex items-center gap-2 font-semibold text-slate-700"><input type="checkbox" checked={symptomDetails.contact_sick_animals} onChange={(e) => setSymptomDetails({ ...symptomDetails, contact_sick_animals: e.target.checked })} /> Contact with sick animals</label>
              <input
                type="text"
                placeholder="Other symptoms or notes"
                value={symptomDetails.other}
                onChange={(e) => setSymptomDetails({ ...symptomDetails, other: e.target.value })}
                className="sm:col-span-2 lg:col-span-4 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Step 3: Check Symptoms */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-slate-900">Step 3: Check Observed Clinical Signs</h2>
                <p className="text-xs text-slate-500">Selected: {selectedSymptoms.size} symptoms</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSymptoms(new Set())}
                className="text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg"
              >
                Clear All ✕
              </button>
            </div>

            <div className="space-y-4">
              {symptomCategories.map(cat => (
                <div key={cat.id} className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 pb-2 mb-3 border-b border-slate-100">
                    {cat.name}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {cat.symptoms.map(sym => {
                      const isChecked = selectedSymptoms.has(sym.id);
                      return (
                        <label
                          key={sym.id}
                          className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                            isChecked
                              ? 'border-emerald-500 bg-emerald-50/80 font-semibold text-emerald-950'
                              : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center space-x-3 pr-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleSymptom(sym.id)}
                              className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                            />
                            <span className="text-xs select-none">{sym.name}</span>
                          </div>
                          {sym.severity === 'critical' ? (
                            <span className="text-[10px] uppercase font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                              Emergency
                            </span>
                          ) : sym.severity === 'high' ? (
                            <span className="text-[10px] uppercase font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                              Urgent
                            </span>
                          ) : null}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Submit Prediction Button */}
          <div className="pt-4 flex justify-end">
            {(apiError || uploadError) && <p className="mr-auto text-xs font-semibold text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{apiError || uploadError}</p>}
            <button
              type="submit"
              disabled={isAnalyzing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm px-8 py-4 rounded-2xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 disabled:opacity-60"
            >
              <span>{isAnalyzing ? 'Analyzing...' : '🔬 Analyze Symptoms & Calculate Differentials'}</span>
              <span>→</span>
            </button>
          </div>

        </form>
      )}

      {/* MODE 2: VISUAL AI SCANNER */}
      {activeMode === 'scanner' && (
        <div className="space-y-6">
          
          {/* Preset Sample Selector */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Click a Clinical Preset to Test:</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {scannerPresets.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetScan(preset)}
                  className="p-3 rounded-2xl border border-slate-200 bg-white hover:border-emerald-500 hover:shadow-md transition-all text-left group flex flex-col justify-between"
                >
                  <div className="w-full h-24 rounded-xl overflow-hidden mb-2 bg-slate-100 flex items-center justify-center">
                    <img src={preset.thumbnail} alt={preset.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block group-hover:text-emerald-700">{preset.title}</span>
                    <span className="text-[11px] text-slate-400">{preset.species} • {preset.area}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Scanner Viewport & Results Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Viewport */}
            <div className="lg:col-span-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Image Analysis Viewport</h3>
                <div className="flex flex-wrap gap-2 justify-end">
                  <label className="cursor-pointer text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl transition-colors">
                    <span>📤 Upload Image/Video</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4" onChange={handleFileUpload} className="hidden" />
                  </label>
                  <button type="button" onClick={startCamera} className="text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-xl transition-colors">
                    📷 Capture Image
                  </button>
                </div>
              </div>

              {(uploadError || cameraError || apiError) && (
                <div className="text-xs font-semibold text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">
                  {uploadError || cameraError || apiError}
                </div>
              )}

              <div className="scan-container relative w-full h-80 bg-slate-900 rounded-2xl flex items-center justify-center overflow-hidden border border-slate-800">
                {cameraOpen ? (
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain bg-black" />
                ) : !scanImage ? (
                  <div className="text-center p-6">
                    <div className="text-5xl mb-2 opacity-50">📷</div>
                    <p className="text-sm font-bold text-slate-300">No Image Loaded</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs">Select a preset, upload media, or capture a camera image to scan.</p>
                  </div>
                ) : (
                  <>
                    <img src={scanImage} alt="Scan preview" className="w-full h-full object-contain" />
                    {isScanning && <div className="scan-laser-line"></div>}
                    {!isScanning && <div className="detection-box w-36 h-36 top-1/4 left-1/3"></div>}
                  </>
                )}
              </div>

              {cameraOpen && (
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={stopCamera} className="text-xs font-bold bg-slate-100 text-slate-700 px-4 py-2 rounded-xl">Cancel</button>
                  <button type="button" onClick={captureImage} className="text-xs font-bold bg-emerald-600 text-white px-4 py-2 rounded-xl">Capture & Use</button>
                </div>
              )}

              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Model: Qwen/Qwen2.5-VL-7B-Instruct via Go backend</span>
                <span>{mediaFileName || 'Ready for inference'}</span>
              </div>
            </div>

            {/* AI Findings Output */}
            <div className="lg:col-span-6 space-y-4">
              {isScanning ? (
                <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
                  <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mb-3"></div>
                  <h4 className="text-sm font-bold text-slate-900">Neural Visual Analysis in Progress...</h4>
                  <p className="text-xs text-slate-500 mt-1">Extracting morphological features, color histology & edge margins</p>
                </div>
              ) : scannerResult ? (
                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                    <div>
                      <span className="text-xs font-bold text-emerald-600 uppercase">Visual Classification Result</span>
                      <h3 className="text-lg font-black text-slate-900">{scannerResult.detectedDisease}</h3>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-black text-emerald-600">{scannerResult.confidence}%</span>
                      <span className="block text-[10px] text-slate-400 font-bold">Confidence</span>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-slate-400 block font-semibold">Lesion Characteristics:</span>
                      <span className="font-semibold text-slate-800">{scannerResult.lesionType}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-semibold">Severity Rating:</span>
                      <span className="font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block">
                        {scannerResult.severity}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-semibold">Confirmatory Lab Diagnostic:</span>
                      <span className="font-semibold text-slate-800">{scannerResult.recommendedTest}</span>
                    </div>
                  </div>

                  <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 text-xs text-emerald-950">
                    <strong className="block mb-1">Recommended Action Protocol:</strong>
                    <p className="leading-relaxed">{scannerResult.actionPlan}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                    <button
                      type="button"
                      onClick={() => setActivePage('emergency')}
                      className="text-xs font-bold bg-slate-900 text-white px-4 py-2 rounded-xl"
                    >
                      Find Emergency Vet →
                    </button>
                    <button
                      type="button"
                      onClick={runVisualAssessment}
                      disabled={isAnalyzing}
                      className="text-xs font-bold text-emerald-600 hover:underline disabled:opacity-60"
                    >
                      {isAnalyzing ? 'Running assessment...' : 'Run Full AI Health Assessment →'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center text-slate-400 text-xs">
                  <div className="text-4xl mb-2">🔬</div>
                  Select a clinical preset above or upload a photo to view AI classification.
                </div>
              )}
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
