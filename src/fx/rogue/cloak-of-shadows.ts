// Cloak of Shadows: a dark cloak swirls round the Rogue: a band of shadow wraps them from back to front, tightens,
// and flares off as lilac motes, flicking off any poison, fire or frost as dark specks.
import { Particles, Rng, clamp, ease, hex, P } from '../../vendor/pixelfx/index.js';
import { SHADOW, Drops } from './lib';
import type { PfxModule, Opts, Painter } from '../../game/pfx';

export const meta = { name: 'Cloak of Shadows', desc: 'A band of shadow wraps the Rogue and flares off.', duration: 0.6, ink: '#000000' };

export function create(o: Opts) {
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0 });
  const drops = new Drops();
  let t = 0, flared = false;
  const FLARE = 0.34;
  return {
    update(dt: number) {
      t += dt;
      if (!flared && t >= FLARE) {
        flared = true;
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ps.spawn(P.STAR, Math.cos(a) * 7, -12 + Math.sin(a) * 9, Math.cos(a) * 18, Math.sin(a) * 18 - 8, 0.22, hex('#d8b8f8'), 0.8); }
        for (let i = 0; i < 3; i++) drops.add(R.range(-5, 5), R.range(-14, -6), R.range(-30, 30), -R.range(20, 50), hex(R.pick(['#00a800', '#f83800', '#0078f8'])), 0.2);
      }
      ps.update(dt); drops.update(dt);
    },
    draw(p: Painter) {
      // the wrap: the band's leading edge sweeps 1.5 turns round the body as it narrows
      const u = clamp(t / FLARE);
      if (u < 1) {
        const head = ease.outCubic(u) * Math.PI * 3, rx = 10 - u * 3, ry = 12 - u * 2;
        for (let s = Math.max(0, head - 3.2); s < head; s += 0.08) {
          const a = s + Math.PI / 2, k = (head - s) / 3.2, x = Math.cos(a) * rx, y = -11 + Math.sin(a) * ry * 0.95 - s * 0.6 + 2;
          const c = k < 0.15 ? SHADOW[4] : k < 0.5 ? SHADOW[2] : SHADOW[1];
          p.px(x, y, c); p.px(x, y + 1, k < 0.5 ? SHADOW[1] : SHADOW[0]);
        }
      }
      const f = (t - FLARE) / 0.12;
      if (f > 0 && f < 1) p.ring(0, -11, 6 + f * 5, 1.5, SHADOW[3], 1 - f);
      drops.draw(p); ps.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
