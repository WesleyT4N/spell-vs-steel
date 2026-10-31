// Evasion: the Rogue blurs side to side: violet smear lines whip out either side of their body at a few heights,
// like the blur of a dodge, then shrink back to nothing, so you can see the next hits will find only air.
import { Rng, clamp, ease } from '../../vendor/pixelfx/index.js';
import { SHADOW, WHITE } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Evasion', desc: 'Violet dodge-blur lines whip out either side.', duration: 0.45, ink: '#000000' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  // each smear: a side, a height, how far out it reaches, and a beat of delay
  const lines = Array.from({ length: 8 }, (_, i) => ({ s: i % 2 ? 1 : -1, y: -20 + Math.floor(i / 2) * 5 + R.int(-1, 1), L: R.range(4, 7), d: (i >> 1) * 0.02 + R.range(0, 0.02) }));
  let t = 0;
  return {
    update(dt: number) { t += dt; },
    draw(p: Painter) {
      for (const l of lines) {
        const u = t - l.d;
        if (u < 0) continue;
        const out = ease.outCubic(clamp(u / 0.08)), back = ease.inQuad(clamp((u - 0.12) / 0.2));
        if (back >= 1) continue;
        const x0 = l.s * (5 + l.L * back), x1 = l.s * (5 + l.L * out);
        if (Math.abs(x1 - x0) < 1) continue;
        p.line(x0, l.y, x1, l.y, back < 0.3 ? SHADOW[4] : SHADOW[3]);
        p.line(x0, l.y + 1, x0 + (x1 - x0) * 0.6, l.y + 1, SHADOW[2]);
        if (u < 0.05) p.px(x1, l.y, WHITE);
      }
    },
  };
}

export default { meta, create } satisfies PfxModule;
