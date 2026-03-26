import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, Settings2, X, ChevronDown, Play } from 'lucide-react';
import {
  loadVoiceSettings, saveVoiceSettings,
  getVoices, getAvailableLanguages,
  speak, isSpeechSupported,
} from '../utils/voiceUtils';

// ── Mic/wave icon ────────────────────────────────────────────────────────────
const WaveIcon = ({ active }) => (
  <div className="flex items-end gap-[2px] h-4">
    {[3, 5, 4, 6, 3].map((h, i) => (
      <motion.div key={i}
        className={`w-[3px] rounded-full ${active ? 'bg-cyan-400' : 'bg-gray-600'}`}
        animate={active ? { height: [`${h}px`, `${h * 2.5}px`, `${h}px`] } : { height: `${h}px` }}
        transition={{ duration: 0.6, repeat: active ? Infinity : 0, delay: i * 0.1, ease: 'easeInOut' }}
      />
    ))}
  </div>
);

// ── Main VoiceSettings panel ─────────────────────────────────────────────────
const VoiceSettings = ({ onSettingsChange }) => {
  const [open, setOpen]           = useState(false);
  const [settings, setSettings]   = useState(loadVoiceSettings);
  const [languages, setLanguages] = useState([]);
  const [voices, setVoices]       = useState([]);
  const [langVoices, setLangVoices] = useState([]);
  const [testing, setTesting]     = useState(false);
  const panelRef = useRef(null);

  const supported = isSpeechSupported();

  // Load voices & languages once
  useEffect(() => {
    if (!supported) return;
    getAvailableLanguages().then(setLanguages);
    getVoices().then(setVoices);
  }, []);

  // Filter voices for selected language
  useEffect(() => {
    const prefix = settings.lang.split('-')[0];
    setLangVoices(voices.filter(v => v.lang === settings.lang || v.lang.startsWith(prefix)));
  }, [settings.lang, voices]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const update = (patch) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveVoiceSettings(next);
    onSettingsChange?.(next);
  };

  const testVoice = () => {
    setTesting(true);
    speak('Welcome, attendance marked successfully.', settings);
    setTimeout(() => setTesting(false), 2500);
  };

  if (!supported) return null;

  return (
    <div className="relative" ref={panelRef}>
      {/* Toggle button */}
      <motion.button
        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(p => !p)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
          settings.enabled
            ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/25'
            : 'bg-white/5 border-white/10 text-gray-500 hover:text-gray-300'
        }`}
        title="Voice settings"
      >
        {settings.enabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
        <WaveIcon active={settings.enabled} />
        <Settings2 size={12} className="opacity-60" />
      </motion.button>

      {/* Panel / Bottom Sheet */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop for mobile */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm md:hidden"
            />

            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className={`
                fixed md:absolute 
                bottom-0 left-0 right-0 md:bottom-auto md:left-auto md:right-0 md:top-14
                z-[70] md:z-50
                w-full md:w-[350px]
                max-h-[90vh] md:max-h-[600px] 
                overflow-y-auto overflow-x-hidden
                bg-dark-800/98 backdrop-blur-2xl
                border-t border-white/15 md:border md:rounded-2xl md:border-white/20
                shadow-2xl shadow-black/60 p-5 pb-8 md:pb-5 space-y-4
                rounded-t-[2.5rem] md:rounded-3xl
              `}
            >
              {/* Mobile Handle */}
              <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-2 md:hidden" />

              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400">
                    <Volume2 size={16} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white leading-tight">Voice Settings</h3>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Options</p>
                  </div>
                </div>
                <button onClick={() => setOpen(false)} className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all">
                  <X size={20} />
                </button>
              </div>

              {/* Enable toggle */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/8 hover:border-white/15 transition-all">
                <div>
                  <p className="text-sm font-semibold text-white">Voice Mode</p>
                  <p className="text-xs text-gray-500">Announce attendance live</p>
                </div>
                <button
                  onClick={() => update({ enabled: !settings.enabled })}
                  className={`relative w-12 h-6.5 rounded-full transition-all duration-300 ${
                    settings.enabled ? 'bg-cyan-500 shadow-lg shadow-cyan-500/20' : 'bg-white/10'
                  }`}
                >
                  <motion.div
                    className="absolute top-1 w-4.5 h-4.5 rounded-full bg-white shadow-sm"
                    animate={{ left: settings.enabled ? '1.6rem' : '0.25rem' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </button>
              </div>

              <AnimatePresence>
                {settings.enabled && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4 pt-2"
                  >
                    {/* Language selector */}
                    <div className="space-y-2">
                      <label className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] ml-1">Native Language</label>
                      <div className="relative group">
                        <select
                          value={settings.lang}
                          onChange={e => update({ lang: e.target.value, voiceURI: '' })}
                          className="w-full bg-dark-700/80 border border-white/10 rounded-2xl px-4 py-3 pr-10
                                     text-white text-sm focus:outline-none focus:border-cyan-500/50
                                     appearance-none cursor-pointer group-hover:border-white/20 transition-all font-medium"
                        >
                          {languages.length === 0
                            ? <option value={settings.lang}>{settings.lang}</option>
                            : languages.map(l => (
                                <option key={l.lang} value={l.lang}>{l.label}</option>
                              ))
                          }
                        </select>
                        <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 group-hover:text-cyan-400 transition-colors pointer-events-none" />
                      </div>
                    </div>

                    {/* Voice selector */}
                    {langVoices.length > 1 && (
                      <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] ml-1">Selection</label>
                        <div className="relative group">
                          <select
                            value={settings.voiceURI}
                            onChange={e => update({ voiceURI: e.target.value })}
                            className="w-full bg-dark-700/80 border border-white/10 rounded-2xl px-4 py-3 pr-10
                                       text-white text-sm focus:outline-none focus:border-cyan-500/50
                                       appearance-none cursor-pointer group-hover:border-white/20 transition-all font-medium"
                          >
                            <option value="">Default AI Voice</option>
                            {langVoices.map(v => (
                              <option key={v.voiceURI} value={v.voiceURI}>
                                {v.name} {v.localService ? '— Clean' : '— Flow'}
                              </option>
                            ))}
                          </select>
                          <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 group-hover:text-cyan-400 transition-colors pointer-events-none" />
                        </div>
                      </div>
                    )}

                    {/* sliders grouped in a card */}
                    <div className="space-y-4 p-4 rounded-2xl bg-white/5 border border-white/8">
                      {/* Rate */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Rate</label>
                          <span className="text-[11px] text-cyan-400 font-bold px-2 py-0.5 rounded-md bg-cyan-400/10 border border-cyan-400/20">{settings.rate.toFixed(1)}x</span>
                        </div>
                        <input type="range" min="0.5" max="2" step="0.1"
                          value={settings.rate}
                          onChange={e => update({ rate: parseFloat(e.target.value) })}
                          className="slider-cyan w-full h-1.5 cursor-pointer rounded-full"
                        />
                      </div>

                      {/* Pitch */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Voice Pitch</label>
                          <span className="text-[11px] text-cyan-400 font-bold px-2 py-0.5 rounded-md bg-cyan-400/10 border border-cyan-400/20">{settings.pitch.toFixed(1)}</span>
                        </div>
                        <input type="range" min="0.5" max="2" step="0.1"
                          value={settings.pitch}
                          onChange={e => update({ pitch: parseFloat(e.target.value) })}
                          className="slider-cyan w-full h-1.5 cursor-pointer rounded-full"
                        />
                      </div>
                    </div>

                    {/* Test button */}
                    <motion.button
                      whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.97 }}
                      onClick={testVoice}
                      disabled={testing}
                      className={`w-full flex items-center justify-center gap-3 py-4 rounded-2xl
                                 text-sm font-bold shadow-xl transition-all duration-300
                                 ${testing 
                                   ? 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-400' 
                                   : 'bg-cyan-600 border border-cyan-500 shadow-cyan-900/40 text-white'}`}
                    >
                      {testing
                        ? <><WaveIcon active /><span>Analyzing Voice…</span></>
                        : <><Play size={16} fill="currentColor" /><span>Preview System Voice</span></>
                      }
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VoiceSettings;
