// Throwing Knife (the Rogue's heavy) in flight: a little dagger tumbling end over end down the row, a dotted wake
// behind it. Its hit is spinning-knife-hit.
import { clamp } from '../../vendor/pixelfx/index.js';
import { STEEL, knife } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Throwing Knife', desc: 'A dagger tumbling end over end with a dotted wake.', duration: 3, panels: 2, ink: '#000000' };

/** How far a shot has flown by t (12 panels/s, the Rogue's knife speed). */
const flown = (t: number): number => t * 12 * 38;

export function create(_o: Opts) {
  let t = 0;
  return {
    update(dt: number) { t += dt; },
    draw(p: Painter) {
      // whole eighth-turns, so the blade snaps between clean pixel poses
      const ang = -Math.round(t * 28 / (Math.PI / 4)) * (Math.PI / 4);
      knife(p, 0, 0, ang, 9);
      const back = clamp(flown(t) - 6, 0, 26);
      // lone pixels, so the ink leaves them as a light dotted wake
      for (let d = 7; d < back; d += 3) p.px(-d, ((d / 3) | 0) % 3 === 0 ? -1 : 0, d < 16 ? STEEL[4] : STEEL[3]);
    },
  };
}

export default { meta, create } satisfies PfxModule;
