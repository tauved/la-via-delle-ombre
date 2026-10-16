// =============================================================
//  main.js — avvio, input (tastiera, mouse, touch), ciclo dei fotogrammi
// =============================================================
import { Game } from './game/game.js';
import { UI } from './game/ui.js';

const canvas = document.getElementById('c');
const uiRoot = document.getElementById('ui');
const MUSIC_URL = 'assets/incubo.mp3';

let game = null, ui = null;
let locked = false, noLock = false, rightDrag = false, lockedAt = 0;
let turnL = false, turnR = false;
let scale = 1, perfT = 0;
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

function boot() {
  window.__tauh = () => game; // utile per il debug dalla console
  ui = new UI(uiRoot);
  try {
    game = new Game(canvas, ui, MUSIC_URL);
  } catch (e) {
    console.error(e);
    uiRoot.innerHTML = `<div class="screen"><h1>INCUBO</h1><p class="intro">${String(e.message).includes('WEBGL2') ? 'Questo browser non supporta WebGL2, che serve al gioco. Prova con Chrome, Edge, Firefox o Safari aggiornati.' : 'Errore di avvio: ' + e.message}</p></div>`;
    return;
  }
  game.sensitivity = 1;
  ui.bind(game);
  ui.setState('title');
  if (isTouch) ui.enableTouch();
  resize();
  window.addEventListener('resize', resize);
  setupKeyboard();
  setupMouse();
  if (isTouch) setupTouch();
  loadSettings();
  for (const id of ['btn-start', 'btn-resume']) document.getElementById(id).addEventListener('click', () => { requestLock(); if (isTouch) landscape(); });
  requestAnimationFrame(loop);
}

function resize() {
  const pr = Math.min(window.devicePixelRatio || 1, 1.5) * scale;
  let w = canvas.clientWidth * pr, h = canvas.clientHeight * pr;
  const max = 1920 * 1080;
  if (w * h > max) { const k = Math.sqrt(max / (w * h)); w *= k; h *= k; }
  game.r.setSize(w, h);
}

let lastLoopT = 0;
function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, lastLoopT ? (t - lastLoopT) / 1000 : 0.016);
  lastLoopT = t;
  if (game.state === 'play') {
    const turn = 2.6 * dt * game.sensitivity;   // radianti al secondo con le frecce
    if (turnL) game.player.look(-turn, 0);
    if (turnR) game.player.look(turn, 0);
  }
  game.frame(t);
  if (game.state !== 'play' && locked) document.exitPointerLock?.();
  // risoluzione adattiva: se il computer fatica, si abbassa un po'
  perfT += dt;
  if (perfT > 2) {
    perfT = 0;
    if (game.fps < 40 && scale > 0.55) { scale = Math.max(0.55, scale - 0.15); resize(); }
    else if (game.fps > 58 && scale < 1) { scale = Math.min(1, scale + 0.05); resize(); }
  }
}

// ---------------- tastiera ----------------
const KEYS = {
  KeyW: 'fwd', KeyZ: 'fwd', ArrowUp: 'fwd',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', KeyQ: 'left',
  KeyD: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
};

function setupKeyboard() {
  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT') return;
    const inp = game.input;
    if (KEYS[e.code]) inp[KEYS[e.code]] = true;
    if (e.code === 'ArrowLeft') turnL = true;
    if (e.code === 'ArrowRight') turnR = true;
    if (/^Digit[1-4]$/.test(e.code)) game.weapons.select(+e.code.slice(5));
    if (e.code === 'KeyE' || e.code === 'Space') inp.use = true;
    if (e.code === 'ControlLeft' || e.code === 'ControlRight') inp.fire = true;
    if (e.code === 'KeyF') ui.showFps = !ui.showFps;
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (game.state === 'play') game.pause();
      else if (game.state === 'pause' && e.code === 'KeyP') { game.resume(); requestLock(); }
    }
    if (e.code === 'Enter' && game.state === 'title') { game.start(); requestLock(); }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    const inp = game.input;
    if (KEYS[e.code]) inp[KEYS[e.code]] = false;
    if (e.code === 'ArrowLeft') turnL = false;
    if (e.code === 'ArrowRight') turnR = false;
    if (e.code === 'ControlLeft' || e.code === 'ControlRight') inp.fire = false;
  });
  window.addEventListener('blur', () => { for (const k in game.input) game.input[k] = false; turnL = turnR = false; });
}

// ---------------- mouse ----------------
function requestLock() {
  if (isTouch || noLock || locked) return;
  try {
    const p = canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => lockFailed());
  } catch (e) { lockFailed(); }
}

// Su Android (e dove il browser lo permette) il gioco va a schermo intero e si gira in orizzontale,
// anche con la rotazione automatica spenta. Su iPhone e nei browser dentro le app non si può:
// lì il gioco resta in verticale, con l'inquadratura allargata da fovPerSchermo().
function landscape() {
  const el = document.documentElement;
  if (document.fullscreenElement || !el.requestFullscreen) return;
  el.requestFullscreen({ navigationUI: 'hide' })
    .then(() => screen.orientation?.lock?.('landscape'))
    .catch(() => {});
}

function lockFailed() {
  if (noLock) return;
  noLock = true;
  ui.hint('Mouse non catturabile qui: muovilo per guardarti intorno, o usa le frecce');
}

function setupMouse() {
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
    lockedAt = performance.now();
    if (!locked && game.state === 'play' && !noLock) game.pause();
  });
  document.addEventListener('pointerlockerror', lockFailed);
  canvas.addEventListener('mousedown', (e) => {
    if (game.state !== 'play') return;
    if (!locked) requestLock();
    if (e.button === 0) game.input.fire = true;
    if (e.button === 2) rightDrag = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) game.input.fire = false;
    if (e.button === 2) rightDrag = false;
  });
  document.addEventListener('mousemove', (e) => {
    if (game.state !== 'play') return;
    if (locked || noLock) {
      // appena catturato, il browser può mandare un salto enorme: lo ignoriamo
      if (locked && performance.now() - lockedAt < 150) return;
      if (Math.abs(e.movementX) > 300 || Math.abs(e.movementY) > 300) return;
      const k = (noLock ? 0.004 : 0.0022) * game.sensitivity;
      game.player.look(e.movementX * k, e.movementY * k);
    }
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => { if (game.state === 'play') { game.weapons.scrollSelect(e.deltaY > 0 ? 1 : -1); e.preventDefault(); } }, { passive: false });
}

// ---------------- touch ----------------
// Sinistra: levetta per muoversi. Destra: trascina per girarti.
// ATTACCA: tienilo premuto per sparare e trascinalo per mirare intanto.
function setupTouch() {
  game.touchMode = true;
  const stick = { id: null, x0: 0, y0: 0 };
  const look = { id: null, x: 0, y: 0, t: 0 };
  let fireId = null;
  const pressed = new Map();
  const knob = document.getElementById('t-knob'), base = document.getElementById('t-stick');
  const area = document.getElementById('touch');
  const beginLook = (t) => { look.id = t.identifier; look.x = t.clientX; look.y = t.clientY; look.t = performance.now(); };

  area.addEventListener('touchstart', (e) => {
    for (const t of e.changedTouches) {
      const btn = t.target.closest ? t.target.closest('button') : null;
      if (btn) {
        pressed.set(t.identifier, btn); btn.classList.add('down');
        if (btn.id === 't-fire') { fireId = t.identifier; game.input.fire = true; if (look.id === null) beginLook(t); }
        else if (btn.id === 't-use') game.input.use = true;
        else if (btn.id === 't-weapon') game.weapons.scrollSelect(1);
        else if (btn.id === 't-pause') game.pause();
        continue;
      }
      if (t.clientX < window.innerWidth * 0.42 && stick.id === null) {
        stick.id = t.identifier; stick.x0 = t.clientX; stick.y0 = t.clientY;
        base.style.left = t.clientX + 'px'; base.style.top = t.clientY + 'px'; base.classList.add('on');
      } else if (look.id === null) beginLook(t);
    }
    e.preventDefault();
  }, { passive: false });

  area.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stick.id) {
        let dx = (t.clientX - stick.x0) / 55, dy = (t.clientY - stick.y0) / 55;
        const l = Math.hypot(dx, dy);
        if (l > 1) { dx /= l; dy /= l; }
        if (l < 0.12) { dx = 0; dy = 0; }   // zona morta
        game.input.ax = dx; game.input.az = dy;
        game.input.run = l > 0.95;
        knob.style.transform = `translate(${dx * 40}px, ${dy * 40}px)`;
      } else if (t.identifier === look.id) {
        const now = performance.now(), dtm = Math.max(8, now - look.t);
        const dx = t.clientX - look.x, dy = t.clientY - look.y;
        look.x = t.clientX; look.y = t.clientY; look.t = now;
        // accelerazione: i gesti veloci girano molto di più di quelli lenti e precisi
        const speed = Math.hypot(dx, dy) / dtm;            // pixel al millisecondo
        const k = 0.007 * game.sensitivity * (1 + Math.min(0.8, speed * 0.35));
        game.player.look(dx * k, dy * k * 0.7);
      }
    }
    e.preventDefault();
  }, { passive: false });

  const end = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stick.id) { stick.id = null; game.input.ax = 0; game.input.az = 0; game.input.run = false; knob.style.transform = ''; base.classList.remove('on'); }
      if (t.identifier === look.id) look.id = null;
      if (t.identifier === fireId) { fireId = null; game.input.fire = false; }
      const b = pressed.get(t.identifier);
      if (b) { b.classList.remove('down'); pressed.delete(t.identifier); }
    }
  };
  area.addEventListener('touchend', end);
  area.addEventListener('touchcancel', end);
}

// ---------------- impostazioni salvate (solo su questo browser) ----------------
const SETTINGS_KEY = 'tauh-incubo-impostazioni';
function loadSettings() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {}; } catch (e) { s = {}; }
  const set = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined) el.value = v; };
  if (typeof s.sens === 'number') { game.sensitivity = s.sens; set('sens', s.sens); }
  if (typeof s.music === 'number') { game.audio.musicVol = s.music; set('vol-music', s.music); }
  if (typeof s.sfx === 'number') { game.audio.sfxVol = s.sfx; set('vol-sfx', s.sfx); }
  const save = () => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ sens: game.sensitivity, music: game.audio.musicVol, sfx: game.audio.sfxVol }));
    } catch (e) { /* storage non disponibile: pazienza */ }
  };
  for (const id of ['sens', 'vol-music', 'vol-sfx']) document.getElementById(id)?.addEventListener('change', save);
}

// Avvio compatibile con l'aggiornamento "a caldo" degli artifact
if (window.claude?.hot?.ready) window.claude.hot.ready(boot); else boot();
