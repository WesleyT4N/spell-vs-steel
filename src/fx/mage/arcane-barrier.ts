// Arcane Barrier (arcaneBarrier, on the caster): a hexagon of force is drawn round the Mage side by side,
// starting at the feet, flashes white the moment it closes, then fades into the shield it leaves behind.
import { clamp } from '../../vendor/pixelfx/index.js';
import { ARC, WHITE } from './lib';
import type { PfxModule, Painter } from '../../game/pfx';

export const meta = { name: 'Arcane Barrier', desc: 'A hexagon of force is drawn round the Mage and flashes shut.', duration: 0.45, ink: '#940084' };

const CY = -11, RX = 11, RY = 11;
// corners, from the bottom going both ways round to the top
const HEX: Array<[number, number]> = Array.from({ length: 6 }, (_, i) => {
  const g = Math.PI / 2 + (i * Math.PI) / 3;
  return [Math.round(Math.cos(g) * RX), Math.round(CY + Math.sin(g) * RY)];
});

export function draw(p: Painter, t: number): void {
  // both halves trace up from the bottom corner at once and meet at the top
  const u = clamp(t / 0.16), closed = u >= 1, k = clamp((t - 0.16) / 0.29);
  const a = 1 - k * k, c = closed && k < 0.2 ? WHITE : ARC[2];
  for (const dir of [1, -1]) for (let s = 0; s < 3; s++) {
    const i0 = (6 + dir * s) % 6, i1 = (6 + dir * (s + 1)) % 6, f = clamp(u * 3 - s);
    if (f <= 0) continue;
    const [x0, y0] = HEX[i0], [x1, y1] = HEX[i1], xe = x0 + (x1 - x0) * f, ye = y0 + (y1 - y0) * f;
    p.line(x0, y0, xe, ye, c, a);
    p.line(x0, y0 - 1, xe, ye - 1, closed ? ARC[3] : ARC[1], a);
    if (!closed && f < 1) p.px(xe, ye, WHITE);
  }
  // when it closes: a glint at the top corner and a sheen across the face
  if (closed && k < 0.35) {
    const [tx, ty] = HEX[3];
    p.px(tx, ty - 1, WHITE); p.px(tx - 1, ty, WHITE); p.px(tx + 1, ty, WHITE);
    for (let y = -18; y <= -4; y += 2) p.dot(4 + (y + 11) * 0.3, y, WHITE, 1 - k / 0.35);
  }
  p.glow(0, CY, 12, ARC[2], 0.2 * (1 - k));
}

export default { meta, draw } satisfies PfxModule;
