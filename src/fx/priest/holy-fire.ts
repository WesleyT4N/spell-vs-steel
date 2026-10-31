// Holy Fire: white-gold flame tongues burst up out of the enemy's panel on the hit frame, flicker and burn down,
// shedding gold embers. Fx kind 'holyFire' (was holyPillar).
import { Particles, Rng, P, hex, clamp } from '../../vendor/pixelfx/index.js';
import { GOLD } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Holy Fire', desc: 'White-gold flame tongues burst from the panel and burn down.', duration: 0.44, ink: '#503000' };

export function create(o: Opts) {
  const G = GOLD(), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: ['#fcfcfc', '#f8d878', '#f8b800', '#ac7c00'] });
  // tongues: x, height, half width, phase
  const tongues = [[-6, 13, 3], [0, 21, 4], [6, 15, 3], [-2, 10, 2], [3, 9, 2]].map(([x, h, w]) => ({ x: x + R.range(-1, 1), h: h * R.range(0.9, 1.05), w, ph: R.range(0, 6) }));
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) { go = true; for (let i = 0; i < 6; i++) ps.spawn(P.EMBER, R.range(-7, 7), R.range(-14, -4), R.range(-15, 15), R.range(-40, -15), R.range(0.2, 0.35), hex('#f8d878'), 1); }
      ps.update(dt);
    },
    draw(p: Painter) {
      // the flames leap to full height on the hit frame, then burn down
      const k = clamp(t / 0.4), grow = t < 0.03 ? 1.08 : 1 - k * k;
      if (grow <= 0) return;
      for (const g of tongues) {
        const h = g.h * grow, wob = Math.round(Math.sin(t * 40 + g.ph));
        if (h < 2) continue;
        p.shade(g.x - g.w - 2, -h - 1, g.x + g.w + 2, 0, (x: number, y: number, out: { c: number; a: number }) => {
          const u = -y / h;
          if (u < 0 || u > 1) return;
          const half = g.w * Math.sin(Math.PI * Math.min(1, 0.25 + u * 0.9)) * (1 - u * 0.6), cx = g.x + wob * u;
          const d = Math.abs(x - cx);
          if (d > half + 0.3) return;
          const q = d / (half + 0.3);
          out.c = t < 0.04 ? G[5] : q < 0.35 && u < 0.7 ? G[5] : q < 0.7 ? G[4] : u > 0.7 ? G[3] : G[2];
          out.a = 1;
        });
      }
      p.glow(0, -9, 12, G[3], 0.3 * (1 - k));
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
