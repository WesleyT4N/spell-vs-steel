// Pickpocket: a sly jab two panels deep, and a gold coin pops off the first panel and arcs back into the Rogue's
// hand with a wink of light (the Energy they steal).
import { Particles, Rng, clamp, ease, hex } from '../../vendor/pixelfx/index.js';
import { sparks } from '../lib';
import { STEEL, STEEL_SPARKS, WHITE, glint } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Pickpocket', desc: 'A sly jab, and a gold coin arcs back to the Rogue.', duration: 0.5, panels: 3, ink: '#000000' };

const GOLD = ['#503000', '#ac7c00', '#f8b800', '#f8d878'].map(hex);

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: STEEL_SPARKS });
  const X0 = 8, TIP = 70, Y = -10, CT = 0.36;
  let t = 0, hit = false;
  return {
    update(dt: number) {
      t += dt;
      if (!hit) { hit = true; sparks(ps, R, 38, Y, 3, -0.4, 0.8, [40, 80], [0.06, 0.14]); }
      ps.update(dt);
    },
    draw(p: Painter) {
      const k = 1 - ease.inCubic(clamp((t - 0.04) / 0.08));
      if (k > 0.04) {
        const tip = X0 + (TIP - X0) * k;
        p.line(X0, Y, tip - 3, Y, STEEL[2]);
        p.line(X0 + 4, Y - 1, tip - 3, Y - 1, STEEL[3]);
        p.poly([[tip - 4, Y - 2], [tip, Y], [tip - 4, Y + 1]], STEEL[3]);
      }
      if (t < 0.07) glint(p, TIP + 1, Y, 3 * (1 - t / 0.07) + 1, STEEL[3], 0.2);
      // the coin: off the first panel, up and back to the hand, spinning (wide, edge-on, wide)
      const u = clamp((t - 0.03) / CT);
      if (u > 0 && u < 1) {
        const x = 38 + (6 - 38) * u, y = -12 - 7 * Math.sin(Math.PI * u) + 2 * u, w = Math.abs(Math.cos(t * 30));
        if (w > 0.4) { p.circle(x, y, 2, GOLD[2]); p.px(x - 1, y - 1, GOLD[3]); p.px(x + 1, y + 1, GOLD[1]); }
        else { p.line(x, y - 2, x, y + 2, GOLD[2]); }
      }
      const g = t - 0.03 - CT;
      if (g > 0 && g < 0.08) { glint(p, 6, -10, 2.5 * (1 - g / 0.08) + 1, GOLD[3], 0.3); p.px(6, -10, WHITE); }
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
