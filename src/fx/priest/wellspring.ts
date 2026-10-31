// Wellspring: a spring of blue Mana bursts up out of each panel of the Priest's row, droplets arcing out and falling
// back, a blue splash ring on the floor: the Mana blessing. Fx kind 'blessMana'.
import { Rng, clamp, hex } from '../../vendor/pixelfx/index.js';
import { BLESS, floorRing, drop } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Wellspring', desc: 'A spring of blue Mana bursts up, droplets arc and fall, a splash ring.', duration: 0.5, ink: '#0000bc' };

const G = 500; // px/s^2: droplets fall back fast

export function create(o: Opts) {
  const C = BLESS.mana.map(hex), R = new Rng(o.seed);
  const drops = [-1, 1, -1, 1].map((sd, i) => ({ vx: sd * (i < 2 ? R.range(8, 11) : R.range(14, 17)), vy: -R.range(90, 100) + (i < 2 ? 0 : 15), d: i * 0.03 }));
  let t = 0;
  return {
    update(dt: number) { t += dt; },
    draw(p: Painter) {
      // the jet: a column of water that shoots up and drops away
      const j = clamp(t / 0.08), jf = clamp((t - 0.1) / 0.14);
      if (jf < 1) {
        const top = -2 - j * 16 * (1 - jf * 0.3), bot = -1 - jf * 10;
        if (bot > top + 1) { p.rect(-1, top, 3, bot - top, C[2]); p.rect(0, top, 1, bot - top, C[4]); }
      }
      for (const d of drops) {
        const u = t - d.d;
        if (u <= 0) continue;
        const x = d.vx * u, y = -2 + d.vy * u + 0.5 * G * u * u;
        if (y > 0 || u > 0.45) continue;
        drop(p, x, y, C[2], C[4], 1);
      }
      floorRing(p, 0, 0, (t - 0.02) / 0.3, 9.5, C);
      floorRing(p, 0, 0, (t - 0.25) / 0.22, 7, C);
    },
  };
}

export default { meta, create } satisfies PfxModule;
