// Lunge: a spear of steel streaks out down the row through the three panels ahead with a glinting point, then
// pulls back, leaving speed lines.
import { Particles, Rng, fit, sparkle, clamp, ease, hex, P } from '../../vendor/pixelfx/index.js';
import { RAMPS } from '../palette';
import { sparks } from '../lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Lunge', desc: 'A steel spear streaks through three panels.', duration: 0.35, panels: 4, ink: '#000000' };

export function create(o: Opts) {
  const C = fit([...RAMPS.steel], 5), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: ['#fcfcfc', '#fce0a8', '#bcbcbc', '#7c7c7c'] });
  const X0 = 8, MAX = 3 * 38 + 4, OUT = 0.1, BACK = 0.2;
  let t = 0, hit = false;
  const reach = (): number => (t < OUT ? ease.outExpo(clamp(t / OUT)) : 1 - ease.inCubic(clamp((t - BACK) / 0.12)));
  return {
    update(dt: number) {
      t += dt;
      if (!hit && t >= OUT) {
        hit = true;
        sparks(ps, R, X0 + MAX, -11, 6, 0, 0.7);
        for (let i = 0; i < 5; i++) ps.spawn(P.STREAK, R.range(X0 + 10, X0 + MAX - 10), R.range(-17, -5), R.range(30, 60), 0, R.range(0.08, 0.14), hex('#bcbcbc'));
      }
      ps.update(dt);
    },
    draw(p: Painter) {
      const L = MAX * reach();
      if (L > 2) {
        const tip = X0 + L;
        p.beam(X0, -11, tip - 4, -11, 3, (u: number, v: number) => (v < 0.4 ? C[4] : u > 0.7 ? C[3] : C[2]));
        p.poly([[tip - 6, -14], [tip, -11], [tip - 6, -8]], C[3]);
        p.line(tip - 6, -11, tip - 1, -11, C[4]);
        if (t < OUT) for (let i = 0; i < 3; i++) p.line(tip - 14 - i * 12, -16 + i * 5, tip - 8 - i * 12, -16 + i * 5, C[3]);
      }
      const g = t - OUT;
      if (g >= 0 && g < 0.12) sparkle(p, X0 + MAX, -11, 5 * (1 - g / 0.12), C[3], C[2], 0.3);
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
