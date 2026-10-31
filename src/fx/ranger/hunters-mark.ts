// Hunter's Mark: a red reticle snaps in round the enemy, blinks twice as it locks, and a red chevron pops over
// their head to say they are hunted.
import { clamp, ease } from '../../vendor/pixelfx/index.js';
import type { PfxModule, Opts, Painter } from '../../game/pfx';
import { reticle, K } from './lib';

export const meta = { name: "Hunter's Mark", desc: 'A red reticle snaps in and locks; a chevron marks the target.', duration: 0.75, ink: '#000000' };

export function draw(p: Painter, t: number, _o: Opts): void {
  const close = ease.outCubic(clamp(t / 0.16)), out = clamp((t - 0.5) / 0.2);
  const lockBlink = t > 0.16 && t < 0.4 && Math.floor((t - 0.16) * 16) % 2 === 1;
  if (out < 1 && !lockBlink) reticle(p, 0, -11, 11 - close * 4, t < 0.16 ? K.red2 : K.red1, t > 0.16);
  // the chevron drops in over the head
  const c = clamp((t - 0.12) / 0.1);
  if (c > 0 && out < 1) {
    const y = -21 - Math.round((1 - c) * 2);
    p.rect(-2, y - 1, 5, 1, K.red1); p.rect(-1, y, 3, 1, K.red1); p.px(0, y + 1, K.red2);
    if (t < 0.3) p.px(0, y - 1, K.cream);
  }
}

export default { meta, draw } satisfies PfxModule;
