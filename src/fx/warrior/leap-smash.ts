// Leap Strike: the Warrior lands sword first: a streak drops from above onto the middle panel, a gold flash, and
// shock rings burst on all three panels of the column with chunks and dust.
import { Particles, Bits, Rng, fit, sparkle, clamp, hex } from '../../vendor/pixelfx/index.js';
import { RAMPS } from '../palette';
import { sparks, chunks, dust, shock, crack, ROW } from '../lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Leap Strike', desc: 'A landing smash rings out over the whole column.', duration: 0.5, rows: 3, ink: '#503000' };

export function create(o: Opts) {
  const C = fit([...RAMPS.rage], 7), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: ['#fcfcfc', '#fce0a8', '#f8b800', '#f83800'] });
  const bits = new Bits({ ground: () => 0 });
  const rows = [-ROW, 0, ROW];
  let t = 0, hit = false;
  return {
    update(dt: number) {
      t += dt;
      if (!hit) {
        hit = true;
        sparks(ps, R, 0, -2, 8, -Math.PI / 2, 1.3, [60, 130]);
        rows.forEach((y, i) => { chunks(bits, R, 0, y - 1, i === 1 ? 4 : 2); dust(ps, R, 0, y - 1, 2); });
      }
      ps.update(dt); bits.update(dt);
    },
    draw(p: Painter) {
      if (t < 0.06) p.beam(0, -40, 0, -4, 4 * (1 - t / 0.06) + 1, (_u: number, v: number) => (v < 0.4 ? C[6] : C[4]));
      if (t < 0.07) sparkle(p, 0, -6, 7 * (1 - t / 0.07), C[5], C[4], 0.35);
      rows.forEach((y, i) => {
        shock(p, 0, y, (t - Math.abs(i - 1) * 0.04) / 0.28, i === 1 ? 14 : 11, C.slice(2));
        crack(p, 0, y, 10, o.seed + i, hex('#503000'), clamp(1 - (t - 0.3) / 0.2));
      });
      bits.draw(p); ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
