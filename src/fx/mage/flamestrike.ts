// Flamestrike (pillar): the pillar comes down: a white-hot shaft of fire fills the box top to bottom on the hit
// frame, burns down through gold and orange into roaring tongues, and a ring of fire runs out over the floor.
import { Particles, P, Rng, clamp, ease, sparkle } from '../../vendor/pixelfx/index.js';
import { FIRE, FIRE_SPARKS, WHITE, flame, fireRing } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Flamestrike', desc: 'A white-hot shaft of fire slams down and roars into tongues.', duration: 0.45, ink: '#881400' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: FIRE_SPARKS });
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) {
        go = true;
        for (let i = 0; i < 8; i++) { const a = Math.PI + (i % 2 ? 0 : Math.PI) + R.range(-0.5, 0.2) * (i % 2 ? 1 : -1); ps.spawn(P.SPARK, 0, -2, Math.cos(a) * R.range(60, 110), -R.range(20, 60), R.range(0.12, 0.24)); }
        for (let i = 0; i < 5; i++) ps.spawn(P.EMBER, R.range(-6, 6), R.range(-16, -4), R.range(-10, 10), R.range(-50, -25), R.range(0.2, 0.3), 0, 1, R.range(0.04, 0.12));
      }
      ps.update(dt);
    },
    draw(p: Painter) {
      // the shaft: full height on frame 0, narrowing and cooling down the ramp
      const k = clamp(t / 0.16);
      if (k < 1) {
        const w = 6 * (1 - ease.inQuad(k)) + 1;
        p.shade(-w - 2, -24, w + 2, 0, (x: number, y: number) => {
          const e = Math.abs(x) / (w * (0.85 + 0.2 * Math.sin(y * 0.8 + t * 50)));
          if (e > 1) return;
          const heat = 1 - k;
          return e < 0.35 * heat + 0.1 ? WHITE : e < 0.7 ? FIRE[Math.max(3, Math.round(4 + heat * 1.6))] : FIRE[Math.round(2 + heat)];
        });
      }
      // the tongues roar up as the shaft thins, then die down
      const v = clamp((t - 0.06) / 0.39), hh = Math.sin(Math.PI * Math.pow(v, 0.55));
      if (v > 0 && v < 1) {
        flame(p, -6, -1, 12 * hh, 2.5, t * 26 + 2);
        flame(p, 6, -1, 13 * hh, 2.5, t * 26 + 5);
        flame(p, 0, -1, 21 * hh, 4, t * 22);
      }
      if (t < 0.06) sparkle(p, 0, -2, 6, FIRE[5], FIRE[4], 0.35);
      fireRing(p, 0, 0, t / 0.28, 12);
      p.glow(0, -10, 12, FIRE[4], 0.3 * (1 - k));
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
