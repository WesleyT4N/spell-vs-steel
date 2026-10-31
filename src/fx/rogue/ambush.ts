// Ambush: out of Stealth, a big blade: a wide violet crescent tears up through the foe with a black smear inside
// it, a white flash at the bite, and a ring of shadow snapping out over the floor.
import { Particles, Rng, ease, clamp, band } from '../../vendor/pixelfx/index.js';
import { sparks } from '../lib';
import { SHADOW, SHADOW_SPARKS, crescent, glint } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Ambush', desc: 'A wide shadow crescent tears up through the foe.', duration: 0.45, ink: '#000000' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: SHADOW_SPARKS });
  let t = 0, hit = false;
  return {
    update(dt: number) {
      t += dt;
      if (!hit) { hit = true; sparks(ps, R, 3, -14, 7, -1.2, 1, [30, 70], [0.1, 0.22]); }
      ps.update(dt);
    },
    draw(p: Painter) {
      const u = clamp(t / 0.25);
      if (u < 1) band(p, 0, 0, 3 + ease.outQuart(u) * 9, 0.22, 1.5, 1 - u, SHADOW.slice(1), () => true, u < 0.2);
      // the inner, darker echo first, then the big blade over it
      crescent(p, [SHADOW[0], SHADOW[1], SHADOW[2]], -1, -10, 9, 1, 2.0, -1.3, t, -0.05, 3, 0.05, 0.06, 0.16);
      crescent(p, SHADOW, -1, -11, 10.5, 1, 2.2, -1.4, t, -0.06, 5, 0.06, 0.07, 0.2);
      if (t < 0.09) glint(p, 3, -21, 4 * (1 - t / 0.09) + 1, SHADOW[3], 0.35);
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
