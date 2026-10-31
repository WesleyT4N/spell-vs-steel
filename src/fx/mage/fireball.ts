// Fireball (shot:fireball): a boiling ball of fire, white at the heart, with a comet tail of smaller, cooler
// blobs that wobble behind it and embers peeling off the top.
import { clamp } from '../../vendor/pixelfx/index.js';
import { FIRE, Path, blast } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Fireball', desc: 'A boiling fireball with a wobbling comet tail and embers.', duration: 2, panels: 2, ink: '#000000' };

export function create(o: Opts) {
  const path = new Path(o);
  return {
    update() { /* position comes from the shot */ },
    draw(p: Painter, t: number, q: Opts) {
      const fl = path.flown(q);
      // the tail, back to front so the nearer blobs sit on top
      const tail: Array<[number, number, number]> = [[-17, 1.6, 0.2], [-12, 2.4, 0.4], [-7, 3.4, 0.65]];
      for (const [x, r, heat] of tail) if (-x < fl + 4) blast(p, x, Math.sin(t * 25 + x) * 1.5, r, heat, o.seed % 97, t);
      blast(p, 0, 0, 5.5, 1, o.seed % 97, t);
      // embers flicking up off the top and streaming back
      for (let i = 0; i < 3; i++) {
        const ph = (t * 4 + i / 3) % 1, x = -3 - ph * 16, y = -4 - ph * 6 + Math.sin(i * 2 + t * 30);
        if (-x < fl) p.px(x, y, ph < 0.5 ? FIRE[5] : FIRE[3]);
      }
      p.glow(1, 0, 10, FIRE[4], 0.25 * clamp(fl / 6 + 0.5));
    },
  };
}

export default { meta, create } satisfies PfxModule;
