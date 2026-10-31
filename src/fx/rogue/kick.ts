// Kick: a low boot arc snaps across the panel ahead, a white star where it lands, and a ripple of force pushes on
// down into the second panel.
import { Particles, Rng, clamp, ease } from '../../vendor/pixelfx/index.js';
import { sparks } from '../lib';
import { STEEL, STEEL_SPARKS, WHITE, crescent, glint } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Kick', desc: 'A low boot arc and a ripple of force down two panels.', duration: 0.375, panels: 2, ink: '#000000' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: STEEL_SPARKS });
  let t = 0, hit = false;
  return {
    update(dt: number) {
      t += dt;
      if (!hit) { hit = true; sparks(ps, R, 2, -8, 4, -0.4, 0.8, [40, 100]); }
      ps.update(dt);
    },
    draw(p: Painter) {
      crescent(p, STEEL, -6, -9, 9, 0.8, 2.6, -0.2, t, -0.05, 3.5, 0.05, 0.03, 0.12);
      if (t < 0.08) glint(p, 2, -8, 4 * (1 - t / 0.08) + 1, STEEL[3], 0.3);
      // the push: a ")" of force rolling forward into the second panel
      const u = clamp((t - 0.02) / 0.22);
      if (u > 0 && u < 1) {
        const x = 6 + ease.outCubic(u) * 34, h = 6 - u * 2;
        for (let y = -h; y <= h; y++) p.px(x + Math.round(Math.sqrt(Math.max(0, h * h - y * y)) * 0.5), -9 + y, u < 0.3 ? WHITE : STEEL[3]);
        if (u < 0.7) for (let y = -h + 2; y <= h - 2; y += 2) p.px(x - 3 + Math.round(Math.sqrt(Math.max(0, h * h - y * y)) * 0.4), -9 + y, STEEL[2]);
      }
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
