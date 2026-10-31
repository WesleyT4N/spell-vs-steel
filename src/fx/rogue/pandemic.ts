// Pandemic (one per enemy panel): the plague wells up out of the floor: a bubbling green pool opens, a toxic
// plume coughs up out of it, and drops rain back down; each panel starts a beat apart (from the seed).
import { Rng, clamp, ease, hex } from '../../vendor/pixelfx/index.js';
import { POISON, Bubbles, Drops, Puffs } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Pandemic', desc: 'A green pool bubbles and coughs up a toxic plume.', duration: 0.65, ink: '#005800' };

const GAS = ['#005800', '#00a800', '#58d854', '#b8f818', '#d8f878'].map(hex);

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const D = R.range(0, 0.1);
  const plume = new Puffs(GAS), bubbles = new Bubbles(), drops = new Drops();
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go && t >= D) {
        go = true;
        for (let i = 0; i < 4; i++) plume.add(R.range(-2, 2), -3 - i * 3, R.range(-6, 6), -R.range(16, 26), 3.2 - i * 0.4, R.range(0.32, 0.42), i * 0.03);
        for (let i = 0; i < 4; i++) bubbles.add(R.range(-7, 7), -1, -R.range(6, 12), R.range(1.3, 2), R.range(0.15, 0.3), 0.05 + i * 0.07);
        for (let i = 0; i < 4; i++) drops.add(R.range(-3, 3), -14, R.range(-20, 20), -R.range(40, 70), POISON[R.int(2, 4)], 0.5);
      }
      plume.update(dt); bubbles.update(dt); drops.update(dt);
    },
    draw(p: Painter) {
      const u = t - D;
      if (u < 0) return;
      const w = 9 * ease.outCubic(clamp(u / 0.12)) * (1 - ease.inQuad(clamp((u - 0.35) / 0.18)));
      if (w > 1) { p.ellipse(0, 0, w, 2, POISON[1]); p.ellipse(0, -0.5, w * 0.6, 1, POISON[2]); }
      plume.draw(p); bubbles.draw(p); drops.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
