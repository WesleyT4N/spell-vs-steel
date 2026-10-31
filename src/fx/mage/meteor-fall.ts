// Meteor's fall (meteorFall, on the target panel for the whole fall, box the full column tall): a rock wrapped in
// fire drops out of the sky, small and slow at first and huge and fast at the end, a flaming tail streaming up
// behind it, while its shadow swells on the target panel.
import { clamp, ease } from '../../vendor/pixelfx/index.js';
import { FIRE, BLACK, blast } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Meteor Fall', desc: 'A burning rock drops out of the sky, growing, its shadow swelling below.', duration: 1.5, rows: 3, ink: '#000000' };

const TOP = -34, END = -9;

export function create(o: Opts) {
  const seed = o.seed % 89;
  return {
    update() { /* a pure function of time */ },
    draw(p: Painter, t: number) {
      const u = clamp(t / 1.5), k = ease.inCubic(u);
      const x = -4 + k * 4, y = TOP + (END - TOP) * k, r = 2 + u * 4.5;
      // the shadow on the panel: a dithered dark oval that grows and firms up
      p.ellipse(0, -1, 3 + u * 8, 1 + u * 1.6, BLACK, 0.25 + u * 0.5);
      // the tail: blobs strung back up the path, cooler and smaller the further back
      for (let i = 4; i >= 1; i--) {
        const kk = ease.inCubic(clamp(u - i * 0.035)), tx = -4 + kk * 4, ty = TOP + (END - TOP) * kk;
        if (ty > y - 1) continue;
        blast(p, tx - i * 0.5, ty - i * 1.5, r * (1 - i * 0.18), 0.75 - i * 0.15, seed, t);
      }
      blast(p, x, y, r + 1.5, 0.95, seed, t);
      // the rock itself, dark inside the fire, lit on its leading face
      p.circle(x - r * 0.15, y - r * 0.15, r * 0.65, (d: number, a: number) => (d > 0.6 && Math.cos(a - 0.8) > 0.2 ? FIRE[1] : BLACK));
      p.px(x + r * 0.3, y + r * 0.3, FIRE[5]);
      p.glow(x, y, 6 + r * 1.5, FIRE[4], 0.25 + u * 0.1);
    },
  };
}

export default { meta, create } satisfies PfxModule;
