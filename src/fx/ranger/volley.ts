// Volley (each of the six panels): three arrows come down steep and fast and are already in the floor on the hit
// frame, quivering, with a puff of dust each; then they dither away.
import { Particles, Rng, clamp } from '../../vendor/pixelfx/index.js';
import { dust } from '../lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';
import { plunge, K } from './lib';

export const meta = { name: 'Volley', desc: 'Three steep arrows thud into the floor and quiver.', duration: 0.44, ink: '#000000' };

export function create(o: Opts) {
  const R = new Rng(o.seed), ps = new Particles({ rng: R, ground: () => 0 });
  const xs = [-7, -1, 5].map(x => x + Math.round(R.range(-1, 1)));
  let t = 0, go = false;
  return {
    update(dt: number) { t += dt; if (!go) { go = true; for (const x of xs) dust(ps, R, x, -1, 1, 1); } ps.update(dt); },
    draw(p: Painter) {
      const fade = 1 - clamp((t - 0.25) / 0.19);
      xs.forEach((x, i) => {
        // they land a frame apart, the last just after the hit frame
        const land = (i - 1) * 0.02, f = clamp((t - land + 0.05) / 0.05), stuck = f >= 1;
        const lean = -3, y = stuck ? -1 + i % 2 : -1 - (1 - f) * 12;
        const qx = stuck && t - land < 0.15 ? Math.round(Math.sin((t - land) * 90) * (1 - (t - land) / 0.15)) : 0;
        if (f > 0) plunge(p, x - (stuck ? 0 : (1 - f) * 4), y, lean + qx, fade);
        if (!stuck && f > 0) for (let d = 0; d < 4; d += 2) p.dot(x - (1 - f) * 4 + 3 + d * 0.4, y - 11 - d, K.steel, 0.8);
      });
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
