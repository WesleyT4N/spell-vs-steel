// Arcane Surge (arcaneSurge, on the enemy): everything the Mage had, at once: three shafts of force crash
// down together on the hit frame, an orb of raw arcane swells and pops in a huge flare, and two rune rings and a
// heavy shock blow out over the floor. The hardest hit in the spell deck should look it.
import { Particles, P, Rng, clamp, ease, flare, hex } from '../../vendor/pixelfx/index.js';
import { shock } from '../lib';
import { ARC, ARC_SPARKS, WHITE, orb, rune, shaft } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Arcane Surge', desc: 'Three shafts of force crash down, an orb pops in a huge flare.', duration: 0.5, ink: '#000000' };

const FLARE = ['#940084', '#d800cc', '#f878f8', '#f8b8f8'];

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: ARC_SPARKS });
  let t = 0, go = false, pop = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) { go = true; for (let i = 0; i < 6; i++) ps.spawn(P.SPARK, R.range(-8, 8), -2, R.range(-50, 50), -R.range(50, 100), R.range(0.1, 0.2)); }
      if (!pop && t > 0.12) {
        pop = true;
        for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + R.range(-0.2, 0.2); ps.spawn(P.SPARK, 0, -11, Math.cos(a) * R.range(90, 140), Math.sin(a) * R.range(70, 120), R.range(0.12, 0.24)); }
        for (let i = 0; i < 5; i++) ps.spawn(P.STAR, R.range(-10, 10), R.range(-22, -4), 0, -10, R.range(0.15, 0.3), hex(ARC_SPARKS[1]), 0.5, R.range(0, 0.1));
      }
      ps.update(dt);
    },
    draw(p: Painter) {
      // three shafts, the middle widest, the outer pair a beat thinner
      const k = clamp(t / 0.14);
      if (k < 1) for (const [x, w0] of [[-9, 2], [9, 2], [0, 4.5]] as const) shaft(p, x, -24, x * 0.4, -2, w0 * (1 - ease.outQuad(k)) + 0.5, ARC);
      // the orb swells, then pops into the flare
      if (t > 0.03 && t < 0.12) orb(p, 0, -11, 3 + ((t - 0.03) / 0.09) * 6, ARC, 0.6);
      const f = clamp((t - 0.12) / 0.22);
      if (f > 0 && f < 1) flare(p, 0, -11, 12 * (1 - ease.inQuad(f)) + 1, 0.6, FLARE);
      rune(p, 0, -1, 5 + ease.outCubic(clamp(t / 0.3)) * 7, t * 12, ARC[2], WHITE, 1 - clamp((t - 0.25) / 0.25), 0.3);
      rune(p, 0, -1, 3 + ease.outCubic(clamp((t - 0.1) / 0.3)) * 6, -t * 16, ARC[1], ARC[3], 1 - clamp((t - 0.3) / 0.2), 0.3);
      shock(p, 0, 0, (t - 0.12) / 0.3, 12, ARC, 2.5);
      p.glow(0, -11, 12, ARC[2], 0.35 * (1 - clamp(t / 0.3)));
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
