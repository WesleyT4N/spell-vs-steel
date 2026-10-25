// Helpers shared by every class's card list.
import type { Battle, CastCtx, Fighter, Side } from './battle';

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
  const px = (toCol - f.col) * 38, py = (toRow - f.row) * 19;
  b.anim(out, p => { f.dx = px * p; f.dy = py * p - Math.sin(p * Math.PI) * arc; });
  b.later(out + hold, () => b.anim(back, p => { f.dx = px * (1 - p); f.dy = py * (1 - p) - Math.sin(p * Math.PI) * arc * 0.5; }));
}
