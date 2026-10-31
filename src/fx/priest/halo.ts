// Halo (each bolt): a gold halo drops onto the enemy from above, rings their chest white on the hit frame, then
// widens flat and fades while short rays flick off it. Fx kind 'haloBolt' (was holyPillar).
import { Rng, clamp, ease, TAU } from '../../vendor/pixelfx/index.js';
import { GOLD, WHITE, rays } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Halo', desc: 'A halo drops onto the enemy, rings their chest, widens and fades.', duration: 0.44, ink: '#503000' };

export function create(o: Opts) {
  const G = GOLD(), R = new Rng(o.seed);
  const rot = R.range(0, 1);
  let t = 0;
  return {
    update(dt: number) { t += dt; },
    draw(p: Painter) {
      // the fall: on the hit frame its trail still hangs above it
      if (t < 0.06) { const a = 1 - t / 0.06; p.rect(-4, -24, 1, 9, G[3], a); p.rect(4, -24, 1, 9, G[3], a); }
      const u = clamp(t / 0.32);
      if (u < 1) {
        const r = 5 + ease.outCubic(u) * 6, a = 1 - u * u;
        for (let j = 0, m = Math.ceil(r * 8); j < m; j++) {
          const g = (j / m) * TAU, front = Math.sin(g) > 0;
          p.dot(Math.cos(g) * r, -12 + Math.sin(g) * r * 0.35, u < 0.15 ? WHITE : front ? G[4] : G[3], a);
          if (u < 0.5) p.dot(Math.cos(g) * r, -11 + Math.sin(g) * r * 0.35, G[2], a);
        }
      }
      const k = clamp((t - 0.03) / 0.22);
      if (k > 0 && k < 1) rays(p, 0, -12, 6, 4 + k * 6, rot, G, 1 - k, 0.6);
    },
  };
}

export default { meta, create } satisfies PfxModule;
