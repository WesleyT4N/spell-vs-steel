// Barrage (each of the 12 arrows): one heavy arrow drops straight out of the sky on a long white streak, punches
// into the panel with a glint and a ring of dust, and stands there a moment before it fades.
import { Particles, Rng, clamp } from '../../vendor/pixelfx/index.js';
import { dust, shock, DIRT } from '../lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';
import { plunge, glint, K } from './lib';

export const meta = { name: 'Barrage', desc: 'One heavy arrow drops on a long streak and punches in.', duration: 0.5, ink: '#000000' };

export function create(o: Opts) {
  const R = new Rng(o.seed), ps = new Particles({ rng: R, ground: () => 0 });
  const x = Math.round(R.range(-3, 3));
  let t = 0, go = false;
  return {
    update(dt: number) { t += dt; if (!go) { go = true; dust(ps, R, x, -1, 3, 5); } ps.update(dt); },
    draw(p: Painter) {
      // streak: a solid white line from the box top down to the arrow, shortening from the top
      const s = clamp(t / 0.12);
      if (s < 1) for (let y = -24 + Math.round(s * 12); y < -11; y++) p.dot(x, y, y > -16 ? K.white : K.steel, 1);
      plunge(p, x, 0, 0, 1 - clamp((t - 0.24) / 0.12), 11);
      if (t < 0.08) glint(p, x, -1, 4 - t * 40, K.white, K.steel);
      shock(p, x, 0, t / 0.25, 11, DIRT, 1.5);
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
