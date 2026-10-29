// Chimes and the spoken voice for the shop TVs. Chimes are made in the browser (no sound files): a
// two-note "ding-dong" when a car is checked in, a brighter rising chime when a job is completed. Browsers only allow sound after
// someone clicks the page once (or when the page embedding the TV allows autoplay).
let ctx = null;

export function audio() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}
export const soundReady = () => audio()?.state === "running";
export async function enableSound() {
  try { await audio()?.resume(); } catch {}
  return soundReady();
}

function note(freq, start, length, type = "sine", volume = 0.35) {
  const a = audio();
  const osc = a.createOscillator(), gain = a.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(a.destination);
  osc.start(start);
  osc.stop(start + length + 0.05);
}

const SOUNDS = {
  // New check-in: ding-dong.
  checkin: (t) => { note(880, t, 0.6); note(659.25, t + 0.28, 0.9); },
  // Completed: C-E-G-C rising.
  complete: (t) => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => note(f, t + i * 0.12, i === 3 ? 1.1 : 0.4, "triangle", 0.3)),
};

export function play(name) {
  if (!soundReady() || !SOUNDS[name]) return;
  SOUNDS[name](audio().currentTime + 0.02);
}

// Say it out loud after the chime, in the shop's ElevenLabs voice (/api/shop-voice) only. If
// ElevenLabs can't answer, the TV stays with the chime and the banner; there is no second voice.
// `auth` is { key } on a real TV or { demo: true } in /shop-demo.
export async function say(text, auth = {}) {
  if (!text || !soundReady()) return;
  try {
    const r = await fetch("/api/shop-voice", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(auth.key ? { "x-tv-key": auth.key } : {}) },
      body: JSON.stringify({ text, demo: !!auth.demo }),
    });
    if (!r.ok) return;
    const a = audio();
    const src = a.createBufferSource();
    src.buffer = await a.decodeAudioData(await r.arrayBuffer());
    src.connect(a.destination);
    src.start();
  } catch { /* no voice this time; the chime and banner already played */ }
}
