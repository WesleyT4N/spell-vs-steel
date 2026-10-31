// Killing Spree (one per strike, five in a row): the Rogue's blink streak whips in and a cut lands at a new angle
// each time (from the seed), with a white spark at its end, so the five read as a frenzy from every side.
import { Particles, Rng } from '../../vendor/pixelfx/index.js';
import { sparks } from '../lib';
import { SHADOW, SHADOW_SPARKS, cut, glint, speedLines } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Killing Spree', desc: 'A blink streak and a cut at a new angle each strike.', duration: 0.3, ink: '#000000' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: SHADOW_SPARKS });
  const a = R.range(0, Math.PI * 2), L = 8, cy = -12;
  const x0 = -Math.cos(a) * L, y0 = cy - Math.sin(a) * L * 0.9, x1 = Math.cos(a) * L, y1 = cy + Math.sin(a) * L * 0.9;
  let t = 0, hit = false;
  return {
    update(dt: number) {
      t += dt;
      if (!hit) { hit = true; sparks(ps, R, x1, y1, 4, a, 0.7, [30, 60]); }
      ps.update(dt);
    },
    draw(p: Painter) {
      if (t < 0.06) speedLines(p, -6, cy, 3, 6, SHADOW[3], 1 - t / 0.06, o.seed % 7);
      cut(p, SHADOW, x0, y0, x1, y1, t, -0.03, 3, 0.03, 0.04, 0.12);
      if (t < 0.06) glint(p, x1, y1, 3 * (1 - t / 0.06) + 1, SHADOW[3], 0.3);
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
