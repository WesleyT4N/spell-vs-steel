// Holy Nova: a white sun flares on the Priest's chest on the hit frame and eight lances of light shoot out to the
// panels around them, each bursting in a star where it lands (the ones behind stop at the box edge).
// The box covers the Priest's column and the one ahead, all three rows (panels 2, rows 3).
import { Rng, clamp, ease, flare, sparkle } from '../../vendor/pixelfx/index.js';
import { ROW } from '../lib';
import { GOLD, WHITE } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Holy Nova', desc: 'A sun flares on the Priest and lances of light burst to every panel around.', duration: 0.56, panels: 2, rows: 3, ink: '#503000' };

const SUN = ['#ac7c00', '#f8b800', '#f8d878', '#fcfcfc'];

export function create(o: Opts) {
  const G = GOLD();
  void new Rng(o.seed);
  const cy = -11;
  // targets: the panel centers round the Priest (forward ones full length, behind ones to the box edge)
  const T: Array<[number, number, boolean]> = [];
  for (const dc of [-1, 0, 1]) for (const dr of [-1, 0, 1]) {
    if (!dc && !dr) continue;
    T.push([dc < 0 ? -10 : dc * 38, cy + dr * ROW, dc >= 0]);
  }
  let t = 0;
  return {
    update(dt: number) { t += dt; },
    draw(p: Painter) {
      const k = clamp(t / 0.3);
      if (k < 1) { flare(p, 0, cy, 10 * (1 - k) + 1, 0.4, SUN); p.circle(0, cy, 3.5 * (1 - k) + 0.6, G[5]); }
      // the lances: head races out, tail follows
      for (const [x, y, full] of T) {
        const h = ease.outCubic(clamp(t / 0.14)), tl = clamp((t - 0.06) / 0.16);
        if (tl < 1) p.line(x * tl, cy + (y - cy) * tl, x * h, cy + (y - cy) * h, (u: number) => (u > 0.6 ? WHITE : G[4]));
        const s = clamp((t - 0.12) / 0.2);
        if (full && s > 0 && s < 1) sparkle(p, x, y, 4 * (1 - s) + 1, G[4], G[3], 0.25);
      }
      if (k < 1) p.glow(0, cy, 14, G[3], 0.3 * (1 - k));
    },
  };
}

export default { meta, create } satisfies PfxModule;
