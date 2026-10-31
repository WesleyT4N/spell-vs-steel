// Priest-only drawing recipes (shared ones live in src/fx/lib.ts). Local space: x forward from the anchor panel's
// center, y down from its feet, 1 unit = 1 world pixel. Holy is gold light; shadow is violet over black.
import { clamp, ease, fit, hex, TAU } from '../../vendor/pixelfx/index.js';
import { RAMPS } from '../palette';
import { TUNING } from '../../game/tuning';
import { PW } from '../../art/arena';
import type { Painter } from '../../game/pfx';

/** Holy gold, dark to white (6 steps); shadow violet, black to lilac (5 steps). */
export const GOLD = (): number[] => fit([...RAMPS.holy], 6);
export const VIOLET = (): number[] => fit([...RAMPS.shadow], 5);
/** The blessings' colors, matching the blessed-panel sparkles: heal gold, Mana blue, shield white, damage orange. */
export const BLESS = {
  heal: ['#503000', '#ac7c00', '#f8b800', '#f8d878', '#fcfcfc'],
  mana: ['#0000bc', '#0058f8', '#3cbcfc', '#a4e4fc', '#fcfcfc'],
  shield: ['#3c3c3c', '#7c7c7c', '#bcbcbc', '#fcfcfc', '#fcfcfc'],
  power: ['#881400', '#f83800', '#fca044', '#fce0a8', '#fcfcfc'],
};
export const WHITE = hex('#fcfcfc');
export const BLACK = hex('#000000');

/** How fast the Priest's spark flies, in world pixels per second (shots run on their flight time). */
export const SHOT_V = TUNING.priest.shotSpeed * PW;

/** A plus sign (a healing cross): arm length s, with a brighter heart. */
export function cross(p: Painter, x: number, y: number, s: number, c: number, heart = c, a = 1): void {
  const X = Math.round(x), Y = Math.round(y);
  p.rect(X - s, Y, 2 * s + 1, 1, c, a); p.rect(X, Y - s, 1, 2 * s + 1, c, a);
  p.dot(X, Y, heart, a);
}
/** A fat plus (3 px arms), the readable cross at 1x. */
export function bigCross(p: Painter, x: number, y: number, s: number, c: number, heart: number, a = 1): void {
  const X = Math.round(x), Y = Math.round(y);
  p.rect(X - s, Y - 1, 2 * s + 1, 3, c, a); p.rect(X - 1, Y - s, 3, 2 * s + 1, c, a);
  p.rect(X - Math.max(0, s - 2), Y, 2 * Math.max(0, s - 2) + 1, 1, heart, a); p.rect(X, Y - Math.max(0, s - 2), 1, 2 * Math.max(0, s - 2) + 1, heart, a);
}

/**
 * A pillar of light standing on the floor at x: from the floor up to `top`, half width w, a white core and gold
 * flanks stepping down the ramp (dark to bright) to its edge. a its alpha.
 */
export function pillar(p: Painter, x: number, top: number, w: number, ramp: number[], a = 1, bottom = 0): void {
  if (w <= 0.3 || a <= 0) return;
  const n = ramp.length;
  p.shade(x - w - 1, top, x + w + 1, bottom, (px: number, _py: number, o: { c: number; a: number }) => {
    const v = Math.abs(px - x) / w;
    if (v > 1) return;
    o.c = v < 0.3 ? ramp[n - 1] : v < 0.6 ? ramp[n - 2] : v < 0.85 ? ramp[n - 3] : ramp[n - 4];
    o.a = a;
  });
}

/** A glyph ring lying on the floor (a sigil): an ellipse with tick marks turning round it. u its age 0..1. */
export function sigil(p: Painter, x: number, y: number, r: number, rot: number, ramp: number[], a = 1, ticks = 6, sy = 0.32): void {
  if (r < 1 || a <= 0) return;
  const n = ramp.length;
  for (let j = 0, m = Math.ceil(r * TAU * 1.3); j < m; j++) {
    const g = (j / m) * TAU;
    p.dot(x + Math.cos(g) * r, y + Math.sin(g) * r * sy, ramp[n - 2], a);
  }
  for (let i = 0; i < ticks; i++) {
    const g = rot + (i / ticks) * TAU, cx = Math.cos(g), sx = Math.sin(g);
    p.dot(x + cx * (r - 2), y + sx * (r - 2) * sy, ramp[n - 1], a);
    p.dot(x + cx * (r + 1.5), y + sx * (r + 1.5) * sy, ramp[n - 3], a);
  }
}

/** A flat ring of light on the floor rolling out: u its age 0..1, r its widest radius. */
export function floorRing(p: Painter, x: number, y: number, u: number, r: number, ramp: number[], sy = 0.3): void {
  if (u < 0 || u >= 1) return;
  const k = ease.outCubic(u), rr = 2 + k * (r - 2), n = ramp.length, a = 1 - u * u;
  for (let j = 0, m = Math.ceil(rr * TAU * 1.3); j < m; j++) {
    const g = (j / m) * TAU;
    p.dot(x + Math.cos(g) * rr, y + Math.sin(g) * rr * sy, u < 0.25 ? ramp[n - 1] : ramp[n - 2], a);
    p.dot(x + Math.cos(g) * (rr - 1), y + Math.sin(g) * (rr - 1) * sy, ramp[n - 3], a * 0.8);
  }
}

/** Light rays fanning out from (x, y): n rays of length L, turned by rot, thinning to their tips. */
export function rays(p: Painter, x: number, y: number, n: number, L: number, rot: number, ramp: number[], a = 1, sy = 1): void {
  if (L < 1) return;
  const m = ramp.length;
  for (let i = 0; i < n; i++) {
    const g = rot + (i / n) * TAU, ca = Math.cos(g), sa = Math.sin(g) * sy, len = i % 2 ? L * 0.6 : L;
    for (let d = 1; d <= len; d += 0.5) { const u = d / len; p.dot(x + ca * d, y + sa * d, u < 0.3 ? ramp[m - 1] : u < 0.7 ? ramp[m - 2] : ramp[m - 3], a * (u < 0.7 ? 1 : 0.7)); }
  }
}

const NOTE = ['..##', '..#.', '..#.', '###.', '###.'];
const SKULL = ['.###.', '#####', '#o#o#', '#####', '.#.#.'];
const DROP = ['.#.', '###', '###'];
/** A tiny pixel glyph from rows of '#' (solid c), 'o' (color o, if given) and '.' (empty), its top-left at (x, y). */
export function glyph(p: Painter, rows: string[], x: number, y: number, c: number, a = 1, o?: number): void {
  const X = Math.round(x), Y = Math.round(y);
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') p.dot(X + i, Y + j, c, a); else if (r[i] === 'o' && o !== undefined) p.dot(X + i, Y + j, o, a); });
}
export const note = (p: Painter, x: number, y: number, c: number, a = 1): void => glyph(p, NOTE, x - 2, y - 4, c, a);
export const skull = (p: Painter, x: number, y: number, c: number, eye: number, a = 1): void => glyph(p, SKULL, x - 2, y - 2, c, a, eye);
export const drop = (p: Painter, x: number, y: number, c: number, hi: number, a = 1): void => { glyph(p, DROP, x - 1, y - 1, c, a); p.dot(Math.round(x) - 1, Math.round(y), hi, a); };

/** A wavering tendril of shadow from (x0, y0) heading ang for len px, writhing with phase ph; thick at the root. */
export function tendril(p: Painter, x0: number, y0: number, ang: number, len: number, ph: number, ramp: number[], a = 1): void {
  if (len < 1) return;
  const n = ramp.length, ca = Math.cos(ang), sa = Math.sin(ang);
  for (let d = 0; d <= len; d += 0.5) {
    const u = d / len, wob = Math.sin(u * 5 + ph) * 2 * u, x = x0 + ca * d - sa * wob, y = y0 + sa * d + ca * wob;
    p.dot(x, y, u > 0.8 ? ramp[n - 1] : ramp[n - 3], a);
    if (u < 0.5) p.dot(x + 1, y, ramp[n - 2], a);
  }
}

/** A puff of shadow (a dark blob with a lilac rim) at (x, y), radius r. */
export function murk(p: Painter, x: number, y: number, r: number, ramp: number[], a = 1): void {
  if (r < 0.6) return;
  p.circle(x, y, r, (d: number) => (d > 0.75 ? ramp[2] : d > 0.4 ? ramp[1] : ramp[0]), a);
}

/** An eased 0..1..0 envelope: rises over [t0, t1], holds, falls over [t2, t3]. */
export const env = (t: number, t0: number, t1: number, t2: number, t3: number): number =>
  t < t0 || t > t3 ? 0 : t < t1 ? clamp((t - t0) / (t1 - t0)) : t < t2 ? 1 : 1 - clamp((t - t2) / (t3 - t2));
