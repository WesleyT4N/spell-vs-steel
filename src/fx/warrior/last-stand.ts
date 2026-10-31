// Last Stand: the Warrior refuses to fall: a dark crimson column wraps them, blood-red embers rise, and a red flare
// bursts at the top.
import { Particles, Rng, fit, flare, P } from '../../vendor/pixelfx/index.js';
import { column } from '../lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Last Stand', desc: 'A dark crimson column with rising embers.', duration: 0.8, ink: '#000000' };

const DEFIANT = ['#000000', '#881400', '#a81000', '#f83800', '#fca044', '#fce0a8'];

export function create(o: Opts) {
  const C = fit(DEFIANT, 6), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: ['#fce0a8', '#f83800', '#a81000', '#881400'] });
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) { go = true; for (let i = 0; i < 10; i++) ps.spawn(P.EMBER, R.range(-9, 9), R.range(-4, 0), R.range(-8, 8), R.range(-50, -25), R.range(0.35, 0.55), 0, R.range(1, 2), R.range(0, 0.3)); }
      ps.update(dt);
    },
    draw(p: Painter) {
      column(p, t / 0.6, 10, C);
      const f = (t - 0.25) / 0.15;
      if (f > 0 && f < 1) flare(p, 0, -14, 8 * (1 - f), 0.4, DEFIANT.slice(1));
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
