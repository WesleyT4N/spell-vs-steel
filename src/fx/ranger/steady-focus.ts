// Steady Focus: the Ranger plants their feet: four root shoots push up out of the floor round
// their feet, leaves lift, and a steel glint sparks at eye level as the aim steadies.
import { Rng, clamp, ease } from '../../vendor/pixelfx/index.js';
import type { PfxModule, Opts, Painter } from '../../game/pfx';
import { glint, bits, stepBits, drawLeaves, K } from './lib';

export const meta = { name: 'Steady Focus', desc: 'Roots creep out from the feet, a calm ring settles, the eye glints.', duration: 0.75, ink: '#503000' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ls = bits(R, 4, i => ({ x: (i < 2 ? -1 : 1) * R.range(4, 9), y: -1, vx: R.range(-6, 6), vy: -R.range(30, 45), g: 50, drag: 2, life: R.range(0.4, 0.55), c: i % 2 ? K.leaf1 : K.leaf2, v: K.leaf3 }));
  let t = 0;
  return {
    update(dt: number) { t += dt; stepBits(ls, dt); },
    draw(p: Painter) {
      const fade = 1 - clamp((t - 0.5) / 0.25);
      // sprouts: four root shoots push up out of the floor round the feet, brown at the base, a green tip
      if (fade > 0) [-10, -7, 7, 10].forEach((x, i) => {
        const h = Math.round((i % 3 ? 4 : 3) * ease.outBack(clamp((t - i * 0.03) / 0.2)));
        for (let j = 0; j < h; j++) p.dot(x + (j === h - 1 ? Math.sign(x) : 0), -j, j < h - 1 ? K.wood : K.leaf3, fade);
      });
      const g = (t - 0.18) / 0.18;
      if (g > 0 && g < 1) glint(p, 4, -18, 1 + 3 * Math.sin(g * Math.PI), K.white, K.steel);
      drawLeaves(p, ls);
    },
  };
}

export default { meta, create } satisfies PfxModule;
