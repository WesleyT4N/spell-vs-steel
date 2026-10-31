// Counterspell (counter, on the Mage when cast and on a caster whose spell is cancelled): a seal of warding stands
// over the fighter, a white slash cuts it in two and the halves slide apart and fall away into sparks.
import { Particles, P, Rng, clamp, ease } from '../../vendor/pixelfx/index.js';
import { ARC, ARC_SPARKS, WHITE } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Counterspell', desc: 'A ward seal is slashed in two and its halves fall away.', duration: 0.5, ink: '#940084' };

const CX = 0, CY = -14, RR = 8;

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: ARC_SPARKS });
  let t = 0, cut = false;
  return {
    update(dt: number) {
      t += dt;
      if (!cut && t > 0.14) { cut = true; for (let i = 0; i < 8; i++) { const s = R.range(-1, 1); ps.spawn(P.SPARK, CX + s * 7, CY + s * 7, R.range(-60, 60), R.range(-60, 20), R.range(0.1, 0.2)); } }
      ps.update(dt);
    },
    draw(p: Painter, _t: number, q: Opts) {
      void q;
      // the seal draws on in its first beat: a ring, a cross of glyph bars and four ticks
      const on = ease.outCubic(clamp(t / 0.1)), part = ease.inQuad(clamp((t - 0.16) / 0.3)), a = 1 - clamp((t - 0.36) / 0.14);
      for (const side of [-1, 1]) {
        // each half slides away along the cut's normal and drops
        const dx = side * part * 6, dy = side * -part * 3 + part * part * 8;
        const m = 40;
        for (let j = 0; j < m * on; j++) {
          const g = (j / m) * Math.PI * 2, x = Math.cos(g) * RR, y = Math.sin(g) * RR;
          if ((x + y) * side < 0) continue; // which side of the cut this pixel is on
          p.dot(CX + x + dx, CY + y + dy, j % 5 === 0 ? WHITE : ARC[2], a);
        }
        // the inner glyph: a diamond split by the cut
        for (let i = -4; i <= 4; i++) {
          const pts: Array<[number, number]> = [[i, -(4 - Math.abs(i))], [i, 4 - Math.abs(i)]];
          for (const [x, y] of pts) if ((x + y) * side >= 0) p.dot(CX + x + dx, CY + y + dy, ARC[3], a * on);
        }
      }
      // the slash: a white line across the seal, there and gone
      const s = clamp((t - 0.1) / 0.08);
      if (s > 0 && s < 1) p.line(CX - 10, CY + 10, CX - 10 + 20 * ease.outCubic(s), CY + 10 - 20 * ease.outCubic(s), WHITE);
      if (s >= 1 && t < 0.24) p.line(CX - 10, CY + 10, CX + 10, CY - 10, ARC[3], 1 - (t - 0.18) / 0.06);
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
