// Shiv: a jagged little blade on a long reach: a needle of steel darts through both panels ahead at once, a
// pinprick of light on each, then whips back.
import { Particles, Rng, clamp, ease } from '../../vendor/pixelfx/index.js';
import { sparks } from '../lib';
import { STEEL, STEEL_SPARKS, WHITE, glint } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Shiv', desc: 'A needle darts through both panels ahead with a pinprick on each.', duration: 0.3, panels: 3, ink: '#000000' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: STEEL_SPARKS });
  const X0 = 8, TIP = 74, Y = -11;
  let t = 0, hit = false;
  return {
    update(dt: number) {
      t += dt;
      if (!hit) { hit = true; sparks(ps, R, 38, Y, 3, 0, 0.9, [40, 90], [0.06, 0.14]); sparks(ps, R, TIP, Y, 3, 0, 0.6, [40, 90], [0.06, 0.14]); }
      ps.update(dt);
    },
    draw(p: Painter) {
      const k = 1 - ease.inCubic(clamp((t - 0.05) / 0.09));
      if (k > 0.04) {
        const tip = X0 + (TIP - X0) * k;
        p.line(X0, Y, tip - 4, Y, STEEL[2]);
        if (tip - X0 > 20) p.line(tip - 18, Y - 1, tip - 4, Y - 1, STEEL[3]);
        // the jagged shiv point: a saw tooth then a white tip
        p.poly([[tip - 6, Y - 2], [tip - 4, Y - 1], [tip - 2, Y - 2], [tip + 1, Y], [tip - 6, Y + 1]], STEEL[3]);
        p.line(tip - 3, Y - 1, tip, Y, WHITE);
      }
      if (t < 0.08) { glint(p, 38, Y, 2.5 * (1 - t / 0.08) + 1, STEEL[3], 0.2); glint(p, TIP + 1, Y, 3 * (1 - t / 0.08) + 1, STEEL[3], 0.25); }
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
