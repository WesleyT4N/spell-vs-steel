// Hallowed Ground: an orange-gold sigil stamps onto the Priest's panel with a white flash, four blades of light shoot
// up from its rim and embers rise: the damage blessing. Fx kind 'blessPower' (was healBurst).
import { Particles, Rng, P, hex, clamp, ease } from '../../vendor/pixelfx/index.js';
import { BLESS, sigil } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Hallowed Ground', desc: 'An orange-gold sigil stamps down and blades of light shoot up.', duration: 0.5, ink: '#881400' };

export function create(o: Opts) {
  const C = BLESS.power.map(hex), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: ['#fce0a8', '#fca044', '#f83800'] });
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) { go = true; for (let i = 0; i < 5; i++) ps.spawn(P.EMBER, R.range(-9, 9), -1, R.range(-8, 8), R.range(-45, -25), R.range(0.25, 0.4), hex('#fca044'), 1, R.range(0.02, 0.12)); }
      ps.update(dt);
    },
    draw(p: Painter) {
      // the stamp: lands big and white, settles to its size, fades
      const s = clamp(t / 0.08), fade = clamp((t - 0.25) / 0.25);
      if (fade < 1) sigil(p, 0, -1, 9.5 - 2 * ease.outCubic(s), t * 3, t < 0.06 ? [C[3], C[4], C[4], C[4]] : C, 1 - fade, 8);
      // four blades rising off the rim: a white tip on an orange stem
      for (let i = 0; i < 4; i++) {
        const x = [-9, -4, 3, 8][i], u = clamp((t - 0.03 - i * 0.025) / 0.25);
        if (u <= 0 || u >= 1) continue;
        const top = -2 - ease.outCubic(u) * (14 + (i % 2) * 6), len = 5 * (1 - u) + 2;
        p.rect(x, top, 1, len, C[2], 1 - u * u); p.rect(x + 1, top + 1, 1, Math.max(1, len - 2), C[1], 1 - u * u); p.dot(x, top, C[4], 1 - u * u);
      }
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
