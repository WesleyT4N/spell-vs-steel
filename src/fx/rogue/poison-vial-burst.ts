// Poison Vial, the burst (one per panel of the 2x2): glass shards fly, a crown of venom splashes up, a green
// puddle spreads over the floor and bubbles, and a little toxic gas rises off it before it all soaks away.
import { Particles, Bits, B, Rng, clamp, ease, hex } from '../../vendor/pixelfx/index.js';
import { POISON, POISON_SPARKS, Bubbles, Drops, Puffs } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Poison Vial: burst', desc: 'Glass, a venom crown, and a bubbling green puddle.', duration: 0.6, ink: '#005800' };

const GAS = ['#005800', '#00a800', '#58d854', '#b8f818'].map(hex);

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: POISON_SPARKS });
  const bits = new Bits({ ground: () => 0 });
  const drops = new Drops(), bubbles = new Bubbles(), gas = new Puffs(GAS);
  let t = 0, hit = false;
  return {
    update(dt: number) {
      t += dt;
      if (!hit) {
        hit = true;
        for (let i = 0; i < 3; i++) bits.add({ kind: B.SHARD, x: R.range(-3, 3), y: -4, vx: R.range(-40, 40), vy: R.range(-90, -50), a: R.range(0, 3), va: R.range(-20, 20), s: 2, c: '#a4e4fc', g: 0.6, life: 0.3 });
        for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + R.range(-1.1, 1.1); drops.add(R.range(-3, 3), -2, Math.cos(a) * R.range(20, 40), Math.sin(a) * R.range(70, 130), POISON[R.int(2, 4)], 0.5); }
        for (let i = 0; i < 4; i++) bubbles.add(R.range(-7, 7), -1, -R.range(14, 26), R.range(1.4, 2.2), R.range(0.15, 0.25), 0.08 + i * 0.05);
        gas.burst(R, 0, -6, 3, 6, 2, [2, 3.2], [0.3, 0.4], 6, 12);
      }
      ps.update(dt); bits.update(dt); drops.update(dt); bubbles.update(dt); gas.update(dt);
    },
    draw(p: Painter) {
      // the puddle: spreads fast, then shrinks away
      const w = 10 * ease.outCubic(clamp(t / 0.1)) * (1 - ease.inQuad(clamp((t - 0.32) / 0.25)));
      if (w > 1) { p.ellipse(0, 0, w, 2, POISON[1]); p.ellipse(-1, -0.5, w * 0.6, 1, POISON[2]); }
      if (t < 0.05) p.circle(0, -3, 3 * (1 - t / 0.05) + 1, POISON[4]);
      gas.draw(p); bubbles.draw(p); drops.draw(p); bits.draw(p); ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
