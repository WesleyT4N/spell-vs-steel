// Hawk Strike hit: the talons rake: three gold-and-white slashes tear down across the target and a puff of brown
// and gold feathers bursts off it.
import { Rng, clamp } from '../../vendor/pixelfx/index.js';
import type { PfxModule, Opts, Painter } from '../../game/pfx';
import { bits, stepBits, drawFeathers, rakes, K } from './lib';

export const meta = { name: 'Hawk Strike hit', desc: 'Three talon rakes and a burst of feathers.', duration: 0.45, ink: '#503000' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const fs = bits(R, 6, i => { const a = -Math.PI / 2 + (i - 2.5) * 0.6; return { x: -2, y: -13, vx: Math.cos(a) * R.range(25, 45), vy: Math.sin(a) * R.range(20, 40), g: 35, drag: 3, life: R.range(0.3, 0.42), c: i % 2 ? K.straw : K.wood, v: K.bark }; });
  let t = 0;
  return {
    update(dt: number) { t += dt; stepBits(fs, dt); },
    draw(p: Painter) {
      rakes(p, 3, clamp((t + 0.04) / 0.07), clamp((t - 0.14) / 0.14), K.white, K.gold, -9, -21, 12);
      drawFeathers(p, fs);
    },
  };
}

export default { meta, create } satisfies PfxModule;
