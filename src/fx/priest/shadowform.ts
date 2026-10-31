// Shadowform (on the Priest): shadow boils up out of the floor round the Priest in black-violet puffs and tendrils,
// swallows them to the shoulders, two lilac eyes open in it, and it thins away. Fx kind 'shadowform'
// (was transform). The enemy's panels play shadowform-curse.
import { Rng, clamp, ease } from '../../vendor/pixelfx/index.js';
import { VIOLET, tendril } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Shadowform', desc: 'Shadow boils up and swallows the Priest, two lilac eyes open in it.', duration: 1, ink: '#000000' };

export function create(o: Opts) {
  const V = VIOLET(), R = new Rng(o.seed);
  const puffs = Array.from({ length: 7 }, (_, i) => ({ x: -7.5 + i * 2.5 + R.range(-0.5, 0.5), top: R.range(-18, -12), r: R.range(2.5, 3.5), d: R.range(0, 0.12) }));
  let t = 0;
  return {
    update(dt: number) { t += dt; },
    draw(p: Painter) {
      const thin = clamp((t - 0.55) / 0.4);
      if (thin >= 1) return;
      for (const pf of puffs) {
        const u = ease.outCubic(clamp((t - pf.d) / 0.25));
        if (u <= 0) continue;
        const y = -1 + (pf.top + 1) * u + thin * 4, r = pf.r * (1 - thin) * (0.6 + 0.4 * u) + Math.sin(t * 12 + pf.x) * 0.3;
        // one solid mass (the ink traces round the whole of it), shaded darker low down
        p.circle(pf.x, y, r, V[1]); p.circle(pf.x, (y - 1) / 2, r * 0.9, V[1]);
        p.circle(pf.x, (y - 1) / 2 + 1, r * 0.5, V[0]);
      }
      const k = clamp(t / 0.6);
      if (k < 1) for (let i = 0; i < 3; i++) tendril(p, -6 + i * 6, -2, -Math.PI / 2 + (i - 1) * 0.3, 14 * Math.sin(Math.PI * k), t * 18 + i * 2, V, 1 - thin);
      // the eyes: open at 0.3, blink at 0.5, close as it thins
      if (t > 0.3 && thin < 0.6 && !(t > 0.5 && t < 0.54)) { p.rect(-3, -18, 2, 1, V[4]); p.rect(2, -18, 2, 1, V[4]); p.glow(0, -18, 5, V[3], 0.3); }
    },
  };
}

export default { meta, create } satisfies PfxModule;
