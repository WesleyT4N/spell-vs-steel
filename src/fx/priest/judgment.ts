// Smite (the heavy) "Judgment": a sun bursts on the target's chest on the hit frame, eight rays and a white heart, while a gold
// sigil turns on the floor under them; the heart shrinks, a ring of light rolls out and gold shards scatter.
import { Particles, Rng, clamp, flare } from '../../vendor/pixelfx/index.js';
import { ripple, sparks } from '../lib';
import { GOLD, sigil } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Judgment', desc: 'A sunburst on the chest over a turning floor sigil, a ring and shards.', duration: 0.5, ink: '#503000' };

const SUN = ['#ac7c00', '#f8b800', '#f8d878', '#fcfcfc'];

export function create(o: Opts) {
  const G = GOLD(), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 1, sparks: ['#fcfcfc', '#f8d878', '#f8b800', '#ac7c00'] });
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) { go = true; sparks(ps, R, 0, -12, 8, -Math.PI / 2, 2.6, [40, 100], [0.12, 0.26]); }
      ps.update(dt);
    },
    draw(p: Painter) {
      const k = clamp(t / 0.3);
      // the floor sigil: opens fast, turns, fades
      const s = clamp(t / 0.08), sf = 1 - clamp((t - 0.3) / 0.18);
      if (sf > 0) sigil(p, 0, -1, 4 + 5.5 * s, t * 6, G, sf, 6);
      // the sun: big on the hit frame, then shrinking
      if (k < 1) {
        flare(p, 0, -12, 11 * (1 - k) + 1, 0.4, SUN);
        p.circle(0, -12, 4 * (1 - k) + 0.6, (d: number) => (d < 0.5 ? G[5] : G[4]));
        p.glow(0, -12, 12, G[3], 0.35 * (1 - k));
      }
      ripple(p, 0, -12, (t - 0.04) / 0.3, 10, G.slice(2), 0.9, 1.5);
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
