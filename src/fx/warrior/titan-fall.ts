// Titan's Fall: every enemy panel takes the landing at once: a white strike from above, a gold shock ring, chunks
// and dust, and the crack it leaves.
import { Particles, Bits, Rng, fit, sparkle, clamp, hex } from '../../vendor/pixelfx/index.js';
import { RAMPS } from '../palette';
import { sparks, chunks, dust, shock, crack } from '../lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: "Titan's Fall", desc: 'A strike from above and a gold shock on every enemy panel.', duration: 0.55, ink: '#503000' };

export function create(o: Opts) {
  const C = fit([...RAMPS.rage], 7), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: ['#fcfcfc', '#fce0a8', '#f8b800', '#f83800'] });
  const bits = new Bits({ ground: () => 0 });
  let t = 0, hit = false;
  return {
    update(dt: number) {
      t += dt;
      if (!hit) { hit = true; chunks(bits, R, 0, -1, 3); dust(ps, R, 0, -1, 2); sparks(ps, R, 0, -2, 4, -Math.PI / 2, 1.2, [50, 110]); }
      ps.update(dt); bits.update(dt);
    },
    draw(p: Painter) {
      if (t < 0.07) p.beam(0, -24, 0, -2, 5 * (1 - t / 0.07) + 1, (_u: number, v: number) => (v < 0.4 ? C[6] : C[5]));
      if (t < 0.06) sparkle(p, 0, -3, 6, C[5], C[4], 0.35);
      shock(p, 0, 0, t / 0.3, 12, C.slice(2));
      crack(p, 0, 0, 14, o.seed, hex('#503000'), clamp(1 - (t - 0.35) / 0.2));
      bits.draw(p); ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
