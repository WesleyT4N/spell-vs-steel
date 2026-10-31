// Throwing Knife hit: a white star where it bites, sparks thrown back, and the knife glancing off
// up and away, still spinning, gone before it lands.
import { Particles, Rng, clamp } from '../../vendor/pixelfx/index.js';
import { sparks } from '../lib';
import { STEEL, STEEL_SPARKS, glint, knife } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Throwing Knife: hit', desc: 'A star where it bites, and the knife glances away.', duration: 0.375, ink: '#000000' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: STEEL_SPARKS });
  const HX = -4, HY = -9;
  let t = 0, hit = false;
  return {
    update(dt: number) {
      t += dt;
      if (!hit) { hit = true; sparks(ps, R, HX, HY, 6, Math.PI, 0.9, [30, 60], [0.08, 0.18]); }
      ps.update(dt);
    },
    draw(p: Painter) {
      if (t < 0.09) glint(p, HX, HY, 4 * (1 - t / 0.09) + 1, STEEL[3], 0.3);
      // the glancing knife: up and back on a little arc
      const u = clamp(t / 0.3);
      if (u < 1) {
        const x = HX - 4 * u, y = HY - 10 * u + 14 * u * u;
        knife(p, x, y, -t * 30, 8, STEEL, undefined, 1 - u * u);
      }
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
