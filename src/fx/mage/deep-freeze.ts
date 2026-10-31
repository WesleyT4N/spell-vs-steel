// Deep Freeze (deepFreeze, on the enemy): two great ice fangs slam shut on the fighter from either side
// and a third rises behind, a white flash where they meet, frost gusting out and a ring locking on the floor.
import { Particles, P, Rng, clamp, ease, hex, sparkle } from '../../vendor/pixelfx/index.js';
import { shock } from '../lib';
import { ICE, ICE_SPARKS, spike, rune, WHITE } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Deep Freeze', desc: 'Two great ice fangs slam shut on the enemy, a third behind.', duration: 0.4, ink: '#0000bc' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: ICE_SPARKS });
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) {
        go = true;
        for (let i = 0; i < 6; i++) ps.spawn(P.SPARK, R.sign() * R.range(2, 5), R.range(-18, -8), R.range(-70, 70), R.range(-40, 10), R.range(0.1, 0.2));
        for (let i = 0; i < 6; i++) ps.spawn(P.FLAKE, R.range(-10, 10), R.range(-20, -4), R.range(-25, 25), R.range(-15, 5), R.range(0.25, 0.4), hex(i % 2 ? '#fcfcfc' : '#a4e4fc'), 1.5);
      }
      ps.update(dt);
    },
    draw(p: Painter) {
      const snap = ease.outBack(clamp(t / 0.05)), fade = 1 - ease.inQuad(clamp((t - 0.22) / 0.18));
      // the back fang rises, the side fangs lean in to meet over the fighter
      spike(p, 0, -2, 19 * snap, 6, 0, { a: fade, white: t < 0.03 });
      spike(p, -7, 0, 19 * snap, 6, 6 * snap, { a: fade, white: t < 0.03, glint: (t * 4) % 1 });
      spike(p, 7, 0, 17 * snap, 6, -5 * snap, { a: fade, white: t < 0.03 });
      if (t < 0.06) sparkle(p, 0, -18, 5, ICE[4], ICE[3], 0.3);
      rune(p, 0, -1, 11, t * 2, ICE[3], WHITE, fade, 0.3);
      shock(p, 0, 0, t / 0.25, 12, ICE.slice(1));
      ps.draw(p);
    },
  };
}
export default { meta, create } satisfies PfxModule;
