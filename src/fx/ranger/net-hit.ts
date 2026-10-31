// Net hit: the net wraps the target: the mesh drops over them from the head down, cinches in, and its weights
// thump on the floor with a puff of dust.
import { Particles, Rng, clamp, ease } from '../../vendor/pixelfx/index.js';
import type { PfxModule, Opts, Painter } from '../../game/pfx';
import { dust } from '../lib';
import { K } from './lib';

export const meta = { name: 'Net hit', desc: 'The net drops over the target, cinches and thumps down.', duration: 0.56 };

export function create(o: Opts) {
  const R = new Rng(o.seed), ps = new Particles({ rng: R, ground: () => 0 });
  let t = 0, thud = false;
  return {
    update(dt: number) {
      t += dt;
      if (!thud && t > 0.08) { thud = true; dust(ps, R, -6, -1, 2, 2); dust(ps, R, 6, -1, 2, 2); }
      ps.update(dt);
    },
    draw(p: Painter) {
      const drop = ease.outCubic(clamp((t + 0.03) / 0.12)), cinch = clamp((t - 0.12) / 0.15), fade = 1 - clamp((t - 0.3) / 0.15);
      if (fade <= 0) { ps.draw(p); return; }
      const top = -22, bot = top + Math.round(21 * drop), hw = 9 - cinch * 2;
      p.shade(-hw - 1, top, hw + 1, bot, (x: number, y: number, out: { c: number; a: number }) => {
        // the net bulges at the middle, narrower at head and feet
        const k = (y - top) / 22, half = hw * (0.75 + 0.25 * Math.sin(k * Math.PI));
        if (Math.abs(x) > half) return;
        const on = ((Math.floor(x) + Math.floor(y)) % 5 + 5) % 5 === 0 || ((Math.floor(x) - Math.floor(y)) % 5 + 5) % 5 === 0;
        if (!on && Math.abs(x) < half - 0.8 && y < bot - 1) return;
        out.c = Math.abs(x) >= half - 0.8 || y >= bot - 1 ? K.bark : K.wood; out.a = fade;
      });
      if (drop >= 1) for (const x of [-hw, hw]) { p.rect(Math.round(x) - 1, -3, 3, 3, K.ink, fade); p.px(Math.round(x), -2, K.steel, fade); }
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
