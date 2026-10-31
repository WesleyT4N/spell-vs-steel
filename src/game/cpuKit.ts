// Building blocks for each class's CPU (content/classes/<id>/cpu.ts): where to stand and which spells to take
// from a Draw-screen offer. They only read what they are handed, so the CPU's seeded rolls stay in ai.ts.
import type { Battle, Fighter } from './battle';
import type { CardDef } from './cards';
import type { Playstyle, Role } from './playstyles';
import { CLASSES } from '../content/classes/registry';

/** Where a CPU is deciding to stand. `row` is the row it wants (already aimed or rolled); `range` is the style's. */
export interface GoalCtx { b: Battle; f: Fighter; foe: Fighter; row: number; range: Playstyle['range'] }

/** A Draw-screen offer being picked from. `cost(i)` and `want(i)` take an index into `offer`. */
export interface PickCtx {
  offer: string[];
  idx: number[];
  /** Resource held now. */
  res: number;
  cost(i: number): number;
  /** How much the style wants the card: its cost nudged by the style's taste for its role. */
  want(i: number): number;
  role(i: number): Role;
  style: Playstyle;
  gain(i: number): CardDef['gain'];
}

/** Melee classes fight from the front column (one back when the style hangs back). */
export const meleeGoal = ({ b, f, row, range }: GoalCtx): [number, number] =>
  [range < 0 ? b.frontCol(f.side) - b.dir(f) : b.frontCol(f.side), row];

/** Is `foe` a class that crowds the border (cpu.crowds) standing at its front column? */
export const crowding = (b: Battle, foe: Fighter): boolean => !!CLASSES.get(foe.cls)?.cpu.crowds && foe.col === b.frontCol(foe.side);

/** Ranged classes hold the middle; they back off when the style hangs back or the foe crowds the border. */
export function rangedGoal(x: GoalCtx, crowded: boolean): [number, number] {
  const { b, f, row, range } = x;
  if (range < 0) return [b.backCol(f.side), row];
  return [crowded ? b.backCol(f.side) : b.frontCol(f.side) - b.dir(f), row];
}

/**
 * Pick for a resource known up front (Energy, Mana): count what the offer will add, take `payFirst` cards first
 * (they pay for themselves), then the most wanted things we can afford, and cast them in `first` order
 * (lower first; cards not listed go by cost). A defensive style puts its protection up before anything else.
 */
export function poolPick(x: PickCtx, o: { expect?: number; payFirst?: string[]; first?: Record<string, number> } = {}): number[] {
  const { offer, idx, cost, want, role, style } = x;
  const payFirst = o.payFirst ?? [], first = o.first ?? {};
  let mana = x.res + (o.expect ?? 0);
  for (const i of idx) { const g = x.gain(i); if (g?.res && !payFirst.includes(offer[i])) mana += g.res; if (g?.refill) mana = Math.max(mana, 5); }
  const chosen: number[] = [];
  for (const i of idx.filter(i => payFirst.includes(offer[i]))) { chosen.push(i); mana += x.gain(i)?.res ?? 0; }
  const rest = idx.filter(i => !chosen.includes(i)).sort((a, c) => want(c) - want(a));
  for (const i of rest) if (cost(i) <= mana && want(i) > -1) { chosen.push(i); mana -= cost(i); }
  const early = (i: number): number => (style.kind === 'defensive' && role(i) === 'defense' ? -20 : 0) + (first[offer[i]] ?? cost(i));
  return chosen.sort((a, c) => early(a) - early(c));
}
