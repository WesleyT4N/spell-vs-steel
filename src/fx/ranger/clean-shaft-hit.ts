// Arrow (light) hit, draft A: a sharp steel glint where the arrow strikes and a few splinters thrown back.
import { Particles, Rng, clamp } from '../../vendor/pixelfx/index.js';
import type { PfxModule, Opts, Painter } from '../../game/pfx';
import { glint, splinters, K, STEEL_SPARKS } from './lib';

export const meta = { name: 'Clean shaft hit', desc: 'A steel glint and splinters.', duration: 0.35, ink: '#000000' };

export function create(o: Opts) {
  const R = new Rng(o.seed), ps = new Particles({ rng: R, ground: () => 0, sparks: STEEL_SPARKS });
  let t = 0, go = false;
  return {
    update(dt: number) { t += dt; if (!go) { go = true; splinters(ps, R, -3, -11, 4, Math.PI, 0.9); } ps.update(dt); },
    draw(p: Painter) {
      const k = 1 - clamp(t / 0.12);
      if (k > 0) glint(p, -3, -11, 1 + 4 * k, K.white, K.steel);
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
