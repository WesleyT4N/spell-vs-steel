// Bestial Wrath: the wild answers: green and gold streaks climb either side of the Ranger and a pair of gold beast
// eyes opens over their head, blinks once and narrows.
import { fit, clamp } from '../../vendor/pixelfx/index.js';
import { column } from '../lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';
import { K } from './lib';

export const meta = { name: 'Bestial Wrath', desc: 'Green and gold streaks rise; beast eyes open overhead.', duration: 0.75, ink: '#006800' };

const WILD = ['#006800', '#00b800', '#58d854', '#f8b800', '#fce0a8'];

export function draw(p: Painter, t: number, _o: Opts): void {
  column(p, t / 0.65, 10, fit(WILD, 5));
  // the eyes: slanted 3 px slits that open, blink at the middle, narrow and go
  const open = clamp((t - 0.08) / 0.1), shut = clamp((t - 0.55) / 0.15), blink = t > 0.3 && t < 0.35;
  if (open > 0 && shut < 1 && !blink) {
    const h = shut > 0 ? 1 : open > 0.5 ? 2 : 1;
    for (const s of [-1, 1]) {
      const x = s * 4 - (s < 0 ? 2 : 0);
      p.rect(x, -22, 3, h, K.gold); p.px(s < 0 ? x : x + 2, -23, K.gold); p.px(x + 1, -22, K.cream);
    }
  }
}

export default { meta, draw } satisfies PfxModule;
