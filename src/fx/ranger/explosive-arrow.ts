// Explosive Shot (the flying arrow): an arrow carrying a red charge bulb behind its head, a lit fuse spitting gold
// sparks and a thin smoke trail behind.
import type { PfxModule, Opts, Painter } from '../../game/pfx';
import { arrow, K, ARROW_PX } from './lib';

export const meta = { name: 'Explosive arrow', desc: 'An arrow with a red charge and a spitting fuse.', duration: 2, panels: 2, ink: '#000000' };

export function draw(p: Painter, t: number, o: Opts): void {
  const flown = t * ARROW_PX, f = Math.floor(t * 40);
  arrow(p, 6, 0, { shaft: K.wood, head: K.steel, fletch: K.white, len: 13 });
  // the charge: a 3x3 red bulb lashed behind the head, its top pixel flickering
  p.rect(-1, -1, 3, 3, K.red1); p.px(0, -1, f % 2 ? K.red2 : K.gold);
  // fuse sparks: two specks hopping off the bulb
  for (let i = 0; i < 2; i++) { const k = ((f + i * 3 + o.seed) % 5) / 5; p.dot(-1 - k * 6, -2 - k * 3 + i, i ? K.gold : K.cream, 1 - k); }
  // smoke trail: gray dots, sinking a little as they age (world-fixed)
  const L = Math.min(26, flown - 8);
  for (let d = 2; d < L; d += 3) p.dot(-9 - d, -1 + Math.round(d / 12), d < 10 ? K.steel : K.iron, 1 - d / 28);
}

export default { meta, draw } satisfies PfxModule;
