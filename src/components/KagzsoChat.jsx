/**
 * Kagzso — Minimal voice notification toast.
 * Shows a sleek bottom-right card when speaking, auto-dismisses when done.
 * No floating avatar panel. Uses Web Speech API for voice.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, Mic2 } from 'lucide-react';
import { loadVoiceSettings, isSpeechSupported, getVoices } from '../utils/voiceUtils';

// ── Global trigger ─────────────────────────────────────────────────────────────
export const kagzsoSpeak = (text) => {
  if (text) window.dispatchEvent(new CustomEvent('kagzso:speak', { detail: { text } }));
};

// ── Animated sound bars ────────────────────────────────────────────────────────
const SoundBars = () => (
  <div className="flex items-end gap-[3px] h-5">
    {[0.6, 1, 0.75, 1, 0.5].map((h, i) => (
      <motion.div
        key={i}
        className="w-[3px] rounded-full bg-violet-400"
        animate={{ scaleY: [h, 1, h * 0.4, 1, h] }}
        transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.12, ease: 'easeInOut' }}
        style={{ height: '100%', originY: 1 }}
      />
    ))}
  </div>
);

// ── Main component ─────────────────────────────────────────────────────────────
const KagzsoChat = () => {
  const [message, setMessage]   = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted]       = useState(false);
  const [visible, setVisible]   = useState(false);
  const timerRef  = useRef(null);
  const utterRef  = useRef(null);
  const mutedRef  = useRef(false);

  mutedRef.current = muted;

  const dismiss = useCallback(() => {
    clearTimeout(timerRef.current);
    setSpeaking(false);
    setVisible(false);
    window.speechSynthesis?.cancel();
  }, []);

  const doSpeak = useCallback(async (text) => {
    clearTimeout(timerRef.current);
    window.speechSynthesis?.cancel();

    setMessage(text);
    setVisible(true);
    setSpeaking(true);

    // Auto-dismiss after reading time even if TTS is off
    const readMs = Math.max(3000, text.length * 55);

    if (!mutedRef.current && isSpeechSupported()) {
      const settings = loadVoiceSettings();
      if (settings.enabled) {
        const voices  = await getVoices();
        const utter   = new SpeechSynthesisUtterance(text);
        utter.lang    = settings.lang  || 'en-US';
        utter.rate    = settings.rate  ?? 1;
        utter.pitch   = settings.pitch ?? 1;
        utter.volume  = settings.volume ?? 1;

        if (settings.voiceURI) {
          utter.voice = voices.find(v => v.voiceURI === settings.voiceURI) || null;
        }
        if (!utter.voice) {
          utter.voice =
            voices.find(v => v.lang === utter.lang) ||
            voices.find(v => v.lang.startsWith(utter.lang.split('-')[0])) ||
            null;
        }

        utter.onend = () => {
          setSpeaking(false);
          timerRef.current = setTimeout(() => setVisible(false), 1800);
        };
        utter.onerror = () => {
          setSpeaking(false);
          timerRef.current = setTimeout(() => setVisible(false), 1800);
        };

        utterRef.current = utter;
        window.speechSynthesis.speak(utter);
        return;
      }
    }

    // Muted or TTS disabled — just show text, then hide
    timerRef.current = setTimeout(() => {
      setSpeaking(false);
      setTimeout(() => setVisible(false), 800);
    }, readMs);
  }, []);

  useEffect(() => {
    const handler = (e) => doSpeak(e.detail?.text || '');
    window.addEventListener('kagzso:speak', handler);
    return () => {
      window.removeEventListener('kagzso:speak', handler);
      clearTimeout(timerRef.current);
      window.speechSynthesis?.cancel();
    };
  }, [doSpeak]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    if (next) {
      window.speechSynthesis?.cancel();
      setSpeaking(false);
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="kagzso-toast"
          initial={{ opacity: 0, y: 24, scale: 0.94 }}
          animate={{ opacity: 1, y: 0,  scale: 1    }}
          exit={{   opacity: 0, y: 16,  scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50
                     w-[min(320px,calc(100vw-2rem))]"
        >
          {/* Glass card */}
          <div className="relative overflow-hidden rounded-2xl border border-white/10
                          bg-[#0f0f1a]/90 backdrop-blur-2xl shadow-2xl shadow-black/60">

            {/* Accent bar */}
            <div className="absolute top-0 left-0 right-0 h-[2px]
                            bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500" />

            <div className="flex items-start gap-3 px-4 py-3.5">

              {/* Icon / bars */}
              <div className="flex-shrink-0 w-9 h-9 rounded-xl
                              bg-gradient-to-br from-violet-600/30 to-blue-600/30
                              border border-violet-500/20
                              flex items-center justify-center mt-0.5">
                {speaking && !muted
                  ? <SoundBars />
                  : <Mic2 size={16} className="text-violet-400" />
                }
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-widest
                              text-violet-400 mb-0.5">
                  Kagzso
                </p>
                <p className="text-[13px] text-gray-200 leading-snug line-clamp-3">
                  {message}
                </p>
              </div>

              {/* Controls */}
              <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                {/* Mute toggle */}
                <button
                  onClick={toggleMute}
                  title={muted ? 'Unmute' : 'Mute'}
                  className="w-7 h-7 rounded-lg flex items-center justify-center
                             text-gray-500 hover:text-gray-200 hover:bg-white/8
                             transition-all"
                >
                  {muted
                    ? <VolumeX size={14} className="text-red-400" />
                    : <Volume2 size={14} />
                  }
                </button>

                {/* Dismiss */}
                <button
                  onClick={dismiss}
                  title="Dismiss"
                  className="w-7 h-7 rounded-lg flex items-center justify-center
                             text-gray-600 hover:text-gray-300 hover:bg-white/8
                             text-xs font-bold transition-all"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Progress bar — shrinks over read time */}
            {visible && (
              <motion.div
                className="absolute bottom-0 left-0 h-[2px]
                           bg-gradient-to-r from-violet-500 to-blue-500"
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{
                  duration: Math.max(3, message.length * 0.055),
                  ease: 'linear',
                }}
              />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default KagzsoChat;
