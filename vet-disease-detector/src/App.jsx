import React, { useEffect, useState } from 'react';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import {
  analyzeHealth,
  clearStoredAuth,
  getAnimals,
  getHealthHistory,
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

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('VetScan Render Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-800">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full border border-slate-200 shadow-2xl text-center space-y-4">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto text-3xl">
              ⚠️
            </div>
            <h2 className="text-2xl font-black text-slate-900">Application Recovered</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              An unexpected issue occurred while rendering this page. You can reload or return to the main dashboard.
            </p>
            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md"
              >
                🔄 Reload App
              </button>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.href = '/';
                }}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
              >
                Go to Home
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
  const [user, setUser] = useState(null);
  const [selectedSpecies, setSelectedSpecies] = useState('dog');
  const [activeResult, setActiveResult] = useState(null);
  const [selectedDiseaseModal, setSelectedDiseaseModal] = useState(null);
  const [animals, setAnimals] = useState([]);
  const [apiError, setApiError] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Stored prediction history
  const [historyList, setHistoryList] = useState([]);

  useEffect(() => {
    refreshBackendState();
  }, []);

  const refreshBackendState = async () => {
    try {
      const [animalRows, screeningRows] = await Promise.all([
        getAnimals(),
        getHealthHistory()
      ]);
      setAnimals(Array.isArray(animalRows) ? animalRows : []);
      if (Array.isArray(screeningRows) && screeningRows.length > 0) {
        setHistoryList(screeningRows.map(screeningToHistory));
      }
      setApiError('');
    } catch (error) {
      setAnimals([]);
      setApiError('');
    }
  };

  const handleRunPrediction = async ({ mediaId, mediaUrl, symptoms = [], notes = '', patient = {} }) => {
    setIsAnalyzing(true);
    setApiError('');
    try {
      const screening = await analyzeHealth({
        animal_id: patient?.id || 0,
        animal: {
          name: patient?.name || '',
          species: patient?.species || '',
          breed: patient?.breed || '',
          notes: notes || patient?.notes || ''
        },
        media_id: mediaId || 0,
        media_url: mediaUrl || '',
        symptoms: {
          symptoms: symptoms || [],
          other: notes || ''
        }
      });

      const result = screeningToResult(screening, patient);
      if (mediaUrl && !result.mediaUrl) {
        result.mediaUrl = mediaUrl;
      }
      setActiveResult(result);
      setHistoryList(prev => [screeningToHistory(screening, patient), ...((prev || []).filter(h => h.id !== `screening_${screening.id}`))]);
      refreshBackendState();
      setActivePage('result');
    } catch (error) {
      console.error('Online AI Analysis Error:', error);
      setApiError(error.message || 'Online health analysis failed. Please ensure the backend server is running and Hugging Face API key is valid.');
      throw error;
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAuthSuccess = (auth) => {
    if (auth && auth.user) {
      setUser(auth.user);
    }
    setActivePage('dashboard');
  };

  const handleLogout = () => {
    clearStoredAuth();
    setUser(null);
    setActivePage('login');
  };

  const handleSelectHistoryItem = (historyItem) => {
    if (historyItem.fullResult) {
      setActiveResult(historyItem.fullResult);
    } else {
      setActiveResult({
        patient: { name: historyItem.patientName, species: historyItem.species || 'Animal', breed: historyItem.breed },
        symptoms: historyItem.symptoms,
        evaluatedAt: historyItem.date,
        triageStatus: {
          level: historyItem.triageLevel || 'GREEN',
          title: `${historyItem.triageLevel || 'GREEN'} Triage`,
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
    <ErrorBoundary>
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
              onRunPrediction={handleRunPrediction}
              scannerPresets={scannerPresets}
              isAnalyzing={isAnalyzing}
              apiError={apiError}
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
              setUser={setUser}
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
              scannerPresets={scannerPresets}
              onRunPrediction={handleRunPrediction}
              setActivePage={setActivePage}
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

        {/* Footer */}
        <Footer setActivePage={setActivePage} />
      </div>
    </ErrorBoundary>
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
    evaluatedAt: screening.created_at ? new Date(screening.created_at).toLocaleString() : new Date().toLocaleString(),
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
    date: screening.created_at ? new Date(screening.created_at).toLocaleString() : new Date().toLocaleString(),
    patientName: patient?.name || `Animal #${screening.animal_id || '1'}`,
    species: patient?.species || screening.visual_analysis?.animal || 'Animal',
    breed: patient?.breed || '',
    topDisease: first?.name || 'AI Health Screening',
    confidence: first?.likelihood === 'high' ? 86 : first?.likelihood === 'moderate' ? 68 : 42,
    urgency: (screening.urgency || 'moderate').toUpperCase(),
    triageLevel: triage.level,
    symptoms: screening.symptoms?.symptoms || [],
    fullResult: screeningToResult(screening, patient)
  };
}
