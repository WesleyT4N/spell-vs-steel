// Shieldbreaker: a slow hammer comes down on the panel ahead: the head slams the floor, shields burst into glassy
// shards, and a gold shock rolls over both panels.
import { Particles, Bits, B, Rng, fit, sparkle, clamp, ease, hex } from '../../vendor/pixelfx/index.js';
import { RAMPS } from '../palette';
import { sparks, chunks, dust, shock } from '../lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Shieldbreaker', desc: 'A hammer slam that bursts shields into shards.', duration: 0.55, panels: 2, ink: '#3c3c3c' };

export function create(o: Opts) {
  const C = fit([...RAMPS.rage], 7), S = fit([...RAMPS.steel], 5), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: ['#fcfcfc', '#fce0a8', '#f8b800', '#f83800'] });
  const bits = new Bits({ ground: () => 0 });
  const GLASS = [hex('#0058f8'), hex('#3cbcfc'), hex('#a4e4fc')];
  let t = 0, hit = false;
  return {
    update(dt: number) {
      t += dt;
      if (!hit) {
        hit = true;
        sparks(ps, R, 8, -2, 8, -Math.PI / 2, 1.3, [60, 140]);
        for (let i = 0; i < 7; i++) bits.add({ kind: B.SHARD, x: 22 + R.range(-6, 6), y: -12 + R.range(-6, 6), vx: R.range(20, 110), vy: R.range(-110, -20), a: R.range(0, 6), va: R.range(-20, 20), s: R.range(1.5, 3), c: GLASS[R.int(0, 2)], g: 0.7, bounce: 0.2, life: R.range(0.3, 0.45) });
        chunks(bits, R, 8, -1, 3); dust(ps, R, 8, -1, 3);
      }
      ps.update(dt); bits.update(dt);
    },
    draw(p: Painter) {
      // the hammer head, just landed, lifting away
      if (t < 0.16) {
        const k = ease.inCubic(clamp(t / 0.16)), y = -9 - k * 6;
        p.beam(2, -24, 6, y, 2, S[2], 1 - k);
        p.rect(1, y - 1, 14, 9, (t < 0.04 ? S[4] : S[3]), 1 - k);
        p.rect(1, y + 6, 14, 2, S[2], 1 - k);
      }
      if (t < 0.07) sparkle(p, 8, -1, 7 * (1 - t / 0.07), C[5], C[4], 0.35);
      shock(p, 8, 0, t / 0.3, 14, C.slice(2));
      shock(p, 38, 0, (t - 0.06) / 0.3, 11, C.slice(2));
      bits.draw(p); ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
