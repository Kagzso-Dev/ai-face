import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Plus, Trash2, ToggleLeft, ToggleRight, Save, UserX, CheckCircle2 } from 'lucide-react';
import { getTimeWindows, saveTimeWindows, checkAttendanceWindow } from '../utils/storageUtils';
import { kagzsoSpeak } from './KagzsoChat';

const fmt12 = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${m.toString().padStart(2, '0')} ${ampm}`;
};

// Returns minutes until next window opens / minutes until current window closes
const getWindowStatus = (windows) => {
  const now = new Date();
  const hhmm = now.getHours() * 60 + now.getMinutes();
  const active = windows.filter(w => w.enabled);

  for (const w of active) {
    const [sh, sm] = w.start.split(':').map(Number);
    const [eh, em] = w.end.split(':').map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;

    if (hhmm >= startMin && hhmm <= endMin) {
      const remaining = endMin - hhmm;
      return { state: 'open', window: w, minsLeft: remaining };
    }
    if (hhmm < startMin) {
      return { state: 'upcoming', window: w, minsUntil: startMin - hhmm };
    }
  }
  return { state: 'closed', window: null };
};

const AttendanceTimeSettings = () => {
  const [windows, setWindows] = useState([]);
  const [saved, setSaved] = useState(false);
  const [liveStatus, setLiveStatus] = useState({ state: 'closed', window: null });
  const [loading, setLoading] = useState(true);

  // Initial load
  useEffect(() => {
    (async () => {
      const data = await getTimeWindows();
      setWindows(data);
      setLiveStatus(getWindowStatus(data));
      setLoading(false);
    })();
  }, []);

  // Live clock — refresh status every 30s
  useEffect(() => {
    if (windows.length === 0) return;
    const id = setInterval(() => setLiveStatus(getWindowStatus(windows)), 30000);
    return () => clearInterval(id);
  }, [windows]);

  const update = (id, field, value) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, [field]: value } : w));
    setSaved(false);
  };

  const toggle = (id) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, enabled: !w.enabled } : w));
    setSaved(false);
  };

  const toggleLateAbsent = (id) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, lateAbsent: !w.lateAbsent } : w));
    setSaved(false);
  };

  const toggleWindowType = (id) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, windowType: w.windowType === 'in' ? 'out' : 'in' } : w));
    setSaved(false);
  };

  const addWindow = () => {
    setWindows(prev => [...prev, {
      id: `window_${Date.now()}`,
      label: 'New Slot',
      start: '09:00',
      end: '10:00',
      enabled: true,
      lateAbsent: false,
      lateAfter: '',
      windowType: 'in',
    }]);
    setSaved(false);
  };

  const removeWindow = (id) => {
    setWindows(prev => prev.filter(w => w.id !== id));
    setSaved(false);
  };

  const handleSave = async () => {
    const ok = await saveTimeWindows(windows);
    if (ok) {
      setSaved(true);
      setLiveStatus(getWindowStatus(windows));
      const active = windows.filter(w => w.enabled);
      if (active.length === 0) {
        kagzsoSpeak('Attendance time restriction disabled. Attendance can be taken anytime.');
      } else {
        const desc = active.map(w => `${w.label} from ${fmt12(w.start)} to ${fmt12(w.end)}`).join(', and ');
        kagzsoSpeak(`Time windows saved. ${desc}.`);
      }
      setTimeout(() => setSaved(false), 2500);
    }
  };

  const anyEnabled = windows.some(w => w.enabled);

  // Live status banner
  const StatusBadge = () => {
    if (!anyEnabled) return (
      <span className="text-xs px-2.5 py-1 rounded-full bg-white/8 text-gray-400 border border-white/10">No restriction</span>
    );
    if (liveStatus.state === 'open') return (
      <span className="text-xs px-2.5 py-1 rounded-full bg-green-500/15 text-green-400 border border-green-500/25 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        Open · {liveStatus.minsLeft}m left
      </span>
    );
    if (liveStatus.state === 'upcoming') return (
      <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">
        Opens in {liveStatus.minsUntil}m
      </span>
    );
    return (
      <span className="text-xs px-2.5 py-1 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/25">
        {windows.filter(w => w.enabled).length} window{windows.filter(w => w.enabled).length > 1 ? 's' : ''} · Closed now
      </span>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-5 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center flex-shrink-0">
            <Clock size={16} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Attendance Time Windows</h2>
            <p className="text-xs text-gray-500">Set when attendance can be marked each day</p>
          </div>
        </div>
        <StatusBadge />
      </div>

      {/* Column labels */}
      {windows.length > 0 && (
        <div className="flex items-center gap-3 px-1">
          <div className="w-6 flex-shrink-0" />
          <span className="w-24 text-[10px] text-gray-600 uppercase tracking-wider flex-shrink-0">Label</span>
          <span className="flex-1 text-[10px] text-gray-600 uppercase tracking-wider">Time Range</span>
          <span className="text-[10px] text-gray-600 uppercase tracking-wider flex-shrink-0 hidden lg:block">Late After</span>
          <span className="text-[10px] text-gray-600 uppercase tracking-wider flex-shrink-0 hidden sm:block">Auto-Absent</span>
        </div>
      )}

      {/* Window rows */}
      <div className="space-y-2">
        <AnimatePresence>
          {windows.map(w => {
            const isCurrentlyOpen = liveStatus.state === 'open' && liveStatus.window?.id === w.id;
            return (
              <motion.div
                key={w.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={`rounded-xl border p-3 transition-all duration-200 ${
                  isCurrentlyOpen
                    ? 'bg-green-500/8 border-green-500/25'
                    : w.enabled
                    ? 'bg-orange-500/6 border-orange-500/18'
                    : 'bg-white/3 border-white/8 opacity-55'
                }`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  {/* Enable toggle */}
                  <button onClick={() => toggle(w.id)} className="flex-shrink-0 text-gray-400 hover:text-white transition-colors" title="Enable / Disable">
                    {w.enabled
                      ? <ToggleRight size={22} className={isCurrentlyOpen ? 'text-green-400' : 'text-orange-400'} />
                      : <ToggleLeft size={22} />}
                  </button>

                  {/* Label */}
                  <input
                    value={w.label}
                    onChange={e => update(w.id, 'label', e.target.value)}
                    className="w-24 flex-shrink-0 bg-white/5 border border-white/10 rounded-lg px-2 py-1
                               text-xs text-white focus:outline-none focus:border-orange-500/50 transition-all"
                  />

                  {/* Time range */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <input
                      type="time"
                      value={w.start}
                      onChange={e => update(w.id, 'start', e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white
                                 focus:outline-none focus:border-orange-500/50 transition-all [color-scheme:dark]"
                    />
                    <span className="text-gray-600 text-xs">→</span>
                    <input
                      type="time"
                      value={w.end}
                      onChange={e => update(w.id, 'end', e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white
                                 focus:outline-none focus:border-orange-500/50 transition-all [color-scheme:dark]"
                    />
                    <span className="text-xs text-gray-500 hidden lg:block whitespace-nowrap">
                      {fmt12(w.start)} – {fmt12(w.end)}
                    </span>
                  </div>

                  {/* IN / OUT type toggle */}
                  <button
                    onClick={() => toggleWindowType(w.id)}
                    title={`Window type: ${w.windowType === 'out' ? 'OUT (check-out)' : 'IN (check-in)'} — click to toggle`}
                    className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                      w.windowType === 'out'
                        ? 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                        : 'bg-green-500/15 border-green-500/30 text-green-300'
                    }`}
                  >
                    {w.windowType === 'out' ? '↑ OUT' : '↓ IN'}
                  </button>

                  {/* Late After time */}
                  <div className="hidden lg:flex items-center gap-1.5 flex-shrink-0">
                    <input
                      type="time"
                      value={w.lateAfter || ''}
                      onChange={e => update(w.id, 'lateAfter', e.target.value)}
                      title="Attendance after this time counts as Late (leave blank to disable)"
                      className="bg-amber-500/10 border border-amber-500/25 rounded-lg px-2 py-1 text-xs text-amber-300
                                 focus:outline-none focus:border-amber-500/50 transition-all [color-scheme:dark] w-28"
                    />
                    {w.lateAfter && (
                      <button onClick={() => update(w.id, 'lateAfter', '')} title="Clear late cutoff"
                        className="text-gray-600 hover:text-gray-300 transition-colors text-[10px]">✕</button>
                    )}
                  </div>

                  {/* Auto-Absent toggle */}
                  <button
                    onClick={() => toggleLateAbsent(w.id)}
                    title={w.lateAbsent ? 'Auto-absent on close: ON' : 'Auto-absent on close: OFF'}
                    className={`flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium border transition-all hidden sm:flex ${
                      w.lateAbsent
                        ? 'bg-red-500/15 border-red-500/25 text-red-400'
                        : 'bg-white/5 border-white/10 text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    <UserX size={11} />
                    {w.lateAbsent ? 'Auto-absent' : 'No auto-absent'}
                  </button>

                  {/* Delete */}
                  {windows.length > 1 && (
                    <button
                      onClick={() => removeWindow(w.id)}
                      className="flex-shrink-0 w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/25
                                 flex items-center justify-center text-red-500/50 hover:text-red-400 transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>

                {/* Currently open indicator */}
                {isCurrentlyOpen && (
                  <div className="flex items-center gap-1.5 mt-2 pl-9">
                    <CheckCircle2 size={11} className="text-green-400" />
                    <span className="text-[10px] text-green-400 font-medium">
                      Window open — {liveStatus.minsLeft} min remaining
                    </span>
                  </div>
                )}

                {/* Late / absent info */}
                {(w.lateAfter || w.lateAbsent) && w.enabled && (
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 pl-9">
                    {w.lateAfter && (
                      <p className="text-[10px] text-amber-400/70">
                        Attendance after {fmt12(w.lateAfter)} marked as <span className="font-semibold">Late</span>
                      </p>
                    )}
                    {w.lateAbsent && (
                      <p className="text-[10px] text-red-400/70">
                        Anyone not marked by {fmt12(w.end)} auto-marked <span className="font-semibold">Absent</span>
                      </p>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 pt-1 flex-wrap">
        <button
          onClick={addWindow}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium
                     bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20
                     text-gray-400 hover:text-white transition-all"
        >
          <Plus size={13} /> Add Slot
        </button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleSave}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            saved
              ? 'bg-green-500/20 border border-green-500/30 text-green-400'
              : 'bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 text-orange-300 hover:text-white'
          }`}
        >
          <Save size={13} />
          {saved ? 'Saved!' : 'Save Windows'}
        </motion.button>

        <p className="text-[10px] text-gray-600 ml-auto hidden md:block">
          Disable all to allow anytime · Auto-absent marks late users when window closes
        </p>
      </div>
    </motion.div>
  );
};

export default AttendanceTimeSettings;
