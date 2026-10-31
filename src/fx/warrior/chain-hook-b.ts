// Chain Hook draft B, "Grapple Line": a three-clawed grapple flies with its claws flung wide, on a taut steel
// cable running dead straight back to the Warrior's fist, glints racing out along it. Its hit is chain-hook-b-hit.
import { clamp } from '../../vendor/pixelfx/index.js';
import { cable, chainBack, grapple } from './chain-lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Chain Hook: Grapple Line', desc: 'A clawed grapple on a taut steel cable.', duration: 3, panels: 6, ink: '#000000' };

export function create(_o: Opts) {
  let t = 0;
  return {
    update(dt: number) { t += dt; },
    draw(p: Painter) {
      const back = clamp(chainBack(t), 0, 5 * 38 + 10);
      cable(p, -6, -back, -1, -t * 300);
      // claws spring open as it leaves the hand, then quiver
      const open = clamp(t / 0.05) * (0.85 + 0.15 * (Math.round(t * 30) % 2));
      grapple(p, -6, 0, open);
    },
  };
}

export default { meta, create } satisfies PfxModule;
