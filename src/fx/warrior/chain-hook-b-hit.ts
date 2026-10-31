// Chain Hook draft B hit, "Grapple Line": the claws clamp shut on the foe with a clang, the cable twangs, the foe
// is ripped in leaving a spray of panel chips and a trail of dust where they stood, then the grapple lets go and
// the cable whips home.
// The fx sits where the foe was hooked, facing the Warrior (data.pull: panels the foe was dragged, data.reach:
// panels back to the Warrior).
import { Particles, Bits, Rng, clamp, ease, sparkle } from '../../vendor/pixelfx/index.js';
import { sparks, dust, chunks, ripple, STONE } from '../lib';
import { STEEL, STEEL_SPARKS, cable, grapple } from './chain-lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Chain Hook: Grapple Line hit', desc: 'Claws clamp, the cable twangs, chips fly where the foe was ripped from.', duration: 0.45, panels: 6, ink: '#000000' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: STEEL_SPARKS });
  const bits = new Bits({ rng: R, ground: () => 0 });
  const FX = Number(o.data?.pull ?? 1) * 38, FIST = Number(o.data?.reach ?? 3) * 38 - 8, RX = FX + 6, BY = -11;
  let t = 0, hit = false;
  return {
    update(dt: number) {
      t += dt;
      if (!hit) {
        hit = true;
        sparks(ps, R, RX - 8, BY, 6, 0, 1.1, [40, 80], [0.08, 0.18]);
        if (FX > 0) {
          chunks(bits, R, 0, 0, 5, 5, [40, 80], STONE);
          for (let x = 4; x < FX - 4; x += 7) dust(ps, R, x, 0, 1, 2, '#bcbcbc');
        }
      }
      ps.update(dt);
      bits.update(dt);
    },
    draw(p: Painter) {
      // the clang where the claws close
      ripple(p, RX - 8, BY, clamp(t / 0.16), 8, [STEEL[2], STEEL[3], STEEL[4]], 1, 1);
      // the cable: twanging while it hauls, then whipping home once the grapple lets go
      const go = ease.inCubic(clamp((t - 0.2) / 0.2)), end = RX + (FIST - RX) * go;
      const amp = t < 0.2 ? 3 * (1 - t / 0.2) : 0;
      if (go < 1) cable(p, end, FIST, -10, t * 400, amp, t * 70);
      // claws: shut on the bite, flung open again as it lets go
      const open = t < 0.2 ? 1 - ease.outExpo(clamp(t / 0.05)) : ease.outCubic(clamp((t - 0.2) / 0.06));
      if (go < 0.95) grapple(p, end, -9, open, -1);
      if (t < 0.06) sparkle(p, RX - 7, BY, 5 * (1 - t / 0.06) + 1, STEEL[3], STEEL[2], 0.3);
      bits.draw(p);
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
