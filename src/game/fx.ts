import { fxType, FX_FLOATS } from '../gfx/passes/fx.js';
import type { Game } from './game';
import type { AnyEntity, Element, Rarity, Vec3 } from './types';
import { DANGER_PENCILS, RARITY_COLORS } from '../settings/settings';

const MAX = 900;
const C = (r: number, g: number, b: number): Vec3 => [r / 255, g / 255, b / 255];
export const FX_COLORS = {
  GOLD: C(244, 190, 62), WHITE: C(232, 226, 212), DUST: C(226, 188, 130), SKY: C(136, 180, 216),
  LEAFY: C(116, 168, 90), RED: C(214, 70, 52), FLAME: C(240, 158, 74), MUSTARD: C(226, 176, 52),
  FROST: C(150, 196, 226), INK: C(74, 77, 94), VIOLET: C(150, 120, 190), POISON: C(132, 170, 80),
};
const { GOLD, WHITE, DUST, SKY, LEAFY, RED, FLAME, FROST, INK, POISON } = FX_COLORS;
export const CYBER = { CYAN: C(92, 226, 255), MAGENTA: C(236, 96, 214), VOID: C(150, 104, 255), WHITE: C(244, 250, 255) };
const { CYAN, MAGENTA, VOID } = CYBER;

const AURA: Partial<Record<string, Vec3>> = {
  rally: GOLD, laststand: RED, bloodrage: RED, haste: WHITE, hawkeye: SKY, unstoppable: GOLD,
  thorns: DUST, overflow: SKY, ambush: INK, poised: WHITE, mending: LEAFY,
};

export const ELEMENT_COLOR: Record<Element, Vec3> = {
  physical: WHITE, fire: FLAME, frost: FROST, storm: GOLD, poison: POISON, shadow: INK,
};

export type FxType = 'mote' | 'leaf' | 'spark' | 'burst' | 'slash' | 'ring' | 'orb' | 'puff' | 'heal' | 'mark' | 'click' | 'beam' | 'zone' | 'lane' | 'cloud' | 'ripple' | 'streak'
  | 'laser' | 'arc' | 'sigil' | 'vortex' | 'hex' | 'bit' | 'shock';

export interface FxOpts {
  size?: number; life?: number; color?: Vec3; alpha?: number;
  vx?: number; vy?: number; vz?: number; grow?: number; gravity?: number; drag?: number;
  rot?: number; spin?: number; ground?: boolean; aspect?: number; follow?: AnyEntity | null; dy?: number;
  hold?: boolean; sway?: number; axial?: boolean; tilt?: number;
}

export interface Particle {
  type: number; x: number; y: number; z: number; vx: number; vy: number; vz: number;
  size: number; grow: number; life: number; max: number; color: Vec3; alpha: number;
  gravity: number; drag: number; rot: number; spin: number; ground: number; aspect: number;
  follow: AnyEntity | null; dy: number; hold: boolean; seed: number; sway: number; tilt: number;
}

const hexPencil = (h: string): Vec3 => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];

export class Fx {
  readonly data = new Float32Array(MAX * FX_FLOATS);
  count = 0;
  private pool: Particle[] = [];
  private live: Particle[] = [];
  readonly lights: { x: number; y: number; z: number; r: number; life: number; max: number }[] = [];
  private ambientTimer = 0;
  private auraTimer = 0;
  private barrierMark: Particle | null = null;
  private readonly T: Record<FxType, number>;
  private readonly game: Game;

  constructor(game: Game) {
    this.game = game;
    const ids: FxType[] = ['mote', 'leaf', 'spark', 'burst', 'slash', 'ring', 'orb', 'puff', 'heal', 'mark', 'click', 'beam', 'zone', 'lane', 'cloud', 'ripple', 'streak', 'laser', 'arc', 'sigil', 'vortex', 'hex', 'bit', 'shock'];
    this.T = Object.fromEntries(ids.map((id) => [id, fxType(id)])) as Record<FxType, number>;
    this.wire();
  }

  get danger(): Vec3 { return DANGER_PENCILS[this.game.settings.dangerColor]; }
  rarityPencil(r: Rarity): Vec3 { return hexPencil(RARITY_COLORS[this.game.settings.colorVision][r]); }

  spawn(type: FxType, x: number, y: number, z: number, o: FxOpts = {}): Particle | null {
    if (this.live.length >= MAX) return null;
    const p = this.pool.pop() ?? ({} as Particle);
    p.type = this.T[type]; p.x = x; p.y = y; p.z = z;
    p.vx = o.vx ?? 0; p.vy = o.vy ?? 0; p.vz = o.vz ?? 0;
    p.size = o.size ?? 0.3; p.grow = o.grow ?? 0;
    p.life = 0; p.max = o.life ?? 0.5;
    p.color = o.color ?? WHITE; p.alpha = o.alpha ?? 1;
    p.gravity = o.gravity ?? 0; p.drag = o.drag ?? 0;
    p.rot = o.rot ?? 0; p.spin = o.spin ?? 0;
    p.ground = o.axial ? 2 : o.ground ? 1 : 0; p.aspect = o.aspect ?? 1; p.tilt = o.tilt ?? 0;
    p.follow = o.follow ?? null; p.dy = o.dy ?? 0; p.hold = o.hold ?? false;
    p.seed = Math.random(); p.sway = o.sway ?? 0;
    this.live.push(p);
    return p;
  }

  release(p: Particle | null | undefined): void {
    if (p) { p.hold = false; p.life = Math.max(p.life, 0.6); }
  }

  light(x: number, y: number, z: number, r: number, life = 0.25): void {
    this.lights.push({ x, y, z, r, life, max: life });
  }

  update(dt: number): void {
    const live = this.live;
    let w = 0;
    for (let i = 0; i < live.length; i++) {
      const p = live[i];
      if (!p.hold) p.life += dt / p.max;
      if (p.life >= 1 || (p.follow && p.follow.gone)) { this.pool.push(p); continue; }
      if (p.follow) { p.x = p.follow.x; p.y = p.follow.y + p.dy; p.z = p.follow.z; }
      else {
        p.vy -= p.gravity * dt;
        if (p.drag) { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; p.vz *= k; }
        p.x += (p.vx + Math.sin(p.life * 9 + p.seed * 30) * p.sway) * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      }
      p.size += p.grow * dt; p.rot += p.spin * dt;
      live[w++] = p;
    }
    live.length = w;
    let lw = 0;
    for (const l of this.lights) { l.life -= dt; if (l.life > 0) this.lights[lw++] = l; }
    this.lights.length = lw;
    this.ambient(dt);
    this.hero(dt);
  }

  private hero(dt: number): void {
    const g = this.game, p = g.player;
    if (!p) return;
    if (p.barrier > 0 && !p.dead) {
      if (!this.barrierMark) this.barrierMark = this.spawn('mark', p.x, p.y + 0.1, p.z, { size: 1.45, color: SKY, ground: true, hold: true, follow: p, dy: 0.1, alpha: 1.2 });
    } else if (this.barrierMark) { this.release(this.barrierMark); this.barrierMark = null; }
    if ((this.auraTimer -= dt) <= 0 && !p.dead) {
      this.auraTimer = 0.75;
      const buff = p.statuses.find((s) => AURA[s.id]);
      if (buff) this.spawn('ring', p.x, p.y + 0.08, p.z, { size: 1.35, life: 0.6, color: AURA[buff.id]!, ground: true, alpha: 0.9 });
    }
    if (!p.dead && p.statuses.some((s) => s.id === 'brand') && Math.random() < dt * 16) {
      const [fx, fz] = [-Math.sin(p.yaw), Math.cos(p.yaw)];
      this.spawn('spark', p.x + fx * 0.35 + fz * 0.25, p.y + 0.9 + Math.random() * 0.5, p.z + fz * 0.35 - fx * 0.25, { size: 0.15, life: 0.45, color: FLAME, vy: 1.4, drag: 1 });
    }
    if (p.dash) {
      const rot = g.skills.heading(p.x - p.dash.x, p.y + 0.9, p.z - p.dash.z, p.x, p.y + 0.9, p.z);
      this.spawn('streak', p.x - p.dash.x * 0.5, p.y + 0.75, p.z - p.dash.z * 0.5, { size: 0.75, life: 0.16, color: WHITE, alpha: 0.85, rot });
      this.spawn('streak', p.x - p.dash.x * 0.6, p.y + 0.35, p.z - p.dash.z * 0.6, { size: 0.55, life: 0.14, color: WHITE, alpha: 0.7, rot });
    }
  }

  clear(): void {
    for (const p of this.live) this.pool.push(p);
    this.live.length = 0;
    this.lights.length = 0;
    this.barrierMark = null;
  }

  write(): void {
    const d = this.data, live = this.live;
    for (let i = 0; i < live.length; i++) {
      const p = live[i], o = i * FX_FLOATS;
      d[o] = p.x; d[o + 1] = p.y; d[o + 2] = p.z; d[o + 3] = p.size;
      d[o + 4] = p.type; d[o + 5] = p.life; d[o + 6] = p.seed; d[o + 7] = p.rot;
      d[o + 8] = p.color[0]; d[o + 9] = p.color[1]; d[o + 10] = p.color[2]; d[o + 11] = p.alpha;
      d[o + 12] = p.ground; d[o + 13] = p.aspect; d[o + 14] = p.hold ? 0 : p.max; d[o + 15] = p.tilt;
    }
    this.count = live.length;
  }

  hit(x: number, y: number, z: number, color: Vec3 = WHITE, big = false): void {
    this.spawn('burst', x, y, z, { size: big ? 1.1 : 0.7, life: 0.22, color, rot: Math.random() * 6 });
    const n = big ? 9 : 5;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, s = 2.5 + Math.random() * 3.5;
      this.spawn('spark', x, y, z, { size: 0.16 + Math.random() * 0.14, life: 0.25 + Math.random() * 0.2, color, vx: Math.cos(a) * s, vy: 1 + Math.random() * 3, vz: Math.sin(a) * s, gravity: 9, drag: 2, rot: a });
    }
    this.light(x, y, z, big ? 5 : 3.5, 0.14);
  }
  slash(e: AnyEntity, radius: number, color: Vec3 = WHITE): void {
    this.spawn('slash', e.x, e.y + 0.8 * e.scale, e.z, { size: radius, life: 0.3, color, ground: true, rot: -e.yaw });
  }
  dust(x: number, y: number, z: number, n = 2, color: Vec3 = DUST): void {
    for (let i = 0; i < n; i++) {
      this.spawn('puff', x + (Math.random() - 0.5) * 0.3, y + 0.1, z + (Math.random() - 0.5) * 0.3, {
        size: 0.14 + Math.random() * 0.1, grow: 0.5, life: 0.45, color, alpha: 0.55,
        vx: (Math.random() - 0.5) * 0.6, vy: 0.5 + Math.random() * 0.4, vz: (Math.random() - 0.5) * 0.6, drag: 2,
      });
    }
  }
  poof(e: AnyEntity, color: Vec3 = WHITE): void {
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * 6.283, s = 1 + Math.random() * 1.6;
      this.spawn('puff', e.x, e.y + e.height * 0.4, e.z, { size: 0.3 + Math.random() * 0.25, grow: 0.8, life: 0.55, color, alpha: 0.85, vx: Math.cos(a) * s, vy: 0.6 + Math.random() * 1.6, vz: Math.sin(a) * s, drag: 2.5 });
    }
    this.spawn('ring', e.x, e.y + 0.08, e.z, { size: 1.5, life: 0.4, color, ground: true });
  }
  levelUp(e: AnyEntity): void {
    this.spawn('beam', e.x, e.y + 2.4, e.z, { size: 0.42, aspect: 5.5, life: 1.0, color: GOLD, alpha: 1.3, follow: e, dy: 2.4 });
    for (let k = 0; k < 3; k++) setTimeout(() => this.spawn('ring', e.x, e.y + 0.08, e.z, { size: 2.6, life: 0.7, color: GOLD, ground: true }), k * 160);
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * 6.283, r = 0.3 + Math.random() * 0.8;
      this.spawn('spark', e.x + Math.cos(a) * r, e.y + Math.random() * 0.5, e.z + Math.sin(a) * r, { size: 0.2, life: 0.8 + Math.random() * 0.7, color: GOLD, vy: 1.5 + Math.random() * 2.5, drag: 0.6 });
    }
    this.light(e.x, e.y + 1.5, e.z, 9, 0.9);
  }
  heal(e: AnyEntity, color: Vec3 = LEAFY): void {
    for (let i = 0; i < 7; i++) {
      this.spawn('heal', e.x + (Math.random() - 0.5) * 0.9, e.y + 0.3 + Math.random() * 0.8, e.z + (Math.random() - 0.5) * 0.9, { size: 0.16, life: 0.8 + Math.random() * 0.4, color, vy: 0.9 + Math.random() * 0.6 });
    }
    this.spawn('ring', e.x, e.y + 0.08, e.z, { size: 1.6, life: 0.5, color, ground: true });
  }
  sparkle(x: number, y: number, z: number, color: Vec3 = GOLD, n = 6): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283;
      this.spawn('spark', x, y, z, { size: 0.14 + Math.random() * 0.1, life: 0.4 + Math.random() * 0.3, color, vx: Math.cos(a) * 1.4, vy: 1.5 + Math.random() * 1.5, vz: Math.sin(a) * 1.4, gravity: 3, drag: 1.5 });
    }
  }
  click(x: number, y: number, z: number): void {
    this.spawn('click', x, y + 0.1, z, { size: 0.75, life: 0.5, color: WHITE, ground: true });
  }
  splash(x: number, z: number): void {
    this.spawn('ripple', x, 0.04, z, { size: 0.9, life: 0.7, color: SKY, alpha: 1, ground: true });
  }
  blast(x: number, y: number, z: number, r: number, element: Element, heavy = false): void {
    const col = ELEMENT_COLOR[element];
    this.spawn('ring', x, y + 0.08, z, { size: r, life: 0.42, color: col, ground: true });
    this.spawn('burst', x, y + 0.6, z, { size: Math.min(2.2, 0.6 + r * 0.35), life: 0.26, color: col, rot: Math.random() * 6 });
    const n = Math.round(6 + r * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, s = 1.5 + Math.random() * r * 1.2;
      if (element === 'fire') this.spawn('spark', x, y + 0.3, z, { size: 0.2, life: 0.5, color: FLAME, vx: Math.cos(a) * s, vy: 2 + Math.random() * 3, vz: Math.sin(a) * s, gravity: 6, drag: 1.5 });
      else if (element === 'frost') this.spawn('mote', x + Math.cos(a) * r * 0.6, y + 0.3, z + Math.sin(a) * r * 0.6, { size: 0.08, life: 0.9, color: WHITE, vy: 1.4 + Math.random(), sway: 0.6 });
      else this.spawn('puff', x + Math.cos(a) * r * 0.4, y + 0.1, z + Math.sin(a) * r * 0.4, { size: 0.25, grow: 0.7, life: 0.5, color: element === 'physical' ? DUST : col, alpha: 0.7, vx: Math.cos(a) * s * 0.6, vy: 0.8, vz: Math.sin(a) * s * 0.6, drag: 2 });
    }
    if (element === 'storm') this.spawn('beam', x, y + 2.5, z, { size: 0.35, aspect: 6, life: 0.35, color: GOLD });
    this.light(x, y + 1, z, Math.max(4, r * 1.6), 0.25);
    if (heavy) this.game.shake(0.35);
  }
  chain(ax: number, ay: number, az: number, bx: number, by: number, bz: number, element: Element): void {
    const col = ELEMENT_COLOR[element];
    const n = Math.max(3, Math.round(Math.hypot(bx - ax, bz - az) * 1.4));
    for (let i = 0; i <= n; i++) {
      const k = i / n, j = (Math.random() - 0.5) * 0.35;
      this.spawn('spark', ax + (bx - ax) * k + j, ay + (by - ay) * k + Math.abs(j), az + (bz - az) * k - j, { size: 0.18, life: 0.22, color: col, rot: Math.random() * 6 });
    }
    this.spawn('burst', bx, by, bz, { size: 0.6, life: 0.2, color: col, rot: Math.random() * 6 });
    this.light(bx, by, bz, 4, 0.12);
  }
  nova(x: number, y: number, z: number, r: number, color: Vec3): void {
    this.spawn('ring', x, y + 0.08, z, { size: r, life: 0.45, color, ground: true });
    this.spawn('ring', x, y + 0.08, z, { size: r * 0.7, life: 0.35, color, ground: true });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * 6.283;
      this.spawn('spark', x, y + 0.5, z, { size: 0.16, life: 0.35, color, vx: Math.cos(a) * r * 2.4, vy: 0.4, vz: Math.sin(a) * r * 2.4, drag: 3 });
    }
  }
  lootBeam(e: AnyEntity, rarity: Rarity): Particle | null {
    const tall = rarity === 'unique' || rarity === 'legendary';
    return this.spawn('beam', e.x, e.y + (tall ? 2.6 : 1.4), e.z, { size: tall ? 0.36 : 0.22, aspect: tall ? 6.5 : 3.5, life: 1, color: this.rarityPencil(rarity), hold: true, follow: e, dy: tall ? 2.6 : 1.4, alpha: 1.2 });
  }

  laser(ax: number, ay: number, az: number, bx: number, by: number, bz: number, color: Vec3 = CYAN, width = 0.3, life = 0.3, type: 'laser' | 'arc' = 'laser'): Particle | null {
    const dx = bx - ax, dy = by - ay, dz = bz - az, len = Math.max(Math.hypot(dx, dy, dz), 1e-3);
    return this.spawn(type, ax + dx / 2, ay + dy / 2, az + dz / 2, {
      size: width, aspect: len / 2 / width, rot: Math.atan2(dx, dz), tilt: Math.asin(Math.max(-1, Math.min(1, dy / len))), axial: true, life, color,
    });
  }
  muzzleOf(e: AnyEntity): Vec3 {
    const c = Math.cos(e.yaw), s = Math.sin(e.yaw), k = e.scale;
    return [e.x + (c * 0.15 - s * 0.6) * k, e.y + 0.9 * k, e.z + (s * 0.15 + c * 0.6) * k];
  }
  dronePos(i: number, n: number, e: AnyEntity): Vec3 {
    const t = this.game.time, a = t * 2.2 + (i / n) * Math.PI * 2;
    return [e.x + Math.cos(a) * 1.2, e.y + 1.9 + 0.14 * Math.sin(t * 5 + i * 1.7), e.z + Math.sin(a) * 1.2];
  }
  bits(x: number, y: number, z: number, n: number, color: Vec3 = CYAN, speed = 4): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, s = speed * (0.4 + Math.random() * 0.8);
      this.spawn('bit', x, y, z, { size: 0.07 + Math.random() * 0.08, life: 0.35 + Math.random() * 0.45, color: Math.random() < 0.25 ? MAGENTA : color, vx: Math.cos(a) * s, vy: 1 + Math.random() * speed * 0.6, vz: Math.sin(a) * s, gravity: 5, drag: 1.6 });
    }
  }
  muzzle(e: AnyEntity, color: Vec3 = CYAN, big = false): Vec3 {
    const m = this.muzzleOf(e);
    this.spawn('burst', m[0], m[1], m[2], { size: big ? 0.75 : 0.45, life: 0.16, color, rot: Math.random() * 6 });
    this.spawn('ring', m[0], m[1], m[2], { size: big ? 0.6 : 0.35, life: 0.18, color, alpha: 0.9 });
    this.bits(m[0], m[1], m[2], big ? 6 : 3, color, 3);
    this.light(m[0], m[1], m[2], big ? 7 : 4.5, 0.12);
    return m;
  }
  shock(x: number, y: number, z: number, r: number, color: Vec3 = CYAN, life = 0.45): void {
    this.spawn('shock', x, y + 0.09, z, { size: r, life, color, ground: true, rot: Math.random() * 6 });
  }
  pillar(x: number, y: number, z: number, r: number, color: Vec3 = CYAN, huge = false): void {
    const w = Math.max(0.35, r * (huge ? 0.42 : 0.3));
    this.laser(x, y + (huge ? 26 : 16), z, x, y - 0.2, z, color, w, huge ? 0.9 : 0.42);
    this.laser(x, y + (huge ? 26 : 16), z, x, y - 0.2, z, CYBER.WHITE, w * 0.45, huge ? 0.75 : 0.32);
    this.shock(x, y, z, r * 1.15, color, huge ? 0.8 : 0.45);
    if (huge) {
      for (let k = 1; k < 4; k++) setTimeout(() => this.shock(x, y, z, r * (1 + k * 0.35), k % 2 ? MAGENTA : color, 0.7), k * 140);
      this.spawn('burst', x, y + 1.2, z, { size: r * 0.5, life: 0.4, color, rot: Math.random() * 6 });
      this.spawn('sigil', x, y + 0.1, z, { size: r * 1.05, life: 1.2, color, ground: true });
    }
    this.bits(x, y + 0.4, z, huge ? 40 : 10, color, huge ? 9 : 5);
    for (let i = 0; i < (huge ? 24 : 8); i++) {
      const a = Math.random() * 6.283, s = (huge ? 8 : 4) * (0.5 + Math.random());
      this.spawn('spark', x, y + 0.3, z, { size: 0.2, life: 0.5, color, vx: Math.cos(a) * s, vy: 2 + Math.random() * 4, vz: Math.sin(a) * s, gravity: 8, drag: 1.2 });
    }
    this.light(x, y + 2, z, huge ? 22 : 8, huge ? 0.9 : 0.3);
    this.game.shake(huge ? 1 : 0.35);
    if (huge) this.game.rumble(1, 400);
  }
  glitch(x: number, y: number, z: number, r: number): void {
    this.spawn('sigil', x, y + 0.1, z, { size: r, life: 0.9, color: MAGENTA, ground: true });
    this.shock(x, y, z, r, MAGENTA, 0.55);
    setTimeout(() => this.shock(x, y, z, r * 0.7, CYAN, 0.45), 90);
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * 6.283, d = r * Math.sqrt(Math.random());
      this.spawn('bit', x + Math.cos(a) * d, y + 0.3 + Math.random() * 2.2, z + Math.sin(a) * d, { size: 0.08 + Math.random() * 0.14, life: 0.5 + Math.random() * 0.6, color: Math.random() < 0.5 ? MAGENTA : CYAN, vy: 0.6, sway: 1.5 });
    }
    this.light(x, y + 1, z, r * 1.6, 0.35);
  }
  hexShield(e: AnyEntity, life: number): void {
    this.spawn('hex', e.x, e.y + 0.95 * e.scale, e.z, { size: 1.3 * e.scale, life, color: CYAN, follow: e, dy: 0.95 * e.scale, alpha: 0.9 });
    this.shock(e.x, e.y, e.z, 2.2, CYAN, 0.4);
    this.bits(e.x, e.y + 1, e.z, 12, CYAN, 4);
  }
  vortex(x: number, y: number, z: number, r: number, life: number): Particle | null {
    this.spawn('sigil', x, y + 0.1, z, { size: r * 1.08, life, color: VOID, ground: true });
    return this.spawn('vortex', x, y + 0.12, z, { size: r, life, color: VOID, ground: true });
  }
  suck(x: number, y: number, z: number, r: number): void {
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * 6.283, d = r * (0.6 + Math.random() * 0.4), h = 0.3 + Math.random() * 1.6;
      this.spawn(Math.random() < 0.5 ? 'bit' : 'spark', x + Math.cos(a) * d, y + h, z + Math.sin(a) * d, { size: 0.1 + Math.random() * 0.08, life: 0.45, color: Math.random() < 0.6 ? VOID : MAGENTA, vx: -Math.cos(a) * d * 2.1, vy: -h * 1.4, vz: -Math.sin(a) * d * 2.1 });
    }
  }
  implode(x: number, y: number, z: number, r: number): void {
    this.spawn('burst', x, y + 1, z, { size: Math.min(3.5, r * 0.45), life: 0.35, color: VOID, rot: Math.random() * 6 });
    this.pillar(x, y, z, r * 0.6, VOID, false);
    this.shock(x, y, z, r * 1.3, MAGENTA, 0.6);
    this.bits(x, y + 1, z, 26, VOID, 8);
    this.game.shake(0.7);
  }
  overclock(e: AnyEntity, life: number): void {
    this.spawn('sigil', e.x, e.y + 0.1, e.z, { size: 1.7, life, color: CYAN, ground: true, follow: e, dy: 0.1 });
    this.shock(e.x, e.y, e.z, 3.4, CYAN, 0.5);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * 6.283;
      this.laser(e.x + Math.cos(a) * 1.4, e.y + 0.2, e.z + Math.sin(a) * 1.4, e.x + Math.cos(a) * 0.3, e.y + 2.6, e.z + Math.sin(a) * 0.3, CYAN, 0.16, 0.35, 'arc');
    }
    this.bits(e.x, e.y + 1, e.z, 16, CYAN, 5);
    this.light(e.x, e.y + 1.5, e.z, 9, 0.5);
  }

  private ambient(dt: number): void {
    const g = this.game, p = g.player;
    this.ambientTimer -= dt;
    if (this.ambientTimer > 0 || this.live.length > MAX - 120 || !p) return;
    this.ambientTimer = 0.09;
    const dungeon = g.world !== g.overworld;
    const kind = dungeon ? 'dust' : g.env.night > 0.6 ? 'fireflies' : g.biome.particles;
    const a = Math.random() * 6.283, r = 3 + Math.random() * 22;
    const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
    const y = g.world.surface(x, z);
    const [wx, wz] = g.env.wind;
    if (kind === 'fireflies') {
      this.spawn('mote', x, y + 0.4 + Math.random() * 1.6, z, { size: 0.09, life: 3 + Math.random() * 2, color: WHITE, alpha: 1, vx: (Math.random() - 0.5) * 0.5, vz: (Math.random() - 0.5) * 0.5, sway: 0.5 });
    } else if (kind === 'petals' || kind === 'leaves') {
      const col = kind === 'petals' ? C(232, 150, 150) : (Math.random() < 0.5 ? C(232, 164, 48) : C(224, 92, 70));
      this.spawn('leaf', x, y + 3 + Math.random() * 3, z, { size: 0.09, life: 5, color: col, vx: wx * 0.9, vy: -0.75, vz: wz * 0.9, sway: 0.7, rot: Math.random() * 6, spin: 1.5 });
    } else if (kind === 'snow') {
      this.spawn('mote', x, y + 2 + Math.random() * 5, z, { size: 0.06, life: 5, color: WHITE, alpha: 1, vx: wx * 0.6, vy: -0.9, vz: wz * 0.6, sway: 0.4 });
    } else if (Math.random() < 0.6) {
      this.spawn('mote', x, y + 0.3 + Math.random() * 2.2, z, { size: 0.045, life: 4, color: DUST, alpha: 0.7, vx: wx * (dungeon ? 0.05 : 0.35), vy: 0.08, vz: wz * (dungeon ? 0.05 : 0.35), sway: 0.3 });
    }
  }

  private wire(): void {
    const bus = this.game.bus;
    bus.on('damage', (d) => {
      if (d.dot) return;
      const t = d.target;
      const col = t.kind === 'player' ? RED : d.crit ? GOLD : ELEMENT_COLOR[d.element] ?? WHITE;
      this.hit(t.x, t.y + t.height * 0.5, t.z, col, d.crit);
    });
    bus.on('swing', (d) => this.slash(d.entity, d.radius, d.color ?? WHITE));
    bus.on('cast', (d) => {
      if (d.behavior === 'melee' || d.behavior === 'dash' || d.behavior === 'leap') return;
      const p = this.game.player, col = ELEMENT_COLOR[d.element as Element] ?? WHITE;
      const fx = -Math.sin(p.yaw), fz = Math.cos(p.yaw);
      const x = p.x + fx * 0.45, y = p.y + 1.35, z = p.z + fz * 0.45;
      this.spawn('burst', x, y, z, { size: 0.42, life: 0.18, color: col, rot: Math.random() * 6 });
      for (let i = 0; i < 5; i++) {
        const a = Math.random() * 6.283;
        this.spawn('spark', x, y, z, { size: 0.12, life: 0.3, color: col, vx: Math.cos(a) * 1.6 + fx * 1.5, vy: 0.8 + Math.random(), vz: Math.sin(a) * 1.6 + fz * 1.5, drag: 3 });
      }
      this.light(x, y, z, 3.5, 0.12);
    });
    bus.on('monster:died', (m) => this.poof(m, [m.colors[0][0], m.colors[0][1], m.colors[0][2]]));
    bus.on('levelup', () => this.levelUp(this.game.player));
    bus.on('heal', (d) => this.heal(d.entity, d.focus ? SKY : undefined));
    bus.on('pickup', (d) => this.sparkle(d.x, d.y + 0.4, d.z, d.rare ? SKY : GOLD, d.rare ? 12 : 5));
    bus.on('step', (d) => {
      if (d.water) this.splash(d.entity.x, d.entity.z);
      else if (d.entity.kind === 'player') this.dust(d.entity.x, d.entity.y, d.entity.z, 1);
    });
    bus.on('moveclick', (d) => this.click(d.x, d.y, d.z));
    bus.on('attune', (d) => { this.heal(this.game.player, SKY); this.spawn('beam', d.x, d.y + 3, d.z, { size: 0.5, aspect: 6, life: 1.2, color: SKY }); });
    bus.on('dash', (d) => { this.dust(d.x, d.y, d.z, 5, LEAFY); this.spawn('ring', d.x, d.y + 0.08, d.z, { size: 1.4, life: 0.35, color: WHITE, ground: true }); });
    bus.on('evade', (d) => { this.dust(d.x, d.y, d.z, 4); });
    bus.on('bolt:hit', (d) => { this.hit(d.x, d.y, d.z, ELEMENT_COLOR[d.element], !!d.big); if (d.big) this.spawn('ring', d.x, d.y, d.z, { size: 1.6, life: 0.35, color: ELEMENT_COLOR[d.element] }); });
    bus.on('blast', (d) => this.blast(d.x, d.y, d.z, d.r, d.element, d.heavy));
    bus.on('chain', (d) => this.chain(d.from.x, d.from.y, d.from.z, d.to.x, d.to.y, d.to.z, d.element));
    bus.on('telegraph', (d) => {
      const col = d.color ?? this.danger;
      if (d.lane) this.spawn('lane', d.x, d.y + 0.1, d.z, { size: d.w! / 2, aspect: d.len! / d.w!, rot: Math.atan2(d.dirx!, d.dirz!), life: d.t, color: col, ground: true });
      else this.spawn(d.fill ? 'zone' : 'ring', d.x, d.y + 0.08, d.z, { size: d.r, life: d.t, color: col, alpha: 1, ground: true });
    });
    bus.on('hazard:cloud', (d) => this.spawn('cloud', d.x, d.y + 0.12, d.z, { size: d.r, life: d.life, color: d.color ?? this.danger, ground: true }));
    bus.on('slam', (d) => {
      this.spawn('ring', d.x, d.y + 0.08, d.z, { size: d.r, life: 0.4, color: d.color ?? WHITE, ground: true });
      this.dust(d.x, d.y, d.z, d.heavy ? 9 : 4);
      if (d.heavy) this.game.shake(0.45);
    });
    bus.on('shot:hit', (d) => { this.hit(d.x, d.y, d.z, this.danger, false); });
    bus.on('found', (d) => { if (d.x !== undefined) this.sparkle(d.x, (d.y ?? 0) + 0.6, d.z!, GOLD, 10); });
    bus.on('boon', (d) => this.heal(d.entity, SKY));
    bus.on('travel:arrive', (d) => { this.spawn('ring', d.x, d.y + 0.08, d.z, { size: 2.2, life: 0.6, color: SKY, ground: true }); this.sparkle(d.x, d.y + 1, d.z, SKY, 8); });
    bus.on('charge:dust', (d) => this.dust(d.x, d.y, d.z, 2));
    bus.on('guard', (d) => this.spawn('mark', d.entity.x, d.entity.y + 0.1, d.entity.z, { size: d.entity.radius * 2.8, life: d.t, color: SKY, ground: true, follow: d.entity, dy: 0.1 }));
    bus.on('boss:spawn', (m) => { this.spawn('ring', m.x, m.y + 0.08, m.z, { size: 4, life: 0.8, color: INK, ground: true }); this.dust(m.x, m.y, m.z, 12, INK); });
  }
}
