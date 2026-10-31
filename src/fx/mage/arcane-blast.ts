// Arcane Blast (arcaneHit, on the enemy): a shaft of force slams down onto the target on the hit frame, white at
// its heart, and bursts: an eight-ray flare, a rune ring blown open over the floor and sparks of pink light.
import { Particles, P, Rng, clamp, ease, flare } from '../../vendor/pixelfx/index.js';
import { shock } from '../lib';
import { ARC, ARC_SPARKS, WHITE, rune, shaft } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Arcane Blast', desc: 'A shaft of force slams down and bursts in a flare and an open rune.', duration: 0.35, ink: '#000000' };

const FLARE = ['#940084', '#d800cc', '#f878f8', '#f8b8f8'];

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: ARC_SPARKS });
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) { go = true; for (let i = 0; i < 9; i++) { const a = R.range(0, Math.PI * 2); ps.spawn(P.SPARK, 0, -11, Math.cos(a) * R.range(60, 110), Math.sin(a) * R.range(40, 90) - 20, R.range(0.1, 0.22)); } }
      ps.update(dt);
    },
    draw(p: Painter) {
      // the shaft: full on frame 0, pinching to a thread
      const k = clamp(t / 0.12);
      if (k < 1) {
        shaft(p, 0, -24, 0, -2, 4.5 * (1 - ease.outQuad(k)) + 0.5, ARC);
      }
      const f = clamp((t - 0.02) / 0.16);
      if (f > 0 && f < 1) flare(p, 0, -11, 10 * (1 - ease.inQuad(f)) + 1, 0.5, FLARE);
      rune(p, 0, -1, 4 + ease.outCubic(clamp(t / 0.25)) * 8, t * 10, ARC[2], WHITE, 1 - clamp((t - 0.15) / 0.2), 0.3);
      shock(p, 0, 0, t / 0.22, 12, ARC);
      p.glow(0, -11, 12, ARC[2], 0.35 * (1 - k));
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
