// Blink (the shared 'smoke' kind: the Rogue's blink in and out, Stealth, the decoy popping): a quick puff of dark
// smoke in hard NES steps, a white pop at its heart, gone in a blink.
import { Rng } from '../../vendor/pixelfx/index.js';
import { DUSK, SHADOW, Puffs, glint } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Blink puff', desc: 'A quick puff of dark smoke with a white pop.', duration: 0.4, ink: '#000000' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const smoke = new Puffs(DUSK);
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) {
        go = true;
        for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + R.range(-0.4, 0.4); smoke.add(Math.cos(a) * 3, -9 + Math.sin(a) * 6, Math.cos(a) * 24, Math.sin(a) * 18 - 10, R.range(2.4, 3.2), R.range(0.22, 0.3)); }
      }
      smoke.update(dt);
    },
    draw(p: Painter) {
      smoke.draw(p);
      if (t < 0.05) glint(p, 0, -10, 3 * (1 - t / 0.05) + 1, SHADOW[3], 0.25);
    },
  };
}

export default { meta, create } satisfies PfxModule;
