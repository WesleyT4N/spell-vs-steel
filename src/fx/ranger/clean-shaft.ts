// Arrow (light), draft A, "Clean shaft": a crisp inked arrow with a dotted air streak behind it and a white
// snap at the bowstring as it leaves. The flying shot; its hit is light-a-hit.
import type { PfxModule, Opts, Painter } from '../../game/pfx';
import { arrow, glint, K, ARROW_PX } from './lib';

export const meta = { name: 'Clean shaft', desc: 'A crisp arrow with a dotted air streak and a snap at the bow.', duration: 2, panels: 2, ink: '#000000' };

export function draw(p: Painter, t: number, _o: Opts): void {
  const flown = t * ARROW_PX;
  // the bowstring snap stays where the arrow left
  if (t < 0.05) glint(p, -flown - 2, 0, 3 * (1 - t / 0.05) + 1, K.steel, K.iron);
  arrow(p, 5, 0, { shaft: K.wood, head: K.steel, fletch: K.white, len: 12 });
  // air streak: dotted so it stays unoutlined, thinning out behind
  const L = Math.min(22, flown - 10);
  for (let d = 0; d < L; d += 2) p.dot(-9 - d, d % 4 ? 1 : -1, d < 8 ? K.white : K.steel, 1 - d / 24);
}

export default { meta, draw } satisfies PfxModule;
