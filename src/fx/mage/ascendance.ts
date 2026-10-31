// Ascendance (ascendance, on the caster): the Mage becomes pure arcane: a rune flares open on the floor,
// streaks of light climb either side, a turning halo seal settles over the head and a great star bursts at the
// top as the change takes hold.
import { Particles, P, Rng, clamp, ease, flare, hex } from '../../vendor/pixelfx/index.js';
import { column } from '../lib';
import { ARC, ARC_SPARKS, WHITE, rune } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Ascendance', desc: 'A floor rune, climbing streaks, a halo and a great star burst.', duration: 0.8, ink: '#940084' };

const FLARE = ['#940084', '#d800cc', '#f878f8', '#f8b8f8'];

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: ARC_SPARKS });
  let t = 0, burst = false;
  return {
    update(dt: number) {
      t += dt;
      if (!burst && t > 0.42) {
        burst = true;
        for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; ps.spawn(P.SPARK, 0, -14, Math.cos(a) * R.range(70, 110), Math.sin(a) * R.range(50, 90), R.range(0.12, 0.22)); }
        for (let i = 0; i < 5; i++) ps.spawn(P.STAR, R.range(-10, 10), R.range(-22, -4), 0, -8, R.range(0.2, 0.35), hex(ARC_SPARKS[1]), 0.5, R.range(0, 0.15));
      }
      ps.update(dt);
    },
    draw(p: Painter) {
      rune(p, 0, -1, 4 + ease.outCubic(clamp(t / 0.25)) * 7, t * 8, ARC[2], WHITE, 1 - clamp((t - 0.6) / 0.2), 0.3);
      column(p, (t - 0.05) / 0.6, 11, ARC);
      // the halo settles down over the head, turning
      const h = clamp((t - 0.15) / 0.3), hy = -22 + ease.outCubic(h) * 2, ha = h > 0 ? 1 - clamp((t - 0.6) / 0.2) : 0;
      for (let j = 0; j < 22; j++) {
        const g = (j / 22) * Math.PI * 2 + t * 6, x = Math.cos(g) * 6, y = hy + Math.sin(g) * 1.6;
        p.dot(x, y, j % 6 === 0 ? WHITE : Math.sin(g) > 0 ? ARC[3] : ARC[1], ha);
      }
      const f = clamp((t - 0.42) / 0.2);
      if (f > 0 && f < 1) flare(p, 0, -14, 11 * (1 - ease.inQuad(f)) + 1, 0.5, FLARE);
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
