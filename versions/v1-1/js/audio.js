/* Grok Blocks - tiny WebAudio synth: sfx, engine hum, music loop */
(function () {
'use strict';
const GB = window.GB;
const Snd = GB.Snd = {};
let ctx = null, master = null, muted = false, musicOn = false, mood = 'calm', eng = null, engGain = null, beat = 0, timer = null;
function ac() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ctx.destination); } catch (e) { return null; } }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
Snd.unlock = () => { ac(); };
Snd.setMuted = (m) => { muted = !!m; if (master) master.gain.value = muted ? 0 : 0.5; };
Snd.muted = () => muted;
function tone(f, d, type, vol, slide, when) {
  const c = ac(); if (!c || muted) return;
  const t = c.currentTime + (when || 0), o = c.createOscillator(), g = c.createGain();
  o.type = type || 'square'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + d);
  g.gain.setValueAtTime(vol || 0.15, t); g.gain.exponentialRampToValueAtTime(0.0008, t + d);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.02);
}
function noise(d, vol, hp) {
  const c = ac(); if (!c || muted) return;
  const b = c.createBuffer(1, Math.floor(c.sampleRate * d), c.sampleRate), a = b.getChannelData(0);
  for (let i = 0; i < a.length; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / a.length);
  const s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 800;
  s.buffer = b; g.gain.value = vol || 0.2; s.connect(f); f.connect(g); g.connect(master); s.start();
}
const FX = {
  dart: () => { noise(0.12, 0.25, 2000); tone(900, 0.08, 'triangle', 0.08, 0.5); },
  hit: () => { tone(520, 0.08, 'square', 0.12); tone(780, 0.1, 'square', 0.1, 1, 0.07); },
  sleep: () => { [660, 550, 440].forEach((f, i) => tone(f, 0.25, 'sine', 0.14, 1, i * 0.14)); },
  load: () => { tone(160, 0.15, 'square', 0.18, 0.6); tone(240, 0.15, 'square', 0.12, 1, 0.12); },
  deliver: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.16, 1, i * 0.1)); },
  spotted: () => { tone(300, 0.15, 'sawtooth', 0.16, 1.6); tone(300, 0.2, 'sawtooth', 0.14, 1.6, 0.18); },
  busted: () => { [400, 300, 200].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.15, 0.8, i * 0.18)); },
  flare: () => { noise(0.6, 0.2, 400); tone(200, 0.6, 'sawtooth', 0.08, 4); },
  horn: () => { tone(330, 0.35, 'square', 0.12); tone(415, 0.35, 'square', 0.1); },
  siren: () => { for (let i = 0; i < 4; i++) { tone(600, 0.2, 'square', 0.1, 1.5, i * 0.25); } },
  knock: () => { noise(0.25, 0.35, 120); tone(120, 0.3, 'square', 0.2, 0.5); },
  bolt: () => { noise(0.3, 0.12, 1500); },
  windup: () => { tone(110, 0.5, 'sawtooth', 0.18, 1.8); },
  click: () => tone(1200, 0.03, 'square', 0.06),
  ui: () => tone(880, 0.05, 'triangle', 0.1),
  win: () => { [523, 659, 784, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'square', 0.12, 1, i * 0.13)); },
  freed: () => { [440, 554, 659, 880].forEach((f, i) => tone(f, 0.2, 'triangle', 0.15, 1, i * 0.08)); },
  join: () => { tone(660, 0.1, 'sine', 0.15); tone(990, 0.15, 'sine', 0.15, 1, 0.1); },
  leave: () => { tone(660, 0.1, 'sine', 0.12); tone(440, 0.15, 'sine', 0.12, 1, 0.1); },
  restock: () => { [700, 900].forEach((f, i) => tone(f, 0.1, 'square', 0.1, 1, i * 0.08)); },
  buy: () => { [784, 1046, 1318].forEach((f, i) => tone(f, 0.12, 'triangle', 0.14, 1, i * 0.07)); }
};
Snd.fx = (k) => { try { if (FX[k]) FX[k](); } catch (e) { /* ignore */ } };
Snd.engine = function (speed, on) {
  const c = ctx; if (!c) return;
  if (!eng) { eng = c.createOscillator(); engGain = c.createGain(); eng.type = 'sawtooth'; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500; eng.connect(f); f.connect(engGain); engGain.connect(master); engGain.gain.value = 0; eng.start(); }
  eng.frequency.setTargetAtTime(45 + Math.abs(speed) * 6, c.currentTime, 0.1);
  engGain.gain.setTargetAtTime(on && !muted ? 0.05 : 0, c.currentTime, 0.15);
};
const SCALES = { calm: [0, 2, 4, 7, 9, 12, 14], chase: [0, 3, 5, 7, 10, 12], night: [0, 2, 3, 7, 8, 12] };
Snd.music = function (m) { mood = m || mood; if (!musicOn) { musicOn = true; timer = setInterval(tick, 125); } };
Snd.mood = (m) => { mood = m; };
let root = 196;
function tick() {
  if (!ctx || muted || document.hidden) return;
  beat++;
  const fast = mood === 'chase', sc = SCALES[mood] || SCALES.calm;
  if (!fast && beat % 2) return;
  const step = beat % 16;
  if (step % 4 === 0) tone(root / 2 * (step === 8 ? 1.335 : 1), 0.3, 'triangle', 0.07);
  if (Math.random() < (fast ? 0.7 : 0.45)) tone(root * Math.pow(2, sc[(Math.random() * sc.length) | 0] / 12) * (Math.random() < 0.3 ? 2 : 1), fast ? 0.12 : 0.28, fast ? 'square' : 'sine', fast ? 0.035 : 0.05);
  if (fast && step % 2 === 0) noise(0.04, 0.05, 5000);
}
Snd.setRoot = (r) => { root = r; };
})();
