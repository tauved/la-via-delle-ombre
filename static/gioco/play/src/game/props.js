// =============================================================
//  game/props.js — oggetti del mondo: pilastri, bracieri, gabbie di anime,
//  oggetti da raccogliere, il Varco, l'Occhio nel cielo
// =============================================================
import { box, cylinder, cone, sphere, torus, disc, prism, merge, place, paint, plane } from '../engine/geometry.js';
import { Node, toon } from '../engine/scene.js';
import { rand, hex, TAU } from '../engine/math.js';
import { C, CELL, WALL_H } from './config.js';
import { eyeGeo } from './level.js';
import { EYE_DIR } from './textures.js';

export const PICKUP_DEFS = {
  h: { kind: 'health', amount: 10, name: 'Anima', msg: 'Un\'anima liberata ti rimette in forze.' },
  H: { kind: 'health', amount: 25, name: 'Grande Anima', msg: 'Un\'anima antica. Senti il suo fuoco.' },
  f: { kind: 'ammo', ammo: 'fiamma', amount: 50, name: 'Fiamma Nera' },
  b: { kind: 'ammo', ammo: 'ossa', amount: 12, name: 'Ossa' },
  g: { kind: 'ammo', ammo: 'sigilli', amount: 4, name: 'Sigilli' },
  '3': { kind: 'weapon', weapon: 3, name: 'THANATEROS', msg: 'Thanateros: il fucile d\'ossa. Morte ed eros nella stessa canna.' },
  '4': { kind: 'weapon', weapon: 4, name: 'SIGILLO DI SAMAEL', msg: 'Il Sigillo di Samael. Il nome del vero creatore, scagliato in faccia all\'usurpatore.' },
  K: { kind: 'key', name: 'SIGILLO VIOLA', msg: 'Il Sigillo Viola. La porta del Coro si aprirà.' },
};

export function buildPropAssets(r, tex) {
  const A = {};
  const mk = (g) => r.mesh(g);
  // pilastro
  A.pillar = mk(merge(
    paint(cylinder(0.75, 0.85, WALL_H - 1.8, 12), hex('#e6dcc6')),
    place(box(2.1, 0.6, 2.1), [0, -WALL_H / 2 + 1.2, 0], [0, 0, 0], 1, hex('#d4a03c')),
    place(box(2.1, 0.6, 2.1), [0, WALL_H / 2 - 1.2, 0], [0, 0, 0], 1, hex('#d4a03c')),
    place(cylinder(0.95, 0.85, 0.5, 12), [0, WALL_H / 2 - 1.75, 0], [0, 0, 0], 1, hex('#f1cd6a')),
    place(cylinder(0.85, 0.95, 0.5, 12), [0, -WALL_H / 2 + 1.75, 0], [0, 0, 0], 1, hex('#f1cd6a')),
  ));
  // braciere
  A.brazier = mk(merge(
    paint(cylinder(0.25, 0.45, 2.2, 10), hex('#d4a03c')),
    place(cylinder(0.75, 0.45, 0.6, 12), [0, 1.3, 0], [0, 0, 0], 1, hex('#b5862f')),
    place(torus(0.75, 0.08, 6, 24), [0, 1.6, 0], [Math.PI / 2, 0, 0], 1, hex('#f1cd6a')),
    place(cylinder(0.6, 0.6, 0.3, 10), [0, -1.1, 0], [0, 0, 0], 1, hex('#b5862f')),
    ...[0, 1, 2].map((k) => place(cone(0.1, 0.5, 6), [Math.cos(k * 2.09) * 0.6, -0.9, Math.sin(k * 2.09) * 0.6], [0, 0, 0], 1, hex('#f1cd6a'))),
  ));
  // gabbia di anime: campana di sbarre d'oro con base
  const bars = [];
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU;
    bars.push(place(torus(1.6, 0.06, 6, 24, Math.PI), [0, 0.3, 0], [0, a, 0], 1, hex('#d4a03c')));
  }
  A.cage = mk(merge(
    ...bars,
    place(torus(1.6, 0.09, 6, 32), [0, 0.3, 0], [Math.PI / 2, 0, 0], 1, hex('#f1cd6a')),
    place(torus(1.1, 0.07, 6, 32), [0, 1.45, 0], [Math.PI / 2, 0, 0], 1, hex('#d4a03c')),
    place(sphere(0.22, 10, 8), [0, 1.95, 0], [0, 0, 0], 1, hex('#f1cd6a')),
    place(cylinder(1.9, 2.1, 0.5, 12), [0, 0, 0], [0, 0, 0], 1, hex('#e6dcc6')),
    place(torus(2.0, 0.07, 6, 32), [0, 0.26, 0], [Math.PI / 2, 0, 0], 1, hex('#d4a03c')),
  ));
  A.cageMat = toon({});
  // oggetti
  A.soul = mk(merge(paint(sphere(0.28, 12, 8), C.lime), place(cone(0.2, 0.5, 8), [0, 0.45, 0], [0, 0, 0], 1, C.lime)));
  A.soulMat = toon({ emissive: [0.6, 0.85, 0.3], lit: false, color: [0.6, 0.8, 0.4] });
  A.bigSoul = mk(merge(paint(sphere(0.45, 14, 10), C.lime), place(cone(0.3, 0.75, 8), [0, 0.7, 0], [0, 0, 0], 1, C.lime), place(eyeGeo(0.17, C.violet), [0, 0.02, 0.4])));
  A.flameAmmo = mk(merge(paint(cylinder(0.25, 0.32, 0.5, 8), [0.1, 0.04, 0.14]), place(torus(0.3, 0.04, 6, 16), [0, 0.2, 0], [Math.PI / 2, 0, 0], 1, C.gold), place(sphere(0.15, 8, 6), [0, 0.5, 0], [0, 0, 0], [1, 1.8, 1], C.lime)));
  A.flameAmmoMat = toon({ emissive: [0.2, 0.3, 0.1] });
  A.bones = mk(merge(
    ...[0, 1, 2, 3].map((k) => place(cylinder(0.05, 0.05, 0.6, 6), [Math.cos(k * 1.3) * 0.15, 0.05, Math.sin(k * 1.3) * 0.15], [Math.PI / 2, k * 0.8, 0], 1, C.bone)),
    place(sphere(0.22, 10, 8), [0, 0.25, 0], [0, 0, 0], [1, 0.9, 1.1], C.bone),
    place(sphere(0.06, 6, 4), [0.08, 0.28, 0.18], [0, 0, 0], 1, C.ink),
    place(sphere(0.06, 6, 4), [-0.08, 0.28, 0.18], [0, 0, 0], 1, C.ink),
  ));
  A.bonesMat = toon({});
  A.sigils = mk(merge(place(cylinder(0.32, 0.32, 0.1, 16), [0, 0, 0], [0, 0, 0], 1, [0.1, 0.04, 0.14]), place(cylinder(0.3, 0.3, 0.1, 16), [0, 0.12, 0], [0, 0, 0], 1, [0.1, 0.04, 0.14]), place(cylinder(0.28, 0.28, 0.1, 16), [0, 0.24, 0], [0, 0, 0], 1, [0.1, 0.04, 0.14])));
  A.sigilsFace = mk(disc(0, 0.27, 20));
  A.sigilsFaceMat = toon({ map: tex.sigil, emMap: tex.sigilEm, emissive: [0.7, 0.95, 0.4], alphaTest: 0.5, lit: false, noInk: true });
  A.sigilsMat = toon({ color: [0.1, 0.04, 0.14] });
  A.key = mk(merge(
    paint(torus(0.45, 0.07, 6, 6), C.violet),
    place(torus(0.3, 0.05, 6, 6), [0, 0, 0], [0, 0, Math.PI / 6], 1, hex('#b9a0ff')),
    place(sphere(0.12, 8, 6), [0, 0, 0], [0, 0, 0], 1, C.lime),
  ));
  A.keyMat = toon({ emissive: [0.3, 0.2, 0.6] });
  A.weaponPedestal = mk(merge(paint(cylinder(0.7, 0.9, 0.5, 10), hex('#2a1838')), place(torus(0.7, 0.06, 6, 20), [0, 0.25, 0], [Math.PI / 2, 0, 0], 1, C.lime)));
  A.pedestalMat = toon({ emissive: [0.1, 0.15, 0.05] });
  A.glowRing = mk(disc(0.35, 0.6, 24));
  A.glowRingMat = toon({ color: C.lime, emissive: [0.4, 0.6, 0.2], lit: false, noInk: true, doubleSided: true, fog: false });

  // il Varco: anello di pietra con spirale
  A.portalFrame = mk(merge(
    paint(torus(3.2, 0.5, 10, 40), hex('#2a1838')),
    ...[0, 1, 2, 3, 4, 5, 6, 7].map((k) => place(cone(0.3, 1.2, 6), [Math.cos(k * 0.785) * 3.6, Math.sin(k * 0.785) * 3.6, 0], [0, 0, k * 0.785 - Math.PI / 2], 1, k % 2 ? C.violet : hex('#2a1838'))),
    place(box(2.4, 1.0, 1.6), [0, -3.6, 0], [0, 0, 0], 1, hex('#2a1838')),
  ));
  A.portalFrameMat = toon({});
  A.portalDisc = mk(disc(0, 2.75, 32));
  A.portalMat = toon({ map: tex.portal, emMap: tex.portalEm, emissive: [0.5, 0.6, 0.4], lit: false, doubleSided: true, noInk: true });
  A.portalBack = mk(disc(0, 2.8, 32));
  A.portalBackMat = toon({ color: [0.02, 0.01, 0.04], lit: false, doubleSided: true, noInk: true });

  // l'Occhio del Parassita: enorme, nel cielo
  A.godEye = mk(eyeGeo(1, hex('#58c8f0')));
  A.godEyeMat = toon({ lit: true, fog: false });
  A.godRays = mk(merge(...[...Array(24)].map((_, k) => place(prism([[-0.07, 0], [0.07, 0], [0.02, 1], [-0.02, 1]], 0.05), [Math.cos(k * TAU / 24) * 1.35, Math.sin(k * TAU / 24) * 1.35, 0], [0, 0, k * TAU / 24 - Math.PI / 2], [1, k % 2 ? 1.1 : 0.7, 1], C.gold))));
  A.godRaysMat = toon({ emissive: [0.35, 0.25, 0.08], lit: false, fog: false });
  A.godLid = mk(paint(torus(1.06, 0.3, 10, 32), hex('#e8d9b8')));
  A.godLidMat = toon({ fog: false });
  return A;
}

// Il cielo: una grande sfera intorno alla camera, disegnata senza profondità
export function buildSky(r, tex, A) {
  const sky = new Node();
  const dome = new Node(r.mesh(sphere(300, 32, 20)), toon({ map: tex.sky, lit: false, fog: false, doubleSided: true, depthWrite: false, noInk: true }));
  sky.add(dome);
  const eye = new Node();
  const d = EYE_DIR;
  eye.setPos(d[0] * 230, d[1] * 230, d[2] * 230);
  eye.setRot(Math.asin(d[1]), Math.atan2(-d[0], -d[2]), 0);
  const ball = new Node(A.godEye, A.godEyeMat); ball.setScale(26);
  const lid = new Node(A.godLid, A.godLidMat); lid.setScale(26); lid.position[2] = -8;
  const rays = new Node(A.godRays, A.godRaysMat); rays.setScale(34); rays.position[2] = -20;
  eye.add(rays, lid, ball);
  // L'Occhio NON sta nella cupola: va aggiunto alla scena principale, così ha profondità
  // e contorni d'inchiostro. inkNoFog evita che la nebbia cancelli l'inchiostro da lontano.
  for (const n of [ball, lid, rays]) n.inkNoFog = true;
  sky.eye = eye; sky.ball = ball; sky.rays = rays; sky.lid = lid;
  return sky;
}

export class Pickup {
  constructor(ch, x, z, A, game) {
    const d = PICKUP_DEFS[ch];
    this.def = d; this.x = x; this.z = z; this.taken = false; this.t = rand(0, 10);
    this.node = new Node();
    this.node.setPos(x, 0, z);
    this.node.cullRadius = 2;
    let body;
    if (ch === 'h') body = new Node(A.soul, A.soulMat);
    else if (ch === 'H') body = new Node(A.bigSoul, A.soulMat);
    else if (ch === 'f') body = new Node(A.flameAmmo, A.flameAmmoMat);
    else if (ch === 'b') body = new Node(A.bones, A.bonesMat);
    else if (ch === 'g') {
      body = new Node(A.sigils, A.sigilsMat);
      const f = new Node(A.sigilsFace, A.sigilsFaceMat); f.setRot(-Math.PI / 2, 0, 0); f.position[1] = 0.3;
      body.add(f);
    } else if (ch === 'K') body = new Node(A.key, A.keyMat);
    else if (ch === '3') {
      body = new Node(game.V.thanateros.children[0].mesh, toon({})); body.setScale(2.2); body.setRot(0, 0, 0.3);
      const ped = new Node(A.weaponPedestal, A.pedestalMat); ped.position[1] = 0.25; this.node.add(ped);
    } else if (ch === '4') {
      body = new Node(A.sigilsFace, A.sigilsFaceMat); body.setScale(3);
      const ped = new Node(A.weaponPedestal, A.pedestalMat); ped.position[1] = 0.25; this.node.add(ped);
    }
    this.body = body;
    this.node.add(body);
    this.ring = new Node(A.glowRing, A.glowRingMat); this.ring.setRot(-Math.PI / 2, 0, 0); this.ring.position[1] = 0.06;
    this.node.add(this.ring);
    this.kind = d.kind;
    this.game = game;
  }

  update(dt) {
    this.t += dt;
    const k = this.def.kind;
    this.body.position[1] = (k === 'weapon' ? 1.6 : 1.0) + Math.sin(this.t * 2.2) * 0.18;
    this.body.rotation[1] = this.t * (k === 'weapon' ? 0.9 : 1.6);
    if (this.body.children.length && k !== 'weapon') this.body.children[0].rotation[2] = this.t;
    this.ring.setScale(1 + Math.sin(this.t * 3) * 0.12);
    const col = k === 'health' ? [0.81, 1, 0.5] : k === 'key' ? [0.6, 0.45, 1] : k === 'weapon' ? [0.81, 1, 0.5] : [1, 0.9, 0.6];
    this.game.r.fxAdd.push(this.x, this.body.position[1] + 0.2, this.z, k === 'weapon' ? 2.4 : 1.4, col[0], col[1], col[2], 0.25 + Math.sin(this.t * 3) * 0.1, 0);
  }
}

export class Portal {
  constructor(x, z, A, game) {
    this.x = x; this.z = z; this.game = game; this.active = false; this.t = 0;
    this.node = new Node(); this.node.setPos(x, 4.2, z);
    this.frame = new Node(A.portalFrame, A.portalFrameMat);
    this.back = new Node(A.portalBack, A.portalBackMat); this.back.position[2] = -0.05;
    this.disc = new Node(A.portalDisc, A.portalMat);
    this.node.add(this.frame, this.back, this.disc);
    this.node.cullRadius = 6;
    this.disc.visible = false; this.back.visible = false;
  }
  update(dt) {
    this.t += dt;
    this.node.rotation[1] = Math.atan2(this.game.player.x - this.x, this.game.player.z - this.z);
    this.frame.rotation[2] = this.t * 0.15;
    if (this.active) {
      this.disc.rotation[2] = -this.t * 1.6;
      const s = Math.min(1, this.openT = (this.openT || 0) + dt * 0.6);
      this.disc.setScale(s); this.back.setScale(s);
      const b = this.game.r.fxAdd;
      b.push(this.x, 4.2, this.z, 7 * s, 0.6, 0.45, 1, 0.3, 0);
      b.push(this.x, 4.2, this.z, 3.5 * s, 0.81, 1, 0.5, 0.3, 0);
      if (Math.random() < 0.3) this.game.fx.spawn({ x: this.x + rand(-2.5, 2.5), y: 4.2 + rand(-2.5, 2.5), z: this.z + rand(-0.5, 0.5), vy: rand(1, 3), life: 1, s0: 0.3, s1: 0, c: [0.81, 1, 0.5], style: 3 });
    }
  }
  open() { this.active = true; this.disc.visible = true; this.back.visible = true; this.openT = 0; }
}

export { CELL };
