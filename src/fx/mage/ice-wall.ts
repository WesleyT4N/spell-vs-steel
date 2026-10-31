// Ice Wall (iceWall, on the wall's panel): the block freezes into being: a fan of ice spikes stabs up out
// of the floor, flashes, and breaks off into glittering frost as the block itself settles in behind them.
import { Particles, Bits, B, P, Rng, clamp, ease, hex } from '../../vendor/pixelfx/index.js';
import { shock } from '../lib';
import { ICE, spike } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Ice Wall', desc: 'A fan of ice spikes stabs up and breaks off as the block forms.', duration: 0.4, ink: '#0000bc' };

const FAN: Array<[number, number, number]> = [[-8, 9, -3], [-3, 15, -1], [3, 17, 1], [8, 11, 3]];

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0 });
  const bits = new Bits({ ground: () => 0 });
  let t = 0, broke = false;
  return {
    update(dt: number) {
      t += dt;
      if (!broke && t > 0.2) {
        broke = true;
        for (const [x, h] of FAN) bits.add({ kind: B.SHARD, x, y: -h * 0.6, vx: R.range(-35, 35), vy: -R.range(20, 50), a: R.range(0, 3), va: R.range(-15, 15), s: 2.5, c: hex('#a4e4fc'), g: 0.6, life: 0.18 });
        for (let i = 0; i < 6; i++) ps.spawn(P.STAR, R.range(-10, 10), R.range(-20, -4), 0, -8, R.range(0.12, 0.2), hex('#fcfcfc'), 0.5, R.range(0, 0.06));
      }
      ps.update(dt); bits.update(dt);
    },
    draw(p: Painter) {
      if (t < 0.2) FAN.forEach(([x, h, lean], i) => {
        const g = ease.outBack(clamp((t - i * 0.02) / 0.07));
        spike(p, x, 0, h * g, 4.5, lean * g, { white: t - i * 0.02 < 0.03 && t >= i * 0.02, glint: (t * 6) % 1 });
      });
      shock(p, 0, 0, t / 0.25, 12, ICE.slice(1));
      bits.draw(p); ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
