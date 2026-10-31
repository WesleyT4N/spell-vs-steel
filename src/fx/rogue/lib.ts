// Rogue-only drawing recipes (see docs/FX.md and src/fx/lib.ts for the shared ones). Same local space: x forward
// from the anchor panel's center, y down from its feet, 1 unit = 1 world pixel. Rogue looks are quick, thin and
// precise: hairline cuts with a white edge, small knives, and hard-edged smoke in NES steps.
import { clamp, ease, hex, fit, Rng } from '../../vendor/pixelfx/index.js';
import { RAMPS } from '../palette';
import type { Painter } from '../../game/pfx';

/** Ramps as color numbers, dark to bright. */
export const SHADOW = fit([...RAMPS.shadow], 5);
export const STEEL = fit([...RAMPS.steel], 5);
export const POISON = fit([...RAMPS.poison], 5);
export const DUSTR = fit([...RAMPS.dust], 4);
export const WHITE = hex('#fcfcfc');
export const BLACK = hex('#000000');
/** Smoke grays, dark to light (NES grays plus the art's two in-between grays). */
export const SMOKE = ['#3c3c3c', '#5c5c5c', '#7c7c7c', '#bcbcbc', '#fcfcfc'].map(hex);
/** Shadow smoke: black through violet to lilac. */
export const DUSK = ['#000000', '#3c3c3c', '#5c5c5c', '#4428bc', '#6844fc'].map(hex);
/** The Rogue's sparks: white, lilac, violet. */
export const SHADOW_SPARKS = ['#fcfcfc', '#d8b8f8', '#9878f8', '#4428bc'];
export const STEEL_SPARKS = ['#fcfcfc', '#bcbcbc', '#7c7c7c', '#3c3c3c'];
export const POISON_SPARKS = ['#d8f878', '#b8f818', '#58d854', '#00a800'];

/** How far a fast stroke has drawn in by u seconds after it starts (0..1), snapping out in `inT` seconds. */
export const snap = (u: number, inT: number): number => (u <= 0 ? 0 : ease.outExpo(clamp(u / inT)));

/**
 * A straight cut from (x0, y0) to (x1, y1) that starts at t0: the head shoots across in `inT`, holds, then the tail
 * catches up over `out`. White at the edge, colored by ramp C (dark to bright) behind it, at most W thick.
 */
export function cut(p: Painter, C: number[], x0: number, y0: number, x1: number, y1: number, t: number, t0: number, W: number, inT = 0.04, hold = 0.04, out = 0.14): void {
  const u = t - t0;
  if (u < 0) return;
  const head = snap(u, inT), tail = ease.inCubic(clamp((u - inT - hold) / out));
  if (tail >= 1 || head - tail < 0.02) return;
  const n = C.length, ax = x0 + (x1 - x0) * tail, ay = y0 + (y1 - y0) * tail, bx = x0 + (x1 - x0) * head, by = y0 + (y1 - y0) * head;
  const w = Math.max(1, W * (1 - tail * 0.7));
  p.beam(ax, ay, bx, by, w, (k: number, v: number) => (v < 0.4 && tail < 0.35 ? WHITE : k > 0.75 ? C[n - 1] : tail < 0.4 ? C[n - 2] : C[n - 3]));
}

/**
 * A thin crescent cut: the arc of a circle at (cx, cy) radius r from angle a0 to a1 (radians, 0 = forward, y down),
 * drawn in like `cut`. Thickest in its middle, tapering to points, white on the outer edge.
 */
export function crescent(p: Painter, C: number[], cx: number, cy: number, r: number, sy: number, a0: number, a1: number, t: number, t0: number, W: number, inT = 0.045, hold = 0.04, out = 0.14): void {
  const u = t - t0;
  if (u < 0) return;
  const head = snap(u, inT), tail = ease.inCubic(clamp((u - inT - hold) / out));
  if (tail >= 1 || head - tail < 0.02) return;
  const n = C.length, steps = Math.ceil(Math.abs(a1 - a0) * r * 2);
  for (let i = 0; i <= steps; i++) {
    const k = i / steps;
    if (k < tail || k > head) continue;
    const a = a0 + (a1 - a0) * k, span = (k - tail) / Math.max(0.001, head - tail);
    const w = Math.max(0.5, W * Math.sin(Math.PI * clamp(span)) * (1 - tail * 0.6));
    for (let d = 0; d < w; d += 0.5) {
      const rr = r - d, x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * sy, q = d / Math.max(1, w);
      p.px(x, y, q < 0.3 && tail < 0.4 ? WHITE : q < 0.65 ? C[n - 2] : C[n - 3]);
    }
  }
}

/** A small dagger centered at (x, y) pointing along angle ang: a steel blade of length L, a crossguard and a grip. */
export function knife(p: Painter, x: number, y: number, ang: number, L: number, blade: number[] = STEEL, grip = hex('#503000'), a = 1): void {
  const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux, back = L * 0.45;
  const gx = x - ux * back, gy = y - uy * back;
  // grip, guard, blade (bright edge on the upper side), then a white point
  p.line(gx - ux * 3, gy - uy * 3, gx, gy, grip, a);
  p.line(gx - nx * 1.6, gy - ny * 1.6, gx + nx * 1.6, gy + ny * 1.6, blade[2], a);
  p.line(gx + ux, gy + uy, x + ux * (L - back - 1), y + uy * (L - back - 1), blade[3], a);
  p.line(gx + ux + nx * 0.6, gy + uy + ny * 0.6, x + ux * (L - back - 2) + nx * 0.6, y + uy * (L - back - 2) + ny * 0.6, blade[2], a);
  p.dot(x + ux * (L - back), y + uy * (L - back), WHITE, a);
}

/** A 4-point star glint of arm length n (whole pixels), white heart, colored arms. */
export function glint(p: Painter, x: number, y: number, n: number, c: number, k = 0.25): void {
  const m = Math.round(n);
  if (m < 1) { p.px(x, y, WHITE); return; }
  for (let d = 1; d <= m; d++) { const cc = d === m && m > 1 ? c : WHITE; p.px(x + d, y, cc); p.px(x - d, y, cc); p.px(x, y + d, cc); p.px(x, y - d, cc); }
  p.px(x, y, WHITE);
  if (k > 0) p.glow(x, y, 3 + m * 1.5, c, k);
}

interface Puff { x: number; y: number; vx: number; vy: number; r: number; life: number; age: number; delay: number }
/**
 * Hard-edged smoke: round puffs that swell, drift and shrink away, shaded in whole ramp steps (a lit cap, a body,
 * a dark underside). No blending, so it inks cleanly. Seeded through the caller's Rng.
 */
export class Puffs {
  list: Puff[] = [];
  constructor(public ramp: number[] = SMOKE) {}
  add(x: number, y: number, vx: number, vy: number, r: number, life: number, delay = 0): void {
    this.list.push({ x, y, vx, vy, r, life, age: 0, delay });
  }
  /** n puffs scattered round (x, y) within w by h, drifting up. */
  burst(R: Rng, x: number, y: number, n: number, w: number, h: number, r: [number, number], life: [number, number], spread = 14, rise = 10): void {
    for (let i = 0; i < n; i++) this.add(x + R.range(-w, w), y + R.range(-h, h), R.range(-spread, spread), -R.range(rise * 0.3, rise), R.range(r[0], r[1]), R.range(life[0], life[1]), R.range(0, 0.04));
  }
  update(dt: number): void {
    for (const q of this.list) {
      if (q.delay > 0) { q.delay -= dt; continue; }
      q.age += dt;
      q.x += q.vx * dt; q.y += q.vy * dt;
      q.vx -= q.vx * 3 * dt; q.vy -= q.vy * 2 * dt;
    }
    this.list = this.list.filter(q => q.age < q.life);
  }
  draw(p: Painter): void {
    const R = this.ramp, n = R.length;
    for (const q of this.list) {
      if (q.delay > 0) continue;
      const k = q.age / q.life, r = q.r * (k < 0.2 ? 0.5 + ease.outCubic(k / 0.2) * 0.5 : 1 - ease.inQuad((k - 0.2) / 0.8) * 0.85);
      if (r < 0.6) continue;
      // older smoke sinks down the ramp
      const lvl = Math.min(n - 2, Math.floor(k * 2.2)), body = R[n - 2 - lvl], cap = R[n - 1 - lvl], low = R[Math.max(0, n - 3 - lvl)];
      p.circle(q.x, q.y, r, body);
      if (r > 1.5) p.circle(q.x + r * 0.15, q.y + r * 0.3, r * 0.7, low);
      if (r > 1.5) p.circle(q.x - r * 0.25, q.y - r * 0.3, r * 0.5, cap);
    }
  }
  get count(): number { return this.list.length; }
}

interface Bub { x: number; y: number; vy: number; r: number; life: number; age: number; delay: number }
/** Poison bubbles: rise, wobble, swell and pop into a 4-pixel splash. */
export class Bubbles {
  list: Bub[] = [];
  constructor(public C: number[] = POISON) {}
  add(x: number, y: number, vy: number, r: number, life: number, delay = 0): void { this.list.push({ x, y, vy, r, life, age: 0, delay }); }
  update(dt: number): void {
    for (const b of this.list) {
      if (b.delay > 0) { b.delay -= dt; continue; }
      b.age += dt; b.y += b.vy * dt;
    }
    this.list = this.list.filter(b => b.age < b.life + 0.06);
  }
  draw(p: Painter): void {
    const C = this.C;
    for (const b of this.list) {
      if (b.delay > 0) continue;
      const x = b.x + Math.sin(b.age * 18 + b.r * 5) * 0.8;
      if (b.age >= b.life) {
        // pop
        for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [-1, -2], [1, -2]]) p.px(x + dx, b.y + dy, C[3]);
        continue;
      }
      const r = b.r * (0.6 + 0.4 * (b.age / b.life));
      if (r < 1.2) { p.px(x, b.y, C[3]); continue; }
      p.ring(x, b.y, r, 1, C[2]);
      p.px(x - r * 0.4, b.y - r * 0.4, WHITE);
    }
  }
  get count(): number { return this.list.length; }
}

/** A falling drop of venom or blood (1x2 px), with gravity, removed at the floor. */
export class Drops {
  list: Array<{ x: number; y: number; vx: number; vy: number; c: number; life: number }> = [];
  add(x: number, y: number, vx: number, vy: number, c: number, life = 0.5): void { this.list.push({ x, y, vx, vy, c, life }); }
  update(dt: number): void {
    for (const d of this.list) { d.vy += 420 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.life -= dt; }
    this.list = this.list.filter(d => d.life > 0 && d.y < 0);
  }
  draw(p: Painter): void { for (const d of this.list) { p.px(d.x, d.y, d.c); p.px(d.x, d.y - 1, d.c); } }
}

/**
 * A hooded silhouette the size of a fighter standing at x (feet on y = 0): a head and a cloak, filled with `fill`
 * (0 for an outline only) and rimmed with `rim` (0 for none), at alpha a (dithered).
 */
export function ghost(p: Painter, x: number, fill: number, rim: number, a = 1, hide = 0): void {
  if (a <= 0) return;
  // a peaked hood, shoulders, a cloak and two legs, facing forward
  const body: Array<[number, number]> = [[x, -23], [x + 2, -21], [x + 3, -18], [x + 2, -16], [x + 4, -14], [x + 5, -8], [x + 4, -7], [x + 4, 0], [x + 1, 0], [x, -4], [x - 1, 0], [x - 4, 0], [x - 4, -7], [x - 5, -8], [x - 4, -14], [x - 2, -16], [x - 3, -18], [x - 2, -21]];
  // hide: leave out |x| < hide, so the ghost only peeks out from behind the fighter
  if (fill) p.poly(body, (px: number) => (Math.abs(px) < hide ? 0 : fill), a);
  if (fill && !hide) { p.px(x + 1, -18, BLACK); p.px(x + 2, -18, BLACK); }
  if (rim) for (let i = 0; i < body.length; i++) { const [x0, y0] = body[i], [x1, y1] = body[(i + 1) % body.length]; p.line(x0, y0, x1, y1, rim, a); }
}

/** Speed lines: n short horizontal dashes behind a moving thing, fading with k (1 fresh, 0 gone). */
export function speedLines(p: Painter, x: number, y: number, n: number, len: number, c: number, k: number, seed: number): void {
  if (k <= 0) return;
  for (let i = 0; i < n; i++) {
    const yy = y + ((i * 7 + seed) % 9) - 4, l = len * (0.5 + ((i * 5 + seed) % 5) / 8) * k, xx = x - ((i * 3 + seed) % 4);
    p.line(xx - l, yy, xx, yy, c);
  }
}
