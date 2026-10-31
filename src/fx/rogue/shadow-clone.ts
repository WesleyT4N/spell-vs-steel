// Shadow Clone: a violet copy of the Rogue peels away from them and steps back a pace, holds, then the Rogue
// vanishes into smoke and the copy stays where they stood (the decoy itself is drawn by the game).
import { Rng, clamp, ease } from '../../vendor/pixelfx/index.js';
import { SHADOW, DUSK, Puffs, ghost, glint } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Shadow Clone', desc: 'A violet copy peels away, then melts into smoke.', duration: 0.6, ink: '#000000' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const smoke = new Puffs(DUSK);
  const MELT = 0.32;
  let t = 0, melted = false;
  return {
    update(dt: number) {
      t += dt;
      if (!melted && t >= MELT) { melted = true; smoke.burst(R, -5, -10, 5, 3, 6, [2, 3.2], [0.16, 0.22], 8, 10); }
      smoke.update(dt);
    },
    draw(p: Painter) {
      if (t < MELT) {
        const x = -ease.outCubic(clamp(t / 0.14)) * 5;
        ghost(p, x, SHADOW[2], SHADOW[4], 1);
        p.px(x + 1, -19, SHADOW[4]);
        if (t < 0.08) glint(p, x, -12, 3, SHADOW[3], 0.25);
      }
      smoke.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
