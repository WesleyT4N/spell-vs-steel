// Explosive Shot (the blast, on the target's panel and the four round it): a round fireball, white-hot at its
// heart, cooling through gold and orange to a red rim; a fire shock ring rolls over the floor and grit flies.
import { Particles, Rng, Bits, fit, clamp, ease } from '../../vendor/pixelfx/index.js';
import { RAMPS } from '../palette';
import { chunks, shock, DIRT } from '../lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';
import { K } from './lib';

export const meta = { name: 'Explosive Shot', desc: 'A round fireball blast with a fire ring and flying grit.', duration: 0.5, ink: '#881400' };

export function create(o: Opts) {
  const C = fit([...RAMPS.fire], 7), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: ['#fcfcfc', '#f8b800', '#fca044', '#f83800'] });
  const bits = new Bits({ ground: () => 0 });
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) { go = true; chunks(bits, R, 0, -1, 4, 7, [50, 90], DIRT); for (let i = 0; i < 6; i++) { const a = R.range(0, Math.PI * 2), s = R.range(60, 110); ps.spawn(0, 0, -9, Math.cos(a) * s, Math.sin(a) * s, R.range(0.1, 0.22)); } }
      ps.update(dt); bits.update(dt);
    },
    draw(p: Painter) {
      const g = ease.outExpo(clamp((t + 0.02) / 0.1)), shrink = clamp((t - 0.14) / 0.28), r = 9.5 * g * (1 - shrink * 0.7);
      if (r > 0.8 && shrink < 1) {
        p.circle(0, -9 - shrink * 4, r, (d: number, ang: number) => {
          // a ragged rim: flame tongues round the edge, turning as it burns
          if (d > 0.82 + 0.18 * Math.sin(ang * 5 + t * 25 + o.seed)) return 0;
          const heat = d * 1.1 + shrink * 1.1 + (t > 0.04 ? 0.3 : -0.3);
          return heat < 0.2 ? K.white : heat < 0.45 ? K.gold : heat < 0.7 ? K.red2 : heat < 0.9 ? K.red1 : K.red0;
        });
      }
      shock(p, 0, 0, t / 0.3, 12, C.slice(2), 1.5);
      bits.draw(p); ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
