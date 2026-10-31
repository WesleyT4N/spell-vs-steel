// Freezing Trap (sprung): steel jaws snap shut on the floor, ice crystals spear up either side of the victim, a
// frost ring rolls out and snowflakes hang in the air.
import { Particles, Rng, fit, crystal, clamp, ease, hex, P } from '../../vendor/pixelfx/index.js';
import { RAMPS } from '../palette';
import { shock } from '../lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';
import { jaws, K } from './lib';

export const meta = { name: 'Freezing Trap', desc: 'Jaws snap, ice crystals spear up, a frost ring rolls out.', duration: 0.62, ink: '#0000bc' };

export function create(o: Opts) {
  const C = fit([...RAMPS.frost], 6), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0 });
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) { go = true; for (let i = 0; i < 8; i++) ps.spawn(P.FLAKE, R.range(-10, 10), R.range(-20, -4), R.range(-8, 8), R.range(-12, 2), R.range(0.35, 0.55), hex(i % 2 ? '#fcfcfc' : '#a4e4fc'), R.range(1, 1.6), R.range(0, 0.1)); }
      ps.update(dt);
    },
    draw(p: Painter) {
      const fade = 1 - clamp((t - 0.4) / 0.18);
      if (fade <= 0) return;
      const g = ease.outBack(clamp((t + 0.02) / 0.12));
      // crystals: tall ones either side, a short one in front; they sink and dither out at the end
      const sh = (h: number) => h * g * (0.6 + 0.4 * fade);
      crystal(p, -8, 0, sh(12), 4, -1, RAMPS.frost.slice(1) as unknown as string[], { a: fade });
      crystal(p, 8, 0, sh(14), 4, 1, RAMPS.frost.slice(1) as unknown as string[], { a: fade });
      crystal(p, 2, 1, sh(7), 4, 0.5, RAMPS.frost.slice(1) as unknown as string[], { a: fade });
      jaws(p, 1 - clamp((t + 0.04) / 0.06), K.steel, K.iron);
      shock(p, 0, 0, t / 0.35, 10, C.slice(1), 1.5);
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
