// Deadeye: the world narrows to a sight: a big steel reticle closes in on the Ranger's eye and locks with a gold
// glint, a scope line runs out ahead of them, and four steel stakes drive into the floor round their feet (rooted).
import { clamp, ease } from '../../vendor/pixelfx/index.js';
import type { PfxModule, Opts, Painter } from '../../game/pfx';
import { reticle, glint, K } from './lib';

export const meta = { name: 'Deadeye', desc: 'A steel reticle closes on the eye; stakes root the feet.', duration: 1, ink: '#000000' };

export function draw(p: Painter, t: number, _o: Opts): void {
  const out = clamp((t - 0.75) / 0.25);
  if (out >= 1) return;
  const c = ease.outCubic(clamp(t / 0.3));
  // reticle: wide to tight round the eye, steel then gold when locked
  if (out < 1 && !(t > 0.75 && Math.floor(t * 20) % 2)) reticle(p, 3, -17, 8 - c * 4, t < 0.3 ? K.steel : K.gold, false);
  // the lock glint
  const g = (t - 0.3) / 0.15;
  if (g > 0 && g < 1) glint(p, 3, -17, 1 + 3 * Math.sin(g * Math.PI), K.white, K.gold);
  // scope line out ahead, dotted
  const L = Math.round(8 * ease.outCubic(clamp((t - 0.3) / 0.15)));
  for (let d = 0; d < L; d += 2) p.dot(5 + d, -17, K.white, 1 - out);
  // stakes: four steel pins hammered in round the feet, one after another
  [-9, -5, 5, 9].forEach((x, i) => {
    const s = clamp((t - 0.12 - i * 0.05) / 0.06);
    if (s <= 0) return;
    const y = -Math.round(6 * (1 - s)) - 3;
    p.rect(x, y, 1, 3, K.steel, 1 - out); p.px(x, y - 1, K.white, 1 - out);
  });
}

export default { meta, draw } satisfies PfxModule;
