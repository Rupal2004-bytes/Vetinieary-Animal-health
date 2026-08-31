import React, { useEffect, useRef, useState } from 'react';
import { uploadHealthMedia } from '../api/client.js';

export default function Home({
  user = null,
  setActivePage,
  onRunPrediction,
  scannerPresets = [],
  isAnalyzing = false,
  apiError = '',
  urgentSOS = null,
  animals = [],
  selectedPatient = null,
  setSelectedPatient
}) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [mediaId, setMediaId] = useState(0);
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [activePipelineStep, setActivePipelineStep] = useState(0); // 0: ready, 1: vision, 2: vet AI
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
      e.target.value = '';
    }
  };

  const handleFileSelected = async (file) => {
    stopCamera();
    setSelectedFile(file);
    const previewUrl = URL.createObjectURL(file);
    setSelectedImage(previewUrl);
    setUploading(true);
    try {
      const media = await uploadHealthMedia(file);
      setMediaId(media?.id || 0);
    } catch (err) {
      console.warn('Media upload delayed, will retry on submission:', err);
      setMediaId(0);
    } finally {
      setUploading(false);
    }
  };

  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordTimerRef = useRef(null);

  const isVideoMedia = selectedFile?.type?.startsWith('video/') ||
    (selectedImage && (selectedImage.endsWith('.mp4') || selectedImage.endsWith('.webm') || selectedImage.endsWith('.mov')));

  const handlePresetSelect = async (preset) => {
    stopCamera();
    setSelectedImage(preset.thumbnail);
    setSelectedFile(null);
    setMediaId(0);
    setClinicalNotes(preset.title ? `Suspected ${preset.title} lesion.` : '');
  };

  const startCamera = async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current = stream;
      setCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 50);
    } catch {
      setCameraError('Camera access unavailable. Please upload a photo or video instead.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOpen(false);
    clearInterval(recordTimerRef.current);
    setIsRecordingVideo(false);
  };

  const captureCameraPhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `live_capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
        handleFileSelected(file);
      }
    }, 'image/jpeg', 0.92);
  };

  const startVideoRecording = () => {
    if (!streamRef.current) return;
    recordedChunksRef.current = [];
    setRecordDuration(0);

    const mimeTypes = ['video/webm;codecs=vp9', 'video/webm', 'video/mp4'];
    let supportedMime = '';
    for (const m of mimeTypes) {
      if (MediaRecorder.isTypeSupported(m)) {
        supportedMime = m;
        break;
      }
    }

    try {
      const recorder = new MediaRecorder(streamRef.current, supportedMime ? { mimeType: supportedMime } : undefined);
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: supportedMime || 'video/webm' });
        const ext = supportedMime.includes('mp4') ? 'mp4' : 'webm';
        const file = new File([blob], `gait_video_${Date.now()}.${ext}`, { type: blob.type });
        handleFileSelected(file);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(500);
      setIsRecordingVideo(true);

      const startTime = Date.now();
      recordTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setRecordDuration(elapsed);
        if (elapsed >= 12) {
          stopVideoRecording();
        }
      }, 500);
    } catch (err) {
      console.error('Video recording init error:', err);
    }
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    clearInterval(recordTimerRef.current);
    setIsRecordingVideo(false);
  };

  const handleRunAnalysis = async () => {
    if (!selectedImage && !selectedFile) {
      alert('Please upload or capture a photo/video first.');
      return;
    }

    let effectiveMediaId = mediaId;
    if (!effectiveMediaId && selectedFile) {
      setUploading(true);
      try {
        const media = await uploadHealthMedia(selectedFile);
        effectiveMediaId = media?.id || 0;
        setMediaId(effectiveMediaId);
      } catch (err) {
        console.error('Failed to upload media before analysis:', err);
      } finally {
        setUploading(false);
      }
    }

    setActivePipelineStep(1);
    const stepTimer = setTimeout(() => {
      setActivePipelineStep(2);
    }, 1800);

    try {
      await onRunPrediction({
        mediaId: effectiveMediaId,
        mediaUrl: selectedImage,
        notes: clinicalNotes,
        symptoms: clinicalNotes ? [clinicalNotes] : [],
        patient: selectedPatient
      });
    } finally {
      clearTimeout(stepTimer);
      setActivePipelineStep(0);
    }
  };

  if (user?.role === 'vet') {
    return (
      <div className="space-y-8">
        {/* Urgent Outbreak SOS Notification Banner */}
        {urgentSOS && (
          <div 
            onClick={() => {
              if (urgentSOS.outbreak_id) {
                setActivePage('outbreak-detail', { outbreakId: urgentSOS.outbreak_id });
              } else {
                setActivePage('notifications');
              }
            }}
            className="bg-gradient-to-r from-red-600 via-red-700 to-rose-800 text-white p-4 sm:p-5 rounded-2xl shadow-xl border-2 border-red-400/80 cursor-pointer hover:shadow-2xl hover:scale-[1.008] transition-all animate-pulse"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white text-red-600 text-xl font-black flex items-center justify-center shadow-md">
                  🚨
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-white/20 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                      {urgentSOS.severity || 'CRITICAL'} OUTBREAK SOS
                    </span>
                    <span className="text-xs text-red-100 font-bold">📍 {urgentSOS.district || 'Regional Alert'}</span>
                  </div>
                  <h3 className="text-sm font-black mt-0.5 text-white">{urgentSOS.title}</h3>
                  <p className="text-xs text-red-100 leading-snug font-medium line-clamp-1">{urgentSOS.message}</p>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 bg-white text-red-700 font-black text-xs px-3.5 py-2 rounded-xl shadow-sm whitespace-nowrap">
                <span>View Outbreak Map & Protocols</span>
                <span>→</span>
              </div>
            </div>
          </div>
        )}

        {/* Vet Welcome Header Banner */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-10 text-white shadow-2xl border border-blue-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-blue-500/20 text-blue-300 text-xs font-black uppercase px-3 py-1 rounded-full border border-blue-400/30">
              <span>🩺 Licensed Veterinarian Command Hub</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white">
              {user.name || 'Doctor Workspace'}
            </h1>
            <p className="text-blue-200 text-xs sm:text-sm max-w-2xl leading-relaxed">
              {user.clinic_name || 'Veterinary Clinical Center'} &bull; District: <strong>{user.district || 'Pune'}</strong>
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => setActivePage('consultations')}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs px-5 py-3 rounded-2xl shadow-lg transition-all flex items-center gap-2"
            >
              <span>📋 Open Case Review Queue</span>
            </button>
            <button
              onClick={() => setActivePage('profile')}
              className="bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-4 py-3 rounded-2xl border border-white/20 transition-colors flex items-center gap-2"
            >
              <span>⚙️ Duty & Profile</span>
            </button>
          </div>
        </div>

        {/* Vet Action Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          
          <div 
            onClick={() => setActivePage('consultations')}
            className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-500 cursor-pointer transition-all space-y-3"
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center text-2xl font-bold">
              📋
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">Doctor Case Review Queue</h3>
              <p className="text-xs text-slate-500 mt-1">Review doubtful AI scans from farmers, verify differentials, and issue ℞ prescriptions.</p>
            </div>
            <span className="text-xs font-bold text-blue-600 flex items-center gap-1">Open Queue →</span>
          </div>

          <div 
            onClick={() => setActivePage('notifications')}
            className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-md hover:border-red-500 cursor-pointer transition-all space-y-3"
          >
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-700 flex items-center justify-center text-2xl font-bold">
              🚨
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">Outbreak Radar & SOS</h3>
              <p className="text-xs text-slate-500 mt-1">Monitor multi-village disease clusters, consensus alerts, and biosecurity rings.</p>
            </div>
            <span className="text-xs font-bold text-red-600 flex items-center gap-1">View Radar →</span>
          </div>

          <div 
            onClick={() => setActivePage('inventory')}
            className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-md hover:border-purple-500 cursor-pointer transition-all space-y-3"
          >
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center text-2xl font-bold">
              📦
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">Dispensary Stock & Vaccines</h3>
              <p className="text-xs text-slate-500 mt-1">Track regional supplies of FMD, Lumpy Skin, PPR vaccines and critical antibiotics.</p>
            </div>
            <span className="text-xs font-bold text-purple-600 flex items-center gap-1">Check Inventory →</span>
          </div>

          <div 
            onClick={() => setActivePage('contact')}
            className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-500 cursor-pointer transition-all space-y-3"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-2xl font-bold">
              📞
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">1962 Mobile Helpline</h3>
              <p className="text-xs text-slate-500 mt-1">Direct emergency coordination with Government Mobile Veterinary Clinics.</p>
            </div>
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">Helpline Info →</span>
          </div>

        </div>

      </div>
    );
  }

  if (user?.role === 'ngo' || user?.role === 'gov') {
    return (
      <div className="space-y-8">
        {/* Urgent Outbreak SOS Notification Banner */}
        {urgentSOS && (
          <div 
            onClick={() => {
              if (urgentSOS.outbreak_id) {
                setActivePage('outbreak-detail', { outbreakId: urgentSOS.outbreak_id });
              } else {
                setActivePage('notifications');
              }
            }}
            className="bg-gradient-to-r from-red-600 via-red-700 to-rose-800 text-white p-4 sm:p-5 rounded-2xl shadow-xl border-2 border-red-400/80 cursor-pointer hover:shadow-2xl hover:scale-[1.008] transition-all animate-pulse"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white text-red-600 text-xl font-black flex items-center justify-center shadow-md">
                  🚨
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-white/20 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                      {urgentSOS.severity || 'CRITICAL'} OUTBREAK SOS
                    </span>
                    <span className="text-xs text-red-100 font-bold">📍 {urgentSOS.district || 'Regional Alert'}</span>
                  </div>
                  <h3 className="text-sm font-black mt-0.5 text-white">{urgentSOS.title}</h3>
                  <p className="text-xs text-red-100 leading-snug font-medium line-clamp-1">{urgentSOS.message}</p>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 bg-white text-red-700 font-black text-xs px-3.5 py-2 rounded-xl shadow-sm whitespace-nowrap">
                <span>View Outbreak Map & Protocols</span>
                <span>→</span>
              </div>
            </div>
          </div>
        )}

        {/* NGO / Gov Welcome Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-emerald-950 rounded-3xl p-6 sm:p-10 text-white shadow-2xl border border-teal-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-teal-500/20 text-teal-300 text-xs font-black uppercase px-3 py-1 rounded-full border border-teal-400/30">
              <span>🏛️ {user.role === 'gov' ? 'Government Animal Husbandry Department' : 'Animal Welfare NGO & Relief Network'}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white">
              {user.name || 'Crisis Command & Directives'}
            </h1>
            <p className="text-teal-200 text-xs sm:text-sm max-w-2xl leading-relaxed">
              District Jurisdiction: <strong>{user.district || 'Statewide Headquarters (Maharashtra)'}</strong>
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => setActivePage('dashboard')}
              className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs px-5 py-3 rounded-2xl shadow-lg transition-all flex items-center gap-2"
            >
              <span>📢 Publish Official Directives</span>
            </button>
            <button
              onClick={() => setActivePage('notifications')}
              className="bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-4 py-3 rounded-2xl border border-white/20 transition-colors flex items-center gap-2"
            >
              <span>🚨 Outbreak Radar</span>
            </button>
          </div>
        </div>

        {/* NGO / Gov Action Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          
          <div 
            onClick={() => setActivePage('dashboard')}
            className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-md hover:border-teal-500 cursor-pointer transition-all space-y-3"
          >
            <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center text-2xl font-bold">
              📢
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">Directive Publishing Portal</h3>
              <p className="text-xs text-slate-500 mt-1">Issue quarantine mandates, ring vaccination circulars, and statewide alerts.</p>
            </div>
            <span className="text-xs font-bold text-teal-600 flex items-center gap-1">Open Publishing Portal →</span>
          </div>

          <div 
            onClick={() => setActivePage('notifications')}
            className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-md hover:border-red-500 cursor-pointer transition-all space-y-3"
          >
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-700 flex items-center justify-center text-2xl font-bold">
              🚨
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">Epidemic Radar & SOS</h3>
              <p className="text-xs text-slate-500 mt-1">Track multi-village clusters, active containment rings, and recovery reports.</p>
            </div>
            <span className="text-xs font-bold text-red-600 flex items-center gap-1">View Radar →</span>
          </div>

          <div 
            onClick={() => setActivePage('inventory')}
            className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-md hover:border-purple-500 cursor-pointer transition-all space-y-3"
          >
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center text-2xl font-bold">
              📦
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">Emergency Relief Inventory</h3>
              <p className="text-xs text-slate-500 mt-1">Coordinate stockpiles of vaccines, electrolytes, PPE, and emergency medications.</p>
            </div>
            <span className="text-xs font-bold text-purple-600 flex items-center gap-1">Manage Inventory →</span>
          </div>

          <div 
            onClick={() => setActivePage('emergency')}
            className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-500 cursor-pointer transition-all space-y-3"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-2xl font-bold">
              📞
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">1962 Helpline Fleet</h3>
              <p className="text-xs text-slate-500 mt-1">Direct coordination with Government Mobile Veterinary Ambulance units.</p>
            </div>
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">Helpline Info →</span>
          </div>

        </div>

      </div>
    );
  }

  return (
    <div className="space-y-8">
      
      {/* Urgent Outbreak SOS Notification Banner */}
      {urgentSOS && (
        <div 
          onClick={() => {
            if (urgentSOS.outbreak_id) {
              setActivePage('outbreak-detail', { outbreakId: urgentSOS.outbreak_id });
            } else {
              setActivePage('notifications');
            }
          }}
          className="bg-gradient-to-r from-red-600 via-red-700 to-rose-800 text-white p-4 sm:p-5 rounded-2xl shadow-xl border-2 border-red-400/80 cursor-pointer hover:shadow-2xl hover:scale-[1.008] transition-all animate-pulse"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white text-red-600 text-xl font-black flex items-center justify-center shadow-md">
                🚨
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-white/20 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {urgentSOS.severity || 'CRITICAL'} OUTBREAK SOS
                  </span>
                  <span className="text-xs text-red-100 font-bold">📍 {urgentSOS.district || 'Regional Alert'}</span>
                </div>
                <h3 className="text-sm font-black mt-0.5 text-white">{urgentSOS.title}</h3>
                <p className="text-xs text-red-100 leading-snug font-medium line-clamp-1">{urgentSOS.message}</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 bg-white text-red-700 font-black text-xs px-3.5 py-2 rounded-xl shadow-sm whitespace-nowrap">
              <span>View Outbreak Map & Protocols</span>
              <span>→</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Top Main Hero & Instant AI Scanner */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 rounded-3xl p-6 sm:p-10 text-white shadow-2xl border border-slate-800 relative overflow-hidden">
        <div className="relative z-10 max-w-4xl mx-auto space-y-6">
          
          {/* Header Banner */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-400 text-xs font-black uppercase px-3.5 py-1.5 rounded-full border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Multimodal Diagnostic AI (Photo & Dynamic Video Analysis)</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
              Instant Animal Disease, Lesion & Gait Scanner
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl mx-auto leading-relaxed">
              Upload or record static photos or dynamic motion videos. Multi-frame keyframe AI inspects skin lesions, wounds, respiratory distress, and neurological twitches / gait ataxia (e.g. Canine Distemper, Rabies, Colic).
            </p>
          </div>

          {/* Interactive Upload & Camera Dropzone */}
          <div className="bg-slate-800/80 backdrop-blur-md rounded-3xl p-5 sm:p-7 border border-slate-700/80 shadow-xl space-y-5">
            
            {/* Patient Animal Profile Context Selector */}
            {animals.length > 0 && (
              <div className="bg-slate-900/80 border border-slate-700/80 p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl p-1.5 bg-slate-800 rounded-xl">🐾</span>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Assigning Scan To:</span>
                    <strong className="text-emerald-400 text-xs">
                      {selectedPatient
                        ? `${selectedPatient.name} (${selectedPatient.species} • ${selectedPatient.breed || 'Mixed'} • Tag: ${selectedPatient.tag_number || selectedPatient.id})`
                        : 'General / Unregistered Animal (Click to select profile)'}
                    </strong>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 items-center self-start sm:self-auto">
                  {selectedPatient && (
                    <button
                      type="button"
                      onClick={() => setSelectedPatient?.(null)}
                      className="text-[11px] font-bold text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors"
                    >
                      ✕ Unselect
                    </button>
                  )}
                  <select
                    value={selectedPatient?.id || ''}
                    onChange={(e) => {
                      const p = animals.find(a => String(a.id) === e.target.value);
                      setSelectedPatient?.(p || null);
                      if (p?.notes && !clinicalNotes) {
                        setClinicalNotes(`Known profile context: ${p.notes}`);
                      }
                    }}
                    className="bg-slate-800 border border-slate-600 text-slate-100 rounded-xl px-3 py-1.5 font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs"
                  >
                    <option value="">-- Choose Registered Animal --</option>
                    {animals.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.species} • {a.breed || 'Mixed'} • Tag: {a.tag_number || a.id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            
            {cameraOpen ? (
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-video max-h-[380px] mx-auto flex items-center justify-center border-2 border-emerald-500 shadow-2xl">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <div className="absolute inset-0 border-2 border-emerald-400/40 pointer-events-none rounded-2xl animate-pulse"></div>
                
                {isRecordingVideo && (
                  <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600/90 text-white text-xs font-black px-3 py-1.5 rounded-full backdrop-blur-md animate-pulse">
                    <span className="w-2.5 h-2.5 rounded-full bg-white"></span>
                    <span>REC {recordDuration}s / 12s</span>
                  </div>
                )}

                <div className="absolute bottom-4 left-0 right-0 flex flex-wrap justify-center gap-2.5 px-4">
                  {!isRecordingVideo ? (
                    <>
                      <button
                        type="button"
                        onClick={captureCameraPhoto}
                        className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-5 py-2.5 rounded-xl shadow-lg flex items-center gap-1.5 text-xs transition-all"
                      >
                        <span>📸 Capture Photo</span>
                      </button>
                      <button
                        type="button"
                        onClick={startVideoRecording}
                        className="bg-red-600 hover:bg-red-500 text-white font-black px-5 py-2.5 rounded-xl shadow-lg flex items-center gap-1.5 text-xs transition-all"
                      >
                        <span>🔴 Record Gait/Motion (10s)</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={stopVideoRecording}
                      className="bg-white hover:bg-slate-100 text-red-600 font-black px-6 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs transition-all"
                    >
                      <span className="w-3 h-3 bg-red-600 rounded-sm"></span>
                      <span>Finish & Analyze Video</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="bg-slate-900/90 text-white font-bold px-4 py-2.5 rounded-xl text-xs hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : selectedImage ? (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                <div className="md:col-span-6 relative rounded-2xl overflow-hidden bg-slate-950 aspect-video max-h-[260px] border-2 border-emerald-500/60 shadow-lg group">
                  {isVideoMedia ? (
                    <video src={selectedImage} controls autoPlay muted loop className="w-full h-full object-cover" />
                  ) : (
                    <img src={selectedImage} alt="Uploaded patient media" className="w-full h-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end p-3 pointer-events-none">
                    <span className="text-[11px] font-bold text-emerald-300 bg-black/60 px-2.5 py-1 rounded-lg backdrop-blur-sm">
                      {isVideoMedia ? '🎥 Dynamic Motion Video Loaded (Temporal Keyframe AI)' : '✓ Photo Loaded for AI Analysis'}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedImage(null);
                      setSelectedFile(null);
                      setMediaId(0);
                    }}
                    className="absolute top-2 right-2 w-7 h-7 bg-red-600/90 text-white rounded-full flex items-center justify-center font-bold text-xs hover:bg-red-700 shadow z-10"
                    title="Remove media"
                  >
                    ✕
                  </button>
                </div>

                <div className="md:col-span-6 space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Optional Clinical Notes / Context:</label>
                    <input
                      type="text"
                      placeholder="e.g. Lethargy, vomiting, bloody diarrhea, or nasal discharge..."
                      value={clinicalNotes}
                      onChange={(e) => setClinicalNotes(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isAnalyzing || uploading}
                      onClick={handleRunAnalysis}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3.5 px-6 rounded-xl shadow-lg shadow-emerald-500/20 text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {isAnalyzing ? (
                        <>
                          <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                          <span>Analyzing Photo & Clinical Pathology...</span>
                        </>
                      ) : (
                        <>
                          <span>⚡ Run AI Disease Analysis</span>
                          <span>→</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-3 bg-slate-700/80 hover:bg-slate-700 text-slate-200 font-bold rounded-xl"
                    >
                      Change Photo
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
                  dragActive
                    ? 'border-emerald-400 bg-emerald-500/10 scale-[1.01]'
                    : 'border-slate-600/80 hover:border-emerald-500/80 bg-slate-900/60 hover:bg-slate-900/90'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,video/x-matroska"
                  onChange={handleFileInput}
                  className="hidden"
                />

                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-4 text-3xl border border-emerald-500/20">
                  📸🎥
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-100">
                  Click or Drag & Drop Animal Photo or Video Here
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Supports clear clinical photos or short motion videos (MP4, WebM, MOV) to evaluate skin lesions, wounds, respiratory effort, and gait/twitching (e.g. Distemper, Ataxia).
                </p>

                <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
                  <span className="bg-emerald-500 text-slate-950 font-black text-xs px-4 py-2 rounded-xl shadow-md flex items-center gap-1.5 hover:bg-emerald-400 transition-colors">
                    <span>📤 Upload Photo / Video</span>
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      startCamera();
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs px-4 py-2 rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors"
                  >
                    <span>📷 Capture Photo / 🔴 Record Video</span>
                  </button>
                </div>
              </div>
            )}

            {cameraError && (
              <p className="text-xs text-red-400 bg-red-950/50 border border-red-800/50 rounded-xl p-3 text-center">
                {cameraError}
              </p>
            )}
            {apiError && (
              <p className="text-xs text-red-400 bg-red-950/50 border border-red-800/50 rounded-xl p-3 text-center">
                {apiError}
              </p>
            )}

            {/* Quick Test Sample Presets */}
            <div className="pt-2 border-t border-slate-700/60">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Click a Disease Sample to Test AI Detection:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <button
                  type="button"
                  onClick={() => handlePresetSelect({
                    thumbnail: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400&auto=format&fit=crop&q=80',
                    title: 'Canine Parvovirus (CPV-2)',
                    area: 'Severe lethargy, dehydration & bloody diarrhea'
                  })}
                  className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-emerald-500 text-left transition-all group flex items-center gap-3"
                >
                  <img
                    src="https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400&auto=format&fit=crop&q=80"
                    alt="Canine Parvovirus"
                    className="w-10 h-10 rounded-lg object-cover bg-slate-950 shrink-0"
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-200 block truncate group-hover:text-emerald-400">
                      Canine Parvovirus
                    </span>
                    <span className="text-[10px] text-red-400 font-semibold block truncate">
                      Emergency Enteritis
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handlePresetSelect({
                    thumbnail: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&auto=format&fit=crop&q=80',
                    title: 'Canine Distemper Virus (CDV)',
                    area: 'Oculonasal discharge, hard pad & myoclonus'
                  })}
                  className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-emerald-500 text-left transition-all group flex items-center gap-3"
                >
                  <img
                    src="https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&auto=format&fit=crop&q=80"
                    alt="Canine Distemper"
                    className="w-10 h-10 rounded-lg object-cover bg-slate-950 shrink-0"
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-200 block truncate group-hover:text-emerald-400">
                      Canine Distemper
                    </span>
                    <span className="text-[10px] text-amber-400 font-semibold block truncate">
                      Systemic & Hard Pad
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handlePresetSelect({
                    thumbnail: 'https://images.unsplash.com/photo-1546445317-29f4545e9d53?w=400&auto=format&fit=crop&q=80',
                    title: 'Bovine Lumpy Skin Disease (LSD)',
                    area: 'Cutaneous circumscribed nodules'
                  })}
                  className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-emerald-500 text-left transition-all group flex items-center gap-3"
                >
                  <img
                    src="https://images.unsplash.com/photo-1546445317-29f4545e9d53?w=400&auto=format&fit=crop&q=80"
                    alt="Bovine Lumpy Skin"
                    className="w-10 h-10 rounded-lg object-cover bg-slate-950 shrink-0"
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-200 block truncate group-hover:text-emerald-400">
                      Cattle Lumpy Skin
                    </span>
                    <span className="text-[10px] text-amber-400 font-semibold block truncate">
                      Poxvirus Nodules
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handlePresetSelect({
                    thumbnail: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&auto=format&fit=crop&q=80',
                    title: 'Feline Ringworm (Dermatophytosis)',
                    area: 'Circular focal alopecia & scaling'
                  })}
                  className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-emerald-500 text-left transition-all group flex items-center gap-3"
                >
                  <img
                    src="https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&auto=format&fit=crop&q=80"
                    alt="Feline Ringworm"
                    className="w-10 h-10 rounded-lg object-cover bg-slate-950 shrink-0"
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-200 block truncate group-hover:text-emerald-400">
                      Feline Ringworm
                    </span>
                    <span className="text-[10px] text-emerald-400 font-semibold block truncate">
                      Circular Alopecia
                    </span>
                  </div>
                </button>
              </div>
            </div>

          </div>

          {/* AI Flow Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
            <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-3.5 flex items-center gap-3">
              <span className="text-2xl p-2 bg-emerald-500/10 rounded-xl text-emerald-400 font-bold">1</span>
              <div>
                <strong className="block text-slate-200 font-bold">Visual Recognition</strong>
                <span className="text-slate-400 text-[11px]">Identifies species & lesion morphology</span>
              </div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-3.5 flex items-center gap-3">
              <span className="text-2xl p-2 bg-blue-500/10 rounded-xl text-blue-400 font-bold">2</span>
              <div>
                <strong className="block text-slate-200 font-bold">Differential Reasoning</strong>
                <span className="text-slate-400 text-[11px]">Evaluates acute & systemic diseases</span>
              </div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-3.5 flex items-center gap-3">
              <span className="text-2xl p-2 bg-purple-500/10 rounded-xl text-purple-400 font-bold">3</span>
              <div>
                <strong className="block text-slate-200 font-bold">Triage & Protocols</strong>
                <span className="text-slate-400 text-[11px]">Diagnostic tests & emergency guidance</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Highlights & Clinical Capabilities */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-700 rounded-2xl flex items-center justify-center text-2xl font-bold">
            🔍
          </div>
          <h3 className="text-base font-black text-slate-900">Zero-Configuration Photo Triage</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            No forced animal profiles or rigid forms. The multimodal AI identifies species characteristics and pathology directly from the image.
          </p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-blue-50 text-blue-700 rounded-2xl flex items-center justify-center text-2xl font-bold">
            🚨
          </div>
          <h3 className="text-base font-black text-slate-900">Color-Coded Urgency Triage</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Immediate RED (Emergency), AMBER (Urgent), or GREEN (Monitor) classifications to help owners and handlers make rapid decisions.
          </p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-purple-50 text-purple-700 rounded-2xl flex items-center justify-center text-2xl font-bold">
            📚
          </div>
          <h3 className="text-base font-black text-slate-900">Pathology & Disease Library</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Explore verified veterinary monographs, zoonotic risk indicators, first-aid protocols, and diagnostic laboratory tests.
          </p>
          <button
            onClick={() => setActivePage('disease-info')}
            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
          >
            <span>Open Disease Library</span>
            <span>→</span>
          </button>
        </div>
      </section>

      {/* Emergency Hotline Alert */}
      <section className="bg-red-50 border border-red-200 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-1.5 text-center sm:text-left">
          <span className="bg-red-600 text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-full">
            Acute Emergency Protocol
          </span>
          <h3 className="text-xl font-bold text-red-950">Is Your Animal in Immediate Danger?</h3>
          <p className="text-xs sm:text-sm text-red-800 max-w-xl">
            Unresponsiveness, difficulty breathing, poisoning, or severe trauma require immediate in-person emergency hospital care.
          </p>
        </div>
        <button
          onClick={() => setActivePage('emergency')}
          className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm px-6 py-3.5 rounded-xl shadow-md transition-all shrink-0 flex items-center gap-2"
        >
          <span>🚨 24/7 Emergency Guide</span>
        </button>
      </section>

    </div>
  );
}
