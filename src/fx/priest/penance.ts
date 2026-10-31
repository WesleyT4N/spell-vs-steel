// Penance: each bolt is a gold lance of light that dives out of the sky onto the enemy's chest, from high behind
// them or high in front (it alternates by seed), bursting in a small star. Fx kind 'penanceBolt'.
import { Particles, Rng, clamp, sparkle } from '../../vendor/pixelfx/index.js';
import { sparks } from '../lib';
import { GOLD, WHITE } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Penance', desc: 'A gold lance dives from the sky onto the chest and bursts.', duration: 0.44, ink: '#503000' };

export function create(o: Opts) {
  const G = GOLD(), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: ['#fcfcfc', '#f8d878', '#f8b800', '#ac7c00'] });
  // where it comes from: one of three high points along the top of the box
  const sx = [-10, 9, -3][o.seed % 3], sy = -24, ex = 0, ey = -11;
  const dx = ex - sx, dy = ey - sy;
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) { go = true; sparks(ps, R, ex, ey, 5, Math.atan2(dy, dx), 1.1, [40, 90], [0.08, 0.18]); }
      ps.update(dt);
    },
    draw(p: Painter) {
      // the lance has arrived on the hit frame: its tail pulls in after it
      const tail = clamp(t / 0.14);
      if (tail < 1) {
        const x0 = sx + dx * tail, y0 = sy + dy * tail;
        p.beam(x0, y0, ex, ey, t < 0.04 ? 3 : 2, (u: number) => (u > 0.8 ? WHITE : u > 0.4 ? G[4] : G[3]));
        p.line(x0, y0, ex, ey, (u: number) => (u > 0.5 ? WHITE : G[4]));
      }
      const s = clamp(t / 0.16);
      if (s < 1) sparkle(p, ex, ey, 4 * (1 - s) + 1, s < 0.3 ? G[5] : G[4], G[3], 0.3);
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
