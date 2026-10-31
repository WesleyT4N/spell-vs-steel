// Repulse (shot:gust): a wall of force rolling down the row: three bowed fronts, white in the lead, each pulsing
// a little out of step, with wind lines streaming off the back.
import { clamp } from '../../vendor/pixelfx/index.js';
import { ARC, WHITE, Path } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Repulse', desc: 'Three bowed fronts of force with wind lines off the back.', duration: 2, panels: 2, ink: '#000000' };

export function create(o: Opts) {
  const path = new Path(o);
  return {
    update() { /* position comes from the shot */ },
    draw(p: Painter, t: number, q: Opts) {
      const fl = path.flown(q);
      for (let k = 2; k >= 0; k--) {
        if (k * 5 > fl + 2) continue;
        const pulse = Math.sin(t * 40 - k * 1.4) * 0.5 + 0.5, r = 10 - k * 2 + pulse, cx = 2 - k * 5;
        const c = k === 0 ? WHITE : k === 1 ? ARC[3] : ARC[2];
        for (let y = -Math.round(r); y <= Math.round(r); y++) {
          const bend = (y * y) / (r * 1.5), x = cx - bend;
          p.px(x, y, c); if (k === 0) p.px(x - 1, y, ARC[3]);
        }
      }
      // wind lines off the back, staggered
      for (let i = 0; i < 4; i++) {
        const y = -7 + i * 4.5, ph = (t * 6 + i * 0.37) % 1, x0 = -12 - ph * 14, len = 6 - ph * 4;
        if (-x0 < fl) p.line(x0, y, x0 + len, y, ARC[3], clamp(1.3 - ph));
      }
      p.glow(0, 0, 10, ARC[2], 0.2);
    },
  };
}

export default { meta, create } satisfies PfxModule;
