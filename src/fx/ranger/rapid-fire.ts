// Rapid Fire: three ghost arrows flick off the bow one after another, quick as blinks, while white wind streaks
// whip round the Ranger.
import { clamp } from '../../vendor/pixelfx/index.js';
import type { PfxModule, Opts, Painter } from '../../game/pfx';
import { arrow, K } from './lib';

export const meta = { name: 'Rapid Fire', desc: 'Three ghost arrows flick off the bow; wind whips round.', duration: 0.62, ink: '#3c3c3c' };

export function draw(p: Painter, t: number, _o: Opts): void {
  for (let i = 0; i < 3; i++) {
    const u = clamp((t - i * 0.1) / 0.14);
    if (u <= 0 || u >= 1) continue;
    // each ghost shoots from the bow out to the box's edge, a different height each time
    const x = 3 + u * 9, y = -13 + (i - 1) * 3;
    arrow(p, x, y, { shaft: K.steel, head: K.white, fletch: K.white, len: 7 });
    for (let d = 0; d < 6; d += 2) p.dot(x - 9 - d, y, K.steel, 1 - u);
  }
  // wind: short arcs circling the body, dotted
  const w = clamp(t / 0.5);
  if (w < 1) for (let i = 0; i < 2; i++) {
    const a0 = t * 16 + i * Math.PI;
    for (let k = 0; k < 6; k++) { const a = a0 + k * 0.18; p.dot(Math.cos(a) * 10, -11 + Math.sin(a) * 6, k < 2 ? K.white : K.steel, 1 - w); }
  }
}

export default { meta, draw } satisfies PfxModule;
