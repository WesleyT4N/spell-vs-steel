// Explosive Trap (sprung, on the trap's panel and the four round it): a geyser of fire bursts straight up out of
// the floor, white at its root, throws scorched grit and sinks into a dark smoke cap.
import { Particles, Rng, clamp, ease, hex, P } from '../../vendor/pixelfx/index.js';
import { chunks, DIRT } from '../lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';
import { Bits } from '../../vendor/pixelfx/index.js';
import { K } from './lib';

export const meta = { name: 'Explosive Trap', desc: 'A geyser of fire bursts up out of the floor.', duration: 0.44, ink: '#881400' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: ['#fcfcfc', '#f8b800', '#fca044', '#f83800'] });
  const bits = new Bits({ ground: () => 0 });
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) {
        go = true;
        chunks(bits, R, 0, -1, 4, 6, [60, 100], DIRT);
        for (let i = 0; i < 6; i++) ps.spawn(P.SPARK, R.range(-4, 4), -6, R.range(-40, 40), -R.range(60, 120), R.range(0.12, 0.25));
      }
      ps.update(dt); bits.update(dt);
    },
    draw(p: Painter) {
      // the geyser: a flame column that shoots up fast, then shrinks down to the floor
      const up = ease.outExpo(clamp((t + 0.03) / 0.08)), down = clamp((t - 0.12) / 0.22), h = 22 * up * (1 - down);
      if (h > 1) {
        const w = 6 * (1 - down * 0.5);
        p.shade(-w - 1, -h, w + 1, 0, (x: number, y: number, out: { c: number; a: number }) => {
          const k = -y / h, half = w * (1 - k * 0.55) + Math.sin(y * 0.9 + t * 40) * 0.8;
          if (Math.abs(x) > half) return;
          const core = Math.abs(x) < half * 0.45;
          out.c = k > 0.85 ? K.red0 : core ? (k < 0.4 && t < 0.15 ? K.white : K.gold) : k > 0.6 ? K.red1 : K.red2;
          out.a = 1;
        });
      }
      // a flat burst on the floor on the first frames
      if (t < 0.1) p.ellipse(0, -1, 11 - t * 30, 3, t < 0.04 ? K.white : K.gold);
      // smoke cap: dark brown puffs left where the flame top was
      const s = clamp((t - 0.14) / 0.3);
      if (s > 0 && s < 1) for (let i = 0; i < 3; i++) p.circle(-4 + i * 4, -16 + i % 2 * 2 - s * 4, 3 - s * 1.5, i === 1 ? K.coal : hex('#503000'), 1 - s);
      bits.draw(p); ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
