import React, { useEffect, useRef, useState } from 'react';
import { uploadHealthMedia } from '../api/client.js';

export default function Prediction({
  user = null,
  scannerPresets = [],
  onRunPrediction,
  setActivePage,
  apiError = '',
  isAnalyzing = false
}) {
  const safeScannerPresets = Array.isArray(scannerPresets) ? scannerPresets : [];

  if (user?.role === 'ngo' || user?.role === 'gov') {
    return (
      <div className="max-w-2xl mx-auto my-12 bg-white rounded-3xl p-8 sm:p-10 border border-slate-200 shadow-xl text-center space-y-5">
        <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-md">
          🏛️
        </div>
        <div className="space-y-2">
          <span className="bg-teal-100 text-teal-800 text-[10px] font-black uppercase px-3 py-1 rounded-full border border-teal-200">
            Government & NGO Command Portal
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900">Directives & Surveillance Center</h2>
          <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
            As a Government official or NGO representative, consumer AI scanning is omitted from your account. Use your dedicated Dashboard to publish official circulars, ring vaccination mandates, quarantine directives, and monitor statewide outbreak alerts.
          </p>
        </div>
        <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => setActivePage('dashboard')}
            className="bg-teal-600 hover:bg-teal-700 text-white font-black text-xs px-6 py-3 rounded-2xl shadow-md transition-colors flex items-center justify-center gap-2"
          >
            <span>📢 Go to Directive Publishing Portal</span>
          </button>
          <button
            onClick={() => setActivePage('notifications')}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-5 py-3 rounded-2xl transition-colors"
          >
            🚨 Outbreak Radar
          </button>
        </div>
      </div>
    );
  }

  if (user?.role === 'vet') {
    return (
      <div className="max-w-2xl mx-auto my-12 bg-white rounded-3xl p-8 sm:p-10 border border-slate-200 shadow-xl text-center space-y-5">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-md">
          🩺
        </div>
        <div className="space-y-2">
          <span className="bg-blue-100 text-blue-800 text-[10px] font-black uppercase px-3 py-1 rounded-full border border-blue-200">
            Veterinarian Clinical Workflow
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900">Clinical Case Review Queue</h2>
          <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
            As a licensed veterinarian, consumer AI scanning is omitted from your account. Your dedicated role is evaluating doubtful scans submitted by farmers and pet parents, confirming diagnoses, and issuing clinical prescriptions.
          </p>
        </div>
        <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => setActivePage('consultations')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-6 py-3 rounded-2xl shadow-md transition-colors flex items-center justify-center gap-2"
          >
            <span>📋 Go to Doctor Case Review Queue</span>
          </button>
          <button
            onClick={() => setActivePage('notifications')}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-5 py-3 rounded-2xl transition-colors"
          >
            🚨 Outbreak Radar
          </button>
        </div>
      </div>
    );
  }

  const [scanImage, setScanImage] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [mediaId, setMediaId] = useState(0);
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [pipelineStep, setPipelineStep] = useState(0);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleProcessFile(e.target.files[0]);
      e.target.value = '';
    }
  };

  const handleProcessFile = async (file) => {
    stopCamera();
    setSelectedFile(file);
    setUploadError('');
    setIsUploading(true);
    const previewUrl = URL.createObjectURL(file);
    setScanImage(previewUrl);

    try {
      const media = await uploadHealthMedia(file);
      setMediaId(media?.id || 0);
    } catch (err) {
      console.warn('Upload delayed, will retry on submit:', err);
      setMediaId(0);
    } finally {
      setIsUploading(false);
    }
  };

  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordTimerRef = useRef(null);

  const isVideoMedia = selectedFile?.type?.startsWith('video/') ||
    (scanImage && (scanImage.endsWith('.mp4') || scanImage.endsWith('.webm') || scanImage.endsWith('.mov')));

  const handlePresetSelect = (preset) => {
    stopCamera();
    setSelectedFile(null);
    setScanImage(preset.thumbnail);
    setMediaId(0);
    setClinicalNotes(preset.title ? `Lesion observed: ${preset.title}` : '');
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
      setCameraError('Camera access was denied or is unavailable on this device.');
    }
  };

  const stopCamera = () => {
    if (isRecordingVideo) {
      stopVideoRecording();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
    setIsRecordingVideo(false);
    setRecordDuration(0);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
      stopCamera();
      await handleProcessFile(file);
    }, 'image/jpeg', 0.9);
  };

  const startVideoRecording = () => {
    if (!streamRef.current) return;
    recordedChunksRef.current = [];
    setIsRecordingVideo(true);
    setRecordDuration(0);

    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' :
      MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'video/mp4';

    try {
      const recorder = new MediaRecorder(streamRef.current, { mimeType: mime });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        clearInterval(recordTimerRef.current);
        const ext = mime.includes('mp4') ? 'mp4' : 'webm';
        const blob = new Blob(recordedChunksRef.current, { type: mime });
        const file = new File([blob], `gait-motion-${Date.now()}.${ext}`, { type: mime });
        stopCamera();
        await handleProcessFile(file);
      };

      recorder.start(250);
      recordTimerRef.current = setInterval(() => {
        setRecordDuration((prev) => {
          if (prev >= 12) {
            stopVideoRecording();
            return 12;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('MediaRecorder error:', err);
      setCameraError('Video recording unsupported on this browser. Please upload a video file instead.');
      setIsRecordingVideo(false);
    }
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    clearInterval(recordTimerRef.current);
    setIsRecordingVideo(false);
  };

  const handleSubmitAnalysis = async (e) => {
    if (e) e.preventDefault();
    if (!scanImage && !selectedFile) {
      alert('Please upload a photo/video or capture one first.');
      return;
    }

    let effectiveMediaId = mediaId;
    if (!effectiveMediaId && selectedFile) {
      setIsUploading(true);
      try {
        const media = await uploadHealthMedia(selectedFile);
        effectiveMediaId = media?.id || 0;
        setMediaId(effectiveMediaId);
      } catch (err) {
        console.error('Failed to upload media before submission:', err);
      } finally {
        setIsUploading(false);
      }
    }

    setPipelineStep(1);
    const timer = setTimeout(() => setPipelineStep(2), 1800);

    try {
      await onRunPrediction({
        mediaId: effectiveMediaId,
        mediaUrl: scanImage,
        notes: clinicalNotes,
        symptoms: clinicalNotes ? [clinicalNotes] : []
      });
    } finally {
      clearTimeout(timer);
      setPipelineStep(0);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      
      {/* Header */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-black uppercase bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full">
              Automated Computer Vision & Multimodal Clinical Reasoning
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
            Veterinary AI Health Diagnostic Scanner
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Feed any animal photo or gait/motion video into the AI scanner to detect species characteristics and derive full clinical differential diagnoses.
          </p>
        </div>

        <button
          onClick={() => setActivePage('home')}
          className="self-start sm:self-auto text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 px-4 py-2 rounded-xl transition-colors"
        >
          ← Back to Home
        </button>
      </div>

      {/* Main Scanner Section */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
        
        {cameraOpen ? (
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-video max-h-[420px] mx-auto flex items-center justify-center border-2 border-emerald-500 shadow-xl">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <div className="absolute inset-0 border-2 border-emerald-400/40 pointer-events-none rounded-2xl animate-pulse"></div>
            
            {isRecordingVideo && (
              <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 text-white text-xs font-black px-3 py-1.5 rounded-full backdrop-blur-md animate-pulse">
                <span className="w-2.5 h-2.5 rounded-full bg-white"></span>
                <span>REC {recordDuration}s / 12s</span>
              </div>
            )}

            <div className="absolute bottom-4 left-0 right-0 flex flex-wrap justify-center gap-2.5 px-4">
              {!isRecordingVideo ? (
                <>
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-5 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-xs transition-all"
                  >
                    <span>📸 Capture Photo</span>
                  </button>
                  <button
                    type="button"
                    onClick={startVideoRecording}
                    className="bg-red-600 hover:bg-red-500 text-white font-black px-5 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-xs transition-all"
                  >
                    <span>🔴 Record Motion (10s)</span>
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
        ) : scanImage ? (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            <div className="md:col-span-6 relative rounded-2xl overflow-hidden bg-slate-950 aspect-video max-h-[300px] border-2 border-emerald-500 shadow-md group">
              {isVideoMedia ? (
                <video src={scanImage} controls autoPlay muted loop className="w-full h-full object-cover" />
              ) : (
                <img src={scanImage} alt="Analysis subject" className="w-full h-full object-cover" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end p-3 pointer-events-none">
                <span className="text-xs font-bold text-emerald-300 bg-black/60 px-3 py-1 rounded-lg backdrop-blur-sm">
                  {isVideoMedia ? '🎥 Dynamic Video Loaded (Temporal AI Sampling)' : '✓ Photo Ready for AI Analysis'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setScanImage(null);
                  setSelectedFile(null);
                  setMediaId(0);
                }}
                className="absolute top-3 right-3 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center font-bold text-sm hover:bg-red-700 shadow z-10"
                title="Remove media"
              >
                ✕
              </button>
            </div>

            <div className="md:col-span-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Optional Observations / Clinical Notes:
                </label>
                <textarea
                  rows="3"
                  placeholder="Optional: Describe duration, behavioral changes, itching, diet, etc..."
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  disabled={isAnalyzing || isUploading}
                  onClick={handleSubmitAnalysis}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 px-6 rounded-2xl shadow-lg shadow-emerald-500/20 text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {isAnalyzing ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Analyzing Photo & Clinical Signs...</span>
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
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-center"
                >
                  Select Another Photo
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
            className={`border-2 border-dashed rounded-3xl p-10 sm:p-16 text-center cursor-pointer transition-all ${
              dragActive
                ? 'border-emerald-500 bg-emerald-50 scale-[1.01]'
                : 'border-slate-300 hover:border-emerald-500 bg-slate-50 hover:bg-slate-50/80'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,video/x-matroska"
              onChange={handleFileInput}
              className="hidden"
            />

            <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto mb-4 text-3xl font-bold shadow-sm">
              📸🎥
            </div>
            <h3 className="text-lg font-black text-slate-900">
              Drag & Drop Animal Photo or Motion Video Here
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Upload clear photos or recorded videos to evaluate skin lesions, wounds, respiratory effort, and gait/twitching (e.g. Distemper, Ataxia, Colic).
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
              <span className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-2.5 rounded-xl shadow-sm transition-colors">
                Select Photo / Video from Device
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  startCamera();
                }}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm transition-colors"
              >
                📸 Camera Photo / 🔴 Record Video
              </button>
            </div>
          </div>
        )}

        {cameraError && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 text-center font-semibold">
            {cameraError}
          </p>
        )}
        {(apiError || uploadError) && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 text-center font-semibold">
            {apiError || uploadError}
          </p>
        )}

        {/* Clinical Presets */}
        <div className="pt-4 border-t border-slate-100">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-3">
            Or Click a Disease Sample to Test:
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => handlePresetSelect({
                thumbnail: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400&auto=format&fit=crop&q=80',
                title: 'Canine Parvovirus (CPV-2)',
                area: 'Lethargy & bloody diarrhea'
              })}
              className="p-3 rounded-2xl bg-slate-50 hover:bg-white border border-slate-200 hover:border-emerald-500 hover:shadow-md text-left transition-all group flex flex-col justify-between"
            >
              <div className="w-full h-24 rounded-xl overflow-hidden mb-2 bg-slate-200 flex items-center justify-center">
                <img
                  src="https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400&auto=format&fit=crop&q=80"
                  alt="Canine Parvovirus"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              </div>
              <div>
                <strong className="text-xs font-bold text-slate-900 block group-hover:text-emerald-700 truncate">
                  Canine Parvovirus
                </strong>
                <span className="text-[11px] text-red-600 font-bold block truncate">
                  Emergency Enteritis
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handlePresetSelect({
                thumbnail: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&auto=format&fit=crop&q=80',
                title: 'Canine Distemper Virus (CDV)',
                area: 'Oculonasal discharge & hard pad'
              })}
              className="p-3 rounded-2xl bg-slate-50 hover:bg-white border border-slate-200 hover:border-emerald-500 hover:shadow-md text-left transition-all group flex flex-col justify-between"
            >
              <div className="w-full h-24 rounded-xl overflow-hidden mb-2 bg-slate-200 flex items-center justify-center">
                <img
                  src="https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&auto=format&fit=crop&q=80"
                  alt="Canine Distemper"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              </div>
              <div>
                <strong className="text-xs font-bold text-slate-900 block group-hover:text-emerald-700 truncate">
                  Canine Distemper
                </strong>
                <span className="text-[11px] text-amber-600 font-bold block truncate">
                  Systemic & Hard Pad
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handlePresetSelect({
                thumbnail: 'https://images.unsplash.com/photo-1546445317-29f4545e9d53?w=400&auto=format&fit=crop&q=80',
                title: 'Bovine Lumpy Skin Disease (LSD)',
                area: 'Circumscribed cutaneous nodules'
              })}
              className="p-3 rounded-2xl bg-slate-50 hover:bg-white border border-slate-200 hover:border-emerald-500 hover:shadow-md text-left transition-all group flex flex-col justify-between"
            >
              <div className="w-full h-24 rounded-xl overflow-hidden mb-2 bg-slate-200 flex items-center justify-center">
                <img
                  src="https://images.unsplash.com/photo-1546445317-29f4545e9d53?w=400&auto=format&fit=crop&q=80"
                  alt="Cattle Lumpy Skin"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              </div>
              <div>
                <strong className="text-xs font-bold text-slate-900 block group-hover:text-emerald-700 truncate">
                  Cattle Lumpy Skin
                </strong>
                <span className="text-[11px] text-amber-600 font-bold block truncate">
                  Capripoxvirus Nodules
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handlePresetSelect({
                thumbnail: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&auto=format&fit=crop&q=80',
                title: 'Feline Ringworm (Dermatophytosis)',
                area: 'Circular focal alopecia'
              })}
              className="p-3 rounded-2xl bg-slate-50 hover:bg-white border border-slate-200 hover:border-emerald-500 hover:shadow-md text-left transition-all group flex flex-col justify-between"
            >
              <div className="w-full h-24 rounded-xl overflow-hidden mb-2 bg-slate-200 flex items-center justify-center">
                <img
                  src="https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&auto=format&fit=crop&q=80"
                  alt="Feline Ringworm"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              </div>
              <div>
                <strong className="text-xs font-bold text-slate-900 block group-hover:text-emerald-700 truncate">
                  Feline Ringworm
                </strong>
                <span className="text-[11px] text-emerald-700 font-bold block truncate">
                  Circular Alopecia
                </span>
              </div>
            </button>
          </div>
        </div>

      </div>

      {/* Pipeline Explanation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1.5">
          <div className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-xs">1</span>
            <span>Visual Recognition</span>
          </div>
          <p className="text-slate-500 leading-relaxed">
            Identifies animal species and extracts detailed anatomical structures and visible lesions.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1.5">
          <div className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-black text-xs">2</span>
            <span>Differential Reasoning</span>
          </div>
          <p className="text-slate-500 leading-relaxed">
            Evaluates acute, infectious, systemic, and dermatological pathologies across veterinary medicine.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1.5">
          <div className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center font-black text-xs">3</span>
            <span>Clinical Protocols</span>
          </div>
          <p className="text-slate-500 leading-relaxed">
            Provides emergency triage ranking, recommended diagnostic laboratory tests, and supportive care.
          </p>
        </div>
      </div>

    </div>
  );
}
