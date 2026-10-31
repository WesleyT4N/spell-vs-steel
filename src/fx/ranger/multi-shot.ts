// Multi-Shot (each of the three arrows): a silver arrow trailing two fading after-images of itself, so the volley
// of three reads as a fan of nine.
import type { PfxModule, Opts, Painter } from '../../game/pfx';
import { arrow, K, ARROW_PX } from './lib';

export const meta = { name: 'Multi-Shot', desc: 'Silver arrows trailing after-images of themselves.', duration: 2, panels: 2, ink: '#000000' };

export function draw(p: Painter, t: number, _o: Opts): void {
  const flown = t * ARROW_PX;
  // after-images: the same arrow a beat behind, dithered out
  for (let i = 2; i >= 1; i--) {
    const back = i * 13;
    if (flown < back) continue;
    const a = 1.05 - i * 0.3, x = 5 - back;
    for (let d = 0; d < 11; d++) p.dot(x - d, 0, d < 2 ? K.white : i > 1 ? K.iron : K.steel, a);
    p.dot(x - 1, -1, K.steel, a); p.dot(x - 1, 1, K.steel, a);
    p.dot(x - 11, -1, K.steel, a); p.dot(x - 11, 1, K.steel, a);
  }
  arrow(p, 5, 0, { shaft: K.steel, head: K.white, fletch: K.white, len: 12 });
}

export default { meta, draw } satisfies PfxModule;
