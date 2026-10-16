// =============================================================
//  engine/scene.js — grafo della scena e materiali
// =============================================================
import { mat4, mul4, compose } from './math.js';

let NEXT_ID = 1;

export class Node {
  constructor(mesh = null, material = null) {
    this.id = NEXT_ID++;
    this.position = [0, 0, 0];
    this.rotation = [0, 0, 0]; // pitch (X), yaw (Y), roll (Z) — ordine YXZ
    this.scale = [1, 1, 1];
    this.mesh = mesh;
    this.material = material;
    this.children = [];
    this.parent = null;
    this.visible = true;
    this.local = mat4();
    this.world = mat4();
    this.cullRadius = undefined; // se impostato, il sottoalbero viene scartato fuori dalla vista
    this.flash = 0;      // lampo bianco quando viene colpito (si propaga ai figli)
    this.glow = null;    // emissivo extra solo per questo nodo [r,g,b]
    this.inkId = undefined; // id per i contorni (default: id del nodo)
  }

  add(...nodes) {
    for (const n of nodes) {
      if (n.parent) n.parent.remove(n);
      n.parent = this;
      this.children.push(n);
    }
    return this;
  }

  remove(n) {
    const i = this.children.indexOf(n);
    if (i >= 0) this.children.splice(i, 1);
    n.parent = null;
  }

  setPos(x, y, z) { this.position[0] = x; this.position[1] = y; this.position[2] = z; return this; }
  setRot(x, y, z) { this.rotation[0] = x; this.rotation[1] = y; this.rotation[2] = z; return this; }
  setScale(x, y = x, z = x) { this.scale[0] = x; this.scale[1] = y; this.scale[2] = z; return this; }

  updateWorld(parentWorld = null) {
    compose(this.local, this.position, this.rotation, this.scale);
    if (parentWorld) mul4(this.world, parentWorld, this.local);
    else this.world.set(this.local);
    const ch = this.children;
    for (let i = 0; i < ch.length; i++) ch[i].updateWorld(this.world);
  }

  traverse(fn) { fn(this); for (const c of this.children) c.traverse(fn); }
}

// Materiale "toon": colore piatto a bande + contorno a inchiostro
export function toon(opts = {}) {
  return {
    color: [1, 1, 1],
    emissive: [0, 0, 0],
    map: null,        // texture colore
    emMap: null,      // texture maschera emissiva (canale rosso)
    uvScale: [1, 1],
    lit: true,        // false = colore pieno senza luci
    fog: true,
    alphaTest: 0,     // >0 per decalcomanie con trasparenza
    doubleSided: false,
    depthWrite: true,
    noInk: false,     // true = niente contorno
    ...opts,
  };
}
