// Hawk Strike (the flying hawk): the hawk sprite, unchanged, now trailing gold wind lines off its wingtips and
// shedding a feather or two; as it stoops in the second half its wake turns to white dive streaks.
import type { PfxModule, Opts, Painter } from '../../game/pfx';
import { drawPix, feather, HAWK_UP, HAWK_DOWN, HAWK_COL, K } from './lib';

export const meta = { name: 'Hawk Strike', desc: 'The hawk trails gold wind lines and turns to white streaks as it dives.', duration: 2, panels: 2 };

export function draw(p: Painter, t: number, o: Opts): void {
  const dive = t > 0.28, flap = Math.floor(t * 24) % 2 === 1;
  // wake: three lines off the wings and tail, dotted, longer as the dive speeds up
  const L = Math.min(dive ? 22 : 12, t * 80);
  for (const [y, c] of [[-4, dive ? K.white : K.straw], [0, dive ? K.steel : K.gold], [3, dive ? K.white : K.straw]] as const)
    for (let d = 0; d < L; d += 2) p.dot(-11 - d, y + (d % 4 ? 0 : 1), c, 1 - d / (L + 2));
  // a feather or two left floating behind (in the shot's own space, so they slide back as it flies on)
  for (let i = 0; i < 2; i++) {
    const a = t - 0.12 - i * 0.16;
    if (a > 0 && a < 0.2) feather(p, -12 - a * 120, 4 + a * 30, (Math.floor(a * 30 + o.seed) % 3) - 1, K.straw, K.bark);
  }
  drawPix(p, flap ? HAWK_UP : HAWK_DOWN, HAWK_COL, 0, 4);
}

export default { meta, draw } satisfies PfxModule;
