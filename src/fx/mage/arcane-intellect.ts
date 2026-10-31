// Arcane Intellect (arcaneIntellect, on the caster): three glyphs circle above the Mage's head, close into
// a crown, and drop into the brow with a star; a halo ring is left glowing for a moment.
import { clamp, ease } from '../../vendor/pixelfx/index.js';
import { ARC, WHITE, star } from './lib';
import type { PfxModule, Painter } from '../../game/pfx';

export const meta = { name: 'Arcane Intellect', desc: 'Three glyphs circle the head, crown it and drop in with a star.', duration: 0.5, ink: '#940084' };

const HY = -19;

/** A tiny 3x3 glyph, one of three shapes. */
function glyph(p: Painter, x: number, y: number, kind: number, c: number): void {
  const G = [[[0, -1], [-1, 0], [1, 0], [0, 1], [0, 0]], [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], [[-1, -1], [0, -1], [1, -1], [0, 0], [0, 1]]][kind % 3];
  for (const [dx, dy] of G) p.px(x + dx, y + dy, c);
}

export function draw(p: Painter, t: number): void {
  const u = clamp(t / 0.3), r = 9 * (1 - ease.inCubic(u)) + 1;
  for (let i = 0; i < 3; i++) {
    const g = (i / 3) * Math.PI * 2 + t * 9, x = Math.cos(g) * r, y = HY + Math.sin(g) * r * 0.35 + ease.inQuad(u) * 4;
    if (u < 1) glyph(p, x, y, i, Math.sin(g) > 0 ? WHITE : ARC[2]);
  }
  const s = (t - 0.28) / 0.2;
  if (s > 0 && s < 1) {
    star(p, 0, HY + 4, 5 * (1 - s) + 1, ARC[3], ARC[2]);
    const hr = 4 + s * 4;
    for (let j = 0; j < 18; j++) { const g = (j / 18) * Math.PI * 2; p.dot(Math.cos(g) * hr, HY + Math.sin(g) * hr * 0.3, ARC[3], 1 - s); }
    p.glow(0, HY + 4, 7, ARC[2], 0.3 * (1 - s));
  }
}

export default { meta, draw } satisfies PfxModule;
