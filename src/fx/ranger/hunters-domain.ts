// Hunter's Domain (over the whole enemy side: anchored on their front column's middle panel, 3 panels by 3 rows):
// a green wave of creeping vines sweeps from the front column to the back, and as it passes each panel a trap
// glyph flashes on its floor and fades into hiding.
import { clamp } from '../../vendor/pixelfx/index.js';
import type { PfxModule, Opts, Painter } from '../../game/pfx';
import { ROW } from '../lib';
import { K } from './lib';

export const meta = { name: "Hunter's Domain", desc: 'A wave of vines sweeps the enemy side; trap glyphs flash and hide.', duration: 1, panels: 3, rows: 3, ink: '#006800' };

export function draw(p: Painter, t: number, o: Opts): void {
  // the wave front, x from -12 to the far edge
  const X = -12 + clamp(t / 0.45) * (2 * 38 + 24);
  for (const row of [-1, 0, 1]) {
    const fy = row * ROW;
    if (t < 0.6) for (let x = -12; x < X; x += 1) {
      // vines: two wavy strands along the floor, the newest part bright
      const age = (X - x) / 60, a = 1 - clamp((t - 0.35) / 0.25);
      if (age > 1) continue;
      const y1 = fy - 2 + Math.round(Math.sin(x * 0.4 + row + o.seed) * 1.5), y2 = fy - 1 + Math.round(Math.cos(x * 0.33 + row) * 1.2);
      if (x % 2 === 0) p.dot(x, y1, age < 0.15 ? K.leaf3 : K.leaf1, a);
      if (x % 3 === 0) p.dot(x, y2, age < 0.15 ? K.leaf2 : K.leaf0, a);
      if (x % 9 === 0 && age < 0.5) { p.dot(x, y1 - 1, K.leaf2, a); p.dot(x + 1, y1 - 2, K.leaf3, a); }
    }
    for (let col = 0; col < 3; col++) {
      // each panel's glyph: a small square snare outline that flashes as the wave passes, then fades
      const cx = col * 38, pass = (cx + 12) / (2 * 38 + 24) * 0.45, u = (t - pass) / 0.45;
      if (u < 0 || u >= 1) continue;
      const c = u < 0.2 ? K.white : u < 0.5 ? K.leaf3 : K.leaf2, a = 1 - clamp((u - 0.4) / 0.6);
      for (let i = -4; i <= 4; i += 2) { p.dot(cx + i, fy - 4, c, a); p.dot(cx + i, fy, c, a); }
      p.dot(cx - 5, fy - 2, c, a); p.dot(cx + 5, fy - 2, c, a);
    }
  }
}

export default { meta, draw } satisfies PfxModule;
