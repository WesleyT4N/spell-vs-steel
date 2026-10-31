// Blizzard (shard, on each struck panel): an icicle has just speared into the panel on the hit frame, a streak of
// its fall still above it; it flashes, bursts into tumbling shards and a puff of snow, and leaves a frost ring.
import { Particles, Bits, B, P, Rng, hex } from '../../vendor/pixelfx/index.js';
import { shock } from '../lib';
import { ICE, ICE_SPARKS, WHITE, spike } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Blizzard', desc: 'An icicle spears the panel and bursts into shards and snow.', duration: 0.3, ink: '#0000bc' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: ICE_SPARKS });
  const bits = new Bits({ ground: () => 0 });
  const lean = R.range(-2, 1);
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) {
        go = true;
        for (let i = 0; i < 6; i++) bits.add({ kind: B.SHARD, x: R.range(-2, 2), y: R.range(-8, -2), vx: R.range(-60, 60), vy: -R.range(30, 80), a: R.range(0, 3), va: R.range(-20, 20), s: R.range(2, 3), c: hex(R.pick(['#3cbcfc', '#a4e4fc', '#0078f8'])), g: 0.7, bounce: 0.2, life: R.range(0.18, 0.28) });
        for (let i = 0; i < 4; i++) ps.spawn(P.FLAKE, R.range(-6, 6), R.range(-6, -2), R.range(-20, 20), R.range(-20, -5), R.range(0.2, 0.3), hex(i % 2 ? '#fcfcfc' : '#a4e4fc'), 1.5);
      }
      ps.update(dt); bits.update(dt);
    },
    draw(p: Painter) {
      // the fall's streak, fading from the top
      if (t < 0.06) p.line(lean * 6, -24, 0, -12, ICE[4], 1 - t / 0.06);
      // the icicle stands for an instant, white on the first frames
      if (t < 0.08) spike(p, 0, -1, 12 * (1 - t / 0.16), 4, lean, { white: t < 0.03 });
      if (t < 0.04) { p.px(0, -1, WHITE); p.line(-3, -1, 3, -1, ICE[4]); }
      shock(p, 0, 0, t / 0.22, 11, ICE.slice(1));
      bits.draw(p); ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
