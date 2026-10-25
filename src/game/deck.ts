// Grimoire rules, starter decks and browser storage for custom decks.
import { CARDS, MAX_COPIES, type CardDef } from './cards';
import type { ClassId } from '../art/sprites';

export const DECK_SIZE = 30;
export const MAX_LEGENDARIES = 5;
export const MYTHICS_REQUIRED = 1;

/** Card id -> copies. */
export type DeckCounts = Record<string, number>;

const STARTERS: Record<ClassId, DeckCounts> = {
  warrior: {
    step_slash: 4, guard: 3, lunge: 3, iron_skin: 2, shield_wall: 2, execute: 3, chain_hook: 3, shieldbreaker: 2, battle_shout: 2,
    leap_strike: 1, wide_cleave: 1,
    rampage: 1, shield_slam: 1, rallying_cry: 1,
    titans_fall: 1,
  },
  mage: {
    arcane_missiles: 4, arcane_focus: 3, arcane_barrier: 2, blink: 2, repulse: 2, ignite: 3, fireball: 3, scorch: 2, ice_wall: 2, frost_nova: 2,
    arcane_blast: 1, flamestrike: 1,
    meteor: 1, deep_freeze: 1,
    inferno: 1,
  },
  rogue: {
    vanish: 3, shadowstep: 4, ambush: 3, shiv: 4, evasion: 1, kick: 2, poison_vial: 2, deadly_poison: 2, envenom: 2,
    cold_blood: 2, riposte: 1, pickpocket: 1,
    eviscerate: 1, kidney_shot: 1,
    death_mark: 1,
  },
  ranger: {
    steady_focus: 3, hawk_strike: 4, hunters_mark: 2, net: 2, disengage: 2, freezing_trap: 2, explosive_trap: 2, multi_shot: 3, call_wolf: 2, power_shot: 3,
    flare: 1, volley: 1,
    kill_shot: 1, explosive_shot: 1,
    deadeye: 1,
  },
  cleric: {
    prayer: 3, flash_heal: 3, renew: 2, power_word_shield: 2, purify: 1, sanctuary: 2, holy_fire: 4, penance: 3, holy_nova: 2, hammer_of_justice: 3,
    holy_wall: 1, atonement: 1,
    wrath_of_heaven: 1, holy_word_serenity: 1,
    day_of_judgment: 1,
  },
};

export const starterDeck = (cls: ClassId): DeckCounts => ({ ...STARTERS[cls] });
export const STARTER_NAME: Record<ClassId, string> = { warrior: 'Brawler', mage: 'Elementalist', rogue: 'Assassin', ranger: 'Hunter', cleric: 'Priest' };

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

const KEY = (cls: ClassId): string => `svs:deck:${cls}`;

export function loadCustom(cls: ClassId): DeckCounts | null {
  try {
    const raw = localStorage.getItem(KEY(cls));
    if (!raw) return null;
    const d = JSON.parse(raw) as DeckCounts;
    for (const id of Object.keys(d)) if (!CARDS[id] || CARDS[id].cls !== cls) delete d[id];
    return d;
  } catch { return null; }
}

export function saveCustom(cls: ClassId, d: DeckCounts): boolean {
  try { localStorage.setItem(KEY(cls), JSON.stringify(d)); return true; } catch { return false; }
}
