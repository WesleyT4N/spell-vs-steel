// Step Slash: the Warrior dashes in and one long flat cut runs across both panels ahead, speed lines trailing
// from where they came from, a glint on each panel.
import { Particles, Rng, fit, sparkle, clamp, ease, hex, P } from '../../vendor/pixelfx/index.js';
import { RAMPS } from '../palette';
import { drawSwing, sparks, type Swing } from '../lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Step Slash', desc: 'A long flat cut across both panels with dash lines.', duration: 0.35, panels: 2, ink: '#000000' };

export function create(o: Opts) {
  const C = fit([...RAMPS.steel], 5), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: ['#fcfcfc', '#fce0a8', '#bcbcbc', '#7c7c7c'] });
  const A: Swing = { cx: 19, cy: -11, R: 30, sy: 0.36, rot: 0, a0: -3.0, a1: 0.25, W: 7, t0: -0.05, sweep: 0.05, hold: 0.05, trail: 0.16, ramp: C };
  let t = 0, hit = false;
  return {
    update(dt: number) {
      t += dt;
      if (!hit) {
        hit = true;
        sparks(ps, R, 12, -10, 4, 0, 0.6);
        sparks(ps, R, 44, -10, 4, 0, 0.6);
        for (let i = 0; i < 4; i++) ps.spawn(P.STREAK, R.range(-10, 4), R.range(-20, -4), R.range(-60, -30), 0, R.range(0.08, 0.14), hex('#bcbcbc'));
      }
      ps.update(dt);
    },
    draw(p: Painter) {
      drawSwing(p, A, t, 0.2);
      for (const [x, d] of [[12, 0], [40, 0.03]]) {
        const g = t - d;
        if (g >= 0 && g < 0.12) sparkle(p, x, -12, 4 * ease.outBack(clamp(g / 0.03)) * (1 - g / 0.12), C[3], C[2], 0.3);
      }
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
