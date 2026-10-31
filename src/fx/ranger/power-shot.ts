// Power Shot: one arrow so hard it tears the row open: a thick steel streak lies across the whole row on the hit
// frame, a pierce ring stands up on every panel it passes, and the streak breaks into dots from the bow end.
import { Particles, Rng, clamp } from '../../vendor/pixelfx/index.js';
import type { PfxModule, Opts, Painter } from '../../game/pfx';
import { pixRing, K, STEEL_SPARKS } from './lib';
import { sparks } from '../lib';

export const meta = { name: 'Power Shot', desc: 'A steel streak through the whole row, a pierce ring on every panel.', duration: 0.44, panels: 6, ink: '#000000' };

const X0 = 10, X1 = 5 * 38 + 10, Y = -11;

export function create(o: Opts) {
  const R = new Rng(o.seed), ps = new Particles({ rng: R, ground: () => 0, sparks: STEEL_SPARKS });
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) { go = true; for (let i = 1; i <= 5; i++) sparks(ps, R, i * 38, Y, 2, 0, 1.2, [40, 90]); }
      ps.update(dt);
    },
    draw(p: Painter) {
      // the streak breaks up from the bow end: everything behind `gone` is dots, then nothing
      const gone = X0 + (X1 - X0) * clamp((t - 0.06) / 0.25), dots = X0 + (X1 - X0) * clamp((t - 0.14) / 0.25);
      const th = t < 0.05 ? 3 : 2;
      if (gone < X1) p.rect(Math.round(gone), Y - 1, X1 - Math.round(gone), th, t < 0.08 ? K.white : K.steel);
      if (gone < X1 && t < 0.12) p.rect(Math.round(gone), Y - 1, X1 - Math.round(gone), 1, K.white);
      for (let x = Math.round(dots); x < Math.min(gone, X1); x += 3) p.dot(x, Y, K.steel, 1 - clamp((t - 0.1) / 0.3));
      // the point, flaring at the far end
      if (t < 0.1) { p.tri(X1, Y - 3, X1 + 4, Y, X1, Y + 3, K.white); }
      // a pierce ring standing up on each panel it passed, popping in sequence
      for (let i = 0; i <= 5; i++) {
        const u = clamp((t - i * 0.015) / 0.2);
        if (u > 0 && u < 1) pixRing(p, i * 38 + (i ? 0 : 12), Y, 1 + u * 2, 3 + u * 6, u < 0.3 ? K.white : K.steel, 0, 1 - u);
      }
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
