// Chain Hook draft A, "Iron Links": a barbed fish hook flies flat down the row, a rattling chain of open iron
// rings paying out behind it all the way back to the Warrior's fist. Its hit is chain-hook-a-hit.
import { clamp } from '../../vendor/pixelfx/index.js';
import { chainBack, hook, ironChain } from './chain-lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Chain Hook: Iron Links', desc: 'A barbed hook trailing a rattling chain of iron rings.', duration: 3, panels: 6, ink: '#000000' };

export function create(_o: Opts) {
  let t = 0;
  return {
    update(dt: number) { t += dt; },
    draw(p: Painter) {
      const back = clamp(chainBack(t), 0, 5 * 38 + 10);
      // the chain pays out slightly slack, links sliding forward with the throw
      ironChain(p, -5, -back, 0, Math.min(2, back / 40), -t * 60, 60);
      hook(p, -4, 0);
    },
  };
}

export default { meta, create } satisfies PfxModule;
