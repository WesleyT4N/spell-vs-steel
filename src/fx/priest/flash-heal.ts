// Flash Heal: a white flash on the Priest's chest on the cast frame, a big green cross pops and lifts away, and green
// motes burst outward then float up. Fx kind 'flashHeal' (was healBurst).
import { Particles, Rng, P, hex, clamp, ease, sparkle } from '../../vendor/pixelfx/index.js';
import { bigCross } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Flash Heal', desc: 'A white flash, a green cross popping up, motes bursting out.', duration: 0.5, ink: '#005800' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0 });
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) {
        go = true;
        for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + R.range(-0.3, 0.3), sp = R.range(35, 55); ps.spawn(P.MOTE, Math.cos(a) * 2, -12 + Math.sin(a) * 2, Math.cos(a) * sp, Math.sin(a) * sp * 0.7 - 15, R.range(0.25, 0.4), hex(i % 2 ? '#b8f8b8' : '#58d854'), 1); }
      }
      ps.update(dt);
    },
    draw(p: Painter) {
      if (t < 0.1) sparkle(p, 0, -12, 6 * (1 - t / 0.1) + 1, hex('#fcfcfc'), hex('#b8f8b8'), 0.35);
      const k = clamp((t - 0.03) / 0.42);
      if (k > 0 && k < 1) {
        const s = Math.max(3, Math.round(2 + 2.5 * ease.outBack(clamp(k / 0.2)) - k));
        bigCross(p, 0, -12 - ease.outCubic(k) * 6, Math.min(4, s), hex(k < 0.15 ? '#fcfcfc' : k < 0.7 ? '#58d854' : '#00a800'), hex(k < 0.5 ? '#fcfcfc' : '#b8f8b8'), 1 - k * k * k);
      }
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
