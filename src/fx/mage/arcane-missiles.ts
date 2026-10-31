// Arcane Missiles (shot:missile): a hot pink bolt on its homing arc, a ribbon of its own path behind it that
// thins from white to deep magenta, and a star glint at its nose.
import { ARC, WHITE, Path, orb, star } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Arcane Missiles', desc: 'Homing bolts with a ribbon of their own arc behind them.', duration: 2, panels: 2, ink: '#000000' };

export function create(o: Opts) {
  const path = new Path(o);
  return {
    update(_dt: number, q?: Opts) { path.note(q, 7); },
    draw(p: Painter, t: number, q: Opts) {
      const pts = path.pts.map(w => path.local(q, w)).filter(([x, y]) => Math.hypot(x, y) < 16);
      // the ribbon: older points thinner and darker
      for (let i = 0; i < pts.length; i++) {
        const k = (i + 1) / (pts.length + 1), [x, y] = pts[i], [x2, y2] = pts[i + 1] ?? [0, 0];
        p.beam(x, y, x2, y2, 1 + k * 2.5, k > 0.7 ? ARC[3] : k > 0.4 ? ARC[2] : ARC[1]);
      }
      orb(p, 0, 0, 3, ARC);
      if (Math.floor(t * 30) % 2) star(p, 0, 0, 2, ARC[4], ARC[3]); else p.px(0, 0, WHITE);
      p.glow(0, 0, 8, ARC[2], 0.3);
    },
  };
}

export default { meta, create } satisfies PfxModule;
