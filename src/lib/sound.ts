"use client";

// Lightweight synthesized sound + music engine using the Web Audio API.
// No audio files needed — everything is generated on the fly.

let ctx: AudioContext | null = null;
let musicGain: GainNode | null = null;
let sfxOn = true;
let musicOn = true;
let musicTimer: ReturnType<typeof setInterval> | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

export function initAudio() {
  ac();
}

export function setSfx(on: boolean) {
  sfxOn = on;
}
export function setMusic(on: boolean) {
  musicOn = on;
  if (on) startMusic();
  else stopMusic();
}
export function getSfx() {
  return sfxOn;
}
export function getMusic() {
  return musicOn;
}

function tone(
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType,
  vol: number
) {
  const a = ac();
  if (!a) return;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, a.currentTime + start);
  g.gain.setValueAtTime(0, a.currentTime + start);
  g.gain.linearRampToValueAtTime(vol, a.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur);
  osc.connect(g);
  g.connect(a.destination);
  osc.start(a.currentTime + start);
  osc.stop(a.currentTime + start + dur + 0.02);
}

function noiseBurst(start: number, dur: number, vol: number, filterFreq = 1000) {
  const a = ac();
  if (!a) return;
  const bufferSize = a.sampleRate * dur;
  const buffer = a.createBuffer(1, bufferSize, a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const src = a.createBufferSource();
  src.buffer = buffer;
  const filter = a.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = filterFreq;
  const g = a.createGain();
  g.gain.setValueAtTime(vol, a.currentTime + start);
  src.connect(filter);
  filter.connect(g);
  g.connect(a.destination);
  src.start(a.currentTime + start);
}

export function playSound(type: string) {
  if (!sfxOn) return;
  const a = ac();
  if (!a) return;
  switch (type) {
    case "gunshot":
      // sharp crack + low boom
      noiseBurst(0, 0.18, 0.9, 2200);
      tone(70, 0, 0.25, "square", 0.5);
      tone(140, 0, 0.1, "sawtooth", 0.3);
      break;
    case "stab":
      noiseBurst(0, 0.12, 0.5, 3500);
      tone(400, 0, 0.08, "sawtooth", 0.2);
      break;
    case "found_mafia":
      // ominous descending
      tone(330, 0, 0.18, "sawtooth", 0.25);
      tone(220, 0.16, 0.3, "sawtooth", 0.3);
      break;
    case "found_innocent":
      // gentle rising chime
      tone(523, 0, 0.15, "sine", 0.25);
      tone(784, 0.13, 0.25, "sine", 0.25);
      break;
    case "investigate":
      tone(880, 0, 0.08, "sine", 0.2);
      tone(1046, 0.08, 0.12, "sine", 0.2);
      break;
    case "heal":
      tone(660, 0, 0.15, "sine", 0.2);
      tone(880, 0.12, 0.2, "sine", 0.2);
      tone(1046, 0.24, 0.25, "sine", 0.2);
      break;
    case "block":
      tone(300, 0, 0.2, "triangle", 0.25);
      tone(200, 0.15, 0.2, "triangle", 0.2);
      break;
    case "action":
      tone(520, 0, 0.06, "triangle", 0.2);
      break;
    case "click":
      tone(700, 0, 0.04, "square", 0.12);
      break;
    case "vote":
      tone(440, 0, 0.06, "square", 0.18);
      tone(660, 0.06, 0.1, "square", 0.15);
      break;
    case "death":
      tone(200, 0, 0.4, "sawtooth", 0.3);
      tone(120, 0.2, 0.5, "sawtooth", 0.25);
      break;
    case "win":
      [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.12, 0.3, "sine", 0.25));
      break;
    case "phase":
      tone(392, 0, 0.25, "sine", 0.2);
      tone(494, 0.2, 0.3, "sine", 0.2);
      break;
    default:
      break;
  }
}

// ---- Ambient background music: slow noir chord progression ----
const CHORDS = [
  [220, 261.63, 329.63], // Am
  [174.61, 220, 261.63], // F
  [196, 246.94, 293.66], // G
  [130.81, 164.81, 196], // C (low)
];
let chordIdx = 0;

function playChord() {
  const a = ac();
  if (!a || !musicGain) return;
  const chord = CHORDS[chordIdx % CHORDS.length];
  chordIdx++;
  chord.forEach((freq) => {
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, a.currentTime);
    g.gain.linearRampToValueAtTime(0.06, a.currentTime + 0.8);
    g.gain.linearRampToValueAtTime(0.0001, a.currentTime + 3.6);
    osc.connect(g);
    g.connect(musicGain!);
    osc.start();
    osc.stop(a.currentTime + 3.8);
  });
}

export function startMusic() {
  if (!musicOn) return;
  const a = ac();
  if (!a) return;
  if (!musicGain) {
    musicGain = a.createGain();
    musicGain.gain.value = 0.5;
    musicGain.connect(a.destination);
  }
  if (musicTimer) return;
  playChord();
  musicTimer = setInterval(playChord, 3800);
}

export function stopMusic() {
  if (musicTimer) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
}
