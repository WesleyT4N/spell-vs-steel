// Net (the flying net): a rope net spins open as it flies, a diamond mesh between four steel weights, with a
// couple of loose rope ends streaming behind.
import { clamp, ease } from '../../vendor/pixelfx/index.js';
import type { PfxModule, Opts, Painter } from '../../game/pfx';
import { K } from './lib';

export const meta = { name: 'Net', desc: 'A rope net spins open between four weights.', duration: 2, panels: 2 };

export function draw(p: Painter, t: number, _o: Opts): void {
  const s = 3 + ease.outCubic(clamp(t / 0.2)) * 5, tw = Math.cos(t * 18), w = s * (0.55 + 0.45 * Math.abs(tw));
  // mesh: a diamond lattice clipped to the net's outline
  p.shade(-w - 1, -s - 1, w + 1, s + 1, (x: number, y: number, out: { c: number; a: number }) => {
    const u = Math.abs(x / w) + Math.abs(y / s);
    if (u > 1) return;
    const on = ((Math.floor(x) + Math.floor(y)) % 4 + 4) % 4 === 0 || ((Math.floor(x) - Math.floor(y)) % 4 + 4) % 4 === 0;
    if (!on && u < 0.92) return;
    out.c = u > 0.85 ? K.bark : K.wood; out.a = 1;
  });
  for (const [x, y] of [[w, 0], [-w, 0], [0, s], [0, -s]]) { p.rect(Math.round(x) - 1, Math.round(y) - 1, 3, 3, K.ink); p.px(Math.round(x), Math.round(y), K.steel); }
  // loose rope ends
  for (let i = 0; i < 2; i++) for (let d = 0; d < 8; d += 2) p.dot(-w - 3 - d, (i ? 2 : -2) + Math.round(Math.sin(t * 30 + d * 0.6 + i) * 1.5), K.wood, 1 - d / 9);
}

export default { meta, draw } satisfies PfxModule;
