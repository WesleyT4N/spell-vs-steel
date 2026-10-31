// Adrenaline Rush: the Rogue's pulse spikes: two gold heartbeat rings thump out from their chest, a jagged pulse
// line kicks across them, and gold speed streaks shoot up either side.
import { Rng, clamp } from '../../vendor/pixelfx/index.js';
import { RAMPS } from '../palette';
import { ripple } from '../lib';
import { fit } from '../../vendor/pixelfx/index.js';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Adrenaline Rush', desc: 'Gold heartbeat rings, a pulse line and rising streaks.', duration: 0.5, ink: '#503000' };

export function create(o: Opts) {
  const C = fit([...RAMPS.holy], 6), R = new Rng(o.seed);
  const streaks = Array.from({ length: 4 }, (_, i) => ({ x: (i % 2 ? 1 : -1) * (8 + (i >> 1) * 2), d: i * 0.04 + R.range(0, 0.03) }));
  let t = 0;
  return {
    update(dt: number) { t += dt; },
    draw(p: Painter) {
      ripple(p, 0, -13, t / 0.2, 9, C.slice(2), 1, 1);
      ripple(p, 0, -13, (t - 0.16) / 0.2, 10, C.slice(2), 1, 1);
      // the pulse line: flat, a sharp spike, flat again, drawn left to right
      const u = clamp(t / 0.14), fade = clamp((t - 0.22) / 0.14);
      if (fade < 1) {
        const pts: Array<[number, number]> = [[-11, -12], [-4, -12], [-2, -18], [1, -7], [3, -12], [11, -12]];
        const end = -11 + 22 * u;
        for (let i = 1; i < pts.length; i++) {
          const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
          if (x0 >= end) break;
          const k = Math.min(1, (end - x0) / (x1 - x0));
          p.line(x0, y0, x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, fade < 0.4 ? C[5] : C[3]);
        }
      }
      for (const s of streaks) {
        const q = (t - s.d) / 0.22;
        if (q <= 0 || q >= 1) continue;
        const y = -2 - q * 20;
        p.line(s.x, y + 5, s.x, y, q < 0.5 ? C[4] : C[3]);
        p.px(s.x, y, C[5]);
      }
    },
  };
}

export default { meta, create } satisfies PfxModule;
