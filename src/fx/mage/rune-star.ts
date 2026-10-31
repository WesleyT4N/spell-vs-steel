// Mage light attack, Rune Star (shot:orb): a spinning four-point star of arcane force, two fading afterimages
// behind it at the angles it just passed, and motes it sheds that hang in the air where it flew.
import { clamp } from '../../vendor/pixelfx/index.js';
import { ARC, WHITE, Path } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Rune Star', desc: 'A spinning four-point star with afterimages and hanging motes.', duration: 2, panels: 2, ink: '#000000' };

/** A four-point star: long arms of length r, a fat middle, turned by a. */
function starShape(p: Painter, x: number, y: number, r: number, a: number, c: (d: number) => number, alpha = 1): void {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 8; i++) { const g = a + (i * Math.PI) / 4, rr = i % 2 ? r * 0.36 : r; pts.push([x + Math.cos(g) * rr, y + Math.sin(g) * rr]); }
  p.poly(pts, (px: number, py: number) => c(Math.hypot(px - x, py - y) / r), alpha);
}

export function create(o: Opts) {
  const path = new Path(o);
  return {
    update() { /* position comes from the shot */ },
    draw(p: Painter, t: number, q: Opts) {
      const fl = path.flown(q), spin = t * 30;
      // motes left hanging along the line it flew, fading out from the oldest
      for (let i = 1; i <= 4; i++) {
        const d = i * 9;
        if (d < fl) p.dot(-d, (i % 2 ? -3 : 3), i < 3 ? ARC[3] : ARC[2], clamp(1.2 - i * 0.22));
      }
      if (fl > 9) starShape(p, -9, 0, 4, spin - 0.6, () => ARC[2]);
      if (fl > 16) starShape(p, -16, 0, 2.5, spin - 1.2, () => ARC[1]);
      starShape(p, 0, 0, 6, spin, (d: number) => (d < 0.3 ? WHITE : d < 0.6 ? ARC[3] : ARC[2]));
      p.glow(0, 0, 9, ARC[2], 0.3);
      if (fl < 12) p.glow(-fl, 0, 6, ARC[3], 0.3 * (1 - fl / 12));
    },
  };
}

export default { meta, create } satisfies PfxModule;
