// Rampage: one of three wild slashes on the enemy, each at its own angle (from the seed), gold over red.
import { Particles, Rng, fit, sparkle } from '../../vendor/pixelfx/index.js';
import { RAMPS } from '../palette';
import { drawSwing, sparks, tipOf, type Swing } from '../lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Rampage', desc: 'A wild slash at a random angle, gold over red.', duration: 0.3, ink: '#581000' };

export function create(o: Opts) {
  const C = fit([...RAMPS.rage], 7), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: ['#fcfcfc', '#fce0a8', '#f8b800', '#f83800'] });
  const up = R.chance(0.5);
  const A: Swing = { cx: R.range(-2, 2), cy: -12, R: 11, sy: R.range(0.45, 0.8), rot: R.range(-0.9, 0.9), a0: up ? 2.4 : -2.4, a1: up ? -0.6 : 0.6, W: 5, t0: -0.04, sweep: 0.04, hold: 0.04, trail: 0.14, ramp: C };
  const tip = tipOf(A);
  let t = 0, hit = false;
  return {
    update(dt: number) {
      t += dt;
      if (!hit) { hit = true; sparks(ps, R, tip.x, tip.y, 5, Math.atan2(tip.dy, tip.dx), 0.8); }
      ps.update(dt);
    },
    draw(p: Painter) {
      drawSwing(p, A, t, 0.25);
      if (t < 0.05) sparkle(p, 0, -12, 4, C[5], C[4], 0.3);
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
