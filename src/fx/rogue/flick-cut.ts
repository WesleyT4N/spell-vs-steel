// Stab (the Rogue's light), "Flick cut": an underhand flick of the wrist: a thin rising crescent opens across the panel ahead, white
// at its edge, with a glint where it leaves the foe and a speck of steel flung off it.
import { Particles, Rng } from '../../vendor/pixelfx/index.js';
import { sparks } from '../lib';
import { STEEL, STEEL_SPARKS, crescent, glint } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Stab', desc: 'A thin rising crescent flicks across the panel ahead.', duration: 0.3, panels: 2, ink: '#000000' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: STEEL_SPARKS });
  // a circle round the foe's middle; the cut rises from low behind to high in front
  const CX = 34, CY = -10, RAD = 10, A0 = 2.3, A1 = -0.7;
  const ex = CX + Math.cos(A1) * RAD, ey = CY + Math.sin(A1) * RAD * 0.9;
  let t = 0, hit = false;
  return {
    update(dt: number) {
      t += dt;
      if (!hit) { hit = true; sparks(ps, R, ex, ey, 4, -0.7, 0.6, [50, 100], [0.06, 0.16]); }
      ps.update(dt);
    },
    draw(p: Painter) {
      crescent(p, STEEL, CX, CY, RAD, 0.9, A0, A1, t, -0.05, 3.2, 0.05, 0.03, 0.14);
      if (t < 0.09) glint(p, ex, ey, 3 * (1 - t / 0.09) + 1, STEEL[3]);
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
