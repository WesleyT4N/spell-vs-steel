// Power Infusion: two ribbons of power, gold and white, wind up round the Priest in a helix, meet over the head in a
// flare, and gold glints rain off. Fx kind 'powerInfusion' (was transform).
import { Particles, Rng, P, hex, clamp, flare } from '../../vendor/pixelfx/index.js';
import { GOLD } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Power Infusion', desc: 'Gold and white ribbons wind up round the Priest and flare overhead.', duration: 0.75, ink: '#503000' };

export function create(o: Opts) {
  const G = GOLD(), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0 });
  let t = 0, fl = false;
  return {
    update(dt: number) {
      t += dt;
      if (!fl && t >= 0.3) { fl = true; for (let i = 0; i < 6; i++) ps.spawn(P.STAR, R.range(-9, 9), R.range(-22, -12), R.range(-6, 6), R.range(5, 15), R.range(0.25, 0.4), hex('#f8d878'), 0.8); }
      ps.update(dt);
    },
    draw(p: Painter) {
      // the ribbons: a helix whose head climbs from the floor to the top in 0.3 s; its tail follows to 0.55 s
      const head = clamp(t / 0.3) * 22, tail = Math.max(0, head - 9, clamp((t - 0.22) / 0.33) * 22);
      if (tail < head) for (let s = 0; s < 2; s++) {
        for (let h = tail; h <= head; h += 0.5) {
          const g = h * 0.5 + s * Math.PI, x = Math.sin(g) * 9 * (1 - h / 40), front = Math.cos(g) > 0;
          const hot = head - h < 3;
          p.dot(x, -h, hot ? G[5] : s ? (front ? G[5] : G[3]) : front ? G[4] : G[2]);
        }
      }
      const f = clamp((t - 0.28) / 0.2);
      if (f > 0 && f < 1) flare(p, 0, -21, 7 * (1 - f) + 1, 0.4, ['#ac7c00', '#f8b800', '#f8d878', '#fcfcfc']);
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
