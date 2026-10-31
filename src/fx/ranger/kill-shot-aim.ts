// Kill Shot (the 1 s aim, at the Ranger): the arrowhead at the bow gathers light: red motes are drawn in to it,
// a red scope glint grows and pulses faster and faster, and it flashes white the instant before it looses.
// (The red tracking line and reticle on the target stay as they are: see WIRING.md.)
import { clamp } from '../../vendor/pixelfx/index.js';
import type { PfxModule, Opts, Painter } from '../../game/pfx';
import { glint, K } from './lib';

export const meta = { name: 'Kill Shot aim', desc: 'Red motes gather to the arrowhead; a scope glint pulses faster, then flashes.', duration: 1.25, ink: '#000000' };

const HX = 6, HY = -12;

export function draw(p: Painter, t: number, o: Opts): void {
  const u = clamp(t / 1.2);
  // motes drawn in from a ring round the bow, each on its own loop
  for (let i = 0; i < 6; i++) {
    const ph = (t * (1.6 + u * 2) + i / 6) % 1, a = i * 1.05 + (o.seed % 7), r = 7 * (1 - ph);
    if (u > 0.95) break;
    p.dot(HX + Math.cos(a) * r, HY + Math.sin(a) * r * 0.7, ph > 0.7 ? K.red2 : K.red1, 0.5 + ph * 0.5);
  }
  // the arrowhead itself, held at the bow (gone with the flash: the arrow has flown)
  if (t < 1.2) { p.rect(HX - 6, HY, 6, 1, K.wood); p.rect(HX, HY - 1, 2, 3, K.steel); p.px(HX + 2, HY, K.white); }
  // the scope glint: pulses quicken as the lock completes
  const beat = Math.sin(t * (10 + u * 40)) * 0.5 + 0.5, n = 1 + u * 2 + beat * 1.5;
  if (t < 1.12) glint(p, HX + 2, HY, n, beat > 0.5 ? K.red2 : K.red1, K.red1);
  else if (t < 1.21) glint(p, HX + 2, HY, 6 - (t - 1.12) * 60, K.white, K.steel);
}

export default { meta, draw } satisfies PfxModule;
