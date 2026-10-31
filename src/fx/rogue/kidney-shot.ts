// Kidney Shot: a low hooking stab under the ribs of the foe ahead: a short downward crescent, a white star at the
// bite, and three little gold stars wheel round the foe's head (the stun).
import { Particles, Rng, clamp, hex } from '../../vendor/pixelfx/index.js';
import { sparks } from '../lib';
import { STEEL, STEEL_SPARKS, WHITE, crescent, glint } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Kidney Shot', desc: 'A low hooking stab, then stun stars wheel round the head.', duration: 0.6, panels: 2, ink: '#000000' };

const STAR = hex('#f8d878'), STAR2 = hex('#f8b800');

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: STEEL_SPARKS });
  let t = 0, hit = false;
  return {
    update(dt: number) {
      t += dt;
      if (!hit) { hit = true; sparks(ps, R, 36, -7, 4, 0.5, 0.7, [40, 90]); }
      ps.update(dt);
    },
    draw(p: Painter) {
      crescent(p, STEEL, 28, -12, 8, 0.8, -1.6, 0.9, t, -0.045, 3, 0.045, 0.03, 0.12);
      if (t < 0.08) glint(p, 35, -7, 4 * (1 - t / 0.08) + 1, STEEL[3], 0.3);
      // stun stars
      const s = clamp((t - 0.08) / 0.45);
      if (s > 0 && s < 1) for (let i = 0; i < 3; i++) {
        const a = t * 12 + (i / 3) * Math.PI * 2, x = 38 + Math.cos(a) * 6, y = -21 + Math.sin(a) * 1.5;
        if (s > 0.8 && i === Math.floor(t * 30) % 3) continue;
        p.px(x, y, WHITE); p.px(x - 1, y, STAR); p.px(x + 1, y, STAR); p.px(x, y - 1, STAR2); p.px(x, y + 1, STAR2);
      }
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
