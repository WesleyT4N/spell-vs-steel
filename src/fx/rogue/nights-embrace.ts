// Night's Embrace: night falls on the Rogue: a lilac crescent moon rises over their head, stars wink round it, and
// a dome of darkness closes down over them from the top before it all fades into Stealth.
import { Particles, Rng, clamp, ease, hex, P } from '../../vendor/pixelfx/index.js';
import { SHADOW, WHITE } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: "Night's Embrace", desc: 'A crescent moon rises, stars wink, a dome of night closes.', duration: 0.8, ink: '#000000' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0 });
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) {
        go = true;
        const spots: Array<[number, number]> = [[-9, -20], [8, -16], [-7, -9], [9, -5]];
        spots.forEach(([x, y], i) => ps.spawn(P.STAR, x + R.range(-1, 1), y, 0, 0, 0.32, hex(i % 2 ? '#d8b8f8' : '#fcfcfc'), 1.3, 0.08 + i * 0.07));
      }
      ps.update(dt);
    },
    draw(p: Painter) {
      // the moon: a disc with a bite out of it, rising into place and fading at the end
      const rise = ease.outBack(clamp(t / 0.16)), fade = clamp((t - 0.55) / 0.2);
      if (fade < 1) {
        const mx = 0, my = -17 + (1 - rise) * 6;
        p.shade(mx - 4, my - 4, mx + 4, my + 4, (x: number, y: number) => {
          const a = Math.hypot(x - mx, y - my), b = Math.hypot(x - mx - 2.2, y - my + 1);
          if (a > 3.8 || b < 3.2) return 0;
          return a > 2.8 ? SHADOW[3] : SHADOW[4];
        });
        if (fade > 0) p.circle(mx, my, 4.5 * fade, SHADOW[1]);
        if (t > 0.12 && t < 0.2) p.px(mx - 2, my - 2, WHITE);
      }
      // the dome of night: a band sweeping down from the top over the body
      const d = clamp((t - 0.25) / 0.35);
      if (d > 0 && d < 1) {
        const y = -23 + ease.inOutSine(d) * 22, w = Math.sqrt(Math.max(0, 1 - ((y + 11) / 12) ** 2)) * 10 + 1;
        p.line(-w, y, w, y, SHADOW[2], 1 - d * 0.5);
        p.line(-w + 1, y - 1, w - 1, y - 1, SHADOW[1], 1 - d * 0.5);
      }
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
