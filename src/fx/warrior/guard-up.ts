// Guard: the Warrior raises their shield: a steel kite shield flashes up in front of them with a glint.
import { Rng, fit, sparkle, clamp, ease } from '../../vendor/pixelfx/index.js';
import { RAMPS } from '../palette';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Guard', desc: 'A steel shield flashes up in front.', duration: 0.35, ink: '#000000' };

export function create(o: Opts) {
  const S = fit([...RAMPS.steel], 5);
  void new Rng(o.seed);
  let t = 0;
  return {
    update(dt: number) { t += dt; },
    draw(p: Painter) {
      const up = ease.outBack(clamp(t / 0.08)), fade = clamp((t - 0.2) / 0.15), y = 4 * (1 - up);
      if (fade >= 1) return;
      p.poly([[6, -20 + y], [12, -18 + y], [12, -9 + y], [9, -4 + y], [6, -9 + y]], t < 0.05 ? S[4] : S[3], 1 - fade);
      p.line(9, -18 + y, 9, -6 + y, S[2], 1 - fade);
      if (t > 0.05 && t < 0.18) sparkle(p, 11, -17, 3, S[4], S[3], 0.3);
    },
  };
}

export default { meta, create } satisfies PfxModule;
