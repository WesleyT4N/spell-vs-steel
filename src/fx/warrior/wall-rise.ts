// Shield Wall: the wall heaves up out of the floor: stone chunks and dust burst out round its foot.
import { Particles, Bits, Rng, sparkle, hex } from '../../vendor/pixelfx/index.js';
import { chunks, dust, shock, STONE } from '../lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Shield Wall', desc: 'Stone and dust burst round the rising wall.', duration: 0.45, ink: '#000000' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0 });
  const bits = new Bits({ ground: () => 0 });
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) { go = true; chunks(bits, R, 0, -1, 5, 9, [50, 90], STONE); dust(ps, R, 0, -1, 4, 10, '#bcbcbc'); }
      ps.update(dt); bits.update(dt);
    },
    draw(p: Painter) {
      shock(p, 0, 0, t / 0.25, 12, STONE);
      if (t < 0.05) sparkle(p, 0, -20, 3, hex('#fcfcfc'), hex('#bcbcbc'), 0.2);
      bits.draw(p); ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
