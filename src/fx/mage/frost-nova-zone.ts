// Frost Nova, laid (novaZone, on the caster): a frost rune spreads out over the floor round the Mage, frost
// creeping along its ring with ticks of ice standing up on it, and snow lifting off as it settles in to wait.
import { Particles, P, Rng, clamp, ease, hex } from '../../vendor/pixelfx/index.js';
import { ICE, WHITE, rune, spike } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Frost Nova (laid)', desc: 'A frost rune spreads over the floor with ticks of ice on its ring.', duration: 0.6, ink: '#0000bc' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0 });
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) { go = true; for (let i = 0; i < 6; i++) ps.spawn(P.FLAKE, R.range(-10, 10), R.range(-3, -1), R.range(-6, 6), R.range(-30, -12), R.range(0.35, 0.55), hex(i % 2 ? '#fcfcfc' : '#a4e4fc'), 1, R.range(0, 0.15)); }
      ps.update(dt);
    },
    draw(p: Painter) {
      const u = clamp(t / 0.6), r = 3 + ease.outCubic(clamp(t / 0.3)) * 8, a = 1 - ease.inQuad(clamp((u - 0.55) / 0.45));
      rune(p, 0, -1, r, t * 3, ICE[3], WHITE, a, 0.3);
      rune(p, 0, -1, r - 3, -t * 4, ICE[2], ICE[4], a * 0.8, 0.3);
      // little ice ticks stand up on the ring as it passes, front ones taller
      for (let i = 0; i < 6; i++) {
        const g = (i / 6) * Math.PI * 2 + 0.4, x = Math.cos(g) * r, y = -1 + Math.sin(g) * r * 0.3;
        const h = (Math.sin(g) > 0 ? 5 : 3) * Math.sin(Math.PI * clamp((t - 0.05 - i * 0.02) / 0.5));
        spike(p, x, y + 1, h, 2.5, 0, { a });
      }
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
