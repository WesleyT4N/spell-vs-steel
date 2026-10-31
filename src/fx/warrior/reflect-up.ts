// Spell Reflection: a mirror of steel light stands up in front of the Warrior and a glint runs down it.
import { Rng, fit, sparkle, clamp } from '../../vendor/pixelfx/index.js';
import { RAMPS } from '../palette';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Spell Reflection', desc: 'A mirror of light with a glint running down it.', duration: 0.4, ink: '#3c3c3c' };

export function create(o: Opts) {
  const S = fit([...RAMPS.steel], 5), F = fit([...RAMPS.frost], 6);
  void new Rng(o.seed);
  let t = 0;
  return {
    update(dt: number) { t += dt; },
    draw(p: Painter) {
      const h = 20 * clamp(t / 0.06), fade = clamp((t - 0.25) / 0.15);
      if (fade >= 1) return;
      p.rect(9, -2 - h, 3, h, F[4], 1 - fade);
      p.rect(10, -2 - h, 1, h, S[4], 1 - fade);
      const g = (t - 0.06) / 0.18;
      if (g > 0 && g < 1) sparkle(p, 10, -22 + g * 18, 3, S[4], F[4], 0.3);
    },
  };
}

export default { meta, create } satisfies PfxModule;
