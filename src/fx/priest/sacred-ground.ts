// Sacred Ground: a gold glyph blooms open on the floor of every panel of the Priest's area, rays of light lift off
// its rim and a single cross rises from its heart: the heal blessing, everywhere. Fx kind 'blessSacred'.
import { Rng, clamp, ease } from '../../vendor/pixelfx/index.js';
import { GOLD, sigil, cross } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Sacred Ground', desc: 'A gold glyph blooms on every panel, rays lift off its rim, a cross rises.', duration: 0.5, ink: '#503000' };

export function create(o: Opts) {
  const G = GOLD(), R = new Rng(o.seed);
  const turn = R.range(0, 1);
  let t = 0;
  return {
    update(dt: number) { t += dt; },
    draw(p: Painter) {
      const open = ease.outBack(clamp(t / 0.14)), fade = clamp((t - 0.28) / 0.22);
      if (fade >= 1) return;
      const a = 1 - fade;
      sigil(p, 0, -1, 2 + 7 * open, turn + t * 4, G, a, 6);
      sigil(p, 0, -1, 1 + 5 * open, -turn - t * 6, G, a, 4);
      // rays lifting off the rim: short gold dashes climbing
      for (let i = 0; i < 6; i++) {
        const g = turn + (i / 6) * Math.PI * 2, x = Math.cos(g) * 8.5 * open, u = clamp((t - 0.06) / 0.3);
        if (u <= 0 || u >= 1 || Math.sin(g) < -0.2) continue;
        const y = -1 + Math.sin(g) * 3 - u * 12;
        p.rect(x, y, 1, 3, u < 0.4 ? G[5] : G[4], a);
      }
      const c = clamp((t - 0.1) / 0.35);
      if (c > 0 && c < 1) cross(p, 0, -5 - c * 10, 1, G[4], G[5], 1 - c * c);
    },
  };
}

export default { meta, create } satisfies PfxModule;
