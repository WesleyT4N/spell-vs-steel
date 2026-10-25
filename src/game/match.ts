// The player's match setup, remembered between visits.
import { defaultSkin, type ClassId } from '../art/sprites';
import { CLASS_IDS } from './classes';
import type { Difficulty } from './tuning';
import { loadCustom, starterDeck, toList, validate } from './deck';

export interface MatchConfig {
  p1: ClassId;
  p1Deck: 'starter' | 'custom';
  cpu: ClassId;
  difficulty: Difficulty;
  /** Chosen skin per class, for the player and for the CPU. */
  p1Skin: Record<ClassId, string>;
  cpuSkin: Record<ClassId, string>;
  /** Rounds in a set: 1 (single match), 3 or 5. */
  bestOf: 1 | 3 | 5;
}

const KEY = 'svs:match';

export function loadMatch(): MatchConfig {
  const skins = (): Record<ClassId, string> => Object.fromEntries(CLASS_IDS.map(c => [c, defaultSkin(c)])) as Record<ClassId, string>;
  const def: MatchConfig = { p1: 'warrior', p1Deck: 'starter', cpu: 'mage', difficulty: 'normal', bestOf: 3, p1Skin: skins(), cpuSkin: skins() };
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
  }
  return toList(starterDeck(m.p1));
}
