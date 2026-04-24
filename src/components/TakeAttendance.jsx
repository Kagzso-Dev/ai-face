import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, CheckCircle, AlertCircle, Loader2, Play, Square, Users, Clock, ShieldCheck,
  Zap, RefreshCw, SwitchCamera, ArrowLeft,
} from 'lucide-react';
import { kagzsoSpeak } from './KagzsoChat';
import {
  loadModels, detectFaces, buildFaceMatcher,
  drawDetections, startWebcam, stopWebcam, areModelsLoaded,
} from '../utils/faceUtils';
import {
  getRegisteredFaces, markAttendance,
  getAttendanceRecords,
  checkAttendanceWindow, autoMarkAbsents,
} from '../utils/storageUtils';
import {
  isBiometricAvailable, hasFingerprint,
  verifyFingerprint, getUsersWithFingerprint,
} from '../utils/biometricUtils';


// ── Fingerprint SVG icon ───────────────────────────────────────────────────
const FingerprintIcon = ({ size = 20, className = '' }) => (
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
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

// ─── Detection Result Item ────────────────────────────────────────────────────
const DetectionItem = ({ result, isNew }) => (
  <motion.div
    layout
    initial={{ opacity: 0, x: 20, scale: 0.95 }}
    animate={{ opacity: 1, x: 0, scale: 1 }}
    exit={{ opacity: 0, x: -20, scale: 0.95 }}
    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
      result.status === 'marked'
        ? 'bg-green-500/10 border-green-500/25'
        : result.status === 'duplicate'
        ? 'bg-blue-500/10 border-blue-500/25'
        : result.status === 'recognized'
        ? 'bg-yellow-500/10 border-yellow-500/25'
        : result.status === 'blocked'
        ? 'bg-orange-500/10 border-orange-500/25'
        : 'bg-red-500/10 border-red-500/25'
    }`}
  >
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold ${
      result.status === 'marked' ? 'bg-green-500/20 text-green-400' :
      result.status === 'duplicate' ? 'bg-blue-500/20 text-blue-400' :
      result.status === 'recognized' ? 'bg-yellow-500/20 text-yellow-400' :
      'bg-red-500/20 text-red-400'
    }`}>
      {result.name !== 'Unknown' ? result.name.charAt(0).toUpperCase() : '?'}
    </div>

    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-white truncate">{result.name}</p>
      {result.department && <p className="text-xs text-gray-500">{result.department}</p>}
      {result.time && <p className="text-xs text-gray-600">Marked at {result.time}</p>}
    </div>

    <div>
      {result.status === 'marked' && (
        <div className="flex flex-col items-end gap-1">
          <span className={result.attendStatus === 'late'
            ? 'status-badge bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1'
            : 'status-recognized'}>
            <CheckCircle size={12} /> {result.attendStatus === 'late' ? 'Late' : 'Marked'}
          </span>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
            result.punchType === 'out'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
              : 'bg-green-500/20 text-green-300 border border-green-500/30'
          }`}>
            {result.punchType === 'out' ? '↑ OUT' : '↓ IN'}
          </span>
        </div>
      )}
      {result.status === 'duplicate' && (
        <span className="status-badge bg-blue-500/20 text-blue-400 border border-blue-500/30">
          <Clock size={12} /> Already Present
        </span>
      )}
      {result.status === 'recognized' && (
        <span className="status-processing">
          <Zap size={12} /> Detected
        </span>
      )}
      {result.status === 'unknown' && (
        <span className="status-unknown">
          <AlertCircle size={12} /> Unknown
        </span>
      )}
    </div>
  </motion.div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const TakeAttendance = ({ onNavigate, role }) => {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef    = useRef(null);
  const matcherRef = useRef(null);
  const usersRef   = useRef([]);
  const spokenRef  = useRef({}); // { userId: lastSpokenMs } — throttle per-person
  const unknownSpokenRef = useRef(0); // last time unknown was announced
  // Local cache of user IDs marked present today — avoids per-frame API calls
  const markedTodayRef = useRef(new Set());

  const [modelStatus, setModelStatus] = useState('idle');
  const [modelProgress, setModelProgress] = useState(0);
  const [camStatus, setCamStatus] = useState('idle');
  const [camError, setCamError] = useState('');
  const [scanning, setScanning] = useState(false);

  const [detectionLog, setDetectionLog] = useState([]);
  const [liveResults, setLiveResults] = useState([]);
  const [todayCount, setTodayCount] = useState(0);
  const [fps, setFps] = useState(0);

  // Fingerprint attendance
  const [activeTab, setActiveTab] = useState('camera'); // 'camera' | 'fingerprint'
  const [bioAvailable, setBioAvailable] = useState(false);
  const [fpUsers, setFpUsers] = useState([]);
  const [fpStatus, setFpStatus] = useState({});
  const [facingMode, setFacingMode] = useState('user'); // 'user' | 'environment'
  const fileInputRef = useRef(null);
  const [windowBlock, setWindowBlock] = useState({ allowed: true, reason: '', activeWindow: null, justClosedWindow: null });
  const windowBlockRef = useRef(windowBlock);

  // Re-check time window every minute; auto-mark absent when a window closes
  useEffect(() => {
    const tick = async () => {
      const prev = windowBlockRef.current;
      const result = await checkAttendanceWindow();

      // Detect window just closed with lateAbsent enabled
      if (result.justClosedWindow) {
        const count = await autoMarkAbsents(result.justClosedWindow.label);
        if (count > 0) {
          await refreshTodayCount();
          kagzsoSpeak(`The ${result.justClosedWindow.label} attendance window has closed. ${count} ${count === 1 ? 'person has' : 'people have'} been marked absent.`);
        }
      }

      // Announce when window opens
      if (!prev?.allowed && result.allowed && result.activeWindow) {
        kagzsoSpeak(`The ${result.activeWindow.label} attendance window is now open. Please mark your attendance.`);
      }

      setWindowBlock(result);
      windowBlockRef.current = result;
    };
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);

  // Voice


  // Refresh today count + populate markedTodayRef from DB
  const refreshTodayCount = useCallback(async () => {
    const today   = new Date().toISOString().split('T')[0];
    const records = await getAttendanceRecords();
    const todayPresent = records.filter(r => r.date === today && (r.status === 'present' || r.status === 'late'));
    markedTodayRef.current = new Set(todayPresent.map(r => r.userId));
    setTodayCount(todayPresent.length);
  }, []);

  // Refresh fingerprint-enabled users list
  const refreshFpUsers = useCallback(async () => {
    const ids = getUsersWithFingerprint();
    const all = await getRegisteredFaces();
    setFpUsers(all.filter(u => ids.includes(u.id)));
  }, []);

  useEffect(() => {
    (async () => {
      await refreshTodayCount();
      const firstCheck = await checkAttendanceWindow();
      setWindowBlock(firstCheck);
      windowBlockRef.current = firstCheck;
      
      const ok = await isBiometricAvailable();
      setBioAvailable(ok);
      if (ok) await refreshFpUsers();
    })();
  }, []);

  // Load models on mount
  useEffect(() => {
    (async () => {
      if (areModelsLoaded()) { setModelStatus('ready'); return; }
      setModelStatus('loading');
      try {
        await loadModels(pct => setModelProgress(pct));
        setModelStatus('ready');
        kagzsoSpeak("The AI Engine is now ready. You can start the scanner.");
      } catch (err) {
        setModelStatus('error');
        console.error(err);
      }
    })();
  }, []);

  // Build / rebuild matcher whenever users change
  const rebuildMatcher = useCallback(async () => {
    const users = await getRegisteredFaces();
    usersRef.current = users;
    matcherRef.current = buildFaceMatcher(users);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScan();
      stopWebcam(streamRef.current);
    };
  }, []);

  const startCamera = async () => {
    setCamStatus('starting');
    setCamError('');
    try {
      const stream = await startWebcam(videoRef.current, facingMode);
      streamRef.current = stream;
      setCamStatus('active');
    } catch (err) {
      setCamStatus('error');
      if (err.name === 'NotAllowedError') {
        setCamError('Camera permission denied. Please allow camera access.');
      } else if (err.name === 'NotFoundError') {
        setCamError('No camera detected. Please connect a webcam.');
      } else {
        setCamError(`Camera error: ${err.message}`);
      }
    }
  };

  const stopCamera = () => {
    stopScan();
    stopWebcam(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
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



  // ─── Detection Loop ──────────────────────────────────────────────────────
  const stopScan = () => {
    setScanning(false);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const startScan = async () => {
    if (modelStatus !== 'ready') return;
    await rebuildMatcher();
    setScanning(true);
    setLiveResults([]);

    let lastTime = performance.now();
    let frameCount = 0;

    const loop = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      try {
        const detections = await detectFaces(videoRef.current);
        const results = drawDetections(
          videoRef.current,
          canvasRef.current,
          detections,
          usersRef.current,
          matcherRef.current
        );

        // Process recognized faces → mark attendance
        const tsNow = Date.now();
        const enriched = await Promise.all(results.map(async r => {
          // Block if outside allowed time window
          if (!windowBlockRef.current.allowed) {
            return { ...r, status: 'blocked' };
          }
          if (r.userId) {
            const already = markedTodayRef.current.has(r.userId);
            if (!already) {
              const attendStatus = windowBlockRef.current.isLate ? 'late' : 'present';
              const punchType    = windowBlockRef.current.windowType || 'in';
              const record = await markAttendance(
                usersRef.current.find(u => u.id === r.userId),
                attendStatus,
                punchType
              );
              if (record) {
                markedTodayRef.current.add(r.userId);
                setTodayCount(markedTodayRef.current.size);
                const entry = {
                  ...r,
                  status: 'marked',
                  attendStatus,
                  punchType,
                  time: record.time,
                  id: record.id,
                };
                setDetectionLog(prev => {
                  if (prev.find(p => p.userId === r.userId)) return prev;
                  return [entry, ...prev].slice(0, 30);
                });
                // Speak once per person — no repeat within 60s
                if (!spokenRef.current[r.userId] || tsNow - spokenRef.current[r.userId] > 60000) {
                  spokenRef.current[r.userId] = tsNow;
                  const hour = new Date().getHours();
                  const g = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
                  const msg = attendStatus === 'late'
                    ? `${g}, ${r.name}. Your attendance has been marked as late.`
                    : `${g}, ${r.name}. Your attendance has been marked successfully.`;
                  kagzsoSpeak(msg);
                }
                return entry;
              }
            }
            // Already marked — announce once per 60s per person
            if (!spokenRef.current[`dup_${r.userId}`] || tsNow - spokenRef.current[`dup_${r.userId}`] > 60000) {
              spokenRef.current[`dup_${r.userId}`] = tsNow;
              kagzsoSpeak(`${r.name}, you are already marked present today.`);
            }
            return { ...r, status: 'duplicate' };
          }
          // Unknown face — announce once per 15s
          if (!unknownSpokenRef.current || tsNow - unknownSpokenRef.current > 15000) {
            unknownSpokenRef.current = tsNow;
            kagzsoSpeak("Unknown face detected. Please register to take attendance.");
          }
          return { ...r, status: 'unknown' };
        }));

        setLiveResults(enriched);

        // FPS counter
        frameCount++;
        const now = performance.now();
        if (now - lastTime >= 1000) {
          setFps(Math.round(frameCount * 1000 / (now - lastTime)));
          frameCount = 0;
          lastTime = now;
        }
      } catch (err) {
        console.warn('Detection frame error:', err);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
  };

  // Mark attendance via fingerprint for a specific user
  const handleFingerprintAttendance = async (user) => {
    const win = await checkAttendanceWindow();
    if (!win.allowed) {
      kagzsoSpeak(`Sorry ${user.name}, attendance is not open right now. ${win.reason}`);
      return;
    }
    setFpStatus(s => ({ ...s, [user.id]: 'scanning' }));
    try {
      await verifyFingerprint(user.id);
      if (markedTodayRef.current.has(user.id)) {
        setFpStatus(s => ({ ...s, [user.id]: 'duplicate' }));
        kagzsoSpeak(`${user.name}, you have already been marked present today.`);
      } else {
        const record = await markAttendance(user);
        if (record) {
          markedTodayRef.current.add(user.id);
          setTodayCount(markedTodayRef.current.size);
          setDetectionLog(prev => [
            { ...user, status: 'marked', time: record.time, id: record.id },
            ...prev,
          ].slice(0, 30));
          const hour = new Date().getHours();
          const g = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
          kagzsoSpeak(`${g}, ${user.name}. Your attendance is recorded.`);
          setFpStatus(s => ({ ...s, [user.id]: 'success' }));
        }
      }
    } catch {
      setFpStatus(s => ({ ...s, [user.id]: 'error' }));
    }
    setTimeout(() => setFpStatus(s => ({ ...s, [user.id]: 'idle' })), 2500);
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {role === 'admin' && onNavigate && (
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
          )}
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Take Attendance</h1>
            <p className="text-sm text-gray-500 mt-0.5">Real-time face recognition</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-sm">
            <Users size={14} className="text-blue-400" />
            <span className="text-white font-semibold">{todayCount}</span>
            <span className="text-gray-500">present today</span>
          </div>
          {scanning && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-green-500/15 border border-green-500/25 text-xs text-green-400 font-medium">
              <Zap size={12} className="animate-pulse" />
              {fps} FPS
            </div>
          )}

        </div>
      </motion.div>

      {/* ── Time Window Banner ────────────────────────────────────────── */}
      <AnimatePresence>
        {!windowBlock.allowed && (
          <motion.div
            key="win-block"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-start gap-3 p-4 rounded-xl bg-orange-500/10 border border-orange-500/25"
          >
            <Clock size={16} className="text-orange-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-orange-300">Attendance Window Closed</p>
              <p className="text-xs text-orange-400/80 mt-0.5">{windowBlock.reason}</p>
            </div>
          </motion.div>
        )}
        {windowBlock.allowed && windowBlock.activeWindow && (
          <motion.div
            key="win-open"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 p-3 rounded-xl bg-green-500/8 border border-green-500/20"
          >
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
            <p className="text-xs text-green-400 font-medium">
              {windowBlock.activeWindow.label} window open — attendance accepted
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mode Tabs ─────────────────────────────────────────────────── */}
      {bioAvailable && (
        <motion.div variants={itemVariants} className="flex gap-2">
          {[
            { id: 'camera',      label: 'Camera',      icon: <Camera size={14} /> },
            { id: 'fingerprint', label: 'Fingerprint', icon: <FingerprintIcon size={14} /> },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-blue-600/30 border border-blue-500/40 text-white'
                  : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/8'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </motion.div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6">

        {/* ── Camera Column ─────────────────────────────────────────── */}
        <div className={`xl:col-span-2 space-y-4 ${activeTab === 'fingerprint' ? 'hidden xl:hidden' : ''}`}
          style={{ display: activeTab === 'fingerprint' ? 'none' : undefined }}
        >

          {/* Model status */}
          <motion.div variants={itemVariants} className="glass-card p-4">
            <div className="flex items-center gap-3">
              <ShieldCheck size={16} className={
                modelStatus === 'ready' ? 'text-green-400' :
                modelStatus === 'error' ? 'text-red-400' : 'text-yellow-400'
              } />
              <div className="flex-1">
                <p className="text-sm font-medium text-white">
                  {modelStatus === 'idle'    && 'Initializing…'}
                  {modelStatus === 'loading' && `Loading models… ${modelProgress}%`}
                  {modelStatus === 'ready'   && 'AI Engine ready'}
                  {modelStatus === 'error'   && 'Failed to load models'}
                </p>
                {modelStatus === 'loading' && (
                  <div className="mt-1.5 w-full bg-white/10 rounded-full h-1 overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                      animate={{ width: `${modelProgress}%` }}
                    />
                  </div>
                )}
              </div>
              {usersRef.current.length === 0 && modelStatus === 'ready' && (
                <span className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-2 py-1 rounded-lg">
                  No faces registered
                </span>
              )}
            </div>
          </motion.div>

          {/* Webcam */}
          <motion.div variants={itemVariants} className="glass-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Live Camera</h2>
              <div className="flex items-center gap-2">
                {scanning && (
                  <span className="flex items-center gap-1.5 text-xs text-green-400 bg-green-500/15 border border-green-500/25 px-2.5 py-1 rounded-full font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    Scanning
                  </span>
                )}
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                  camStatus === 'active' ? 'bg-green-500/20 text-green-400' :
                  camStatus === 'error'  ? 'bg-red-500/20 text-red-400' :
                  'bg-white/10 text-gray-400'
                }`}>
                  {camStatus === 'idle' ? 'Offline' :
                   camStatus === 'starting' ? 'Starting…' :
                   camStatus === 'active' ? 'Live' : 'Error'}
                </span>
              </div>
            </div>

            {/* Video + canvas overlay */}
            <div className="webcam-container aspect-video bg-black/70">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                muted
                playsInline
                autoPlay
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full"
              />

              {camStatus !== 'active' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70">
                  <Camera size={48} className="text-gray-700" />
                  {camStatus === 'error'
                    ? <p className="text-red-400 text-sm text-center px-6">{camError}</p>
                    : <p className="text-gray-500 text-sm">Start the camera to begin</p>
                  }
                </div>
              )}

              {/* Corner frame */}
              {camStatus === 'active' && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-3 left-3 w-8 h-8 border-l-2 border-t-2 border-blue-500/60 rounded-tl" />
                  <div className="absolute top-3 right-3 w-8 h-8 border-r-2 border-t-2 border-blue-500/60 rounded-tr" />
                  <div className="absolute bottom-3 left-3 w-8 h-8 border-l-2 border-b-2 border-blue-500/60 rounded-bl" />
                  <div className="absolute bottom-3 right-3 w-8 h-8 border-r-2 border-b-2 border-blue-500/60 rounded-br" />
                  {/* Scan line */}
                  {scanning && (
                    <motion.div
                      className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400/60 to-transparent"
                      animate={{ top: ['5%', '95%', '5%'] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex flex-wrap gap-3">
              {camStatus !== 'active' ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={startCamera}
                  disabled={camStatus === 'starting' || modelStatus !== 'ready'}
                  className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {camStatus === 'starting'
                    ? <Loader2 size={16} className="animate-spin" />
                    : <Camera size={16} />}
                  {camStatus === 'starting' ? 'Starting…' : 'Start Camera'}
                </motion.button>
              ) : (
                <>
                  {!scanning ? (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={startScan}
                      disabled={modelStatus !== 'ready'}
                      className="btn-primary flex items-center gap-2 disabled:opacity-50"
                    >
                      <Play size={16} />
                      Start Scanning
                    </motion.button>
                  ) : (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={stopScan}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 text-yellow-400 font-semibold transition-all"
                    >
                      <Square size={16} />
                      Pause Scanning
                    </motion.button>
                  )}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={stopCamera}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <Square size={16} />
                    Stop Camera
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={toggleCamera}
                    className="btn-secondary flex items-center gap-2"
                    title="Switch Camera (Front/Back)"
                  >
                    <SwitchCamera size={16} />
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={rebuildMatcher}
                    className="btn-secondary flex items-center gap-2"
                    title="Refresh registered faces"
                  >
                    <RefreshCw size={15} />
                  </motion.button>
                </>
              )}
            </div>

            {/* Live detection results */}
            {liveResults.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Detected in frame ({liveResults.length})
                </p>
                <AnimatePresence>
                  {liveResults.map((r, i) => (
                    <DetectionItem key={`live_${i}`} result={r} />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        </div>

        {/* ── Fingerprint Panel ─────────────────────────────────────── */}
        {activeTab === 'fingerprint' && (
          <motion.div key="fp-panel" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="xl:col-span-2 glass-card p-6 space-y-5"
          >
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <FingerprintIcon size={16} className="text-cyan-400" /> Fingerprint Attendance
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">Tap your name then scan your fingerprint</p>
            </div>

            {fpUsers.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <FingerprintIcon size={40} className="text-gray-700 mb-3" />
                <p className="text-gray-400 text-sm font-medium">No fingerprints registered</p>
                <p className="text-gray-600 text-xs mt-1">
                  Go to Register Face → hover a user → click the fingerprint icon
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {fpUsers.map(user => {
                  const st = fpStatus[user.id] || 'idle';
                  const alreadyDone = markedTodayRef.current.has(user.id);
                  return (
                    <motion.button key={user.id}
                      whileHover={st === 'idle' ? { scale: 1.02 } : {}}
                      whileTap={st === 'idle' ? { scale: 0.97 } : {}}
                      onClick={() => st === 'idle' && handleFingerprintAttendance(user)}
                      disabled={st !== 'idle'}
                      className={`flex items-center gap-4 p-4 rounded-xl border text-left transition-all duration-300 ${
                        st === 'success'   ? 'bg-green-500/15 border-green-500/30' :
                        st === 'duplicate' ? 'bg-blue-500/15 border-blue-500/30' :
                        st === 'error'     ? 'bg-red-500/15 border-red-500/30' :
                        st === 'scanning'  ? 'bg-cyan-500/10 border-cyan-500/30 animate-pulse' :
                        alreadyDone        ? 'bg-white/5 border-green-500/20 opacity-60' :
                                             'bg-white/5 border-white/10 hover:border-cyan-500/40 hover:bg-cyan-500/5'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0 ${
                        st === 'success'  ? 'bg-green-500/20 text-green-300' :
                        st === 'scanning' ? 'bg-cyan-500/20 text-cyan-300' :
                        st === 'error'    ? 'bg-red-500/20 text-red-300' :
                        'bg-gradient-to-br from-blue-600/40 to-purple-600/40 text-blue-300'
                      }`}>
                        {st === 'success'   ? <CheckCircle size={22} /> :
                         st === 'duplicate' ? <Clock size={22} className="text-blue-300" /> :
                         st === 'error'     ? <AlertCircle size={22} /> :
                         st === 'scanning'  ? <FingerprintIcon size={22} className="text-cyan-400" /> :
                         user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                        <p className="text-xs text-gray-500 truncate">{user.department}</p>
                        <p className={`text-xs mt-0.5 font-medium ${
                          st === 'success'   ? 'text-green-400' :
                          st === 'duplicate' ? 'text-blue-400' :
                          st === 'error'     ? 'text-red-400' :
                          st === 'scanning'  ? 'text-cyan-400' :
                          alreadyDone        ? 'text-green-500/70' : 'text-gray-600'
                        }`}>
                          {st === 'scanning'  ? 'Scan fingerprint…' :
                           st === 'success'   ? 'Marked!' :
                           st === 'duplicate' ? 'Already present today' :
                           st === 'error'     ? 'Not recognised' :
                           alreadyDone        ? '✓ Present today' : 'Tap to scan'}
                        </p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}

            <button onClick={refreshFpUsers}
              className="text-xs text-gray-600 hover:text-gray-400 flex items-center gap-1.5 transition-colors">
              <RefreshCw size={11} /> Refresh list
            </button>
          </motion.div>
        )}

        {/* ── Log Column ────────────────────────────────────────────── */}
        <motion.div variants={itemVariants} className="space-y-4">

          {/* Today's log */}
          <div className="glass-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Session Log</h3>
              {detectionLog.length > 0 && (
                <button
                  onClick={() => setDetectionLog([])}
                  className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {detectionLog.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <Clock size={24} className="text-gray-700 mb-2" />
                  <p className="text-xs text-gray-600">No records yet</p>
                </div>
              ) : (
                <AnimatePresence>
                  {detectionLog.map((entry, i) => (
                    <DetectionItem key={entry.id || i} result={entry} />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default TakeAttendance;
