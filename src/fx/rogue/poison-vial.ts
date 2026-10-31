// Poison Vial, the throw: a corked green vial tumbles in a low arc to the panel 3 ahead, sloshing and dripping,
// and lands as the 0.4 s telegraph ends (its burst is poison-vial-burst). The vial always lands 3 panels ahead.
// Its fx dur must be 0.32 (x fxSlow = 0.4 s), so it lands on the beat the burst starts.
import { Rng, clamp, hex } from '../../vendor/pixelfx/index.js';
import { POISON, WHITE, Drops } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Poison Vial: throw', desc: 'A corked vial tumbles in a low arc, dripping.', duration: 0.4, panels: 4, ink: '#000000' };

const CORK = hex('#ac7c00'), GLASS = hex('#a4e4fc');

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const drops = new Drops();
  const X0 = 6, X1 = 3 * 38, T = 0.4;
  const at = (t: number): [number, number] => { const u = clamp(t / T); return [X0 + (X1 - X0) * u, -13 + 10 * u - 10 * Math.sin(Math.PI * u)]; };
  let t = 0, next = 0.05;
  return {
    update(dt: number) {
      t += dt;
      if (t >= next && t < T - 0.08) { next += 0.07; const [x, y] = at(t); drops.add(x + R.range(-1, 1), y + 3, R.range(-10, 10), R.range(0, 20), POISON[R.int(2, 3)], 0.12); }
      drops.update(dt);
    },
    draw(p: Painter) {
      if (t < T) {
        const [x, y] = at(t), spin = Math.floor(t * 20) % 4;
        // a round flask on its side or upright as it tumbles: glass, liquid, a cork
        const nx = [0, 1, 0, -1][spin], ny = [-1, 0, 1, 0][spin];
        p.circle(x, y, 2.6, GLASS);
        p.circle(x, y + 0.5, 1.8, POISON[2]);
        p.px(x - 1, y - 1, WHITE);
        p.rect(x + nx * 3 - 1, y + ny * 3 - 1, 2, 2, CORK);
      }
      drops.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
