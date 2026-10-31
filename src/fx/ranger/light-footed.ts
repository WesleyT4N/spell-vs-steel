// Light Footed: a green breeze curls up round the Ranger's feet, lifting leaves, and little feather tufts flick out
// at the heels.
import { Rng, clamp } from '../../vendor/pixelfx/index.js';
import type { PfxModule, Opts, Painter } from '../../game/pfx';
import { bits, stepBits, drawLeaves, feather, K } from './lib';

export const meta = { name: 'Light Footed', desc: 'A green breeze curls round the feet, lifting leaves.', duration: 0.75, ink: '#3c3c3c' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ls = bits(R, 5, i => ({ x: R.range(-9, 9), y: -1, vx: R.range(-10, 10), vy: -R.range(25, 40), g: 20, drag: 1.5, life: R.range(0.45, 0.6), c: i % 2 ? K.leaf1 : K.leaf2, v: K.leaf3 }));
  let t = 0;
  return {
    update(dt: number) { t += dt; stepBits(ls, dt); },
    draw(p: Painter) {
      // the breeze: a band spiralling up from the floor, front half bright, back half dark
      const u = clamp(t / 0.55);
      if (u < 1) for (let k = 0; k < 24; k++) {
        const a = t * 14 + k * 0.26, y = -1 - k * 0.45 - u * 6, front = Math.sin(a) > 0;
        p.dot(Math.cos(a) * (9 - k * 0.15), y + Math.sin(a) * 2, front ? K.white : K.leaf3, (1 - u) * (1 - k / 26));
      }
      // heel tufts
      const f = clamp((t - 0.05) / 0.3);
      if (f > 0 && f < 1) for (const s of [-1, 1]) feather(p, s * (5 + f * 3), -2 - f * 2, s, K.white, K.leaf2);
      drawLeaves(p, ls);
    },
  };
}

export default { meta, create } satisfies PfxModule;
