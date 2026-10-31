// Holy Spark (the light, in flight): a twinkling four-point star of gold light flies down the row on a tapering gold streak,
// shedding glints that hang in the air behind it. Plays for the 'spark' projectile; its hit is holy-spark-hit.
import { Rng, clamp } from '../../vendor/pixelfx/index.js';
import { GOLD, SHOT_V, WHITE } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Holy Spark', desc: 'A twinkling gold star on a tapering streak, shedding glints.', duration: 3, panels: 2, ink: '#503000' };

export function create(o: Opts) {
  const G = GOLD(), R = new Rng(o.seed);
  // glints left hanging in the air: where they were dropped (in flight distance) and when
  const glints: Array<{ d: number; y: number; t: number }> = [];
  let t = 0, next = 0.02;
  return {
    update(dt: number) {
      t += dt;
      while (t >= next) { glints.push({ d: next * SHOT_V - R.range(2, 5), y: R.int(-3, 3), t: next }); next += 0.025; }
    },
    draw(p: Painter) {
      const flown = t * SHOT_V;
      // the hand flash where it was thrown, left behind
      if (t < 0.07) { const k = 1 - t / 0.07, s = Math.round(3 * k) + 1; p.rect(-flown - s, 0, 2 * s + 1, 1, G[4]); p.rect(-flown, -s, 1, 2 * s + 1, G[4]); p.dot(-flown, 0, WHITE); }
      // the streak: three rows thick at the star, thinning to a hair
      const L = Math.min(16, flown);
      for (let d = 2; d <= L; d++) {
        const u = d / L;
        p.dot(-d, 0, u < 0.5 ? G[4] : G[3]);
        if (u < 0.55) { p.dot(-d, -1, G[3]); p.dot(-d, 1, G[2]); }
      }
      // glints: a white pixel, then gold, then gone
      for (const g of glints) {
        const age = t - g.t;
        if (age > 0.16) continue;
        const x = g.d - flown;
        if (x < -46) continue;
        p.dot(x, g.y, age < 0.06 ? WHITE : G[3], 1 - clamp((age - 0.1) / 0.06));
      }
      // the star: arms 3 and 2 swapping each beat, so it twinkles
      const tw = Math.floor(t * 30) % 2, h = 3 - tw, v = 2 + tw;
      p.rect(-h, 0, 2 * h + 1, 1, G[3]); p.rect(0, -v, 1, 2 * v + 1, G[3]);
      p.rect(-1, -1, 3, 3, G[4]); p.dot(0, 0, WHITE); p.dot(h, 0, WHITE);
      p.glow(0, 0, 6, G[3], 0.3);
    },
  };
}

export default { meta, create } satisfies PfxModule;
