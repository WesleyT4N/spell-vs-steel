// Mind Sear: on each panel of the enemy's row, rings of psychic force pulse out from head height, wobbling as they
// go, violet over lilac, with a bright pulse at their heart. Fx kind 'mindSear' (was shadowHit).
import { Rng, clamp, ease, TAU } from '../../vendor/pixelfx/index.js';
import { VIOLET } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Mind Sear', desc: 'Wobbling rings of psychic force pulse out at head height.', duration: 0.44, ink: '#000000' };

export function create(o: Opts) {
  const V = VIOLET(), R = new Rng(o.seed);
  const ph = R.range(0, TAU);
  let t = 0;
  return {
    update(dt: number) { t += dt; },
    draw(p: Painter) {
      for (let i = 0; i < 3; i++) {
        const u = clamp((t - i * 0.07) / 0.26);
        if (u <= 0 || u >= 1) continue;
        const r = 2 + ease.outCubic(u) * 9, a = 1 - u * u;
        for (let j = 0, m = Math.ceil(r * 8); j < m; j++) {
          const g = (j / m) * TAU, w = r + Math.sin(g * 5 + ph + t * 30) * (0.6 + u);
          p.dot(Math.cos(g) * w, -15 + Math.sin(g) * w * 0.7, u < 0.25 ? V[4] : i % 2 ? V[2] : V[3], a);
        }
      }
      const k = clamp(t / 0.2);
      if (k < 1) { p.rect(-1, -16, 3, 3, V[3]); p.dot(0, -15, V[4]); p.glow(0, -15, 8, V[3], 0.3 * (1 - k)); }
    },
  };
}

export default { meta, create } satisfies PfxModule;
