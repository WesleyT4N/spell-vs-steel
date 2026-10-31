// Blind: a fistful of sand flung in the foe's eyes: grit sprays forward across both panels ahead and bursts into
// a tan dust cloud at face height on the far one, with a twinkle or two of glitter in it.
import { Particles, Rng, clamp, hex, P } from '../../vendor/pixelfx/index.js';
import { DUSTR, Puffs } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Blind', desc: 'Grit sprays across two panels and bursts into a dust cloud.', duration: 0.5, panels: 2, ink: '#503000' };

const SAND = ['#503000', '#ac7c00', '#f0d0b0', '#fce0a8'].map(hex);

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0 });
  const cloud = new Puffs(SAND);
  // grit: each grain flies from the hand to somewhere round the far foe's face
  const grit = Array.from({ length: 12 }, () => ({ x1: R.range(18, 46), y1: R.range(-18, -9), d: R.range(0, 0.05), c: R.pick([SAND[1], SAND[2], SAND[3]]) }));
  let t = 0, burst = false;
  return {
    update(dt: number) {
      t += dt;
      if (!burst && t >= 0.08) {
        burst = true;
        cloud.add(38, -14, 5, -3, 4.5, 0.38); cloud.add(33, -11, -4, -2, 3.5, 0.34, 0.02); cloud.add(42, -9, 6, -1, 3.5, 0.32, 0.03); cloud.add(22, -12, 0, -2, 3, 0.26, 0.01);
        for (let i = 0; i < 2; i++) ps.spawn(P.STAR, R.range(30, 46), R.range(-19, -9), 0, -4, 0.3, hex('#fce0a8'), 0.8, 0.05 + i * 0.08);
      }
      cloud.update(dt); ps.update(dt);
    },
    draw(p: Painter) {
      for (const g of grit) {
        const u = clamp((t - g.d) / 0.1);
        if (u <= 0 || u >= 1) continue;
        p.px(6 + (g.x1 - 6) * u, -12 + (g.y1 + 12) * u - Math.sin(Math.PI * u) * 2, g.c);
      }
      if (t < 0.05) for (let i = 0; i < 3; i++) p.px(8 + i, -12 - (i % 2), DUSTR[2]);
      cloud.draw(p); ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
