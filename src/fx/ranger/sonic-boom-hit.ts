// Aimed Shot (heavy) hit, draft A: a big white cross flash, a ring of force rolling off the target and splinters.
import { Particles, Rng, clamp } from '../../vendor/pixelfx/index.js';
import type { PfxModule, Opts, Painter } from '../../game/pfx';
import { glint, pixRing, splinters, K, STEEL_SPARKS } from './lib';
import { sparks } from '../lib';

export const meta = { name: 'Sonic boom hit', desc: 'A white cross flash, a ring of force and splinters.', duration: 0.45, ink: '#000000' };

export function create(o: Opts) {
  const R = new Rng(o.seed), ps = new Particles({ rng: R, ground: () => 0, sparks: STEEL_SPARKS });
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) { go = true; splinters(ps, R, -3, -11, 6, Math.PI, 1.1); sparks(ps, R, -2, -11, 4, 0, 0.8, [60, 110]); }
      ps.update(dt);
    },
    draw(p: Painter) {
      const k = 1 - clamp(t / 0.14);
      if (k > 0) { glint(p, -3, -11, 2 + 6 * k, K.white, K.steel); if (t < 0.04) p.rect(-5, -13, 5, 5, K.white); }
      const u = clamp((t - 0.02) / 0.25);
      if (u > 0 && u < 1) pixRing(p, -3, -11, 3 + u * 8, 3 + u * 7, u < 0.3 ? K.white : u < 0.6 ? K.steel : K.iron, 0, 1 - u * 0.7);
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
