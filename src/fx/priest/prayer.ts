// Prayer: a thread of gold light drops onto the Priest's head, a ring of light rolls round them with a blue spark of
// Mana at the heart, and a green cross of healing rises. Fx kind 'prayer'.
import { Rng, clamp, sparkle, hex } from '../../vendor/pixelfx/index.js';
import { ripple } from '../lib';
import { GOLD, BLESS, bigCross } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Prayer', desc: 'A thread of light from above, a ring with a Mana spark, a rising green cross.', duration: 0.625, ink: '#503000' };

export function create(o: Opts) {
  const G = GOLD(), M = BLESS.mana.map(hex);
  void new Rng(o.seed);
  let t = 0;
  return {
    update(dt: number) { t += dt; },
    draw(p: Painter) {
      // the thread from above: falls to the head, then thins out
      const f = clamp(t / 0.1), ff = 1 - clamp((t - 0.12) / 0.12);
      if (ff > 0) { p.rect(0, -24, 1, Math.round(f * 4) + 1, G[5], ff); p.rect(-1, -24, 3, Math.round(f * 3), G[4], ff); }
      if (t > 0.08 && t < 0.2) sparkle(p, 0, -12, 3, M[3], M[2], 0.3);
      ripple(p, 0, -12, (t - 0.08) / 0.32, 11, G.slice(1), 0.9, 1.5);
      // the cross rises from the chest
      const k = clamp((t - 0.15) / 0.45);
      if (k > 0 && k < 1) bigCross(p, 0, -15 - k * 5, k < 0.2 ? 4 : 3, hex(k < 0.6 ? '#58d854' : '#00a800'), hex(k < 0.25 ? '#fcfcfc' : '#b8f8b8'), 1 - k * k);
    },
  };
}

export default { meta, create } satisfies PfxModule;
