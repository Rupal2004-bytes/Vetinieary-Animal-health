import React, { useEffect, useRef, useState } from 'react';
import { uploadHealthMedia } from '../api/client.js';

export default function Home({
  setActivePage,
  onRunPrediction,
  scannerPresets = [],
  isAnalyzing = false,
  apiError = ''
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

  const captureCameraPhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `camera-scan-${Date.now()}.jpg`, { type: 'image/jpeg' });
      stopCamera();
      await handleFileSelected(file);
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
        await handleFileSelected(file);
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
        symptoms: clinicalNotes ? [clinicalNotes] : []
      });
    } finally {
      clearTimeout(stepTimer);
      setActivePipelineStep(0);
    }
  };

  return (
    <div className="space-y-10">
      
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
