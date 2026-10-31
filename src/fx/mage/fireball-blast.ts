// Fireball's explosion (fireballBlast, on each of the 2x2 panels): the ball bursts already white-hot on
// the hit frame, swells and burns down through orange to a dark red husk that breaks up, with a ring of fire
// rolling over the floor and embers thrown out.
import { Particles, P, Rng, clamp, ease, sparkle } from '../../vendor/pixelfx/index.js';
import { FIRE, FIRE_SPARKS, blast, fireRing } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Fireball Blast', desc: 'A white-hot burst that swells and burns down, a ring of fire on the floor.', duration: 0.35, ink: '#881400' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: FIRE_SPARKS });
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) {
        go = true;
        for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + R.range(-1.4, 1.4), s = R.range(60, 120); ps.spawn(P.SPARK, 0, -10, Math.cos(a) * s, Math.sin(a) * s, R.range(0.1, 0.22)); }
        for (let i = 0; i < 4; i++) ps.spawn(P.EMBER, R.range(-6, 6), R.range(-14, -6), R.range(-20, 20), R.range(-40, -15), R.range(0.2, 0.3), 0, 1);
      }
      ps.update(dt);
    },
    draw(p: Painter) {
      const u = clamp(t / 0.35), r = 5.5 + ease.outCubic(clamp(t / 0.12)) * 3.5 - u * 5;
      // the husk breaks up from the edge in, by dithering away late
      blast(p, 0, -10 - u * 3, r, 1 - u * 0.95, o.seed % 61, t, clamp((1 - u) / 0.15));
      if (t < 0.04) sparkle(p, 0, -10, 4, FIRE[5], FIRE[4], 0.3);
      fireRing(p, 0, 0, t / 0.22, 12);
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
