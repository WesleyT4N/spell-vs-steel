// Bite (every wolf's bite: Call Wolf, Bestial Wrath, Call of the Wild): white fangs top and bottom slam shut on the
// target with a snap of gray lines, then spring open and fade.
import { clamp } from '../../vendor/pixelfx/index.js';
import type { PfxModule, Opts, Painter } from '../../game/pfx';
import { K } from './lib';

export const meta = { name: 'Bite', desc: 'White fangs slam shut with a snap.', duration: 0.35, ink: '#000000' };

export function draw(p: Painter, t: number, _o: Opts): void {
  // closed on the hit frame, opening a little as it lets go
  const gap = t < 0.06 ? 0 : Math.round(3 * clamp((t - 0.06) / 0.12)), fade = 1 - clamp((t - 0.18) / 0.15);
  if (fade <= 0) return;
  const top = -15 - gap, bot = -9 + gap;
  // the jaws: four fangs above, three below, each a 3-wide tooth with a white tip (no gums: they read as a box)
  for (let i = 0; i < 4; i++) {
    const x = -7 + i * 4;
    p.tri(x, top - 1, x + 3, top - 1, x + 1.5, top + 3, K.steel, fade); p.px(x + 1, top + 2, K.white, fade);
  }
  for (let i = 0; i < 3; i++) {
    const x = -5 + i * 4;
    p.tri(x, bot + 2, x + 3, bot + 2, x + 1.5, bot - 2, K.steel, fade); p.px(x + 1, bot - 1, K.white, fade);
  }
  // the snap
  if (t < 0.12) for (const [dx, dy] of [[-12, -12], [11, -12], [-12, -6], [11, -6]]) p.dot(dx, dy, K.white);
}

export default { meta, draw } satisfies PfxModule;
