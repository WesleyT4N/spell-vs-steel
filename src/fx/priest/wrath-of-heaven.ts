// Wrath of Heaven: on every enemy panel a thick beam of white light crashes down on the hit frame under a crown of
// rays, splays out in light along the floor, and collapses to a thread while gold sparks leap off the floor.
// Fx kind 'wrath' (was holyPillar).
import { Particles, Rng, clamp, flare } from '../../vendor/pixelfx/index.js';
import { sparks, shock } from '../lib';
import { GOLD, pillar, rays } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Wrath of Heaven', desc: 'A thick beam crashes down under a crown of rays and splays along the floor.', duration: 0.56, ink: '#503000' };

export function create(o: Opts) {
  const G = GOLD(), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: ['#fcfcfc', '#f8d878', '#f8b800', '#ac7c00'] });
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) { go = true; sparks(ps, R, 0, -1, 7, -Math.PI / 2, 1.3, [50, 110], [0.12, 0.26]); }
      ps.update(dt);
    },
    draw(p: Painter) {
      const k = clamp(t / 0.42), w = t < 0.05 ? 9 : 7 * (1 - k) * (1 - k) + 0.6;
      if (k < 1) pillar(p, 0, -24, w, t < 0.05 ? [G[4], G[5], G[5], G[5]] : G.slice(0, 5));
      // the crown at the top of the box and the splash along the floor
      if (t < 0.2) flare(p, 0, -22, 9 * (1 - t / 0.2) + 1, 0.4, ['#ac7c00', '#f8b800', '#f8d878', '#fcfcfc']);
      const s = clamp(t / 0.25);
      if (s < 1) rays(p, 0, -1, 8, 4 + s * 6, 0.2, G, 1 - s, 0.25);
      shock(p, 0, 0, t / 0.35, 10, G);
      if (k < 1) p.glow(0, -12, 12, G[3], 0.35 * (1 - k));
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
