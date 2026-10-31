// Cleave, draft A "Crescent": a crescent smear whips across the panel ahead and an echo reaches the second panel,
// white at the edge cooling to steel, with a glint at the tip and sparks off it.
import { Particles, P, Rng, fit, sparkle, ease, clamp } from '../../vendor/pixelfx/index.js';
import { RAMPS } from '../palette';
import { drawSwing, tipOf, type Swing } from '../lib';
import type { PfxModule, Opts } from '../../game/pfx';

export const meta = { name: 'Cleave: Crescent', desc: 'A crescent smear across the panel ahead and an echo on the second.', duration: 0.4, panels: 2, ink: '#000000' };

export function create(o: Opts) {
  const C = fit([...RAMPS.steel], 5), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: ['#fcfcfc', '#fce0a8', '#f8b800', '#7c7c7c'] });
  const A: Swing = { cx: -3, cy: -12, R: 13, sy: 0.8, rot: -0.3, a0: -2.5, a1: 0.9, W: 6, t0: -0.045, sweep: 0.05, hold: 0.04, trail: 0.16, ramp: C };
  const E: Swing = { ...A, cx: 34, cy: -11, R: 11, W: 4, t0: -0.01, hold: 0.03, trail: 0.14 };
  const tip = tipOf(A), tip2 = tipOf(E);
  let t = 0, hit = false, hit2 = false;
  // the hit lands the instant the attack starts (the fight pauses on it), so the swing is already across at t = 0
  const sparks = (x: number, y: number, dx: number, dy: number, n: number): void => {
    for (let i = 0; i < n; i++) {
      const a = Math.atan2(dy, dx) + R.range(-0.7, 0.7), sp = R.range(50, 120);
      ps.spawn(P.SPARK, x, y, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.08, 0.2));
    }
  };
  return {
    update(dt: number) {
      t += dt;
      if (!hit && t >= A.sweep) { hit = true; sparks(tip.x, tip.y, tip.dx, tip.dy, 5); }
      if (!hit2 && t >= E.t0 + E.sweep) { hit2 = true; sparks(tip2.x, tip2.y, tip2.dx, tip2.dy, 3); }
      ps.update(dt);
    },
    draw(p: unknown) {
      drawSwing(p, E, t, 0.15);
      drawSwing(p, A, t);
      const g = t - A.sweep * 0.6;
      if (g > 0 && g < 0.14) sparkle(p, tip.x, tip.y, 4 * ease.outBack(clamp(g / 0.04)) * (1 - g / 0.14), C[3], C[2], 0.35);
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
