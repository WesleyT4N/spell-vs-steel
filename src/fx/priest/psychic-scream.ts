// Psychic Scream: jagged violet rings of a scream tear forward off the Priest's head and roll down the row toward the
// enemy, spiky as a shout. Fx kind 'psychicScream' (was shout).
import { Rng, clamp, ease, TAU } from '../../vendor/pixelfx/index.js';
import { VIOLET } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Psychic Scream', desc: 'Jagged violet scream rings tear forward down the row.', duration: 0.625, panels: 2, ink: '#000000' };

export function create(o: Opts) {
  const V = VIOLET(), R = new Rng(o.seed);
  void R;
  let t = 0;
  return {
    update(dt: number) { t += dt; },
    draw(p: Painter) {
      for (let i = 0; i < 3; i++) {
        const u = clamp((t - i * 0.1) / 0.36);
        if (u <= 0 || u >= 1) continue;
        // each ring rolls forward as it widens: an upright ellipse with spikes on its rim
        const cx = 5 + ease.outCubic(u) * 26, r = 4 + ease.outCubic(u) * 5, a = 1 - u * u;
        for (let j = 0, m = 36; j < m; j++) {
          const g = (j / m) * TAU, spike = j % 3 === 0 ? 2 : 0, rr = r + spike;
          if (Math.cos(g) < -0.5) continue; // the back of the ring is hidden behind its front
          const x = cx + Math.cos(g) * rr * 0.45, y = -13 + Math.sin(g) * rr;
          p.dot(x, y, spike || u < 0.3 ? V[4] : V[3], a);
          p.dot(x - 1, y, i === 0 ? V[3] : V[2], a);
        }
      }
    },
  };
}

export default { meta, create } satisfies PfxModule;
