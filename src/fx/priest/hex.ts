// Hex: a violet five-point star of shadow slams onto the enemy's chest on the hit frame, turns as it shrinks, and a
// dark arrow sinks down through them: they're Weakened. Fx kind 'hex' (was shadowHit).
import { Rng, clamp, ease, star } from '../../vendor/pixelfx/index.js';
import { VIOLET } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Hex', desc: 'A violet star of shadow slams on the chest, turns, an arrow sinks down.', duration: 0.44, ink: '#000000' };

export function create(o: Opts) {
  const V = VIOLET();
  void new Rng(o.seed);
  let t = 0;
  return {
    update(dt: number) { t += dt; },
    draw(p: Painter) {
      const k = clamp(t / 0.3);
      if (k < 1) {
        // the star drawn as a pentagram: every second point joined
        const r = t < 0.04 ? 11 : 10 - ease.inCubic(k) * 6, pts = star(0, -12, r, r, 5, -Math.PI / 2 + k * 1.2);
        const tips = pts.filter((_: number[], i: number) => i % 2 === 0);
        for (let i = 0; i < 5; i++) {
          const [x0, y0] = tips[i], [x1, y1] = tips[(i + 2) % 5];
          p.line(x0, y0, x1, y1, t < 0.05 ? V[4] : V[3]);
        }
        for (const [x, y] of tips) p.dot(x, y, V[4]);
        p.glow(0, -12, 10, V[3], 0.3 * (1 - k));
      }
      // the Weakened arrow sinking through them
      const a = clamp((t - 0.12) / 0.28);
      if (a > 0 && a < 1) {
        const y = -20 + a * 12, al = 1 - a * a;
        p.rect(0, y, 1, 5, V[3], al); p.rect(-2, y + 3, 5, 1, V[3], al); p.rect(-1, y + 4, 3, 1, V[3], al); p.dot(0, y + 5, V[4], al);
      }
    },
  };
}

export default { meta, create } satisfies PfxModule;
