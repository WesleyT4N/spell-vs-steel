// Cleave, draft C "Twin cut": two fast diagonal cuts, one on each panel a beat apart, each a white line that
// snaps open from its middle, shears into a steel edge and sheds a few tumbling shards.
import { Bits, B, Rng, fit, clamp, ease, sparkle } from '../../vendor/pixelfx/index.js';
import { RAMPS } from '../palette';
import type { PfxModule, Opts } from '../../game/pfx';

export const meta = { name: 'Cleave: Twin cut', desc: 'Two quick diagonal cuts, one per panel.', duration: 0.4, panels: 2, ink: '#000000' };

interface Cut { x: number; y: number; len: number; ang: number; t0: number }

export function create(o: Opts) {
  const C = fit([...RAMPS.steel], 5), R = new Rng(o.seed);
  const bits = new Bits({ ground: () => 0 });
  const cuts: Cut[] = [{ x: 0, y: -12, len: 22, ang: 0.85, t0: -0.03 }, { x: 38, y: -12, len: 20, ang: -0.85, t0: 0.02 }];
  const shed = new Set<number>();
  let t = 0;
  return {
    update(dt: number) {
      t += dt;
      cuts.forEach((k, i) => {
        if (shed.has(i) || t < k.t0 + 0.035) return;
        shed.add(i);
        for (let j = 0; j < 4; j++) bits.add({ kind: B.SHARD, x: k.x + R.range(-4, 4), y: k.y + R.range(-4, 4), vx: R.range(-20, 50), vy: R.range(-70, -20), a: R.range(0, 6), va: R.range(-20, 20), s: R.range(1, 2), c: C[R.int(2, 4)], g: 0.6, life: R.range(0.2, 0.3) });
      });
      bits.update(dt);
    },
    draw(p: any) {
      for (const k of cuts) {
        const u = t - k.t0;
        if (u < 0 || u > 0.26) continue;
        // snap open from the middle in 2 frames, hold white, then thin and cool from the ends inward
        const open = ease.outExpo(clamp(u / 0.035)), thin = clamp((u - 0.07) / 0.19);
        const half = (k.len / 2) * open * (1 - thin * 0.6), dx = Math.cos(k.ang), dy = Math.sin(k.ang);
        const c = u < 0.06 ? C[4] : u < 0.13 ? C[3] : C[2];
        p.beam(k.x - dx * half, k.y - dy * half, k.x + dx * half, k.y + dy * half, thin < 0.4 ? 2 : 1, c, 1 - thin * 0.7);
        if (u < 0.08) p.line(k.x - dx * half * 1.15, k.y - dy * half * 1.15 + 1, k.x + dx * half * 1.15, k.y + dy * half * 1.15 + 1, C[2], 0.6);
        if (u > 0.02 && u < 0.1) sparkle(p, k.x, k.y, 3 * (1 - (u - 0.02) / 0.08), C[3], C[2], 0.3);
        if (u < 0.12) p.glowLine(k.x - dx * half, k.y - dy * half, k.x + dx * half, k.y + dy * half, 4, C[3], 0.3 * (1 - u / 0.12));
      }
      bits.draw(p);
    },
  };
}

export default { meta, create } satisfies PfxModule;
