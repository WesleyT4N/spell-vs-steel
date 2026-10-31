// Disengage: the Ranger backflips away: a green arc whips up over the panel and back, leaves scatter forward
// off the kick and dust puffs where they pushed off.
import { Particles, Rng, fit } from '../../vendor/pixelfx/index.js';
import { RAMPS } from '../palette';
import { drawSwing, dust, type Swing } from '../lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';
import { bits, stepBits, drawLeaves, K } from './lib';

export const meta = { name: 'Disengage', desc: 'A green backflip arc, leaves kicked forward, a puff of dust.', duration: 0.5, ink: '#006800' };

export function create(o: Opts) {
  const C = fit([...RAMPS.nature], 5), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0 });
  const A: Swing = { cx: -1, cy: -11, R: 10, sy: 1, rot: 0, a0: 1.0, a1: -3.7, W: 4, t0: -0.02, sweep: 0.1, hold: 0.04, trail: 0.16, ramp: C };
  const ls = bits(R, 5, i => ({ x: R.range(-2, 6), y: -R.range(2, 10), vx: R.range(20, 40), vy: -R.range(5, 30), g: 60, drag: 3, life: R.range(0.25, 0.38), c: i % 2 ? K.leaf1 : K.leaf2, v: K.leaf3 }));
  let t = 0, go = false;
  return {
    update(dt: number) { t += dt; if (!go) { go = true; dust(ps, R, 2, -1, 3, 5); } stepBits(ls, dt); ps.update(dt); },
    draw(p: Painter) { drawSwing(p, A, t, 0.15); drawLeaves(p, ls); ps.draw(p); },
  };
}

export default { meta, create } satisfies PfxModule;
