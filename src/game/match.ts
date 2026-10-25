// The player's match setup, remembered between visits.
import type { ClassId } from '../art/sprites';
import type { Difficulty } from './tuning';
import { loadCustom, starterDeck, toList, validate } from './deck';

export interface MatchConfig {
  p1: ClassId;
  p1Deck: 'starter' | 'custom';
  cpu: ClassId;
  difficulty: Difficulty;
}

const KEY = 'svs:match';

export function loadMatch(): MatchConfig {
  const def: MatchConfig = { p1: 'warrior', p1Deck: 'starter', cpu: 'mage', difficulty: 'normal' };
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...def, ...(JSON.parse(raw) as Partial<MatchConfig>) } : def;
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
