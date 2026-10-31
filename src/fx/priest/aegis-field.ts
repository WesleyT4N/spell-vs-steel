// Aegis Field: on each panel of the Priest's column, three white plates of force rise off the floor and lock
// together into a tall hex shield with a flash, then fade: the shield blessing. Fx kind 'blessShield'.
import { Rng, clamp, ease, ngon, sparkle, hex } from '../../vendor/pixelfx/index.js';
import { BLESS } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Aegis Field', desc: 'Plates of force rise and lock into a hex shield on each panel.', duration: 0.5, ink: '#3c3c3c' };

export function create(o: Opts) {
  const C = BLESS.shield.map(hex);
  void new Rng(o.seed);
  // the hex, tall: its six corners round (0, -11)
  const pts = ngon(0, -11, 8, 6, Math.PI / 6).map(([x, y]: number[]) => [x, -11 + (y + 11)]);
  let t = 0;
  return {
    update(dt: number) { t += dt; },
    draw(p: Painter) {
      const fade = clamp((t - 0.3) / 0.2);
      if (fade >= 1) return;
      // the plates: pairs of edges, each rising from the floor to its place, a beat apart
      for (let i = 0; i < 3; i++) {
        const u = ease.outBack(clamp((t - i * 0.04) / 0.14)), lift = (1 - u) * 4;
        if (u <= 0) continue;
        for (const e of [i * 2, i * 2 + 1]) {
          const [x0, y0] = pts[e], [x1, y1] = pts[(e + 1) % 6];
          p.beam(x0, y0 + lift, x1, y1 + lift, 2, t < 0.2 && t > 0.14 ? C[4] : C[2 + (e % 2)], 1 - fade);
        }
      }
      if (t > 0.16 && t < 0.28) sparkle(p, -6, -19, 3, C[4], C[2], 0.2);
      if (t < 0.3) p.glow(0, -11, 10, C[3], 0.2);
    },
  };
}

export default { meta, create } satisfies PfxModule;
