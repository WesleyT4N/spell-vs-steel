// Berserk: rage boils over: a red heat column flickers up the Warrior, embers stream off them, and their eyes flash.
import { Particles, Rng, fit, sparkle, P } from '../../vendor/pixelfx/index.js';
import { RAMPS } from '../palette';
import { column } from '../lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Berserk', desc: 'A red heat column with streaming embers.', duration: 0.6, ink: '#881400' };

export function create(o: Opts) {
  const C = fit([...RAMPS.rage], 7), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: ['#fcfcfc', '#f8b800', '#f83800', '#a81000'] });
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) { go = true; for (let i = 0; i < 10; i++) ps.spawn(P.EMBER, R.range(-8, 8), R.range(-6, 0), R.range(-10, 10), R.range(-60, -30), R.range(0.3, 0.5), 0, R.range(1, 2), R.range(0, 0.2)); }
      ps.update(dt);
    },
    draw(p: Painter) {
      column(p, t / 0.45, 8, C.slice(0, 6));
      if (t > 0.08 && t < 0.2) sparkle(p, 3, -19, 3, C[5], C[4], 0.3);
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
