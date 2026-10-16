// =============================================================
//  game/level.js — il livello "Incubo"
//
//  La mappa è una griglia di caratteri: ogni carattere è una cella
//  di 4×4 unità. Modificala qui sotto per cambiare il livello.
//
//  MURI      #  marmo        G  marmo con lesene d'oro
//            F  carne viva   R  basalto con crepe (la breccia)
//            Y  librerie
//  PAVIMENTI .  marmo (al chiuso)   :  basalto (al chiuso)
//            ,  lastre (all'aperto) ;  carne (all'aperto)
//  PORTE     D  porta     L  porta sigillata (serve il Sigillo Viola)
//            S  muro segreto (si apre con E)
//  ENTITÀ    P  partenza del giocatore
//            o  Ofano   s  Serafino   c  Cherubino   B  Esattore di Anime
//            h  anima (+10 vita)   H  grande anima (+25)
//            f  fiamma nera   b  ossa   g  sigilli   K  Sigillo Viola
//            3  arma Thanateros   4  arma Sigillo di Samael
//            C  gabbia di anime   T  braciere   I  pilastro   X  il Varco
// =============================================================
import { Geo, box, cylinder, sphere, torus, merge, place, paint } from '../engine/geometry.js';
import { Node, toon } from '../engine/scene.js';
import { clamp, hash2, hex } from '../engine/math.js';
import { CELL, WALL_H, CEIL_H, C } from './config.js';

export const MAP = [
  '########################################',
  '####################FFFFFFFFFFFFFFFFFFF#',
  '####################F;H;;;;;;X;;;;;;;;F#',
  '####################F;;;;;o;;;;;;;;;;gF#',
  '####################F;;;I;;;;;;;;;I;;;F#',
  '####################F;;;;;;;;;;;;;;;;;F#',
  '#GGGGGGGGGGGGGGGGGG#F;;;;;;;;;B;;;;;;;F#',
  '#G,,,,,,,,,,,,,,,,G#FT;;;;;;;;;;;;;;o;F#',
  '#G,C,,,o,,,,o,,,CTG#F;;;;;;;;;;;;;;;;;F#',
  '#G,,,,,,,,,,,,,,,,L..;;;;;;;;;;;;;;;;;F#',
  '#G,,,I,,I,,I,,I,,TG#F;;;I;;;;;;;;;I;;;F#',
  '#G,,,,,,,,,,,,,,,,G#FT;;;;;;;;;;;;;;;;F#',
  '#G,s,,,,,,,,,,,,,,G#F;b;;;;;;;f;;;;;;HF#',
  '#G,,,Ih,,3b,,fI,o,G#FFFFFFFFFFFFFFFFFFF#',
  '#Gh,,,,,,,,,,,,,,,G#####################',
  '#G,,,,,,,,,,,,,,,hG#####################',
  '#G,,,I,,I,,I,,I,,,G#..............######',
  '#G,,,,,,,,,,s,,,,,D......s..h....o######',
  '#G,C,,,,,,,,,,,,C,G#..............######',
  '#G,,,,,,,,,,,,,,,,G#..YY..YY..YY..######',
  '#GGGG..GGGGGGGGGGGG#..YY..YY..YY..######',
  '#####..#############T.YY..YY..YY..######',
  '#####..#############..YY..YY..YY.T#H.g##',
  '#####..#############....f.........S.4.##',
  '#####..#############.H.......s...T#..g##',
  '#####..#############..YY..YY..YY..######',
  '##RRRDDRRR##########..YY..YY..YY..######',
  '##RT::::TR##########..YY..YY..YY..######',
  '##R::::::R##########..YY..YY..YY..######',
  '##R::::::R##########.........c....######',
  '##R::P:::R##########b............K######',
  '##Rh:::::R##############################',
  '##RRRRRRRR##############################',
  '########################################',
];

// Direzione iniziale del giocatore (0 = verso nord, cioè verso l'alto della mappa)
export const START_YAW = 0;

// Zone con nome: compaiono a schermo la prima volta che ci entri
export const AREAS = [
  { name: 'LA BRECCIA', sub: 'Hai squarciato il velo del suo Cielo.', x0: 2, z0: 26, x1: 9, z1: 32 },
  { name: 'IL CHIOSTRO DELLE ANIME', sub: 'Qui il Parassita tiene in gabbia ciò che ha rubato.', x0: 2, z0: 7, x1: 17, z1: 19 },
  { name: 'LA BIBLIOTECA DEL VERBO', sub: 'Ogni libro è una legge scritta per tenerti in ginocchio.', x0: 20, z0: 16, x1: 33, z1: 30 },
  { name: 'SANCTA SANCTORUM', sub: 'Un segreto che il Cielo voleva nascondere.', x0: 35, z0: 22, x1: 37, z1: 24 },
  { name: 'IL CORO', sub: 'Qui si canta per sempre. Qui si viene mangiati.', x0: 21, z0: 2, x1: 37, z1: 12 },
];

const WALL_TYPES = { '#': 'marble', G: 'gold', F: 'flesh', R: 'breach', Y: 'books' };
const FLOOR_TYPES = { '.': 'marble', ':': 'basalt', ',': 'flag', ';': 'flesh' };
const INDOOR = { marble: true, basalt: true, flag: false, flesh: false };

export class Level {
  constructor(rows = MAP) {
    this.rows = rows;
    this.w = rows[0].length;
    this.h = rows.length;
    const N = this.w * this.h;
    this.wall = new Array(N).fill(null);
    this.floor = new Array(N).fill(null);
    this.door = new Array(N).fill(null);
    this.propBlock = new Uint8Array(N);
    this.entities = [];
    this.doors = [];
    const doorCells = [];
    for (let z = 0; z < this.h; z++) {
      for (let x = 0; x < this.w; x++) {
        const ch = rows[z][x], i = z * this.w + x;
        if (WALL_TYPES[ch]) this.wall[i] = WALL_TYPES[ch];
        else if (FLOOR_TYPES[ch]) this.floor[i] = FLOOR_TYPES[ch];
        else if ('DLS'.includes(ch)) doorCells.push({ x, z, ch });
        else this.entities.push({ ch, x, z });
      }
    }
    for (let z = 0; z < this.h; z++) for (let x = 0; x < this.w; x++) {
      const i = z * this.w + x;
      if (!this.wall[i] && !this.floor[i]) this.floor[i] = this._inferFloor(x, z);
    }
    // raggruppa le celle-porta adiacenti dello stesso tipo
    const used = new Set();
    for (const dc of doorCells) {
      const key = dc.x + ',' + dc.z;
      if (used.has(key)) continue;
      const cells = [dc]; used.add(key);
      for (let k = 0; k < cells.length; k++) {
        const c = cells[k];
        for (const o of doorCells) {
          const ok = o.x + ',' + o.z;
          if (!used.has(ok) && o.ch === c.ch && Math.abs(o.x - c.x) + Math.abs(o.z - c.z) === 1) { used.add(ok); cells.push(o); }
        }
      }
      const door = { type: dc.ch, cells, open: 0, opening: false, panels: [], node: null };
      for (const c of cells) this.door[c.z * this.w + c.x] = door;
      this.doors.push(door);
    }
  }

  _inferFloor(x, z) {
    for (let r = 1; r < 5; r++) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx, nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= this.w || nz >= this.h) continue;
        const ch = this.rows[nz][nx];
        if (FLOOR_TYPES[ch]) return FLOOR_TYPES[ch];
      }
    }
    return 'marble';
  }

  idx(x, z) { return z * this.w + x; }
  inside(x, z) { return x >= 0 && z >= 0 && x < this.w && z < this.h; }
  wallAt(x, z) { return this.inside(x, z) ? this.wall[z * this.w + x] : 'marble'; }
  doorAt(x, z) { return this.inside(x, z) ? this.door[z * this.w + x] : null; }
  floorAt(x, z) { return this.inside(x, z) ? this.floor[z * this.w + x] : null; }
  isIndoor(x, z) {
    if (!this.inside(x, z) || this.wall[this.idx(x, z)]) return false;
    if (this.door[this.idx(x, z)]) return true;
    return INDOOR[this.floor[this.idx(x, z)]];
  }

  // blocca il movimento? (muri e porte chiuse)
  blocksMove(x, z) {
    if (!this.inside(x, z)) return true;
    const i = z * this.w + x;
    if (this.wall[i]) return true;
    const d = this.door[i];
    return !!(d && d.open < 0.9);
  }

  // blocca la vista e i proiettili?
  blocksSight(x, z) {
    if (!this.inside(x, z)) return true;
    const i = z * this.w + x;
    if (this.wall[i]) return true;
    const d = this.door[i];
    return !!(d && d.open < 0.6);
  }

  // per i mostri: anche i pilastri/bracieri/gabbie occupano la cella
  blocksMonster(x, z) { return this.blocksMove(x, z) || (this.inside(x, z) && this.propBlock[z * this.w + x] === 1); }

  // Raggio 2D (DDA): distanza dal primo muro lungo la direzione (dx,dz) normalizzata
  raycast(x0, z0, dx, dz, maxDist) {
    let cx = Math.floor(x0 / CELL), cz = Math.floor(z0 / CELL);
    const stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    const tdx = dx !== 0 ? Math.abs(CELL / dx) : Infinity;
    const tdz = dz !== 0 ? Math.abs(CELL / dz) : Infinity;
    let tmx = dx !== 0 ? (dx > 0 ? (cx + 1) * CELL - x0 : x0 - cx * CELL) / Math.abs(dx) : Infinity;
    let tmz = dz !== 0 ? (dz > 0 ? (cz + 1) * CELL - z0 : z0 - cz * CELL) / Math.abs(dz) : Infinity;
    for (let i = 0; i < 160; i++) {
      let t, side;
      if (tmx < tmz) { t = tmx; tmx += tdx; cx += stepX; side = 0; }
      else { t = tmz; tmz += tdz; cz += stepZ; side = 1; }
      if (t > maxDist) return { dist: maxDist, hit: false };
      if (this.blocksSight(cx, cz)) return { dist: t, hit: true, cx, cz, nx: side === 0 ? -stepX : 0, nz: side === 1 ? -stepZ : 0 };
    }
    return { dist: maxDist, hit: false };
  }

  lineOfSight(x0, z0, x1, z1) {
    const dx = x1 - x0, dz = z1 - z0, d = Math.hypot(dx, dz);
    if (d < 0.01) return true;
    return !this.raycast(x0, z0, dx / d, dz / d, d).hit;
  }

  // Spinge un cerchio fuori dai muri. Ritorna [x, z]
  collide(x, z, r, out = [0, 0]) {
    for (let it = 0; it < 2; it++) {
      const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
      for (let j = cz - 1; j <= cz + 1; j++) for (let i = cx - 1; i <= cx + 1; i++) {
        if (!this.blocksMove(i, j)) continue;
        const x0 = i * CELL, x1 = x0 + CELL, z0 = j * CELL, z1 = z0 + CELL;
        const px = clamp(x, x0, x1), pz = clamp(z, z0, z1);
        const dx = x - px, dz = z - pz, d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-9) {
          const d = Math.sqrt(d2), push = r - d;
          x += (dx / d) * push; z += (dz / d) * push;
        } else {
          const l = x - x0, rr = x1 - x, t = z - z0, b = z1 - z, m = Math.min(l, rr, t, b);
          if (m === l) x = x0 - r; else if (m === rr) x = x1 + r; else if (m === t) z = z0 - r; else z = z1 + r;
        }
      }
    }
    out[0] = x; out[1] = z;
    return out;
  }

  areaAt(cx, cz) {
    for (const a of AREAS) if (cx >= a.x0 && cx <= a.x1 && cz >= a.z0 && cz <= a.z1) return a;
    return null;
  }

  // ---------------------------------------------------------
  //  Costruzione della geometria
  // ---------------------------------------------------------
  build(r, tex) {
    const M = this.materials = {
      marble: toon({ map: tex.marble }),
      gold: toon({ map: tex.gold }),
      flesh: toon({ map: tex.flesh, emMap: tex.fleshEm, emissive: [0.3, 0.04, 0.12] }),
      breach: toon({ map: tex.breach, emMap: tex.breachEm, emissive: [0.5, 0.8, 0.32] }),
      books: toon({ map: tex.books }),
      f_marble: toon({ map: tex.floorMarble }),
      f_basalt: toon({ map: tex.floorBasalt, emMap: tex.floorBasaltEm, emissive: [0.45, 0.75, 0.3] }),
      f_flag: toon({ map: tex.floorFlag }),
      f_flesh: toon({ map: tex.floorFlesh, emMap: tex.floorFleshEm, emissive: [0.25, 0.03, 0.09] }),
      ceiling: toon({ map: tex.ceiling }),
      trim: toon({ color: hex('#d4a03c') }),
      emblem: toon({ map: tex.emblem, alphaTest: 0.5 }),
      door: toon({ map: tex.door }),
      doorLocked: toon({ map: tex.doorLocked, emMap: tex.doorLockedEm, emissive: [0.5, 0.35, 1.0] }),
      secret: toon({ map: tex.secret, emMap: tex.secretEm, emissive: [0.18, 0.3, 0.1], uvScale: [1, 3] }),
      eye: toon({}),
    };
    const G = {}; // geometrie per materiale
    const geo = (k) => (G[k] ||= new Geo());
    const root = new Node();
    const W = this.w, H = this.h;
    const isWall = (x, z) => !this.inside(x, z) || !!this.wall[this.idx(x, z)];
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    // faccia verticale sul lato "dir" della cella (x,z), da y0 a y1
    const face = (g, x, z, dir, y0, y1, off = 0) => {
      const X0 = x * CELL, X1 = X0 + CELL, Z0 = z * CELL, Z1 = Z0 + CELL;
      let n, cs;
      if (dir === 0) { n = [1, 0, 0]; cs = [[X1 + off, Z0], [X1 + off, Z1]]; }
      else if (dir === 1) { n = [-1, 0, 0]; cs = [[X0 - off, Z1], [X0 - off, Z0]]; }
      else if (dir === 2) { n = [0, 0, 1]; cs = [[X1, Z1 + off], [X0, Z1 + off]]; }
      else { n = [0, 0, -1]; cs = [[X0, Z0 - off], [X1, Z0 - off]]; }
      const U = (px, pz) => (dir === 0 ? -pz : dir === 1 ? pz : dir === 2 ? px : -px) / CELL;
      const a = g.vert(cs[0][0], y0, cs[0][1], n[0], n[1], n[2], U(cs[0][0], cs[0][1]), y0 / CELL);
      const b = g.vert(cs[1][0], y0, cs[1][1], n[0], n[1], n[2], U(cs[1][0], cs[1][1]), y0 / CELL);
      const c = g.vert(cs[1][0], y1, cs[1][1], n[0], n[1], n[2], U(cs[1][0], cs[1][1]), y1 / CELL);
      const d = g.vert(cs[0][0], y1, cs[0][1], n[0], n[1], n[2], U(cs[0][0], cs[0][1]), y1 / CELL);
      g.quad(a, b, c, d);
    };
    const hquad = (g, x, z, y, up) => {
      const X0 = x * CELL, X1 = X0 + CELL, Z0 = z * CELL, Z1 = Z0 + CELL, ny = up ? 1 : -1;
      const a = g.vert(X0, y, Z0, 0, ny, 0, X0 / CELL, Z0 / CELL), b = g.vert(X1, y, Z0, 0, ny, 0, X1 / CELL, Z0 / CELL);
      const c = g.vert(X1, y, Z1, 0, ny, 0, X1 / CELL, Z1 / CELL), d = g.vert(X0, y, Z1, 0, ny, 0, X0 / CELL, Z1 / CELL);
      g.quad(a, b, c, d);
    };
    const faceCenter = (x, z, dir) => {
      const cx = (x + 0.5) * CELL, cz = (z + 0.5) * CELL, h = CELL / 2;
      return dir === 0 ? [cx + h, cz] : dir === 1 ? [cx - h, cz] : dir === 2 ? [cx, cz + h] : [cx, cz - h];
    };
    const trims = [];
    const decals = [];
    this.wallEyes = [];

    for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
      const i = this.idx(x, z), wt = this.wall[i];
      if (wt) {
        for (let dir = 0; dir < 4; dir++) {
          const nx = x + DIRS[dir][0], nz = z + DIRS[dir][1];
          if (isWall(nx, nz)) continue;
          const indoor = this.isIndoor(nx, nz);
          const top = indoor ? CEIL_H : WALL_H;
          face(geo(wt), x, z, dir, 0, top);
          const [fx, fz] = faceCenter(x, z, dir);
          const n = DIRS[dir];
          const along = dir < 2 ? [0, 0, 1] : [1, 0, 0];
          const rotY = dir < 2 ? Math.PI / 2 : 0;
          // modanature dorate: zoccolo, cornice
          if (wt === 'marble' || wt === 'gold' || wt === 'books') {
            trims.push(place(box(CELL, 0.45, 0.2), [fx + n[0] * 0.1, 0.225, fz + n[1] * 0.1], [0, rotY, 0]));
            if (indoor) trims.push(place(box(CELL, 0.35, 0.22), [fx + n[0] * 0.11, CEIL_H - 0.175, fz + n[1] * 0.11], [0, rotY, 0]));
            else trims.push(place(box(CELL, 0.6, 0.32), [fx + n[0] * 0.16, WALL_H - 0.3, fz + n[1] * 0.16], [0, rotY, 0]));
          }
          void along;
          // emblemi: l'Occhio nel triangolo
          const hsh = hash2(x * 7 + dir, z * 13 + dir * 3);
          if (wt === 'gold' && !indoor && hsh < 0.42) {
            decals.push(place(planeQuad(3.2, 3.2), [fx + n[0] * 0.05, 7.6, fz + n[1] * 0.05], [0, Math.atan2(n[0], n[1]), 0]));
          } else if (wt === 'marble' && indoor && hsh < 0.16) {
            decals.push(place(planeQuad(1.8, 1.8), [fx + n[0] * 0.05, 3.6, fz + n[1] * 0.05], [0, Math.atan2(n[0], n[1]), 0]));
          }
          // occhi incastonati nella carne
          if (wt === 'flesh' && hsh < 0.3) {
            const ey = 2.6 + hash2(x * 3 + 1, z * 5 + dir) * 6.5;
            this.wallEyes.push({ x: fx + n[0] * 0.05, y: ey, z: fz + n[1] * 0.05, nx: n[0], nz: n[1], s: 0.55 + hsh * 1.4 });
          }
        }
      } else {
        const ft = this.floor[i];
        hquad(geo('f_' + ft), x, z, 0, true);
        const d = this.door[i];
        if (this.isIndoor(x, z) && !(d && d.type !== 'S')) hquad(geo('ceiling'), x, z, CEIL_H, false);
        // traverse sopra i passaggi tra interno ed esterno (le porte hanno già l'architrave)
        if (this.isIndoor(x, z) && !d) {
          for (let dir = 0; dir < 4; dir++) {
            const nx = x + DIRS[dir][0], nz = z + DIRS[dir][1];
            if (isWall(nx, nz) || this.isIndoor(nx, nz)) continue;
            const wt2 = this.floorAt(nx, nz) === 'flesh' ? 'flesh' : 'gold';
            face(geo(wt2), x, z, dir, CEIL_H, WALL_H);
          }
        }
      }
    }

    // architravi sopra le porte
    for (const door of this.doors) {
      if (door.type === 'S') continue;
      for (const c of door.cells) {
        const flank = this._flankWall(c.x, c.z);
        for (let dir = 0; dir < 4; dir++) {
          const nx = c.x + DIRS[dir][0], nz = c.z + DIRS[dir][1];
          if (isWall(nx, nz) || this.door[this.idx(nx, nz)] === door) continue;
          face(geo(flank), c.x, c.z, dir, CEIL_H, WALL_H);
        }
        hquad(geo(flank), c.x, c.z, CEIL_H, false);
      }
    }

    for (const k in G) {
      const n = new Node(r.mesh(G[k]), M[k]);
      root.add(n);
    }
    if (trims.length) root.add(new Node(r.mesh(merge(trims)), M.trim));
    if (decals.length) root.add(new Node(r.mesh(merge(decals)), M.emblem));

    // ---- porte ----
    for (const door of this.doors) {
      door.node = new Node();
      for (const c of door.cells) {
        const cx = (c.x + 0.5) * CELL, cz = (c.z + 0.5) * CELL;
        let panel;
        if (door.type === 'S') {
          const flank = this._flankWall(c.x, c.z);
          const mat = flank === 'marble' ? M.secret : M[flank];
          panel = new Node(r.mesh(box(CELL, WALL_H, CELL)), mat);
          panel.base = [cx, WALL_H / 2, cz];
        } else {
          const axisX = isWall(c.x - 1, c.z) || isWall(c.x + 1, c.z) || this.door[this.idx(c.x - 1, c.z)] === door || this.door[this.idx(c.x + 1, c.z)] === door;
          const g = axisX ? box(CELL, CEIL_H, 0.5) : box(0.5, CEIL_H, CELL);
          panel = new Node(r.mesh(g), door.type === 'L' ? M.doorLocked : M.door);
          panel.base = [cx, CEIL_H / 2, cz];
        }
        panel.setPos(...panel.base);
        door.panels.push(panel);
        door.node.add(panel);
      }
      root.add(door.node);
    }

    // ---- occhi nei muri di carne ----
    const eyeMesh = r.mesh(eyeGeo(1));
    const lidMesh = r.mesh(paint(place(torus(1.02, 0.22, 8, 24), [0, 0, 0.05]), C.flesh));
    for (const e of this.wallEyes) {
      const holder = new Node();
      holder.setPos(e.x, e.y, e.z);
      holder.setRot(0, Math.atan2(e.nx, e.nz), 0);
      holder.setScale(e.s);
      const ball = new Node(eyeMesh, M.eye);
      ball.position[2] = -0.35;
      const lid = new Node(lidMesh, toon({ color: C.flesh }));
      lid.position[2] = 0.15;
      holder.add(ball, lid);
      holder.cullRadius = 2 * e.s;
      e.node = holder; e.ball = ball;
      root.add(holder);
    }

    this.root = root;
    return root;
  }

  _flankWall(x, z) {
    const counts = {};
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const w = this.wallAt(x + dx, z + dz);
      if (w) counts[w] = (counts[w] || 0) + 1;
    }
    let best = 'marble', bc = 0;
    for (const k in counts) if (counts[k] > bc) { best = k; bc = counts[k]; }
    return best;
  }

  // Aggiorna l'apertura delle porte
  update(dt) {
    for (const d of this.doors) {
      if (!d.opening || d.open >= 1) continue;
      d.open = Math.min(1, d.open + dt / (d.type === 'S' ? 1.6 : 0.7));
      for (const p of d.panels) {
        if (d.type === 'S') p.position[1] = p.base[1] - d.open * (WALL_H + 0.2);
        else p.position[1] = p.base[1] + d.open * (CEIL_H - 0.15);
      }
    }
  }
}

function planeQuad(w, h) {
  const g = new Geo(), x = w / 2, y = h / 2;
  const a = g.vert(-x, -y, 0, 0, 0, 1, 0, 0), b = g.vert(x, -y, 0, 0, 0, 1, 1, 0);
  const c = g.vert(x, y, 0, 0, 0, 1, 1, 1), d = g.vert(-x, y, 0, 0, 0, 1, 0, 1);
  g.quad(a, b, c, d);
  return g;
}

// Occhio: sclera + iride + pupilla, guarda verso +Z
export function eyeGeo(r, iris = C.iris, pupil = C.pupil, sclera = C.eye) {
  return merge(
    paint(sphere(r, 16, 12), sclera),
    place(sphere(r * 0.55, 14, 8), [0, 0, r * 0.8], [0, 0, 0], [1, 1, 0.35], iris),
    place(sphere(r * 0.26, 10, 6), [0, 0, r * 0.95], [0, 0, 0], [1, 1, 0.3], pupil),
  );
}
