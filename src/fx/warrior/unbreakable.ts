// Unbreakable: a gold hexagon of force snaps shut around the Warrior, pulses once, and settles into their barrier.
import { Rng, fit, sparkle, clamp, ease, ngon } from '../../vendor/pixelfx/index.js';
import { RAMPS } from '../palette';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Unbreakable', desc: 'A gold hexagon of force snaps shut.', duration: 0.6, ink: '#503000' };

export function create(o: Opts) {
  const G = fit([...RAMPS.holy], 6);
  void new Rng(o.seed);
  let t = 0;
  return {
    update(dt: number) { t += dt; },
    draw(p: Painter) {
      const k = ease.outBack(clamp(t / 0.12)), fade = clamp((t - 0.3) / 0.3);
      if (fade >= 1) return;
      const r = 3 + 9 * k, pts = ngon(0, -11, r, 6, Math.PI / 6).map(([x, y]: number[]) => [x, -11 + (y + 11) * 1.05]);
      for (let i = 0; i < 6; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % 6];
        p.beam(x0, y0, x1, y1, 2, t < 0.06 ? G[5] : G[3], 1 - fade);
      }
      if (t > 0.1 && t < 0.25) for (const [x, y] of pts) sparkle(p, x, y, 2, G[4], G[3], 0.2);
    },
  };
}

export default { meta, create } satisfies PfxModule;
