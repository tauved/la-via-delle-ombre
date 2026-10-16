// =============================================================
//  game/angels.js — le creature angeliche del Parassita
//
//  OFANO       ruote dentro ruote coperte d'occhi; tiene la distanza e spara luce
//  SERAFINO    sei ali, il volto coperto nasconde una bocca; carica e morde
//  CHERUBINO   quattro volti (uomo, leone, bue, aquila); lento, spara a ventaglio
//  ESATTORE    il boss: gabbia di anime nel petto, aureola piena d'occhi
//
//  Ogni modello è fatto solo di forme base (sfere, tori, coni, piume estruse)
//  e prende i contorni d'inchiostro dal renderer.
// =============================================================
import { box, cylinder, cone, sphere, torus, prism, merge, place, paint, aimRot } from '../engine/geometry.js';
import { Node, toon } from '../engine/scene.js';
import { TAU, clamp, rand, approachAngle, hex } from '../engine/math.js';
import { C, CELL } from './config.js';
import { eyeGeo } from './level.js';

export const ANGEL_DEFS = {
  ofano: {
    name: 'Ofano', hp: 60, radius: 1.6, hover: 4.3, speed: 6, accel: 3,
    ranged: true, keepMin: 9, keepMax: 22, range: 42, cooldown: [1.5, 2.6], windup: 0.5,
    orb: { speed: 17, dmg: 10, size: 0.42 }, painChance: 0.55, painTime: 0.3, drop: 0.3,
  },
  serafino: {
    name: 'Serafino', hp: 90, radius: 1.3, hover: 3.5, speed: 15, accel: 5,
    melee: true, biteRange: 3.6, biteDmg: 14, cooldown: [0.8, 1.2], windup: 0.32,
    painChance: 0.4, painTime: 0.25, drop: 0.3,
  },
  cherubino: {
    name: 'Cherubino', hp: 350, radius: 1.9, hover: 4.7, speed: 4.5, accel: 2,
    ranged: true, keepMin: 8, keepMax: 18, range: 40, cooldown: [2.0, 3.0], windup: 0.65, spread: 3,
    orb: { speed: 15, dmg: 12, size: 0.5 }, painChance: 0.18, painTime: 0.3, drop: 0.6,
  },
  esattore: {
    name: "L'Esattore di Anime", hp: 1600, radius: 2.5, hover: 0.8, speed: 4.2, accel: 1.5,
    ranged: true, boss: true, keepMin: 12, keepMax: 24, range: 60, cooldown: [1.6, 2.4], windup: 0.8,
    orb: { speed: 16, dmg: 12, size: 0.55 }, painChance: 0, painTime: 0, drop: 0,
  },
};

const GOLD = C.gold, IVORY = C.ivory;
const PALE = hex('#fbf4e4');
let M = null; // mesh condivise

function featherPts(L, w) {
  return [[0, 0], [w * 0.45, L * 0.15], [w * 0.55, L * 0.5], [w * 0.35, L * 0.85], [0, L], [-w * 0.35, L * 0.85], [-w * 0.55, L * 0.5], [-w * 0.45, L * 0.15]];
}

// Ala: ventaglio di piume con la base nell'origine, aperto verso +Y e verso il lato
function wingGeo(side, n, Lmin, Lmax, spread, eyes = false, w = 0.42) {
  const parts = [];
  for (let k = 0; k < n; k++) {
    const t = n === 1 ? 0.5 : k / (n - 1);
    const L = Lmin + (Lmax - Lmin) * Math.sin(t * Math.PI * 0.75 + 0.25);
    const ang = -side * (0.1 + t * spread);
    const zOff = k * 0.015;
    parts.push(place(paint(prism(featherPts(L, w), 0.08), k % 2 ? IVORY : PALE), [0, 0, zOff], [0, 0, ang]));
    parts.push(place(box(0.05, L * 0.85, 0.11), [-Math.sin(ang) * L * 0.43, Math.cos(ang) * L * 0.43, zOff], [0, 0, ang], 1, GOLD));
    if (eyes) {
      const d = L * 0.72;
      parts.push(place(eyeGeo(w * 0.27), [-Math.sin(ang) * d, Math.cos(ang) * d, zOff + 0.06], [0, 0, 0]));
    }
  }
  return merge(parts);
}

function ringWithEyes(R, r, nEyes, eyeR, iris, facing = 'out', studs = true) {
  const parts = [paint(torus(R, r, 8, 56), GOLD)];
  for (let k = 0; k < nEyes; k++) {
    const a = (k / nEyes) * TAU, c = Math.cos(a), s = Math.sin(a);
    const rot = facing === 'out' ? aimRot(c, s, 0) : [0, 0, 0];
    const off = facing === 'out' ? 0 : r * 0.6;
    parts.push(place(eyeGeo(eyeR, iris), [c * R, s * R, off], rot));
    if (studs) {
      const a2 = a + TAU / nEyes / 2;
      parts.push(place(sphere(r * 0.9, 8, 6), [Math.cos(a2) * R, Math.sin(a2) * R, 0], [0, 0, 0], 1, C.goldLight));
    }
  }
  return merge(parts);
}

function teethRing(rx, ry, n, z, len = 0.16) {
  const parts = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU, c = Math.cos(a), s = Math.sin(a);
    const phi = Math.atan2(c, -s);
    parts.push(place(cone(0.045, len, 6), [rx * c, ry * s, z], [0, 0, phi], 1, C.bone));
  }
  return parts;
}

export function initAngelAssets(r) {
  const mk = (g) => r.mesh(g);
  M = {};
  // ---- Ofano ----
  M.ofRingA = mk(ringWithEyes(1.75, 0.17, 8, 0.27, C.iris));
  M.ofRingB = mk(ringWithEyes(1.75, 0.17, 8, 0.27, C.iris));
  M.ofRingC = mk(ringWithEyes(1.1, 0.12, 6, 0.2, hex('#e8b64a')));
  M.ofCore = mk(eyeGeo(0.62, hex('#6fd8ff')));

  // ---- Serafino ----
  M.sfTorso = mk(merge(
    place(sphere(0.55, 16, 12), [0, 0, 0], [0, 0, 0], [0.85, 1.5, 0.75], IVORY),
    place(torus(0.5, 0.06, 6, 24), [0, -0.35, 0], [Math.PI / 2, 0, 0], [0.95, 0.95, 1], GOLD),
    place(torus(0.42, 0.05, 6, 24), [0, 0.55, 0], [Math.PI / 2, 0, 0], 1, GOLD),
  ));
  M.sfTail = mk(merge(
    place(cylinder(0.02, 0.36, 2.1, 10), [0, -1.65, -0.1], [0.18, 0, 0], 1, IVORY),
    place(torus(0.28, 0.045, 6, 18), [0, -1.0, -0.02], [Math.PI / 2 + 0.18, 0, 0], 1, GOLD),
    place(torus(0.18, 0.04, 6, 18), [0, -1.6, -0.12], [Math.PI / 2 + 0.18, 0, 0], 1, GOLD),
  ));
  M.sfMouth = mk(merge(
    place(sphere(0.3, 14, 10), [0, 0, 0], [0, 0, 0], [0.62, 1.25, 0.32], C.mouth),
    place(sphere(0.2, 12, 8), [0, 0, 0.03], [0, 0, 0], [0.5, 1.15, 0.3], hex('#14040a')),
    ...teethRing(0.17, 0.35, 12, 0.07),
    ...teethRing(0.11, 0.25, 9, 0.05, 0.11),
  ));
  M.sfWingTopR = mk(wingGeo(1, 4, 1.0, 1.35, 0.55));
  M.sfWingTopL = mk(wingGeo(-1, 4, 1.0, 1.35, 0.55));
  M.sfWingMidR = mk(wingGeo(1, 5, 1.5, 2.3, 0.9, true));
  M.sfWingMidL = mk(wingGeo(-1, 5, 1.5, 2.3, 0.9, true));
  M.sfWingLowR = mk(wingGeo(1, 4, 0.9, 1.3, 0.5));
  M.sfWingLowL = mk(wingGeo(-1, 4, 0.9, 1.3, 0.5));
  M.sfHalo = mk(paint(torus(0.5, 0.055, 6, 32), C.goldLight));

  // ---- Cherubino: quattro volti ----
  const edges = [];
  const e = 0.92;
  for (const a of [-e, e]) for (const b of [-e, e]) {
    edges.push(place(box(1.92, 0.12, 0.12), [0, a, b], [0, 0, 0], 1, GOLD));
    edges.push(place(box(0.12, 1.92, 0.12), [a, 0, b], [0, 0, 0], 1, GOLD));
    edges.push(place(box(0.12, 0.12, 1.92), [a, b, 0], [0, 0, 0], 1, GOLD));
  }
  M.chHead = mk(merge(paint(box(1.8, 1.8, 1.8), hex('#efe2c8')), ...edges));
  const skin = hex('#f0d9c0');
  M.chMan = mk(merge(
    place(sphere(0.72, 16, 12), [0, 0, 0], [0, 0, 0], [0.95, 1.15, 0.42], skin),
    place(box(1.0, 0.12, 0.25), [0, 0.3, 0.22], [0, 0, 0], 1, hex('#d9bea0')),
    place(eyeGeo(0.13, hex('#e8b64a')), [0.25, 0.13, 0.26]),
    place(eyeGeo(0.13, hex('#e8b64a')), [-0.25, 0.13, 0.26]),
    place(box(0.14, 0.32, 0.2), [0, -0.06, 0.3], [0, 0, 0], 1, hex('#e6c9aa')),
    place(box(0.38, 0.06, 0.12), [0, -0.36, 0.27], [0, 0, 0], 1, C.mouth),
  ));
  const mane = [];
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * TAU;
    mane.push(place(cone(0.17, 0.62, 6), [Math.cos(a) * 0.78, Math.sin(a) * 0.78, -0.05], [0, 0, a - Math.PI / 2], 1, k % 2 ? hex('#b8782a') : hex('#cf8d33')));
  }
  M.chLion = mk(merge(
    ...mane,
    place(sphere(0.68, 16, 12), [0, 0, 0], [0, 0, 0], [1, 1, 0.45], hex('#e0a83c')),
    place(eyeGeo(0.12, hex('#ffcc33')), [0.24, 0.14, 0.27]),
    place(eyeGeo(0.12, hex('#ffcc33')), [-0.24, 0.14, 0.27]),
    place(sphere(0.25, 10, 8), [0, -0.2, 0.26], [0, 0, 0], [1.3, 0.8, 0.8], hex('#f0c070')),
    place(box(0.18, 0.1, 0.1), [0, -0.07, 0.45], [0, 0, 0], 1, C.ink),
  ));
  M.chOx = mk(merge(
    place(sphere(0.7, 16, 12), [0, 0, 0], [0, 0, 0], [0.9, 1.15, 0.45], hex('#a8734a')),
    place(cone(0.13, 0.95, 8), [0.62, 0.5, 0], [0, 0, -1.05], 1, C.bone),
    place(cone(0.13, 0.95, 8), [-0.62, 0.5, 0], [0, 0, 1.05], 1, C.bone),
    place(box(0.62, 0.36, 0.3), [0, -0.36, 0.24], [0, 0, 0], 1, hex('#c9956a')),
    place(sphere(0.06, 6, 4), [0.13, -0.38, 0.4], [0, 0, 0], 1, C.ink),
    place(sphere(0.06, 6, 4), [-0.13, -0.38, 0.4], [0, 0, 0], 1, C.ink),
    place(eyeGeo(0.12, hex('#3a2a1a')), [0.26, 0.16, 0.27]),
    place(eyeGeo(0.12, hex('#3a2a1a')), [-0.26, 0.16, 0.27]),
  ));
  M.chEagle = mk(merge(
    place(sphere(0.66, 16, 12), [0, 0, 0], [0, 0, 0], [0.9, 1.05, 0.5], hex('#f5f0e6')),
    place(cone(0.2, 0.78, 8), [0, -0.1, 0.5], [Math.PI / 2 + 0.35, 0, 0], 1, hex('#e8b64a')),
    place(eyeGeo(0.12, hex('#ffb000')), [0.25, 0.16, 0.27]),
    place(eyeGeo(0.12, hex('#ffb000')), [-0.25, 0.16, 0.27]),
    place(box(0.32, 0.07, 0.1), [0.25, 0.32, 0.3], [0, 0, -0.4], 1, C.ink),
    place(box(0.32, 0.07, 0.1), [-0.25, 0.32, 0.3], [0, 0, 0.4], 1, C.ink),
  ));
  M.chWingR = mk(wingGeo(1, 4, 1.3, 1.9, 0.7));
  M.chWingL = mk(wingGeo(-1, 4, 1.3, 1.9, 0.7));
  M.chRing = mk(ringWithEyes(2.15, 0.12, 8, 0.2, C.iris));

  // ---- Esattore di Anime ----
  M.exRobe = mk(merge(
    paint(cylinder(0.85, 2.3, 6.2, 22), IVORY),
    place(torus(2.26, 0.12, 6, 48), [0, -2.7, 0], [Math.PI / 2, 0, 0], 1, GOLD),
    place(torus(1.82, 0.1, 6, 48), [0, -1.1, 0], [Math.PI / 2, 0, 0], 1, GOLD),
    place(torus(1.3, 0.09, 6, 40), [0, 1.4, 0], [Math.PI / 2, 0, 0], 1, GOLD),
    place(box(0.18, 5.6, 0.1), [0, 0, 1.62], [-0.23, 0, 0], 1, GOLD),
  ));
  const cage = [];
  for (let k = 0; k < 4; k++) cage.push(place(torus(1.3, 0.075, 6, 40), [0, 0, 0], [0, (k * Math.PI) / 4, 0], 1, GOLD));
  cage.push(place(torus(1.1, 0.07, 6, 40), [0, 0.65, 0], [Math.PI / 2, 0, 0], 1, GOLD));
  cage.push(place(torus(1.1, 0.07, 6, 40), [0, -0.65, 0], [Math.PI / 2, 0, 0], 1, GOLD));
  M.exCage = mk(merge(cage));
  M.exCollar = mk(merge(
    paint(cylinder(1.25, 0.95, 0.55, 20), GOLD),
    place(torus(1.2, 0.08, 6, 36), [0, 0.28, 0], [Math.PI / 2, 0, 0], 1, C.goldLight),
  ));
  M.exHead = mk(merge(
    place(sphere(0.78, 18, 14), [0, 0, 0], [0, 0, 0], [0.85, 1.2, 0.85], hex('#f3d98a')),
    place(box(0.9, 0.08, 0.3), [0, 0.42, 0.52], [0, 0, 0], 1, GOLD),
  ));
  M.exMouth = mk(merge(
    place(sphere(0.13, 10, 8), [0, 0, 0], [0, 0, 0], [1, 3.6, 0.8], C.mouth),
    place(sphere(0.08, 8, 6), [0, 0, 0.04], [0, 0, 0], [1, 3.4, 0.8], hex('#14040a')),
  ));
  M.exHalo = mk(ringWithEyes(2.7, 0.15, 12, 0.3, C.iris, 'front'));
  const spikes = [paint(torus(2.05, 0.07, 6, 48), C.goldLight)];
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * TAU;
    spikes.push(place(cone(0.08, k % 2 ? 0.7 : 1.1, 6), [Math.cos(a) * 2.35, Math.sin(a) * 2.35, 0], [0, 0, a - Math.PI / 2], 1, GOLD));
  }
  M.exHalo2 = mk(merge(spikes));
  M.exWingR = mk(wingGeo(1, 7, 2.4, 4.2, 1.25, true, 0.6));
  M.exWingL = mk(wingGeo(-1, 7, 2.4, 4.2, 1.25, true, 0.6));
  M.exWingLowR = mk(wingGeo(1, 5, 1.8, 2.9, 0.85, false, 0.55));
  M.exWingLowL = mk(wingGeo(-1, 5, 1.8, 2.9, 0.85, false, 0.55));

  // proiettili angelici
  M.orb = mk(merge(paint(sphere(1, 12, 8), C.holy)));
  return M;
}

const MAT = toon({});
const MAT_ORB = toon({ color: [1, 1, 1], emissive: [0.6, 0.55, 0.35], lit: false });
export const ORB_MATERIAL = MAT_ORB;
export function orbMesh() { return M.orb; }

function part(mesh, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) {
  const n = new Node(mesh, MAT);
  n.setPos(x, y, z); n.setRot(rx, ry, rz);
  if (Array.isArray(s)) n.setScale(...s); else n.setScale(s);
  n.baseRot = [rx, ry, rz];
  n.basePos = [x, y, z];
  return n;
}

// Costruisce il modello di un angelo. Ritorna { root, body, p: parti nominate }
export function buildAngelModel(type) {
  const root = new Node(), body = new Node();
  root.add(body);
  const p = {};
  if (type === 'ofano') {
    p.ringA = part(M.ofRingA);
    p.ringB = part(M.ofRingB, 0, 0, 0, 0, Math.PI / 2, 0);
    p.ringC = part(M.ofRingC, 0, 0, 0, Math.PI / 2, 0, 0);
    p.core = part(M.ofCore);
    body.add(p.ringA, p.ringB, p.ringC, p.core);
    root.cullRadius = 2.4;
  } else if (type === 'serafino') {
    p.torso = part(M.sfTorso);
    p.tail = part(M.sfTail);
    p.mouth = part(M.sfMouth, 0, 0.42, 0.4);
    p.halo = part(M.sfHalo, 0, 1.6, 0, Math.PI / 2, 0, 0);
    p.wTR = part(M.sfWingTopR, 0.28, -0.1, 0.62);
    p.wTL = part(M.sfWingTopL, -0.28, -0.1, 0.68);
    p.wMR = part(M.sfWingMidR, 0.42, 0.45, -0.25);
    p.wML = part(M.sfWingMidL, -0.42, 0.45, -0.25);
    p.wLR = part(M.sfWingLowR, 0.22, -0.45, 0.5);
    p.wLL = part(M.sfWingLowL, -0.22, -0.45, 0.55);
    body.add(p.torso, p.tail, p.mouth, p.halo, p.wTR, p.wTL, p.wMR, p.wML, p.wLR, p.wLL);
    root.cullRadius = 3;
  } else if (type === 'cherubino') {
    p.spin = new Node();
    p.head = part(M.chHead);
    p.faces = [part(M.chMan, 0, 0, 0.93), part(M.chLion, 0.93, 0, 0, 0, Math.PI / 2, 0), part(M.chOx, 0, 0, -0.93, 0, Math.PI, 0), part(M.chEagle, -0.93, 0, 0, 0, -Math.PI / 2, 0)];
    p.spin.add(p.head, ...p.faces);
    p.wings = [
      part(M.chWingR, 0.7, -0.8, 0.7, 0, -Math.PI / 4, Math.PI - 0.45),
      part(M.chWingL, -0.7, -0.8, 0.7, 0, Math.PI / 4, Math.PI + 0.45),
      part(M.chWingR, 0.7, -0.8, -0.7, 0, Math.PI + Math.PI / 4, Math.PI - 0.45),
      part(M.chWingL, -0.7, -0.8, -0.7, 0, Math.PI - Math.PI / 4, Math.PI + 0.45),
    ];
    p.ring = part(M.chRing, 0, -0.3, 0, Math.PI / 2, 0, 0);
    body.add(p.spin, ...p.wings, p.ring);
    root.cullRadius = 3.6;
  } else if (type === 'esattore') {
    p.robe = part(M.exRobe, 0, 3.1, 0);
    p.cage = part(M.exCage, 0, 7.0, 0);
    p.collar = part(M.exCollar, 0, 8.25, 0);
    p.head = part(M.exHead, 0, 9.25, 0);
    p.mouth = part(M.exMouth, 0, 9.05, 0.6);
    p.halo = part(M.exHalo, 0, 9.6, -0.95);
    p.halo2 = part(M.exHalo2, 0, 9.6, -1.1);
    p.wUR = part(M.exWingR, 1.0, 8.0, -0.7, 0, -0.35, -0.55);
    p.wUL = part(M.exWingL, -1.0, 8.0, -0.7, 0, 0.35, 0.55);
    p.wLR = part(M.exWingLowR, 0.9, 6.6, -0.6, 0, -0.3, Math.PI - 0.75);
    p.wLL = part(M.exWingLowL, -0.9, 6.6, -0.6, 0, 0.3, Math.PI + 0.75);
    body.add(p.robe, p.cage, p.collar, p.head, p.mouth, p.halo, p.halo2, p.wUR, p.wUL, p.wLR, p.wLL);
    root.cullRadius = 8;
  }
  return { root, body, p };
}

// Animazioni "da fermo" (usate anche nel bestiario)
export function animateModel(type, m, t, open = 0, glow = 0) {
  const p = m.p;
  if (type === 'ofano') {
    p.ringA.rotation[0] = t * 1.3;
    p.ringB.rotation[2] = t * 0.9;
    p.ringC.rotation[1] = t * 2.1;
    p.ringC.rotation[0] = Math.PI / 2 + Math.sin(t * 0.7) * 0.6;
    p.core.glow = glow > 0 ? [glow * 0.6, glow * 0.9, glow * 1.1] : null;
  } else if (type === 'serafino') {
    const flap = Math.sin(t * 7);
    p.wMR.rotation[2] = -0.75 + flap * 0.35; p.wMR.rotation[1] = -0.35;
    p.wML.rotation[2] = 0.75 - flap * 0.35; p.wML.rotation[1] = 0.35;
    // ali del volto: chiuse = incrociate davanti alla bocca, aperte = spalancate
    p.wTR.rotation[2] = 0.62 - open * 1.9; p.wTR.rotation[0] = -0.15 - open * 0.3;
    p.wTL.rotation[2] = -0.62 + open * 1.9; p.wTL.rotation[0] = -0.15 - open * 0.3;
    p.wLR.rotation[2] = Math.PI - 0.62 + Math.sin(t * 2) * 0.05; p.wLL.rotation[2] = Math.PI + 0.62 - Math.sin(t * 2) * 0.05;
    p.mouth.scale[1] = 1 + open * 0.35 + Math.sin(t * 30) * 0.04 * open;
    p.mouth.scale[0] = 1 + open * 0.15;
    p.halo.rotation[1] = t * 1.5;
    p.tail.rotation[2] = Math.sin(t * 2.3) * 0.12;
    p.mouth.glow = glow > 0 ? [glow * 0.5, 0, glow * 0.1] : null;
  } else if (type === 'cherubino') {
    p.spin.rotation[1] = t * 0.6;
    p.ring.rotation[1] = -t * 0.8;
    const sw = Math.sin(t * 2.2) * 0.12;
    p.wings.forEach((w, i) => { w.rotation[2] = w.baseRot[2] + (i % 2 ? -sw : sw); });
    for (const f of p.faces) f.glow = glow > 0 ? [glow * 0.9, glow * 0.75, glow * 0.4] : null;
  } else if (type === 'esattore') {
    p.halo.rotation[2] = t * 0.25;
    p.halo2.rotation[2] = -t * 0.45;
    const fl = Math.sin(t * 1.6) * 0.12;
    p.wUR.rotation[2] = -0.55 + fl; p.wUL.rotation[2] = 0.55 - fl;
    p.wLR.rotation[2] = Math.PI - 0.75 - fl * 0.5; p.wLL.rotation[2] = Math.PI + 0.75 + fl * 0.5;
    p.mouth.scale[1] = 1 + open * 0.8;
    p.mouth.scale[0] = 1 + open * 0.6;
    p.halo.glow = glow > 0 ? [glow * 0.5, glow * 0.8, glow] : null;
    p.mouth.glow = glow > 0 ? [glow, glow * 0.2, glow * 0.3] : null;
    p.cage.rotation[1] = t * 0.3;
  }
}

// =============================================================
//  Comportamento
// =============================================================
export class Angel {
  constructor(type, x, z, game) {
    this.type = type;
    this.def = ANGEL_DEFS[type];
    this.x = x; this.z = z;
    this.hp = this.def.hp;
    this.r = this.def.radius;
    this.model = buildAngelModel(type);
    this.node = this.model.root;
    this.yaw = rand(0, TAU);
    this.vx = 0; this.vz = 0;
    this.state = 'idle';
    this.awake = false;
    this.t = rand(0, 10);
    this.phase = rand(0, TAU);
    this.cool = rand(0.5, 1.5);
    this.timer = 0;
    this.open = 0;
    this.glow = 0;
    this.strafe = Math.random() < 0.5 ? 1 : -1;
    this.strafeT = rand(1, 3);
    this.seeT = rand(0, 0.3);
    this.sees = false;
    this.dead = false;
    this.removed = false;
    this.deathT = 0;
    this.y = this.def.hover;
    this.game = game;
    this.summons = 0;
    this.ringT = 4;
    this.node.setPos(x, this.y, z);
  }

  wake() {
    if (this.awake || this.dead) return;
    this.awake = true;
    this.state = 'chase';
    this.game.audio.angelWake(this.type, this.x, this.z);
    if (this.def.boss) this.game.onBossWake(this);
  }

  damage(dmg, fromX, fromZ, kind = 'hit') {
    if (this.dead) return;
    this.hp -= dmg;
    this.node.flash = 1;
    this.wake();
    const g = this.game;
    g.fx.ichor(this.x + rand(-0.4, 0.4), this.y + rand(-0.3, 0.6) + (this.def.boss ? 6 : 0), this.z + rand(-0.4, 0.4), Math.min(14, 4 + dmg / 8));
    if (this.hp <= 0) { this.die(); return; }
    if (this.def.painChance && Math.random() < this.def.painChance && this.state !== 'windup-boss') {
      this.state = 'pain';
      this.timer = this.def.painTime;
      this.glow = 0;
      g.audio.angelPain(this.type, this.x, this.z);
      // spinta all'indietro
      const dx = this.x - fromX, dz = this.z - fromZ, d = Math.hypot(dx, dz) || 1;
      const k = kind === 'blast' ? 10 : 4;
      this.vx += (dx / d) * k; this.vz += (dz / d) * k;
    }
  }

  die() {
    this.dead = true;
    this.state = 'dead';
    this.deathT = 0;
    this.glow = 0;
    const g = this.game;
    g.audio.angelDeath(this.type, this.x, this.z);
    g.onAngelDeath(this);
    // le parti volano via
    for (const c of this.model.body.children) {
      c.dv = [rand(-4, 4), rand(2, 7), rand(-4, 4)];
      c.dr = [rand(-6, 6), rand(-6, 6), rand(-6, 6)];
    }
  }

  update(dt) {
    const g = this.game, def = this.def;
    this.t += dt;
    this.node.flash = Math.max(0, this.node.flash - dt * 8);
    if (this.dead) { this._updateDeath(dt); return; }

    const pl = g.player;
    const dx = pl.x - this.x, dz = pl.z - this.z, dist = Math.hypot(dx, dz) || 0.001;

    // vista
    this.seeT -= dt;
    if (this.seeT <= 0) {
      this.seeT = 0.2;
      this.sees = pl.alive && dist < 60 && g.level.lineOfSight(this.x, this.z, pl.x, pl.z);
      if (!this.awake && this.sees && dist < 46) this.wake();
      if (!this.awake && g.noise.t > 0 && Math.hypot(g.noise.x - this.x, g.noise.z - this.z) < g.noise.r) this.wake();
    }

    let desX = 0, desZ = 0;
    this.cool -= dt;
    if (!this.awake) {
      this.state = 'idle';
    } else if (this.state === 'pain') {
      this.timer -= dt;
      if (this.timer <= 0) this.state = 'chase';
    } else if (this.state === 'windup') {
      this.timer -= dt;
      this.glow = Math.min(1, this.glow + dt * 3);
      if (def.melee) this.open = Math.min(1, this.open + dt * 6);
      if (this.timer <= 0) this._attack(dist, dx, dz);
      // durante la carica il serafino continua ad avanzare
      if (def.melee) { desX = dx / dist; desZ = dz / dist; }
    } else if (this.state === 'recover') {
      this.timer -= dt;
      if (this.timer <= 0) this.state = 'chase';
    } else if (this.state === 'chase') {
      if (!pl.alive) {
        this.state = 'idle';
      } else if (def.melee) {
        if (dist < def.biteRange + 1.4 && this.cool <= 0) { this.state = 'windup'; this.timer = def.windup; g.audio.angelHiss(this.x, this.z); }
      } else if (this.sees && dist < def.range && this.cool <= 0) {
        this.state = 'windup'; this.timer = def.windup;
        if (def.boss) this._bossPlan();
      }
    }
    if (this.state !== 'windup') {
      this.glow = Math.max(0, this.glow - dt * 3);
      if (def.melee) this.open = Math.max(0, this.open - dt * 3);
    }

    // movimento desiderato
    if (this.awake && (this.state === 'chase' || this.state === 'recover' || (this.state === 'windup' && def.ranged))) {
      const slow = this.state === 'windup' ? 0.25 : 1;
      if (this.sees) {
        const ux = dx / dist, uz = dz / dist;
        if (def.melee) {
          const zig = Math.sin(this.t * 3 + this.phase) * 0.35;
          desX = ux - uz * zig; desZ = uz + ux * zig;
        } else {
          this.strafeT -= dt;
          if (this.strafeT <= 0) { this.strafe *= -1; this.strafeT = rand(1.2, 3); }
          let fwd = 0;
          if (dist < def.keepMin) fwd = -1; else if (dist > def.keepMax) fwd = 1;
          desX = (ux * fwd - uz * this.strafe * 0.8) * slow;
          desZ = (uz * fwd + ux * this.strafe * 0.8) * slow;
        }
      } else {
        const f = g.flowDir(this.x, this.z);
        if (f) { desX = f[0]; desZ = f[1]; }
      }
    }
    const dl = Math.hypot(desX, desZ);
    if (dl > 1) { desX /= dl; desZ /= dl; }
    const a = 1 - Math.exp(-dt * def.accel);
    this.vx += (desX * def.speed - this.vx) * a;
    this.vz += (desZ * def.speed - this.vz) * a;

    // separazione dagli altri angeli
    for (const o of g.angels) {
      if (o === this || o.dead) continue;
      const ox = this.x - o.x, oz = this.z - o.z, od = Math.hypot(ox, oz), min = this.r + o.r;
      if (od < min && od > 0.001) { const push = (min - od) * 2.5; this.vx += (ox / od) * push * dt * 10; this.vz += (oz / od) * push * dt * 10; }
    }
    let nx = this.x + this.vx * dt, nz = this.z + this.vz * dt;
    const res = g.level.collide(nx, nz, Math.min(this.r, 1.7));
    nx = res[0]; nz = res[1];
    const pr = g.collideProps(nx, nz, Math.min(this.r, 1.7));
    nx = pr[0]; nz = pr[1];
    // non entrare nel giocatore
    const pdx = nx - pl.x, pdz = nz - pl.z, pd = Math.hypot(pdx, pdz), pmin = this.r + 1.1;
    if (pd < pmin && pd > 0.001) { nx = pl.x + (pdx / pd) * pmin; nz = pl.z + (pdz / pd) * pmin; }
    this.x = nx; this.z = nz;

    // orientamento verso il giocatore
    if (this.awake) this.yaw = approachAngle(this.yaw, Math.atan2(dx, dz), 1 - Math.exp(-dt * 6));
    else this.yaw += dt * 0.2;
    const bob = Math.sin(this.t * 1.8 + this.phase) * (def.boss ? 0.3 : 0.28);
    this.y = def.hover + bob;
    this.node.setPos(this.x, this.y, this.z);
    this.node.rotation[1] = this.yaw;

    animateModel(this.type, this.model, this.t, this.open, this.glow);
    if (this.type === 'ofano') {
      // l'occhio centrale ti segue anche in altezza
      const dy = 3.2 - this.y;
      this.model.p.core.rotation[0] = -Math.atan2(dy, dist);
    }
    if (this.def.boss) this._bossTick(dt, dist);
    this._emitAura();
  }

  _emitAura() {
    const g = this.game, b = g.r.fxAdd;
    if (this.type === 'ofano') {
      b.push(this.x, this.y, this.z, 2.2 + this.glow * 1.2, 1, 0.85, 0.45, 0.22 + this.glow * 0.35, 0);
    } else if (this.type === 'serafino') {
      b.push(this.x, this.y + 1.6, this.z, 1.1, 1, 0.9, 0.5, 0.3, 0);
      if (this.open > 0.3) b.push(this.x, this.y + 0.4, this.z, 1.2, 1, 0.2, 0.3, 0.25 * this.open, 0);
    } else if (this.type === 'cherubino') {
      b.push(this.x, this.y, this.z, 3.4 + this.glow, 1, 0.8, 0.4, 0.16 + this.glow * 0.3, 0);
    } else if (this.type === 'esattore') {
      const cy = this.y + 7.0;
      // anime imprigionate nella gabbia
      for (let k = 0; k < 6; k++) {
        const a = this.t * 1.7 + k * 1.05, rr = 0.55 + Math.sin(this.t * 2 + k) * 0.25;
        b.push(this.x + Math.cos(a) * rr, cy + Math.sin(a * 1.3) * 0.5, this.z + Math.sin(a) * rr, 0.45, 0.81, 1, 0.5, 0.9, 0);
      }
      b.push(this.x, cy, this.z, 2.2, 0.7, 1, 0.45, 0.25, 0);
      b.push(this.x, this.y + 9.6, this.z, 6 + this.glow * 2, 1, 0.85, 0.5, 0.12 + this.glow * 0.25, 0);
    }
  }

  _attack(dist, dx, dz) {
    const g = this.game, def = this.def;
    this.state = 'recover';
    this.timer = def.melee ? 0.35 : 0.4;
    this.cool = rand(def.cooldown[0], def.cooldown[1]);
    this.glow = 0;
    if (def.melee) {
      if (dist < def.biteRange + 0.6 && g.player.alive) {
        g.player.hurt(def.biteDmg, this.x, this.z);
        g.audio.bite(this.x, this.z);
      }
      return;
    }
    const sx = this.x, sz = this.z;
    let sy = this.y;
    if (this.def.boss) sy = this.y + 9.6;
    const tx = g.player.x, tz = g.player.z, ty = 2.6;
    const base = Math.atan2(tx - sx, tz - sz);
    const hd = Math.hypot(tx - sx, tz - sz);
    const vyk = (ty - sy) / Math.max(hd, 1);
    const fire = (ang, o = def.orb, extra = {}) => {
      const dxn = Math.sin(ang), dzn = Math.cos(ang);
      g.spawnOrb(sx + dxn * 1.2, sy, sz + dzn * 1.2, dxn, vyk, dzn, o, extra);
    };
    if (this.type === 'ofano') {
      fire(base);
      g.audio.orbFire(sx, sz, 1);
    } else if (this.type === 'cherubino') {
      for (let k = -1; k <= 1; k++) fire(base + k * 0.16);
      g.audio.orbFire(sx, sz, 0.8);
    } else if (this.def.boss) {
      const plan = this.plan || 'fan';
      if (plan === 'fan') {
        const n = this.hp < def.hp * 0.33 ? 7 : 5;
        for (let k = 0; k < n; k++) fire(base + (k - (n - 1) / 2) * 0.13);
      } else if (plan === 'ring') {
        for (let k = 0; k < 16; k++) fire(base + (k / 16) * TAU, { speed: 12, dmg: 10, size: 0.5 });
      } else if (plan === 'homing') {
        fire(base, { speed: 9, dmg: 25, size: 1.0 }, { homing: 1.6, big: true, life: 7 });
      }
      g.audio.orbFire(sx, sz, 0.5);
      g.audio.bossRoar(0.4);
    }
  }

  _bossPlan() {
    const low = this.hp < this.def.hp * 0.5;
    const r = Math.random();
    this.ringT--;
    if (this.ringT <= 0) { this.plan = 'ring'; this.ringT = low ? 2 : 3; }
    else if (low && r < 0.35) this.plan = 'homing';
    else this.plan = 'fan';
    this.timer = this.plan === 'ring' ? 1.1 : this.def.windup;
    this.open = 0;
  }

  _bossTick(dt) {
    const g = this.game, def = this.def;
    if (this.state === 'windup') this.open = Math.min(1, this.open + dt * 2); else this.open = Math.max(0, this.open - dt * 2);
    const frac = this.hp / def.hp;
    // evoca Serafini a 2/3 e 1/3 della vita
    const want = frac < 0.33 ? 2 : frac < 0.66 ? 1 : 0;
    if (this.summons < want) {
      this.summons++;
      g.audio.bossRoar(1);
      g.message('L\'Esattore chiama i suoi Serafini!');
      for (const side of [-1, 1]) {
        const ax = this.x + Math.cos(this.yaw) * 5 * side, az = this.z - Math.sin(this.yaw) * 5 * side;
        g.spawnAngel('serafino', ax, az, true);
      }
    }
    g.updateBossBar(this);
  }

  _updateDeath(dt) {
    const g = this.game;
    this.deathT += dt;
    const floorY = -(this.y) + 0.3;
    for (const c of this.model.body.children) {
      if (!c.dv) continue;
      c.dv[1] -= 18 * dt;
      c.position[0] += c.dv[0] * dt; c.position[1] += c.dv[1] * dt; c.position[2] += c.dv[2] * dt;
      if (c.position[1] < floorY) { c.position[1] = floorY; c.dv[1] *= -0.3; c.dv[0] *= 0.7; c.dv[2] *= 0.7; c.dr[0] *= 0.6; c.dr[1] *= 0.6; c.dr[2] *= 0.6; }
      c.rotation[0] += c.dr[0] * dt; c.rotation[1] += c.dr[1] * dt; c.rotation[2] += c.dr[2] * dt;
    }
    const life = this.def.boss ? 3.2 : 1.8;
    if (this.deathT > life - 0.6) {
      const s = Math.max(0.001, (life - this.deathT) / 0.6);
      this.model.body.setScale(s);
    }
    if (this.deathT < 0.25) this.node.flash = 1 - this.deathT * 4;
    if (this.def.boss && this.deathT < 2.6 && Math.random() < 0.5) {
      g.fx.ichor(this.x + rand(-2, 2), this.y + rand(1, 10), this.z + rand(-2, 2), 6);
    }
    if (this.deathT >= life) { this.removed = true; this.node.visible = false; }
  }
}

export function clampAngle(a) { return clamp(a, -Math.PI, Math.PI); }
export { CELL };
