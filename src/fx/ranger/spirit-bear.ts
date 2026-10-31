// Spirit Bear (summoned): pale-blue spirit light rises up either side of the bear's panel, a ring of it opens on the
// floor and blue motes drift up as the bear takes shape (the bear itself is its sprite, drawn by the game).
import { Particles, Rng, fit, hex, P } from '../../vendor/pixelfx/index.js';
import { column, shock } from '../lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Spirit Bear', desc: 'Pale-blue spirit light rises round the bear as it appears.', duration: 0.75, ink: '#0000bc' };

/** The Spirit Bear's own colors (its sprite is #6888fc with #a4e4fc highlights). */
const SPIRIT = ['#0000bc', '#6888fc', '#a4e4fc', '#fcfcfc'];

export function create(o: Opts) {
  const C = fit(SPIRIT, 4), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0 });
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) { go = true; for (let i = 0; i < 6; i++) ps.spawn(P.FLAKE, R.range(-11, 11), R.range(-6, -1), R.range(-3, 3), -R.range(20, 35), R.range(0.4, 0.6), hex(i % 2 ? '#a4e4fc' : '#fcfcfc'), 1.5, R.range(0, 0.25)); }
      ps.update(dt);
    },
    draw(p: Painter) {
      column(p, t / 0.6, 11, C);
      shock(p, 0, 0, t / 0.4, 12, C, 1.5);
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
