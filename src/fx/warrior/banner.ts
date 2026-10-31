// War Banner: banners in the Warrior's team color slam into all three stolen panels with a puff of dust and wave
// there until the panels go back.
import { Particles, Rng, clamp, ease, hex } from '../../vendor/pixelfx/index.js';
import { dust, ROW } from '../lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'War Banner', desc: 'Team-color banners slam down and wave.', duration: 5, rows: 3, ink: '#000000' };

export function create(o: Opts) {
  const R = new Rng(o.seed), mark = hex(o.team.mark), dark = hex(o.team.dark), pole = hex('#503000'), gold = hex('#f8b800');
  const ps = new Particles({ rng: R, ground: () => 0 });
  const rows = [-ROW, 0, ROW];
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) { go = true; rows.forEach(y => dust(ps, R, 0, y - 1, 2, 6)); }
      ps.update(dt);
    },
    draw(p: Painter) {
      const drop = 1 - ease.outBack(clamp(t / 0.12)), fade = clamp((t - 4.8) / 0.2);
      rows.forEach((y, r) => {
        const top = y - 15 - drop * 12, a = 1 - fade;
        p.rect(-1, top, 2, y - top, pole, a);
        p.rect(-1, top - 1, 2, 1, gold, a);
        // the flag, waving: each column of it bobs with the wind
        for (let i = 0; i < 8; i++) {
          const off = Math.round(Math.sin(t * 6 + r + i * 0.9) * (i / 8) * 1.5);
          p.rect(1 + i, top + 1 + off, 1, 5, i > 5 ? dark : mark, a);
        }
      });
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
