// Shadow Word: Pain: a ring of violet thorns snaps shut round the enemy's chest, flashes lilac as it bites, then
// drips of shadow run down off it: the pain that keeps ticking. Fx kind 'swPain'.
import { Rng, clamp, ease, TAU } from '../../vendor/pixelfx/index.js';
import { VIOLET } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Shadow Word: Pain', desc: 'A ring of violet thorns snaps shut on the chest and drips shadow.', duration: 0.625, ink: '#000000' };

export function create(o: Opts) {
  const V = VIOLET(), R = new Rng(o.seed);
  const drips = Array.from({ length: 4 }, () => ({ x: R.range(-7, 7), d: R.range(0.15, 0.3), v: R.range(30, 45) }));
  const turn = R.range(0, TAU);
  let t = 0;
  return {
    update(dt: number) { t += dt; },
    draw(p: Painter) {
      const shut = ease.inCubic(clamp(t / 0.12)), fade = clamp((t - 0.3) / 0.3);
      if (fade < 1) {
        const r = 12 - shut * 5, bite = t > 0.12 && t < 0.2, a = 1 - fade;
        // a ring of thorns: 8 spikes pointing in
        for (let i = 0; i < 8; i++) {
          const g = turn + (i / 8) * TAU + t * 2, c = Math.cos(g), s = Math.sin(g) * 0.9;
          for (let d = 0; d <= 3; d += 0.5) p.dot(c * (r - d), -11 + s * (r - d), d > 2 ? (bite ? V[4] : V[3]) : V[2], a);
          const g2 = g + TAU / 16;
          p.dot(Math.cos(g2) * r, -11 + Math.sin(g2) * r * 0.9, V[1], a);
        }
      }
      for (const d of drips) {
        const u = t - d.d;
        if (u <= 0 || u > 0.3) continue;
        const y = -8 + d.v * u;
        if (y > -1) continue;
        p.rect(d.x, y, 1, 2, V[2]); p.dot(d.x, y + 2, V[3]);
      }
      if (t < 0.25) p.glow(0, -11, 10, V[3], 0.25);
    },
  };
}

export default { meta, create } satisfies PfxModule;
