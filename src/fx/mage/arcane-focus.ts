// Arcane Focus (arcaneFocus, on the caster): motes are pulled in from a ring round the Mage to the staff
// hand, and a mana crystal blinks into being above it with a glint.
import { clamp, ease } from '../../vendor/pixelfx/index.js';
import { ARC, star, manaGem } from './lib';
import type { PfxModule, Painter } from '../../game/pfx';

export const meta = { name: 'Arcane Focus', desc: 'Motes drawn into the staff hand become a mana crystal.', duration: 0.4, ink: '#940084' };

const HX = 5, HY = -14;

export function draw(p: Painter, t: number): void {
  // eight motes spiral in to the hand over the first half
  const u = clamp(t / 0.2);
  if (u < 1) for (let i = 0; i < 8; i++) {
    const g = (i / 8) * Math.PI * 2 + u * 2.5, r = 6 * (1 - ease.inCubic(u)) + 1;
    const mx = HX + Math.cos(g) * r, my = HY + Math.sin(g) * r * 0.8;
    p.px(mx, my, i % 2 ? ARC[2] : ARC[3]); p.px(mx + 1, my, ARC[3]);
  }
  // the crystal pops in above the hand, bobs, and winks out
  const k = (t - 0.16) / 0.24;
  if (k > 0 && k < 1) {
    const s = k < 0.2 ? ease.outBack(k / 0.2) : 1 - ease.inQuad(clamp((k - 0.7) / 0.3));
    manaGem(p, HX, HY - 5 - k * 3, s);
    if (k < 0.25) star(p, HX, HY - 5, 4, ARC[3], ARC[2]);
    p.glow(HX, HY - 5, 6, ARC[2], 0.3 * (1 - k));
  }
}

export default { meta, draw } satisfies PfxModule;
