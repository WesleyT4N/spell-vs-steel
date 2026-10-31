// Holy Sanctum (on the Priest): two pillars of light rise either side of the Priest, an arch of light springs between
// them over the head with a cross at its keystone, and the little chapel glows and fades. Fx kind 'sanctum'
// (was transform). Its panels play holy-sanctum-bless.
import { Rng, clamp, ease, sparkle } from '../../vendor/pixelfx/index.js';
import { GOLD, cross } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Holy Sanctum', desc: 'Pillars rise either side, an arch of light springs over the head, a cross on top.', duration: 1, ink: '#503000' };

export function create(o: Opts) {
  const G = GOLD();
  void new Rng(o.seed);
  let t = 0;
  return {
    update(dt: number) { t += dt; },
    draw(p: Painter) {
      const fade = clamp((t - 0.6) / 0.4);
      if (fade >= 1) return;
      const a = 1 - fade;
      // pillars: 2 px wide at x = +-9, rising to 15 px
      const up = ease.outCubic(clamp(t / 0.22)), h = Math.round(15 * up);
      for (const x of [-10, 9]) if (h > 0) { p.rect(x, -h, 2, h, G[3], a); p.rect(x, -h, 1, h, G[4], a); p.rect(x - 1, -1, 4, 1, G[2], a); }
      // the arch: a half ellipse from pillar top to pillar top, drawn from both sides to the keystone
      const arch = clamp((t - 0.2) / 0.16);
      if (arch > 0) for (let j = 0; j <= 30; j++) {
        const u = j / 30;
        if (Math.abs(u - 0.5) > arch * 0.5) continue;
        const g = Math.PI + u * Math.PI, x = Math.cos(g) * 9.5 - 0.5, y = -15 + Math.sin(g) * 6;
        p.dot(x, y, G[4], a); p.dot(x, y + 1, G[3], a);
      }
      if (arch >= 1) {
        if (t < 0.46) sparkle(p, 0, -21, 3, G[5], G[3], 0.25);
        else cross(p, 0, -22, 1, G[4], G[5], a);
      }
      p.glow(0, -12, 12, G[3], 0.25 * a * up);
    },
  };
}

export default { meta, create } satisfies PfxModule;
