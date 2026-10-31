// Heavy Cleave, draft A "Overhead chop": a tall gold crescent drops from above onto the panel ahead, flashes on
// impact, and the blow rings out along both panels as a floor shock with grit and dust kicked up.
import { Particles, Bits, B, P, Rng, fit, sparkle, band, clamp, ease, hex } from '../../vendor/pixelfx/index.js';
import { RAMPS } from '../palette';
import { drawSwing, type Swing } from '../lib';
import type { PfxModule, Opts } from '../../game/pfx';

export const meta = { name: 'Heavy Cleave: Overhead chop', desc: 'A gold crescent chops down; a floor shock runs over both panels.', duration: 0.7, panels: 2, ink: '#503000' };

export function create(o: Opts) {
  const C = fit([...RAMPS.rage], 7), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: ['#fcfcfc', '#fce0a8', '#f8b800', '#f83800'] });
  const bits = new Bits({ ground: () => 0 });
  const A: Swing = { cx: 2, cy: -10, R: 13, sy: 1, rot: 0, a0: -2.7, a1: 0.25, W: 7, t0: -0.065, sweep: 0.07, hold: 0.06, trail: 0.2, ramp: C };
  const LAND = 0;
  let t = 0, landed = false;
  return {
    update(dt: number) {
      t += dt;
      if (!landed) {
        landed = true;
        for (let i = 0; i < 8; i++) ps.spawn(P.SPARK, R.range(8, 14), -1, R.range(-60, 110), R.range(-130, -40), R.range(0.12, 0.3));
        for (const x of [12, 40]) {
          for (let i = 0; i < 3; i++) bits.add({ kind: B.CHUNK, x: x + R.range(-6, 6), y: -1, vx: R.range(-25, 25), vy: R.range(-90, -50), a: 0, va: R.range(-10, 10), s: R.range(1, 2), c: hex('#ac7c00'), ramp: [hex('#503000'), hex('#ac7c00'), hex('#f0d0b0')], g: 0.8, bounce: 0.3, life: R.range(0.35, 0.5) });
          for (let i = 0; i < 2; i++) ps.spawn(P.DUST, x + R.range(-6, 6), -1, R.range(-12, 12), R.range(-10, -3), R.range(0.3, 0.45), hex('#f0d0b0'), 2.2, 0.03);
        }
      }
      ps.update(dt); bits.update(dt);
    },
    draw(p: any) {
      drawSwing(p, A, t, 0.3);
      const u = t - LAND;
      if (u >= 0 && u < 0.05) sparkle(p, 10, -2, 6, C[5], C[4], 0.6);
      // a shock ring on the floor of each panel, the second a beat later
      [0, 0.04].forEach((d, i) => {
        const v = u - d;
        if (v < 0 || v > 0.22) return;
        const k = ease.outQuart(clamp(v / 0.22));
        band(p, 12 + i * 28, 0, 6 + k * 10, 0.22, 2, 1 - k, C.slice(2), () => true, v < 0.05);
      });
      bits.draw(p); ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
