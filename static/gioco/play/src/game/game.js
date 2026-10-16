// =============================================================
//  game/game.js — il ciclo di gioco: mette insieme tutto
// =============================================================
import { Renderer } from '../engine/renderer.js';
import { Node, toon } from '../engine/scene.js';
import { sphere } from '../engine/geometry.js';
import { rand, clamp, lerp, hex, TAU, approachAngle } from '../engine/math.js';
import { Level, START_YAW } from './level.js';
import { makeTextures } from './textures.js';
import { CELL, FOV, CEIL_H, WALL_H, C, PLAYER, AMMO } from './config.js';
import { Player } from './player.js';
import { Weapons, buildViewModels } from './weapons.js';
import { Angel, initAngelAssets, orbMesh, ORB_MATERIAL, ANGEL_DEFS } from './angels.js';
import { buildPropAssets, buildSky, Pickup, Portal, PICKUP_DEFS } from './props.js';
import { FX } from './fx.js';
import { EYE_DIR } from './textures.js';
import { buildAngelModel, animateModel } from './angels.js';
import { AudioSys } from './audio.js';

export class Game {
  constructor(canvas, ui, musicUrl) {
    this.canvas = canvas; this.ui = ui;
    this.r = new Renderer(canvas);
    this.audio = new AudioSys();
    if (musicUrl) this.audio.prefetch(musicUrl);
    this.time = 0; this.state = 'title'; // title | play | pause | dead | won
    this.shakeAmt = 0; this.flashCol = [0, 0, 0, 0]; this.flashT = 0;
    this.noise = { x: 0, z: 0, r: 0, t: 0 };
    this.messages = []; this.hintT = 0;
    this.input = { fwd: false, back: false, left: false, right: false, run: false, fire: false, use: false };
    this.tex = makeTextures(this.r);
    this.level = new Level();
    this.scene = new Node();
    this.levelRoot = this.level.build(this.r, this.tex);
    this.scene.add(this.levelRoot);
    this.propAssets = buildPropAssets(this.r, this.tex);
    this.sky = buildSky(this.r, this.tex, this.propAssets);
    this.scene.add(this.sky.eye);
    this.fx = new FX(this.r);
    this.V = buildViewModels(this.r, this.tex);
    initAngelAssets(this.r);
    this.angels = []; this.pickups = []; this.projectiles = []; this.props = []; this.lights = [];
    this.portal = null; this.boss = null; this.bossAlive = false; this.portalTimer = 0;
    this.visitedAreas = new Set();
    this.totalAngels = 0; this.totalSecrets = 1;
    this.levelTime = 0;
    this.overHeal = false;
    this.touchMode = false;
    this._spawnEntities();
    this._buildFlow();
    this.weapons = new Weapons(this);
    this.weapons.attach(this.V, this.player.camNode);
    this.scene.add(this.player.camNode);
    this.cam = { node: this.player.camNode, fov: FOV, near: 0.08, far: 400 };
    this.lastT = 0;
    this.fps = 60;
  }

  // ---------------------------------------------------------
  _spawnEntities() {
    const L = this.level, A = this.propAssets;
    const propMat = toon({});
    for (const e of L.entities) {
      const x = (e.x + 0.5) * CELL, z = (e.z + 0.5) * CELL, ch = e.ch;
      if (ch === 'P') { this.player = new Player(this, x, z, START_YAW); continue; }
      if (ch === 'o' || ch === 's' || ch === 'c' || ch === 'B') {
        const type = { o: 'ofano', s: 'serafino', c: 'cherubino', B: 'esattore' }[ch];
        const a = this.spawnAngel(type, x, z, false);
        if (ch === 'B') this.boss = a;
        continue;
      }
      if (PICKUP_DEFS[ch]) { const p = new Pickup(ch, x, z, A, this); this.pickups.push(p); this.scene.add(p.node); continue; }
      if (ch === 'I') {
        const n = new Node(A.pillar, propMat); n.setPos(x, WALL_H / 2 - 0.9, z); n.cullRadius = 7; this.scene.add(n);
        this.props.push({ x, z, r: 1.0 }); L.propBlock[L.idx(e.x, e.z)] = 1; continue;
      }
      if (ch === 'T') {
        const n = new Node(A.brazier, propMat); n.setPos(x, 1.2, z); n.cullRadius = 3; this.scene.add(n);
        this.props.push({ x, z, r: 0.9, brazier: true, y: 3.0 }); L.propBlock[L.idx(e.x, e.z)] = 1;
        this.lights.push({ pos: [x, 3.4, z], color: [1, 0.75, 0.35], range: 14, flicker: true });
        continue;
      }
      if (ch === 'C') {
        const n = new Node(A.cage, A.cageMat); n.setPos(x, 0.25, z); n.cullRadius = 3; this.scene.add(n);
        this.props.push({ x, z, r: 2.1, cage: true, node: n, broken: false, souls: 6, hp: 40 }); L.propBlock[L.idx(e.x, e.z)] = 1;
        continue;
      }
      if (ch === 'X') { this.portal = new Portal(x, z, A, this); this.scene.add(this.portal.node); continue; }
    }
    this.totalAngels = this.angels.length;
  }

  spawnAngel(type, x, z, awake) {
    const a = new Angel(type, x, z, this);
    this.angels.push(a); this.scene.add(a.node);
    if (awake) { a.wake(); this.totalAngels++; this.fx.shockRing(x, 3, z, 5, [1, 0.9, 0.6]); }
    return a;
  }

  // Campo di flusso: ogni cella conosce la direzione verso il giocatore
  _buildFlow() {
    const L = this.level; this.flow = new Int16Array(L.w * L.h); this.flowT = 0;
  }
  _updateFlow() {
    const L = this.level, W = L.w, H = L.h, dist = this.flow;
    dist.fill(-1);
    const px = Math.floor(this.player.x / CELL), pz = Math.floor(this.player.z / CELL);
    if (!L.inside(px, pz)) return;
    const q = [px, pz]; dist[pz * W + px] = 0;
    let qi = 0;
    while (qi < q.length) {
      const x = q[qi++], z = q[qi++], d = dist[z * W + x];
      if (d > 40) continue;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, nz = z + dz;
        if (L.blocksMonster(nx, nz)) continue;
        const i = nz * W + nx;
        if (dist[i] !== -1) continue;
        dist[i] = d + 1; q.push(nx, nz);
      }
    }
  }
  flowDir(x, z) {
    const L = this.level, W = L.w;
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    if (!L.inside(cx, cz)) return null;
    const d0 = this.flow[cz * W + cx];
    if (d0 <= 0) return null;
    let best = d0, bx = 0, bz = 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const i = (cz + dz) * W + cx + dx, d = this.flow[i];
      if (d !== -1 && d < best) { best = d; bx = dx; bz = dz; }
    }
    if (!bx && !bz) return null;
    // punta al centro della cella successiva
    const tx = (cx + bx + 0.5) * CELL - x, tz = (cz + bz + 0.5) * CELL - z, l = Math.hypot(tx, tz) || 1;
    return [tx / l, tz / l];
  }

  collideProps(x, z, r, out = [0, 0]) {
    for (const p of this.props) {
      if (p.broken) continue;
      const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz), min = r + p.r;
      if (d < min && d > 0.001) { x = p.x + (dx / d) * min; z = p.z + (dz / d) * min; }
    }
    out[0] = x; out[1] = z; return out;
  }

  // ---------------------------------------------------------
  //  Avvio / stati
  // ---------------------------------------------------------
  start() {
    this.audio.init();
    this.audio.playMusic();
    this.state = 'play';
    this.ui.setState('play');
    this.ui.showArea('LA BRECCIA', 'Hai squarciato il velo del suo Cielo.');
    this.visitedAreas.add('LA BRECCIA');
    this.audio.setMuffled(false);
  }
  pause() { if (this.state !== 'play') return; this.state = 'pause'; this.ui.setState('pause'); this.audio.setMuffled(true); }
  resume() { if (this.state !== 'pause') return; this.state = 'play'; this.ui.setState('play'); this.audio.setMuffled(false); if (this.audio.ctx) this.audio.ctx.resume(); }
  onPlayerDeath() { this.state = 'dead'; this.deadT = 0; this.audio.setMuffled(true); this.ui.setState('dead'); }
  onBossWake(b) { this.bossAlive = true; this.ui.showBoss(true, b.def.name); this.message("L'ESATTORE DI ANIME", 'Il carceriere del Chiostro. Nel suo petto, le anime rubate.'); this.audio.bossRoar(1); }
  updateBossBar(b) { this.ui.setBoss(b.hp / b.def.hp); }
  onAngelDeath(a) {
    this.player.kills++;
    this.fx.souls(a.x, a.y + (a.def.boss ? 7 : 0), a.z, a.def.boss ? 40 : 4, () => [this.player.x, this.player.eyeY() - 0.5, this.player.z]);
    if (a.def.boss) {
      this.bossAlive = false; this.ui.showBoss(false);
      this.shake(1.2); this.flash([1, 1, 0.85], 0.6);
      this.portalTimer = 1.8; // il Varco si apre poco dopo, in tempo di gioco
    } else if (a.def.drop && Math.random() < a.def.drop) {
      const ch = Math.random() < 0.5 ? 'h' : this.weapons.owned[3] ? 'b' : 'f';
      const p = new Pickup(ch, a.x, a.z, this.propAssets, this); this.pickups.push(p); this.scene.add(p.node);
    }
  }
  message(title, sub) { this.ui.showArea(title, sub); }
  hint(t) { this.ui.hint(t); }
  flash(col, a) { this.flashCol = [col[0], col[1], col[2], a]; this.flashT = a; }
  shake(k) { this.shakeAmt = Math.max(this.shakeAmt, k); }
  makeNoise(x, z, r) { this.noise = { x, z, r, t: 0.3 }; }

  // ---------------------------------------------------------
  //  Combattimento
  // ---------------------------------------------------------
  // Cerca l'angelo più vicino alla direzione di mira (cono orizzontale, entro maxPitch dallo sguardo)
  _findTarget(ox, oy, oz, dx, dy, dz, cone, maxPitch) {
    const hl = Math.hypot(dx, dz) || 1e-6, ux = dx / hl, uz = dz / hl;
    const curPitch = Math.atan2(dy, hl);
    let best = null;
    for (const a of this.angels) {
      if (a.dead) continue;
      const cy = a.y + (a.def.boss ? 6 : 0);
      const tx = a.x - ox, tz = a.z - oz, hd = Math.hypot(tx, tz);
      if (hd < 0.5 || hd > 70) continue;
      const cosA = (tx * ux + tz * uz) / hd;
      if (cosA <= 0) continue;
      const ang = Math.acos(Math.min(1, cosA));
      const tol = cone + Math.atan((a.def.boss ? 3 : a.r * 0.6) / hd);   // i bersagli grandi o vicini sono più facili
      if (ang > tol) continue;
      const pitch = Math.atan2(cy - oy, hd);
      if (Math.abs(pitch - curPitch) > maxPitch) continue;
      if (!this.level.lineOfSight(ox, oz, a.x, a.z)) continue;
      const score = ang / tol;
      if (!best || score < best.score) best = { a, score, hd, cy, tx, tz };
    }
    return best;
  }

  // Mira assistita alla Doom: il colpo sale o scende da solo verso l'angelo che hai davanti.
  // Col touch punta proprio al centro del bersaglio.
  autoAim(ox, oy, oz, dx, dy, dz) {
    const t = this._findTarget(ox, oy, oz, dx, dy, dz, this.touchMode ? 0.2 : 0.11, this.touchMode ? 0.8 : 0.45);
    if (!t) return [dx, dy, dz];
    if (this.touchMode) {
      const vy = t.cy - oy, l = Math.hypot(t.tx, vy, t.tz) || 1;
      return [t.tx / l, vy / l, t.tz / l];
    }
    const hl = Math.hypot(dx, dz) || 1e-6, s = (t.cy - oy) / t.hd, l = Math.hypot(1, s);
    return [dx / hl / l, s / l, dz / hl / l];
  }

  // Col touch, mentre spari, la visuale "aggancia" dolcemente l'angelo vicino al mirino
  _aimAssist(dt) {
    const pl = this.player, [dx, dy, dz] = pl.aimDir();
    const t = this._findTarget(pl.x, pl.eyeY(), pl.z, dx, dy, dz, 0.24, 0.9);
    if (!t) return;
    const k = 1 - Math.exp(-dt * 5);
    pl.yaw = approachAngle(pl.yaw, Math.atan2(-t.tx, -t.tz), k);
    pl.pitch += (clamp(Math.atan2(t.cy - pl.eyeY(), t.hd), -1.2, 1.2) - pl.pitch) * k;
  }

  // colpisce il primo angelo lungo il raggio (per gli artigli)
  meleeHit(ox, oy, oz, dx, dy, dz, range, dmg) {
    const hit = this._rayAngel(ox, oy, oz, dx, dy, dz, range);
    if (hit) { hit.a.damage(dmg, ox, oz); this.audio.hitAngel(hit.a.x, hit.a.z); return true; }
    const cage = this._rayCage(ox, oz, dx, dz, range);
    if (cage) { this.damageCage(cage, dmg); return true; }
    return false;
  }

  hitscan(ox, oy, oz, dx, dy, dz, range, dmg, first) {
    const L = this.level, hl = Math.hypot(dx, dz) || 1e-6;
    const wall = L.raycast(ox, oz, dx / hl, dz / hl, range * hl);
    let maxT = wall.hit ? wall.dist / hl : range;
    // pavimento / soffitto
    if (dy < -1e-4) maxT = Math.min(maxT, -oy / dy);
    else if (dy > 1e-4) { const cx = Math.floor(ox / CELL), cz = Math.floor(oz / CELL); if (L.isIndoor(cx, cz)) maxT = Math.min(maxT, (CEIL_H - oy) / dy); }
    const hit = this._rayAngel(ox, oy, oz, dx, dy, dz, maxT);
    if (hit) { hit.a.damage(dmg, ox, oz); if (first) this.audio.hitAngel(hit.a.x, hit.a.z); this.fx.boneDust(hit.x, hit.y, hit.z); return; }
    const cage = this._rayCage(ox, oz, dx, dz, maxT);
    if (cage) { this.damageCage(cage, dmg); return; }
    const ex = ox + dx * maxT, ey = oy + dy * maxT, ez = oz + dz * maxT;
    this.fx.boneDust(ex - dx * 0.2, ey - dy * 0.2, ez - dz * 0.2);
  }

  _rayAngel(ox, oy, oz, dx, dy, dz, maxT) {
    let best = null;
    for (const a of this.angels) {
      if (a.dead) continue;
      const cy = a.y + (a.def.boss ? 6 : 0), rr = a.def.boss ? 4.5 : a.r + 0.3;
      const px = a.x - ox, py = cy - oy, pz = a.z - oz;
      const t = px * dx + py * dy + pz * dz;
      if (t < 0 || t > maxT) continue;
      const qx = ox + dx * t - a.x, qy = oy + dy * t - cy, qz = oz + dz * t - a.z;
      const d2 = qx * qx + qy * qy + qz * qz;
      if (d2 > rr * rr) continue;
      if (!best || t < best.t) best = { a, t, x: ox + dx * t, y: oy + dy * t, z: oz + dz * t };
    }
    if (best && !this.level.lineOfSight(ox, oz, best.a.x, best.a.z)) return null;
    return best;
  }
  _rayCage(ox, oz, dx, dz, maxT) {
    const hl = Math.hypot(dx, dz) || 1e-6;
    for (const p of this.props) {
      if (!p.cage || p.broken) continue;
      const px = p.x - ox, pz = p.z - oz, t = (px * dx + pz * dz) / (hl * hl);
      const qx = ox + dx * t - p.x, qz = oz + dz * t - p.z, lat2 = qx * qx + qz * qz, R = 2.2;
      if (lat2 >= R * R) continue;
      // punto in cui il raggio entra nella gabbia
      const tin = t - Math.sqrt(R * R - lat2) / hl;
      if (tin < -1 || tin > maxT) continue;
      return p;
    }
    return null;
  }
  damageCage(p, dmg) {
    p.hp -= dmg; p.node.flash = 1;
    this.audio.cage(p.x, p.z);
    if (p.hp <= 0) {
      p.broken = true; p.node.visible = false;
      const L = this.level; L.propBlock[L.idx(Math.floor(p.x / CELL), Math.floor(p.z / CELL))] = 0;
      this.fx.souls(p.x, 1.5, p.z, 14, () => [this.player.x, this.player.eyeY() - 0.5, this.player.z]);
      this.fx.shockRing(p.x, 1.5, p.z, 6, [0.81, 1, 0.5]);
      this.player.heal(15); this.player.souls += 6;
      this.message('ANIME LIBERATE', 'Sei venuto per questo. +15 vita');
      this.audio.secret();
    }
  }

  spawnBolt(x, y, z, dx, dy, dz, d) {
    const n = new Node(this.V.boltMesh, this.V.boltMat);
    this.scene.add(n);
    this.projectiles.push({ kind: 'bolt', x, y, z, vx: dx * d.speed, vy: dy * d.speed, vz: dz * d.speed, dmg: rand(d.dmg[0], d.dmg[1]), node: n, r: 0.3, life: 2.5, friendly: true });
  }
  spawnSigil(x, y, z, dx, dy, dz, d) {
    const n = new Node(this.V.sigilMesh, this.V.sigilProjMat);
    const f = new Node(this.V.sigilFaceMesh, this.V.sigilFaceMat); f.position[2] = 0.06; n.add(f);
    const b = new Node(this.V.sigilFaceMesh, this.V.sigilFaceMat); b.position[2] = -0.06; b.rotation[1] = Math.PI; n.add(b);
    this.scene.add(n);
    this.projectiles.push({ kind: 'sigil', x, y, z, vx: dx * d.speed, vy: dy * d.speed, vz: dz * d.speed, dmg: rand(d.dmg[0], d.dmg[1]), splash: d.splash, splashDmg: d.splashDmg, node: n, r: 0.8, life: 4, friendly: true, spin: 0 });
  }
  spawnOrb(x, y, z, dx, dy, dz, o, extra = {}) {
    const n = new Node(orbMesh(), ORB_MATERIAL);
    n.setScale(o.size);
    this.scene.add(n);
    this.projectiles.push({ kind: extra.big ? 'bigorb' : 'orb', x, y, z, vx: dx * o.speed, vy: dy * o.speed, vz: dz * o.speed, dmg: o.dmg, node: n, r: o.size, life: extra.life || 5, friendly: false, homing: extra.homing || 0, speed: o.speed });
  }

  _updateProjectiles(dt) {
    const L = this.level, P = this.projectiles, pl = this.player;
    let w = 0;
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      p.life -= dt;
      let dead = p.life <= 0;
      if (p.homing && pl.alive) {
        const tx = pl.x - p.x, ty = pl.eyeY() - 0.4 - p.y, tz = pl.z - p.z, l = Math.hypot(tx, ty, tz) || 1;
        p.vx += (tx / l) * p.homing * p.speed * dt; p.vy += (ty / l) * p.homing * p.speed * dt; p.vz += (tz / l) * p.homing * p.speed * dt;
        const s = Math.hypot(p.vx, p.vy, p.vz) || 1; p.vx *= p.speed / s; p.vy *= p.speed / s; p.vz *= p.speed / s;
      }
      const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt, nz = p.z + p.vz * dt;
      const step = Math.hypot(p.vx, p.vz) * dt;
      // muri
      if (step > 0) {
        const rc = L.raycast(p.x, p.z, (nx - p.x) / step, (nz - p.z) / step, step + p.r);
        if (rc.hit) dead = 'wall';
      }
      if (ny < 0.1) dead = 'wall';
      const cx = Math.floor(nx / CELL), cz = Math.floor(nz / CELL);
      if (ny > CEIL_H - 0.1 && L.isIndoor(cx, cz)) dead = 'wall';
      if (ny > WALL_H + 20) dead = true;
      if (!dead) {
        if (p.friendly) {
          for (const a of this.angels) {
            if (a.dead) continue;
            const cy = a.y + (a.def.boss ? 6 : 0), rr = (a.def.boss ? 4.2 : a.r) + p.r;
            const dx = nx - a.x, dy = ny - cy, dz = nz - a.z;
            if (dx * dx + dy * dy + dz * dz < rr * rr) { a.damage(p.dmg, p.x, p.z, p.kind === 'sigil' ? 'blast' : 'hit'); this.audio.hitAngel(a.x, a.z); dead = 'angel'; break; }
          }
          if (!dead) for (const c of this.props) {
            if (!c.cage || c.broken) continue;
            const dx = nx - c.x, dz = nz - c.z;
            if (dx * dx + dz * dz < 2.3 * 2.3 && ny < 3) { this.damageCage(c, p.dmg); dead = 'wall'; break; }
          }
        } else if (pl.alive) {
          const dx = nx - pl.x, dy = ny - (pl.eyeY() - 0.6), dz = nz - pl.z, rr = 1.2 + p.r;
          if (dx * dx + dy * dy * 0.5 + dz * dz < rr * rr) { pl.hurt(p.dmg, p.x, p.z); dead = 'player'; }
        }
      }
      p.x = nx; p.y = ny; p.z = nz;
      if (dead) {
        this.scene.remove(p.node);
        if (p.kind === 'bolt') { this.fx.boltHit(p.x, p.y, p.z); if (dead === 'wall') this.audio.impact(p.x, p.z); }
        else if (p.kind === 'sigil') this._sigilBlast(p);
        else if (dead !== true) { this.fx.holyHit(p.x, p.y, p.z); this.audio.impact(p.x, p.z, true); }
        continue;
      }
      p.node.setPos(nx, ny, nz);
      if (p.kind === 'bolt') { p.node.setRot(Math.atan2(p.vy, Math.hypot(p.vx, p.vz)) * -1 + 0, Math.atan2(p.vx, p.vz), 0); this.fx.trail(nx, ny, nz, 'bolt'); }
      else if (p.kind === 'sigil') { p.spin += dt * 9; p.node.setRot(0, Math.atan2(p.vx, p.vz), p.spin); this.fx.trail(nx, ny, nz, 'sigil'); this.r.fxAdd.push(nx, ny, nz, 2.2, 0.81, 1, 0.5, 0.4, 0); }
      else { this.fx.trail(nx, ny, nz, p.kind); this.r.fxAdd.push(nx, ny, nz, p.r * 3.2, 1, 0.9, 0.55, 0.55, 0); }
      P[w++] = p;
    }
    P.length = w;
  }

  _sigilBlast(p) {
    this.fx.explosion(p.x, p.y, p.z, 1);
    this.audio.explosion(p.x, p.z);
    this.shake(0.8); this.flash([0.81, 1, 0.5], 0.25);
    this.lights.push({ pos: [p.x, p.y, p.z], color: [0.81, 1, 0.5], range: 22, life: 0.5, intensity: 2 });
    for (const a of this.angels) {
      if (a.dead) continue;
      const cy = a.y + (a.def.boss ? 6 : 0);
      const d = Math.hypot(a.x - p.x, cy - p.y, a.z - p.z);
      if (d < p.splash + a.r) { const k = 1 - clamp((d - a.r) / p.splash, 0, 1); a.damage(p.splashDmg * (0.4 + 0.6 * k), p.x, p.z, 'blast'); }
    }
    for (const c of this.props) if (c.cage && !c.broken && Math.hypot(c.x - p.x, c.z - p.z) < p.splash + 2) this.damageCage(c, 100);
    const pl = this.player, d = Math.hypot(pl.x - p.x, pl.eyeY() - p.y, pl.z - p.z);
    if (d < p.splash * 0.8 && pl.alive) pl.hurt(Math.round(35 * (1 - d / (p.splash * 0.8))), p.x, p.z);
  }

  // ---------------------------------------------------------
  //  Interazione: porte, segreti, oggetti
  // ---------------------------------------------------------
  _use() {
    const pl = this.player, [dx, , dz] = pl.aimDir();
    const hl = Math.hypot(dx, dz) || 1;
    const rc = this.level.raycast(pl.x, pl.z, dx / hl, dz / hl, 6);
    // cerca una porta nelle celle lungo il raggio corto
    for (let t = 1; t <= 6; t += 1) {
      const cx = Math.floor((pl.x + (dx / hl) * t) / CELL), cz = Math.floor((pl.z + (dz / hl) * t) / CELL);
      const d = this.level.doorAt(cx, cz);
      if (d) { this._openDoor(d); return; }
    }
    void rc;
    this.hint('Niente da aprire qui');
  }

  _openDoor(d) {
    if (d.opening) return;
    if (d.type === 'L' && !this.player.hasKey) { this.audio.locked(); this.hint('Sigillata. Serve il Sigillo Viola.'); this.flash([0.4, 0.3, 0.9], 0.15); return; }
    d.opening = true;
    const c = d.cells[0];
    this.audio.door((c.x + 0.5) * CELL, (c.z + 0.5) * CELL, d.type === 'S' || d.type === 'L');
    if (d.type === 'S') { this.player.secrets++; this.audio.secret(); this.message('SEGRETO TROVATO', 'Il muro cede. Qualcosa era stato murato qui dentro.'); this.shake(0.5); }
    if (d.type === 'L') this.message('IL SIGILLO SI SPEZZA', 'La porta del Coro si apre.');
    setTimeout(() => this._updateFlow(), 900);
  }

  _autoDoors() {
    // le porte normali si aprono avvicinandosi
    const pl = this.player;
    for (const d of this.level.doors) {
      if (d.opening || d.type !== 'D') continue;
      for (const c of d.cells) {
        if (Math.hypot((c.x + 0.5) * CELL - pl.x, (c.z + 0.5) * CELL - pl.z) < 5.5) { this._openDoor(d); break; }
      }
    }
    // i segreti si "intuiscono": suggerimento se guardi il muro giusto da vicino
    for (const d of this.level.doors) {
      if (d.opening || d.type !== 'S') continue;
      for (const c of d.cells) {
        const dx = (c.x + 0.5) * CELL - pl.x, dz = (c.z + 0.5) * CELL - pl.z, dd = Math.hypot(dx, dz);
        if (dd < 5) {
          const [ax, , az] = pl.aimDir();
          if ((ax * dx + az * dz) / (dd * (Math.hypot(ax, az) || 1)) > 0.85) this.hint('Un sigillo sbiadito sulla pietra… [E]');
        }
      }
    }
  }

  _updatePickups(dt) {
    const pl = this.player;
    for (const p of this.pickups) {
      if (p.taken) continue;
      p.update(dt);
      if (!pl.alive) continue;
      if (Math.hypot(p.x - pl.x, p.z - pl.z) < 1.9) {
        const d = p.def;
        if (d.kind === 'health') { if (pl.hp >= (d.amount >= 25 ? PLAYER.overHp : PLAYER.maxHp)) continue; this.overHeal = d.amount >= 25; pl.heal(d.amount); this.overHeal = false; pl.souls++; this.audio.pickup('health'); this.hint('+' + d.amount + ' ' + d.name); }
        else if (d.kind === 'ammo') { const A = AMMO[d.ammo]; if (pl.ammo[d.ammo] >= A.max) continue; pl.ammo[d.ammo] = Math.min(A.max, pl.ammo[d.ammo] + d.amount); this.audio.pickup('ammo'); this.hint('+' + d.amount + ' ' + d.name); }
        else if (d.kind === 'weapon') { this.weapons.give(d.weapon); pl.ammo[d.weapon === 3 ? 'ossa' : 'sigilli'] += d.weapon === 3 ? 16 : 6; this.audio.pickup('weapon'); this.message(d.name, d.msg); this.flash([0.81, 1, 0.5], 0.3); }
        else if (d.kind === 'key') { pl.hasKey = true; this.audio.pickup('key'); this.message(d.name, d.msg); this.flash([0.5, 0.35, 1], 0.3); this.ui.setKey(true); }
        p.taken = true; p.node.visible = false;
        this.fx.shockRing(p.x, 1, p.z, 3, [0.81, 1, 0.5]);
      }
    }
  }

  // ---------------------------------------------------------
  //  Aggiornamento
  // ---------------------------------------------------------
  update(dt) {
    this.time += dt;
    this.audio.update(dt);
    const pl = this.player, inp = this.input;
    if (this.state === 'play' || this.state === 'dead' || this.state === 'won') {
      if (this.state === 'play') this.levelTime += dt;
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.5);
      this.flashT = Math.max(0, this.flashT - dt);
      this.noise.t -= dt;
      pl.update(dt, this.state === 'play' ? inp : {});
      if (inp.use && this.state === 'play') { inp.use = false; this._use(); }
      if (this.touchMode && inp.fire && this.state === 'play' && pl.alive) this._aimAssist(dt);
      this.weapons.update(dt, inp.fire && this.state === 'play', pl.moving);
      this.level.update(dt);
      this._autoDoors();
      this.flowT -= dt; if (this.flowT <= 0) { this.flowT = 0.35; this._updateFlow(); }
      for (const a of this.angels) a.update(dt);
      this.angels = this.angels.filter((a) => { if (a.removed) this.scene.remove(a.node); return !a.removed; });
      this._updateProjectiles(dt);
      this._updatePickups(dt);
      if (this.portal) {
        this.portal.update(dt);
        if (this.portal.active && this.state === 'play' && Math.hypot(pl.x - this.portal.x, pl.z - this.portal.z) < 3.2) this._win();
      }
      this.fx.update(dt);
      if (this.portalTimer > 0) {
        this.portalTimer -= dt;
        if (this.portalTimer <= 0 && this.portal) { this.portal.open(); this.audio.portal(); this.message('IL VARCO SI APRE', 'Le anime sono libere. Raggiungi il Varco.'); }
      }
      // aree
      const area = this.level.areaAt(Math.floor(pl.x / CELL), Math.floor(pl.z / CELL));
      if (area && !this.visitedAreas.has(area.name) && this.state === 'play') { this.visitedAreas.add(area.name); this.message(area.name, area.sub); }
      if (this.state === 'dead') { this.deadT += dt; }
      this.audio.setListener(pl.x, pl.z, pl.yaw);
    }
    if (this.state === 'title') {
      for (const a of this.angels) a.update(dt);
      for (const p of this.pickups) p.update(dt);
      this.fx.update(dt);
      this._titleCamera();
    }
    this.weapons.holder.visible = this.state !== 'title' && this.state !== 'won';
    this._updateWorld(dt);
    this._updateHud();
  }

  // Inquadratura lenta del Chiostro per la schermata iniziale
  _titleCamera() {
    const t = this.time * 0.06, c = this.player.camNode;
    const cx = 10 * CELL, cz = 13.5 * CELL;
    c.setPos(cx + Math.sin(t) * 15, 4.2 + Math.sin(t * 1.7) * 0.6, cz + Math.cos(t) * 15);
    c.setRot(0.32, t + 0.25, 0);
  }

  // ---------------------------------------------------------
  //  Bestiario: piccola scena a parte con l'angelo che ruota
  // ---------------------------------------------------------
  bestiary(on) {
    this.bestOn = on;
    if (on && !this.best) {
      const sc = new Node(), cam = new Node();
      sc.add(cam);
      const models = {};
      for (const k of ['ofano', 'serafino', 'cherubino', 'esattore']) { const m = buildAngelModel(k); m.root.visible = false; sc.add(m.root); models[k] = m; }
      const back = new Node(this.r.mesh(sphere(150, 24, 16)), toon({ map: this.tex.backdrop, lit: false, fog: false, doubleSided: true, depthWrite: false, noInk: true }));
      const sky = new Node(); sky.add(back);
      this.best = { scene: sc, cam, models, sky, type: 'ofano', t: 0 };
    }
  }
  bestiaryShow(k) {
    if (!this.best) this.bestiary(true);
    this.best.type = k;
    for (const key in this.best.models) this.best.models[key].root.visible = key === k;
  }
  _renderBestiary(dt) {
    const B = this.best, m = B.models[B.type];
    B.t += dt;
    const F = { ofano: [7.5, 0], serafino: [8.5, -0.3], cherubino: [8.5, 0], esattore: [19, 6.2] }[B.type];
    const narrow = this.canvas.clientWidth < 720;
    // l'angelo a destra del testo (su schermi stretti: in alto)
    const ty = Math.tan(FOV / 2), tx = ty * (this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight));
    F[2] = narrow ? 0 : F[0] * tx * 0.45;
    m.root.setPos(F[2], 0, 0);
    m.root.rotation[1] = B.t * 0.5;
    const open = B.type === 'serafino' ? (Math.sin(B.t * 1.2) > 0.3 ? 1 : 0) : B.type === 'esattore' ? (Math.sin(B.t * 1.5) * 0.5 + 0.5) : 0;
    m.open = (m.open || 0) + (open - (m.open || 0)) * Math.min(1, dt * 5);
    animateModel(B.type, m, B.t, m.open, Math.max(0, Math.sin(B.t * 2)) * 0.8);
    B.cam.setPos(0, F[1] - (narrow ? F[0] * ty * 0.42 : 0), F[0]);
    B.cam.setRot(0, 0, 0);
    const env = this.r.env, saved = { n: env.fogNear, f: env.fogFar, pts: this.r.points };
    env.fogNear = 300; env.fogFar = 400;
    this.r.points = [{ pos: [F[2] - 3, F[1] + 3, 5], color: [0.81, 1, 0.5], range: 16, intensity: 0.7 }, { pos: [F[2] + 4, F[1] - 2, 3], color: [0.55, 0.4, 1], range: 18, intensity: 0.9 }];
    this.r.fxAdd.count = 0; this.r.fxAlpha.count = 0;
    this.r.render(B.scene, { node: B.cam, fov: FOV, near: 0.1, far: 400 }, B.sky);
    env.fogNear = saved.n; env.fogFar = saved.f; this.r.points = saved.pts;
  }

  _win() {
    this.state = 'won';
    this.audio.victory();
    this.flash([1, 1, 1], 1.5);
    this.ui.setState('won', { kills: this.player.kills, total: this.totalAngels, secrets: this.player.secrets, totalSecrets: this.totalSecrets, souls: this.player.souls, time: this.levelTime });
  }

  _updateWorld(dt) {
    const pl = this.player, bass = this.audio.bass, beat = this.audio.beat;
    // cielo: segue la camera, l'Occhio pulsa con i bassi
    const cp = pl.camNode.position, s = this.sky, ed = EYE_DIR;
    s.setPos(cp[0], cp[1], cp[2]);
    s.eye.setPos(cp[0] + ed[0] * 230, cp[1] + ed[1] * 230, cp[2] + ed[2] * 230);
    const blink = (Math.sin(this.time * 0.37) > 0.985) ? 0.15 : 1;
    s.ball.setScale(26 * (1 + bass * 0.12), 26 * blink * (1 + bass * 0.12), 26);
    s.rays.rotation[2] = this.time * 0.05;
    s.rays.setScale(34 * (1 + beat * 0.25));
    // l'occhio guarda il giocatore: piccola rotazione dell'intero gruppo
    const eyeNode = s.eye;
    eyeNode.rotation[2] = Math.sin(this.time * 0.2) * 0.05;
    // anime prigioniere nelle gabbie
    for (const c of this.props) {
      if (!c.cage || c.broken) continue;
      const dd = Math.hypot(c.x - pl.x, c.z - pl.z);
      if (dd > 70) continue;
      for (let k = 0; k < 4; k++) {
        const a = this.time * (1.2 + k * 0.3) + k * 1.6, rr = 0.7 + Math.sin(this.time * 1.7 + k) * 0.25;
        this.r.fxAdd.push(c.x + Math.cos(a) * rr, 1.1 + Math.sin(a * 1.4 + k) * 0.35, c.z + Math.sin(a) * rr, 0.42, 0.81, 1, 0.5, 0.95, 0);
      }
      this.r.fxAdd.push(c.x, 1.1, c.z, 2.2, 0.81, 1, 0.5, 0.18 + bass * 0.2, 0);
    }
    // muri di carne che respirano
    const fleshMat = this.level.materials.flesh, fflesh = this.level.materials.f_flesh, breach = this.level.materials.breach;
    const pulse = 0.25 + bass * 0.55 + beat * 0.6;
    fleshMat.emissive = [pulse * 1.1, pulse * 0.12, pulse * 0.35];
    fflesh.emissive = [pulse * 0.9, pulse * 0.1, pulse * 0.3];
    breach.emissive = [0.45 + beat * 0.5, 0.75 + beat * 0.6, 0.3 + beat * 0.3];
    // occhi nei muri seguono il giocatore
    for (const e of this.level.wallEyes) {
      const dx = pl.x - e.x, dz = pl.z - e.z, dy = pl.eyeY() - e.y;
      const yaw = Math.atan2(dx, dz) - e.node.rotation[1];
      e.ball.rotation[1] = clamp(((yaw + Math.PI) % TAU + TAU) % TAU - Math.PI, -0.7, 0.7);
      e.ball.rotation[0] = clamp(-Math.atan2(dy, Math.hypot(dx, dz)), -0.6, 0.6);
    }
    // luci: bracieri che sfarfallano, esplosioni, bagliori delle armi; le 8 più vicine
    const L = [];
    for (const l of this.lights) {
      if (l.life !== undefined) { l.life -= dt; if (l.life <= 0) continue; l.intensity = l.life * 4; }
      L.push(l);
      if (l.flicker) { l.intensity = 0.85 + Math.sin(this.time * 13 + l.pos[0]) * 0.1 + Math.random() * 0.1; this.r.fxAdd.push(l.pos[0], l.pos[1] - 0.6, l.pos[2], 1.6 + Math.random() * 0.3, 1, 0.7, 0.3, 0.55, 0); this.fx.spawn({ x: l.pos[0] + rand(-0.4, 0.4), y: l.pos[1] - 0.7, z: l.pos[2] + rand(-0.4, 0.4), vy: rand(1.5, 3.5), life: 0.5, s0: 0.35, s1: 0.05, c: [1, 0.6, 0.2], a0: 0.8 }); }
    }
    this.lights = L;
    const near = L.map((l) => ({ l, d: Math.hypot(l.pos[0] - pl.x, l.pos[2] - pl.z) })).sort((a, b) => a.d - b.d).slice(0, 7).map((o) => o.l);
    // luce della fiamma in mano
    const wl = this.weapons.cur === 2 && pl.ammo.fiamma > 0 ? [0.5, 0.7, 0.3] : this.weapons.cur === 4 && pl.ammo.sigilli > 0 ? [0.4, 0.3, 0.7] : null;
    if (wl) near.push({ pos: [pl.x, pl.eyeY() - 0.4, pl.z], color: wl, range: 9, intensity: 0.8 + Math.sin(this.time * 20) * 0.1 });
    for (const a of this.angels) if (!a.dead && a.glow > 0.2) near.push({ pos: [a.x, a.y + (a.def.boss ? 9 : 0), a.z], color: [1, 0.85, 0.5], range: 12, intensity: a.glow });
    this.r.points = near.slice(0, 8);
    // post
    const p = this.r.post;
    p.time = this.time;
    const f = this.flashCol, k = this.flashT > 0 ? this.flashT / Math.max(0.01, f[3]) : 0;
    p.flash = [f[0], f[1], f[2], k * Math.min(0.75, f[3] * 2)];
    p.low = pl.alive ? (pl.hp < 30 ? (30 - pl.hp) / 30 : 0) : 1;
    p.vignette = 0.45 + (pl.alive ? 0 : 0.5);
    // nebbia: più fitta al chiuso
    const indoor = this.level.isIndoor(Math.floor(pl.x / CELL), Math.floor(pl.z / CELL));
    const env = this.r.env;
    env.fogNear = lerp(env.fogNear, indoor ? 18 : 30, dt * 2); env.fogFar = lerp(env.fogFar, indoor ? 70 : 110, dt * 2);
    this.fx.draw();
  }

  _updateHud() {
    const pl = this.player, w = this.weapons, d = w.def();
    this.ui.setHud({ hp: Math.max(0, Math.round(pl.hp)), weapon: d.name, weaponId: w.cur, owned: w.owned, ammo: d.ammo ? Math.floor(pl.ammo[d.ammo]) : null, ammoKind: d.ammo, hurt: pl.hurtT, fps: this.fps });
  }

  frame(t) {
    const dt = Math.min(0.05, this.lastT ? (t - this.lastT) / 1000 : 0.016);
    this.lastT = t;
    this.fps = lerp(this.fps, 1 / Math.max(dt, 0.001), 0.05);
    if (this.state !== 'pause') this.update(dt);
    if (this.bestOn && this.best) { this._renderBestiary(dt); return; }
    this.r.render(this.scene, this.cam, this.sky);
  }

  restart() {
    // ricostruzione completa: il modo più semplice e sicuro
    window.location.reload();
  }
}

export { ANGEL_DEFS };
