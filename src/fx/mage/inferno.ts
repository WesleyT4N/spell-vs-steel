// Inferno (inferno, on every enemy panel): the panel catches all at once: a flash along the floor and a
// crown of flame tongues leaping up, each panel's crown its own heights, then settling into the long burn.
import { Particles, P, Rng, clamp } from '../../vendor/pixelfx/index.js';
import { FIRE, FIRE_SPARKS, flame } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Inferno', desc: 'Every enemy panel catches at once in a crown of leaping flames.', duration: 0.3, ink: '#881400' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: FIRE_SPARKS });
  const hs = [R.range(9, 14), R.range(15, 21), R.range(12, 18), R.range(8, 13)], ph = R.range(0, 6);
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) { go = true; for (let i = 0; i < 3; i++) ps.spawn(P.EMBER, R.range(-8, 8), R.range(-14, -6), R.range(-12, 12), R.range(-45, -20), R.range(0.18, 0.28), 0, 1); }
      ps.update(dt);
    },
    draw(p: Painter) {
      const u = clamp(t / 0.3);
      p.line(-11, -1, 11, -1, u < 0.2 ? FIRE[6] : FIRE[3], clamp(1 - u * 1.4));
      const rise = Math.sin(Math.PI * Math.pow(u, 0.45));
      hs.forEach((h, k) => flame(p, -8 + k * 5.3, -1, h * rise, 3.4, t * 26 + ph + k * 2.1));
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
