// Riposte: the Rogue takes a parry stance: two daggers cross in an X in front of them with a bright "ting" where
// they meet and a thin ring of steel. (It also plays when the parry lands.) The counter is riposte-hit.
import { clamp, ease } from '../../vendor/pixelfx/index.js';
import { STEEL, knife, glint } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Riposte', desc: 'Two daggers cross in a parry with a ring of steel.', duration: 0.4, ink: '#000000' };

export function create(_o: Opts) {
  let t = 0;
  return {
    update(dt: number) { t += dt; },
    draw(p: Painter) {
      const up = ease.outBack(clamp(t / 0.08)), fade = clamp((t - 0.26) / 0.12);
      if (fade < 1) {
        const a = 1 - fade, cx = 5, cy = -12, sw = (1 - up) * 0.5;
        knife(p, cx, cy, -Math.PI / 2 + 0.6 + sw, 11, STEEL, undefined, a);
        knife(p, cx, cy, -Math.PI / 2 - 0.6 - sw, 11, STEEL, undefined, a);
      }
      const g = t - 0.06;
      if (g > 0 && g < 0.12) glint(p, 5, -14, 4 * (1 - g / 0.12) + 1, STEEL[3], 0.3);
      const r = (t - 0.06) / 0.2;
      if (r > 0 && r < 1) p.ring(5, -14, 2 + ease.outCubic(r) * 4, 1, STEEL[3], 1 - r);
    },
  };
}

export default { meta, create } satisfies PfxModule;
