// Rallying Cry: a gold cry rings out and green healing motes rise around the Warrior.
import { Particles, Rng, fit, hex, P } from '../../vendor/pixelfx/index.js';
import { RAMPS } from '../palette';
import { ripple } from '../lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Rallying Cry', desc: 'A gold ring of sound and rising green motes.', duration: 0.6, ink: '#503000' };

export function create(o: Opts) {
  const G = fit([...RAMPS.holy], 6), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0 });
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) {
        go = true;
        for (let i = 0; i < 8; i++) ps.spawn(P.MOTE, R.range(-9, 9), R.range(-4, 0), R.range(-4, 4), R.range(-45, -25), R.range(0.3, 0.45), hex(i % 2 ? '#58d854' : '#b8f8b8'), 1, R.range(0, 0.2));
      }
      ps.update(dt);
    },
    draw(p: Painter) {
      for (let i = 0; i < 2; i++) ripple(p, 0, -12, (t - i * 0.1) / 0.35, 11, G.slice(1), 0.9, 1.5);
      // a plus sign of healing light over the head
      const k = (t - 0.1) / 0.3;
      if (k > 0 && k < 1) {
        const y = -18 - k * 4, c = hex(k < 0.3 ? '#fcfcfc' : '#58d854');
        p.rect(-2, y - 1, 5, 1, c, 1 - k * k); p.rect(0, y - 3, 1, 5, c, 1 - k * k);
      }
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
