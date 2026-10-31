// Shadow Dance: two violet wisps spiral up round the Rogue from their feet to their head, chasing each other,
// and burst into lilac sparks at the top as the Rogue slips back into the dark.
import { Particles, Rng, clamp, ease, hex, P } from '../../vendor/pixelfx/index.js';
import { SHADOW } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Shadow Dance', desc: 'Two violet wisps spiral up and burst at the top.', duration: 0.6, ink: '#000000' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0 });
  const UP = 0.4;
  const at = (s: number, k: number): [number, number] => { const a = s * Math.PI * 5 + k * Math.PI; return [Math.cos(a) * 10 * (1 - s * 0.3), -2 - ease.inOutSine(s) * 18 + Math.sin(a) * 2]; };
  let t = 0, burst = false;
  return {
    update(dt: number) {
      t += dt;
      if (!burst && t >= UP) { burst = true; for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ps.spawn(P.STAR, Math.cos(a) * 3, -20 + Math.sin(a) * 2, Math.cos(a) * 25, Math.sin(a) * 15, 0.18, hex('#d8b8f8'), 0.8); } }
      ps.update(dt);
    },
    draw(p: Painter) {
      const s = clamp(t / UP);
      if (s < 1) for (let k = 0; k < 2; k++) {
        // each wisp: a bright head and a trail cooling to black behind it
        for (let i = 7; i >= 0; i--) {
          const q = s - i * 0.03;
          if (q < 0) continue;
          const [x, y] = at(q, k);
          p.px(x, y, i === 0 ? hex('#fcfcfc') : i < 4 ? SHADOW[4] : SHADOW[3]);
        }
      }
      const g = 1 - clamp(t / 0.15);
      if (g > 0) p.ellipse(0, 0, 9 * (1 - g * 0.5), 1.5, SHADOW[1], g);
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
