import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserPlus, Camera, CheckCircle, AlertCircle,
  Loader2, RotateCcw, Trash2, User, Building2,
  ShieldCheck, Eye, EyeOff, ArrowLeft, SwitchCamera, FolderOpen, X,
} from 'lucide-react';
import { loadModels, captureFaceDescriptor, startWebcam, stopWebcam } from '../utils/faceUtils';
import { kagzsoSpeak } from './KagzsoChat';
import { saveRegisteredFace, getRegisteredFaces, deleteRegisteredFace } from '../utils/storageUtils';
// Note: saveRegisteredFace / getRegisteredFaces / deleteRegisteredFace are async (MySQL API)
import {
  isBiometricAvailable, hasFingerprint as hasFP,
  registerFingerprint, removeFingerprint,
} from '../utils/biometricUtils';

// ── Fingerprint SVG icon ───────────────────────────────────────────────────
const FingerprintIcon = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
    className={className}>
    <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
    <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
    <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
    <path d="M2 12a10 10 0 0 1 18-6" />
    <path d="M2 17c1 .5 2.17.91 3 1.45" />
    <path d="M22 6c1.14 2.28 1.5 4.9 1 7" />
    <path d="M6 10.7a10 10 0 0 0-.17 3.3" />
    <path d="M9 11a3 3 0 0 1 5.12-2.12" />
    <path d="M10.35 18.14C10 19.49 9.23 21.4 9 22" />
    <path d="M4.08 14c.18-.35.33-.7.44-1.04" />
    <path d="M16.41 9c.83 1.18 1.28 2.57 1.28 4" />
  </svg>
);

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

// ─── Status Banner ────────────────────────────────────────────────────────────
const StatusBanner = ({ type, message }) => {
  const styles = {
    success: 'bg-green-500/15 border-green-500/30 text-green-400',
    error:   'bg-red-500/15 border-red-500/30 text-red-400',
    info:    'bg-blue-500/15 border-blue-500/30 text-blue-400',
    warning: 'bg-yellow-500/15 border-yellow-500/30 text-yellow-400',
  };
  const icons = {
    success: CheckCircle,
    error:   AlertCircle,
    info:    Loader2,
    warning: AlertCircle,
  };
  const Icon = icons[type] || AlertCircle;

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium ${styles[type]}`}
        >
          <Icon size={16} className={type === 'info' ? 'animate-spin' : ''} />
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ─── Registered User Card ─────────────────────────────────────────────────────
const UserCard = ({ user, onDelete, bioAvailable, onRegisterFP, onRemoveFP }) => {
  const [fpState, setFpState] = useState('idle'); // idle | working | done | error
  const registered = hasFP(user.id);

  const handleFP = async () => {
    setFpState('working');
    try {
      if (registered) {
        removeFingerprint(user.id);
        onRemoveFP();
      } else {
        await registerFingerprint(user.id, user.name);
        onRegisterFP();
      }
      setFpState('done');
      setTimeout(() => setFpState('idle'), 1500);
    } catch {
      setFpState('error');
      setTimeout(() => setFpState('idle'), 2000);
    }
  };

  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/8 border border-white/8 hover:border-white/15 transition-all"
    >
      {/* Avatar */}
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600/40 to-purple-600/40 border border-white/10 flex items-center justify-center text-sm font-bold text-blue-300 flex-shrink-0">
        {user.name.charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold text-white truncate">{user.name}</p>
          {registered && <FingerprintIcon size={12} className="text-cyan-400 flex-shrink-0" title="Fingerprint registered" />}
        </div>
        <p className="text-xs text-gray-500 truncate">{user.department}</p>
      </div>

      {/* Always-visible actions */}
      <div className="flex items-center gap-1.5">
        {/* Fingerprint button — always visible */}
        {bioAvailable && (
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={handleFP}
            disabled={fpState === 'working'}
            title={registered ? 'Click to remove fingerprint' : 'Click to register fingerprint'}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
              fpState === 'done'  ? 'bg-green-500/30 text-green-400' :
              fpState === 'error' ? 'bg-red-500/30 text-red-400' :
              registered         ? 'bg-cyan-500/20 hover:bg-red-500/25 border border-cyan-500/30 hover:border-red-500/30 text-cyan-400 hover:text-red-400' :
                                   'bg-white/8 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-500/30 text-gray-500 hover:text-cyan-400'
            }`}
          >
            <motion.div animate={fpState === 'working' ? { opacity: [1, 0.3, 1] } : {}} transition={{ duration: 0.8, repeat: Infinity }}>
              <FingerprintIcon size={14} />
            </motion.div>
          </motion.button>
        )}

        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
          onClick={() => onDelete(user.id)}
          className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/30 border border-red-500/15 hover:border-red-500/30 flex items-center justify-center text-red-400 transition-all"
          title="Delete registration"
        >
          <Trash2 size={12} />
        </motion.button>
      </div>
    </motion.div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const RegisterFace = ({ onNavigate }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [modelStatus, setModelStatus] = useState('idle');  // idle | loading | ready | error
  const [modelProgress, setModelProgress] = useState(0);
  const [camStatus, setCamStatus] = useState('idle');       // idle | starting | active | error
  const [camError, setCamError] = useState('');

  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [department, setDepartment] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', message: '' });
  const [facingMode, setFacingMode] = useState('user'); // 'user' | 'environment'
  const fileInputRef = useRef(null);

  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [showRegistered, setShowRegistered] = useState(true);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [justRegistered, setJustRegistered] = useState(null); // { id, name } — prompt fingerprint after face
  const [fpPromptState, setFpPromptState]   = useState('idle'); // idle | working | done | error | skipped

  // Load registered users + check biometric support on mount
  useEffect(() => {
    (async () => {
      setRegisteredUsers(await getRegisteredFaces());
      setBioAvailable(await isBiometricAvailable());
    })();
  }, []);

  // Auto-load models on mount
  useEffect(() => {
    loadModelsAsync();
  }, []);

  // Cleanup webcam on unmount
  useEffect(() => {
    return () => {
      stopWebcam(streamRef.current);
    };
  }, []);

  const loadModelsAsync = async () => {
    setModelStatus('loading');
    try {
      await loadModels(pct => setModelProgress(pct));
      setModelStatus('ready');
    } catch (err) {
      console.error(err);
      setModelStatus('error');
    }
  };

  const startCamera = async () => {
    setCamStatus('starting');
    setCamError('');
    try {
      const stream = await startWebcam(videoRef.current, facingMode);
      streamRef.current = stream;
      setCamStatus('active');
    } catch (err) {
      console.error(err);
      setCamStatus('error');
      if (err.name === 'NotAllowedError') {
        setCamError('Camera access denied. Please allow camera permissions in your browser.');
      } else if (err.name === 'NotFoundError') {
        setCamError('No camera found. Please connect a webcam and try again.');
      } else {
        setCamError(`Camera error: ${err.message}`);
      }
    }
  };

  const stopCamera = () => {
    stopWebcam(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamStatus('idle');
  };

  const toggleCamera = () => {
    const next = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(next);
    if (camStatus === 'active') {
      stopCamera();
      setTimeout(() => startCamera(), 100);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || modelStatus !== 'ready') return;
    if (!name.trim() || !department.trim()) {
      setStatusMsg({ type: 'error', message: 'Name and Department are required.' });
      return;
    }

    setCapturing(true);
    setStatusMsg({ type: 'info', message: 'Processing image…' });

    try {
      const img = new window.Image();
      img.src = URL.createObjectURL(file);
      await new Promise(resolve => { img.onload = resolve; });

      const descriptor = await captureFaceDescriptor(img);
      if (!descriptor) {
        setStatusMsg({ type: 'error', message: 'No face detected in the image.' });
        return;
      }

      const user = await saveRegisteredFace(name.trim(), department.trim(), descriptor, employeeId.trim());
      setRegisteredUsers(await getRegisteredFaces());
      setStatusMsg({ type: 'success', message: `Registered ${user.name} from image!` });
      kagzsoSpeak(`${user.name} has been successfully registered from image.`);
      setName('');
      setEmployeeId('');
      setDepartment('');
    } catch (err) {
      console.error(err);
      setStatusMsg({ type: 'error', message: `Failed: ${err.message}` });
    } finally {
      setCapturing(false);
    }
  };

  const handleCapture = async () => {
    if (!name.trim()) {
      setStatusMsg({ type: 'error', message: 'Please enter a name before capturing.' });
      return;
    }
    if (!department.trim()) {
      setStatusMsg({ type: 'error', message: 'Please enter a department before capturing.' });
      return;
    }
    if (camStatus !== 'active') {
      setStatusMsg({ type: 'error', message: 'Please start the camera first.' });
      return;
    }
    if (modelStatus !== 'ready') {
      setStatusMsg({ type: 'warning', message: 'AI models are still loading. Please wait.' });
      return;
    }

    setCapturing(true);
    setStatusMsg({ type: 'info', message: 'Scanning face… please look at the camera.' });

    try {
      const descriptor = await captureFaceDescriptor(videoRef.current);
      if (!descriptor) {
        setStatusMsg({ type: 'error', message: 'No face detected. Please position your face clearly in the frame.' });
        setCapturing(false);
        return;
      }

      const user = await saveRegisteredFace(name.trim(), department.trim(), descriptor, employeeId.trim());
      setRegisteredUsers(await getRegisteredFaces());
      setStatusMsg({ type: 'success', message: `Successfully registered ${user.name}!` });
      kagzsoSpeak(`${user.name} from ${user.department} has been registered successfully.`);
      setName('');
      setEmployeeId('');
      setDepartment('');
      // Offer fingerprint registration if biometric is available
      if (bioAvailable) {
        setJustRegistered({ id: user.id, name: user.name });
        setFpPromptState('idle');
      }
    } catch (err) {
      console.error(err);
      setStatusMsg({ type: 'error', message: `Registration failed: ${err.message}` });
    } finally {
      setCapturing(false);
    }
  };

  // Fingerprint registration for the newly-registered user
  const handleFpPrompt = async () => {
    if (!justRegistered) return;
    setFpPromptState('working');
    try {
      await registerFingerprint(justRegistered.id, justRegistered.name);
      setFpPromptState('done');
      kagzsoSpeak(`Fingerprint registered for ${justRegistered.name}.`);
      setRegisteredUsers(await getRegisteredFaces());
      setTimeout(() => { setJustRegistered(null); setFpPromptState('idle'); }, 2000);
    } catch {
      setFpPromptState('error');
    }
  };

  const handleDelete = async (id) => {
    const user = registeredUsers.find(u => u.id === id);
    await deleteRegisteredFace(id);
    setRegisteredUsers(await getRegisteredFaces());
    if (user) kagzsoSpeak(`${user.name} has been removed from the system.`);
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center gap-3">
        <motion.button
          whileHover={{ scale: 1.05, x: -2 }}
          whileTap={{ scale: 0.93 }}
          onClick={() => onNavigate('dashboard')}
          className="flex items-center gap-1.5 pl-2 pr-3 py-1.5 rounded-xl
                     bg-white/6 hover:bg-white/12 border border-white/10 hover:border-white/20
                     text-gray-400 hover:text-white transition-all duration-200 group flex-shrink-0"
        >
          <ArrowLeft size={18} className="text-blue-400 group-hover:text-blue-300" />
          <span className="text-sm font-medium">Back</span>
        </motion.button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Register Face</h1>
          <p className="text-sm text-gray-500 mt-0.5">Add a new person to the recognition system</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">

        {/* ── Left: Form + Camera ───────────────────────────────────── */}
        <div className="space-y-5">

          {/* Model loading status */}
          <motion.div variants={itemVariants} className="glass-card p-4">
            <div className="flex items-center gap-3">
              <ShieldCheck size={16} className={modelStatus === 'ready' ? 'text-green-400' : 'text-yellow-400'} />
              <div className="flex-1">
                <p className="text-sm font-medium text-white">
                  {modelStatus === 'idle'    && 'AI Models: Not loaded'}
                  {modelStatus === 'loading' && `Loading AI models… ${modelProgress}%`}
                  {modelStatus === 'ready'   && 'AI Models: Ready'}
                  {modelStatus === 'error'   && 'AI Models: Failed to load'}
                </p>
                {modelStatus === 'loading' && (
                  <div className="mt-2 w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                      animate={{ width: `${modelProgress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                )}
              </div>
              {modelStatus === 'error' && (
                <button onClick={loadModelsAsync} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                  Retry
                </button>
              )}
            </div>
          </motion.div>

          {/* Form */}
          <motion.div variants={itemVariants} className="glass-card p-6 space-y-4">
            <h2 className="text-base font-semibold text-white mb-2">Person Details</h2>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <User size={12} /> Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Alice Johnson"
                className="input-field"
                disabled={capturing}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <User size={12} /> Employee ID
              </label>
              <input
                type="text"
                value={employeeId}
                onChange={e => setEmployeeId(e.target.value)}
                placeholder="e.g. EMP001 (auto-generated if blank)"
                className="input-field"
                disabled={capturing}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 size={12} /> Department
              </label>
              <input
                type="text"
                value={department}
                onChange={e => setDepartment(e.target.value)}
                placeholder="e.g. Engineering"
                className="input-field"
                disabled={capturing}
              />
            </div>

            <StatusBanner type={statusMsg.type} message={statusMsg.message} />
          </motion.div>

          {/* Webcam */}
          <motion.div variants={itemVariants} className="glass-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Camera Feed</h2>
              <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                camStatus === 'active' ? 'bg-green-500/20 text-green-400' :
                camStatus === 'starting' ? 'bg-yellow-500/20 text-yellow-400' :
                camStatus === 'error' ? 'bg-red-500/20 text-red-400' :
                'bg-white/10 text-gray-400'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  camStatus === 'active' ? 'bg-green-400 animate-pulse' :
                  camStatus === 'error' ? 'bg-red-400' :
                  'bg-gray-500'
                }`} />
                {camStatus === 'idle' ? 'Off' : camStatus === 'starting' ? 'Starting…' : camStatus === 'active' ? 'Live' : 'Error'}
              </div>
            </div>

            {/* Video area */}
            <div className="webcam-container aspect-video bg-black/70">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                muted
                playsInline
                autoPlay
              />

              {camStatus !== 'active' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60">
                  <Camera size={40} className="text-gray-600" />
                  {camStatus === 'error'
                    ? <p className="text-red-400 text-sm text-center px-4">{camError}</p>
                    : <p className="text-gray-500 text-sm">Camera not started</p>
                  }
                </div>
              )}

              {/* Scan overlay */}
              {camStatus === 'active' && (
                <>
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-blue-400 rounded-tl" />
                    <div className="absolute top-4 right-4 w-8 h-8 border-r-2 border-t-2 border-blue-400 rounded-tr" />
                    <div className="absolute bottom-4 left-4 w-8 h-8 border-l-2 border-b-2 border-blue-400 rounded-bl" />
                    <div className="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 border-blue-400 rounded-br" />
                  </div>
                  {capturing && (
                    <div className="absolute inset-0 flex items-center justify-center bg-blue-500/10">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 size={36} className="text-blue-400 animate-spin" />
                        <p className="text-blue-400 text-sm font-medium">Scanning…</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Camera controls */}
            <div className="flex gap-3">
              {camStatus !== 'active' ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={startCamera}
                  disabled={camStatus === 'starting'}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {camStatus === 'starting' ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                  {camStatus === 'starting' ? 'Starting Camera…' : 'Start Camera'}
                </motion.button>
              ) : (
                <>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleCapture}
                    disabled={capturing || modelStatus !== 'ready'}
                    className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {capturing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                    {capturing ? 'Capturing…' : 'Capture & Register'}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={stopCamera}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <RotateCcw size={16} />
                    Stop
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={toggleCamera}
                    className="btn-secondary flex items-center gap-2"
                    title="Switch Camera"
                  >
                    <SwitchCamera size={16} />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => fileInputRef.current.click()}
                    className="btn-secondary flex items-center gap-2"
                    title="Upload image"
                  >
                    <FolderOpen size={16} />
                  </motion.button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                  />
                </>
              )}
            </div>
          </motion.div>

          {/* ── Fingerprint prompt after face registration ──────────── */}
          <AnimatePresence>
            {justRegistered && bioAvailable && (
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                className="glass-card p-5 border border-cyan-500/25 bg-cyan-500/5"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
                    <FingerprintIcon size={20} className="text-cyan-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-semibold text-sm">Register Fingerprint?</p>
                    <p className="text-gray-400 text-xs mt-0.5">
                      <span className="text-cyan-300 font-medium">{justRegistered.name}</span> was registered successfully.
                      Add a fingerprint now for faster attendance.
                    </p>
                  </div>
                  <button
                    onClick={() => { setJustRegistered(null); setFpPromptState('idle'); }}
                    className="text-gray-600 hover:text-gray-400 transition-colors flex-shrink-0"
                    title="Skip"
                  ><X size={15} /></button>
                </div>

                <div className="flex gap-2 mt-4">
                  <motion.button
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={handleFpPrompt}
                    disabled={fpPromptState === 'working' || fpPromptState === 'done'}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      fpPromptState === 'done'    ? 'bg-green-500/25 border border-green-500/30 text-green-400' :
                      fpPromptState === 'error'   ? 'bg-red-500/20 border border-red-500/30 text-red-400' :
                      fpPromptState === 'working' ? 'bg-cyan-500/15 border border-cyan-500/25 text-cyan-400' :
                                                    'bg-cyan-600 hover:bg-cyan-500 text-white'
                    }`}
                  >
                    {fpPromptState === 'working' && <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }}><FingerprintIcon size={16} /></motion.div>}
                    {fpPromptState === 'done'    && <CheckCircle size={16} />}
                    {fpPromptState === 'error'   && <AlertCircle size={16} />}
                    {fpPromptState === 'idle'    && <FingerprintIcon size={16} />}
                    {fpPromptState === 'working' ? 'Scanning fingerprint…' :
                     fpPromptState === 'done'    ? 'Fingerprint registered!' :
                     fpPromptState === 'error'   ? 'Failed — try again' :
                                                   'Register Fingerprint'}
                  </motion.button>
                  {fpPromptState !== 'done' && (
                    <motion.button
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      onClick={() => { setJustRegistered(null); setFpPromptState('idle'); }}
                      className="px-4 py-2.5 rounded-xl btn-secondary text-sm"
                    >
                      Skip
                    </motion.button>
                  )}
                </div>
                {fpPromptState === 'error' && (
                  <p className="text-red-400/80 text-xs mt-2 text-center">
                    Biometric prompt was cancelled or failed. You can register it later from the user list.
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Right: Registered users list ─────────────────────────── */}
        <motion.div variants={itemVariants} className="glass-card p-6 space-y-4 h-fit">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Registered Users</h2>
              <p className="text-xs text-gray-500 mt-0.5">{registeredUsers.length} person{registeredUsers.length !== 1 ? 's' : ''} registered</p>
            </div>
            <button
              onClick={() => setShowRegistered(p => !p)}
              className="text-gray-500 hover:text-gray-300 transition-colors"
              title={showRegistered ? 'Hide list' : 'Show list'}
            >
              {showRegistered ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <AnimatePresence>
            {showRegistered && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2 max-h-[60vh] overflow-y-auto pr-1"
              >
                {registeredUsers.length === 0 ? (
                  <div className="flex flex-col items-center py-10 text-center">
                    <UserPlus size={32} className="text-gray-700 mb-3" />
                    <p className="text-gray-500 text-sm">No users registered yet</p>
                    <p className="text-gray-600 text-xs mt-1">Fill the form and capture a face to get started</p>
                  </div>
                ) : (
                  <AnimatePresence>
                    {registeredUsers.map(user => (
                      <UserCard key={user.id} user={user} onDelete={handleDelete}
                        bioAvailable={bioAvailable}
                        onRegisterFP={() => getRegisteredFaces().then(setRegisteredUsers)}
                        onRemoveFP={() => getRegisteredFaces().then(setRegisteredUsers)}
                      />
                    ))}
                  </AnimatePresence>
                )}
              </motion.div>
            )}
          </AnimatePresence>


        </motion.div>
      </div>
    </motion.div>
  );
};

export default RegisterFace;
