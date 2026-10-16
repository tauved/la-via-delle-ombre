// =============================================================
//  game/textures.js — texture disegnate in codice (canvas 2D)
//  Stile: campiture piatte, contorni d'inchiostro, tratteggi a mano.
//  Ogni texture è "tileable": si ripete senza cuciture.
// =============================================================
import { seeded } from '../engine/math.js';

export const INK = '#140b1c';
export const LIME = '#CFFE7E';
export const VIOLET = '#674CC0';

function canvas(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// Disegna fn più volte con offset, così le forme che escono dal bordo ricompaiono dall'altro lato
function wrap(W, H, fn) {
  for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) fn(ox, oy);
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.max(0, Math.min(255, Math.round(r * k)));
  g = Math.max(0, Math.min(255, Math.round(g * k)));
  b = Math.max(0, Math.min(255, Math.round(b * k)));
  return `rgb(${r},${g},${b})`;
}

// Linea "a mano": leggermente tremolante
function inkLine(ctx, pts, width, color = INK, rnd = null, wob = 0.8) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    const jx = rnd ? (rnd() - 0.5) * wob : 0, jy = rnd ? (rnd() - 0.5) * wob : 0;
    if (i === 0) ctx.moveTo(x + jx, y + jy); else ctx.lineTo(x + jx, y + jy);
  });
  ctx.stroke();
}

// Tratteggio stile fumetto: piccoli gruppi di linee parallele
function hatch(ctx, x, y, n, len, ang, gap, rnd, alpha = 0.35, color = INK, width = 1.6) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const dx = Math.cos(ang) * len, dy = Math.sin(ang) * len;
  const px = -Math.sin(ang) * gap, py = Math.cos(ang) * gap;
  for (let i = 0; i < n; i++) {
    const s = 0.7 + rnd() * 0.4;
    inkLine(ctx, [[x + px * i, y + py * i], [x + px * i + dx * s, y + py * i + dy * s]], width, color);
  }
  ctx.restore();
}

function crack(ctx, x, y, len, ang, rnd, width = 1.8, color = INK) {
  const pts = [[x, y]];
  let cx = x, cy = y, a = ang;
  const steps = 4 + Math.floor(rnd() * 4);
  for (let i = 0; i < steps; i++) {
    a += (rnd() - 0.5) * 1.1;
    cx += Math.cos(a) * len / steps; cy += Math.sin(a) * len / steps;
    pts.push([cx, cy]);
  }
  inkLine(ctx, pts, width, color);
  return pts;
}

// Blocchi di pietra a corsi sfalsati
function stoneBlocks(ctx, W, H, bw, bh, rnd, colors, opt = {}) {
  const rows = Math.round(H / bh);
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * (bw / 2) + (opt.jitterRows ? Math.floor(rnd() * 3) * 8 : 0);
    for (let x = -bw; x < W; x += bw) {
      const bx = x + off, by = r * bh;
      const col = colors[Math.floor(rnd() * colors.length)];
      const k = 0.94 + rnd() * 0.1;
      wrap(W, H, (ox, oy) => {
        ctx.fillStyle = shade(col, k);
        ctx.fillRect(bx + ox, by + oy, bw, bh);
        // luce in alto a sinistra, ombra in basso
        ctx.fillStyle = 'rgba(255,250,235,0.22)';
        ctx.fillRect(bx + ox + 3, by + oy + 3, bw - 6, 4);
        ctx.fillStyle = 'rgba(40,20,50,0.22)';
        ctx.fillRect(bx + ox + 3, by + oy + bh - 9, bw - 6, 6);
      });
      const hx = bx + 8 + rnd() * (bw - 30), hy = by + bh - 10;
      wrap(W, H, (ox, oy) => {
        if (rnd() < 0.7) hatch(ctx, hx + ox, hy + oy, 3 + Math.floor(rnd() * 3), 9, -2.2, 4, rnd, 0.28);
      });
      if (rnd() < (opt.cracks ?? 0.18)) {
        const cx0 = bx + rnd() * bw, cy0 = by + rnd() * bh;
        wrap(W, H, (ox, oy) => crack(ctx, cx0 + ox, cy0 + oy, 18 + rnd() * 20, rnd() * 6.28, seeded(Math.floor(cx0 * 31 + cy0)), 1.4));
      }
    }
  }
  // fughe d'inchiostro
  ctx.strokeStyle = INK; ctx.lineWidth = opt.seam ?? 4;
  for (let r = 0; r <= rows; r++) {
    ctx.beginPath(); ctx.moveTo(0, r * bh); ctx.lineTo(W, r * bh); ctx.stroke();
  }
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * (bw / 2);
    for (let x = -bw; x <= W + bw; x += bw) {
      const sx = x + off;
      ctx.beginPath(); ctx.moveTo(sx, r * bh); ctx.lineTo(sx, (r + 1) * bh); ctx.stroke();
    }
  }
}

// ---------------- muri ----------------

function marbleWall() {
  const c = canvas(256), ctx = c.getContext('2d'), rnd = seeded(11);
  stoneBlocks(ctx, 256, 256, 128, 64, rnd, ['#ddd3be', '#d4c9b1', '#e4dbc8', '#cfc3aa']);
  // venature del marmo
  ctx.globalAlpha = 0.25;
  for (let i = 0; i < 6; i++) crack(ctx, rnd() * 256, rnd() * 256, 60, rnd() * 6.28, rnd, 1, '#8f7f9e');
  ctx.globalAlpha = 1;
  return c;
}

function goldWall() {
  const c = canvas(256), ctx = c.getContext('2d'), rnd = seeded(21);
  stoneBlocks(ctx, 256, 256, 128, 64, rnd, ['#e2d8c4', '#d8ccb4', '#e8dfcc'], { cracks: 0.1 });
  // lesena dorata al centro della campata
  const x0 = 104, w = 48;
  ctx.fillStyle = '#d4a03c'; ctx.fillRect(x0, 0, w, 256);
  ctx.fillStyle = '#f1cd6a'; ctx.fillRect(x0 + 6, 0, 8, 256);
  ctx.fillStyle = '#9a6a1f'; ctx.fillRect(x0 + w - 12, 0, 8, 256);
  ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0, 256); ctx.moveTo(x0 + w, 0); ctx.lineTo(x0 + w, 256); ctx.stroke();
  // scanalature e rosoni
  ctx.lineWidth = 2;
  for (let y = 0; y < 256; y += 64) {
    ctx.fillStyle = '#f1cd6a';
    ctx.beginPath(); ctx.arc(x0 + w / 2, y + 32, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#9a6a1f';
    ctx.beginPath(); ctx.arc(x0 + w / 2, y + 32, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    hatch(ctx, x0 + w - 10, y + 46, 3, 8, -2.4, 3, rnd, 0.4);
  }
  return c;
}

function fleshWall(emissive = false) {
  const W = 256, c = canvas(W), ctx = c.getContext('2d'), rnd = seeded(31);
  ctx.fillStyle = emissive ? '#000' : '#5a1834';
  ctx.fillRect(0, 0, W, W);
  if (!emissive) {
    // fibre muscolari
    for (let i = 0; i < 46; i++) {
      const x = rnd() * W, y = rnd() * W, len = 40 + rnd() * 80;
      const col = rnd() < 0.5 ? '#7a2646' : '#4a1129';
      wrap(W, W, (ox, oy) => {
        ctx.strokeStyle = col; ctx.lineWidth = 5 + rnd() * 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x + ox, y + oy);
        ctx.bezierCurveTo(x + ox + 10, y + oy + len * 0.3, x + ox - 12, y + oy + len * 0.6, x + ox + 4, y + oy + len);
        ctx.stroke();
      });
    }
  }
  // vene ramificate: prima il contorno scuro, poi la vena chiara sullo stesso percorso
  const vrnd = seeded(37);
  for (let i = 0; i < 7; i++) {
    const x = vrnd() * W, y = vrnd() * W, a = vrnd() * 6.28;
    wrap(W, W, (ox, oy) => {
      if (!emissive) crack(ctx, x + ox, y + oy, 120, a, seeded(i * 97 + 3), 10, INK);
      crack(ctx, x + ox, y + oy, 120, a, seeded(i * 97 + 3), emissive ? 5 : 4.5, emissive ? '#ffffff' : '#c4587a');
    });
  }
  // pustole
  const brnd = seeded(41);
  for (let i = 0; i < 9; i++) {
    const x = brnd() * W, y = brnd() * W, r = 6 + brnd() * 10;
    wrap(W, W, (ox, oy) => {
      ctx.fillStyle = emissive ? '#ffcf8a' : '#e9c79a';
      ctx.beginPath(); ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2); ctx.fill();
      if (!emissive) {
        ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = '#fff4dc'; ctx.beginPath(); ctx.arc(x + ox - r * 0.35, y + oy - r * 0.35, r * 0.3, 0, Math.PI * 2); ctx.fill();
      }
    });
  }
  return c;
}

function breachWall(emissive = false) {
  const W = 256, c = canvas(W), ctx = c.getContext('2d'), rnd = seeded(51);
  if (emissive) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, W); }
  else stoneBlocks(ctx, W, W, 128, 64, rnd, ['#2e2536', '#352a40', '#2a2131'], { cracks: 0.05, seam: 5 });
  // crepe che brillano di lime (la breccia del demone)
  const crnd = seeded(57);
  for (let i = 0; i < 5; i++) {
    const x = crnd() * W, y = crnd() * W, a = crnd() * 6.28;
    wrap(W, W, (ox, oy) => {
      const r1 = seeded(i * 13 + 1);
      if (!emissive) crack(ctx, x + ox, y + oy, 110, a, r1, 9, INK);
      const r2 = seeded(i * 13 + 1);
      crack(ctx, x + ox, y + oy, 110, a, r2, emissive ? 5 : 4, emissive ? '#fff' : LIME);
    });
  }
  return c;
}

function booksWall() {
  const W = 256, c = canvas(W), ctx = c.getContext('2d'), rnd = seeded(61);
  ctx.fillStyle = '#2b1a12'; ctx.fillRect(0, 0, W, W);
  const spines = ['#6b2a3a', '#3d2b5c', '#2f4a3e', '#7a5a2a', '#4d1f2f', '#cfc3a6', '#5a3c74', '#8a3b2a'];
  for (let shelf = 0; shelf < 4; shelf++) {
    const y0 = shelf * 64;
    let x = 0;
    while (x < W) {
      const w = 10 + Math.floor(rnd() * 14);
      const h = 40 + Math.floor(rnd() * 14);
      const ww = Math.min(w, W - x);
      const col = spines[Math.floor(rnd() * spines.length)];
      const tilt = rnd() < 0.08;
      ctx.save();
      if (tilt) { ctx.translate(x + ww / 2, y0 + 56); ctx.rotate(0.18); ctx.translate(-(x + ww / 2), -(y0 + 56)); }
      ctx.fillStyle = col; ctx.fillRect(x, y0 + 56 - h, ww, h);
      ctx.fillStyle = 'rgba(255,240,210,0.18)'; ctx.fillRect(x + 2, y0 + 58 - h, 3, h - 4);
      ctx.fillStyle = '#d4a03c';
      ctx.fillRect(x + 2, y0 + 60 - h, ww - 4, 3);
      if (rnd() < 0.5) ctx.fillRect(x + 2, y0 + 46, ww - 4, 2);
      ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.strokeRect(x, y0 + 56 - h, ww, h);
      ctx.restore();
      x += ww;
    }
    // ripiano
    ctx.fillStyle = '#4a2e1c'; ctx.fillRect(0, y0 + 56, W, 8);
    ctx.fillStyle = '#6a4428'; ctx.fillRect(0, y0 + 56, W, 2);
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, y0 + 56); ctx.lineTo(W, y0 + 56); ctx.moveTo(0, y0 + 64); ctx.lineTo(W, y0 + 64); ctx.stroke();
    hatch(ctx, rnd() * 200, y0 + 20, 4, 10, -2.3, 4, rnd, 0.3);
  }
  return c;
}

function secretWall(emissive = false) {
  const c = canvas(256), ctx = c.getContext('2d');
  if (emissive) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 256, 256); }
  else ctx.drawImage(marbleWall(), 0, 0);
  // sigillo appena visibile: è l'indizio del passaggio
  ctx.save();
  ctx.translate(128, 128);
  ctx.strokeStyle = emissive ? '#555' : 'rgba(120,140,90,0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, 46, 0, Math.PI * 2); ctx.stroke();
  for (let k = 0; k < 3; k++) {
    const a = k * 2.094 - Math.PI / 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 46, Math.sin(a) * 46); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(-20, 18); ctx.lineTo(20, 18); ctx.stroke();
  ctx.restore();
  return c;
}

// ---------------- pavimenti e soffitti ----------------

function floorMarble() {
  const W = 256, c = canvas(W), ctx = c.getContext('2d'), rnd = seeded(71);
  const A = '#d6cbb4', B = '#7a6e94';
  for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) {
    const col = (tx + ty) % 2 ? B : A;
    ctx.fillStyle = col; ctx.fillRect(tx * 128, ty * 128, 128, 128);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(tx * 128 + 6, ty * 128 + 6, 116, 6);
    ctx.globalAlpha = 0.22;
    for (let i = 0; i < 2; i++) crack(ctx, tx * 128 + rnd() * 128, ty * 128 + rnd() * 128, 50, rnd() * 6.28, rnd, 1.2, (tx + ty) % 2 ? '#d9cfee' : '#8f7f9e');
    ctx.globalAlpha = 1;
    hatch(ctx, tx * 128 + 90, ty * 128 + 108, 4, 12, -2.4, 4, rnd, 0.22);
  }
  ctx.strokeStyle = INK; ctx.lineWidth = 4;
  for (const v of [0, 128, 256]) {
    ctx.beginPath(); ctx.moveTo(v, 0); ctx.lineTo(v, W); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, v); ctx.lineTo(W, v); ctx.stroke();
  }
  // rombi dorati agli incroci
  for (const x of [0, 128, 256]) for (const y of [0, 128, 256]) {
    ctx.fillStyle = '#d9a640';
    ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.lineTo(x + 12, y); ctx.lineTo(x, y + 12); ctx.lineTo(x - 12, y); ctx.closePath();
    ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
  }
  return c;
}

function floorBasalt(emissive = false) {
  const W = 256, c = canvas(W), ctx = c.getContext('2d'), rnd = seeded(81);
  if (emissive) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, W); }
  else stoneBlocks(ctx, W, W, 128, 128, rnd, ['#2c2433', '#332a3c', '#282030'], { cracks: 0.2, seam: 5 });
  const crnd = seeded(87);
  for (let i = 0; i < 4; i++) {
    const x = crnd() * W, y = crnd() * W, a = crnd() * 6.28;
    wrap(W, W, (ox, oy) => {
      if (!emissive) crack(ctx, x + ox, y + oy, 120, a, seeded(i * 7 + 2), 8, INK);
      crack(ctx, x + ox, y + oy, 120, a, seeded(i * 7 + 2), emissive ? 4 : 3, emissive ? '#fff' : LIME);
    });
  }
  return c;
}

function floorFlag() {
  const W = 256, c = canvas(W), ctx = c.getContext('2d'), rnd = seeded(91);
  ctx.fillStyle = '#c9bea6'; ctx.fillRect(0, 0, W, W);
  const rowsH = [70, 58, 64, 64];
  let y = 0;
  for (const h of rowsH) {
    let x = -Math.floor(rnd() * 40);
    while (x < W) {
      const w = 50 + Math.floor(rnd() * 60);
      const col = ['#cdc2aa', '#c2b69c', '#d4cab4', '#bfb299'][Math.floor(rnd() * 4)];
      wrap(W, W, (ox, oy) => {
        ctx.fillStyle = col; ctx.fillRect(x + ox, y + oy, w, h);
        ctx.fillStyle = 'rgba(255,250,235,0.18)'; ctx.fillRect(x + ox + 4, y + oy + 4, w - 8, 4);
      });
      const hx = x + w - 20, hy = y + h - 12;
      hatch(ctx, hx, hy, 3, 9, -2.3, 4, rnd, 0.25);
      ctx.strokeStyle = INK; ctx.lineWidth = 4;
      wrap(W, W, (ox, oy) => { ctx.beginPath(); ctx.moveTo(x + ox, y + oy); ctx.lineTo(x + ox, y + oy + h); ctx.stroke(); });
      x += w;
    }
    ctx.strokeStyle = INK; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    y += h;
  }
  ctx.beginPath(); ctx.moveTo(0, W); ctx.lineTo(W, W); ctx.stroke();
  // vene d'oro tra le lastre
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 3; i++) crack(ctx, rnd() * W, rnd() * W, 50, rnd() * 6.28, rnd, 2, '#d9a640');
  ctx.globalAlpha = 1;
  return c;
}

function floorFlesh(emissive = false) {
  const c = fleshWall(emissive);
  return c;
}

function ceiling() {
  const W = 256, c = canvas(W), ctx = c.getContext('2d'), rnd = seeded(101);
  ctx.fillStyle = '#231833'; ctx.fillRect(0, 0, W, W);
  for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) {
    const x = tx * 128, y = ty * 128;
    ctx.fillStyle = '#2f2144'; ctx.fillRect(x + 14, y + 14, 100, 100);
    ctx.fillStyle = '#3b2b54'; ctx.fillRect(x + 28, y + 28, 72, 72);
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.strokeRect(x + 14, y + 14, 100, 100); ctx.strokeRect(x + 28, y + 28, 72, 72);
    ctx.fillStyle = '#d4a03c';
    ctx.beginPath(); ctx.arc(x + 64, y + 64, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    hatch(ctx, x + 30, y + 90, 4, 10, -0.8, 4, rnd, 0.3);
  }
  ctx.strokeStyle = '#b5862f'; ctx.lineWidth = 6;
  for (const v of [0, 128, 256]) {
    ctx.beginPath(); ctx.moveTo(v, 0); ctx.lineTo(v, W); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, v); ctx.lineTo(W, v); ctx.stroke();
  }
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  for (const v of [0, 128, 256]) for (const o of [-3, 3]) {
    ctx.beginPath(); ctx.moveTo(v + o, 0); ctx.lineTo(v + o, W); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, v + o); ctx.lineTo(W, v + o); ctx.stroke();
  }
  return c;
}

// ---------------- porte ed emblemi ----------------

function eyeOfProvidence(ctx, cx, cy, s, emissive = false) {
  ctx.save();
  ctx.translate(cx, cy);
  const gold = emissive ? '#fff' : '#d9a640';
  // raggi
  ctx.strokeStyle = emissive ? '#888' : '#f1cd6a'; ctx.lineWidth = s * 0.03;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * s * 0.55, Math.sin(a) * s * 0.55); ctx.lineTo(Math.cos(a) * s * 0.92, Math.sin(a) * s * 0.92); ctx.stroke();
  }
  // triangolo
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.6); ctx.lineTo(s * 0.62, s * 0.42); ctx.lineTo(-s * 0.62, s * 0.42); ctx.closePath();
  ctx.fillStyle = gold; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = s * 0.05; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.42); ctx.lineTo(s * 0.45, s * 0.32); ctx.lineTo(-s * 0.45, s * 0.32); ctx.closePath();
  ctx.fillStyle = emissive ? '#000' : '#2a1838'; ctx.fill();
  // occhio
  ctx.beginPath();
  ctx.moveTo(-s * 0.3, s * 0.06);
  ctx.quadraticCurveTo(0, -s * 0.2, s * 0.3, s * 0.06);
  ctx.quadraticCurveTo(0, s * 0.3, -s * 0.3, s * 0.06);
  ctx.fillStyle = emissive ? '#fff' : '#f6efe0'; ctx.fill();
  ctx.lineWidth = s * 0.035; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, s * 0.07, s * 0.1, 0, Math.PI * 2);
  ctx.fillStyle = emissive ? '#fff' : '#58c8f0'; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, s * 0.07, s * 0.045, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill();
  ctx.restore();
}

function emblem() {
  const c = canvas(256), ctx = c.getContext('2d');
  eyeOfProvidence(ctx, 128, 136, 200);
  return c;
}

function doorTex(locked = false, emissive = false) {
  const W = 256, c = canvas(W), ctx = c.getContext('2d'), rnd = seeded(locked ? 121 : 111);
  if (emissive) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, W); }
  else {
    ctx.fillStyle = locked ? '#3a2766' : '#6b4424'; ctx.fillRect(0, 0, W, W);
    // assi
    for (let x = 0; x < W; x += 32) {
      ctx.fillStyle = locked ? (x / 32) % 2 ? '#43307a' : '#382564' : (x / 32) % 2 ? '#74492a' : '#633e20';
      ctx.fillRect(x, 0, 32, W);
      ctx.strokeStyle = INK; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, W); ctx.stroke();
      hatch(ctx, x + 6, 30 + rnd() * 180, 3, 10, -1.2, 4, rnd, 0.3);
    }
    // cornice e borchie d'oro
    ctx.strokeStyle = '#d4a03c'; ctx.lineWidth = 14; ctx.strokeRect(10, 10, W - 20, W - 20);
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(3, 3, W - 6, W - 6); ctx.strokeRect(17, 17, W - 34, W - 34);
    for (const y of [40, 216]) for (let x = 40; x < W; x += 44) {
      ctx.fillStyle = '#f1cd6a'; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }
  if (locked) {
    // sigillo viola: serve la chiave
    ctx.save(); ctx.translate(128, 128);
    ctx.strokeStyle = emissive ? '#fff' : '#b9a0ff'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(0, 0, 62, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 - Math.PI / 2; const x = Math.cos(a) * 62, y = Math.sin(a) * 62; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.closePath(); ctx.stroke();
    ctx.beginPath();
    for (let k = 0; k < 3; k++) { const a = k * 2.094 - Math.PI / 2; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 62, Math.sin(a) * 62); }
    ctx.stroke();
    ctx.restore();
  } else if (!emissive) {
    eyeOfProvidence(ctx, 128, 132, 120);
  }
  return c;
}

// Sigillo di Samael: anello con i nomi e figura interna
function sigil(emissive = false) {
  const W = 512, c = canvas(W), ctx = c.getContext('2d');
  ctx.clearRect(0, 0, W, W);
  ctx.save(); ctx.translate(W / 2, W / 2);
  const col = emissive ? '#ffffff' : LIME;
  const lw = 10;
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.arc(0, 0, 238, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 178, 0, Math.PI * 2); ctx.stroke();
  ctx.font = 'bold 40px "Cinzel", Georgia, serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const text = 'SAMAEL · JACH · EIEH · ADONAY · ';
  const chars = text.split('');
  for (let k = 0; k < chars.length; k++) {
    const a = (k / chars.length) * Math.PI * 2 - Math.PI / 2;
    ctx.save(); ctx.rotate(a + Math.PI / 2); ctx.translate(0, -208);
    ctx.fillText(chars[k], 0, 0);
    ctx.restore();
  }
  // figura interna
  ctx.lineWidth = 9;
  ctx.beginPath();
  for (let k = 0; k < 7; k++) { const a = (k * 3 / 7) * Math.PI * 2 - Math.PI / 2; const x = Math.cos(a) * 168, y = Math.sin(a) * 168; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.closePath(); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 54, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -120); ctx.lineTo(0, 120); ctx.moveTo(-60, 70); ctx.lineTo(60, 70); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -120, 16, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  return c;
}

function portalTex(emissive = false) {
  const W = 256, c = canvas(W), ctx = c.getContext('2d');
  ctx.clearRect(0, 0, W, W);
  ctx.translate(128, 128);
  for (let k = 0; k < 9; k++) {
    ctx.strokeStyle = emissive ? (k % 2 ? '#fff' : '#777') : k % 2 ? LIME : VIOLET;
    ctx.lineWidth = 9;
    ctx.beginPath();
    for (let t = 0; t <= 1; t += 0.02) {
      const a = t * Math.PI * 2.2 + k * 0.7;
      const r = 8 + t * 116;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      t ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  if (!emissive) {
    ctx.fillStyle = '#05030a'; ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.fill();
  }
  return c;
}

function demonSkin(emissive = false) {
  const W = 128, c = canvas(W), ctx = c.getContext('2d'), rnd = seeded(131);
  ctx.fillStyle = emissive ? '#000' : '#3a1f4c'; ctx.fillRect(0, 0, W, W);
  if (!emissive) {
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = rnd() < 0.5 ? '#2c163b' : '#46275c';
      ctx.beginPath(); ctx.arc(rnd() * W, rnd() * W, 4 + rnd() * 8, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 8; i++) hatch(ctx, rnd() * W, rnd() * W, 3, 8, -2.2, 3, rnd, 0.35);
  }
  for (let i = 0; i < 4; i++) {
    const x = (i + 0.5) * (W / 4) + (rnd() - 0.5) * 10;
    wrap(W, W, (ox, oy) => {
      const r1 = seeded(i * 5 + 9);
      if (!emissive) crack(ctx, x + ox, oy, W, Math.PI / 2, r1, 6, INK);
      const r2 = seeded(i * 5 + 9);
      crack(ctx, x + ox, oy, W, Math.PI / 2, r2, emissive ? 3.5 : 2.5, emissive ? '#fff' : LIME);
    });
  }
  return c;
}

// ---------------- cielo ----------------
// Mappa equirettangolare: in alto lo zenit, al centro l'orizzonte.

export const EYE_DIR = (() => { const v = [0.18, 0.62, -0.76]; const l = Math.hypot(...v); return v.map((x) => x / l); })();

function sky() {
  const W = 1024, H = 512, c = canvas(W, H), ctx = c.getContext('2d'), rnd = seeded(141);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#07040d');
  g.addColorStop(0.22, '#170b27');
  g.addColorStop(0.4, '#34184a');
  g.addColorStop(0.5, '#4a2353');
  g.addColorStop(0.56, '#2a1438');
  g.addColorStop(1, '#120a1a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // stelle
  for (let i = 0; i < 260; i++) {
    const x = rnd() * W, y = rnd() * H * 0.42, s = rnd() < 0.1 ? 2.2 : 1.1;
    ctx.fillStyle = rnd() < 0.2 ? '#CFFE7E' : '#e8ddff';
    ctx.globalAlpha = 0.4 + rnd() * 0.6;
    ctx.fillRect(x, y, s, s);
  }
  ctx.globalAlpha = 1;
  // raggi dorati attorno alla direzione dell'Occhio
  const th = Math.acos(EYE_DIR[1]), ph = Math.atan2(EYE_DIR[2], -EYE_DIR[0]);
  const eu = (((ph / (Math.PI * 2)) % 1) + 1) % 1, ev = th / Math.PI;
  const ex = eu * W, ey = ev * H;
  ctx.save();
  for (let k = 0; k < 28; k++) {
    const a = (k / 28) * Math.PI * 2;
    const len = 150 + rnd() * 160;
    ctx.globalAlpha = 0.16 + rnd() * 0.14;
    ctx.fillStyle = k % 2 ? '#e8b64a' : '#a56cff';
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex + Math.cos(a - 0.04) * len * 1.9, ey + Math.sin(a - 0.04) * len);
    ctx.lineTo(ex + Math.cos(a + 0.04) * len * 1.9, ey + Math.sin(a + 0.04) * len);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  // nubi a fasce con contorno d'inchiostro
  const bands = [[0.47, '#5a2d63', '#3f1e4d'], [0.52, '#6a3468', '#4a2353'], [0.585, '#3a1a45', '#2a1438']];
  for (const [v, cTop, cBot] of bands) {
    const y0 = v * H;
    for (let x = -60; x < W + 60; x += 70 + rnd() * 50) {
      const w = 90 + rnd() * 120, h = 14 + rnd() * 18;
      ctx.fillStyle = cTop;
      ctx.beginPath();
      ctx.ellipse(x, y0, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = cBot;
      ctx.beginPath(); ctx.ellipse(x + 6, y0 + h * 0.18, w / 2 - 8, h / 3, 0, 0, Math.PI); ctx.fill();
    }
  }
  return c;
}

function backdrop() {
  const W = 512, H = 256, c = canvas(W, H), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0b0613'); g.addColorStop(0.5, '#2b1640'); g.addColorStop(1, '#0b0613');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  return c;
}

// Crea tutte le texture sulla GPU
export function makeTextures(r) {
  const T = (cv, o) => r.createTexture(cv, o);
  return {
    marble: T(marbleWall()),
    gold: T(goldWall()),
    flesh: T(fleshWall()), fleshEm: T(fleshWall(true)),
    breach: T(breachWall()), breachEm: T(breachWall(true)),
    books: T(booksWall()),
    secret: T(secretWall()), secretEm: T(secretWall(true)),
    floorMarble: T(floorMarble()),
    floorBasalt: T(floorBasalt()), floorBasaltEm: T(floorBasalt(true)),
    floorFlag: T(floorFlag()),
    floorFlesh: T(floorFlesh()), floorFleshEm: T(floorFlesh(true)),
    ceiling: T(ceiling()),
    door: T(doorTex(false)),
    doorLocked: T(doorTex(true)), doorLockedEm: T(doorTex(true, true)),
    emblem: T(emblem(), { repeat: false }),
    sigil: T(sigil(), { repeat: false }), sigilEm: T(sigil(true), { repeat: false }),
    portal: T(portalTex(), { repeat: false }), portalEm: T(portalTex(true), { repeat: false }),
    skin: T(demonSkin()), skinEm: T(demonSkin(true)),
    sky: T(sky(), { mips: true }),
    backdrop: T(backdrop()),
  };
}
