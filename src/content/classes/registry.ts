// The class registry. A class module answers the battle engine's questions about its class: how its
// resource starts, fills and caps, and what its light and heavy attacks do. Its spells live beside it in
// cards.ts. Registration order is the roster order, so built-ins register in a fixed order, mods after.
//
// Rules hold no state of their own: anything they change lives on the Fighter or the Battle, so rollback
// snapshots and replays see it.
import type { Battle, Fighter } from '../../game/battle';
import { Registry } from '../registry';

export interface ClassRules {
  id: string;
  /** Resource at the start of a match, and its starting max (read when the fighter is made). */
  startRes(): number;
  startResMax(): number;
  /** What the resource can grow to (`cap`) and holds right now (`max`), for Draw-screen cost planning. */
  pool(f: Fighter): { cap: number; max: number };
  /** The light attack (tap) or heavy attack (charged): sets f.lock and does the hit. */
  basic(b: Battle, f: Fighter, kind: 'light' | 'heavy'): void;
  /** Each Draw screen, before the hand is dealt. b.turn is already the new turn. */
  onDraw?(b: Battle, f: Fighter): void;
  /** Every fight frame while the fighter is alive. */
  tick?(b: Battle, f: Fighter, dt: number): void;
  /** After the fighter takes `amt` damage. */
  onHurt?(b: Battle, f: Fighter, amt: number): void;
  /** Rage-like gain from hits and walls; classes without it leave this out and the gain does nothing. */
  gainRage?(b: Battle, f: Fighter, amt: number, fromCard: boolean): void;
  /** Resource from a card or effect. Left out: up to f.resMax, with a pip sound. */
  gainRes?(b: Battle, f: Fighter, amt: number): void;
}

export const CLASS_RULES = new Registry<ClassRules>('class');
export const registerClass = (r: ClassRules): ClassRules => CLASS_RULES.register(r);

/** The rules for class `id`. */
export function classRules(id: string): ClassRules {
  const r = CLASS_RULES.get(id);
  if (!r) throw new Error(`unknown class '${id}'`);
  return r;
}
