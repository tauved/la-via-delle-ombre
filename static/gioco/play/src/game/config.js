// =============================================================
//  game/config.js — costanti e regolazioni del gioco
//  Cambia qui i numeri per bilanciare il livello.
// =============================================================
import { hex } from '../engine/math.js';

export const CELL = 4;        // lato di una cella della mappa (unità del mondo)
export const WALL_H = 12;     // altezza dei muri
export const CEIL_H = 6;      // altezza dei soffitti al chiuso
export const EYE_H = 3.2;     // altezza degli occhi del giocatore
export const PLAYER_R = 1.1;  // raggio di collisione del giocatore

export const FOV = 70 * Math.PI / 180; // campo visivo verticale

export const PLAYER = {
  hp: 100,
  maxHp: 100,
  overHp: 150,     // le anime grandi possono portare la vita oltre il 100
  speed: 13,
  runSpeed: 19,
  accel: 11,
};

// Palette TAUH
export const C = {
  ink: hex('#140b1c'),
  violet: hex('#674CC0'),
  lime: hex('#CFFE7E'),
  gold: hex('#d9a640'),
  goldLight: hex('#f1cd6a'),
  ivory: hex('#f1e8d6'),
  bone: hex('#e9dfc8'),
  white: [1, 1, 1],
  eye: hex('#fbf7ee'),
  iris: hex('#58c8f0'),
  pupil: hex('#140b1c'),
  flesh: hex('#7a2646'),
  mouth: hex('#5a0f22'),
  skin: hex('#3a1f4c'),
  holy: hex('#fff3c4'),
};

export const WEAPON_DEFS = {
  1: { id: 'artigli', name: 'ARTIGLI', ammo: null, rate: 0.42, dmg: [26, 38], range: 4.2 },
  2: { id: 'fiamma', name: 'FIAMMA NERA', ammo: 'fiamma', rate: 0.16, dmg: [13, 18], speed: 72 },
  3: { id: 'thanateros', name: 'THANATEROS', ammo: 'ossa', rate: 0.95, dmg: [9, 13], pellets: 9, spread: 0.13 },
  4: { id: 'sigillo', name: 'SIGILLO DI SAMAEL', ammo: 'sigilli', rate: 0.95, dmg: [110, 140], speed: 38, splash: 7.5, splashDmg: 95 },
};

export const AMMO = {
  fiamma: { start: 70, max: 220, regenTo: 40, regenRate: 3 },
  ossa: { start: 0, max: 60 },
  sigilli: { start: 0, max: 24 },
};
