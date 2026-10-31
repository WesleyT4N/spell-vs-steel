// Kill Shot (the hit, on the target wherever they are): the arrow has already arrived: a white streak ending in
// the target, a huge white cross flash, a red ring blown open round them and steel shards.
import { Particles, Rng, clamp } from '../../vendor/pixelfx/index.js';
import type { PfxModule, Opts, Painter } from '../../game/pfx';
import { glint, splinters, K, STEEL_SPARKS } from './lib';
import { sparks } from '../lib';

export const meta = { name: 'Kill Shot', desc: 'A white streak into the target, a cross flash and a red ring.', duration: 0.44, ink: '#000000' };

export function create(o: Opts) {
  const R = new Rng(o.seed), ps = new Particles({ rng: R, ground: () => 0, sparks: STEEL_SPARKS });
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) { go = true; sparks(ps, R, 0, -12, 8, 0, 1.4, [70, 130]); splinters(ps, R, -2, -12, 5, Math.PI, 1); }
      ps.update(dt);
    },
    draw(p: Painter) {
      // the streak in from behind, gone in a few frames
      const s = clamp(t / 0.1);
      if (s < 1) { p.rect(-12, -13, Math.round(12 * (1 - s)) + 1, 2, K.white); p.rect(-12, -11, Math.round(10 * (1 - s)), 1, K.steel); }
      const k = 1 - clamp(t / 0.18);
      if (k > 0) { glint(p, 0, -12, 3 + 8 * k, K.white, K.steel); if (t < 0.05) p.rect(-2, -14, 5, 5, K.white); }
      // the red ring blown open
      const u = clamp((t - 0.02) / 0.3);
      if (u > 0 && u < 1) p.ring(0, -12, 3 + u * 8, u < 0.4 ? 2 : 1, u < 0.3 ? K.red2 : K.red1, 1 - u * 0.6);
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
