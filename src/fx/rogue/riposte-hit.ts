// Riposte counter (on the attacker, wherever they are): a single straight lunge-cut lands through them from the
// Rogue's side, a white point of light and a spray of steel sparks.
import { Particles, Rng } from '../../vendor/pixelfx/index.js';
import { sparks } from '../lib';
import { STEEL, STEEL_SPARKS, cut, glint } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Riposte: counter', desc: 'A straight counter-cut through the attacker.', duration: 0.3, ink: '#000000' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: STEEL_SPARKS });
  let t = 0, hit = false;
  return {
    update(dt: number) {
      t += dt;
      if (!hit) { hit = true; sparks(ps, R, 6, -12, 5, 0, 0.7, [30, 60]); }
      ps.update(dt);
    },
    draw(p: Painter) {
      cut(p, STEEL, -9, -10, 6, -13, t, -0.03, 2.5, 0.03, 0.05, 0.13);
      if (t < 0.08) glint(p, 6, -13, 4 * (1 - t / 0.08) + 1, STEEL[3], 0.3);
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
