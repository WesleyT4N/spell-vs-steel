// Spirit Bear swipe (claw): four broad pale-blue claw rakes tear down across the target, white-edged, and blue
// spirit motes spill off them.
import { Particles, Rng, clamp, hex, P } from '../../vendor/pixelfx/index.js';
import type { PfxModule, Opts, Painter } from '../../game/pfx';
import { rakes, K } from './lib';

export const meta = { name: 'Spirit Bear swipe', desc: 'Four broad spirit-blue claw rakes.', duration: 0.38, ink: '#0000bc' };

export function create(o: Opts) {
  const R = new Rng(o.seed), ps = new Particles({ rng: R, ground: () => 0 });
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) { go = true; for (let i = 0; i < 5; i++) ps.spawn(P.FLAKE, R.range(-6, 8), R.range(-18, -6), R.range(10, 30), R.range(-20, 5), R.range(0.2, 0.32), hex('#a4e4fc'), 1.4); }
      ps.update(dt);
    },
    draw(p: Painter) {
      rakes(p, 4, clamp((t + 0.04) / 0.06), clamp((t - 0.13) / 0.15), K.white, hex('#6888fc'), -11, -21, 14, 5);
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
