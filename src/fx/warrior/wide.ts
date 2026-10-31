// Wide Cleave: one huge vertical crescent sweeps top to bottom through the enemy front column, sparks off each panel
// it passes and dust where it ends.
import { Particles, Rng, fit, sparkle, clamp } from '../../vendor/pixelfx/index.js';
import { RAMPS } from '../palette';
import { drawSwing, sparks, dust, ROW, type Swing } from '../lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Wide Cleave', desc: 'A column-tall crescent sweeps the enemy front column.', duration: 0.4, rows: 3, ink: '#000000' };

export function create(o: Opts) {
  const C = fit([...RAMPS.steel], 5), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => ROW + 1, sparks: ['#fcfcfc', '#fce0a8', '#bcbcbc', '#7c7c7c'] });
  const A: Swing = { cx: -20, cy: -11, R: 30, sy: 1, rot: 0, a0: -1.2, a1: 1.2, W: 6, t0: -0.06, sweep: 0.06, hold: 0.05, trail: 0.18, ramp: C };
  let t = 0, hit = false;
  return {
    update(dt: number) {
      t += dt;
      if (!hit) {
        hit = true;
        for (const y of [-ROW, 0, ROW]) { sparks(ps, R, 8, y - 11, 3, 0, 0.9); dust(ps, R, 4, y - 1, 1); }
      }
      ps.update(dt);
    },
    draw(p: Painter) {
      drawSwing(p, A, t, 0.2);
      for (const y of [-ROW, 0, ROW]) if (t < 0.08) sparkle(p, 8, y - 11, 4 * (1 - clamp(t / 0.08)), C[3], C[2], 0.25);
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
