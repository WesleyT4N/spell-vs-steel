// Cleave, draft B "Long sweep": one flat, wide crescent that sweeps across both panels at waist height, its
// white edge cooling to steel, with speed lines behind it and a puff of dust where it ends.
import { Particles, P, Rng, fit, clamp, ease, hex } from '../../vendor/pixelfx/index.js';
import { RAMPS } from '../palette';
import { drawSwing, tipOf, type Swing } from '../lib';
import type { PfxModule, Opts } from '../../game/pfx';

export const meta = { name: 'Cleave: Long sweep', desc: 'One flat crescent sweeps across both panels.', duration: 0.4, panels: 2, ink: '#000000' };

export function create(o: Opts) {
  const C = fit([...RAMPS.steel], 5), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: ['#fcfcfc', '#bcbcbc', '#7c7c7c'] });
  // a wide, squashed ellipse centred between the two panels, swept from behind-high to front-low
  const A: Swing = { cx: 14, cy: -11, R: 26, sy: 0.32, rot: 0.12, a0: -2.9, a1: 0.35, W: 5, t0: -0.06, sweep: 0.07, hold: 0.04, trail: 0.18, ramp: C };
  const tip = tipOf(A);
  let t = 0, done = false;
  return {
    update(dt: number) {
      t += dt;
      if (!done) {
        done = true;
        for (let i = 0; i < 6; i++) ps.spawn(P.SPARK, tip.x, tip.y, R.range(30, 90), R.range(-60, 10), R.range(0.08, 0.2));
        for (let i = 0; i < 3; i++) ps.spawn(P.DUST, tip.x - 4 + i * 3, -1, R.range(-10, 20), R.range(-12, -4), R.range(0.25, 0.4), hex('#bcbcbc'), 2);
      }
      ps.update(dt);
    },
    draw(p: unknown) {
      // speed lines trail the edge while it travels
      const u = clamp((t - A.t0) / A.sweep), e = ease.outExpo(u);
      if (t < A.t0 + A.sweep + 0.06) for (let i = 0; i < 3; i++) {
        const y = -16 + i * 4, x1 = -10 + e * 52, len = 10 + i * 3, a = 1 - clamp((t - A.t0 - A.sweep) / 0.06);
        (p as any).line(x1 - len, y, x1 - 2, y, C[2], a * 0.8);
      }
      drawSwing(p, A, t, 0.2);
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
