// Spell deck rules, starter decks and the player's own saved spell decks.
import { getSave, updateSave, saveIsReadOnly, type SavedDeck } from '../engine/save';
import { CARDS, MAX_COPIES, type CardDef } from './cards';
import type { ClassId } from '../art/sprites';
import { classModule } from '../content/classes';

export const DECK_SIZE = 30;
export const MAX_LEGENDARIES = 5;
export const MYTHICS_REQUIRED = 1;

/** Card id -> copies. */
export type DeckCounts = Record<string, number>;


export const starterDeck = (cls: ClassId): DeckCounts => ({ ...classModule(cls).decks.starter });

/** A ready-made deck: the starter, or one built around one of the class's Mythics. */
export interface DeckPreset { id: string; name: string; mythic: string; cards: DeckCounts }


/** Every ready-made deck for a class: the starter first, then the Mythic decks. */
export const presetsFor = (cls: ClassId): DeckPreset[] => {
  const d = classModule(cls).decks;
  return [
    { id: 'starter', name: d.starterName, mythic: Object.keys(d.starter).find(id => CARDS[id]?.rarity === 'mythic') ?? '', cards: d.starter },
    ...d.mythic,
  ];
};

/** A ready-made deck by id (falls back to the starter). */
export const presetDeck = (cls: ClassId, id: string): DeckCounts => ({ ...(presetsFor(cls).find(p => p.id === id) ?? presetsFor(cls)[0]).cards });
export const presetName = (cls: ClassId, id: string): string => (presetsFor(cls).find(p => p.id === id) ?? presetsFor(cls)[0]).name;

export const deckSize = (d: DeckCounts): number => Object.values(d).reduce((a, b) => a + b, 0);
export const countRarity = (d: DeckCounts, r: CardDef['rarity']): number =>
  Object.entries(d).reduce((a, [id, n]) => a + (CARDS[id]?.rarity === r ? n : 0), 0);

/** Can one more copy of this card be added? Returns a reason when not. */
export function canAdd(d: DeckCounts, card: CardDef): string | null {
  const have = d[card.id] ?? 0;
  if (deckSize(d) >= DECK_SIZE) return 'DECK IS FULL';
  if (have >= MAX_COPIES[card.rarity]) return `MAX ${MAX_COPIES[card.rarity]} COPIES`;
  if (card.rarity === 'legendary' && countRarity(d, 'legendary') >= MAX_LEGENDARIES) return `MAX ${MAX_LEGENDARIES} LEGENDARIES`;
  if (card.rarity === 'mythic' && countRarity(d, 'mythic') >= MYTHICS_REQUIRED) return 'ONLY 1 MYTHIC';
  return null;
}

export function validate(d: DeckCounts): string[] {
  const errs: string[] = [];
  const n = deckSize(d);
  if (n !== DECK_SIZE) errs.push(`NEEDS ${DECK_SIZE} SPELLS (HAS ${n})`);
  if (countRarity(d, 'mythic') !== MYTHICS_REQUIRED) errs.push('NEEDS EXACTLY 1 MYTHIC');
  if (countRarity(d, 'legendary') > MAX_LEGENDARIES) errs.push(`MAX ${MAX_LEGENDARIES} LEGENDARIES`);
  for (const [id, k] of Object.entries(d)) {
    const c = CARDS[id];
    if (c && k > MAX_COPIES[c.rarity]) errs.push(`TOO MANY ${c.name.toUpperCase()}`);
  }
  return errs;
}

export const toList = (d: DeckCounts): string[] => Object.entries(d).flatMap(([id, n]) => Array(n).fill(id));

/** How many spell decks of their own a player can keep per class. */
export const MAX_CUSTOM_DECKS = 10;
/** Longest deck name, and the characters one may use (the bitmap font's). */
export const DECK_NAME_MAX = 16;
export const DECK_NAME_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -!?.\'#+/()';

/** A player's spell deck as a choice id ('custom:<id>'), and back. */
export const CUSTOM_PREFIX = 'custom:';
export const customChoice = (id: string): string => CUSTOM_PREFIX + id;
export const customIdOf = (choice: string): string | null => (choice.startsWith(CUSTOM_PREFIX) ? choice.slice(CUSTOM_PREFIX.length) : null);

/** Upper case, only characters the font has, single spaces, at most DECK_NAME_MAX long. */
export function cleanDeckName(s: string): string {
  return [...s.toUpperCase()].filter(ch => DECK_NAME_CHARS.includes(ch)).join('').replace(/ +/g, ' ').trimStart().slice(0, DECK_NAME_MAX);
}

/** The player's spell decks for a class, with any card that isn't the class's dropped. */
export function customDecks(cls: ClassId): SavedDeck[] {
  return (getSave('decks')[cls] ?? []).map(d => ({
    ...d, cards: Object.fromEntries(Object.entries(d.cards).filter(([id]) => CARDS[id]?.cls === cls)),
  }));
}

export const getCustom = (cls: ClassId, id: string): SavedDeck | null => customDecks(cls).find(d => d.id === id) ?? null;

/** `base`, or `base 2`, `base 3`... whichever no other deck of the class is called. */
export function freeDeckName(cls: ClassId, base: string, except?: string): string {
  const taken = new Set(customDecks(cls).filter(d => d.id !== except).map(d => d.name));
  const b = cleanDeckName(base).trim() || 'SPELL DECK';
  if (!taken.has(b)) return b;
  for (let n = 2; ; n++) {
    const tail = ` ${n}`, name = b.slice(0, DECK_NAME_MAX - tail.length).trimEnd() + tail;
    if (!taken.has(name)) return name;
  }
}

const writeDecks = (cls: ClassId, f: (list: SavedDeck[]) => SavedDeck[]): boolean => {
  updateSave('decks', all => ({ ...all, [cls]: f([...(all[cls] ?? [])]) }));
  return !saveIsReadOnly();
};

/** Make a new spell deck (named after `name`, made unique). Null when the class already has MAX_CUSTOM_DECKS. */
export function createCustom(cls: ClassId, name: string, cards: DeckCounts): SavedDeck | null {
  const list = getSave('decks')[cls] ?? [];
  if (list.length >= MAX_CUSTOM_DECKS) return null;
  const n = list.reduce((m, d) => Math.max(m, Number(/^d(\d+)$/.exec(d.id)?.[1] ?? 0)), 0) + 1;
  const deck: SavedDeck = { id: `d${n}`, name: freeDeckName(cls, name), cards: { ...cards } };
  writeDecks(cls, l => [...l, deck]);
  return deck;
}

/** Replace a saved deck's cards. */
export function saveCustom(cls: ClassId, id: string, cards: DeckCounts): boolean {
  return writeDecks(cls, l => l.map(d => (d.id === id ? { ...d, cards: { ...cards } } : d)));
}

/** Rename a saved deck; returns the name it got (cleaned and made unique), or null for a blank name. */
export function renameCustom(cls: ClassId, id: string, name: string): string | null {
  if (!cleanDeckName(name).trim()) return null;
  const free = freeDeckName(cls, name, id);
  writeDecks(cls, l => l.map(d => (d.id === id ? { ...d, name: free } : d)));
  return free;
}

/** The name a copy of a deck gets unless the player picks one: "NAME COPY". */
export function copyName(cls: ClassId, name: string): string {
  const tail = ' COPY';
  return freeDeckName(cls, name.slice(0, DECK_NAME_MAX - tail.length).trimEnd() + tail);
}

/** A copy of a saved deck, just after it in the list (named `name`, or "NAME COPY"). Null when the class is full. */
export function cloneCustom(cls: ClassId, id: string, name?: string): SavedDeck | null {
  const src = getCustom(cls, id);
  if (!src) return null;
  const made = createCustom(cls, name ?? copyName(cls, src.name), src.cards);
  if (!made) return null;
  // sit next to the original
  writeDecks(cls, l => { const rest = l.filter(d => d.id !== made.id); rest.splice(rest.findIndex(d => d.id === id) + 1, 0, made); return rest; });
  return made;
}

export function deleteCustom(cls: ClassId, id: string): boolean {
  return writeDecks(cls, l => l.filter(d => d.id !== id));
}
