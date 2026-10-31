// Chain Hook draft C hit, "Sickle Whip": the sickle whips round behind the foe in a white crescent, the chain
// lashes two coils round them that cinch tight, the foe is reeled in, then the coils spring loose and the chain
// whips home.
// The fx sits where the foe was hooked, facing the Warrior (data.pull: panels the foe was dragged, data.reach:
// panels back to the Warrior).
import { Particles, Rng, clamp, ease, sparkle } from '../../vendor/pixelfx/index.js';
import { sparks, dust } from '../lib';
import { STEEL, STEEL_SPARKS, WHITE, beadChain, coil, dragLines, sickle } from './chain-lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Chain Hook: Sickle Whip hit', desc: 'A crescent whip round the foe, two coils cinch, then spring loose.', duration: 0.45, panels: 6, ink: '#000000' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: STEEL_SPARKS });
  const FX = Number(o.data?.pull ?? 1) * 38, FIST = Number(o.data?.reach ?? 3) * 38 - 8, CY = -11;
  let t = 0, hit = false, loose = false;
  return {
    update(dt: number) {
      t += dt;
      if (!hit) { hit = true; sparks(ps, R, FX - 8, CY, 6, Math.PI, 0.9, [40, 80], [0.08, 0.18]); dust(ps, R, FX, 0, 2, 4, '#bcbcbc'); }
      if (!loose && t >= 0.24) { loose = true; sparks(ps, R, FX, -11, 8, -Math.PI / 2, 1.6, [30, 60], [0.1, 0.2]); }
      ps.update(dt);
    },
    draw(p: Painter) {
      dragLines(p, FX - 4, 0, ease.outCubic(clamp(t / 0.2)), [-20, -3]);
      // the crescent: the sickle whips round behind the foe (from above, round the back, to below)
      const head = ease.outExpo(clamp((t + 0.03) / 0.07)), tail = ease.inCubic(clamp((t - 0.06) / 0.12));
      if (tail < 1 && head - tail > 0.03) {
        const A0 = Math.PI * 0.45, SPAN = Math.PI * 1.1;
        p.arc(FX, CY, 12, (u: number) => 3 * Math.sin(Math.PI * u) * (1 - tail * 0.6), A0 + SPAN * tail, A0 + SPAN * head, (_u: number, v: number) => (v > 0.5 ? WHITE : STEEL[3]));
        if (tail === 0) sickle(p, FX + Math.cos(A0 + SPAN * head) * 12, CY + Math.sin(A0 + SPAN * head) * 12, t * 30, 4);
      }
      // the coils: cinch in from wide, hold while the foe is reeled in, then spring loose
      const cinch = ease.outBack(clamp(t / 0.1)), burst = clamp((t - 0.24) / 0.05);
      if (t > 0.04 && burst < 1) {
        const rx = 12 - 4.5 * cinch + 3 * burst;
        coil(p, FX, -16 - burst * 3, rx, t * 6);
        coil(p, FX, -7 + burst * 2, rx + 1, t * 6 + 1);
      }
      // the chain home to the fist: taut and still while it cinches, then whipping in as it reels
      const reel = ease.inCubic(clamp((t - 0.24) / 0.2)), end = FX + 9 + (FIST - FX - 9) * reel;
      if (reel < 1) beadChain(p, end, FIST, -10, t < 0.24 ? 0 : 3, 18, t * 60);
      if (t < 0.06) sparkle(p, FX - 9, CY, 5 * (1 - t / 0.06) + 1, STEEL[3], STEEL[2], 0.3);
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
