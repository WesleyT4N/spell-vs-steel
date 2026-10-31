// Glacial Fortress (glacialFortress, on the caster's front column, anchored on its middle row): the column
// freezes in one heave: on each panel, middle first, a rank of great ice spikes stabs up, flashes white and
// breaks off in shards as the glacial walls stand behind them; a frost shock rolls along each panel.
import { Bits, B, Particles, P, Rng, clamp, ease, hex } from '../../vendor/pixelfx/index.js';
import { shock, ROW } from '../lib';
import { ICE, spike } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Glacial Fortress', desc: 'A rank of great ice spikes heaves up on each panel of the column.', duration: 0.6, rows: 3, ink: '#0000bc' };

const RANK: Array<[number, number, number]> = [[-7, 12, -1.5], [-2, 20, -0.5], [3, 17, 0.5], [7, 11, 1.5]];

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => ROW + 1 });
  const bits = new Bits({ ground: () => ROW + 1 });
  const rows = [-ROW, 0, ROW], delay = [0.07, 0, 0.07], broke = [false, false, false];
  let t = 0;
  return {
    update(dt: number) {
      t += dt;
      rows.forEach((y, i) => {
        if (broke[i] || t < delay[i] + 0.3) return;
        broke[i] = true;
        for (const [x, h] of RANK) bits.add({ kind: B.SHARD, x, y: y - h * 0.5, vx: R.range(-40, 40), vy: -R.range(20, 60), a: R.range(0, 3), va: R.range(-15, 15), s: 3, c: hex(R.pick(['#a4e4fc', '#3cbcfc'])), g: 0.6, life: 0.2 });
        for (let k = 0; k < 4; k++) ps.spawn(P.STAR, R.range(-10, 10), y - R.range(4, 20), 0, -8, R.range(0.12, 0.22), hex('#fcfcfc'), 0.5);
      });
      ps.update(dt); bits.update(dt);
    },
    draw(p: Painter) {
      rows.forEach((y, i) => {
        const u = t - delay[i];
        if (u < 0) return;
        if (u < 0.3) RANK.forEach(([x, h, lean], k) => {
          const g = ease.outBack(clamp((u - k * 0.02) / 0.08)) * (1 - ease.inQuad(clamp((u - 0.18) / 0.12)) * 0.3);
          spike(p, x, y, h * g, 5, lean, { white: u - k * 0.02 < 0.035 && u >= k * 0.02, glint: (u * 4) % 1 });
        });
        shock(p, 0, y, u / 0.3, 12, ICE.slice(1));
      });
      bits.draw(p); ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
