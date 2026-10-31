// Chain Hook drawing recipes (the hook, its iron chain, the drag after the pull). Same local space as src/fx/lib.ts: x forward,
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
