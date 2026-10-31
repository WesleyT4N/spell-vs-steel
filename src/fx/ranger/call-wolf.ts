// Call Wolf (the running wolf): the wolf sprite, unchanged, at a full sprint: dust kicks up off its paws and stays
// behind, and green speed lines stream off its back.
import type { PfxModule, Opts, Painter } from '../../game/pfx';
import { drawPix, WOLF, WOLF_LEGS, WOLF_COL, K } from './lib';

export const meta = { name: 'Call Wolf', desc: 'A sprinting wolf kicking up dust, with green speed lines.', duration: 3, panels: 2 };

const WOLF_PX = 7 * 38;

export function draw(p: Painter, t: number, _o: Opts): void {
  // dust puffs: one every 0.07 s at the hind paws, left where they were kicked (world-fixed), growing and fading
  for (let i = 0; i < 12; i++) {
    const a = t - i * 0.07;
    if (a < 0 || a > 0.3) continue;
    const x = -10 - a * WOLF_PX * 0.92, k = a / 0.3, r = 1 + k * 2;
    if (x < -46) continue;
    p.circle(x, 8 - k * 3, r, k < 0.4 ? K.sand : K.cream, 1 - k);
  }
  // speed lines over the back
  for (const [y, len, c] of [[-2, 10, K.leaf3], [1, 14, K.leaf2], [4, 8, K.leaf3]] as const)
    for (let d = 0; d < Math.min(len, t * 120); d += 2) p.dot(-15 - d, y, c, 1 - d / len);
  // two px back so its nose and outline fit the box's front edge (the tail end sits in the trail panel)
  drawPix(p, [...WOLF, ...WOLF_LEGS[Math.floor(t * 12) % 2]], WOLF_COL, -2, 9);
}

export default { meta, draw } satisfies PfxModule;
