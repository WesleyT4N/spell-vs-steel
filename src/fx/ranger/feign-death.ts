// Feign Death: the Ranger drops and goes still: a gray puff of dust flattens out over the floor, and leaves drift
// down over them like cover, settling before they fade.
import { Particles, Rng, clamp } from '../../vendor/pixelfx/index.js';
import { dust } from '../lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';
import { bits, stepBits, drawLeaves, K } from './lib';

export const meta = { name: 'Feign Death', desc: 'A flat gray puff and leaves drifting down as cover.', duration: 1, ink: '#3c3c3c' };

export function create(o: Opts) {
  const R = new Rng(o.seed), ps = new Particles({ rng: R, ground: () => 0 });
  const ls = bits(R, 7, i => ({ x: R.range(-10, 10), y: -24 + R.range(0, 4), vx: R.range(-6, 6), vy: R.range(8, 16), g: 10, drag: 0.5, life: R.range(0.7, 0.88), c: i % 3 ? K.wood : K.leaf1, v: i % 3 ? K.straw : K.leaf2 }));
  for (const l of ls) l.t = -R.range(0, 0.25);
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) { go = true; dust(ps, R, 0, -1, 5, 8, '#bcbcbc'); }
      // leaves sway as they fall, and stop on the floor
      for (const l of ls) { l.vx = Math.sin((t + l.spin) * 7) * 14; if (l.y > -1) { l.y = -1; l.vy = 0; l.vx = 0; l.g = 0; } }
      stepBits(ls, dt); ps.update(dt);
    },
    draw(p: Painter) {
      // the flat puff: a wide low ellipse of gray, dithering out
      const u = clamp(t / 0.5);
      if (u < 1) p.ellipse(0, -1, 6 + u * 6, 2, (d: number) => (d < 0.6 ? K.steel : K.iron), 1 - u);
      ps.draw(p); drawLeaves(p, ls);
    },
  };
}

export default { meta, create } satisfies PfxModule;
