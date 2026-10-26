// The player's match setup, remembered between visits.
import { defaultSkin, type ClassId } from '../art/sprites';
import { CLASS_IDS } from './classes';
import type { Difficulty } from './tuning';
import { loadCustom, presetDeck, presetsFor, toList, validate } from './deck';

export interface MatchConfig {
  p1: ClassId;
  /** 'custom', or a ready-made deck id ('starter' or a Mythic deck). */
  p1Deck: string;
  cpu: ClassId;
  /** A ready-made deck id for the CPU (or the training dummy), or 'random'. */
  cpuDeck: string;
  difficulty: Difficulty;
  /** Chosen skin per class, for the player and for the CPU. */
  p1Skin: Record<ClassId, string>;
  cpuSkin: Record<ClassId, string>;
  /** Rounds in a set: 1 (single match), 3 or 5. */
  bestOf: 1 | 3 | 5;
  /** Last stage tile picked: a stage id or 'random'. */
  stage: string;
}

const KEY = 'svs:match';

export function loadMatch(): MatchConfig {
  const skins = (): Record<ClassId, string> => Object.fromEntries(CLASS_IDS.map(c => [c, defaultSkin(c)])) as Record<ClassId, string>;
  const def: MatchConfig = { p1: 'warrior', p1Deck: 'starter', cpu: 'mage', cpuDeck: 'starter', difficulty: 'normal', bestOf: 3, stage: 'colosseum', p1Skin: skins(), cpuSkin: skins() };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return def;
    const saved = JSON.parse(raw) as Partial<MatchConfig>;
    return { ...def, ...saved, p1Skin: { ...skins(), ...saved.p1Skin }, cpuSkin: { ...skins(), ...saved.cpuSkin } };
  } catch { return def; }
}

export function saveMatch(m: MatchConfig): void {
  try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* storage blocked */ }
}

/** The card list the player will fight with (falls back to the starter if the custom deck is invalid). */
export function playerDeck(m: MatchConfig): string[] {
  if (m.p1Deck === 'custom') {
    const d = loadCustom(m.p1);
    if (d && validate(d).length === 0) return toList(d);
    return toList(presetDeck(m.p1, 'starter'));
  }
  return toList(presetDeck(m.p1, m.p1Deck));
}

/** The CPU's ready-made deck id for one match ('random' rolls one each time). */
export function rollCpuDeck(m: MatchConfig): string {
  const list = presetsFor(m.cpu);
  if (m.cpuDeck === 'random') return list[Math.floor(Math.random() * list.length)].id;
  return list.some(p => p.id === m.cpuDeck) ? m.cpuDeck : 'starter';
}

/** Steps through a class's deck choices: the ready-made decks, then `extra` ('custom' for you, 'random' for the CPU). */
export function cycleDeck(cls: ClassId, cur: string, extra: string, d: 1 | -1): string {
  const ids = [...presetsFor(cls).map(p => p.id), extra];
  const i = ids.indexOf(cur);
  return ids[((i < 0 ? 0 : i) + d + ids.length) % ids.length];
}
