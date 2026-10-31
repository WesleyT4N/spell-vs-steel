// Heavy Cleave, draft C "Rage arc": two stacked crescents, red under gold, cleave through both panels in one big
// swing; embers peel off the arc and a hot X flares on the second panel where the swing ends.
import { Particles, P, Rng, fit, flare, clamp, hex } from '../../vendor/pixelfx/index.js';
import { RAMPS } from '../palette';
import { drawSwing, type Swing } from '../lib';
import type { PfxModule, Opts } from '../../game/pfx';

export const meta = { name: 'Heavy Cleave: Rage arc', desc: 'A double crescent through both panels, ending in a hot flare.', duration: 0.7, panels: 2, ink: '#581000' };

export function create(o: Opts) {
  const C = fit([...RAMPS.rage], 7), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: ['#fcfcfc', '#fce0a8', '#f8b800', '#f83800'] });
  const red = [hex('#000000'), hex('#881400'), hex('#a81000'), hex('#f83800'), hex('#fca044')];
  const A: Swing = { cx: 16, cy: -10, R: 22, sy: 0.45, rot: 0.25, a0: -2.8, a1: 0.45, W: 7, t0: -0.08, sweep: 0.09, hold: 0.06, trail: 0.22, ramp: C };
  const Bk: Swing = { ...A, R: 19, W: 5, t0: -0.06, ramp: red };
  const END = { x: 38, y: -9 };
  let t = 0, burst = false;
  return {
    update(dt: number) {
      t += dt;
      if (!burst) {
        burst = true;
        for (let i = 0; i < 9; i++) ps.spawn(P.SPARK, END.x, END.y, R.range(-60, 90), R.range(-90, 40), R.range(0.1, 0.28));
        for (let i = 0; i < 5; i++) ps.spawn(P.EMBER, R.range(0, 40), R.range(-18, -6), R.range(-8, 8), R.range(-30, -12), R.range(0.3, 0.5), C[R.int(3, 5)]);
      }
      ps.update(dt);
    },
    draw(p: any) {
      drawSwing(p, Bk, t, 0);
      drawSwing(p, A, t, 0.3);
      const u = t;
      if (u >= 0 && u < 0.12) flare(p, END.x, END.y, 7 * (1 - u / 0.12), 0.5, [...RAMPS.rage]);
      if (u >= 0 && u < 0.16) p.glow(END.x, END.y, 10, C[4], 0.5 * (1 - clamp(u / 0.16)));
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
