// Last Stand's release: the damage the Warrior soaked up comes back as a crimson wave rolling through the enemy
// front column, a crescent the height of the column with rings bursting off each panel.
import { Particles, Rng, fit, sparkle, clamp } from '../../vendor/pixelfx/index.js';
import { drawSwing, sparks, shock, ROW, type Swing } from '../lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Last Stand: release', desc: 'A crimson wave the height of the column.', duration: 0.6, rows: 3, ink: '#000000' };

const CRIMSON = ['#000000', '#881400', '#a81000', '#f83800', '#fca044', '#fce0a8', '#fcfcfc'];

export function create(o: Opts) {
  const C = fit(CRIMSON, 7), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: ['#fcfcfc', '#fca044', '#f83800', '#881400'] });
  const A: Swing = { cx: -24, cy: -11, R: 34, sy: 1, rot: 0, a0: -1.05, a1: 1.05, W: 9, t0: -0.02, sweep: 0.1, hold: 0.08, trail: 0.25, ramp: C };
  let t = 0, hit = false;
  return {
    update(dt: number) {
      t += dt;
      if (!hit) { hit = true; for (const y of [-ROW, 0, ROW]) sparks(ps, R, 6, y - 8, 4, 0, 1.0, [60, 120]); }
      ps.update(dt);
    },
    draw(p: Painter) {
      drawSwing(p, A, t, 0.3);
      for (const y of [-ROW, 0, ROW]) {
        shock(p, 0, y, (t - 0.06) / 0.3, 12, C.slice(2));
        if (t > 0.06 && t < 0.12) sparkle(p, 4, y - 10, 5 * (1 - clamp((t - 0.06) / 0.06)), C[5], C[4], 0.3);
      }
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
