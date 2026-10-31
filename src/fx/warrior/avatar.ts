// Avatar of War: the Warrior becomes a war god: a steel-and-gold column of light rises up them, flares at the top,
// and blades of light spin up around them.
import { Particles, Rng, fit, flare, hex, P } from '../../vendor/pixelfx/index.js';
import { column } from '../lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Avatar of War', desc: 'A steel and gold column of light with a flare.', duration: 0.8, ink: '#503000' };

const WARGOD = ['#3c3c3c', '#7c7c7c', '#ac7c00', '#f8b800', '#f8d878', '#fcfcfc'];

export function create(o: Opts) {
  const C = fit(WARGOD, 6), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0 });
  let t = 0, go = false;
  return {
    update(dt: number) {
      t += dt;
      if (!go) {
        go = true;
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ps.spawn(P.STREAK, Math.cos(a) * 9, -2 + Math.sin(a) * 2, -Math.sin(a) * 15, -40, 0.3, hex(i % 2 ? '#f8b800' : '#bcbcbc'), 1, i * 0.03); }
        for (let i = 0; i < 4; i++) ps.spawn(P.STAR, R.range(-9, 9), R.range(-22, -6), 0, -6, 0.4, hex('#f8d878'), 1.4, 0.25 + i * 0.05);
      }
      ps.update(dt);
    },
    draw(p: Painter) {
      column(p, t / 0.55, 10, C);
      const f = (t - 0.25) / 0.15;
      if (f > 0 && f < 1) flare(p, 0, -14, 9 * (1 - f), 0.4, WARGOD.slice(2));
      ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
