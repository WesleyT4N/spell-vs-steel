// Tripwire (sprung): a wire snaps taut at ankle height between two pegs and twangs, sparks jump off the pegs, and
// gold stun stars start circling over the victim's head.
import { Particles, Rng, clamp, ease } from '../../vendor/pixelfx/index.js';
import type { PfxModule, Opts, Painter } from '../../game/pfx';
import { glint, K, STEEL_SPARKS } from './lib';
import { sparks } from '../lib';

export const meta = { name: 'Tripwire', desc: 'A wire snaps taut and twangs; stun stars circle.', duration: 0.62, ink: '#000000' };

export function create(o: Opts) {
  const R = new Rng(o.seed), ps = new Particles({ rng: R, ground: () => 0, sparks: STEEL_SPARKS });
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) { go = true; sparks(ps, R, -11, -4, 3, -Math.PI / 2, 0.9, [40, 80]); sparks(ps, R, 11, -4, 3, -Math.PI / 2, 0.9, [40, 80]); }
      ps.update(dt);
    },
    draw(p: Painter) {
      const fade = 1 - clamp((t - 0.4) / 0.16);
      if (fade <= 0) return;
      // pegs and the wire: a decaying wobble along its length
      p.rect(-12, -5, 2, 5, K.wood, fade); p.rect(10, -5, 2, 5, K.wood, fade);
      const amp = 3 * Math.exp(-t * 9) * Math.cos(t * 70);
      for (let x = -10; x <= 10; x++) p.dot(x, -4 + Math.round(amp * Math.sin(((x + 10) / 20) * Math.PI)), t < 0.06 ? K.white : K.steel, fade);
      // stun stars: three gold stars orbiting over the head
      const s = ease.outCubic(clamp((t - 0.05) / 0.12));
      if (s > 0) for (let i = 0; i < 3; i++) {
        const a = t * 9 + (i * Math.PI * 2) / 3, x = Math.cos(a) * 7 * s, y = -21 + Math.sin(a) * 2;
        glint(p, x, y, 1, i % 2 ? K.gold : K.straw, K.gold);
      }
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
