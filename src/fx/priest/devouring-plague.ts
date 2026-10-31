// Devouring Plague: a swarm of shadow motes boils up round the enemy, circling in tight, crossing loops, then
// dives into them in a last violet flash. Fx kind 'plague'.
import { Rng, clamp, TAU, sparkle } from '../../vendor/pixelfx/index.js';
import { VIOLET } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Devouring Plague', desc: 'A swarm of shadow motes circles the enemy and dives in.', duration: 0.69, ink: '#000000' };

export function create(o: Opts) {
  const V = VIOLET(), R = new Rng(o.seed);
  const motes = Array.from({ length: 10 }, (_, i) => ({ g: R.range(0, TAU), w: (i % 2 ? 1 : -1) * R.range(9, 14), rx: R.range(7, 10), ry: R.range(3, 7), cy: R.range(-16, -7), d: i * 0.015 }));
  let t = 0;
  return {
    update(dt: number) { t += dt; },
    draw(p: Painter) {
      const dive = clamp((t - 0.38) / 0.16);
      for (const m of motes) {
        const u = t - m.d;
        if (u <= 0 || dive >= 1) continue;
        const k = (1 - dive) * Math.min(1, u / 0.08), g = m.g + m.w * u;
        const x = Math.cos(g) * m.rx * k, y = m.cy * (1 - dive) - 11 * dive + Math.sin(g) * m.ry * k;
        const near = Math.sin(g) > 0;
        // each mote: a 2x2 body, lilac when it swings near, with a dark trail pixel behind it
        p.rect(x, y, 2, 2, near ? V[4] : V[2]);
        const gb = g - Math.sign(m.w) * 0.4;
        p.dot(Math.cos(gb) * m.rx * k, m.cy * (1 - dive) - 11 * dive + Math.sin(gb) * m.ry * k, V[3]);
      }
      if (dive > 0.8 && t < 0.62) sparkle(p, 0, -11, 4, V[4], V[3], 0.3);
      p.glow(0, -11, 10, V[2], 0.2 * (1 - dive));
    },
  };
}

export default { meta, create } satisfies PfxModule;
