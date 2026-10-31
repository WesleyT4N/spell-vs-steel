// Envenom: wherever the foe stands, a pair of venom fangs snaps shut on them and the poison in them bursts: a
// green splash out of the bite, drops flung wide, and bubbles rising off them.
import { Particles, Rng, clamp, ease } from '../../vendor/pixelfx/index.js';
import { sparks } from '../lib';
import { POISON, POISON_SPARKS, WHITE, Bubbles, Drops } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Envenom', desc: 'Venom fangs snap shut and the poison bursts.', duration: 0.5, ink: '#005800' };

/** A fang hanging from (x, y0) down to its tip, curving forward a touch. */
function fang(p: Painter, x: number, y0: number, len: number, dir: number, a: number): void {
  if (len < 1) return;
  p.poly([[x - 2, y0], [x + 2, y0], [x + dir, y0 + dir * len]], WHITE, a);
  p.line(x + 1, y0, x + dir, y0 + dir * (len - 1), POISON[3], a);
}

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: POISON_SPARKS });
  const drops = new Drops(), bubbles = new Bubbles();
  let t = 0, hit = false;
  return {
    update(dt: number) {
      t += dt;
      if (!hit) {
        hit = true;
        sparks(ps, R, 0, -11, 6, -Math.PI / 2, 1.6, [40, 90], [0.1, 0.22]);
        for (let i = 0; i < 6; i++) { const a = R.range(0, Math.PI * 2); drops.add(Math.cos(a) * 3, -11 + Math.sin(a) * 3, Math.cos(a) * R.range(30, 60), Math.sin(a) * R.range(30, 60) - 40, POISON[R.int(2, 4)], 0.35); }
        for (let i = 0; i < 4; i++) bubbles.add(R.range(-8, 8), R.range(-10, -2), -R.range(12, 22), R.range(1.3, 2.2), R.range(0.15, 0.24), 0.05 + i * 0.03);
      }
      ps.update(dt); drops.update(dt); bubbles.update(dt);
    },
    draw(p: Painter) {
      // the bite: closed on the hit frame, then the fangs pull apart and vanish
      const open = ease.outCubic(clamp((t - 0.04) / 0.14)), a = 1 - clamp((t - 0.1) / 0.1);
      if (a > 0) {
        fang(p, -3, -21 - open * 2, 6, 1, a); fang(p, 3, -21 - open * 2, 6, 1, a);
        fang(p, -3, -2 + open * 2, 6, -1, a); fang(p, 3, -2 + open * 2, 6, -1, a);
      }
      const s = clamp(t / 0.16);
      if (s < 1) { p.circle(0, -11, 2 + ease.outCubic(s) * 5, POISON[s < 0.3 ? 4 : 2], 1 - s); p.circle(0, -11, 1 + s * 3, POISON[1], 1 - s); }
      bubbles.draw(p); drops.draw(p); ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
