// Blade Flurry (one per panel per sweep): a flat shadow sweep cuts across the panel at a slant of its own, thin and
// fast, shedding two violet sparks. Three sweeps over three panels read as a storm of blades.
import { Particles, Rng } from '../../vendor/pixelfx/index.js';
import { sparks } from '../lib';
import { SHADOW, SHADOW_SPARKS, cut } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Blade Flurry', desc: 'A flat shadow sweep at its own slant.', duration: 0.3, ink: '#000000' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: SHADOW_SPARKS });
  const back = R.chance(0.5), y0 = R.range(-18, -6), y1 = y0 + R.range(-6, 6);
  const [ax, bx] = back ? [9, -9] : [-9, 9];
  let t = 0, hit = false;
  return {
    update(dt: number) {
      t += dt;
      if (!hit) { hit = true; sparks(ps, R, bx, y1, 2, back ? Math.PI : 0, 0.6, [25, 50], [0.06, 0.14]); }
      ps.update(dt);
    },
    draw(p: Painter) {
      cut(p, SHADOW, ax, y0, bx, y1, t, -0.03, 2.2, 0.03, 0.04, 0.12);
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
