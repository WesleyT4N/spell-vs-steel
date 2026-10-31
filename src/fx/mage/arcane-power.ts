// Arcane Power (arcanePower, on the caster): power climbs the Mage in pink streaks either side, and three
// mana gems spin round the waist and wink out one by one: one for each cheaper spell to come.
import { clamp } from '../../vendor/pixelfx/index.js';
import { column } from '../lib';
import { ARC, manaGem } from './lib';
import type { PfxModule, Painter } from '../../game/pfx';

export const meta = { name: 'Arcane Power', desc: 'Pink streaks climb the Mage while three mana gems circle and wink out.', duration: 0.5, ink: '#940084' };

export function draw(p: Painter, t: number): void {
  column(p, t / 0.45, 10, ARC);
  for (let i = 0; i < 3; i++) {
    const g = (i / 3) * Math.PI * 2 + t * 10, x = Math.cos(g) * 9, y = -10 + Math.sin(g) * 2.5;
    // the gems pop in together and wink out in turn
    const life = clamp(t / 0.06) * (1 - clamp((t - 0.25 - i * 0.07) / 0.06));
    if (life > 0 && Math.sin(g) > -0.6) manaGem(p, x, y, life * 0.8);
  }
}

export default { meta, draw } satisfies PfxModule;
