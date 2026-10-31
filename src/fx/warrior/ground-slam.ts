// Ground Slam: the shockwave arrives in the enemy front column: the middle panel bursts first and the shock runs up
// and down to the other two, each kicking up chunks and dust and leaving a crack.
import { Particles, Bits, Rng, fit, sparkle, clamp, hex } from '../../vendor/pixelfx/index.js';
import { RAMPS } from '../palette';
import { sparks, chunks, dust, shock, crack, ROW } from '../lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Ground Slam', desc: 'A shock bursts up and down the enemy front column.', duration: 0.55, rows: 3, ink: '#503000' };

export function create(o: Opts) {
  const C = fit([...RAMPS.dust, '#fcfcfc'], 5), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: ['#fcfcfc', '#fce0a8', '#f0d0b0', '#ac7c00'] });
  const bits = new Bits({ ground: () => 0 });
  const rows = [-ROW, 0, ROW], delay = [0.05, 0, 0.05];
  const done = [false, false, false];
  let t = 0;
  return {
    update(dt: number) {
      t += dt;
      rows.forEach((y, i) => {
        if (done[i] || t < delay[i]) return;
        done[i] = true;
        chunks(bits, R, 0, y - 1, 3); dust(ps, R, 0, y - 1, 3);
        sparks(ps, R, 0, y - 2, 3, -Math.PI / 2, 1.2, [40, 90]);
      });
      ps.update(dt); bits.update(dt);
    },
    draw(p: Painter) {
      rows.forEach((y, i) => {
        const u = t - delay[i];
        if (u >= 0 && u < 0.05) sparkle(p, 0, y - 2, 5, C[3], C[2], 0.3);
        shock(p, 0, y, u / 0.3, 13, C);
        crack(p, 0, y, 14, o.seed + i, hex('#503000'), clamp(1 - (t - 0.35) / 0.2));
      });
      bits.draw(p); ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
