// Evocation (evocation, on the caster): the Mage drinks in mana: streams of motes spiral in from the edge
// of the box to the chest (over the cast's own floor rune), and the fill ends in a soft pulse at the heart.
import { clamp, ease } from '../../vendor/pixelfx/index.js';
import { ARC, WHITE, orb } from './lib';
import type { PfxModule, Painter } from '../../game/pfx';

export const meta = { name: 'Evocation', desc: 'Streams of motes spiral into the Mage and pulse at the heart.', duration: 0.6, ink: '#940084' };

const CY = -11;

export function draw(p: Painter, t: number): void {
  // twelve motes, each on its own lap: from the rim of the box spiralling in to the chest
  for (let i = 0; i < 12; i++) {
    const u = (t - (i % 4) * 0.07) / 0.3;
    if (u <= 0 || u >= 1) continue;
    const g = (i / 12) * Math.PI * 2 + u * 3, r = 11 * (1 - ease.inQuad(u));
    const c = u > 0.7 ? WHITE : i % 2 ? ARC[2] : ARC[3], mx = Math.cos(g) * r, my = CY + Math.sin(g) * r;
    p.px(mx, my, c); p.px(mx, my - 1, c);
    if (u > 0.15) p.px(Math.cos(g - 0.25) * (r + 1.5), CY + Math.sin(g - 0.25) * (r + 1.5), ARC[1]);
  }
  // the fill: a soft orb at the chest that pulses once and shrinks away
  const f = clamp((t - 0.38) / 0.2);
  if (f > 0 && f < 1) orb(p, 0, CY, 4 * Math.sin(Math.PI * f) + 0.5, ARC);
}

export default { meta, draw } satisfies PfxModule;
