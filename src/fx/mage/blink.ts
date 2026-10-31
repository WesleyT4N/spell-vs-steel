// Blink (blink, on the old and the new panel): space folds: a tall lens-shaped rift of white and pink stands where
// the Mage is on the first frame, snaps shut to a hairline, and spits a few motes; a rune flashes on the floor.
import { Particles, P, Rng, clamp, ease, hex } from '../../vendor/pixelfx/index.js';
import { ARC, WHITE, rune } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Blink', desc: 'A tall rift folds shut where the Mage stands, spitting motes.', duration: 0.3, ink: '#940084' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0 });
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) {
        go = true;
        for (let i = 0; i < 6; i++) ps.spawn(P.STAR, R.range(-3, 3), R.range(-20, -4), R.range(-40, 40), R.range(-20, 10), R.range(0.15, 0.28), hex(i % 2 ? '#f878f8' : '#f8b8f8'), 0.5);
      }
      ps.update(dt);
    },
    draw(p: Painter) {
      // the rift: widest on the first frame, then pinched shut from the middle out
      const u = clamp(t / 0.16), w = 6 * (1 - ease.outCubic(u)), h = 11 * (1 - ease.inQuad(u) * 0.8);
      if (u < 1) {
        p.shade(-7, -23, 7, 0, (x: number, y: number) => {
          const v = (y + 11.5) / h, half = w * (1 - v * v);
          if (Math.abs(v) > 1 || Math.abs(x) > half + 0.5) return;
          const e = Math.abs(x) / Math.max(0.5, half);
          return e < 0.35 ? WHITE : e < 0.75 ? ARC[3] : ARC[2];
        });
        if (u < 0.5) p.line(0, -22, 0, -1, WHITE, 1 - u * 2);
      }
      rune(p, 0, -1, 4 + t * 25, t * 10, ARC[1], ARC[3], 1 - clamp(t / 0.25));
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
