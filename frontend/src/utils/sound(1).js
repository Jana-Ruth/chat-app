// Lightweight synthesized sound effects using the Web Audio API.
// No external audio files needed — every sound is built from oscillators.

let audioCtx = null;
function getContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  // browsers suspend the context until a user gesture resumes it
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function tone({ freq = 600, duration = 0.03, type = 'sine', volume = 0.05, delay = 0 }) {
  try {
    const ctx = getContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.value = freq;

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    const start = ctx.currentTime + delay;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  } catch {
    // audio can fail silently (e.g. autoplay policy) — never block the UI for it
  }
}

// A short burst of filtered noise — used for the typewriter pack's key click
function noiseClick({ duration = 0.02, volume = 0.05, delay = 0 } = {}) {
  try {
    const ctx = getContext();
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1800;

    const gain = ctx.createGain();
    gain.gain.value = volume;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start(ctx.currentTime + delay);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------
// Sound packs: each defines how key/send/receive events actually sound.
// ---------------------------------------------------------------
const PACKS = {
  classic: {
    label: 'Classic',
    key: () => tone({ freq: 520 + Math.random() * 80, duration: 0.02, type: 'square', volume: 0.03 }),
    send: () => tone({ freq: 700, duration: 0.08, type: 'sine', volume: 0.06 }),
    receive: () => tone({ freq: 450, duration: 0.09, type: 'sine', volume: 0.06 }),
  },
  soft: {
    label: 'Soft Pop',
    key: () => tone({ freq: 380 + Math.random() * 40, duration: 0.05, type: 'sine', volume: 0.035 }),
    send: () => {
      tone({ freq: 520, duration: 0.1, type: 'sine', volume: 0.05 });
      tone({ freq: 780, duration: 0.12, type: 'sine', volume: 0.035, delay: 0.05 });
    },
    receive: () => {
      tone({ freq: 660, duration: 0.1, type: 'sine', volume: 0.05 });
      tone({ freq: 440, duration: 0.14, type: 'sine', volume: 0.04, delay: 0.04 });
    },
  },
  typewriter: {
    label: 'Typewriter',
    key: () => noiseClick({ duration: 0.015, volume: 0.06 }),
    send: () => {
      noiseClick({ duration: 0.02, volume: 0.05 });
      tone({ freq: 900, duration: 0.05, type: 'square', volume: 0.03, delay: 0.02 });
    },
    receive: () => tone({ freq: 300, duration: 0.06, type: 'triangle', volume: 0.05 }),
  },
  marimba: {
    label: 'Marimba',
    key: () => tone({ freq: [440, 494, 523, 587, 659][Math.floor(Math.random() * 5)], duration: 0.12, type: 'triangle', volume: 0.04 }),
    send: () => {
      tone({ freq: 523, duration: 0.12, type: 'triangle', volume: 0.05 });
      tone({ freq: 659, duration: 0.16, type: 'triangle', volume: 0.045, delay: 0.07 });
    },
    receive: () => {
      tone({ freq: 392, duration: 0.14, type: 'triangle', volume: 0.05 });
      tone({ freq: 330, duration: 0.18, type: 'triangle', volume: 0.04, delay: 0.06 });
    },
  },
  crystal: {
    label: 'Crystal',
    key: () => tone({ freq: 1200 + Math.random() * 300, duration: 0.04, type: 'sine', volume: 0.025 }),
    send: () => {
      tone({ freq: 1046, duration: 0.1, type: 'sine', volume: 0.045 });
      tone({ freq: 1568, duration: 0.14, type: 'sine', volume: 0.03, delay: 0.06 });
    },
    receive: () => {
      tone({ freq: 880, duration: 0.12, type: 'sine', volume: 0.045 });
      tone({ freq: 1174, duration: 0.16, type: 'sine', volume: 0.03, delay: 0.05 });
    },
  },
};

const SOUND_PREF_KEY = 'soundsEnabled';
const PACK_PREF_KEY = 'soundPack';

export function soundPacks() {
  return Object.entries(PACKS).map(([id, pack]) => ({ id, label: pack.label }));
}

export function soundsEnabled() {
  const stored = localStorage.getItem(SOUND_PREF_KEY);
  return stored === null ? true : stored === 'true';
}

export function setSoundsEnabled(enabled) {
  localStorage.setItem(SOUND_PREF_KEY, String(enabled));
}

export function currentSoundPack() {
  return localStorage.getItem(PACK_PREF_KEY) || 'classic';
}

export function setSoundPack(id) {
  if (PACKS[id]) localStorage.setItem(PACK_PREF_KEY, id);
}

function activePack() {
  return PACKS[currentSoundPack()] || PACKS.classic;
}

export function playKeySound() {
  if (!soundsEnabled()) return;
  activePack().key();
}

export function playSendSound() {
  if (!soundsEnabled()) return;
  activePack().send();
}

export function playReceiveSound() {
  if (!soundsEnabled()) return;
  activePack().receive();
}

// Lets Settings preview a pack without needing to type/send anything for real
export function previewSoundPack(id) {
  const pack = PACKS[id] || PACKS.classic;
  pack.send();
}
