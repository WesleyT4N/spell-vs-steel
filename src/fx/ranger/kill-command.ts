// Kill Command: a sharp whistle: two gold-green sound arcs roll forward off the Ranger and a gold paw print pops
// over their head, the order every companion answers.
import { clamp, ease } from '../../vendor/pixelfx/index.js';
import type { PfxModule, Opts, Painter } from '../../game/pfx';
import { K } from './lib';

export const meta = { name: 'Kill Command', desc: 'Sound arcs roll forward; a gold paw print pops overhead.', duration: 0.62, ink: '#503000' };

/** A paw print, 7x6: three toes over a pad (the ink fills the gaps, so they read as separate). */
const PAW = ['t..t..t', '.......', '..ppp..', '.ppppp.', '.ppppp.', '..p.p..'];

export function draw(p: Painter, t: number, _o: Opts): void {
  // arcs: forward-facing, opening out and fading
  for (let i = 0; i < 2; i++) {
    const u = clamp((t - i * 0.09) / 0.3);
    if (u > 0 && u < 1) p.arc(2, -15, 3 + u * 7, u < 0.5 ? 2 : 1, -0.9, 0.9, u < 0.3 ? K.straw : i ? K.leaf2 : K.gold, 1 - u * 0.6);
  }
  // the paw print: pops up with an overshoot, holds, sinks away
  const pop = ease.outBack(clamp((t - 0.04) / 0.14)), out = clamp((t - 0.42) / 0.2);
  if (pop > 0 && out < 1) p.sprite(PAW, { t: '#f8b800', p: '#f8b800' }, -4, Math.round(-23 + (1 - pop) * 3 + out * 2), { a: 1 - out });
}

export default { meta, draw } satisfies PfxModule;
