// Void Rift: a tear of black void splits open upright on each cursed panel, rimmed in lilac, sucks violet motes in
// from round it, then seals shut. Fx kind 'voidRift' (was shadowHit).
import { Rng, clamp, ease, TAU } from '../../vendor/pixelfx/index.js';
import { VIOLET } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Void Rift', desc: 'An upright tear of void opens, sucks motes in, seals shut.', duration: 0.44, ink: '#000000' };

export function create(o: Opts) {
  const V = VIOLET(), R = new Rng(o.seed);
  const motes = Array.from({ length: 6 }, () => ({ g: R.range(0, TAU), r: R.range(9, 12), d: R.range(0, 0.12) }));
  let t = 0;
  return {
    update(dt: number) { t += dt; },
    draw(p: Painter) {
      // the tear: a lens 3..5 wide, 18 tall, opening fast and sealing from the ends
      const open = ease.outBack(clamp(t / 0.1)), seal = ease.inCubic(clamp((t - 0.26) / 0.16));
      const w = 3.2 * open * (1 - seal), h = 9 * (1 - seal * 0.6);
      if (w > 0.4) {
        p.shade(-5, -11 - h - 1, 5, -11 + h + 1, (x: number, y: number, out: { c: number; a: number }) => {
          const v = (y + 11) / h;
          if (Math.abs(v) > 1) return;
          const half = w * Math.sqrt(1 - v * v), d = Math.abs(x);
          if (d > half + 1) return;
          out.c = d > half ? V[3] : d > half - 1 ? V[1] : V[0];
          out.a = 1;
        });
      }
      for (const m of motes) {
        const u = clamp((t - m.d) / 0.24);
        if (u <= 0 || u >= 1) continue;
        const r = m.r * (1 - ease.inCubic(u)), g = m.g + u * 2;
        p.rect(Math.cos(g) * r, -11 + Math.sin(g) * r * 0.9, 2, 1, u > 0.6 ? V[4] : V[2]);
      }
    },
  };
}

export default { meta, create } satisfies PfxModule;
