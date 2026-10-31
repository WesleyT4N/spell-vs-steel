// Fan of Knives (one per panel of the front column): a knife whips in from the Rogue's side and thunks into the
// panel at a slight angle, with a glint and a chip of sparks; each panel's knife sits at its own height and tilt.
import { Particles, Rng, clamp } from '../../vendor/pixelfx/index.js';
import { sparks } from '../lib';
import { STEEL, STEEL_SPARKS, glint, knife, speedLines } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Fan of Knives', desc: 'A knife whips in and thunks into each panel.', duration: 0.375, ink: '#000000' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: STEEL_SPARKS });
  const Y = R.range(-15, -8), TILT = R.range(-0.25, 0.25);
  let t = 0, hit = false;
  return {
    update(dt: number) {
      t += dt;
      if (!hit) { hit = true; sparks(ps, R, 0, Y, 4, Math.PI + TILT, 0.8, [25, 50], [0.06, 0.14]); }
      ps.update(dt);
    },
    draw(p: Painter) {
      const fade = clamp((t - 0.2) / 0.12);
      if (fade < 1) knife(p, -4, Y - TILT * 4, TILT, 10, STEEL, undefined, 1 - fade);
      if (t < 0.06) speedLines(p, -9, Y, 2, 4, STEEL[3], 1 - t / 0.06, o.seed % 5);
      if (t < 0.07) glint(p, 1, Y, 3 * (1 - t / 0.07) + 1, STEEL[3], 0.25);
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
