// Shadowform (each enemy panel): a wave of shadow washes over the panel's floor, a ring of violet that tightens, and
// three short tendrils lick up out of it and sink back. Fx kind 'shadowformCurse' (was shadowHit).
import { Rng, clamp, ease, TAU } from '../../vendor/pixelfx/index.js';
import { VIOLET, tendril } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Shadowform: panels', desc: 'A tightening ring of shadow on the floor, tendrils lick up and sink.', duration: 0.44, ink: '#000000' };

export function create(o: Opts) {
  const V = VIOLET(), R = new Rng(o.seed);
  const ph = R.range(0, TAU);
  let t = 0;
  return {
    update(dt: number) { t += dt; },
    draw(p: Painter) {
      const u = clamp(t / 0.36);
      if (u >= 1) return;
      const r = 10 - ease.outCubic(u) * 5, a = 1 - u * u;
      for (let j = 0, m = Math.ceil(r * 8); j < m; j++) {
        const g = (j / m) * TAU;
        p.dot(Math.cos(g) * r, -1 + Math.sin(g) * r * 0.3, u < 0.2 ? V[4] : V[3], a);
        p.dot(Math.cos(g) * (r - 1), -1 + Math.sin(g) * (r - 1) * 0.3, V[1], a);
      }
      const len = 9 * Math.sin(Math.PI * u);
      for (let i = 0; i < 3; i++) tendril(p, -6 + i * 6, -1, -Math.PI / 2 + (i - 1) * 0.35, len * (i === 1 ? 1.2 : 0.8), ph + t * 20 + i, V);
    },
  };
}

export default { meta, create } satisfies PfxModule;
