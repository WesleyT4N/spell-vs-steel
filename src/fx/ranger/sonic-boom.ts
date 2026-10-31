// Aimed Shot (heavy), draft A, "Sonic boom": a heavy two-pixel arrow breaks the air as it leaves: a white cone of
// shock rings stays at the bow and a long streak trails it. Its hit is heavy-a-hit.
import { clamp } from '../../vendor/pixelfx/index.js';
import type { PfxModule, Opts, Painter } from '../../game/pfx';
import { arrow, pixRing, K, AIMED_PX } from './lib';

export const meta = { name: 'Sonic boom', desc: 'A heavy arrow breaks the air: shock rings at the bow, a long streak.', duration: 2, panels: 3, ink: '#000000' };

export function draw(p: Painter, t: number, _o: Opts): void {
  const flown = t * AIMED_PX;
  // the boom: two upright rings left where the arrow broke the air, opening and fading
  for (let i = 0; i < 2; i++) {
    const u = clamp((t - i * 0.03) / 0.16);
    if (u > 0 && u < 1) pixRing(p, -flown + 4 + i * 12, 0.5, 1 + u * 2, 2 + u * 6, u < 0.35 ? K.white : K.steel, 0, 1 - u);
  }
  arrow(p, 6, 0, { shaft: K.wood, head: K.white, fletch: K.white, len: 16, thick: true });
  // streak: a solid white core near the tail breaking into steel dots further back
  const L = Math.min(48, flown - 14);
  if (L > 0) p.rect(-10 - Math.min(10, L), 0, Math.min(10, L), 2, K.steel);
  for (let d = 10; d < L; d += 2) p.dot(-10 - d, d % 4 ? 0 : 1, d < 24 ? K.white : K.steel, 1 - d / 52);
}

export default { meta, draw } satisfies PfxModule;
