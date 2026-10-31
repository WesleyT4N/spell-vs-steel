// Death Mark: a violet reticle snaps onto the foe: four corner brackets close in round them, lock with a white
// flash, a small diamond mark burns on their chest, and the brackets blink twice before fading.
import { clamp, ease } from '../../vendor/pixelfx/index.js';
import { SHADOW, WHITE } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Death Mark', desc: 'A violet reticle closes on the foe and locks.', duration: 0.6, ink: '#000000' };

export function create(_o: Opts) {
  let t = 0;
  return {
    update(dt: number) { t += dt; },
    draw(p: Painter) {
      const close = ease.outBack(clamp(t / 0.14)), lock = t >= 0.14;
      const blink = t > 0.3 && Math.floor((t - 0.3) * 14) % 2 === 1;
      const fade = clamp((t - 0.46) / 0.12);
      if (fade < 1 && !blink) {
        const r = 11 - close * 4, cy = -12, c = lock && t < 0.2 ? WHITE : SHADOW[3];
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const x = sx * r, y = cy + sy * r;
          p.line(x, y, x - sx * 3, y, c, 1 - fade);
          p.line(x, y, x, y - sy * 3, c, 1 - fade);
        }
      }
      if (lock && fade < 1) {
        const k = clamp((t - 0.14) / 0.06), s = 1 + k;
        p.poly([[0, -12 - s - 1], [s + 1, -12], [0, -12 + s + 1], [-s - 1, -12]], t < 0.22 ? WHITE : SHADOW[2], 1 - fade);
        if (s > 1.5) p.px(0, -12, SHADOW[4]);
      }
    },
  };
}

export default { meta, create } satisfies PfxModule;
