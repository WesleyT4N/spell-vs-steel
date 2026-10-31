// Ice Block (iceBlock, on the caster): frost races up the Mage from the floor as a rising white line, ice
// crystals crust up round the feet, and the block seals with a white flash across its face.
import { Particles, P, Rng, clamp, ease, hex } from '../../vendor/pixelfx/index.js';
import { ICE, WHITE, spike } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Ice Block', desc: 'Frost races up the Mage and the block seals with a flash.', duration: 0.4, ink: '#0000bc' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0 });
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) { go = true; for (let i = 0; i < 6; i++) ps.spawn(P.FLAKE, R.range(-11, 11), R.range(-22, -2), R.range(-8, 8), R.range(-12, 0), R.range(0.18, 0.25), hex(i % 2 ? '#fcfcfc' : '#a4e4fc'), 1, R.range(0, 0.12)); }
      ps.update(dt);
    },
    draw(p: Painter) {
      // the frost line climbs the block's face
      const u = clamp(t / 0.16), y = -1 - ease.outCubic(u) * 22;
      if (u < 1) { p.line(-10, y, 10, y, WHITE); p.line(-10, y + 1, 10, y + 1, ICE[3]); p.line(-10, -1, -10, y, ICE[4]); p.line(10, -1, 10, y, ICE[4]); }
      // the seal: a flash running diagonally over the face
      const s = (t - 0.15) / 0.12;
      if (s > 0 && s < 1) for (let k = 0; k < 3; k++) { const x0 = -19 + s * 28 - k * 2; p.line(Math.max(-10, x0), -1 - Math.max(0, -10 - x0) * 2.2, Math.min(10, x0 + 10), -23 + Math.max(0, x0 + 10 - 10) * 2.2, k ? ICE[4] : WHITE, 1 - s * 0.5); }
      // crystals crust round the feet and melt back into the block
      const c = Math.sin(Math.PI * clamp(t / 0.36));
      spike(p, -8, 0, 7 * c, 4, -0.5); spike(p, 8, 0, 8 * c, 4, 0.5); spike(p, -3, 1, 4 * c, 3, 0); spike(p, 4, 1, 5 * c, 3, 0);
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
