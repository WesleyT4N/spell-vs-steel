// Iron Skin: a sheen of steel washes down the Warrior from head to foot, and a few flakes of metal fall away.
import { Particles, Rng, fit, clamp, hex, P } from '../../vendor/pixelfx/index.js';
import { RAMPS } from '../palette';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Iron Skin', desc: 'A steel sheen washes down the Warrior.', duration: 0.5 };

export function create(o: Opts) {
  const S = fit([...RAMPS.steel], 5), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0 });
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) { go = true; for (let i = 0; i < 6; i++) ps.spawn(P.FLAKE, R.range(-7, 7), R.range(-20, -6), R.range(-10, 10), R.range(-5, 5), R.range(0.3, 0.45), hex(i % 2 ? '#bcbcbc' : '#fcfcfc'), 1.5, R.range(0.05, 0.25)); }
      ps.update(dt);
    },
    draw(p: Painter) {
      const k = clamp(t / 0.3);
      if (k < 1) {
        const y = -24 + k * 24;
        p.rect(-8, y, 16, 2, S[4], 0.9);
        p.rect(-8, y - 3, 16, 3, S[3], 0.5);
        p.glowLine(-8, y, 8, y, 3, S[3], 0.25);
      }
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
