// Helpers shared by every class's card list.
import type { Battle, CastCtx, Fighter, Side } from './battle';
import { effect, type EffectRec } from '../content/effects';

export const sameRow = (b: Battle, f: Fighter): boolean => b.foe(f).row === f.row;
export const ahead = (b: Battle, f: Fighter, n: number): boolean => {
  const foe = b.foe(f), d = b.dir(f);
  if (foe.row !== f.row) return false;
  const dist = (foe.col - f.col) * d;
  return dist >= 1 && dist <= n;
};
export const cellsAhead = (x: CastCtx, from: number, to: number, row = x.f.row): Array<[number, number]> => {
  const out: Array<[number, number]> = [];
  for (let i = from; i <= to; i++) out.push([x.f.col + i * x.dir, row]);
  return out;
};
export const allEnemyPanels = (b: Battle, side: Side): Array<[number, number]> => {
  const out: Array<[number, number]> = [];
  for (let c = 0; c < 6; c++) for (let r = 0; r < 3; r++) if (b.panels[c][r].owner !== side) out.push([c, r]);
  return out;
};
export const lowHp = (f: Fighter, pct: number): boolean => f.hp / f.maxHp < pct;

/** Move the caster's sprite out and back (dash/leap), purely visual. */
export function lunge(x: CastCtx, toCol: number, toRow: number, out: number, hold: number, back: number, arc = 0): void {
  const { b, f } = x;
  const a = { side: f.side, px: (toCol - f.col) * 38, py: (toRow - f.row) * 19, arc, back };
  b.anim(out, lungeOut(a));
  b.later(out + hold, lungeReturn(a));
}
interface Lunge { side: Side; px: number; py: number; arc: number; back: number }
const lungeOut = effect('lunge.out', (b, a: Lunge, p: number) => {
  const f = b.f[a.side];
  f.dx = a.px * p; f.dy = a.py * p - Math.sin(p * Math.PI) * a.arc;
});
const lungeBack = effect('lunge.back', (b, a: Lunge, p: number) => {
  const f = b.f[a.side];
  f.dx = a.px * (1 - p); f.dy = a.py * (1 - p) - Math.sin(p * Math.PI) * a.arc * 0.5;
});
const lungeReturn = effect('lunge.return', (b, a: Lunge) => b.anim(a.back, lungeBack(a)));

/** Locks onto the enemy's panel at cast time and runs the effect made for that panel after `delay` (dodgeable when there is a telegraph). */
export function targeted(x: CastCtx, delay: number, make: (c: number, r: number) => EffectRec): void {
  x.b.later(delay, make(x.foe.col, x.foe.row));
}
