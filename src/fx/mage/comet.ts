// Comet Storm (comet, on each struck panel): the comet's streak is still burning down from the top corner
// on the hit frame as its head bursts on the panel: a small hard fireball, a ring and a spray of sparks.
import { Particles, P, Rng, clamp, sparkle } from '../../vendor/pixelfx/index.js';
import { FIRE, FIRE_SPARKS, blast, fireRing } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Comet', desc: 'A streak from the sky and a hard burst on the panel.', duration: 0.35, ink: '#881400' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: FIRE_SPARKS });
  // each comet comes in at its own angle
  const sx = R.range(-11, -5);
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) {
        go = true;
        for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + R.range(-1.2, 1.2); ps.spawn(P.SPARK, 0, -4, Math.cos(a) * R.range(60, 110), Math.sin(a) * R.range(60, 110), R.range(0.1, 0.2)); }
      }
      ps.update(dt);
    },
    draw(p: Painter) {
      // the streak burns away from its top end down
      const s = clamp(t / 0.12);
      if (s < 1) {
        const x0 = sx + (0 - sx) * s, y0 = -24 + 18 * s;
        p.beam(x0, y0, 0, -6, 3 - s * 1.5, (u: number) => (u > 0.6 ? FIRE[6] : u > 0.3 ? FIRE[4] : FIRE[2]));
      }
      const u = clamp(t / 0.35);
      blast(p, 0, -6 - u * 3, 4 + clamp(t / 0.06) * 2.5 - u * 5, 1 - u * 0.9, o.seed % 43, t, clamp((1 - u) / 0.15));
      if (t < 0.05) sparkle(p, 0, -5, 5, FIRE[5], FIRE[4], 0.3);
      fireRing(p, 0, 0, t / 0.22, 11);
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
