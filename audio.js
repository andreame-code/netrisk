let audioCtx;
let volume = 0.2;
let muted = false;

function playTone(freq, duration = 0.2) {
  if (typeof window === "undefined") return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  if (!audioCtx) audioCtx = new AudioContext();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  const gainValue = muted ? 0 : volume;
  gain.gain.setValueAtTime(gainValue, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
  osc.stop(audioCtx.currentTime + duration);
}

function playAttackSound() {
  playTone(300);
}

function playConquerSound() {
  playTone(600, 0.3);
}

function setVolume(v) {
  volume = Math.min(Math.max(v, 0), 1);
}

function getVolume() {
  return volume;
}

function setMuted(m) {
  muted = m;
}

function isMuted() {
  return muted;
}

export {
  playTone,
  playAttackSound,
  playConquerSound,
  setVolume,
  getVolume,
  setMuted,
  isMuted,
};
