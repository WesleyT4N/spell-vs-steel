// Seismic Wave: on each panel the quake reaches, stone spikes jut up out of the floor and sink back, throwing grit.
import { Particles, Bits, Rng, fit, crystal, clamp, ease } from '../../vendor/pixelfx/index.js';
import { chunks, dust, shock, STONE } from '../lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Seismic Wave', desc: 'Stone spikes jut up through the panel.', duration: 0.45, ink: '#000000' };

const ROCK = ['#000000', '#3c3c3c', '#5c5c5c', '#7c7c7c', '#bcbcbc', '#fcfcfc'];

export function create(o: Opts) {
  const K = fit(ROCK, 6), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0 });
  const bits = new Bits({ ground: () => 0 });
  const spikes = [[-6, 9, 5, -1.5], [1, 14, 7, 0.5], [7, 8, 5, 2]].map(([x, h, w, l]) => ({ x: x + R.range(-1, 1), h: h * R.range(0.85, 1.1), w, l }));
  let t = 0, hit = false;
  return {
    update(dt: number) {
      t += dt;
      if (!hit) { hit = true; chunks(bits, R, 0, -1, 3, 8, [60, 100], STONE); dust(ps, R, 0, -1, 3, 9, '#bcbcbc'); }
      ps.update(dt); bits.update(dt);
    },
    draw(p: Painter) {
      shock(p, 0, 0, t / 0.25, 12, K.slice(1));
      const up = ease.outBack(clamp(t / 0.06)), down = ease.inCubic(clamp((t - 0.2) / 0.15));
      for (const s of spikes) crystal(p, s.x, 0, s.h * up * (1 - down), s.w, s.l, K, { white: t < 0.03 });
      bits.draw(p); ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
