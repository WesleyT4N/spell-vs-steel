// Spell and attack effects: pixel art with a light particle layer. Every effect keeps to a 24x24 footprint
// (the fighter sprite size): impacts stand on their panel, shots and beams carry their box down the row.
import { P, blob, glow, type Ctx } from '../engine/gfx';
import { panelFoot, PW, X0 } from '../art/arena';
import { drawFighterSprite, type Sprite } from '../art/sprites';
import type { Battle, Fighter, Fx, Projectile } from './battle';
import { team } from './teamColors';
import { drawPfx } from './pfx';
import { TUNING } from './tuning';

export const FIRE = ['#f83800', '#fca044', '#f8b800', '#fce0a8'];
export const ICE = ['#0058f8', '#3cbcfc', '#a4e4fc', '#fcfcfc'];
export const ARC = ['#940084', '#d800cc', '#f878f8', '#fcfcfc'];
export const HOLY = ['#ac7c00', '#f8b800', '#f8d878', '#fcfcfc'];
export const TOX = ['#005800', '#58d854', '#b8f818', '#fcfcfc'];
export const SHADOW = ['#4428bc', '#6844fc', '#9878f8', '#fcfcfc'];
export const STEEL = ['#3c3c3c', '#7c7c7c', '#bcbcbc', '#fcfcfc'];
/** Hot to cold: white core, yellow, orange, red, ember. */
const HEAT = ['#fcfcfc', '#fce0a8', '#f8d878', '#f8b800', '#fca044', '#f87800', '#f83800', '#a81000', '#581000'];
const SMOKE = ['#7c7c7c', '#5c5c5c', '#3c3c3c'];
const SNOW = ['#fcfcfc', '#a4e4fc', '#3cbcfc'];
const ICED = '#002c8c';

// ---------- particles ----------
interface Box { x0: number; x1: number; y0: number; y1: number }
export interface Part { x: number; y: number; vx: number; vy: number; g: number; drag: number; age: number; life: number; ramp: string[]; size: number; shrink: number; dither: boolean; box?: Box }
// each Battle keeps its own particles, so a card preview drawn beside a fight doesn't disturb it
interface Layer { parts: Part[]; lastTime: number }
const layers = new WeakMap<Battle, Layer>();
let cur: Layer = { parts: [], lastTime: -1 };
/** Point the particle layer at `b`'s particles. Called before drawing a battle's effects. */
export function useParticles(b: Battle): void {
  let l = layers.get(b);
  if (!l) { l = { parts: [], lastTime: -1 }; layers.set(b, l); }
  cur = l;
}
const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
/** A 24x24 box around a point, or standing on a panel foot. */
const boxC = (x: number, y: number): Box => ({ x0: x - 12, x1: x + 12, y0: y - 12, y1: y + 12 });
const boxF = (x: number, y: number): Box => ({ x0: x - 12, x1: x + 12, y0: y - 24, y1: y + 1 });

function part(x: number, y: number, o: Partial<Part>): Part {
  const p: Part = { x, y, vx: 0, vy: 0, g: 0, drag: 1, age: 0, life: 0.5, ramp: SNOW, size: 1, shrink: 0.6, dither: false, ...o };
  cur.parts.push(p);
  return p;
}
/** Spawn a particle from outside the effects (fighter animations). No box: it may leave the 24x24 footprint. */
export const spawnPart = (x: number, y: number, o: Partial<Part>): void => { part(x, y, o); };
const emit = (n: number, f: (i: number) => void): void => { for (let i = 0; i < n; i++) f(i); };
const ember = (x: number, y: number, box: Box, o: Partial<Part> = {}): Part => part(x, y, { vx: rnd(-12, 12), vy: rnd(-30, -8), g: 18, life: rnd(0.35, 0.8), ramp: HEAT.slice(1), box, ...o });
const smoke = (x: number, y: number, box: Box, o: Partial<Part> = {}): Part => part(x, y, { vx: rnd(-5, 5), vy: rnd(-14, -6), life: rnd(0.6, 1.1), ramp: SMOKE, size: rnd(2, 4), shrink: -0.3, dither: true, box, ...o });
const spark = (x: number, y: number, ramp: string[], box: Box, speed = 50, o: Partial<Part> = {}): Part => {
  const a = Math.random() * Math.PI * 2, s = rnd(0.4, 1) * speed;
  return part(x, y, { vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.3, g: 120, life: rnd(0.2, 0.45), ramp, size: rnd(1, 2), box, ...o });
};
const mote = (x: number, y: number, ramp: string[], box: Box, o: Partial<Part> = {}): Part => part(x, y, { vx: rnd(-4, 4), vy: rnd(-22, -10), drag: 0.98, life: rnd(0.4, 0.8), ramp, box, ...o });

/** Advance and draw the particle layer. Called once per frame after the effects. */
export function drawParticles(c: Ctx, b: Battle): void {
  useParticles(b);
  let dt = cur.lastTime < 0 ? 0 : b.time - cur.lastTime;
  if (dt < 0 || dt > 0.25) { dt = 0; if (b.time - cur.lastTime < 0) cur.parts = []; }
  dt = Math.min(dt, 0.05);
  cur.lastTime = b.time;
  for (const p of cur.parts) {
    p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt;
    if (p.drag !== 1) { p.vx *= p.drag; p.vy *= p.drag; }
  }
  cur.parts = cur.parts.filter(p => p.age < p.life && (!p.box || (p.x >= p.box.x0 && p.x < p.box.x1 && p.y >= p.box.y0 && p.y < p.box.y1)));
  for (const p of cur.parts) {
    const k = p.age / p.life, col = p.ramp[Math.min(p.ramp.length - 1, Math.floor(k * p.ramp.length))];
    const s = Math.max(1, Math.round(p.size * (1 - k * p.shrink)));
    if (p.dither && ((Math.round(p.x) + Math.round(p.y)) & 1)) continue;
    P(c, col, p.x - (s >> 1), p.y - (s >> 1), s, s);
  }
}

// one-shot spawns per effect (an effect is drawn every frame; its particles spawn once)
const fired = new WeakMap<object, Set<string>>();
function once(e: object, key: string, cond = true): boolean {
  if (!cond) return false;
  let s = fired.get(e);
  if (!s) { s = new Set(); fired.set(e, s); }
  if (s.has(key)) return false;
  s.add(key);
  return true;
}

// ---------- drawing helpers ----------
/** Dithered disc: checkerboard pixels only, for glows and soft edges. */
function dblob(c: Ctx, col: string, cx: number, cy: number, r: number, phase = 0): void {
  cx = Math.round(cx); cy = Math.round(cy); c.fillStyle = col;
  for (let y = -r; y <= r; y++) {
    const w = Math.round(Math.sqrt(Math.max(0, r * r - y * y)));
    for (let x = -w; x <= w; x++) if (((x + y + phase) & 1) === 0) c.fillRect(cx + x, cy + y, 1, 1);
  }
}
function ring(c: Ctx, col: string, cx: number, cy: number, rx: number, ry: number, skip = 0): void {
  const n = Math.max(12, Math.round((rx + ry) * 2.2));
  for (let i = 0; i < n; i++) { if (skip && i % skip === 0) continue; const a = (i / n) * Math.PI * 2; P(c, col, cx + Math.cos(a) * rx, cy + Math.sin(a) * ry); }
}
/** An ice crystal standing on the floor, lit from the left. */
function crystal(c: Ctx, x: number, base: number, h: number, hw: number, glint = -1): void {
  x = Math.round(x); base = Math.round(base);
  for (let r = 0; r < h; r++) {
    const half = Math.max(0, Math.round(hw * Math.min(1, ((r + 1) / h) * 2.2))), y = base - h + r;
    P(c, '#000000', x - half - 1, y, half * 2 + 3, 1);
    if (!half) { P(c, '#fcfcfc', x, y, 1, 1); continue; }
    P(c, ICED, x - half, y, half * 2 + 1, 1); P(c, ICE[0], x, y, half + 1, 1); P(c, ICE[1], x - half + 1, y, half, 1); P(c, ICE[2], x - half + 1, y, Math.max(1, half >> 1), 1);
    if (glint >= 0 && Math.abs(r - glint) < 1) P(c, '#fcfcfc', x - half + 1, y, half * 2, 1);
  }
  if (h > 2) P(c, '#fcfcfc', x - 1, base - h + 2, 1, Math.max(1, h >> 2));
}
/** A fire explosion standing on a panel: shock ring, layered fireball, then embers and smoke. */
function explosion(c: Ctx, e: Fx, x: number, y: number, p: number, scale = 1): void {
  const box = boxF(x, y);
  if (once(e, 'boom')) {
    emit(Math.round(14 * scale), () => ember(x, y - 12, box, { vx: rnd(-45, 45), vy: rnd(-55, -10), g: 160, life: rnd(0.4, 0.9), size: rnd(1, 2) }));
    emit(Math.round(6 * scale), () => smoke(x + rnd(-7, 7), y - 12 - rnd(0, 6), box, { vy: rnd(-10, -4), life: rnd(0.8, 1.4), size: rnd(2, 4) }));
  }
  ring(c, p < 0.5 ? '#fce0a8' : '#f87800', x, y - 2, Math.min(11, 5 + p * 7 * scale), Math.min(2, 1 + p * 2));
  if (p < 0.75) {
    const r = Math.min(10, Math.round((3 + p * 6) * scale)), cy = y - 12;
    dblob(c, '#a81000', x, cy, Math.min(11, r + 2), Math.floor(p * 20));
    blob(c, FIRE[0], x, cy, r); blob(c, '#f87800', x, cy - 1, Math.round(r * 0.75));
    blob(c, FIRE[2], x, cy - 1, Math.round(r * 0.5)); blob(c, p < 0.3 ? '#fcfcfc' : FIRE[3], x, cy - 2, Math.round(r * 0.25));
  }
  if (p < 0.2) glow(c, x, y - 12, 12, '252,160,68', 0.6 * (1 - p / 0.2));
}
/** Dust kicked off a panel by an impact. */
function dust(e: Fx, x: number, y: number, n = 8, key = 'dust'): void {
  if (!once(e, key)) return;
  const box = boxF(x, y);
  emit(n, () => part(x + rnd(-4, 4), y - 2, { vx: rnd(-40, 40), vy: rnd(-25, -5), g: 60, drag: 0.94, life: rnd(0.35, 0.6), ramp: ['#fce0a8', '#bcbcbc', '#7c7c7c'], size: rnd(1, 3), shrink: -0.2, dither: true, box }));
}
function rocks(e: Fx, x: number, y: number, n = 6, key = 'rocks'): void {
  if (!once(e, key)) return;
  const box = boxF(x, y);
  emit(n, () => part(x + rnd(-6, 6), y - 3, { vx: rnd(-35, 35), vy: rnd(-70, -35), g: 260, life: rnd(0.35, 0.6), ramp: ['#bcbcbc', '#7c7c7c', '#3c3c3c'], size: rnd(1, 2.5), shrink: 0, box }));
}
function crack(c: Ctx, x: number, y: number): void {
  P(c, '#000000', x - 7, y - 1, 5, 1); P(c, '#000000', x - 3, y, 6, 1); P(c, '#000000', x + 3, y - 1, 5, 1);
  P(c, '#000000', x - 1, y - 3, 1, 3); P(c, '#000000', x + 5, y + 1, 2, 1);
}
function shatterShards(x: number, y: number): void {
  const box = boxF(x, y);
  emit(16, () => part(x + rnd(-9, 9), y - rnd(2, 21), { vx: rnd(-50, 50), vy: rnd(-60, 0), g: 200, life: rnd(0.3, 0.6), ramp: ['#fcfcfc', '#a4e4fc', '#3cbcfc', '#0058f8'], size: rnd(1, 2.5), box }));
  emit(5, () => part(x + rnd(-8, 8), y - rnd(2, 18), { vx: rnd(-6, 6), vy: rnd(-5, -1), life: rnd(0.6, 1), ramp: ['#a4e4fc', '#3cbcfc', '#0058f8'], size: rnd(2, 3), shrink: -0.2, dither: true, box }));
}
/** A rising green cross. */
function cross(c: Ctx, x: number, y: number, col: string, s = 1): void {
  P(c, '#000000', x - 1 - s, y - 1, 3 + 2 * s, 3); P(c, '#000000', x - 1, y - 1 - s, 3, 3 + 2 * s);
  P(c, col, x - s, y, 1 + 2 * s, 1); P(c, col, x, y - s, 1, 1 + 2 * s);
}

// ---------- effects ----------
export const ELEMENT_RAMP: Record<string, string[]> = { steel: STEEL, fire: FIRE, frost: ICE, arcane: ARC, shadow: SHADOW, poison: TOX, nature: ['#005800', '#58d854', '#b8f818', '#fcfcfc'], holy: HOLY };
const cellPx = (col: number, row: number): { x: number; y: number } => panelFoot(col, row);

export function drawFx(c: Ctx, b: Battle, e: Fx): void {
  // effects ported to the pixelfx method (src/fx/) draw themselves
  if (drawPfx(c, b, e)) return;
  const p = Math.min(1, e.t / e.dur);
  const { x, y } = cellPx(e.col, e.row);
  const d = e.side === 0 ? 1 : -1;
  const ph = Math.floor(b.time * 24);
  switch (e.kind) {
    case 'thrust': {
      // a long lunge: the spear streaks out with speed lines and a glint at the point
      const len = Number(e.data?.len ?? 3) * PW * Math.min(1, p * 3), x0 = x + d * 6, tip = x0 + d * len;
      P(c, '#000000', Math.min(x0, tip), y - 12, len, 5);
      P(c, '#7c7c7c', Math.min(x0, tip), y - 11, len, 3); P(c, '#fcfcfc', Math.min(x0, tip), y - 10, len, 1);
      for (let i = 0; i < 3; i++) P(c, '#bcbcbc', tip - d * (8 + i * 10 + (ph % 4)), y - 15 + i * 6, 6, 1);
      if (p > 0.3 && p < 0.7) { P(c, '#fcfcfc', tip - 3, y - 10, 7, 1); P(c, '#fcfcfc', tip, y - 13, 1, 7); }
      if (once(e, 'sp', p > 0.33)) emit(5, () => spark(tip, y - 10, STEEL.slice(1).reverse(), boxC(tip, y - 10), 45));
      break;
    }
    case 'smash': case 'quake': case 'shockwave': case 'wide': {
      const rows = e.kind === 'shockwave' || e.kind === 'wide' ? [0, 1, 2] : [e.row];
      for (const r of rows) {
        const pc = cellPx(e.col, r);
        if (e.kind === 'wide') {
          // a sweeping blade across the whole column
          const sx = pc.x - d * 10 + d * p * 20;
          P(c, '#000000', sx - 2, pc.y - 18, 5, 17); P(c, '#bcbcbc', sx - 1, pc.y - 17, 3, 15); P(c, '#fcfcfc', sx, pc.y - 17, 1, 15);
          for (let i = 1; i < 4; i++) P(c, '#7c7c7c', sx - d * i * 3, pc.y - 16 + i, 1, 13 - i * 2);
          dust(e, pc.x, pc.y, 5, 'd' + r);
          continue;
        }
        const big = e.kind !== 'smash';
        if (p < 0.25) glow(c, pc.x, pc.y - 4, 11, e.kind === 'smash' ? '248,184,0' : '252,224,168', 0.6 * (1 - p / 0.25));
        ring(c, p < 0.4 ? '#fcfcfc' : e.kind === 'smash' ? '#f8b800' : '#bcbcbc', pc.x, pc.y - 2, Math.min(11, 3 + p * 10), Math.min(3, 1 + p * 3));
        if (p < 0.3) { P(c, '#fcfcfc', pc.x - 5, pc.y - 8, 11, 1); P(c, '#fcfcfc', pc.x, pc.y - 13, 1, 11); }
        dust(e, pc.x, pc.y, big ? 10 : 7, 'd' + r);
        if (big) rocks(e, pc.x, pc.y, 6, 'r' + r);
        crack(c, pc.x, pc.y);
      }
      break;
    }
    case 'explode': explosion(c, e, x, y, p, e.dur >= 0.45 * TUNING.fxSlow ? 1.4 : 1); break;
    case 'guard': case 'shieldHit': case 'spark': {
      // steel on steel: a white star flash and a spray of sparks
      const sx = e.kind === 'spark' ? x : x + d * 8, sy = y - 11;
      if (p < 0.35) { const s = Math.round(5 * (1 - p / 0.35)) + 1; P(c, '#fcfcfc', sx - s, sy, s * 2 + 1, 1); P(c, '#fcfcfc', sx, sy - s, 1, s * 2 + 1); P(c, '#f8d878', sx - 1, sy - 1, 3, 3); glow(c, sx, sy, 8, '252,252,252', 0.5); }
      if (once(e, 'sp')) emit(8, () => spark(sx, sy, ['#fcfcfc', '#f8d878', '#f8b800', '#ac7c00'], boxC(sx, sy), 70));
      break;
    }
    case 'shout': {
      // a battle cry: shock rings rolling off the fighter with wind streaks and dust
      for (let k = 0; k < 2; k++) {
        const q = Math.min(1, p + k * 0.25), r = 5 + q * 7;
        ring(c, k ? '#bcbcbc' : '#fcfcfc', x, y - 11, r, r * 0.9, 2);
      }
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.5, r0 = 6 + p * 5; P(c, '#fcfcfc', x + Math.cos(a) * r0, y - 11 + Math.sin(a) * r0 * 0.9, 2, 1); }
      dust(e, x, y, 8);
      break;
    }
    case 'transform': {
      // power surges up the fighter: a rising column of gold light, sparks, and a flash at the peak
      const col = '248,184,0', h = Math.round(24 * Math.min(1, p * 2));
      for (let i = 0; i < 5; i++) { const t = (p * 2 + i / 5) % 1; P(c, i % 2 ? HOLY[3] : HOLY[2], x - 10 + i * 5, y - Math.floor(t * 24), 1, 3); }
      P(c, HOLY[1], x - 11, y - 1, 23, 1);
      if (p < 0.6) { c.globalAlpha = 0.3; P(c, HOLY[2], x - 9, y - h, 19, h); c.globalAlpha = 1; }
      if (p > 0.45 && p < 0.7) glow(c, x, y - 12, 12, col, 0.7);
      if (once(e, 'fl', p > 0.5)) emit(14, () => spark(x, y - 12, [HOLY[3], HOLY[2], HOLY[1]], boxF(x, y), 60, { g: 30 }));
      break;
    }
    case 'banner': {
      for (let r = 0; r < 3; r++) {
        const pc = cellPx(e.col, r), wave = Math.floor(b.time * 6 + r) % 3;
        P(c, '#000000', pc.x - 1, pc.y - 19, 3, 18); P(c, '#503000', pc.x, pc.y - 18, 1, 16); P(c, '#f8b800', pc.x, pc.y - 19, 1, 1);
        const flag = team(e.side).mark;
        for (let i = 0; i < 7; i++) { const off = Math.round(Math.sin((i + wave) * 1.1)); P(c, '#000000', pc.x + 1 + i, pc.y - 19 + off, 1, 7); P(c, flag, pc.x + 1 + i, pc.y - 18 + off, 1, 5); }
        P(c, '#fcfcfc', pc.x + 3, pc.y - 16 + Math.round(Math.sin((2 + wave) * 1.1)), 2, 1);
      }
      break;
    }
    case 'healBurst': {
      // green crosses and light motes rising around the fighter
      for (let i = 0; i < 5; i++) {
        const t = (p + i * 0.17) % 1, cx = x - 9 + ((i * 7) % 19), cy = y - 2 - t * 20;
        cross(c, cx, cy, t < 0.6 ? '#58d854' : '#b8f818', t < 0.3 ? 2 : 1);
      }
      glow(c, x, y - 10, 11, '88,216,84', 0.45 * (1 - p));
      if (once(e, 'm')) emit(10, () => mote(x + rnd(-9, 9), y - rnd(0, 12), ['#fcfcfc', '#b8f818', '#58d854'], boxF(x, y)));
      break;
    }
    case 'smoke': {
      if (once(e, 's')) emit(16, () => smoke(x + rnd(-8, 8), y - rnd(0, 14), boxF(x, y), { vx: rnd(-14, 14), vy: rnd(-12, -2), size: rnd(3, 5), life: rnd(0.4, 0.8), ramp: ['#bcbcbc', '#7c7c7c', '#3c3c3c'] }));
      if (p < 0.3) { c.globalAlpha = 0.6; dblob(c, '#7c7c7c', x, y - 10, 10, ph); c.globalAlpha = 1; }
      break;
    }
    case 'flare': {
      // a bright burst that purges the panel
      if (p < 0.5) { glow(c, x, y - 6, 11, '248,184,0', 0.6 * (1 - p * 2)); ring(c, HOLY[3], x, y - 4, 3 + p * 16, 2 + p * 6); }
      if (once(e, 'sp')) emit(10, () => spark(x, y - 6, [HOLY[3], FIRE[3], FIRE[2]], boxF(x, y), 55, { g: 40 }));
      break;
    }
    case 'laser': {
      // Kill Shot lock-on: a red line to the enemy and a closing reticle, blinking faster as it fires
      const t = b.f[1 - e.side], tp = panelFoot(t.col, t.row);
      const tx = tp.x + t.dx, ty = tp.y + t.dy;
      if (Math.floor(e.t * (8 + p * 20)) % 2 === 0) {
        const steps = 24;
        for (let i = 0; i <= steps; i++) P(c, '#f83800', x + (tx - x) * (i / steps), y - 12 + (ty - 12 - (y - 12)) * (i / steps), 1, 1);
      }
      const r = Math.round(10 - p * 6);
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { P(c, '#f83800', tx + sx * r - (sx < 0 ? 0 : 2), ty - 12 + sy * r, 3, 1); P(c, '#f83800', tx + sx * r, ty - 12 + sy * r - (sy < 0 ? 0 : 2), 1, 3); }
      P(c, '#fcfcfc', tx, ty - 12, 1, 1);
      break;
    }
    case 'cast': {
      // every spell: the element gathers at the caster's hand and flares (buff spells get feedback too)
      const ramp = ELEMENT_RAMP[String(e.data?.el ?? 'arcane')] ?? ARC, hx = x + d * 8, hy = y - 14;
      if (String(e.data?.el ?? 'arcane') === 'arcane') floorRune(c, x, y - 1, Math.min(11, 3 + p * 20), p * 6, ARC[1], ARC[3]);
      if (p < 0.6) for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + p * 5, r = 10 * (1 - p / 0.6) + 1; P(c, ramp[1 + (i % 3)], hx + Math.cos(a) * r, hy + Math.sin(a) * r, 1, 1); }
      if (p > 0.45 && p < 0.8) { blob(c, ramp[2], hx, hy, 2); P(c, ramp[3], hx - 3, hy, 7, 1); P(c, ramp[3], hx, hy - 3, 1, 7); }
      if (once(e, 'fl', p > 0.5)) emit(6, () => spark(hx, hy, [ramp[3], ramp[2], ramp[1]], boxC(hx, hy), 40, { g: 20 }));
      break;
    }
    case 'impact': impact(c, e, x, y - 11, p, d); break;
    case 'castName': break; // drawn on the UI layer by drawCastCallout
  }
}

// ---------- projectiles ----------
/**
 * The hit spark on every landed hit, colored by element and sized by how hard it hit (tier 0 light .. 3 KO).
 * A white-hot star on the first frames, a ring, then element sparks, all inside the 24x24 box around the target.
 */
function impact(c: Ctx, e: Fx, x: number, y: number, p: number, d: number): void {
  const el = String(e.data?.el ?? 'steel'), tier = Number(e.data?.tier ?? 0);
  const ramp = ELEMENT_RAMP[el] ?? STEEL;
  const box = boxC(x, y), hot = [ramp[3], ramp[2], ramp[1], ramp[0]];
  // struck point sits a little toward the attacker
  const sx = Math.round(x - d * 3), sy = Math.round(y);
  // star flash: long arms on the first frames, then shrinking
  const flash = 0.25 + tier * 0.05;
  if (p < flash) {
    const k = 1 - p / flash, s = Math.round((3 + tier * 2.5) * k) + 1;
    P(c, '#000000', sx - s - 1, sy - 1, s * 2 + 3, 3); P(c, '#000000', sx - 1, sy - s - 1, 3, s * 2 + 3);
    P(c, ramp[2], sx - s, sy, s * 2 + 1, 1); P(c, ramp[2], sx, sy - s, 1, s * 2 + 1);
    P(c, '#fcfcfc', sx - (s >> 1), sy, s + 1, 1); P(c, '#fcfcfc', sx, sy - (s >> 1), 1, s + 1);
    if (tier >= 1) { const q = Math.round(s * 0.6); for (let i = 1; i <= q; i++) { P(c, ramp[1], sx - i, sy - i); P(c, ramp[1], sx + i, sy - i); P(c, ramp[1], sx - i, sy + i); P(c, ramp[1], sx + i, sy + i); } }
    P(c, '#fcfcfc', sx - 1, sy - 1, 3, 3);
  }
  // ring rolling out on solid hits
  if (tier >= 1 && p < 0.6) ring(c, p < 0.25 ? ramp[3] : ramp[1], sx, sy, 3 + p * (14 + tier * 3), 2 + p * (10 + tier * 2), p > 0.3 ? 2 : 0);
  if (tier >= 2 && p < 0.2) glow(c, sx, sy, 10, '252,252,252', 0.6 * (1 - p / 0.2));
  if (!once(e, 'sp')) return;
  const n = [5, 9, 13, 18][tier] ?? 5, speed = 45 + tier * 15;
  switch (el) {
    case 'fire': emit(n, () => ember(sx + rnd(-3, 3), sy + rnd(-2, 2), box, { vx: rnd(-25, 25) + d * 10, vy: rnd(-45, -10) })); break;
    case 'frost': emit(n, () => spark(sx, sy, ICE.slice().reverse(), box, speed, { g: 160, size: 2, shrink: 0.5 })); break;
    case 'poison': emit(n, () => spark(sx, sy, [TOX[2], TOX[1], TOX[0]], box, speed * 0.7, { g: 220, size: 2 })); break;
    case 'nature': emit(n, () => spark(sx, sy, ['#b8f818', '#58d854', '#005800'], box, speed * 0.8, { g: 60, drag: 0.92, life: rnd(0.3, 0.6) })); break;
    case 'shadow': emit(n, () => { const a = Math.random() * Math.PI * 2, r = rnd(8, 11); part(sx + Math.cos(a) * r, sy + Math.sin(a) * r, { vx: -Math.cos(a) * 30, vy: -Math.sin(a) * 30, life: 0.3, ramp: [SHADOW[2], SHADOW[1], SHADOW[0]], size: 2, box }); }); break;
    case 'arcane': case 'holy': emit(n, () => mote(sx + rnd(-6, 6), sy + rnd(-5, 5), hot, box, { vy: rnd(-30, -8), life: rnd(0.3, 0.55), size: rnd(1, 2) })); emit(Math.ceil(n / 2), () => spark(sx, sy, hot, box, speed)); break;
    default: emit(n, () => spark(sx, sy, ['#fcfcfc', '#f8d878', '#bcbcbc', '#7c7c7c'], box, speed + 15, { vx: d * rnd(20, 70), vy: rnd(-40, 15) }));
  }
}

// ---------- statuses on fighters ----------
const prevFrozen = new WeakMap<Fighter, boolean>();
/** Frozen or Ice Block: the fighter sealed in a faceted block of ice that shatters when it ends. */
export function drawFrozen(c: Ctx, b: Battle, f: Fighter, s: Sprite, fx: number, y: number, flip: boolean): void {
  const iced = !f.dead && (f.st.frozen > 0 || f.st.iceBlock > 0);
  const was = prevFrozen.get(f) ?? false;
  prevFrozen.set(f, iced);
  if (was && !iced && !f.dead) shatterShards(fx, y);
  if (!iced) return;
  const x = Math.round(fx), bt = Math.round(y), top = bt - 23, gh = 23;
  c.globalAlpha = 0.45; drawFighterSprite(c, s, fx, y + 2, flip, 'ice'); c.globalAlpha = 1;
  c.globalAlpha = 0.3; P(c, ICE[2], x - 10, top, 21, gh); c.globalAlpha = 0.2; P(c, ICE[1], x + 2, top, 9, gh); c.globalAlpha = 1;
  P(c, '#000000', x - 11, top, 1, gh); P(c, '#000000', x + 11, top, 1, gh); P(c, '#000000', x - 11, top - 1, 23, 1);
  P(c, '#fcfcfc', x - 10, top, 20, 1); P(c, '#fcfcfc', x - 10, top, 1, gh); P(c, ICE[0], x + 10, top, 1, gh); P(c, ICE[0], x - 10, bt - 1, 21, 1);
  for (let i = 0; i < 9; i++) P(c, '#fcfcfc', x - 8 + i, top + 2 + i, 1, 1);
  for (let i = 0; i < 6; i++) P(c, ICE[1], x + 4 - i, top + 10 + i, 1, 1);
  const gl = ((b.time * 0.9) % 1.6) * 30 - 6;
  for (let i = 0; i < 4; i++) { const yy = top + 2 + i * 5, xx = Math.round(x - 10 + gl - i * 2); if (xx > x - 10 && xx < x + 10) P(c, '#fcfcfc', xx, yy, 1, 2); }
  crystal(c, x - 9, bt, 6, 2); crystal(c, x + 9, bt, 7, 2); crystal(c, x - 3, bt + 1, 4, 1);
  if (Math.random() < 0.05) part(x + rnd(-10, 10), bt - 1, { vy: rnd(-4, -1), life: rnd(0.6, 1), ramp: ['#a4e4fc', '#3cbcfc', '#0058f8'], size: rnd(2, 3), shrink: -0.2, dither: true, box: boxF(x, bt) });
}

/** Burning panel: a scorched panel with flame tongues licking up (24 wide) and embers drifting off. */
export function drawBurn(c: Ctx, b: Battle, col: number, row: number): void {
  const f = panelFoot(col, row), x = Math.round(f.x), base = Math.round(f.y) + 1, t = b.time;
  for (let yy = 0; yy < 8; yy++) for (let xx = 0; xx < 22; xx += 2) if (Math.sin(xx * 0.7 + yy + t * 6 + col) > 0.6) P(c, '#a81000', x - 11 + xx + (yy & 1), base - 9 + yy);
  for (let i = 0; i < 5; i++) {
    const fxp = x - 9 + i * 4.5, h = Math.round(5 + ((i * 3 + col + row) % 4) + Math.sin(t * 11 + i * 1.7 + col) * 2);
    for (let k = 0; k < h; k++) {
      const w = k < h * 0.4 ? 3 : k < h * 0.8 ? 2 : 1;
      P(c, HEAT[Math.min(8, 3 + Math.floor((k / h) * 5))], fxp - (w >> 1) + Math.round(Math.sin(t * 9 + k + i)), base - 3 - k, w, 1);
    }
  }
  if (Math.random() < 0.06) ember(x + rnd(-10, 10), base - 6, boxF(x, base), { vy: rnd(-25, -10), g: -5, life: rnd(0.4, 0.8) });
}

export const xOfShot = (p: Projectile): number => X0 + p.x * PW + PW / 2;

// ---------- arcane spells ----------
/** A flat rune circle on the floor: a ring, ticks turning around it and a few glyph marks. */
function floorRune(c: Ctx, x: number, y: number, r: number, spin: number, col: string, hot: string): void {
  ring(c, '#000000', x, y + 1, r + 1, r * 0.35 + 1);
  ring(c, col, x, y, r, r * 0.35);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + spin, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * 0.35; P(c, hot, px - 1, py, 2, 1); }
  if (r > 5) ring(c, col, x, y, r * 0.55, r * 0.2, 2);
}
