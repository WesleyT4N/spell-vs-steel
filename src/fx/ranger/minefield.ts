// Minefield (a mine going off): the floor heaves: a burst of dirt chunks and dust kicks up, a green ring of force
// shoves outward along the floor (it knocks back), and a few leaves are thrown with it.
import { Particles, Rng, Bits, fit, clamp } from '../../vendor/pixelfx/index.js';
import { RAMPS } from '../palette';
import { chunks, dust, shock, DIRT } from '../lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';
import { bits, stepBits, drawLeaves, K } from './lib';

export const meta = { name: 'Minefield', desc: 'A heave of dirt and dust and a green ring of force.', duration: 0.62, ink: '#503000' };

export function create(o: Opts) {
  const C = fit([...RAMPS.nature], 5), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0 });
  const bt = new Bits({ ground: () => 0 });
  const ls = bits(R, 4, i => ({ x: R.range(-4, 4), y: -3, vx: R.range(-40, 40), vy: -R.range(40, 70), g: 90, drag: 2, life: R.range(0.35, 0.5), c: i % 2 ? K.leaf1 : K.leaf2, v: K.leaf3 }));
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) { go = true; chunks(bt, R, 0, -1, 6, 4, [50, 85], DIRT); dust(ps, R, 0, -2, 4, 7); }
      ps.update(dt); bt.update(dt); stepBits(ls, dt);
    },
    draw(p: Painter) {
      // the heave: a dirt mound bulging up on the first frames
      const m = 1 - clamp(t / 0.1);
      if (m > 0) p.ellipse(0, 0, 8, 1 + 4 * m, (d: number) => (d < 0.5 ? K.sand : K.wood));
      shock(p, 0, 0, t / 0.35, 12, C.slice(1), 2);
      bt.draw(p); ps.draw(p); drawLeaves(p, ls);
    },
  };
}

export default { meta, create } satisfies PfxModule;
