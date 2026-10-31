// Shadowstep: the Rogue arrives out of nowhere: a violet blink streak cuts in from behind and one diagonal shadow
// cut opens across the foe, white at its edge, shedding violet shards.
import { Particles, Rng } from '../../vendor/pixelfx/index.js';
import { sparks } from '../lib';
import { SHADOW, SHADOW_SPARKS, cut, glint, speedLines } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Shadowstep', desc: 'A blink streak and one diagonal shadow cut.', duration: 0.3, ink: '#000000' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: SHADOW_SPARKS });
  let t = 0, hit = false;
  return {
    update(dt: number) {
      t += dt;
      if (!hit) { hit = true; sparks(ps, R, 5, -6, 5, 0.6, 0.8, [30, 60], [0.08, 0.2]); }
      ps.update(dt);
    },
    draw(p: Painter) {
      if (t < 0.08) speedLines(p, -4, -12, 3, 8, SHADOW[3], 1 - t / 0.08, o.seed % 5);
      cut(p, SHADOW, -7, -20, 8, -3, t, -0.04, 3, 0.04, 0.05, 0.14);
      if (t < 0.07) glint(p, 8, -3, 3 * (1 - t / 0.07) + 1, SHADOW[3], 0.3);
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
