// Vanish: a pop of dark smoke swallows the Rogue: a violet glint, a ring of black-violet puffs bursting
// up and out, and a couple of lilac sparkles left hanging as it clears.
import { Particles, Rng, hex, P } from '../../vendor/pixelfx/index.js';
import { DUSK, Puffs, glint } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Vanish', desc: 'A pop of black-violet smoke swallows the Rogue.', duration: 0.5, ink: '#000000' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const smoke = new Puffs(DUSK);
  const ps = new Particles({ rng: R, ground: () => 0 });
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) {
        go = true;
        for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + R.range(-0.3, 0.3); smoke.add(Math.cos(a) * 3, -10 + Math.sin(a) * 5, Math.cos(a) * 30, Math.sin(a) * 26 - 8, R.range(3.2, 4.4), R.range(0.3, 0.42)); }
        smoke.add(0, -10, 0, -6, 5, 0.26);
        for (let i = 0; i < 2; i++) ps.spawn(P.STAR, R.range(-7, 7), R.range(-20, -6), 0, -5, 0.25, hex('#d8b8f8'), 1, 0.2 + i * 0.06);
      }
      smoke.update(dt); ps.update(dt);
    },
    draw(p: Painter) {
      if (t < 0.05) glint(p, 0, -10, 4 * (1 - t / 0.05) + 1, DUSK[4], 0.3);
      smoke.draw(p); ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
