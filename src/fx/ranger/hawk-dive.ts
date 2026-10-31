// Hawk dive (the companion hawk's strike: Bestial Wrath, Kill Command): a gold streak stoops in from high behind the
// target, three talon rakes land on the hit frame and gold feathers drift off.
import { Rng, clamp } from '../../vendor/pixelfx/index.js';
import type { PfxModule, Opts, Painter } from '../../game/pfx';
import { bits, stepBits, drawFeathers, rakes, K } from './lib';

export const meta = { name: 'Hawk dive', desc: 'A gold stoop streak, talon rakes and drifting feathers.', duration: 0.44, ink: '#503000' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const fs = bits(R, 4, i => ({ x: R.range(-6, 4), y: -R.range(12, 20), vx: R.range(-15, 15), vy: -R.range(5, 15), g: 25, drag: 3, life: R.range(0.32, 0.44), c: i % 2 ? K.straw : K.wood, v: K.bark }));
  let t = 0;
  return {
    update(dt: number) { t += dt; stepBits(fs, dt); },
    draw(p: Painter) {
      // the stoop: a diagonal streak from the box's top back corner down to the strike, erasing from the top
      const s = clamp(t / 0.12);
      if (s < 1) for (let j = Math.round(s * 10); j < 10; j++) { p.dot(-11 + j, -24 + j * 1.2, j > 6 ? K.white : K.straw); p.dot(-10 + j, -24 + j * 1.2, K.gold); }
      rakes(p, 3, clamp((t + 0.03) / 0.06), clamp((t - 0.14) / 0.14), K.white, K.gold, -7, -17, 9);
      drawFeathers(p, fs);
    },
  };
}

export default { meta, create } satisfies PfxModule;
