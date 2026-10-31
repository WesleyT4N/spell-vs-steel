// Mage heavy attack, Rune Comet (shot:beam): a heavy dark-cored orb inside a turning rune ring, shedding square
// glyphs that hang and blink out along the row, with a shock ring bursting at the staff as it launches.
import { clamp, ease } from '../../vendor/pixelfx/index.js';
import { ARC, WHITE, Path, orb } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Rune Comet', desc: 'A dark-cored orb in a turning rune ring, shedding glyphs down the row.', duration: 2, panels: 2, ink: '#000000' };

export function create(o: Opts) {
  const path = new Path(o);
  return {
    update() { /* position comes from the shot */ },
    draw(p: Painter, t: number, q: Opts) {
      const fl = path.flown(q);
      // launch shock: a ring standing at the staff
      const u = clamp(t / 0.14);
      if (u < 1) {
        const r = 3 + ease.outCubic(u) * 8;
        for (let j = 0; j < 28; j++) { const g = (j / 28) * Math.PI * 2; p.dot(-fl + Math.cos(g) * r * 0.5, Math.sin(g) * r, u < 0.35 ? WHITE : ARC[3], u < 0.6 ? 1 : 2 - 2 * u); }
      }
      // glyphs dropped every 8 px, each blinking out a little after the last
      for (let i = 1; i <= 4; i++) {
        const d = i * 8;
        if (d >= fl) continue;
        const y = i % 2 ? -4 : 3, c = i < 2 ? ARC[3] : ARC[2], a = clamp(1.3 - i * 0.25);
        p.rect(-d - 1, y - 1, 3, 3, c, a); p.dot(-d, y, i < 3 ? WHITE : ARC[1], a);
      }
      // the core: a dark heart in a lit shell
      orb(p, 0, 0, 5.5, ARC);
      p.circle(0.5, 0.5, 2.2, ARC[0]);
      p.px(0, 0, WHITE);
      // the ring turns around it, the near half drawn bright, the far half dim
      for (let j = 0; j < 32; j++) {
        const g = (j / 32) * Math.PI * 2 + t * 18, x = Math.cos(g) * 3, y = Math.sin(g) * 9;
        if (Math.abs(y) < 5.5 && x < 0) continue; // hidden behind the orb
        p.px(x, y, x > 0 ? (j % 8 === 0 ? WHITE : ARC[3]) : ARC[1]);
      }
      p.glow(0, 0, 11, ARC[2], 0.3);
    },
  };
}

export default { meta, create } satisfies PfxModule;
