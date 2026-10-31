// Shared drawing recipes for our effects (see docs/FX.md). Everything here draws in an effect's local space:
// x forward from the anchor panel's center, y down from its feet, 1 unit = 1 world pixel.
import { clamp, ease, smooth, TAU } from '../vendor/pixelfx/index.js';
import type { Painter } from '../game/pfx';

/** A swing: an arc on a tilted ellipse that sweeps from a0 to a1, holds, then its tail catches up. */
export interface Swing {
  cx: number; cy: number;
  /** Radius and how squashed the ellipse is (1 a circle, 0.3 a flat sweep), and its tilt in radians. */
  R: number; sy: number; rot: number;
  /** Start and end angle (radians, 0 = forward, negative = up). */
  a0: number; a1: number;
  /** Smear thickness at its widest. */
  W: number;
  /** When it starts, how long the edge takes to cross, how long it holds, how long the tail takes. */
  t0: number; sweep: number; hold: number; trail: number;
  /** Color ramp, dark to bright (numbers from fit()). */
  ramp: number[];
}

/** A point on the swing's ellipse at angle a and radius r. */
export function onArc(s: Swing, r: number, a: number): [number, number] {
  const lx = Math.cos(a) * r, ly = Math.sin(a) * r * s.sy, c = Math.cos(s.rot), n = Math.sin(s.rot);
  return [s.cx + lx * c - ly * n, s.cy + lx * n + ly * c];
}

/**
 * Draw a swing at time t: a crescent smear, white at the rim and the leading edge, cooling down the ramp towards
 * the inside and the tail, thinning to a hair at the tail and dithering out as it ages.
 */
export function drawSwing(p: Painter, s: Swing, t: number, glowK = 0.25): void {
  const u = t - s.t0;
  if (u < 0) return;
  const span = s.a1 - s.a0, head = ease.outExpo(clamp(u / s.sweep)), tail = smooth(s.sweep + s.hold, s.sweep + s.hold + s.trail, u);
  if (tail >= 1) return;
  const age = clamp(u / (s.sweep + s.hold + s.trail));
  const ta = s.a0 + span * tail, L = span * (head - tail), Wd = s.W * (1 - tail * 0.5);
  if (Math.abs(L) < 0.02 || Wd < 0.3) return;
  const R = s.ramp, n = R.length, dir = Math.sign(L), len = Math.abs(L), c = Math.cos(s.rot), sn = Math.sin(s.rot), B = s.R + 2;
  p.shade(s.cx - B, s.cy - B, s.cx + B, s.cy + B, (x: number, y: number, out: { c: number; a: number }) => {
    const dx = x - s.cx, dy = y - s.cy, lx = dx * c + dy * sn, ly = (-dx * sn + dy * c) / s.sy, r = Math.hypot(lx, ly);
    if (r > s.R + 0.5 || r < s.R - Wd - 1) return;
    let v = (dir * (Math.atan2(ly, lx) - ta)) % TAU;
    if (v < 0) v += TAU;
    if (v > len) return;
    const k = v / len, w = Wd * Math.pow(Math.sin(Math.PI * Math.pow(k, 2.2)), 0.6);
    if (w < 0.35) return;
    const q = (s.R - r) / w;
    if (q < 0 || q > 1) return;
    const ci = q < 0.25 && age < 0.5 ? 0 : Math.round(q * (n - 1) * 0.8 + age * 2.2 - k * 0.8 + 0.3);
    out.c = R[n - 1 - clamp(ci, 0, n - 1)];
    out.a = Math.min(1, k / 0.35);
  });
  if (glowK > 0) for (let v = 0; v <= len; v += 0.35) {
    const [x, y] = onArc(s, s.R - Wd * 0.4, ta + dir * v);
    p.glow(x, y, 3 + Wd * 0.6, R[n - 3], glowK * (1 - age) * (v / len));
  }
}

/** Where the swing's edge ends, and the direction it was travelling. */
export function tipOf(s: Swing): { x: number; y: number; dx: number; dy: number } {
  const [x, y] = onArc(s, s.R - s.W * 0.3, s.a1), [x2, y2] = onArc(s, s.R - s.W * 0.3, s.a1 + Math.sign(s.a1 - s.a0) * 0.05);
  const l = Math.hypot(x2 - x, y2 - y) || 1;
  return { x, y, dx: (x2 - x) / l, dy: (y2 - y) / l };
}

/** A thin crack on the panel face: a jagged line with a few short branches, darkest at the middle. */
export function crack(p: Painter, x: number, y: number, len: number, seed: number, c: number, k = 1): void {
  let px = x - len / 2, py = y;
  for (let i = 0; i < len; i++) {
    const ny = y + Math.round(Math.sin(i * 1.7 + seed) * 0.8);
    if (Math.abs(i - len / 2) < len / 2 * k) p.px(px + 1, ny, c);
    px += 1; py = ny;
  }
  void py;
}
