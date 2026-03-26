/**
 * AI Voice Announcements — Web Speech API (SpeechSynthesis).
 * Supports all languages/voices the user's OS has installed.
 * Settings persisted in localStorage.
 */

const STORAGE_KEY = 'fa_voice_settings';

const DEFAULT_SETTINGS = {
  enabled: true,
  lang:    'en-US',
  voiceURI: '',   // empty = auto-pick best voice for lang
  rate:    1.0,
  pitch:   1.0,
  volume:  1.0,
};

// ── Settings helpers ────────────────────────────────────────────────────────
export const loadVoiceSettings = () => {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
};

export const saveVoiceSettings = (settings) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

// ── Voice list ──────────────────────────────────────────────────────────────

/** Wait for voices to load (async on some browsers) */
export const getVoices = () =>
  new Promise(resolve => {
    const voices = window.speechSynthesis?.getVoices() || [];
    if (voices.length > 0) { resolve(voices); return; }
    const handler = () => resolve(window.speechSynthesis.getVoices());
    window.speechSynthesis.addEventListener('voiceschanged', handler, { once: true });
    setTimeout(() => resolve(window.speechSynthesis?.getVoices() || []), 1500);
  });

/** Unique languages from installed voices */
export const getAvailableLanguages = async () => {
  const voices = await getVoices();
  const seen = new Set();
  const list = voices
    .filter(v => { if (seen.has(v.lang)) return false; seen.add(v.lang); return true; })
    .map(v => ({ lang: v.lang, label: getLangLabel(v.lang) }));

  // Force-add Tamil if not present (as it may be network-backed or standard but unlisted)
  if (!seen.has('ta-IN') && !seen.has('ta')) {
    list.push({ lang: 'ta-IN', label: 'Tamil (India)' });
  }

  return list.sort((a, b) => a.label.localeCompare(b.label));
};

/** Human-readable language name */
const getLangLabel = (lang) => {
  try {
    const [base, region] = lang.split('-');
    const name = new Intl.DisplayNames(['en'], { type: 'language' }).of(base) || lang;
    const regionName = region
      ? new Intl.DisplayNames(['en'], { type: 'region' }).of(region) || ''
      : '';
    return regionName ? `${name} (${regionName})` : name;
  } catch {
    return lang;
  }
};

// ── Core speak function ─────────────────────────────────────────────────────

let currentUtterance = null;

export const speak = async (text, overrideSettings = null) => {
  if (!window.speechSynthesis) return;
  const settings = overrideSettings || loadVoiceSettings();
  if (!settings.enabled) return;

  // Cancel any currently speaking
  window.speechSynthesis.cancel();

  const voices = await getVoices();

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang   = settings.lang;
  utter.rate   = settings.rate;
  utter.pitch  = settings.pitch;
  utter.volume = settings.volume;

  // Pick voice: stored URI first, then best match for lang
  if (settings.voiceURI) {
    utter.voice = voices.find(v => v.voiceURI === settings.voiceURI) || null;
  }
  if (!utter.voice) {
    // Best match: exact lang, then lang prefix
    utter.voice =
      voices.find(v => v.lang === settings.lang) ||
      voices.find(v => v.lang.startsWith(settings.lang.split('-')[0])) ||
      null;
  }

  currentUtterance = utter;
  window.speechSynthesis.speak(utter);
};

export const stopSpeaking = () => {
  window.speechSynthesis?.cancel();
};

const getGreeting = (lang) => {
  const hour = new Date().getHours();
  const isTa = lang.split('-')[0] === 'ta';
  
  if (hour < 12) return isTa ? 'காலை வணக்கம்' : 'Good morning';
  if (hour < 17) return isTa ? 'மதிய வணக்கம்' : 'Good afternoon';
  return isTa ? 'மாலை வணக்கம்' : 'Good evening';
};

// ── Translations ───────────────────────────────────────────────────────────
const TRANSLATIONS = {
  'en': {
    welcome: (name, g) => `${g}, ${name}. Your attendance has been successfully marked.`,
    already: (name) => `${name}, you have already been marked present today.`,
    unknown: () => 'Unknown face detected. Please try again.',
    ready:   () => 'Kagzso AI is active and ready for attendance.',
  },
  'ta': {
    welcome: (name, g) => `${g} ${name}. உங்கள் வருகை பதிவு செய்யப்பட்டது.`,
    already: (name) => `${name} ஏற்கனவே இன்று வருகை தந்துள்ளார்.`,
    unknown: () => 'அடையாளம் தெரியாத முகம். மீண்டும் முயற்சிக்கவும்.',
    ready:   () => 'Kagzso AI தயாராக உள்ளது.',
  }
};

const getT = (lang) => {
  const code = lang.split('-')[0];
  return TRANSLATIONS[code] || TRANSLATIONS['en'];
};

// ── Pre-built announcement templates ───────────────────────────────────────

export const announceAttendanceMarked = (name, settings) => {
  const greeting = getGreeting(settings.lang);
  speak(getT(settings.lang).welcome(name, greeting), settings);
};

export const announceAlreadyPresent = (name, settings) =>
  speak(getT(settings.lang).already(name), settings);

export const announceUnknownFace = (settings) =>
  speak(getT(settings.lang).unknown(), settings);

export const announceSystemReady = (settings) =>
  speak(getT(settings.lang).ready(), settings);

/** True if browser supports speech synthesis */
export const isSpeechSupported = () => !!window.speechSynthesis;
