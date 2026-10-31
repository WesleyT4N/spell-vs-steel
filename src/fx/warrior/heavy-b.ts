// Heavy Cleave, draft B "Ground rend": the chop bites the panel ahead and tears a glowing fissure along the floor
// of both panels, with chunks popping up one after another as it runs and dust settling behind.
import { Particles, Bits, B, P, Rng, fit, sparkle, clamp, ease, hex } from '../../vendor/pixelfx/index.js';
import { RAMPS } from '../palette';
import { drawSwing, type Swing } from '../lib';
import type { PfxModule, Opts } from '../../game/pfx';

export const meta = { name: 'Heavy Cleave: Ground rend', desc: 'A chop tears a glowing fissure along both panels.', duration: 0.7, panels: 2, ink: '#503000' };

export function create(o: Opts) {
  const C = fit([...RAMPS.rage], 7), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: ['#fcfcfc', '#fce0a8', '#f8b800', '#f83800'] });
  const bits = new Bits({ ground: () => 0 });
  const A: Swing = { cx: -2, cy: -11, R: 12, sy: 1, rot: 0.2, a0: -2.5, a1: 0.5, W: 6, t0: -0.065, sweep: 0.07, hold: 0.04, trail: 0.16, ramp: C };
  const LAND = 0, RUN = 0.18, X0 = 2, X1 = 48;
  const popped = new Set<number>();
  // the fissure's zigzag, fixed per seed
  const zig = Array.from({ length: X1 - X0 + 1 }, (_, i) => (i % 5 === 0 ? R.int(-1, 1) : 0));
  let t = 0;
  return {
    update(dt: number) {
      t += dt;
      const head = X0 + (X1 - X0) * ease.outCubic(clamp((t - LAND) / RUN));
      for (let x = X0 + 6; x <= head; x += 9) {
        if (popped.has(x)) continue;
        popped.add(x);
        bits.add({ kind: B.CHUNK, x, y: -1, vx: R.range(-15, 25), vy: R.range(-100, -60), a: 0, va: R.range(-12, 12), s: R.range(1.2, 2.2), c: hex('#ac7c00'), ramp: [hex('#503000'), hex('#ac7c00'), hex('#f0d0b0')], g: 0.8, bounce: 0.3, life: R.range(0.3, 0.45) });
        ps.spawn(P.SPARK, x, -1, R.range(-20, 40), R.range(-110, -50), R.range(0.1, 0.22));
        ps.spawn(P.DUST, x, -1, R.range(-8, 8), R.range(-8, -3), R.range(0.3, 0.4), hex('#f0d0b0'), 2, 0.05);
      }
      ps.update(dt); bits.update(dt);
    },
    draw(p: any) {
      drawSwing(p, A, t, 0.3);
      const u = t - LAND;
      if (u >= 0 && u < 0.05) sparkle(p, X0, -2, 5, C[5], C[4], 0.6);
      if (u >= 0) {
        const head = X0 + (X1 - X0) * ease.outCubic(clamp(u / RUN)), fade = clamp((u - RUN) / 0.3);
        for (let x = X0; x <= head; x++) {
          const y = zig[x - X0], hot = head - x < 4 && fade === 0;
          p.dot(x, y, hot ? C[6] : fade < 0.4 ? C[4] : C[2], 1 - fade);
          if (!hot && fade < 0.6) p.dot(x, y + 1, C[1], 1 - fade * 1.4);
        }
        if (fade < 1) p.glowLine(X0, 0, head, 0, 3, C[4], 0.35 * (1 - fade));
      }
      bits.draw(p); ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
