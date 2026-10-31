// Dragon's Breath (dragonsBreath, on each of the six panels): a wall of flame rolls forward across the
// panel, tall and white-hot at its front, leaving tongues that die down behind it and embers blown ahead.
import { Particles, P, Rng, clamp, ease } from '../../vendor/pixelfx/index.js';
import { FIRE, FIRE_SPARKS, flame } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: "Dragon's Breath", desc: 'A wall of flame rolls forward across each panel.', duration: 0.4, ink: '#881400' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: FIRE_SPARKS });
  const ph = R.range(0, 6);
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) {
        go = true;
        for (let i = 0; i < 4; i++) ps.spawn(P.EMBER, R.range(-6, 2), R.range(-16, -4), R.range(40, 70), R.range(-30, -10), R.range(0.2, 0.3), 0, 1);
      }
      ps.update(dt);
    },
    draw(p: Painter) {
      // the front: starts at the back third on the hit frame, crosses in 0.14s
      const front = -6 + ease.outCubic(clamp(t / 0.14)) * 16;
      for (let k = 0; k < 4; k++) {
        const x = -7 + k * 4.7;
        if (x > front + 1) continue;
        // a tongue's life starts when the front reaches it
        const born = clamp((x + 6) / 16) * 0.14, v = clamp((t - born + 0.04) / 0.26);
        if (v >= 1) continue;
        const atFront = front - x < 4, h = (atFront ? 20 : 15) * Math.sin(Math.PI * Math.pow(v, 0.5)) + (k % 2) * 2;
        flame(p, x, -1, h, atFront ? 4 : 3.2, t * 24 + ph + k * 1.7);
      }
      // the white lip of the front, leaning forward
      if (t < 0.16) p.line(Math.min(front, 8), -2, Math.min(front, 8) + 2, -14, FIRE[6], 1 - t / 0.16);
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
