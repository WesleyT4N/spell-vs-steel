// The card table: the CardDef shape and every class's spells, gathered from src/content/classes/<id>/cards.ts.
// ALL_CARDS keeps class order (Warrior, Mage, Rogue, Ranger, Priest); deck shuffles and replays depend on it.
import type { Battle, CastCtx, Fighter } from './battle';
import type { ClassId } from '../art/sprites';

export type Element = 'steel' | 'fire' | 'frost' | 'arcane' | 'shadow' | 'poison' | 'nature' | 'holy';
export type Rarity = 'common' | 'uncommon' | 'legendary' | 'mythic';

export interface CardDef {
  id: string;
  name: string;
  cls: ClassId;
  cost: number | 'all';
  rarity: Rarity;
  element: Element;
  /** Whether Battle Shout / Rallying Cry bonuses apply. */
  damaging: boolean;
  /** Seconds the caster is locked out after casting. */
  lock?: number;
  /** Damage shown on the card. */
  dmg: string;
  /** Resource the spell gives its caster when cast, previewed on the Draw screen. */
  gain?: { max?: number; res?: number; refill?: boolean };
  /**
   * How the spell changes the cost of spells cast after it, previewed on the Draw screen and in the hand:
   * `next` = that many spells cost 1 less (Arcane Power), `less` = every spell costs 1 less (Power Infusion),
   * `free` = every spell costs nothing (Avatar, Ascendance). Display only; `cast` applies the real effect.
   */
  costMod?: { next?: number; less?: boolean; free?: boolean };
  /** The caster's next damaging spell deals more (Arcane Blast, by TUNING.mage.blastEmpower). Display only, like costMod. */
  empowers?: boolean;
  /** Only castable while the caster is in Stealth (Ambush); otherwise it waits at the top of the queue. */
  needsStealth?: boolean;
  /** One-line rules text (keep under ~90 chars, it has to fit a 240px screen). */
  short: string;
  cast: (x: CastCtx) => void;
  /** CPU hint: is now a good moment to cast this? Rolls use `rand` (the CPU's seeded generator), never Math.random. */
  ai?: (b: Battle, f: Fighter, rand: () => number) => boolean;
}

export const MAX_COPIES: Record<Rarity, number> = { common: 4, uncommon: 2, legendary: 1, mythic: 1 };

import { warrior } from '../content/classes/warrior/cards';
import { mage } from '../content/classes/mage/cards';
import { rogue } from '../content/classes/rogue/cards';
import { ranger } from '../content/classes/ranger/cards';
import { priest } from '../content/classes/priest/cards';

export const ALL_CARDS: CardDef[] = [...warrior, ...mage, ...rogue, ...ranger, ...priest];
// No prototype, so ids from files or the network ("__proto__", "constructor") never resolve to a built-in object.
export const CARDS: Record<string, CardDef> = Object.assign(Object.create(null), Object.fromEntries(ALL_CARDS.map(c => [c.id, c])));
export const cardsFor = (cls: ClassId): CardDef[] => ALL_CARDS.filter(c => c.cls === cls);

export const ELEMENT_COLOR: Record<Element, string> = { steel: '#bcbcbc', fire: '#f87800', frost: '#3cbcfc', arcane: '#f878f8', shadow: '#9878f8', poison: '#b8f818', nature: '#58d854', holy: '#f8d878' };
export const RARITY_COLOR: Record<Rarity, string> = { common: '#bcbcbc', uncommon: '#58d854', legendary: '#f8b800', mythic: '#f878f8' };
