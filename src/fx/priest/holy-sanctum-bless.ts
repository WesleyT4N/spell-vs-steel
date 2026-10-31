// Holy Sanctum (each panel): four sparks, one in each blessing's color (heal gold, Mana blue, shield white, damage
// orange), spring up out of the floor and cross over, round a four-color ring. Fx kind 'sanctumBless'.
import { Rng, clamp, ease, hex, TAU } from '../../vendor/pixelfx/index.js';
import { BLESS } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Holy Sanctum: panels', desc: 'Four blessing-colored sparks spring up round a four-color floor ring.', duration: 0.5, ink: '#3c3c3c' };

const KINDS = [BLESS.heal, BLESS.mana, BLESS.shield, BLESS.power].map(r => r.map(hex));

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const turn = R.range(0, TAU);
  let t = 0;
  return {
    update(dt: number) { t += dt; },
    draw(p: Painter) {
      const u = clamp(t / 0.4);
      if (u >= 1) return;
      // the ring: four arcs, one per blessing, opening out
      const r = 3 + ease.outCubic(u) * 8, a = 1 - u * u;
      for (let j = 0, m = Math.ceil(r * 8); j < m; j++) {
        const g = (j / m) * TAU, q = Math.floor(((g + turn) % TAU) / (TAU / 4)) % 4;
        p.dot(Math.cos(g) * r, -1 + Math.sin(g) * r * 0.3, KINDS[q][u < 0.3 ? 4 : 2], a);
      }
      // four sparks on spirals, each a 2x2 in its color with a white heart
      for (let i = 0; i < 4; i++) {
        const k = clamp((t - i * 0.03) / 0.4);
        if (k <= 0 || k >= 1) continue;
        const g = turn + (i / 4) * TAU + k * 3, x = Math.cos(g) * 7 * (1 - k * 0.5), y = -2 - ease.outCubic(k) * 18;
        p.rect(x, y, 2, 2, KINDS[i][2], 1 - k * k); p.dot(x, y, KINDS[i][4], 1 - k * k);
      }
    },
  };
}

export default { meta, create } satisfies PfxModule;
