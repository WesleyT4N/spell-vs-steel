// Cold Blood: the Rogue steadies: a dagger held point-up in front, a cold white gleam runs up its edge to the point
// and winks, and one dark drop falls from it. Chill motes sink round them.
import { Rng, clamp, hex } from '../../vendor/pixelfx/index.js';
import { SHADOW, STEEL, WHITE, Drops, knife, glint } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Cold Blood', desc: 'A gleam runs up a raised dagger; one dark drop falls.', duration: 0.6, ink: '#000000' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const drops = new Drops();
  const GX = 7, GY = -7, ANG = -Math.PI / 2 + 0.2, L = 13;
  const ux = Math.cos(ANG), uy = Math.sin(ANG);
  const motes = Array.from({ length: 4 }, (_, i) => ({ x: (i % 2 ? 1 : -1) * R.range(5, 10), y: R.range(-22, -14), d: i * 0.06 }));
  let t = 0, dropped = false;
  return {
    update(dt: number) {
      t += dt;
      if (!dropped && t >= 0.3) { dropped = true; drops.add(GX + ux * L * 0.2, GY + uy * L * 0.2 + 2, 0, 10, hex('#881400'), 0.4); }
      drops.update(dt);
    },
    draw(p: Painter) {
      const up = clamp(t / 0.06), fade = clamp((t - 0.42) / 0.14);
      if (fade < 1) knife(p, GX + ux * L * 0.45, GY + uy * L * 0.45 + (1 - up) * 3, ANG, L, STEEL, undefined, up * (1 - fade));
      // the gleam climbs the edge, then winks at the point
      const g = clamp((t - 0.06) / 0.18);
      if (g > 0 && g < 1) { const k = g * 0.95; p.px(GX + ux * L * k, GY + uy * L * k, WHITE); p.px(GX + ux * L * k + 1, GY + uy * L * k, SHADOW[4]); }
      const w = t - 0.24, tipY = GY + uy * (L - 1);
      if (w > 0 && w < 0.12) glint(p, GX + ux * (L - 1), Math.max(tipY, -20), 3 * (1 - w / 0.12) + 1, SHADOW[3], 0.3);
      for (const m of motes) {
        const u = (t - m.d) / 0.4;
        if (u > 0 && u < 1) p.px(m.x, m.y + u * 12, u < 0.5 ? SHADOW[4] : SHADOW[3]);
      }
      drops.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
