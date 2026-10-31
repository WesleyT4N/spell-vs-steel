// Wyvern Sting (the flying arrow): a barbed green sting-dart, its head wet with venom that drips off behind it in
// falling green drops, and a thin sickly tracer.
import type { PfxModule, Opts, Painter } from '../../game/pfx';
import { arrow, K, ARROW_PX } from './lib';

export const meta = { name: 'Wyvern Sting', desc: 'A venom-wet dart dripping green drops.', duration: 2, panels: 2, ink: '#000000' };

export function draw(p: Painter, t: number, _o: Opts): void {
  const flown = t * ARROW_PX;
  arrow(p, 5, 0, { shaft: K.tox1, head: K.tox3, fletch: K.tox2, len: 12 });
  // a barb behind the head
  p.px(2, -2, K.tox2); p.px(2, 2, K.tox2);
  const L = Math.min(16, flown - 10);
  for (let d = 0; d < L; d += 2) p.dot(-9 - d, 0, d < 6 ? K.tox3 : K.tox1, 1 - d / 18);
  // drops: shed every 0.03 s from the head, falling under gravity where they left (world-fixed)
  for (let i = 0; i < 8; i++) {
    const a = t - 0.01 - i * 0.03;
    if (a < 0 || a > 0.2) continue;
    const x = 3 - a * ARROW_PX, y = 1 + 120 * a * a + a * 10;
    if (x < -48 || y > 11) continue;
    p.dot(x, y, K.tox3); p.dot(x, y - 1, K.tox2, 0.8);
  }
}

export default { meta, draw } satisfies PfxModule;
