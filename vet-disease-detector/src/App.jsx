import React, { useEffect, useState } from 'react';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import {
  analyzeHealth,
  clearStoredAuth,
  connectHuggingFace,
  getAnimals,
  getHealthHistory,
  getStoredHuggingFaceToken,
  getStoredUser
} from './api/client.js';

// Pages
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import Dashboard from './pages/Dashboard.jsx';
import AnimalInfo from './pages/AnimalInfo.jsx';
import Prediction from './pages/Prediction.jsx';
import Result from './pages/Result.jsx';
import DiseaseInfo from './pages/DiseaseInfo.jsx';
import History from './pages/History.jsx';
import Emergency from './pages/Emergency.jsx';
import About from './pages/About.jsx';
import Contact from './pages/Contact.jsx';

export default function App({ initialData }) {
  const {
    speciesList = [],
    symptomCategories = [],
    diseasesDatabase = [],
    scannerPresets = [],
    normalVitals = [],
    toxicityAlerts = []
  } = initialData || {};

  const [activePage, setActivePage] = useState('home');
  const [user, setUser] = useState(() => getStoredUser());
  const [hfToken, setHfToken] = useState(() => getStoredHuggingFaceToken());
  const [showHfConnect, setShowHfConnect] = useState(false);
  const [hfConnectError, setHfConnectError] = useState('');
  const [hfConnecting, setHfConnecting] = useState(false);
  const [selectedSpecies, setSelectedSpecies] = useState('dog');
  const [activeResult, setActiveResult] = useState(null);
  const [selectedDiseaseModal, setSelectedDiseaseModal] = useState(null);
  const [animals, setAnimals] = useState([]);
  const [apiError, setApiError] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Stored prediction history
  const [historyList, setHistoryList] = useState([
    {
      id: 'hist_1',
      date: 'Aug 24, 2026, 04:30 PM',
      patientName: 'Buddy',
      species: 'Canine (Dog)',
      breed: 'Golden Retriever',
      topDisease: 'Canine Parvovirus (CPV-2)',
      confidence: 96,
      urgency: 'CRITICAL',
      triageLevel: 'RED',
      symptoms: ['bloody_diarrhea', 'vomiting', 'fever', 'lethargy']
    },
    {
      id: 'hist_2',
      date: 'Aug 23, 2026, 11:15 AM',
      patientName: 'Misty',
      species: 'Feline (Cat)',
      breed: 'Persian',
      topDisease: 'Dermatophytosis (Ringworm)',
      confidence: 91,
      urgency: 'MODERATE',
      triageLevel: 'AMBER',
      symptoms: ['alopecia', 'crusting_scabs', 'severe_itching']
    }
  ]);

  useEffect(() => {
    refreshBackendState();
  }, []);

  useEffect(() => {
    if (user && !hfToken && !user.hf_connected) {
      setShowHfConnect(true);
    }
  }, [user, hfToken]);

  const refreshBackendState = async () => {
    try {
      const [animalRows, screeningRows] = await Promise.all([
        getAnimals(),
        getHealthHistory()
      ]);
      setAnimals(animalRows);
      if (screeningRows.length > 0) {
        setHistoryList(screeningRows.map(screeningToHistory));
      }
      setApiError('');
    } catch (error) {
      setApiError(error.message || 'Backend unavailable. Start the Go backend for live demo mode.');
    }
  };

  const handleRunPrediction = async ({ patient, symptoms, symptomDetails, mediaId }) => {
    if (!getStoredHuggingFaceToken()) {
      setApiError('Connect your Hugging Face account before running live inference.');
      setShowHfConnect(true);
      return;
    }
    setIsAnalyzing(true);
    setApiError('');
    try {
      const screening = await analyzeHealth({
        animal_id: patient.id || 0,
        animal: {
          name: patient.name,
          species: patient.species || selectedSpecies,
          breed: patient.breed,
          age: patient.age,
          sex: patient.sex,
          weight: patient.weight,
          notes: patient.notes
        },
        media_id: mediaId || 0,
        symptoms: symptomDetails || {
          symptoms,
          duration: patient.duration,
          recent_vaccination: patient.vaccineStatus === 'up_to_date'
        }
      });
      const result = screeningToResult(screening, patient);
      setActiveResult(result);
      setHistoryList([screeningToHistory(screening, patient), ...historyList.filter(h => h.id !== `screening_${screening.id}`)]);
      refreshBackendState();
      setActivePage('result');
    } catch (error) {
      setApiError(error.message || 'Health analysis failed.');
      throw error;
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAuthSuccess = (auth) => {
    setUser(auth.user);
    setHfToken(getStoredHuggingFaceToken());
    if (!getStoredHuggingFaceToken() && !auth.user?.hf_connected) {
      setShowHfConnect(true);
    }
    setActivePage('dashboard');
  };

  const handleLogout = () => {
    clearStoredAuth();
    setUser(null);
    setHfToken('');
    setShowHfConnect(false);
    setActivePage('login');
  };

  const handleConnectHuggingFace = async (e) => {
    e.preventDefault();
    setHfConnecting(true);
    setHfConnectError('');
    try {
      const result = await connectHuggingFace(hfToken);
      if (result.user) setUser(result.user);
      setShowHfConnect(false);
    } catch (error) {
      setHfConnectError(error.message || 'Could not connect Hugging Face.');
    } finally {
      setHfConnecting(false);
    }
  };

  const saveToHistory = (resultObj) => {
    const topD = resultObj.topMatches[0] || { name: 'Undetermined Malaise', confidence: 50, urgencyLevel: 'MODERATE' };
    const historyEntry = {
      id: `hist_${Date.now()}`,
      date: new Date().toLocaleString(),
      patientName: resultObj.patient?.name || 'Patient',
      species: resultObj.patient?.species?.toUpperCase() || 'CANINE',
      breed: resultObj.patient?.breed || 'Mixed',
      topDisease: topD.name,
      confidence: topD.confidence,
      urgency: topD.urgencyLevel,
      triageLevel: resultObj.triageStatus.level,
      symptoms: resultObj.symptoms,
      fullResult: resultObj
    };
    setHistoryList([historyEntry, ...historyList]);
  };

  const handleSelectHistoryItem = (historyItem) => {
    if (historyItem.fullResult) {
      setActiveResult(historyItem.fullResult);
    } else {
      setActiveResult({
        patient: { name: historyItem.patientName, species: historyItem.species.toLowerCase().includes('dog') ? 'dog' : 'cat', breed: historyItem.breed, age: '2 yrs', weight: '20 kg' },
        symptoms: historyItem.symptoms,
        evaluatedAt: historyItem.date,
        triageStatus: {
          level: historyItem.triageLevel,
          title: `${historyItem.triageLevel} Triage`,
          message: 'Historical record triage evaluation.',
          hasRedFlags: historyItem.triageLevel === 'RED',
          redFlagList: []
        },
        topMatches: [
          {
            id: 'h_match',
            name: historyItem.topDisease,
            confidence: historyItem.confidence,
            urgencyLevel: historyItem.urgency,
            pathogenType: 'Clinical Record',
            incubationPeriod: 'Varies',
            description: 'Archived case evaluation.',
            clinicalDiagnostics: ['Standard CBC', 'Cytology'],
            matchedSymptoms: historyItem.symptoms
          }
        ]
      });
    }
    setActivePage('result');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 antialiased selection:bg-emerald-500 selection:text-white">
      
      {/* Navigation */}
      <Navbar
        activePage={activePage}
        setActivePage={setActivePage}
        user={user}
        setUser={setUser}
        onLogout={handleLogout}
      />

      {/* Main Page Routing */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activePage === 'home' && (
          <Home
            setActivePage={setActivePage}
            setSelectedSpecies={setSelectedSpecies}
            speciesList={speciesList}
          />
        )}

        {activePage === 'login' && (
          <Login
            setActivePage={setActivePage}
            onAuthSuccess={handleAuthSuccess}
          />
        )}

        {activePage === 'signup' && (
          <Signup
            setActivePage={setActivePage}
            onAuthSuccess={handleAuthSuccess}
          />
        )}

        {activePage === 'dashboard' && (
          <Dashboard
            setActivePage={setActivePage}
            user={user}
            historyList={historyList}
            onSelectHistoryItem={handleSelectHistoryItem}
            animals={animals}
            onRefresh={refreshBackendState}
          />
        )}

        {activePage === 'animal-info' && (
          <AnimalInfo
            speciesList={speciesList}
            selectedSpecies={selectedSpecies}
            setSelectedSpecies={setSelectedSpecies}
            setActivePage={setActivePage}
          />
        )}

        {activePage === 'prediction' && (
          <Prediction
            speciesList={speciesList}
            symptomCategories={symptomCategories}
            diseasesDatabase={diseasesDatabase}
            scannerPresets={scannerPresets}
            selectedSpecies={selectedSpecies}
            setSelectedSpecies={setSelectedSpecies}
            onRunPrediction={handleRunPrediction}
            setActivePage={setActivePage}
            animals={animals}
            apiError={apiError}
            isAnalyzing={isAnalyzing}
          />
        )}

        {activePage === 'result' && (
          <Result
            activeResult={activeResult}
            setActivePage={setActivePage}
            onOpenDiseaseModal={(d) => setSelectedDiseaseModal(d)}
          />
        )}

        {activePage === 'disease-info' && (
          <DiseaseInfo
            diseasesDatabase={diseasesDatabase}
            speciesList={speciesList}
            onOpenDiseaseModal={(d) => setSelectedDiseaseModal(d)}
          />
        )}

        {activePage === 'history' && (
          <History
            historyList={historyList}
            onSelectHistoryItem={handleSelectHistoryItem}
            setActivePage={setActivePage}
          />
        )}

        {activePage === 'emergency' && (
          <Emergency
            setActivePage={setActivePage}
          />
        )}

        {activePage === 'about' && (
          <About
            setActivePage={setActivePage}
          />
        )}

        {activePage === 'contact' && (
          <Contact />
        )}
      </main>

      {/* Disease Detail Modal */}
      {selectedDiseaseModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex justify-between items-start pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs uppercase font-extrabold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {selectedDiseaseModal.urgencyLevel}
                  </span>
                  {selectedDiseaseModal.zoonotic && (
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800">
                      ☣️ Zoonotic Risk
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-black text-slate-900 mt-1">{selectedDiseaseModal.name}</h2>
                <p className="text-xs text-slate-500">{selectedDiseaseModal.pathogenType} • Incubation: {selectedDiseaseModal.incubationPeriod}</p>
              </div>
              <button onClick={() => setSelectedDiseaseModal(null)} className="text-slate-400 hover:text-slate-600 font-black text-xl">✕</button>
            </div>

            <div className="space-y-4 text-xs sm:text-sm text-slate-700">
              <div>
                <h4 className="font-bold text-slate-900 uppercase text-xs mb-1">Pathophysiology & Presentation:</h4>
                <p className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 leading-relaxed">{selectedDiseaseModal.description}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-red-50/70 p-4 rounded-2xl border border-red-100 space-y-2">
                  <h4 className="font-bold text-red-950 uppercase text-xs">Emergency First-Aid:</h4>
                  <ul className="space-y-1 text-xs text-red-900 list-disc list-inside">
                    {selectedDiseaseModal.firstAidInstructions ? (
                      selectedDiseaseModal.firstAidInstructions.map((s, i) => <li key={i}>{s}</li>)
                    ) : (
                      <li>Seek immediate veterinary consultation.</li>
                    )}
                  </ul>
                </div>

                <div className="bg-blue-50/70 p-4 rounded-2xl border border-blue-100 space-y-2">
                  <h4 className="font-bold text-blue-950 uppercase text-xs">Diagnostic Lab Tests:</h4>
                  <ul className="space-y-1 text-xs text-blue-900 list-disc list-inside">
                    {selectedDiseaseModal.clinicalDiagnostics ? (
                      selectedDiseaseModal.clinicalDiagnostics.map((t, i) => <li key={i}>{t}</li>)
                    ) : (
                      <li>{selectedDiseaseModal.recommendedTest || 'Complete Blood Count & Panel'}</li>
                    )}
                  </ul>
                </div>
              </div>

              {selectedDiseaseModal.treatmentProtocol && (
                <div>
                  <h4 className="font-bold text-slate-900 uppercase text-xs mb-1">Veterinary Treatment Protocol:</h4>
                  <p className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-100 leading-relaxed text-xs text-emerald-950">
                    {selectedDiseaseModal.treatmentProtocol}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedDiseaseModal(null)}
                className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {showHfConnect && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-900">Connect Hugging Face</h3>
              <p className="text-xs text-slate-500">
                Enter a Hugging Face access token with Inference Providers permission. It stays in this browser and is sent with inference requests.
              </p>
            </div>
            <form onSubmit={handleConnectHuggingFace} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Access token</label>
                <input
                  type="password"
                  value={hfToken}
                  onChange={(e) => setHfToken(e.target.value)}
                  placeholder="hf_..."
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              {hfConnectError && <p className="text-red-700 bg-red-50 border border-red-100 rounded-xl p-3 font-semibold">{hfConnectError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowHfConnect(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold">
                  Later
                </button>
                <button type="submit" disabled={hfConnecting} className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold disabled:opacity-60">
                  {hfConnecting ? 'Connecting...' : 'Connect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <Footer setActivePage={setActivePage} />
    </div>
  );
}

function urgencyToTriage(urgency) {
  if (urgency === 'emergency') return { level: 'RED', title: 'Emergency Veterinary Attention' };
  if (urgency === 'high') return { level: 'AMBER', title: 'High Concern - Prompt Vet Care' };
  if (urgency === 'moderate') return { level: 'AMBER', title: 'Moderate Health Concern' };
  return { level: 'GREEN', title: 'Low Concern / Monitor' };
}

function screeningToResult(screening, fallbackPatient = {}) {
  const assessment = screening.assessment || {};
  const triageBase = urgencyToTriage(assessment.urgency || screening.urgency);
  return {
    backendScreening: screening,
    patient: {
      ...fallbackPatient,
      id: screening.animal_id,
      species: fallbackPatient.species || screening.visual_analysis?.animal || 'animal'
    },
    symptoms: screening.symptoms?.symptoms || [],
    symptomDetails: screening.symptoms,
    visualAnalysis: screening.visual_analysis,
    assessment,
    mediaUrl: screening.media_url,
    evaluatedAt: new Date(screening.created_at).toLocaleString(),
    triageStatus: {
      ...triageBase,
      message: assessment.summary,
      hasRedFlags: assessment.urgency === 'emergency',
      redFlagList: assessment.urgency === 'emergency' ? ['Emergency urgency'] : []
    },
    topMatches: (assessment.possible_conditions || []).map((condition, idx) => ({
      id: `${screening.id}_${idx}`,
      name: condition.name,
      confidence: condition.likelihood === 'high' ? 86 : condition.likelihood === 'moderate' ? 68 : 42,
      urgencyLevel: (assessment.urgency || 'moderate').toUpperCase(),
      pathogenType: 'AI-assisted possible condition',
      incubationPeriod: 'Varies',
      description: condition.reason,
      clinicalDiagnostics: assessment.recommended_next_steps || [],
      matchedSymptoms: screening.symptoms?.symptoms || []
    }))
  };
}

function screeningToHistory(screening, patient = {}) {
  const first = screening.assessment?.possible_conditions?.[0];
  const triage = urgencyToTriage(screening.urgency);
  return {
    id: `screening_${screening.id}`,
    date: new Date(screening.created_at).toLocaleString(),
    patientName: patient.name || `Animal #${screening.animal_id}`,
    species: patient.species || screening.visual_analysis?.animal || 'Animal',
    breed: patient.breed || '',
    topDisease: first?.name || 'AI Health Screening',
    confidence: first?.likelihood === 'high' ? 86 : first?.likelihood === 'moderate' ? 68 : 42,
    urgency: (screening.urgency || 'moderate').toUpperCase(),
    triageLevel: triage.level,
    symptoms: screening.symptoms?.symptoms || [],
    fullResult: screeningToResult(screening, patient)
  };
}
