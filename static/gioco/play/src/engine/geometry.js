// =============================================================
//  engine/geometry.js — costruttori di forme base
//  Ogni forma è un "Geo": array di posizioni, normali, uv, colori e indici.
//  I triangoli si orientano da soli in base alle normali, così non
//  bisogna preoccuparsi dell'ordine dei vertici.
// =============================================================
import { mat4, compose, normalMat3, TAU } from './math.js';

const WHITE = [1, 1, 1];

export class Geo {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.i = []; }

  vert(x, y, z, nx, ny, nz, u = 0, v = 0, col = WHITE) {
    this.p.push(x, y, z);
    this.n.push(nx, ny, nz);
    this.uv.push(u, v);
    this.c.push(col[0], col[1], col[2]);
    return this.p.length / 3 - 1;
  }

  tri(a, b, c) {
    const p = this.p, n = this.n;
    const ux = p[b * 3] - p[a * 3], uy = p[b * 3 + 1] - p[a * 3 + 1], uz = p[b * 3 + 2] - p[a * 3 + 2];
    const vx = p[c * 3] - p[a * 3], vy = p[c * 3 + 1] - p[a * 3 + 1], vz = p[c * 3 + 2] - p[a * 3 + 2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    const nx = n[a * 3] + n[b * 3] + n[c * 3];
    const ny = n[a * 3 + 1] + n[b * 3 + 1] + n[c * 3 + 1];
    const nz = n[a * 3 + 2] + n[b * 3 + 2] + n[c * 3 + 2];
    if (fx * nx + fy * ny + fz * nz < 0) this.i.push(a, c, b);
    else this.i.push(a, b, c);
  }

  quad(a, b, c, d) { this.tri(a, b, c); this.tri(a, c, d); }

  get vertexCount() { return this.p.length / 3; }
}

// ---------- forme ----------

export function box(w, h, d, col = WHITE) {
  const g = new Geo(), x = w / 2, y = h / 2, z = d / 2;
  const U = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const F = (n, cs) => {
    const idx = cs.map((c, k) => g.vert(c[0], c[1], c[2], n[0], n[1], n[2], U[k][0], U[k][1], col));
    g.quad(idx[0], idx[1], idx[2], idx[3]);
  };
  F([1, 0, 0], [[x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z]]);
  F([-1, 0, 0], [[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z]]);
  F([0, 1, 0], [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z]]);
  F([0, -1, 0], [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z]]);
  F([0, 0, 1], [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]]);
  F([0, 0, -1], [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z]]);
  return g;
}

// Cilindro / tronco di cono lungo Y, centrato nell'origine
export function cylinder(rTop, rBot, h, segs = 12, caps = true, col = WHITE) {
  const g = new Geo(), y0 = -h / 2, y1 = h / 2;
  const slope = (rBot - rTop) / h, nl = Math.hypot(1, slope);
  for (let j = 0; j <= segs; j++) {
    const t = (j / segs) * TAU, cx = Math.cos(t), sz = Math.sin(t);
    g.vert(rBot * cx, y0, rBot * sz, cx / nl, slope / nl, sz / nl, j / segs, 0, col);
    g.vert(rTop * cx, y1, rTop * sz, cx / nl, slope / nl, sz / nl, j / segs, 1, col);
  }
  for (let j = 0; j < segs; j++) {
    const a = j * 2;
    g.quad(a, a + 2, a + 3, a + 1);
  }
  if (caps) {
    for (const [yy, r, ny] of [[y1, rTop, 1], [y0, rBot, -1]]) {
      if (r <= 0) continue;
      const c0 = g.vert(0, yy, 0, 0, ny, 0, 0.5, 0.5, col);
      const base = g.vertexCount;
      for (let j = 0; j <= segs; j++) {
        const t = (j / segs) * TAU;
        g.vert(r * Math.cos(t), yy, r * Math.sin(t), 0, ny, 0, 0.5 + 0.5 * Math.cos(t), 0.5 + 0.5 * Math.sin(t), col);
      }
      for (let j = 0; j < segs; j++) g.tri(c0, base + j, base + j + 1);
    }
  }
  return g;
}

export function cone(r, h, segs = 10, col = WHITE) { return cylinder(0, r, h, segs, true, col); }

export function sphere(r, ws = 16, hs = 12, col = WHITE) {
  const g = new Geo();
  for (let i = 0; i <= hs; i++) {
    const v = i / hs, th = v * Math.PI;
    for (let j = 0; j <= ws; j++) {
      const u = j / ws, ph = u * TAU;
      const x = -Math.cos(ph) * Math.sin(th), y = Math.cos(th), z = Math.sin(ph) * Math.sin(th);
      g.vert(r * x, r * y, r * z, x, y, z, u, 1 - v, col);
    }
  }
  for (let i = 0; i < hs; i++) {
    for (let j = 0; j < ws; j++) {
      const a = i * (ws + 1) + j, b = a + ws + 1;
      if (i !== 0) g.tri(a, b, a + 1);
      if (i !== hs - 1) g.tri(a + 1, b, b + 1);
    }
  }
  return g;
}

// Toro nel piano XY (asse Z)
export function torus(R, r, rs = 8, ts = 32, arc = TAU, col = WHITE) {
  const g = new Geo();
  for (let j = 0; j <= rs; j++) {
    for (let i = 0; i <= ts; i++) {
      const u = (i / ts) * arc, v = (j / rs) * TAU;
      const cu = Math.cos(u), su = Math.sin(u), cv = Math.cos(v), sv = Math.sin(v);
      g.vert((R + r * cv) * cu, (R + r * cv) * su, r * sv, cv * cu, cv * su, sv, i / ts, j / rs, col);
    }
  }
  for (let j = 0; j < rs; j++) {
    for (let i = 0; i < ts; i++) {
      const a = j * (ts + 1) + i, b = (j + 1) * (ts + 1) + i;
      g.quad(a, b, b + 1, a + 1);
    }
  }
  return g;
}

// Disco/anello piatto nel piano XY, rivolto verso +Z (e -Z se twoSided)
export function disc(rIn, rOut, segs = 32, col = WHITE, twoSided = true) {
  const g = new Geo();
  for (const nz of twoSided ? [1, -1] : [1]) {
    const base = g.vertexCount;
    for (let j = 0; j <= segs; j++) {
      const t = (j / segs) * TAU, c = Math.cos(t), s = Math.sin(t);
      for (const r of [rIn, rOut]) {
        g.vert(r * c, r * s, nz * 0.001, 0, 0, nz, 0.5 + (r * c) / (2 * rOut), 0.5 + (r * s) / (2 * rOut), col);
      }
    }
    for (let j = 0; j < segs; j++) {
      const a = base + j * 2;
      g.quad(a, a + 1, a + 3, a + 2);
    }
  }
  return g;
}

// Quad piatto w×h nel piano XY rivolto verso +Z
export function plane(w, h, col = WHITE) {
  const g = new Geo(), x = w / 2, y = h / 2;
  const a = g.vert(-x, -y, 0, 0, 0, 1, 0, 0, col), b = g.vert(x, -y, 0, 0, 0, 1, 1, 0, col);
  const c = g.vert(x, y, 0, 0, 0, 1, 1, 1, col), d = g.vert(-x, y, 0, 0, 0, 1, 0, 1, col);
  g.quad(a, b, c, d);
  return g;
}

// Poligono convesso (punti XY) estruso lungo Z: piume, lame, gemme
export function prism(pts, depth, col = WHITE) {
  const g = new Geo(), hz = depth / 2, n = pts.length;
  let cx = 0, cy = 0;
  for (const [x, y] of pts) { cx += x / n; cy += y / n; }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  const U = (x) => (x - minX) / (maxX - minX || 1), V = (y) => (y - minY) / (maxY - minY || 1);
  for (const [zz, nz] of [[hz, 1], [-hz, -1]]) {
    const c0 = g.vert(cx, cy, zz, 0, 0, nz, U(cx), V(cy), col);
    const base = g.vertexCount;
    for (const [x, y] of pts) g.vert(x, y, zz, 0, 0, nz, U(x), V(y), col);
    for (let k = 0; k < n; k++) g.tri(c0, base + k, base + ((k + 1) % n));
  }
  for (let k = 0; k < n; k++) {
    const [x0, y0] = pts[k], [x1, y1] = pts[(k + 1) % n];
    let nx = y1 - y0, ny = -(x1 - x0);
    const mx = (x0 + x1) / 2 - cx, my = (y0 + y1) / 2 - cy;
    if (nx * mx + ny * my < 0) { nx = -nx; ny = -ny; }
    const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    const a = g.vert(x0, y0, hz, nx, ny, 0, 0, 0, col), b = g.vert(x1, y1, hz, nx, ny, 0, 1, 0, col);
    const c = g.vert(x1, y1, -hz, nx, ny, 0, 1, 1, col), d = g.vert(x0, y0, -hz, nx, ny, 0, 0, 1, col);
    g.quad(a, b, c, d);
  }
  return g;
}

// ---------- trasformazioni ----------

const _m = mat4(), _nm = new Float32Array(9);

export function transformGeo(g, m) {
  normalMat3(_nm, m);
  const p = g.p, n = g.n;
  for (let k = 0; k < p.length; k += 3) {
    const x = p[k], y = p[k + 1], z = p[k + 2];
    p[k] = m[0] * x + m[4] * y + m[8] * z + m[12];
    p[k + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
    p[k + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
    const a = n[k], b = n[k + 1], c = n[k + 2];
    let nx = _nm[0] * a + _nm[3] * b + _nm[6] * c;
    let ny = _nm[1] * a + _nm[4] * b + _nm[7] * c;
    let nz = _nm[2] * a + _nm[5] * b + _nm[8] * c;
    const l = Math.hypot(nx, ny, nz) || 1;
    n[k] = nx / l; n[k + 1] = ny / l; n[k + 2] = nz / l;
  }
  return g;
}

// Sposta/ruota/scala/colora una forma (in place) e la restituisce
export function place(g, p = [0, 0, 0], r = [0, 0, 0], s = 1, col = null) {
  compose(_m, p, r, typeof s === 'number' ? [s, s, s] : s);
  transformGeo(g, _m);
  if (col) paint(g, col);
  return g;
}

export function paint(g, col) {
  for (let k = 0; k < g.c.length; k += 3) { g.c[k] = col[0]; g.c[k + 1] = col[1]; g.c[k + 2] = col[2]; }
  return g;
}

export function merge(...gs) {
  const out = new Geo();
  for (const g of gs.flat()) {
    const off = out.vertexCount;
    for (let k = 0; k < g.p.length; k++) { out.p.push(g.p[k]); out.n.push(g.n[k]); out.c.push(g.c[k]); }
    for (let k = 0; k < g.uv.length; k++) out.uv.push(g.uv[k]);
    for (let k = 0; k < g.i.length; k++) out.i.push(g.i[k] + off);
  }
  return out;
}

// Rotazione che fa puntare l'asse +Z locale lungo la direzione (x,y,z)
export function aimRot(x, y, z) {
  const l = Math.hypot(x, y, z) || 1;
  return [-Math.asin(Math.max(-1, Math.min(1, y / l))), Math.atan2(x, z), 0];
}
