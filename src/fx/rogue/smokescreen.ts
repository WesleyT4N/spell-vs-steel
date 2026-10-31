// Smokescreen (one per panel of both front columns): a bank of thick smoke rolls up off the floor, dark gray with
// a violet core, swells to fill the panel, then thins and drifts away.
import { Rng, hex } from '../../vendor/pixelfx/index.js';
import { Puffs } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Smokescreen', desc: 'A bank of dark smoke rolls up and fills the panel.', duration: 0.7, ink: '#000000' };

const SMOG = ['#3c3c3c', '#4428bc', '#5c5c5c', '#7c7c7c', '#bcbcbc'].map(hex);

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const smoke = new Puffs(SMOG);
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) {
        go = true;
        // low and wide first, then taller puffs stacking up behind them
        for (let i = 0; i < 4; i++) smoke.add(-6 + i * 4 + R.range(-1, 1), -4, R.range(-6, 6), -R.range(2, 6), R.range(4, 5), R.range(0.5, 0.62), i * 0.02);
        for (let i = 0; i < 3; i++) smoke.add(-5 + i * 5 + R.range(-1, 1), -10, R.range(-5, 5), -R.range(6, 12), R.range(4, 5.5), R.range(0.45, 0.58), 0.06 + i * 0.03);
        for (let i = 0; i < 2; i++) smoke.add(-3 + i * 6, -16, R.range(-4, 4), -R.range(4, 8), R.range(3, 4), R.range(0.4, 0.5), 0.12 + i * 0.03);
      }
      smoke.update(dt);
    },
    draw(p: Painter) { smoke.draw(p); },
  };
}

export default { meta, create } satisfies PfxModule;
