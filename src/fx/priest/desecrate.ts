// Desecrate: the floor of each cursed panel cracks open in violet, a puff of black shadow belches up out of the
// cracks, and two tendrils claw up and sink back. Fx kind 'desecrate' (was shadowHit).
import { Rng, clamp, ease } from '../../vendor/pixelfx/index.js';
import { VIOLET, tendril, murk } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Desecrate', desc: 'Violet cracks split the floor, black shadow belches up, tendrils claw.', duration: 0.44, ink: '#000000' };

export function create(o: Opts) {
  const V = VIOLET(), R = new Rng(o.seed);
  // cracks: zigzags from the middle out
  const cracks = Array.from({ length: 4 }, (_, i) => ({ dir: i < 2 ? -1 : 1, len: R.range(6, 10), dy: i % 2 ? 1 : -1, ph: R.range(0, 6) }));
  const puffs = Array.from({ length: 3 }, () => ({ x: R.range(-5, 5), r: R.range(2.5, 3.5), v: R.range(25, 40) }));
  let t = 0;
  return {
    update(dt: number) { t += dt; },
    draw(p: Painter) {
      const open = ease.outCubic(clamp(t / 0.08)), fade = clamp((t - 0.25) / 0.18);
      for (const c of cracks) {
        if (fade >= 1) break;
        let y = 0;
        for (let i = 0; i < c.len * open; i++) {
          if (i % 3 === 2) y += c.dy * (Math.sin(c.ph + i) > 0 ? 1 : 0);
          p.dot(c.dir * i, Math.max(-1, Math.min(2, y)), i < 3 ? V[3] : V[2], 1 - fade);
        }
      }
      for (const pf of puffs) {
        const u = clamp((t - 0.02) / 0.38);
        if (u <= 0 || u >= 1) continue;
        murk(p, pf.x, -2 - pf.v * u * 0.4, pf.r * (1 - u * 0.6) + 0.5, V, 1 - u * u);
      }
      const k = clamp(t / 0.36);
      if (k < 1) {
        const len = 12 * Math.sin(Math.PI * k);
        tendril(p, -3, -1, -Math.PI / 2 - 0.3, len, t * 20, V);
        tendril(p, 4, -1, -Math.PI / 2 + 0.25, len * 0.8, t * 20 + 2, V);
      }
    },
  };
}

export default { meta, create } satisfies PfxModule;
