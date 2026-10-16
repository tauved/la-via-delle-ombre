// =============================================================
//  game/player.js — il demone: movimento, vita, mira
// =============================================================
import { clamp, TAU } from '../engine/math.js';
import { Node } from '../engine/scene.js';
import { PLAYER, PLAYER_R, EYE_H, AMMO } from './config.js';

export class Player {
  constructor(game, x, z, yaw) {
    this.g = game;
    this.x = x; this.z = z; this.yaw = yaw; this.pitch = 0;
    this.vx = 0; this.vz = 0;
    this.hp = PLAYER.hp; this.alive = true;
    this.ammo = { fiamma: AMMO.fiamma.start, ossa: AMMO.ossa.start, sigilli: AMMO.sigilli.start };
    this.hasKey = false;
    this.running = false;
    this.moving = false;
    this.hurtT = 0; this.deathT = 0;
    this.bobT = 0; this.bobY = 0;
    this.camNode = new Node();
    this.kills = 0; this.secrets = 0; this.souls = 0;
    this.lastGround = 0;
  }

  eyeY() { return EYE_H + this.bobY + (this.alive ? 0 : -Math.min(2.2, this.deathT * 1.6)); }

  aimDir() {
    const cp = Math.cos(this.pitch);
    return [Math.sin(this.yaw) * cp * -1, Math.sin(this.pitch), -Math.cos(this.yaw) * cp];
  }

  look(dx, dy) {
    if (!this.alive) return;
    this.yaw -= dx;
    this.pitch = clamp(this.pitch - dy, -1.35, 1.35);
    this.yaw = ((this.yaw % TAU) + TAU) % TAU;
  }

  update(dt, input) {
    const g = this.g;
    this.hurtT = Math.max(0, this.hurtT - dt);
    if (!this.alive) {
      this.deathT += dt;
      this.vx *= 0.9; this.vz *= 0.9;
      this.pitch += (-0.5 - this.pitch) * Math.min(1, dt * 2);
      this._updateCamera();
      return;
    }
    let fx = 0, fz = 0;
    if (input.fwd) fz -= 1; if (input.back) fz += 1;
    if (input.left) fx -= 1; if (input.right) fx += 1;
    fx += input.ax || 0; fz += input.az || 0;   // levetta analogica (touch)
    const l = Math.hypot(fx, fz);
    this.moving = l > 0.05;
    this.running = !!input.run;
    if (l > 1) { fx /= l; fz /= l; }
    // avanti = (-sin yaw, -cos yaw), destra = (cos yaw, -sin yaw)
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const mx = fz * sy + fx * cy;
    const mz = fz * cy - fx * sy;
    const speed = this.running ? PLAYER.runSpeed : PLAYER.speed;
    const a = 1 - Math.exp(-dt * PLAYER.accel);
    this.vx += (mx * speed - this.vx) * a;
    this.vz += (mz * speed - this.vz) * a;
    let nx = this.x + this.vx * dt, nz = this.z + this.vz * dt;
    const res = g.level.collide(nx, nz, PLAYER_R);
    nx = res[0]; nz = res[1];
    const pr = g.collideProps(nx, nz, PLAYER_R);
    this.x = pr[0]; this.z = pr[1];
    if (this.moving) { this.bobT += dt * (this.running ? 11 : 8); }
    const sp = Math.hypot(this.vx, this.vz) / PLAYER.runSpeed;
    this.bobY = Math.sin(this.bobT) * 0.09 * sp;
    // rigenerazione della fiamma nera
    const F = AMMO.fiamma;
    if (this.ammo.fiamma < F.regenTo) this.ammo.fiamma = Math.min(F.regenTo, this.ammo.fiamma + F.regenRate * dt);
    this._updateCamera();
  }

  _updateCamera() {
    const c = this.camNode, g = this.g;
    const sh = g.shakeAmt;
    const roll = this.alive ? Math.sin(this.bobT) * 0.012 * (this.moving ? 1 : 0) : Math.min(0.6, this.deathT * 0.5);
    c.setPos(this.x + (Math.random() - 0.5) * sh * 0.3, this.eyeY() + (Math.random() - 0.5) * sh * 0.3, this.z + (Math.random() - 0.5) * sh * 0.3);
    c.setRot(this.pitch + (Math.random() - 0.5) * sh * 0.05, this.yaw, roll + (Math.random() - 0.5) * sh * 0.05);
  }

  hurt(dmg, fromX, fromZ) {
    if (!this.alive) return;
    this.hp -= dmg;
    this.hurtT = 0.5;
    this.g.audio.playerHurt();
    this.g.flash([0.7, 0.05, 0.15], 0.35);
    this.g.shake(0.5);
    if (fromX !== undefined) {
      const dx = this.x - fromX, dz = this.z - fromZ, d = Math.hypot(dx, dz) || 1;
      this.vx += (dx / d) * 5; this.vz += (dz / d) * 5;
    }
    if (this.hp <= 0) { this.hp = 0; this.die(); }
  }

  die() {
    this.alive = false; this.deathT = 0;
    this.g.audio.playerDeath();
    this.g.onPlayerDeath();
  }

  heal(n) {
    const max = this.g.overHeal ? PLAYER.overHp : PLAYER.maxHp;
    this.hp = Math.min(max, this.hp + n);
  }
}
