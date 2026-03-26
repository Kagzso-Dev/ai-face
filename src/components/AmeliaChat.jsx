/**
 * Amelia — Speaking AI Avatar
 * A persistent animated avatar that speaks aloud using Web Speech API.
 * Her mouth animates when speaking. Subtitles shown below.
 * Triggered by custom DOM events from voiceUtils + App-level events.
 */
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, ChevronDown, ChevronUp } from 'lucide-react';
import { loadVoiceSettings, isSpeechSupported, getVoices } from '../utils/voiceUtils';

// ── Global speak-via-Amelia ────────────────────────────────────────────────────
export const ameliaSpeak = (text) => {
  window.dispatchEvent(new CustomEvent('amelia:speak', { detail: { text } }));
};

// ── Animated SVG Face ─────────────────────────────────────────────────────────
const AmeliaFace = ({ talking, blinking, size = 120 }) => {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 120 120"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      <defs>
        {/* Outer glow */}
        <radialGradient id="ag-bg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#1e1b4b" stopOpacity="0" />
        </radialGradient>
        {/* Skin */}
        <radialGradient id="ag-skin" cx="50%" cy="38%" r="56%">
          <stop offset="0%" stopColor="#fde8cf" />
          <stop offset="100%" stopColor="#f5c08a" />
        </radialGradient>
        {/* Iris */}
        <radialGradient id="ag-iris" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </radialGradient>
        {/* Hair */}
        <linearGradient id="ag-hair" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#312e81" />
          <stop offset="100%" stopColor="#1e1b4b" />
        </linearGradient>
        {/* Hologram ring */}
        <filter id="ag-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <clipPath id="ag-circle">
          <circle cx="60" cy="60" r="56" />
        </clipPath>
      </defs>

      {/* Background glow disc */}
      <circle cx="60" cy="60" r="58" fill="url(#ag-bg)" />

      {/* Hologram ring */}
      <circle cx="60" cy="60" r="56" fill="none"
        stroke="#7c3aed" strokeWidth="1" strokeOpacity="0.5"
        strokeDasharray="8 4" filter="url(#ag-glow)"
      />

      {/* Clipped content */}
      <g clipPath="url(#ag-circle)">
        {/* Shoulder / clothes */}
        <ellipse cx="60" cy="116" rx="40" ry="14" fill="#4c1d95" />
        <path d="M20 116 Q30 100 50 96 Q60 94 70 96 Q90 100 100 116 Z" fill="#6d28d9" />

        {/* Neck */}
        <rect x="52" y="88" width="16" height="16" rx="6" fill="url(#ag-skin)" />

        {/* Head */}
        <ellipse cx="60" cy="58" rx="30" ry="34" fill="url(#ag-skin)" />

        {/* Hair — back */}
        <ellipse cx="60" cy="26" rx="30" ry="12" fill="url(#ag-hair)" />

        {/* Side hair left */}
        <ellipse cx="31" cy="50" rx="8" ry="24" fill="url(#ag-hair)" />
        {/* Side hair right */}
        <ellipse cx="89" cy="50" rx="8" ry="24" fill="url(#ag-hair)" />

        {/* Hair top */}
        <ellipse cx="60" cy="24" rx="28" ry="10" fill="#4338ca" />

        {/* ── Left eye ── */}
        <ellipse cx="45" cy="52" rx="7" ry={blinking ? 0.6 : 5.5} fill="white" />
        {!blinking && <>
          <circle cx="45" cy="52" r="4" fill="url(#ag-iris)" />
          <circle cx="45" cy="52" r="2.2" fill="#0c0a1e" />
          <circle cx="46.4" cy="50.5" r="1" fill="white" opacity="0.9" />
        </>}
        {/* Lash left */}
        <path d="M38 50 Q45 46 52 50" stroke="#1e1b4b" strokeWidth="1.4"
          fill="none" strokeLinecap="round" />

        {/* ── Right eye ── */}
        <ellipse cx="75" cy="52" rx="7" ry={blinking ? 0.6 : 5.5} fill="white" />
        {!blinking && <>
          <circle cx="75" cy="52" r="4" fill="url(#ag-iris)" />
          <circle cx="75" cy="52" r="2.2" fill="#0c0a1e" />
          <circle cx="76.4" cy="50.5" r="1" fill="white" opacity="0.9" />
        </>}
        {/* Lash right */}
        <path d="M68 50 Q75 46 82 50" stroke="#1e1b4b" strokeWidth="1.4"
          fill="none" strokeLinecap="round" />

        {/* Eyebrows */}
        <path d="M37 44 Q45 40 53 43" stroke="#3730a3" strokeWidth="1.6"
          fill="none" strokeLinecap="round" />
        <path d="M67 43 Q75 40 83 44" stroke="#3730a3" strokeWidth="1.6"
          fill="none" strokeLinecap="round" />

        {/* Nose bridge + tip */}
        <path d="M58 60 Q57 64 55 67 Q58 69 60 69 Q62 69 65 67 Q63 64 62 60"
          fill="#d4956a" fillOpacity="0.22" />
        <ellipse cx="56" cy="68" rx="2" ry="1.3" fill="#c47840" fillOpacity="0.4" />
        <ellipse cx="64" cy="68" rx="2" ry="1.3" fill="#c47840" fillOpacity="0.4" />



        {/* ── Mouth — lower third: ~80% down the face ── */}

        {/* Mouth cavity — opens/closes during speech */}
        <motion.ellipse
          cx="60" cy="81" rx="6.5" ry="0.4"
          fill="#3a0808"
          initial={{ ry: 0.4 }}
          animate={talking
            ? { ry: [0.4, 3.8, 1, 4.5, 0.6, 3.2, 1.4, 4, 0.5, 2.8, 0.4] }
            : { ry: 0.4 }
          }
          transition={talking
            ? { duration: 1.0, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0.12 }
          }
        />
        {/* Teeth */}
        <motion.ellipse
          cx="60" cy="79.5" rx="5" ry="0"
          fill="white" fillOpacity="0.9"
          initial={{ ry: 0 }}
          animate={talking
            ? { ry: [0, 2, 0.4, 2.5, 0.2, 1.6, 0.6, 2.2, 0.1, 1.4, 0] }
            : { ry: 0 }
          }
          transition={talking
            ? { duration: 1.0, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0.12 }
          }
        />

        {/* Lower lip */}
        <path d="M53 81 Q60 87.5 67 81 Q63 85 60 85.5 Q57 85 53 81 Z"
          fill="#c04060" />
        <path d="M53 81 Q60 87.5 67 81"
          stroke="#903050" strokeWidth="0.5" fill="none" />

        {/* Upper lip — cupid's bow */}
        <path d="M53 81 Q55 76 58 77 Q60 75 62 77 Q65 76 67 81 Q63 79 60 79.5 Q57 79 53 81 Z"
          fill="#b03055" />
        {/* Bow highlight */}
        <path d="M55 78 Q58 75.5 60 76.5 Q62 75.5 65 78"
          stroke="#d05075" strokeWidth="0.8" fill="none" strokeLinecap="round" />
        {/* Lip join line */}
        <path d="M57 79.5 Q60 78.5 63 79.5"
          stroke="#7a1830" strokeWidth="0.7" fill="none" strokeLinecap="round" />

        {/* Cheeks */}
        <ellipse cx="35" cy="62" rx="6" ry="3.5" fill="#f472b6" fillOpacity="0.22" />
        <ellipse cx="85" cy="62" rx="6" ry="3.5" fill="#f472b6" fillOpacity="0.22" />
      </g>

      {/* Hologram scan line */}
      {talking && (
        <motion.line
          x1="4" y1="60" x2="116" y2="60"
          stroke="#7c3aed" strokeWidth="0.6" strokeOpacity="0.5"
          initial={{ y1: 60, y2: 60 }}
          animate={{ y1: [10, 110, 10], y2: [10, 110, 10] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
        />
      )}
    </svg>
  );
};

// ── Sound wave bars ───────────────────────────────────────────────────────────
const SoundWave = ({ active }) => (
  <div className="flex items-center gap-[3px] h-5">
    {[0.6, 1, 0.75, 1, 0.5, 0.85, 0.65].map((h, i) => (
      <motion.div
        key={i}
        className="w-[3px] rounded-full bg-violet-400"
        animate={active
          ? { scaleY: [h * 0.4, h, h * 0.6, h * 0.9, h * 0.4], opacity: [0.6, 1, 0.7, 1, 0.6] }
          : { scaleY: 0.15, opacity: 0.3 }
        }
        style={{ height: 20, originY: 0.5 }}
        transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.09, ease: 'easeInOut' }}
      />
    ))}
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────────
const AmeliaChat = () => {
  const [talking, setTalking] = useState(false);
  const [blinking, setBlinking] = useState(false);
  const [subtitle, setSubtitle] = useState('');
  const [muted, setMuted] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [visible, setVisible] = useState(true);
  const mutedRef = useRef(false);

  // ── Core speak engine ────────────────────────────────────────────────────
  const doSpeak = async (text) => {
    if (!isSpeechSupported() || mutedRef.current) {
      setSubtitle(text);
      setTalking(true);
      setTimeout(() => { setTalking(false); setSubtitle(''); }, Math.min(text.length * 55, 4000));
      return;
    }
    const settings = loadVoiceSettings();
    window.speechSynthesis.cancel();

    const voices = await getVoices();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = settings.lang || 'en-US';
    utter.rate = settings.rate || 1.0;
    utter.pitch = settings.pitch || 1.1;
    utter.volume = mutedRef.current ? 0 : (settings.volume || 1.0);

    // Pick a female voice if available
    const femaleKeywords = ['female', 'woman', 'girl', 'zira', 'samantha', 'victoria', 'karen', 'moira', 'tessa', 'fiona', 'susan'];
    const femaleVoice =
      voices.find(v => v.lang === utter.lang && femaleKeywords.some(k => v.name.toLowerCase().includes(k))) ||
      voices.find(v => v.lang === utter.lang) ||
      voices.find(v => v.lang.startsWith(utter.lang.split('-')[0])) ||
      null;
    if (femaleVoice) utter.voice = femaleVoice;

    utter.onstart = () => { setTalking(true); setSubtitle(text); };
    utter.onend = () => { setTalking(false); setSubtitle(''); };
    utter.onerror = () => { setTalking(false); setSubtitle(''); };

    window.speechSynthesis.speak(utter);
  };

  // ── Listen for custom events ─────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => doSpeak(e.detail.text);
    window.addEventListener('amelia:speak', handler);
    return () => window.removeEventListener('amelia:speak', handler);
  }, []);

  // ── Blink loop ───────────────────────────────────────────────────────────
  useEffect(() => {
    const schedule = () => {
      const delay = 2800 + Math.random() * 3000;
      return setTimeout(() => {
        setBlinking(true);
        setTimeout(() => { setBlinking(false); timer = schedule(); }, 140);
      }, delay);
    };
    let timer = schedule();
    return () => clearTimeout(timer);
  }, []);

  // ── Greeting on mount ────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      const hour = new Date().getHours();
      const g = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
      doSpeak(`${g}! Welcome to Kagzso. I am Amelia, your attendance assistant. I am ready to help.`);
    }, 1200);
    return () => clearTimeout(t);
  }, []);

  const toggleMute = () => {
    const next = !muted;
    mutedRef.current = next;
    setMuted(next);
    if (next) window.speechSynthesis?.cancel();
  };

  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 80 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 22, delay: 0.5 }}
      className="fixed bottom-20 right-3 md:bottom-6 md:right-5 z-50 flex flex-col items-center"
      style={{ width: minimized ? 72 : 160 }}
    >
      {/* ── Minimised view — just the face ── */}
      {minimized ? (
        <motion.div
          whileHover={{ scale: 1.05 }}
          onClick={() => setMinimized(false)}
          className="relative cursor-pointer"
        >
          <div className="rounded-full overflow-hidden w-[72px] h-[72px]
                          ring-2 ring-violet-500/50 shadow-xl shadow-violet-900/40"
            style={{ background: 'rgba(10,8,30,0.95)' }}
          >
            <AmeliaFace talking={talking} blinking={blinking} size={72} />
          </div>
          {talking && (
            <motion.div
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-violet-500
                         flex items-center justify-center"
              animate={{ scale: [1, 1.4, 1] }}
              transition={{ duration: 0.6, repeat: Infinity }}
            >
              <Volume2 size={8} className="text-white" />
            </motion.div>
          )}
        </motion.div>
      ) : (
        /* ── Full view ── */
        <div className="w-full rounded-2xl overflow-hidden border border-violet-500/20 shadow-2xl shadow-violet-900/30"
          style={{ background: 'linear-gradient(160deg, rgba(15,12,40,0.98) 0%, rgba(10,8,30,0.98) 100%)', backdropFilter: 'blur(20px)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2
                          border-b border-violet-500/15">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs font-semibold text-violet-200 tracking-wide">AMELIA AI</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={toggleMute}
                className="w-6 h-6 rounded-lg hover:bg-white/10 flex items-center justify-center
                           transition-colors text-gray-400 hover:text-white">
                {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
              </button>
              <button onClick={() => setMinimized(true)}
                className="w-6 h-6 rounded-lg hover:bg-white/10 flex items-center justify-center
                           transition-colors text-gray-400 hover:text-white">
                <ChevronDown size={12} />
              </button>
            </div>
          </div>

          {/* Face */}
          <div className="flex flex-col items-center pt-3 pb-2 px-3"
            style={{ background: 'radial-gradient(circle at 50% 40%, rgba(124,58,237,0.12) 0%, transparent 70%)' }}
          >
            <div className="relative">
              <AmeliaFace talking={talking} blinking={blinking} size={110} />
              {/* Rim light */}
              <div className="absolute inset-0 rounded-full pointer-events-none"
                style={{ boxShadow: talking ? '0 0 28px rgba(124,58,237,0.35)' : '0 0 12px rgba(124,58,237,0.12)', transition: 'box-shadow 0.4s' }}
              />
            </div>

            {/* Name + wave */}
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs font-bold text-white tracking-wider">Amelia</p>
              <SoundWave active={talking} />
            </div>

            {/* Status */}
            <p className="text-[10px] text-violet-400 mt-0.5 tracking-widest uppercase">
              {talking ? 'Speaking…' : muted ? 'Muted' : 'Listening'}
            </p>

            {/* Subtitle */}
            <AnimatePresence>
              {subtitle && (
                <motion.div
                  initial={{ opacity: 0, y: 6, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -4, height: 0 }}
                  className="w-full mt-2 px-2 py-2 rounded-xl
                             bg-violet-500/10 border border-violet-500/20"
                >
                  <p className="text-[10px] text-violet-200 leading-relaxed text-center">
                    {subtitle}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default AmeliaChat;
