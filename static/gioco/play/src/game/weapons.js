// =============================================================
//  game/weapons.js — le armi del demone
//
//  1 ARTIGLI           sempre disponibili, mischia
//  2 FIAMMA NERA       dardi veloci, si ricarica da sola fino a 40
//  3 THANATEROS        fucile d'ossa: rosa di 9 schegge
//  4 SIGILLO DI SAMAEL sigillo esplosivo (arma segreta)
//
//  I modelli in prima persona ("viewmodel") sono figli della camera,
//  così si muovono con lo sguardo.
// =============================================================
import { box, cylinder, cone, sphere, torus, disc, merge, place, paint, aimRot } from '../engine/geometry.js';
import { Node, toon } from '../engine/scene.js';
import { rand, hex, TAU } from '../engine/math.js';
import { C, WEAPON_DEFS } from './config.js';

const W = [1, 1, 1];   // la pelle prende il colore dalla texture (viola con vene lime)
const BONE = C.bone;

// Cilindro tra due punti (avambracci)
function limb(a, b, r0, r1, col) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz);
  const g = cylinder(r1, r0, L, 10);
  place(g, [0, 0, 0], [Math.PI / 2, 0, 0]);
  return place(g, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], aimRot(dx, dy, dz), 1, col);
}

// Avambraccio che scende verso l'angolo dello schermo, con due spine d'osso
function forearm(skin, bone, wrist, elbow, r0 = 0.1, r1 = 0.135) {
  skin.push(limb(wrist, elbow, r0, r1, W));
  for (const t of [0.35, 0.7]) {
    const p = [wrist[0] + (elbow[0] - wrist[0]) * t, wrist[1] + (elbow[1] - wrist[1]) * t + r1 * 0.9, wrist[2] + (elbow[2] - wrist[2]) * t];
    bone.push(place(cone(0.035, 0.16, 6), p, [0.3, 0, -0.5 * Math.sign(elbow[0] || 1)], 1, BONE));
  }
}

// Una mano = pelle (texture) + ossa/artigli (colore pieno), in due mesh separate
function handNode(r, mats, skin, bone = []) {
  const n = new Node(r.mesh(merge(skin)), mats.skin);
  if (bone.length) n.add(new Node(r.mesh(merge(bone)), mats.bone));
  return n;
}

function clawHand(s) { // s: +1 destra, -1 sinistra
  const skin = [
    place(sphere(0.19, 12, 8), [0, 0, 0], [0, 0, 0], [1.25, 0.6, 1.5], W),
  ];
  const bone = [];
  forearm(skin, bone, [0, -0.04, 0.2], [0.42 * s, -0.75, 0.75]);
  for (let k = 0; k < 4; k++) {
    const x = (k - 1.5) * 0.085 * s, len = 0.32 + (k === 1 || k === 2 ? 0.06 : 0);
    skin.push(place(cylinder(0.035, 0.045, 0.22, 7), [x, 0.01, -0.3], [Math.PI / 2 + 0.25, 0, 0], 1, W));
    bone.push(place(cone(0.04, len, 7), [x, -0.02, -0.57], [-Math.PI / 2 - 0.15, 0, 0], 1, BONE));
  }
  skin.push(place(cylinder(0.03, 0.04, 0.16, 7), [0.2 * s, 0.03, -0.1], [Math.PI / 2, 0.9 * s, 0], 1, W));
  bone.push(place(cone(0.035, 0.2, 7), [0.3 * s, 0.03, -0.2], [-Math.PI / 2, 0.9 * s, 0], 1, BONE));
  return { skin, bone };
}

function openHand(fingerTilt, clawTilt, clawY, clawZ) {
  const skin = [
    place(sphere(0.2, 12, 8), [0, 0, 0], [0, 0, 0], [1.3, 0.5, 1.4], W),
    ...[-1.5, -0.5, 0.5, 1.5].map((k) => place(cylinder(0.035, 0.045, 0.3, 7), [k * 0.085, 0.07, -0.26], [Math.PI / 2 - fingerTilt, 0, 0], 1, W)),
    place(cylinder(0.03, 0.04, 0.2, 7), [0.22, 0.03, -0.05], [Math.PI / 2 - 0.4, 0.9, 0], 1, W),
  ];
  const bone = [-1.5, -0.5, 0.5, 1.5].map((k) => place(cone(0.035, 0.12, 6), [k * 0.085, clawY, clawZ], [clawTilt, 0, 0], 1, BONE));
  forearm(skin, bone, [0, -0.06, 0.22], [0.4, -0.72, 0.75]);
  return { skin, bone };
}

export function buildViewModels(r, tex) {
  const mats = {
    skin: toon({ map: tex.skin, emMap: tex.skinEm, emissive: [0.45, 0.75, 0.28], uvScale: [2, 2] }),
    bone: toon({}),
  };
  const plainMat = mats.bone;
  const mk = (geo, mat = plainMat) => new Node(r.mesh(geo), mat);
  const V = {};

  // --- 1: artigli (due mani) ---
  V.artigli = new Node();
  const cR = clawHand(1), cL = clawHand(-1);
  const hR = handNode(r, mats, cR.skin, cR.bone), hL = handNode(r, mats, cL.skin, cL.bone);
  hR.setPos(0.42, -0.38, -0.75); hR.setRot(0.2, -0.35, 0.2);
  hL.setPos(-0.42, -0.38, -0.75); hL.setRot(0.2, 0.35, -0.2);
  V.artigli.add(hR, hL);
  V.artigli.hands = [hR, hL];

  // --- 2: fiamma nera (mano aperta con la fiamma sul palmo) ---
  V.fiamma = new Node();
  const ph = openHand(0.9, -0.5, 0.22, -0.34);
  const palm = handNode(r, mats, ph.skin, ph.bone);
  palm.setPos(0.4, -0.42, -0.8); palm.setRot(0.05, -0.25, 0.12); palm.setScale(0.9);
  const flameCore = mk(merge(
    place(sphere(0.055, 10, 8), [0, 0, 0], [0, 0, 0], [1, 1.3, 1], [0.06, 0.02, 0.09]),
    place(cone(0.04, 0.12, 8), [0, 0.1, 0], [0, 0, 0], 1, C.lime),
  ), toon({ emissive: [0.25, 0.35, 0.12], lit: false }));
  flameCore.setPos(0, 0.12, -0.05);
  palm.add(flameCore);
  V.fiamma.add(palm);
  V.fiamma.hands = [palm];
  V.fiamma.flame = flameCore;

  // --- 3: Thanateros (fucile d'ossa a doppia canna) ---
  V.thanateros = new Node();
  const gun = mk(merge(
    place(cylinder(0.055, 0.07, 1.1, 10), [0.06, 0, -0.35], [Math.PI / 2, 0, 0], 1, BONE),
    place(cylinder(0.055, 0.07, 1.1, 10), [-0.06, 0, -0.35], [Math.PI / 2, 0, 0], 1, BONE),
    place(torus(0.075, 0.02, 6, 14), [0.06, 0, -0.88], [0, 0, 0], 1, C.ink),
    place(torus(0.075, 0.02, 6, 14), [-0.06, 0, -0.88], [0, 0, 0], 1, C.ink),
    place(box(0.26, 0.12, 0.3), [0, -0.03, 0.1], [0, 0, 0], 1, hex('#d7c7a3')),
    place(sphere(0.16, 12, 8), [0, -0.02, 0.32], [0, 0, 0], [1, 0.8, 1.2], hex('#e3d6b6')),
    place(sphere(0.05, 8, 6), [0.06, 0.03, 0.22], [0, 0, 0], 1, C.ink),
    place(sphere(0.05, 8, 6), [-0.06, 0.03, 0.22], [0, 0, 0], 1, C.ink),
    place(box(0.14, 0.26, 0.5), [0, -0.22, 0.45], [0.35, 0, 0], 1, hex('#d7c7a3')),
    ...[0, 1, 2, 3, 4].map((k) => place(torus(0.085, 0.02, 6, 12), [0, 0, -0.2 - k * 0.14], [0, 0, 0], 1, hex('#a88c5a'))),
    place(cone(0.03, 0.14, 6), [0.1, 0.05, -0.75], [0, 0, -0.9], 1, C.ink),
    place(cone(0.03, 0.14, 6), [-0.1, 0.05, -0.75], [0, 0, 0.9], 1, C.ink),
  ));
  gun.setPos(0.33, -0.36, -0.52); gun.setRot(0, 0.07, 0);
  // rune lime sulle canne
  const runes = mk(merge(
    ...[0, 1, 2].map((k) => place(torus(0.078, 0.012, 4, 12), [0.06, 0, -0.27 - k * 0.14], [0, 0, 0], 1, C.lime)),
    ...[0, 1, 2].map((k) => place(torus(0.078, 0.012, 4, 12), [-0.06, 0, -0.27 - k * 0.14], [0, 0, 0], 1, C.lime)),
  ), toon({ emissive: [0.35, 0.5, 0.2], lit: false }));
  gun.add(runes);
  const gR = [place(sphere(0.12, 10, 8), [0, 0, 0], [0, 0, 0], [1, 0.7, 1.3], W)], gRb = [];
  forearm(gR, gRb, [0.02, -0.06, 0.08], [0.32, -0.62, 0.6], 0.1, 0.15);
  const gripR = handNode(r, mats, gR, gRb);
  gripR.setPos(0, -0.2, 0.3);
  const gL = [place(sphere(0.12, 10, 8), [0, 0, 0], [0, 0, 0], [1.3, 0.6, 1.2], W)], gLb = [];
  forearm(gL, gLb, [-0.05, -0.06, 0.05], [-0.62, -0.62, 0.45], 0.1, 0.15);
  const gripL = handNode(r, mats, gL, gLb);
  gripL.setPos(0, -0.12, -0.3);
  gun.add(gripR, gripL);
  V.thanateros.add(gun);
  V.thanateros.hands = [gun];

  // --- 4: Sigillo di Samael (sigillo sospeso sopra la mano) ---
  V.sigillo = new Node();
  const sh = openHand(0.6, -0.3, 0.17, -0.38);
  const sHand = handNode(r, mats, sh.skin, sh.bone);
  sHand.setPos(0.38, -0.44, -0.78); sHand.setRot(0.1, -0.2, 0.1); sHand.setScale(0.9);
  const sigilMat = toon({ map: tex.sigil, emMap: tex.sigilEm, emissive: [0.7, 0.95, 0.4], alphaTest: 0.5, doubleSided: true, lit: false });
  const sigilPlate = mk(disc(0, 0.26, 24), sigilMat);
  sigilPlate.setPos(0, 0.26, -0.12); sigilPlate.setRot(-Math.PI / 2 + 1.0, 0, 0);
  const sigilDark = mk(paint(disc(0, 0.28, 24, [0, 0, 0], true), [0.08, 0.03, 0.12]), toon({ color: [0.1, 0.04, 0.14], lit: false }));
  sigilDark.setPos(0, 0.255, -0.13); sigilDark.setRot(-Math.PI / 2 + 1.0, 0, 0);
  sHand.add(sigilDark, sigilPlate);
  V.sigillo.add(sHand);
  V.sigillo.hands = [sHand];
  V.sigillo.plate = sigilPlate;
  V.sigillo.dark = sigilDark;

  for (const id of ['artigli', 'fiamma', 'thanateros', 'sigillo']) V[id].traverse((c) => { if (c.material) c.material.fog = false; });

  // ---- proiettili (nel mondo) ----
  V.boltMesh = r.mesh(merge(place(sphere(0.18, 10, 8), [0, 0, 0], [0, 0, 0], [1, 1, 2.4], [0.05, 0.02, 0.08]), place(sphere(0.1, 8, 6), [0, 0, 0.1], [0, 0, 0], [1, 1, 2.2], C.lime)));
  V.boltMat = toon({ emissive: [0.15, 0.22, 0.08], lit: false });
  V.sigilMesh = r.mesh(paint(disc(0, 0.9, 24, [0, 0, 0], true), [0.08, 0.03, 0.12]));
  V.sigilProjMat = toon({ color: [0.1, 0.04, 0.14], lit: false });
  V.sigilFaceMesh = r.mesh(disc(0, 0.86, 24));
  V.sigilFaceMat = toon({ map: tex.sigil, emMap: tex.sigilEm, emissive: [0.7, 0.95, 0.4], alphaTest: 0.5, doubleSided: true, lit: false });
  return V;
}

// =============================================================
//  Stato e logica delle armi
// =============================================================
export class Weapons {
  constructor(game) {
    this.g = game;
    this.owned = { 1: true, 2: true, 3: false, 4: false };
    this.cur = 2;
    this.next = null;
    this.swapT = 0;     // >0 durante il cambio arma
    this.cool = 0;
    this.kick = 0;      // rinculo
    this.anim = 0;      // tempo dall'ultimo sparo
    this.bobT = 0;
    this.clawSide = 1;
    this.holder = new Node();
    this.V = null;
  }

  attach(V, camNode) {
    this.V = V;
    for (const id of ['artigli', 'fiamma', 'thanateros', 'sigillo']) { V[id].visible = false; this.holder.add(V[id]); }
    camNode.add(this.holder);
    this.current().visible = true;
  }

  def() { return WEAPON_DEFS[this.cur]; }
  current() { return this.V[WEAPON_DEFS[this.cur].id]; }

  select(n) {
    if (!this.owned[n] || n === this.cur || this.next) return;
    this.next = n; this.swapT = 0.32;
    this.g.audio.switchWeapon();
  }

  give(n) {
    this.owned[n] = true;
    this.select(n);
  }

  scrollSelect(dir) {
    let n = this.cur;
    for (let i = 0; i < 4; i++) { n = ((n - 1 + dir + 4) % 4) + 1; if (this.owned[n]) { this.select(n); return; } }
  }

  update(dt, firing, moving) {
    const g = this.g, pl = g.player;
    this.cool = Math.max(0, this.cool - dt);
    this.anim += dt;
    this.kick = Math.max(0, this.kick - dt * 5);
    if (moving) this.bobT += dt * (pl.running ? 11 : 8);
    if (this.next) {
      this.swapT -= dt;
      if (this.swapT <= 0.16 && this.cur !== this.next) { this.current().visible = false; this.cur = this.next; this.current().visible = true; }
      if (this.swapT <= 0) this.next = null;
    } else if (firing && this.cool <= 0 && pl.alive) this.fire();
    this._animate(dt, moving);
  }

  fire() {
    const g = this.g, d = this.def(), pl = g.player;
    if (d.ammo && pl.ammo[d.ammo] <= 0) { this.cool = 0.3; g.audio.empty(); if (this.cur !== 1) g.hint('Niente ' + d.ammo + ': passa agli artigli (1)'); return; }
    this.cool = d.rate; this.anim = 0;
    const ox = pl.x, oy = pl.eyeY(), oz = pl.z;
    const [dx, dy, dz] = g.autoAim(ox, oy, oz, ...pl.aimDir());
    g.makeNoise(pl.x, pl.z, this.cur === 1 ? 8 : 40);
    if (this.cur === 1) {
      this.clawSide *= -1;
      g.audio.claws();
      const hit = g.meleeHit(ox, oy, oz, dx, dy, dz, d.range, rand(d.dmg[0], d.dmg[1]));
      g.fx.slash(ox + dx * 2.2, oy - 0.3 + dy * 2.2, oz + dz * 2.2, dx, dz);
      if (hit) { g.audio.clawHit(); this.kick = 0.4; }
    } else if (this.cur === 2) {
      pl.ammo.fiamma--;
      g.audio.fiamma();
      // il dardo parte dalla mano destra: destra = (-dz, dx)
      const hl = Math.hypot(dx, dz) || 1, rx = -dz / hl, rz = dx / hl;
      g.spawnBolt(ox + rx * 0.3 + dx * 0.6, oy - 0.25, oz + rz * 0.3 + dz * 0.6, dx + rand(-0.012, 0.012), dy + rand(-0.012, 0.012), dz + rand(-0.012, 0.012), d);
      this.kick = 0.35;
      g.flash([0.81, 1, 0.5], 0.08);
    } else if (this.cur === 3) {
      pl.ammo.ossa--;
      g.audio.thanateros();
      for (let k = 0; k < d.pellets; k++) {
        const a = rand(0, TAU), rr = Math.sqrt(Math.random()) * d.spread;
        const rx = dz, rz = -dx;
        const px = dx + rx * Math.cos(a) * rr, py = dy + Math.sin(a) * rr, pz = dz + rz * Math.cos(a) * rr;
        g.hitscan(ox, oy, oz, px, py, pz, 60, rand(d.dmg[0], d.dmg[1]), k === 0);
      }
      this.kick = 1;
      g.flash([1, 0.95, 0.8], 0.12);
      g.shake(0.35);
    } else if (this.cur === 4) {
      pl.ammo.sigilli--;
      g.audio.sigilFire();
      g.spawnSigil(ox + dx * 0.8, oy - 0.2, oz + dz * 0.8, dx, dy, dz, d);
      this.kick = 0.8;
      g.flash([0.6, 0.45, 1], 0.12);
    }
  }

  _animate(dt, moving) {
    const V = this.current(), d = this.def(), a = this.anim, k = this.kick;
    const bob = moving ? Math.sin(this.bobT) * 0.035 : Math.sin(this.g.time * 1.6) * 0.012;
    const bobY = moving ? Math.abs(Math.cos(this.bobT)) * 0.03 : Math.sin(this.g.time * 1.3) * 0.01;
    let swap = 0;
    if (this.next) swap = this.swapT > 0.16 ? (0.32 - this.swapT) / 0.16 : this.swapT / 0.16;
    const hp = this.g.player.hp;
    const tremor = hp < 25 ? Math.sin(this.g.time * 22) * 0.012 : 0;
    this.holder.setPos(bob, bobY - swap * 0.9 + tremor, 0);
    this.holder.setRot(swap * 0.5, 0, 0);
    if (this.cur === 1) {
      const [hR, hL] = V.hands;
      const phase = Math.min(1, a / 0.3);
      const swing = Math.sin(phase * Math.PI);
      const act = this.clawSide > 0 ? hR : hL, idle = this.clawSide > 0 ? hL : hR;
      const s = this.clawSide;
      act.setPos(0.42 * s - swing * 0.5 * s, -0.38 + swing * 0.15, -0.75 - swing * 0.4);
      act.setRot(0.2 + swing * 0.6, -0.35 * s + swing * 1.2 * s, 0.2 * s - swing * 1.4 * s);
      idle.setPos(-0.42 * s, -0.38 - Math.sin(this.g.time * 2) * 0.01, -0.75);
      idle.setRot(0.2, 0.35 * s, -0.2 * s);
    } else if (this.cur === 2) {
      const [palm] = V.hands;
      const rec = Math.max(0, 1 - a / 0.15);
      palm.setPos(0.4, -0.42 - rec * 0.05, -0.8 + rec * 0.14);
      palm.setRot(0.05 - rec * 0.3, -0.25, 0.12);
      const f = V.flame;
      const fl = 1 + Math.sin(this.g.time * 23) * 0.12 + rec * 0.8;
      f.setScale(fl, fl * (1 + rec), fl);
      const am = this.g.player.ammo.fiamma;
      f.visible = am > 0;
      if (am > 0) {
        const w = f.world;
        if (Math.random() < 0.6) this.g.fx.blackFlame(w[12], w[13] + 0.03, w[14], 1, 0.03, 0.35);
        this.g.r.fxAdd.push(w[12], w[13] + 0.04, w[14], 0.12 + rec * 0.25, 0.81, 1, 0.5, 0.55, 0);
      }
    } else if (this.cur === 3) {
      const [gun] = V.hands;
      const rec = Math.max(0, 1 - a / 0.3), pump = a > 0.45 && a < 0.75 ? Math.sin(((a - 0.45) / 0.3) * Math.PI) : 0;
      gun.setPos(0.33, -0.36 - rec * 0.06 - pump * 0.04, -0.52 + rec * 0.25 + pump * 0.08);
      gun.setRot(rec * 0.35, 0.07, -pump * 0.4);
      if (a < 0.12) this.g.r.fxAdd.push(...this._muzzle(gun, 0, 0, -0.95), 1.4 * (1 - a / 0.12), 1, 0.95, 0.75, 0.9, 0);
    } else if (this.cur === 4) {
      const [hand] = V.hands;
      const rec = Math.max(0, 1 - a / 0.3);
      hand.setPos(0.38, -0.44 - rec * 0.1, -0.78 + rec * 0.2);
      hand.setRot(0.1 - rec * 0.5, -0.2, 0.1);
      V.plate.rotation[2] = this.g.time * 1.2;
      V.dark.rotation[2] = -this.g.time * 0.5;
      const has = this.g.player.ammo.sigilli > 0;
      const sc = has ? (a < 0.5 ? a / 0.5 : 1) * (1 + Math.sin(this.g.time * 4) * 0.05) : 0.001;
      V.plate.setScale(sc); V.dark.setScale(sc);
      V.plate.position[1] = 0.26 + Math.sin(this.g.time * 2) * 0.03;
      V.dark.position[1] = V.plate.position[1] - 0.005;
      if (has) { const w = V.plate.world; this.g.r.fxAdd.push(w[12], w[13], w[14], 0.35, 0.81, 1, 0.5, 0.22 * sc, 0); }
    }
    void k; void d; void dt;
  }

  _muzzle(node, x, y, z) {
    const w = node.world;
    return [w[0] * x + w[4] * y + w[8] * z + w[12], w[1] * x + w[5] * y + w[9] * z + w[13], w[2] * x + w[6] * y + w[10] * z + w[14]];
  }
}
