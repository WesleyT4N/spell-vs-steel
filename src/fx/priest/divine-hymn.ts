// Divine Hymn (each tick of the channel): gold notes of the hymn lift off either side of the Priest and sway up,
// and a soft ring of light breathes out round them. Fx kind 'hymnTick' (was healBurst).
import { Rng, clamp } from '../../vendor/pixelfx/index.js';
import { ripple } from '../lib';
import { GOLD, note } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Divine Hymn', desc: 'Gold notes sway up off the Priest and a ring of light breathes out.', duration: 0.5, ink: '#503000' };

export function create(o: Opts) {
  const G = GOLD(), R = new Rng(o.seed);
  // two notes a tick, on alternating sides (by seed), at different heights
  const side = o.seed % 2 ? 1 : -1;
  const notes = [{ x: side * R.range(6, 8), y: R.range(-12, -9), d: 0 }, { x: -side * R.range(5, 7), y: R.range(-8, -5), d: 0.1 }];
  let t = 0;
  return {
    update(dt: number) { t += dt; },
    draw(p: Painter) {
      ripple(p, 0, -12, t / 0.4, 10, G.slice(1), 0.9, 1);
      for (const n of notes) {
        const u = clamp((t - n.d) / 0.38);
        if (u <= 0 || u >= 1) continue;
        note(p, n.x + Math.sin(u * 6) * 1.5, n.y - u * 10, u < 0.2 ? G[5] : G[4], 1 - u * u);
      }
    },
  };
}

export default { meta, create } satisfies PfxModule;
