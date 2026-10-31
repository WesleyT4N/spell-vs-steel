// Sanctuary: on each panel of the Priest's column a shaft of gold light falls from above, lands as a ring on the
// floor, and two small gold crosses lift off it: the heal blessing. Fx kind 'blessHeal'.
import { Rng, clamp } from '../../vendor/pixelfx/index.js';
import { GOLD, pillar, floorRing, cross } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Sanctuary', desc: 'A shaft of gold light falls on each panel, a floor ring, crosses lift.', duration: 0.5, ink: '#503000' };

export function create(o: Opts) {
  const G = GOLD(), R = new Rng(o.seed);
  const xs = [R.range(-8, -4), R.range(4, 8)];
  let t = 0;
  return {
    update(dt: number) { t += dt; },
    draw(p: Painter) {
      // the shaft: its foot falls from the top to the floor, then its top follows it down
      const fall = clamp(t / 0.1), lift = clamp((t - 0.12) / 0.16);
      if (lift < 1) pillar(p, 0, -24 + lift * 24, 3 - lift * 1.5, G, 1, -24 + fall * 24);
      floorRing(p, 0, 0, (t - 0.08) / 0.3, 10, G);
      xs.forEach((x, i) => {
        const u = clamp((t - 0.12 - i * 0.05) / 0.3);
        if (u > 0 && u < 1) cross(p, x, -3 - u * 14, 1, G[4], G[5], 1 - u * u);
      });
    },
  };
}

export default { meta, create } satisfies PfxModule;
