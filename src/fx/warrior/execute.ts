// Execute: a headsman's chop. A tall crimson crescent drops straight down on the panel ahead, the floor splits
// under it, and a thin red echo cuts the second panel.
import { Particles, Rng, fit, sparkle, clamp, hex } from '../../vendor/pixelfx/index.js';
import { drawSwing, sparks, crack, type Swing } from '../lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Execute', desc: 'A crimson chop straight down; the floor splits.', duration: 0.5, panels: 2, ink: '#000000' };

/** Crimson steel: dark blood red up to a white edge. */
const BLOOD = ['#000000', '#881400', '#a81000', '#e40058', '#f83800', '#fca044', '#fcfcfc'];

export function create(o: Opts) {
  const C = fit(BLOOD, 7), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: ['#fcfcfc', '#fca044', '#f83800', '#881400'] });
  const A: Swing = { cx: 6, cy: -11, R: 13, sy: 1, rot: 0, a0: -2.2, a1: 1.4, W: 7, t0: -0.06, sweep: 0.06, hold: 0.08, trail: 0.2, ramp: C };
  const E: Swing = { ...A, cx: 40, R: 11, W: 3, t0: -0.02, hold: 0.05, trail: 0.16 };
  let t = 0, hit = false;
  return {
    update(dt: number) {
      t += dt;
      if (!hit) { hit = true; sparks(ps, R, 10, -1, 8, -Math.PI / 2, 1.2, [50, 120]); sparks(ps, R, 40, -6, 3, 0, 0.8); }
      ps.update(dt);
    },
    draw(p: Painter) {
      drawSwing(p, E, t, 0.15);
      drawSwing(p, A, t, 0.25);
      if (t < 0.06) sparkle(p, 10, -2, 6 * (1 - t / 0.06), C[5], C[4], 0.35);
      crack(p, 10, 0, 16, o.seed, hex('#000000'), clamp(1 - (t - 0.3) / 0.2));
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
