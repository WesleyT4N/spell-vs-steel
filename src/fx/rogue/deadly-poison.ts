// Deadly Poison: the Rogue coats their blade: a dagger held up in front turns venom green from guard to point,
// a sick glint runs up it, and green drops fall from the edge.
import { Rng, clamp } from '../../vendor/pixelfx/index.js';
import { POISON, STEEL, WHITE, Bubbles, Drops, knife, glint } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Deadly Poison', desc: 'A dagger turns venom green and drips.', duration: 0.6, ink: '#000000' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const drops = new Drops(), bubbles = new Bubbles();
  // the blade, point up and a little forward
  const GX = 7, GY = -8, ANG = -1.25, L = 12;
  const ux = Math.cos(ANG), uy = Math.sin(ANG);
  let t = 0, next = 0.08, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) { go = true; for (let i = 0; i < 3; i++) bubbles.add(GX + R.range(-4, 4), GY - R.range(2, 8), -R.range(10, 18), R.range(1.3, 2), R.range(0.2, 0.3), 0.08 + i * 0.07); }
      if (t >= next && t < 0.3) { next += 0.09; const k = R.range(0.3, 0.8); drops.add(GX + ux * L * k + 1, GY + uy * L * k, R.range(-5, 5), 0, POISON[R.int(2, 3)], 0.25); }
      drops.update(dt); bubbles.update(dt);
    },
    draw(p: Painter) {
      const up = clamp(t / 0.06), fade = clamp((t - 0.42) / 0.12);
      if (fade < 1) {
        const a = up * (1 - fade);
        // venom climbs the blade: steel above the line, green below it
        const coat = clamp((t - 0.04) / 0.16);
        knife(p, GX + ux * L * 0.45, GY + uy * L * 0.45 + (1 - up) * 3, ANG, L, coat > 0.5 ? POISON : STEEL, undefined, a);
        if (coat > 0 && coat < 1) glint(p, GX + ux * L * coat * 0.9, GY + uy * L * coat * 0.9, 2, POISON[3], 0.25);
        if (coat >= 1 && t < 0.3) p.px(GX + ux * (L - 2), GY + uy * (L - 2), WHITE);
      }
      bubbles.draw(p); drops.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
