// Shield Slam: the shield bashes forward: its face flashes on the panel ahead, a ring of force bursts off it down
// the row, and stun stars spin over the second panel.
import { Particles, Rng, fit, sparkle, clamp, ease, hex, P } from '../../vendor/pixelfx/index.js';
import { RAMPS } from '../palette';
import { sparks, ripple } from '../lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Shield Slam', desc: 'A shield bash with a ring of force and stun stars.', duration: 0.4, panels: 2, ink: '#000000' };

export function create(o: Opts) {
  const S = fit([...RAMPS.steel], 5), G = fit([...RAMPS.holy], 6), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: ['#fcfcfc', '#f8d878', '#f8b800', '#ac7c00'] });
  let t = 0, hit = false;
  return {
    update(dt: number) {
      t += dt;
      if (!hit) {
        hit = true;
        sparks(ps, R, 14, -12, 7, 0, 1.0, [60, 120]);
        for (let i = 0; i < 3; i++) ps.spawn(P.STAR, 38 + Math.cos(i * 2.1) * 6, -20 + Math.sin(i * 2.1) * 2, 0, 0, 0.35, hex('#f8d878'), 1.6, i * 0.03);
      }
      ps.update(dt);
    },
    draw(p: Painter) {
      // the shield's face: a kite shape thrust forward, white on the hit frame
      if (t < 0.18) {
        const k = clamp(t / 0.18), x = 9 + ease.outCubic(k) * 3, a = 1 - k * k;
        p.poly([[x - 2, -21], [x + 3, -19], [x + 3, -8], [x, -3], [x - 2, -8]], t < 0.04 ? S[4] : S[3], a);
        p.line(x, -20, x, -5, G[3], a);
      }
      ripple(p, 14, -12, t / 0.25, 10, G.slice(1), 1, 1.5);
      ripple(p, 30, -12, (t - 0.05) / 0.25, 8, S.slice(1), 1, 1);
      if (t < 0.05) sparkle(p, 13, -12, 5, G[4], G[3], 0.3);
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
