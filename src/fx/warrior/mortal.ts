// Mortal Strike: two deep cuts cross in an X on the panel ahead, dark red, and the wound bleeds a few drops; a
// thin X echoes on the second panel.
import { Particles, Bits, B, Rng, fit, sparkle, clamp, ease, hex } from '../../vendor/pixelfx/index.js';
import { sparks } from '../lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Mortal Strike', desc: 'Two crossing cuts and a bleeding wound.', duration: 0.5, panels: 2, ink: '#000000' };

const WOUND = ['#000000', '#881400', '#a80020', '#e40058', '#f85898', '#fcfcfc'];

/** A straight cut from (x0, y0) to (x1, y1) drawn in at time t0: thick in the middle, white at the edge, cooling. */
function cut(p: Painter, C: number[], x0: number, y0: number, x1: number, y1: number, t: number, t0: number, W: number): void {
  const u = t - t0;
  if (u < -0.04) return;
  const head = ease.outExpo(clamp((u + 0.04) / 0.04)), fade = clamp((u - 0.08) / 0.2);
  if (fade >= 1) return;
  const hx = x0 + (x1 - x0) * head, hy = y0 + (y1 - y0) * head, w = W * (1 - fade * 0.6);
  p.beam(x0, y0, hx, hy, w, (k: number, v: number) => (v < 0.35 && fade < 0.4 ? C[5] : k < 0.2 || k > 0.8 ? C[2] : fade < 0.5 ? C[4] : C[3]), 1 - fade * fade);
}

export function create(o: Opts) {
  const C = fit(WOUND, 6), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: ['#fcfcfc', '#f85898', '#e40058', '#881400'] });
  const bits = new Bits({ ground: () => 0 });
  let t = 0, hit = false;
  return {
    update(dt: number) {
      t += dt;
      if (!hit) {
        hit = true;
        sparks(ps, R, 6, -12, 6, 0, 1.2);
        for (let i = 0; i < 4; i++) bits.add({ kind: B.DRIP, x: 4 + R.range(-3, 5), y: -12 + R.range(-3, 3), vx: R.range(-10, 20), vy: R.range(-30, 10), c: hex(i % 2 ? '#a80020' : '#e40058'), g: 0.6, life: R.range(0.3, 0.45) });
      }
      ps.update(dt); bits.update(dt);
    },
    draw(p: Painter) {
      cut(p, C, 33, -18, 43, -6, t, 0.0, 1.5); cut(p, C, 33, -6, 43, -18, t, 0.03, 1.5);
      cut(p, C, -2, -21, 12, -3, t, -0.03, 3); cut(p, C, -2, -3, 12, -21, t, 0, 3);
      if (t < 0.06) sparkle(p, 5, -12, 5 * (1 - t / 0.06), C[4], C[3], 0.3);
      bits.draw(p); ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
