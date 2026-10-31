// Eviscerate: the finisher: two shadow cuts cross in an X, then a deep crimson gut-slash rips straight across
// them with a white core; the wound flares violet and bleeds dark drops.
import { Particles, Rng, hex, flare } from '../../vendor/pixelfx/index.js';
import { sparks } from '../lib';
import { SHADOW, SHADOW_SPARKS, Drops, cut } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Eviscerate', desc: 'A shadow X, then a deep crimson slash across it.', duration: 0.5, ink: '#000000' };

/** Wound red under a white edge. */
const GUT = ['#000000', '#881400', '#a80020', '#e40058', '#f85898'].map(hex);

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: SHADOW_SPARKS });
  const drops = new Drops();
  const SLASH = 0.07;
  let t = 0, a = false, b = false;
  return {
    update(dt: number) {
      t += dt;
      if (!a) { a = true; sparks(ps, R, 0, -12, 5, -Math.PI / 2, 1.2, [20, 45]); }
      if (!b && t >= SLASH) {
        b = true;
        sparks(ps, R, 6, -11, 4, 0.6, 0.6, [20, 40]);
        for (let i = 0; i < 6; i++) drops.add(R.range(-6, 6), -11 + R.range(-1, 1), R.range(-15, 15), R.range(-50, -10), GUT[R.int(1, 3)], 0.5);
      }
      ps.update(dt); drops.update(dt);
    },
    draw(p: Painter) {
      cut(p, SHADOW, -8, -20, 7, -3, t, -0.05, 2.5, 0.03, 0.04, 0.14);
      cut(p, SHADOW, -8, -3, 7, -20, t, -0.02, 2.5, 0.03, 0.04, 0.14);
      cut(p, GUT, -9, -12, 9, -10, t, SLASH - 0.03, 4, 0.03, 0.08, 0.18);
      const f = (t - SLASH) / 0.1;
      if (f > 0 && f < 1) flare(p, 0, -11, 5 * (1 - f), 0.3, ['#4428bc', '#9878f8', '#d8b8f8']);
      drops.draw(p); ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
