// The player's match setup, remembered between visits.
import { getSave, setSave } from '../engine/save';
import { defaultSkin, type ClassId } from '../art/sprites';
import { CLASS_IDS } from './classes';
import type { Difficulty } from './tuning';
import { loadCustom, presetDeck, presetName, presetsFor, toList, validate } from './deck';

/** Who plays a side in local Versus: someone at this keyboard, or the CPU. */
export type Ctl = 'player' | 'cpu';

export interface MatchConfig {
  /** Left side's fighter and deck. (Named from when the left side was always you.) */
  p1: ClassId;
  /** A side's deck: a ready-made deck id ('starter' or a Mythic deck), 'custom', or 'random' (a ready-made deck rolled each round). */
  p1Deck: string;
  /** Right side's fighter and deck. */
  cpu: ClassId;
  cpuDeck: string;
  /** Local Versus: who plays the left and right side. */
  sides: [Ctl, Ctl];
  difficulty: Difficulty;
  /** Chosen skin per class, for the player and for the CPU. */
  p1Skin: Record<ClassId, string>;
  cpuSkin: Record<ClassId, string>;
  /** Rounds in a set: 1 (single match), 3 or 5. */
  bestOf: 1 | 3 | 5;
  /** Last stage tile picked: a stage id or 'random'. */
  stage: string;
}

export function loadMatch(): MatchConfig {
  const skins = (): Record<ClassId, string> => Object.fromEntries(CLASS_IDS.map(c => [c, defaultSkin(c)])) as Record<ClassId, string>;
  const def: MatchConfig = { p1: 'warrior', p1Deck: 'starter', cpu: 'mage', cpuDeck: 'starter', sides: ['player', 'cpu'], difficulty: 'normal', bestOf: 3, stage: 'colosseum', p1Skin: skins(), cpuSkin: skins() };
  const saved = getSave('match') as Partial<MatchConfig> | null;
  if (!saved) return def;
  return { ...def, ...saved, p1Skin: { ...skins(), ...saved.p1Skin }, cpuSkin: { ...skins(), ...saved.cpuSkin } };
}

export function saveMatch(m: MatchConfig): void {
  setSave('match', JSON.parse(JSON.stringify(m)) as Record<string, unknown>);
}

/** The card list the player will fight with (falls back to the starter if the custom deck is invalid). */
export function playerDeck(m: MatchConfig): string[] { return sideDeck(m, 0); }

/** A side's deck for one round: 'random' rolls a ready-made deck, and an id the class doesn't have becomes the starter. */
export function rollDeck(m: MatchConfig, s: 0 | 1): string {
  const cls = s === 0 ? m.p1 : m.cpu, pick = s === 0 ? m.p1Deck : m.cpuDeck, list = presetsFor(cls);
  if (pick === 'custom') return pick;
  if (pick === 'random') return list[Math.floor(Math.random() * list.length)].id;
  return list.some(p => p.id === pick) ? pick : 'starter';
}

/** The card list a side fights with: its class's custom deck if picked and valid (else the starter), or a ready-made deck. */
export function sideDeck(m: MatchConfig, s: 0 | 1, deck: string = rollDeck(m, s)): string[] {
  const cls = s === 0 ? m.p1 : m.cpu;
  if (deck === 'custom') {
    const d = loadCustom(cls);
    return toList(d && validate(d).length === 0 ? d : presetDeck(cls, 'starter'));
  }
  return toList(presetDeck(cls, deck));
}

/** How a deck choice reads in menus and the HUD. */
export const deckLabel = (cls: ClassId, deck: string): string =>
  deck === 'custom' ? 'CUSTOM' : deck === 'random' ? 'RANDOM' : presetName(cls, deck).toUpperCase();

/** Steps through a class's deck choices: the ready-made decks, then custom, then random. */
export function cycleDeck(cls: ClassId, cur: string, d: 1 | -1): string {
  const ids = [...presetsFor(cls).map(p => p.id), 'custom', 'random'];
  const i = ids.indexOf(cur);
  return ids[((i < 0 ? 0 : i) + d + ids.length) % ids.length];
}

/** The name a side goes by in a local match: YOU and CPU, P1 and P2 when two people play, CPU 1 and CPU 2 when nobody does. */
export function sideName(sides: [Ctl, Ctl], s: 0 | 1): string {
  const humans = sides.filter(c => c === 'player').length;
  if (sides[s] === 'cpu') return humans === 0 ? `CPU ${s + 1}` : 'CPU';
  return humans === 2 ? `P${s + 1}` : 'YOU';
}
