// Power Word: Shield: a bubble of gold light draws itself round the Priest from the floor up, both sides at once,
// closes over the head with a white flash and a little cross, then thins to a faint rim. Fx kind 'pwShield'.
import { Rng, clamp, TAU, sparkle } from '../../vendor/pixelfx/index.js';
import { GOLD, cross } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Power Word: Shield', desc: 'A gold bubble draws itself up round the Priest and closes with a flash.', duration: 0.625, ink: '#503000' };

export function create(o: Opts) {
  const G = GOLD();
  void new Rng(o.seed);
  let t = 0;
  return {
    update(dt: number) { t += dt; },
    draw(p: Painter) {
      const cx = 0, cy = -11, r = 11, draw = clamp(t / 0.16), fade = clamp((t - 0.3) / 0.32);
      if (fade >= 1) return;
      const a = 1 - fade, closed = draw >= 1;
      // both halves sweep from the bottom (angle PI/2) up to the top (-PI/2)
      const sweep = draw * Math.PI;
      for (let j = 0, m = 80; j < m; j++) {
        const g = (j / m) * TAU, off = Math.abs(((g - Math.PI / 2 + TAU) % TAU) - Math.PI); // 0 at top, PI at bottom
        if (Math.PI - off > sweep) continue;
        const hot = closed && t < 0.22;
        p.dot(cx + Math.cos(g) * r, cy + Math.sin(g) * r * 1.05, hot ? G[5] : Math.sin(g) < -0.3 ? G[4] : G[3], a);
        if (fade < 0.5) p.dot(cx + Math.cos(g) * (r - 1), cy + Math.sin(g) * (r - 1) * 1.05, G[2], a * 0.9);
      }
      // the shine on its shoulder
      if (closed && fade < 0.6) { p.dot(-6, -19, G[5], a); p.dot(-7, -18, G[5], a); p.dot(-8, -16, G[4], a); }
      if (closed && t < 0.3) { sparkle(p, 0, -22, 3, G[5], G[3], 0.25); }
      else if (closed) cross(p, 0, -22, 1, G[4], G[5], a);
      if (!closed) p.glow(0, -11, 10, G[3], 0.2);
    },
  };
}

export default { meta, create } satisfies PfxModule;
