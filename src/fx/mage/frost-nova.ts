// Frost Nova, sprung (nova, on the caster and on the frozen enemy): a crown of ice spears bursts out of the floor
// round the fighter on the hit frame, flashes white, a frost ring rolls out, and the spears crack into shards.
import { Particles, Bits, B, P, Rng, clamp, ease, hex } from '../../vendor/pixelfx/index.js';
import { shock } from '../lib';
import { ICE, ICE_SPARKS, spike } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Frost Nova', desc: 'A crown of ice spears bursts up round the fighter and cracks apart.', duration: 0.5, ink: '#0000bc' };

// the crown: spears round the feet, the back ones shorter, leaning outward
const SPEARS: Array<[number, number, number, number]> = [[-9, -2, 9, -2], [-4, -3, 12, -1], [4, -3, 13, 1], [9, -2, 10, 2], [-7, 1, 7, -1.5], [7, 1, 8, 1.5]];

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: ICE_SPARKS });
  const bits = new Bits({ ground: () => 0 });
  let t = 0, go = false, broke = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) { go = true; for (let i = 0; i < 6; i++) ps.spawn(P.SPARK, R.range(-8, 8), -4, R.range(-60, 60), -R.range(40, 90), R.range(0.1, 0.2)); }
      if (!broke && t > 0.26) {
        broke = true;
        for (const [x, y, h] of SPEARS) for (let k = 0; k < 2; k++) bits.add({ kind: B.SHARD, x, y: y - h * R.range(0.3, 0.8), vx: R.range(-40, 40), vy: -R.range(20, 60), a: R.range(0, 3), va: R.range(-15, 15), s: R.range(2, 3), c: hex(R.pick(['#3cbcfc', '#a4e4fc'])), g: 0.6, life: R.range(0.15, 0.24) });
        for (let i = 0; i < 4; i++) ps.spawn(P.FLAKE, R.range(-9, 9), R.range(-14, -4), R.range(-10, 10), R.range(-14, -4), R.range(0.15, 0.22), hex('#fcfcfc'), 1);
      }
      ps.update(dt); bits.update(dt);
    },
    draw(p: Painter) {
      // spears: full on the hit frame (an overshoot), white for two frames, then gone when they crack
      const grow = 0.85 + 0.15 * ease.outBack(clamp(t / 0.06)), white = t < 0.035;
      if (t < 0.26) for (const [x, y, h, lean] of SPEARS) spike(p, x, y, h * grow, 4, lean, { white, glint: (t * 5) % 1 });
      shock(p, 0, 0, t / 0.3, 12, ICE.slice(1));
      bits.draw(p); ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
