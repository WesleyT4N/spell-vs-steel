// Scorch (scorch, on every burning panel that erupts): the burning floor splits along a glowing seam and a
// geyser of flame blasts straight up out of it, then falls back as embers rain down.
import { Particles, P, Rng, clamp, ease, sparkle } from '../../vendor/pixelfx/index.js';
import { FIRE, FIRE_SPARKS, flame } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Scorch', desc: 'The burning floor splits and a geyser of flame blasts up.', duration: 0.35, ink: '#881400' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: FIRE_SPARKS });
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) {
        go = true;
        for (let i = 0; i < 6; i++) ps.spawn(P.SPARK, R.range(-3, 3), -4, R.range(-40, 40), -R.range(90, 150), R.range(0.12, 0.24));
      }
      ps.update(dt);
    },
    draw(p: Painter) {
      const u = clamp(t / 0.35);
      // the seam
      p.line(-10, -1, 10, -1, u < 0.3 ? FIRE[6] : FIRE[3], 1 - u);
      p.line(-6, 0, 6, 0, FIRE[1], 1 - u);
      // the geyser: up fast, holds, sinks; two side tongues lag it
      const h = 23 * ease.outCubic(clamp(t / 0.05)) * (1 - ease.inQuad(clamp((t - 0.12) / 0.23)));
      flame(p, -6, -1, h * 0.5, 2.2, t * 30 + 1);
      flame(p, 6, -1, h * 0.55, 2.2, t * 30 + 3);
      flame(p, 0, -1, h, 5 - u * 2, t * 24);
      if (t < 0.06) sparkle(p, 0, -3, 5, FIRE[5], FIRE[4], 0.3);
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
