// Shadow Word: Death: a scythe of shadow reaps down across the enemy on the hit frame, black edged in lilac, and a
// skull of violet light flashes over them and fades up. Fx kind 'swDeath' (was shadowHit).
import { Particles, Rng, clamp, fit } from '../../vendor/pixelfx/index.js';
import { RAMPS } from '../palette';
import { drawSwing, tipOf, sparks, type Swing } from '../lib';
import { VIOLET, skull } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Shadow Word: Death', desc: 'A shadow scythe reaps down and a violet skull flashes overhead.', duration: 0.44, ink: '#000000' };

export function create(o: Opts) {
  const V = VIOLET(), S = fit([...RAMPS.shadow], 5), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: ['#d8b8f8', '#9878f8', '#6844fc', '#4428bc'] });
  // the reap: from high behind them, down across to low in front, already across on the hit frame
  const A: Swing = { cx: 0, cy: -13, R: 11, sy: 0.9, rot: 0.2, a0: -2.4, a1: 0.9, W: 5, t0: -0.045, sweep: 0.05, hold: 0.05, trail: 0.18, ramp: S };
  const tip = tipOf(A);
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) { go = true; sparks(ps, R, tip.x, tip.y, 5, Math.atan2(tip.dy, tip.dx), 0.8, [40, 90]); }
      ps.update(dt);
    },
    draw(p: Painter) {
      drawSwing(p, A, t, 0.2);
      const k = clamp((t - 0.06) / 0.34);
      if (k > 0 && k < 1) skull(p, 0, -21 - k * 2, k < 0.15 ? V[4] : V[3], V[0], 1 - k * k);
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
