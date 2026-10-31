// Chain Hook hit ("Iron Links"): the barb bites with a white star while the chain stands taut back to the
// Warrior's fist, the foe is yanked in along drag lines with a gouge in the floor, then the hook tears free and the
// Warrior reels the slack chain home.
// The fx sits where the foe was hooked, facing the Warrior (data.pull: panels the foe was dragged, data.reach:
// panels back to the Warrior).
import { Particles, Rng, clamp, ease, sparkle } from '../../vendor/pixelfx/index.js';
import { sparks, dust } from '../lib';
import { STEEL, STEEL_SPARKS, dragLines, hook, ironChain, skid } from './chain-lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Chain Hook hit', desc: 'Bite, taut chain, drag lines, then the chain is reeled in slack.', duration: 0.45, panels: 6, ink: '#000000' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: STEEL_SPARKS });
  const FX = Number(o.data?.pull ?? 1) * 38, FIST = Number(o.data?.reach ?? 3) * 38 - 8, BX = FX + 5, BY = -11;
  let t = 0, hit = false;
  return {
    update(dt: number) {
      t += dt;
      if (!hit) {
        hit = true;
        sparks(ps, R, BX, BY, 7, 0, 0.9, [40, 80], [0.08, 0.2]);
        dust(ps, R, FX - 3, 0, 3, 5, '#bcbcbc');
      }
      ps.update(dt);
    },
    draw(p: Painter) {
      // the drag: from where they were hooked to where they stand
      dragLines(p, FX, 0, ease.outCubic(clamp(t / 0.2)));
      skid(p, FX - 4, 0, ease.inQuad(clamp(t / 0.3)));
      // the chain: taut, then slack and reeled home toward the fist
      const slack = ease.outQuad(clamp((t - 0.1) / 0.15)), reel = ease.inCubic(clamp((t - 0.14) / 0.28));
      const end = BX + 2 + (FIST - BX - 2) * reel;
      if (reel < 1) ironChain(p, FIST, end, -10, slack * 5 * (1 - reel));
      // the hook stays in the bite, then flips out and rides the chain home
      if (t < 0.12) hook(p, BX + 1, BY, 1, true);
      else if (reel < 0.95) hook(p, end - 1, -10 + slack * 2, 1, true);
      // the white hero frame on the bite
      if (t < 0.07) sparkle(p, BX - 1, BY, 5 * (1 - t / 0.07) + 1, STEEL[3], STEEL[2], 0.3);
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
