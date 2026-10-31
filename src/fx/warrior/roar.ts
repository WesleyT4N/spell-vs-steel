// Intimidating Roar: a deeper, redder cry: wide rings of rage roll forward, the floor shakes, and a heat flare
// bursts off the Warrior.
import { Particles, Rng, fit, hex, P, flare } from '../../vendor/pixelfx/index.js';
import { RAMPS } from '../palette';
import { ripple, dust, shock } from '../lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Intimidating Roar', desc: 'Wide rings of rage and a shaking floor.', duration: 0.6, ink: '#881400' };

export function create(o: Opts) {
  const C = fit([...RAMPS.rage], 7), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0 });
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) {
        go = true;
        for (let i = 0; i < 5; i++) ps.spawn(P.STREAK, R.range(2, 6), R.range(-21, -8), R.range(50, 80), R.range(-12, 12), R.range(0.1, 0.18), hex('#f83800'), 1, i * 0.03);
        dust(ps, R, 0, -1, 4, 10);
      }
      ps.update(dt);
    },
    draw(p: Painter) {
      if (t < 0.08) flare(p, 3, -16, 6 * (1 - t / 0.08), 0.4, ['#a81000', '#f83800', '#f8b800', '#fcfcfc']);
      for (let i = 0; i < 3; i++) ripple(p, 4 + i * 3, -15, (t - i * 0.07) / 0.35, 8 + i * 1.5, C.slice(1), 1.15, 1.5);
      shock(p, 0, 0, t / 0.35, 12, C.slice(1), 1);
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
