// Ignite (ignite, the enemy's column, anchored on its middle row): a fuse of fire runs across each panel
// of the column, middle first, and flame tongues jump up behind it before the panels settle into their burn.
import { Particles, P, Rng, clamp } from '../../vendor/pixelfx/index.js';
import { ROW } from '../lib';
import { FIRE, FIRE_SPARKS, flame } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Ignite', desc: 'A fuse of fire runs across each panel of the column and flares up.', duration: 0.5, rows: 3, ink: '#881400' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => ROW + 1, sparks: FIRE_SPARKS });
  const rows = [-ROW, 0, ROW], delay = [0.06, 0, 0.06];
  const done = [false, false, false];
  let t = 0;
  return {
    update(dt: number) {
      t += dt;
      rows.forEach((y, i) => {
        if (done[i] || t < delay[i] + 0.12) return;
        done[i] = true;
        for (let k = 0; k < 3; k++) ps.spawn(P.EMBER, R.range(-9, 9), y - R.range(3, 8), R.range(-10, 10), R.range(-40, -20), R.range(0.2, 0.32), 0, 1);
      });
      ps.update(dt);
    },
    draw(p: Painter) {
      rows.forEach((y, i) => {
        const u = (t - delay[i]) / 0.14;
        if (u < 0) return;
        // the fuse: a hot head running from back to front, a red line behind it
        const head = -11 + clamp(u) * 22;
        if (u < 1.6) {
          p.line(-11, y - 1, Math.min(head, 11), y - 1, FIRE[2], clamp(1.6 - u));
          if (u < 1) { p.px(head, y - 2, FIRE[6]); p.px(head - 1, y - 2, FIRE[4]); p.px(head, y - 1, FIRE[5]); }
        }
        // tongues pop up where the fuse passed, tallest in the middle, and sink
        for (let k = 0; k < 4; k++) {
          const x = -8 + k * 5.5, at = (x + 11) / 22, v = (u - at) / 2.2;
          if (v <= 0 || v >= 1) continue;
          const h = (k === 1 || k === 2 ? 13 : 9) * Math.sin(Math.PI * Math.pow(v, 0.6));
          flame(p, x, y - 1, h, 3, t * 20 + k * 2 + i);
        }
      });
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
