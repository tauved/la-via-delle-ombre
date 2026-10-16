// =============================================================
//  game/audio.js — musica di Tauh + effetti sonori sintetizzati
//
//  La musica viene caricata da file (assets/incubo.mp3) e passa in un
//  analizzatore: i bassi fanno pulsare l'Occhio nel cielo, la carne
//  dei muri e la fiamma nera. Gli effetti sono tutti generati con
//  la Web Audio API: niente file esterni.
// =============================================================
import { clamp } from '../engine/math.js';

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.musicVol = 0.75;
    this.sfxVol = 0.8;
    this.L = { x: 0, z: 0, yaw: 0 };
    this.bass = 0; this.bassAvg = 0; this.beat = 0;
    this.musicReady = false;
    this.musicData = null;
    this.wantMusic = false;
  }

  prefetch(url) {
    this.musicData = fetch(url).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); }).catch((e) => { console.warn('Musica non caricata:', e); return null; });
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.connect(ctx.destination);
    this.musicFilter = ctx.createBiquadFilter(); this.musicFilter.type = 'lowpass'; this.musicFilter.frequency.value = 20000;
    this.musicGain = ctx.createGain(); this.musicGain.gain.value = this.musicVol;
    this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 1024; this.analyser.smoothingTimeConstant = 0.55;
    this.musicFilter.connect(this.musicGain); this.musicGain.connect(this.analyser); this.analyser.connect(this.master);
    this.freq = new Uint8Array(this.analyser.frequencyBinCount);
    this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 4;
    this.sfx.connect(comp); comp.connect(this.master);
    this.reverb = ctx.createConvolver(); this.reverb.buffer = this._impulse(2.8, 2.4);
    this.rev = ctx.createGain(); this.rev.gain.value = 0.32;
    this.reverb.connect(this.rev); this.rev.connect(this.sfx);
    const n = ctx.sampleRate * 2, nb = ctx.createBuffer(1, n, ctx.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
    this.dist = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; curve[i] = Math.tanh(x * 4); }
    this.dist.curve = curve;
    this.dist.connect(this.sfx);
    if (this.musicData) this.musicData.then(async (ab) => {
      if (!ab) return;
      try {
        this.musicBuf = await ctx.decodeAudioData(ab);
        this.musicReady = true;
        if (this.wantMusic) this.playMusic();
      } catch (e) { console.warn('Decodifica musica fallita', e); }
    });
  }

  _impulse(dur, decay) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return b;
  }

  playMusic() {
    this.wantMusic = true;
    if (!this.ctx || !this.musicReady || this.musicSrc) return;
    const s = this.ctx.createBufferSource();
    s.buffer = this.musicBuf; s.loop = true;
    s.connect(this.musicFilter);
    s.start();
    this.musicSrc = s;
  }

  setMuffled(on) {
    if (!this.ctx) return;
    this.musicFilter.frequency.setTargetAtTime(on ? 520 : 20000, this.ctx.currentTime, 0.2);
  }

  setMusicVolume(v) { this.musicVol = v; if (this.musicGain) this.musicGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); }
  setSfxVolume(v) { this.sfxVol = v; if (this.sfx) this.sfx.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); }

  // Energia dei bassi della musica, 0..1, ammorbidita
  update(dt) {
    if (!this.analyser || !this.musicSrc) { this.bass *= 0.9; this.beat *= 0.9; return; }
    this.analyser.getByteFrequencyData(this.freq);
    let s = 0;
    for (let i = 1; i <= 5; i++) s += this.freq[i];
    const b = s / (5 * 255);
    this.bass += (b - this.bass) * Math.min(1, dt * 18);
    this.bassAvg += (b - this.bassAvg) * Math.min(1, dt * 1.5);
    const hit = Math.max(0, b - this.bassAvg - 0.04) * 4;
    this.beat = Math.max(hit, this.beat - dt * 3);
  }

  setListener(x, z, yaw) { this.L.x = x; this.L.z = z; this.L.yaw = yaw; }

  // ---------- mattoni ----------
  _out(x, z, vol = 1, wet = 1) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    let pan = 0, att = 1;
    if (x !== undefined && x !== null) {
      const dx = x - this.L.x, dz = z - this.L.z, d = Math.hypot(dx, dz);
      att = 1 / (1 + d / 16);
      const rx = Math.cos(this.L.yaw), rz = -Math.sin(this.L.yaw);
      pan = clamp(((dx * rx + dz * rz) / (d || 1)) * Math.min(1, d / 5), -0.9, 0.9);
    }
    g.gain.value = vol * att;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner(); p.pan.value = pan;
      g.connect(p); p.connect(this.sfx);
      if (wet) { const w = ctx.createGain(); w.gain.value = wet; p.connect(w); w.connect(this.reverb); }
    } else { g.connect(this.sfx); if (wet) g.connect(this.reverb); }
    return g;
  }

  _env(gainNode, t, attack, dur, vol) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
    g.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  _noise(dest, { dur = 0.2, type = 'bandpass', f0 = 1000, f1 = f0, q = 1, vol = 0.5, attack = 0.005, delay = 0 }) {
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain(); this._env(g, t, attack, dur, vol);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }

  _tone(dest, { type = 'sine', f0 = 440, f1 = f0, dur = 0.3, vol = 0.3, attack = 0.005, delay = 0, detune = 0 }) {
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type; o.detune.value = detune;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t + dur);
    const g = ctx.createGain(); this._env(g, t, attack, dur, vol);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // coro angelico: accordo di dente di sega filtrato su formanti di vocale
  _choir(dest, freqs, { dur = 0.8, attack = 0.08, glide = 1, vib = 5.5, vol = 0.22, formant = 850, delay = 0 } = {}) {
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const out = ctx.createGain(); this._env(out, t, attack, dur, vol);
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = formant; f1.Q.value = 2.5;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = formant * 1.45 + 300; f2.Q.value = 4;
    f1.connect(out); f2.connect(out); out.connect(dest);
    const lfo = ctx.createOscillator(); lfo.frequency.value = vib;
    const lg = ctx.createGain(); lg.gain.value = 18; lfo.connect(lg);
    for (const f of freqs) for (const det of [-9, 8]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.detune.value = det;
      o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * glide, t + dur);
      lg.connect(o.detune); o.connect(f1); o.connect(f2);
      o.start(t); o.stop(t + dur + 0.05);
    }
    lfo.start(t); lfo.stop(t + dur + 0.05);
  }

  _ok() { return this.ctx && this.ctx.state === 'running'; }

  // ---------- armi ----------
  claws() { if (!this._ok()) return; const o = this._out(null, null, 0.7, 0.2); this._noise(o, { dur: 0.2, f0: 3200, f1: 500, q: 1.2, vol: 0.6 }); }
  clawHit() { if (!this._ok()) return; const o = this._out(null, null, 0.8, 0.3); this._noise(o, { dur: 0.12, type: 'lowpass', f0: 1800, f1: 200, vol: 0.8 }); this._tone(o, { type: 'triangle', f0: 180, f1: 60, dur: 0.12, vol: 0.4 }); }
  fiamma() {
    if (!this._ok()) return;
    const o = this._out(null, null, 0.55, 0.25);
    this._noise(o, { dur: 0.16, type: 'lowpass', f0: 2600, f1: 300, vol: 0.5 });
    this._tone(o, { type: 'sine', f0: 320, f1: 70, dur: 0.14, vol: 0.45 });
  }
  thanateros() {
    if (!this._ok()) return;
    const o = this._out(null, null, 1, 0.5);
    this._noise(o, { dur: 0.45, type: 'lowpass', f0: 4200, f1: 180, vol: 1 });
    this._tone(o, { type: 'sine', f0: 110, f1: 38, dur: 0.32, vol: 0.9 });
    this._noise(o, { dur: 0.05, f0: 2600, q: 6, vol: 0.4, delay: 0.5 });
    this._noise(o, { dur: 0.05, f0: 2100, q: 6, vol: 0.45, delay: 0.62 });
  }
  sigilFire() {
    if (!this._ok()) return;
    const o = this._out(null, null, 0.8, 0.6);
    this._tone(o, { type: 'sine', f0: 180, f1: 980, dur: 0.35, vol: 0.4 });
    this._choir(o, [146.8, 220, 277.2], { dur: 0.6, attack: 0.02, glide: 1.5, vol: 0.18, formant: 700 });
    this._noise(o, { dur: 0.4, f0: 500, f1: 3000, q: 0.8, vol: 0.4 });
  }
  explosion(x, z) {
    if (!this._ok()) return;
    const o = this._out(x, z, 1.3, 0.8);
    this._noise(o, { dur: 1.1, type: 'lowpass', f0: 2400, f1: 80, vol: 1.1 });
    this._tone(o, { type: 'sine', f0: 70, f1: 28, dur: 0.8, vol: 0.9 });
    this._noise(o, { dur: 0.3, f0: 4000, f1: 1200, q: 1, vol: 0.3 });
  }
  empty() { if (!this._ok()) return; const o = this._out(null, null, 0.5, 0); this._noise(o, { dur: 0.04, f0: 3000, q: 8, vol: 0.5 }); }
  switchWeapon() { if (!this._ok()) return; const o = this._out(null, null, 0.4, 0.1); this._noise(o, { dur: 0.08, f0: 1500, q: 3, vol: 0.4 }); this._tone(o, { type: 'triangle', f0: 260, f1: 180, dur: 0.1, vol: 0.2, delay: 0.05 }); }

  // ---------- angeli ----------
  angelWake(type, x, z) {
    if (!this._ok()) return;
    const o = this._out(x, z, 1, 0.9);
    if (type === 'ofano') this._choir(o, [880, 932.3, 1318.5], { dur: 1.0, glide: 1.06, vol: 0.16, formant: 1200 });
    else if (type === 'serafino') { this._choir(o, [523.3, 554.4, 784], { dur: 0.7, glide: 1.25, vol: 0.18, formant: 900 }); this._noise(o, { dur: 0.6, type: 'highpass', f0: 3000, vol: 0.2 }); }
    else if (type === 'cherubino') this._choir(o, [220, 233.1, 329.6, 440], { dur: 1.4, glide: 0.97, vol: 0.2, formant: 650 });
    else this.bossRoar(1);
  }
  angelPain(type, x, z) {
    if (!this._ok()) return;
    const o = this._out(x, z, 0.8, 0.5);
    const b = type === 'cherubino' ? 330 : type === 'serafino' ? 700 : 990;
    this._choir(o, [b, b * 1.06], { dur: 0.28, attack: 0.01, glide: 1.35, vol: 0.2, formant: 1100 });
  }
  angelDeath(type, x, z) {
    if (!this._ok()) return;
    const o = this._out(x, z, 1.1, 1);
    const b = type === 'cherubino' ? 262 : type === 'serafino' ? 523 : type === 'esattore' ? 110 : 784;
    this._choir(o, [b, b * 1.189, b * 1.498], { dur: type === 'esattore' ? 3.5 : 1.3, attack: 0.02, glide: 0.35, vol: 0.26, formant: 900 });
    this._noise(o, { dur: 0.5, f0: 6000, f1: 800, q: 0.7, vol: 0.35 });
    this._tone(o, { type: 'sine', f0: 1760, f1: 1760, dur: 1.2, vol: 0.12 });
    this._tone(o, { type: 'sine', f0: 2637, f1: 2637, dur: 0.9, vol: 0.08 });
  }
  angelHiss(x, z) { if (!this._ok()) return; const o = this._out(x, z, 0.8, 0.3); this._noise(o, { dur: 0.35, type: 'highpass', f0: 2500, f1: 5000, vol: 0.35 }); this._choir(o, [392, 415.3], { dur: 0.35, glide: 1.4, vol: 0.12, formant: 1300 }); }
  bite(x, z) { if (!this._ok()) return; const o = this._out(x, z, 1, 0.3); this._noise(o, { dur: 0.08, f0: 900, q: 2, vol: 0.9 }); this._noise(o, { dur: 0.08, f0: 1600, q: 2, vol: 0.8, delay: 0.09 }); }
  orbFire(x, z, pitch = 1) {
    if (!this._ok()) return;
    const o = this._out(x, z, 0.7, 0.8);
    this._tone(o, { type: 'sine', f0: 880 * pitch, f1: 870 * pitch, dur: 0.7, vol: 0.25 });
    this._tone(o, { type: 'sine', f0: 1318 * pitch, f1: 1310 * pitch, dur: 0.5, vol: 0.15 });
    this._noise(o, { dur: 0.2, f0: 2000, f1: 5000, q: 1, vol: 0.12 });
  }
  impact(x, z, holy = false) {
    if (!this._ok()) return;
    const o = this._out(x, z, 0.6, 0.4);
    if (holy) this._tone(o, { type: 'sine', f0: 1600, f1: 1200, dur: 0.15, vol: 0.2 });
    this._noise(o, { dur: 0.15, type: 'lowpass', f0: 1500, f1: 200, vol: 0.5 });
  }
  hitAngel(x, z) { if (!this._ok()) return; const o = this._out(x, z, 0.45, 0.4); this._tone(o, { type: 'triangle', f0: 2200 + Math.random() * 600, f1: 1800, dur: 0.09, vol: 0.25 }); }
  bossRoar(k = 1) {
    if (!this._ok()) return;
    const o = this._out(null, null, k, 1);
    this._choir(this.dist, [55, 58.3, 82.4, 110], { dur: 1.6, attack: 0.15, glide: 0.92, vol: 0.13 * k, formant: 500 });
    this._choir(o, [110, 116.5, 164.8], { dur: 1.4, attack: 0.1, glide: 0.9, vol: 0.2 * k, formant: 600 });
    this._noise(o, { dur: 1.2, type: 'lowpass', f0: 900, f1: 120, vol: 0.4 * k });
  }

  // ---------- giocatore e mondo ----------
  playerHurt() {
    if (!this._ok()) return;
    this._tone(this.dist, { type: 'sawtooth', f0: 95, f1: 60, dur: 0.28, vol: 0.18 });
    const o = this._out(null, null, 0.6, 0.2); this._noise(o, { dur: 0.15, type: 'lowpass', f0: 900, f1: 200, vol: 0.5 });
  }
  playerDeath() {
    if (!this._ok()) return;
    this._tone(this.dist, { type: 'sawtooth', f0: 110, f1: 30, dur: 1.8, vol: 0.2 });
    const o = this._out(null, null, 0.8, 1);
    this._choir(o, [440, 466.2, 659.3, 880], { dur: 2.5, attack: 0.4, glide: 1.02, vol: 0.18, formant: 1000, delay: 0.3 });
  }
  pickup(kind) {
    if (!this._ok()) return;
    const o = this._out(null, null, 0.6, 0.5);
    if (kind === 'health') { this._tone(o, { f0: 660, dur: 0.18, vol: 0.3 }); this._tone(o, { f0: 990, dur: 0.3, vol: 0.25, delay: 0.08 }); }
    else if (kind === 'weapon') {
      this._tone(this.dist, { type: 'sawtooth', f0: 82.4, dur: 0.9, vol: 0.12 });
      this._tone(o, { type: 'sawtooth', f0: 123.5, dur: 0.9, vol: 0.12 });
      this._choir(o, [329.6, 415.3, 493.9], { dur: 1.2, vol: 0.15, formant: 800 });
    } else if (kind === 'key') this._choir(o, [440, 554.4, 659.3, 880], { dur: 1.5, attack: 0.05, vol: 0.18, formant: 1000 });
    else { this._noise(o, { dur: 0.05, f0: 2400, q: 4, vol: 0.4 }); this._tone(o, { type: 'triangle', f0: 520, f1: 780, dur: 0.12, vol: 0.2, delay: 0.03 }); }
  }
  soul() { if (!this._ok()) return; const o = this._out(null, null, 0.35, 0.6); this._tone(o, { f0: 1320 + Math.random() * 400, f1: 1980, dur: 0.25, vol: 0.18 }); }
  door(x, z, heavy = false) {
    if (!this._ok()) return;
    const o = this._out(x, z, 0.9, 0.6);
    this._noise(o, { dur: heavy ? 1.7 : 0.8, type: 'lowpass', f0: 500, f1: 160, vol: 0.7 });
    this._tone(o, { type: 'sine', f0: 52, f1: 45, dur: heavy ? 1.6 : 0.7, vol: 0.5 });
  }
  locked() { if (!this._ok()) return; const o = this._out(null, null, 0.5, 0.2); this._tone(o, { type: 'square', f0: 110, f1: 104, dur: 0.3, vol: 0.18 }); }
  secret() { if (!this._ok()) return; const o = this._out(null, null, 0.8, 1); this._choir(o, [220, 311.1, 415.3], { dur: 2.2, attack: 0.3, vol: 0.18, formant: 700 }); }
  cage(x, z) {
    if (!this._ok()) return;
    const o = this._out(x, z, 0.9, 0.8);
    for (const f of [1210, 1730, 2310, 3080]) this._tone(o, { type: 'sine', f0: f, f1: f * 0.98, dur: 1.1, vol: 0.1 });
    this._noise(o, { dur: 0.25, f0: 3000, q: 1, vol: 0.4 });
  }
  portal() { if (!this._ok()) return; const o = this._out(null, null, 0.9, 1); this._choir(o, [261.6, 329.6, 392, 523.3], { dur: 3, attack: 0.6, glide: 1.0, vol: 0.2, formant: 900 }); this._tone(o, { f0: 200, f1: 1600, dur: 2.5, vol: 0.12 }); }
  victory() { if (!this._ok()) return; const o = this._out(null, null, 0.9, 1); this._choir(o, [146.8, 220, 293.7, 349.2], { dur: 4, attack: 0.5, vol: 0.2, formant: 800 }); }
}
