const SETTINGS_KEY = "audioSettings";

// Default settings
let settings = {
  master: 0.5,
  effects: 1,
  muted: false,
  music: true,
};

// Load persisted settings
if (typeof localStorage !== "undefined") {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) Object.assign(settings, JSON.parse(stored));
  } catch {
    // ignore storage errors
  }
}

function saveSettings() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage errors
  }
}

const SILENCE_SRC =
  "https://raw.githubusercontent.com/anars/blank-audio/master/1-second-of-silence.mp3";

const EFFECT_FILES = {
  reinforce: "assets/reinforce.mp3",
  attackWin: "assets/attack-win.mp3",
  attackLoss: "assets/attack-loss.mp3",
  conquer: "assets/conquer.mp3",
  endTurn: "assets/end-turn.mp3",
};

const cache = new Map();
let musicAudio;

const MUSIC_FILES = {
  default: "assets/music.mp3",
  map3: "assets/fairy-music.mp3",
};

const FALLBACK_FILE = SILENCE_SRC;

let musicSrc = MUSIC_FILES.default;

// Detect jsdom environment to avoid calling unimplemented media methods
const IS_JSDOM =
  typeof navigator !== "undefined" && navigator.userAgent.includes("jsdom");

function clamp(v) {
  return Math.min(Math.max(v, 0), 1);
}

function loadAudio(src) {
  if (cache.has(src)) return cache.get(src);
  if (typeof Audio === "undefined") {
    cache.set(src, null);
    return null;
  }
  const a = new Audio();
  a.src = src;
  a.addEventListener(
    "error",
    () => {
      if (src !== FALLBACK_FILE) a.src = FALLBACK_FILE;
    },
    { once: true },
  );
  cache.set(src, a);
  return a;
}

function playEffect(name) {
  if (settings.muted) return;
  if (settings.master === 0 || settings.effects === 0) return;
  const src = EFFECT_FILES[name];
  if (!src) return;
  const audio = loadAudio(src);
  if (!audio || IS_JSDOM) return;
  audio.volume = settings.master * settings.effects;
  try {
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }
  } catch {
    // ignore play errors
  }
}

function ensureMusic() {
  if (musicAudio || typeof Audio === "undefined") return musicAudio;
  musicAudio = new Audio();
  musicAudio.src = musicSrc;
  musicAudio.loop = true;
  return musicAudio;
}

function setLevelMusic(levelId) {
  musicSrc = MUSIC_FILES[levelId] || MUSIC_FILES.default;
  if (musicAudio) {
    musicAudio.src = musicSrc;
  }
}

function getLevelMusic(levelId) {
  return MUSIC_FILES[levelId] || MUSIC_FILES.default;
}

function setMasterVolume(v) {
  settings.master = clamp(v);
  if (musicAudio) musicAudio.volume = settings.master;
  saveSettings();
}

function getMasterVolume() {
  return settings.master;
}

function setEffectsVolume(v) {
  settings.effects = clamp(v);
  saveSettings();
}

function getEffectsVolume() {
  return settings.effects;
}

function setMuted(m) {
  settings.muted = m;
  if (musicAudio) musicAudio.muted = m;
  saveSettings();
}

function isMuted() {
  return settings.muted;
}

function setMusicEnabled(on) {
  settings.music = on;
  const music = ensureMusic();
  if (!music) return saveSettings();
  if (on && !settings.muted) {
    music.volume = settings.master;
    if (!IS_JSDOM) {
      try {
        const p = music.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      } catch {
        // ignore play errors
      }
    }
  } else if (!IS_JSDOM) {
    try {
      music.pause();
    } catch {
      // ignore pause errors
    }
  }
  saveSettings();
}

function isMusicEnabled() {
  return settings.music;
}

function preloadEffects() {
  Object.values(EFFECT_FILES).forEach(loadAudio);
  if (settings.music) ensureMusic();
}

export {
  playEffect,
  preloadEffects,
  setMasterVolume,
  getMasterVolume,
  setEffectsVolume,
  getEffectsVolume,
  setMuted,
  isMuted,
  setMusicEnabled,
  isMusicEnabled,
  setLevelMusic,
  getLevelMusic,
};
