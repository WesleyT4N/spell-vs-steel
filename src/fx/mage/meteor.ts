// Meteor's impact (meteorBlast, on each panel of the plus): the biggest fire hit the Mage has: a white
// flash, a fireball that swells to fill the box and climbs into a mushroom, rock chunks thrown out, a double ring of
// fire over the floor and a black crater crack left behind.
import { Particles, Bits, P, Rng, clamp, ease, sparkle, hex } from '../../vendor/pixelfx/index.js';
import { chunks, crack, STONE } from '../lib';
import { FIRE, FIRE_SPARKS, blast, fireRing } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Meteor', desc: 'A box-filling fireball climbs into a mushroom; rocks fly, the floor cracks.', duration: 0.5, ink: '#000000' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: FIRE_SPARKS });
  const bits = new Bits({ ground: () => 0 });
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) {
        go = true;
        chunks(bits, R, 0, -1, 4, 7, [70, 120], STONE);
        for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + R.range(-1.3, 1.3), s = R.range(80, 140); ps.spawn(P.SPARK, 0, -8, Math.cos(a) * s, Math.sin(a) * s, R.range(0.12, 0.25)); }
        for (let i = 0; i < 5; i++) ps.spawn(P.EMBER, R.range(-8, 8), R.range(-18, -6), R.range(-15, 15), R.range(-45, -20), R.range(0.25, 0.38), 0, 1.6, R.range(0, 0.08));
      }
      ps.update(dt); bits.update(dt);
    },
    draw(p: Painter) {
      const u = clamp(t / 0.5), grow = ease.outCubic(clamp(t / 0.1));
      crack(p, 0, 0, 18, o.seed, hex('#000000'), clamp(1 - (t - 0.35) / 0.15));
      // the stem and the cap: the cap rises and cools while the stem burns out under it
      const fade = clamp((1 - u) / 0.15);
      blast(p, 0, -5, 4 + grow * 2.5 - u * 5, 0.9 - u, o.seed % 53, t, fade);
      blast(p, 0, -10 - u * 6, 6 + grow * 3.5 - u * 6, 1.05 - u * 0.9, o.seed % 71, t, fade);
      if (t < 0.07) sparkle(p, 0, -10, 8 * (1 - t / 0.07) + 2, FIRE[5], FIRE[4], 0.4);
      fireRing(p, 0, 0, t / 0.3, 12, 2.5);
      fireRing(p, 0, 0, (t - 0.08) / 0.3, 10);
      bits.draw(p); ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
