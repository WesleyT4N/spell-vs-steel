// Call of the Wild (over the Ranger's back column, all three rows, where the wolves stand): a pale crescent moon
// hangs over the top row while howls ring out forward on each row, green rings rolling off, with leaves lifting.
import { Rng, clamp, ease } from '../../vendor/pixelfx/index.js';
import type { PfxModule, Opts, Painter } from '../../game/pfx';
import { ROW } from '../lib';
import { bits, stepBits, drawLeaves, K } from './lib';

export const meta = { name: 'Call of the Wild', desc: 'A crescent moon and a howl rolling off every row.', duration: 1, rows: 3, ink: '#006800' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ls = bits(R, 6, i => ({ x: R.range(-7, 7), y: (i % 3 - 1) * ROW - 1, vx: R.range(-5, 5), vy: -R.range(25, 40), g: 25, drag: 2, life: R.range(0.45, 0.6), c: i % 2 ? K.leaf1 : K.leaf2, v: K.leaf3 }));
  for (const l of ls) l.t = -R.range(0, 0.3);
  let t = 0;
  return {
    update(dt: number) { t += dt; stepBits(ls, dt); },
    draw(p: Painter) {
      // the moon: a crescent cut from a disc, rising a little and fading
      const m = ease.outCubic(clamp(t / 0.25)), mo = 1 - clamp((t - 0.7) / 0.3);
      if (mo > 0) {
        const my = -ROW - 18 + Math.round((1 - m) * 4);
        p.shade(-6, my - 5, 6, my + 5, (x: number, y: number, out: { c: number; a: number }) => {
          const a = Math.hypot(x + 1, y - my), b = Math.hypot(x + 3, y - my + 1);
          if (a > 5 || b < 4.2) return;
          out.c = a > 4 ? K.straw : K.cream; out.a = m * mo;
        });
      }
      // howls: two forward arcs per row, staggered by row
      for (const row of [-1, 0, 1]) for (let i = 0; i < 2; i++) {
        const u = clamp((t - 0.1 - (row + 1) * 0.07 - i * 0.12) / 0.35);
        if (u > 0 && u < 1) p.arc(2, row * ROW - 10, 3 + u * 6, u < 0.4 ? 2 : 1, -0.8, 0.8, u < 0.3 ? K.leaf3 : K.leaf2, 1 - u * 0.6);
      }
      drawLeaves(p, ls);
    },
  };
}

export default { meta, create } satisfies PfxModule;
