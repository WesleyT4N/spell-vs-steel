// Chain Hook drafting recipes (shared by the chain-hook-a..c looks). Same local space as src/fx/lib.ts: x forward,
// y down, 1 unit = 1 world pixel. Steel only: black ink, the NES grays, a white edge.
import { clamp, fit, hex } from '../../vendor/pixelfx/index.js';
import { RAMPS } from '../palette';
import type { Painter } from '../../game/pfx';

/** Steel as color numbers, dark to bright: black, #3c3c3c, #7c7c7c, #bcbcbc, #fcfcfc. */
export const STEEL = fit([...RAMPS.steel], 5);
export const WHITE = hex('#fcfcfc');
export const STEEL_SPARKS = ['#fcfcfc', '#bcbcbc', '#7c7c7c', '#3c3c3c'];

/** How far a Chain Hook has flown by t (12 panels/s), plus the stretch from the Warrior's fist to where it left. */
export const chainBack = (t: number): number => t * 12 * 38 + 13;

/**
 * An iron chain lying from x0 back to x1 (x1 < x0) at height y: oval rings standing open, joined by flat links.
 * `sag` bows its middle down (pixels), `phase` slides the links along (so a moving chain rattles), and links past
 * `fadeFrom` pixels from x0 dim a step so it reads as running off toward the Warrior.
 */
export function ironChain(p: Painter, x0: number, x1: number, y: number, sag = 0, phase = 0, fadeFrom = Infinity): void {
  const L = x0 - x1;
  if (L < 2) return;
  const off = ((phase % 6) + 6) % 6;
  for (let d = -off; d < L; d += 6) {
    const x = Math.round(x0 - d), k = clamp(d / L), yy = Math.round(y + sag * Math.sin(Math.PI * k));
    const dim = d > fadeFrom;
    const top = dim ? STEEL[3] : WHITE, mid = dim ? STEEL[2] : STEEL[3], low = STEEL[2];
    // ring: 4 wide, 3 tall, open in the middle
    for (let i = 0; i < 4; i++) {
      const xx = x - 3 + i;
      if (xx > x0 || xx < x1) continue;
      if (i === 0 || i === 3) p.px(xx, yy, mid);
      else { p.px(xx, yy - 1, top); p.px(xx, yy + 1, low); }
    }
    // flat link to the next ring
    for (let i = 4; i < 6; i++) { const xx = x - i; if (xx <= x0 && xx >= x1) p.px(xx, yy, mid); }
  }
}

/**
 * A fish hook seen side on, pointing forward: an eye at the back where the chain ties on, the shank, the bend,
 * and the barbed point curling back. (x, y) is the eye. `a` fades it.
 */
const HOOK = [
  '......www...',
  'llllllllllw.',
  'gggggggg.llw',
  '..........lw',
  '....w.....gl',
  '....lw...gl.',
  '.....lgggl..',
  '......ggg...',
];
export function hook(p: Painter, x: number, y: number, a = 1, back = false): void {
  // back: pointing the other way (toward -x), with (x, y) still the eye
  p.sprite(HOOK, { o: '#7c7c7c', w: '#fcfcfc', l: '#bcbcbc', g: '#7c7c7c' }, Math.round(back ? x - 11 : x), Math.round(y) - 1, { a, flip: back });
}

/**
 * The grapple: a cast-iron shaft with a spear point and two claws that curl back from its crown like an anchor's.
 * `open` 0 (claws hugging the shaft) to 1 (flung wide). (x, y) is the ring at its back; s = -1 points it backward.
 */
export function grapple(p: Painter, x: number, y: number, open: number, s = 1): void {
  x = Math.round(x); y = Math.round(y);
  const X = (d: number): number => x + s * d;
  // the ring the cable ties to, and the shaft
  p.rect(Math.min(X(0), X(1)), y - 2, 2, 4, STEEL[2]);
  p.line(X(2), y, X(9), y, STEEL[3]); p.line(X(2), y - 1, X(9), y - 1, WHITE);
  // spear point
  p.poly([[X(9), y - 2], [X(13), y - 0.5], [X(9), y + 1]], STEEL[3]);
  p.px(X(10), y - 1, WHITE);
  // the two claws: out from the crown, then curling back to points
  const sp = Math.round(2 + open * 3), back = Math.round(3 + open * 1);
  p.line(X(9), y - 2, X(10), y - 1 - sp, STEEL[3]); p.line(X(10), y - 1 - sp, X(10 - back), y - 2 - sp, WHITE);
  p.line(X(9), y + 1, X(10), y + sp, STEEL[2]); p.line(X(10), y + sp, X(10 - back), y + 1 + sp, STEEL[3]);
}

/**
 * A taut steel cable from x0 to x1 at height y, 2 px: light on top, gray below, with white glints running along it
 * (`run` slides them). `amp` shakes it in a standing wave (a twang) at phase `ph`.
 */
export function cable(p: Painter, x0: number, x1: number, y: number, run = 0, amp = 0, ph = 0): void {
  const a = Math.min(x0, x1), b = Math.max(x0, x1), L = b - a;
  if (L < 1) return;
  for (let x = Math.round(a); x <= b; x++) {
    const k = (x - a) / L, yy = Math.round(y + amp * Math.sin(Math.PI * k) * Math.sin(k * Math.PI * 3 + ph));
    const g = ((x + Math.round(run)) % 11 + 11) % 11 < 2;
    p.px(x, yy, g ? WHITE : STEEL[3]);
    p.px(x, yy + 1, STEEL[2]);
  }
}

/**
 * A sickle blade spinning on its chain: a crescent of radius r, its horns turned by angle ang (snapped to eighth
 * turns so it clicks between clean poses), white along its cutting edge, round a dark hub.
 */
export function sickle(p: Painter, x: number, y: number, ang: number, r = 6): void {
  const a0 = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);
  p.arc(x, y, r, (u: number) => 0.6 + 2.6 * Math.sin(Math.PI * u), a0, a0 + Math.PI * 1.2, (u: number, v: number) => (v > 0.55 ? WHITE : u < 0.25 ? STEEL[2] : STEEL[3]));
  p.rect(x - 1, y - 1, 2, 2, STEEL[2]);
}

/**
 * A bead chain whipping in a wave from x0 back to x1 (either way along x) at height y: 2 px beads every 3 px, so
 * the ink beads them apart. The wave (amp, wavelength wl, phase ph) grows from nothing at x1 (the fist) to full.
 */
export function beadChain(p: Painter, x0: number, x1: number, y: number, amp: number, wl: number, ph: number): void {
  const L = Math.abs(x1 - x0), s = Math.sign(x1 - x0) || 1;
  for (let d = 0; d <= L; d += 3) {
    const env = clamp((L - d) / 24) * clamp(d / 10 + 0.3);
    const x = Math.round(x0 + s * d), yy = Math.round(y + amp * env * Math.sin((d / wl) * Math.PI * 2 + ph));
    const lit = ((d / 3) | 0) % 2 === 0;
    p.px(x, yy, lit ? WHITE : STEEL[3]); p.px(x + 1, yy, STEEL[3]);
    p.px(x, yy + 1, STEEL[3]); p.px(x + 1, yy + 1, STEEL[2]);
  }
}

/**
 * A coil of chain cinched round a body at (x, y): an ellipse of links rx wide, 2 tall. The near half (below) is
 * lit, the far half dark. `a` fades it.
 */
export function coil(p: Painter, x: number, y: number, rx: number, ph = 0): void {
  const n = Math.max(6, Math.round(rx * 1.1));
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + ph, cx = x + Math.cos(ang) * rx, cy = y + Math.sin(ang) * 2;
    const near = Math.sin(ang) > -0.2;
    p.px(cx, cy, near ? (i % 2 ? WHITE : STEEL[3]) : STEEL[2]);
    p.px(cx + 1, cy, near ? STEEL[3] : STEEL[1]);
  }
}

/**
 * Speed lines of a body yanked to `head` from `tail` (either way along x): a few streaks at body height whose
 * tails catch up with the body as k goes 0 to 1.
 */
export function dragLines(p: Painter, head: number, tail: number, k: number, ys = [-17, -11, -5]): void {
  if (k >= 1 || Math.abs(tail - head) < 4) return;
  const s = Math.sign(tail - head);
  ys.forEach((y, i) => {
    const h = head + s * (3 + (i % 2) * 3), e = tail + (h - tail) * Math.min(1, k * (1.1 + i * 0.3));
    if ((e - h) * s < 2) return;
    p.line(h, y, e, y, i === 1 ? WHITE : STEEL[3]);
  });
}

/** A gouge the foe's heels plough through the floor from `tail` to `head`, wiped away from the tail by k = 1. */
export function skid(p: Painter, head: number, tail: number, k: number): void {
  if (k >= 1 || Math.abs(tail - head) < 4) return;
  const e = tail + (head - tail) * k, a = Math.min(head, e), b = Math.max(head, e);
  for (let x = Math.round(a); x <= b; x++) p.px(x, 0, (x & 3) === 0 ? STEEL[2] : STEEL[1]);
}
