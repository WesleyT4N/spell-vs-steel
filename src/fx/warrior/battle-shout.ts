// Battle Shout: a war cry: rings of sound roll forward off the Warrior's mouth with wind lines and a kick of dust.
import { Particles, Rng, fit, hex, P } from '../../vendor/pixelfx/index.js';
import { RAMPS } from '../palette';
import { ripple, dust } from '../lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Battle Shout', desc: 'Rings of sound roll forward off the Warrior.', duration: 0.5, ink: '#3c3c3c' };

export function create(o: Opts) {
  const S = fit([...RAMPS.steel], 5), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0 });
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) {
        go = true;
        for (let i = 0; i < 4; i++) ps.spawn(P.STREAK, R.range(2, 6), R.range(-21, -11), R.range(40, 70), R.range(-8, 8), R.range(0.1, 0.18), hex('#fcfcfc'), 1, i * 0.04);
        dust(ps, R, 0, -1, 2);
      }
      ps.update(dt);
    },
    draw(p: Painter) {
      for (let i = 0; i < 3; i++) ripple(p, 4 + i * 2, -16, (t - i * 0.08) / 0.3, 7 + i, S.slice(1), 1.1, 1);
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
