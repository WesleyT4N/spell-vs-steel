// Holy Wall: on the panel ahead, bars of gold light shoot up out of the floor side by side, their tops white, flash
// together into a sheet, then sink back as the wall itself takes over. Fx kind 'holyWallRise'.
import { Rng, clamp, ease, sparkle } from '../../vendor/pixelfx/index.js';
import { GOLD } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Holy Wall', desc: 'Bars of light shoot up from the floor and flash into a sheet.', duration: 0.56, ink: '#503000' };

export function create(o: Opts) {
  const G = GOLD(), R = new Rng(o.seed);
  const bars = [-6, -3, 0, 3, 6].map((x, i) => ({ x, d: Math.abs(i - 2) * 0.03, h: 20 + R.range(-1, 2) - Math.abs(i - 2) }));
  let t = 0;
  return {
    update(dt: number) { t += dt; },
    draw(p: Painter) {
      const fade = clamp((t - 0.3) / 0.25);
      if (fade >= 1) return;
      const sheet = t > 0.14 && t < 0.24;
      for (const b of bars) {
        const u = ease.outCubic(clamp((t - b.d) / 0.12));
        if (u <= 0) continue;
        const h = Math.round(b.h * u * (1 - fade * 0.8));
        if (h < 1) continue;
        p.rect(b.x - 1, -h, sheet ? 3 : 2, h, sheet ? G[4] : G[3]);
        p.rect(b.x, -h, 1, h, G[4]); p.rect(b.x - 1, -h, 2, 1, G[5]);
      }
      if (sheet) sparkle(p, 0, -20, 3, G[5], G[3], 0.25);
      p.glow(0, -10, 11, G[3], 0.25 * (1 - fade));
    },
  };
}

export default { meta, create } satisfies PfxModule;
