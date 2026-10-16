// =============================================================
//  game/fx.js — particelle: icore dorato, fiamma nera, anime, esplosioni
// =============================================================
import { rand, lerp } from '../engine/math.js';

const MAX = 1600;

export class FX {
  constructor(renderer) { this.r = renderer; this.p = []; }

  spawn(o) {
    if (this.p.length >= MAX) this.p.shift();
    this.p.push({
      x: o.x, y: o.y, z: o.z,
      vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0,
      life: o.life || 0.6, t: 0,
      s0: o.s0 ?? 0.4, s1: o.s1 ?? 0.1,
      c: o.c || [1, 1, 1], a0: o.a0 ?? 1, a1: o.a1 ?? 0,
      style: o.style || 0, add: o.add !== false,
      grav: o.grav || 0, drag: o.drag ?? 1,
      home: o.home || null,
    });
  }

  update(dt) {
    const P = this.p;
    let w = 0;
    for (let i = 0; i < P.length; i++) {
      const q = P[i];
      q.t += dt;
      if (q.t >= q.life) continue;
      if (q.home) {
        // anime che volano verso il giocatore
        const h = q.home(), dx = h[0] - q.x, dy = h[1] - q.y, dz = h[2] - q.z;
        const d = Math.hypot(dx, dy, dz) || 1, k = Math.min(1, q.t / 0.6) * 40;
        q.vx += (dx / d) * k * dt; q.vy += (dy / d) * k * dt; q.vz += (dz / d) * k * dt;
        q.vx *= 0.96; q.vy *= 0.96; q.vz *= 0.96;
      }
      q.vy -= q.grav * dt;
      if (q.drag !== 1) { const f = Math.pow(q.drag, dt * 60); q.vx *= f; q.vy *= f; q.vz *= f; }
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      if (q.y < 0.05 && q.grav > 0) { q.y = 0.05; q.vy *= -0.3; q.vx *= 0.6; q.vz *= 0.6; }
      P[w++] = q;
    }
    P.length = w;
  }

  draw() {
    const A = this.r.fxAdd, B = this.r.fxAlpha;
    for (const q of this.p) {
      const k = q.t / q.life;
      const s = lerp(q.s0, q.s1, k), a = lerp(q.a0, q.a1, k);
      (q.add ? A : B).push(q.x, q.y, q.z, s, q.c[0], q.c[1], q.c[2], a, q.style);
    }
  }

  // ---------- ricette ----------
  ichor(x, y, z, n = 8) {
    for (let i = 0; i < n; i++) {
      this.spawn({ x, y, z, vx: rand(-5, 5), vy: rand(-1, 6), vz: rand(-5, 5), life: rand(0.4, 0.8), s0: rand(0.18, 0.36), s1: 0.05, c: [1, 0.78, 0.25], style: 1, add: false, grav: 14, a0: 1, a1: 1 });
    }
    for (let i = 0; i < n / 2; i++) {
      this.spawn({ x, y, z, vx: rand(-7, 7), vy: rand(-2, 7), vz: rand(-7, 7), life: rand(0.2, 0.4), s0: 0.35, s1: 0.0, c: [1, 0.95, 0.7], style: 3 });
    }
  }

  holyHit(x, y, z) {
    this.spawn({ x, y, z, life: 0.25, s0: 0.6, s1: 2.2, c: [1, 0.9, 0.55], a0: 0.9, style: 2 });
    for (let i = 0; i < 8; i++) this.spawn({ x, y, z, vx: rand(-6, 6), vy: rand(-3, 6), vz: rand(-6, 6), life: rand(0.25, 0.5), s0: 0.3, s1: 0, c: [1, 0.9, 0.6], style: 3 });
  }

  blackFlame(x, y, z, n = 3, spread = 0.12, k = 1) {
    for (let i = 0; i < n; i++) {
      this.spawn({ x: x + rand(-spread, spread), y: y + rand(-spread, spread), z: z + rand(-spread, spread), vy: rand(0.6, 1.6) * k, vx: rand(-0.3, 0.3) * k, vz: rand(-0.3, 0.3) * k, life: rand(0.25, 0.45), s0: rand(0.08, 0.14) * k, s1: 0.02 * k, c: [0.81, 1, 0.5], style: 0, a0: 0.9 });
    }
    if (Math.random() < 0.5) this.spawn({ x, y, z, vy: rand(0.4, 1) * k, life: 0.5, s0: 0.1 * k, s1: 0.2 * k, c: [0.08, 0.03, 0.12], style: 1, add: false, a0: 0.85, a1: 0 });
  }

  trail(x, y, z, kind) {
    if (kind === 'bolt') {
      this.spawn({ x, y, z, vx: rand(-0.5, 0.5), vy: rand(0, 1), vz: rand(-0.5, 0.5), life: 0.32, s0: 0.32, s1: 0.04, c: [0.81, 1, 0.5], a0: 0.75 });
      this.spawn({ x, y, z, life: 0.45, s0: 0.22, s1: 0.4, c: [0.1, 0.04, 0.15], style: 1, add: false, a0: 0.8, a1: 0 });
    } else if (kind === 'sigil') {
      this.spawn({ x, y, z, vx: rand(-1, 1), vy: rand(-1, 1), vz: rand(-1, 1), life: 0.5, s0: 0.5, s1: 0.05, c: [0.81, 1, 0.5], a0: 0.8 });
      this.spawn({ x, y, z, life: 0.6, s0: 0.5, s1: 0.1, c: [0.45, 0.32, 0.85], a0: 0.6 });
    } else if (kind === 'orb') {
      this.spawn({ x, y, z, vx: rand(-0.4, 0.4), vy: rand(-0.4, 0.4), vz: rand(-0.4, 0.4), life: 0.35, s0: 0.35, s1: 0.03, c: [1, 0.85, 0.45], a0: 0.6 });
    } else if (kind === 'bigorb') {
      this.spawn({ x, y, z, vx: rand(-1, 1), vy: rand(-1, 1), vz: rand(-1, 1), life: 0.5, s0: 0.8, s1: 0.05, c: [1, 0.4, 0.35], a0: 0.7 });
    }
  }

  boltHit(x, y, z) {
    this.spawn({ x, y, z, life: 0.22, s0: 0.4, s1: 1.6, c: [0.81, 1, 0.5], a0: 0.9, style: 2 });
    for (let i = 0; i < 6; i++) this.spawn({ x, y, z, vx: rand(-5, 5), vy: rand(-2, 5), vz: rand(-5, 5), life: rand(0.2, 0.4), s0: 0.2, s1: 0, c: [0.81, 1, 0.5], style: 3 });
    for (let i = 0; i < 3; i++) this.spawn({ x, y, z, vx: rand(-1, 1), vy: rand(0, 2), vz: rand(-1, 1), life: 0.6, s0: 0.3, s1: 0.6, c: [0.1, 0.04, 0.15], style: 1, add: false, a0: 0.8, a1: 0 });
  }

  boneDust(x, y, z) {
    for (let i = 0; i < 4; i++) this.spawn({ x, y, z, vx: rand(-3, 3), vy: rand(0, 4), vz: rand(-3, 3), life: rand(0.3, 0.6), s0: rand(0.12, 0.22), s1: 0.03, c: [0.92, 0.88, 0.78], style: 1, add: false, grav: 12, a0: 1, a1: 1 });
    this.spawn({ x, y, z, life: 0.12, s0: 0.5, s1: 0.1, c: [1, 0.95, 0.8], style: 3 });
  }

  explosion(x, y, z, big = 1) {
    this.spawn({ x, y, z, life: 0.35, s0: 1, s1: 9 * big, c: [0.81, 1, 0.5], a0: 0.9, style: 2 });
    this.spawn({ x, y, z, life: 0.5, s0: 2, s1: 7 * big, c: [0.6, 0.45, 1], a0: 0.8, style: 0 });
    for (let i = 0; i < 18 * big; i++) {
      const s = rand(0.5, 1.2) * big;
      this.spawn({ x: x + rand(-1, 1), y: y + rand(-1, 1), z: z + rand(-1, 1), vx: rand(-9, 9), vy: rand(-2, 9), vz: rand(-9, 9), life: rand(0.4, 0.8), s0: s, s1: s * 0.3, c: Math.random() < 0.5 ? [0.4, 0.3, 0.75] : [0.12, 0.05, 0.2], style: 1, add: false, drag: 0.9, a0: 1, a1: 1 });
    }
    for (let i = 0; i < 24 * big; i++) this.spawn({ x, y, z, vx: rand(-16, 16), vy: rand(-6, 14), vz: rand(-16, 16), life: rand(0.3, 0.7), s0: 0.3, s1: 0, c: [0.81, 1, 0.5], style: 3, grav: 10 });
  }

  souls(x, y, z, n = 12, home = null) {
    for (let i = 0; i < n; i++) {
      this.spawn({ x: x + rand(-0.5, 0.5), y: y + rand(-0.5, 0.5), z: z + rand(-0.5, 0.5), vx: rand(-3, 3), vy: rand(3, 9), vz: rand(-3, 3), life: rand(1.2, 2.2), s0: rand(0.3, 0.55), s1: 0.1, c: [0.81, 1, 0.5], a0: 1, a1: 0.2, drag: 0.98, home });
    }
  }

  shockRing(x, y, z, size = 6, c = [1, 0.9, 0.5]) {
    this.spawn({ x, y, z, life: 0.4, s0: 0.5, s1: size, c, a0: 0.8, style: 2 });
  }

  slash(x, y, z, dx, dz) {
    for (let i = 0; i < 10; i++) {
      const t = i / 9 - 0.5;
      this.spawn({ x: x + dz * t * 2.2, y: y + t * 0.6, z: z - dx * t * 2.2, vx: dx * 2, vz: dz * 2, life: 0.18, s0: 0.35, s1: 0.05, c: [0.81, 1, 0.5], a0: 0.9, style: 3 });
    }
  }
}
