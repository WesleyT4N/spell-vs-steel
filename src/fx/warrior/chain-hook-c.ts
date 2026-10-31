// Chain Hook draft C, "Sickle Whip": a hooked sickle blade spins end over end down the row, its bead chain
// whipping in a wave behind it, calm at the Warrior's fist and lashing near the blade. Its hit is chain-hook-c-hit.
import { clamp } from '../../vendor/pixelfx/index.js';
import { beadChain, chainBack, sickle } from './chain-lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Chain Hook: Sickle Whip', desc: 'A spinning sickle on a whipping bead chain.', duration: 3, panels: 6, ink: '#000000' };

export function create(_o: Opts) {
  let t = 0;
  return {
    update(dt: number) { t += dt; },
    draw(p: Painter) {
      const back = clamp(chainBack(t), 0, 5 * 38 + 10);
      beadChain(p, -4, -back, 0, 3, 22, t * 40);
      sickle(p, 0, 0, t * 36, 6);
    },
  };
}

export default { meta, create } satisfies PfxModule;
