// Holy Spark hit (the light landing): the star bursts on the target, white then gold, a ring of light rolls out and gold motes
// float up. Plays for 'sparkHit', added where the spark lands.
import { Particles, Rng, P, hex, sparkle, clamp } from '../../vendor/pixelfx/index.js';
import { ripple } from '../lib';
import { GOLD } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Holy Spark: hit', desc: 'A star burst, a ring of light and rising motes.', duration: 0.375, ink: '#503000' };

export function create(o: Opts) {
  const G = GOLD(), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0 });
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) {
        go = true;
        for (let i = 0; i < 4; i++) ps.spawn(P.MOTE, R.range(-6, 4), R.range(-15, -8), R.range(-6, 6), R.range(-40, -22), R.range(0.2, 0.3), hex(i % 2 ? '#f8d878' : '#f8b800'), 1, R.range(0, 0.06));
      }
      ps.update(dt);
    },
    draw(p: Painter) {
      const k = clamp(t / 0.12);
      if (k < 1) sparkle(p, -3, -11, 5 * (1 - k) + 1, k < 0.4 ? G[5] : G[3], G[2], 0.3);
      ripple(p, -3, -11, t / 0.28, 9, G.slice(2), 0.9, 1);
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
