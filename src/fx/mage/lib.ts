// Mage-only drawing recipes (see docs/FX.md): arcane orbs and runes, fire blasts and flame tongues, frost spikes,
// and the bookkeeping a flying shot needs to draw a trail behind itself. Local space as in src/fx/lib.ts: x forward
// from the anchor (or the shot's center), y down from the panel's feet (or the shot's center).
import { clamp, ease, fit, hex, noise2, TAU, band, crystal } from '../../vendor/pixelfx/index.js';
import { RAMPS } from '../palette';
import type { Opts, Painter } from '../../game/pfx';

/** The Mage's element ramps as color numbers, dark to bright. */
export const ARC = fit([...RAMPS.arcane], 5);
export const FIRE = fit([...RAMPS.fire], 7);
export const ICE = fit([...RAMPS.frost], 6);
export const WHITE = hex('#fcfcfc');
export const BLACK = hex('#000000');
/** Spark colors for Particles, head to tail. */
export const ARC_SPARKS = ['#fcfcfc', '#f8b8f8', '#f878f8', '#d800cc'];
export const FIRE_SPARKS = ['#fcfcfc', '#fce0a8', '#f8b800', '#f83800'];
export const ICE_SPARKS = ['#fcfcfc', '#a4e4fc', '#3cbcfc', '#0078f8'];

/**
 * A flying shot's path so far. The adapter moves the painter's origin with the shot, so the effect remembers where
 * it has been (world pixels) and draws its trail in local space behind the current position.
 */
export class Path {
  x0: number; y0: number; pts: Array<[number, number]> = [];
  constructor(o: Opts) { this.x0 = o.x; this.y0 = o.y; }
  /** Call from update(dt, o): remembers the last few positions. */
  note(o: Opts | undefined, keep = 10): void {
    if (!o) return;
    const l = this.pts[this.pts.length - 1];
    if (!l || l[0] !== o.x || l[1] !== o.y) { this.pts.push([o.x, o.y]); if (this.pts.length > keep) this.pts.shift(); }
  }
  /** Pixels flown since the shot left the hand. */
  flown(o: Opts): number { return Math.hypot(o.x - this.x0, o.y - this.y0); }
  /** A remembered world point in the shot's local space. */
  local(o: Opts, w: [number, number]): [number, number] { return [(w[0] - o.x) * (o.flip ? -1 : 1), w[1] - o.y]; }
}

/** A lit ball: dark rim, bright body, white highlight up front. R: ramp dark to bright (4+ steps). */
export function orb(p: Painter, x: number, y: number, r: number, R: number[], hot = 0): void {
  if (r < 0.8) { p.px(x, y, R[R.length - 1]); return; }
  const n = R.length;
  p.shade(x - r, y - r, x + r, y + r, (lx: number, ly: number) => {
    const dx = lx - x, dy = ly - y, d = Math.hypot(dx, dy) / r;
    if (d > 1) return;
    const h = Math.hypot(dx - r * 0.35, dy + r * 0.35) / r;
    if (h < 0.28 + hot * 0.3) return WHITE;
    if (h < 0.6 + hot * 0.2) return R[n - 2];
    return d > 0.78 ? R[n - 4] : R[n - 3];
  });
}

/** A rune circle lying on the floor: an ellipse of pixels, turning ticks and an inner ring. a fades it. */
export function rune(p: Painter, x: number, y: number, r: number, spin: number, c: number, hot: number, a = 1, sy = 0.36): void {
  if (r < 1 || a <= 0) return;
  const m = Math.ceil(r * 7);
  for (let j = 0; j < m; j++) { const g = (j / m) * TAU; p.dot(x + Math.cos(g) * r, y + Math.sin(g) * r * sy, c, a); }
  for (let i = 0; i < 6; i++) {
    const g = (i / 6) * TAU + spin, px = x + Math.cos(g) * r, py = y + Math.sin(g) * r * sy;
    p.dot(px, py, hot, a); p.dot(px + 1, py, hot, a);
  }
  if (r > 5) for (let j = 0; j < m * 0.6; j += 2) { const g = (j / (m * 0.6)) * TAU - spin; p.dot(x + Math.cos(g) * r * 0.55, y + Math.sin(g) * r * 0.55 * sy, c, a); }
}

/** A standing rune ring (seen face on), for seals and wards: dotted ring, four turning glyph ticks. */
export function seal(p: Painter, x: number, y: number, r: number, spin: number, c: number, hot: number, a = 1, sx = 1): void {
  if (r < 1 || a <= 0) return;
  const m = Math.ceil(r * 7);
  for (let j = 0; j < m; j++) { const g = (j / m) * TAU; p.dot(x + Math.cos(g) * r * sx, y + Math.sin(g) * r, c, a); }
  for (let i = 0; i < 4; i++) {
    const g = (i / 4) * TAU + spin;
    p.line(x + Math.cos(g) * (r - 2) * sx, y + Math.sin(g) * (r - 2), x + Math.cos(g) * (r + 1) * sx, y + Math.sin(g) * (r + 1), hot, a);
  }
}

/**
 * A ball of fire: a lumpy disc, white-yellow at the heart cooling to red at the edge. heat 1 is fresh, 0 burnt
 * out (it then shows only its dark red husk). The edge boils with noise seeded by seed and t.
 */
export function blast(p: Painter, x: number, y: number, r: number, heat: number, seed: number, t: number, a = 1): void {
  if (r < 0.8 || a <= 0) return;
  const F = FIRE, R = r + 2;
  p.shade(x - R, y - R, x + R, y + R, (lx: number, ly: number, out: { a: number }) => {
    const dx = lx - x, dy = ly - y, n = noise2(lx * 0.35 + seed, ly * 0.35 - t * 9, seed) * 0.28;
    const d = Math.hypot(dx, dy * 1.08) / r + n;
    if (d > 1) return;
    // hotter toward the heart and the top; heat pushes the whole ball down the ramp as it burns out
    const v = clamp((1 - d) * 1.25 + heat * 0.9 - 0.75 - dy / r * 0.08);
    out.a = a;
    return F[clamp(Math.round(v * 6), 0, 6)];
  });
}

/** A flame tongue standing on (x, base), h tall and w wide, licking with phase ph; colors from FIRE. */
export function flame(p: Painter, x: number, base: number, h: number, w: number, ph: number, a = 1): void {
  if (h < 1.5 || a <= 0) return;
  for (let k = 0; k < h; k++) {
    // a teardrop: swells off the floor, then tapers to a licking point
    const u = k / h, prof = u < 0.3 ? 0.75 + (u / 0.3) * 0.25 : 1 - (u - 0.3) / 0.7, hw = Math.max(0.4, w * Math.pow(prof, 0.85));
    const sway = Math.sin(ph + u * 3.2) * u * w * 0.6;
    for (let dx = -Math.ceil(hw); dx <= Math.ceil(hw); dx++) {
      const e = Math.abs(dx - sway) / hw;
      if (e > 1) continue;
      const c = e > 0.66 || u > 0.8 ? FIRE[2] : u > 0.55 ? FIRE[3] : e < 0.34 && u < 0.35 ? FIRE[5] : FIRE[4];
      p.dot(x + dx, base - k, c, a);
    }
  }
}

/** A frost spike standing on (x, base): vendored crystal shading in the frost ramp (white tip, deep blue face). */
export function spike(p: Painter, x: number, base: number, h: number, w: number, lean: number, opts: { a?: number; white?: boolean; glint?: number } = {}): void {
  crystal(p, x, base, h, w, lean, ['#000000', ...RAMPS.frost], opts);
}

/** A four-point star glint, no light: arms in c with tips in tip and a white heart. */
export function star(p: Painter, x: number, y: number, arm: number, c: number, tip = c): void {
  const n = Math.round(arm);
  if (n < 1) return;
  for (let d = 1; d <= n; d++) { const cc = d > n * 0.6 ? tip : c; p.px(x + d, y, cc); p.px(x - d, y, cc); p.px(x, y + d, cc); p.px(x, y - d, cc); }
  if (n >= 3) { p.px(x + 1, y + 1, c); p.px(x - 1, y - 1, c); p.px(x + 1, y - 1, c); p.px(x - 1, y + 1, c); }
  p.px(x, y, WHITE);
}

/** A small faceted diamond: the mana crystal. */
export function manaGem(p: Painter, x: number, y: number, s: number, a = 1): void {
  if (s < 0.5) return;
  p.poly([[x, y - 3 * s], [x + 2 * s, y], [x, y + 3 * s], [x - 2 * s, y]], (px: number, py: number) => (px < x - 0.3 ? (py < y ? WHITE : ARC[3]) : py < y ? ARC[2] : ARC[1]), a);
}

/**
 * A shaft of force driven down from the top of the box: a wedge from (x0, top), narrow, to (x1, base), w half wide,
 * white down its spine, the ramp's bright steps at its edges. R: ramp dark to bright.
 */
export function shaft(p: Painter, x0: number, top: number, x1: number, base: number, w: number, R: number[]): void {
  if (w < 0.3) return;
  const n = R.length;
  p.shade(Math.min(x0, x1) - w - 1, top, Math.max(x0, x1) + w + 1, base, (x: number, y: number) => {
    const u = (y - top) / (base - top), cx = x0 + (x1 - x0) * u, hw = w * (0.35 + 0.65 * u) + 0.3, e = Math.abs(x - cx) / hw;
    if (e > 1) return;
    return e < 0.34 ? WHITE : e < 0.7 ? R[n - 2] : R[n - 3];
  });
}

/**
 * Fire rolling out over the floor at (x, y): a low ring with no white-hot rim (a white rim under a fireball reads as a
 * brazier). u its age 0..1, r its widest radius.
 */
export function fireRing(p: Painter, x: number, y: number, u: number, r: number, th = 1.5): void {
  if (u < 0 || u >= 1) return;
  band(p, x, y, 3 + ease.outQuart(u) * (r - 3), 0.22, th, 1 - u, FIRE.slice(0, 5), () => true, false);
}
