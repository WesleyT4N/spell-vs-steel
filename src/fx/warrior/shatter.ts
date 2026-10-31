// Ground Shatter: the enemy front column breaks apart: rage light bursts up through each panel, slabs of floor fly
// and tumble away, and dust hangs over the holes.
import { Particles, Bits, B, Rng, fit, sparkle, clamp, hex } from '../../vendor/pixelfx/index.js';
import { RAMPS } from '../palette';
import { sparks, dust, ROW, STONE } from '../lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Ground Shatter', desc: 'Light bursts up through the column as the floor breaks away.', duration: 0.7, rows: 3, ink: '#581000' };

export function create(o: Opts) {
  const C = fit([...RAMPS.rage], 7), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: ['#fcfcfc', '#fce0a8', '#f8b800', '#f83800'] });
  const bits = new Bits();
  const rows = [-ROW, 0, ROW];
  let t = 0, hit = false;
  return {
    update(dt: number) {
      t += dt;
      if (!hit) {
        hit = true;
        rows.forEach(y => {
          for (let i = 0; i < 4; i++) bits.add({ kind: B.CHUNK, x: R.range(-9, 9), y: y - 1, vx: R.range(-30, 30), vy: R.range(-110, -60), a: 0, va: R.range(-14, 14), s: R.range(1.6, 2.8), c: STONE[1], ramp: STONE, g: 0.9, life: R.range(0.35, 0.5) });
          sparks(ps, R, 0, y - 2, 4, -Math.PI / 2, 0.6, [80, 140]);
          dust(ps, R, 0, y - 1, 2, 9, '#bcbcbc');
        });
      }
      ps.update(dt); bits.update(dt);
    },
    draw(p: Painter) {
      rows.forEach(y => {
        // a split of rage light, then a beam of it up through the panel
        const k = clamp(t / 0.35);
        if (k < 1) {
          const w = 7 * (1 - k), h = 22 * Math.min(1, t / 0.05) * (1 - k * 0.5);
          p.rect(-w, y - h, w * 2, h, C[4], 0.85 * (1 - k));
          p.rect(-w, y - 3, w * 2, 3, C[6], 1 - k);
          p.rect(-w * 0.4, y - h, w * 0.8, h, C[6], 1 - k);
        }
        if (t < 0.05) sparkle(p, 0, y - 2, 5, C[5], C[4], 0.3);
        p.line(-10, y, 10, y, hex('#581000'), clamp(1 - (t - 0.4) / 0.25));
      });
      bits.draw(p); ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
