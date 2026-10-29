// Spell deck import and export as a small YAML file:
//
//   # Spell VS Steel spell deck
//   class: mage
//   name: Pyromancer
//   spells:
//     fireball: 4        # Fireball
//     "Arcane Missiles": 3
//
// Spells can be named by id or by card name (any case). Only this subset of YAML is read: top-level
// `key: value` lines, a `spells:` map of `spell: count` (or a list of `- spell` / `- 3x spell` lines),
// quotes and # comments. An import that breaks a deck rule is refused with the reason; a legal deck
// that is not finished yet (under 30 spells, no Mythic) comes in and shows NOT READY like any other.
import { CARDS, MAX_COPIES, type CardDef } from './cards';
import { CLASS_INFO, PLAYABLE } from './classes';
import { DECK_SIZE, MAX_LEGENDARIES, MYTHICS_REQUIRED, countRarity, deckSize, type DeckCounts } from './deck';
import type { ClassId } from '../art/sprites';

export interface SpellDeck { cls: ClassId; name?: string; deck: DeckCounts }

const RARITY_RANK = { common: 0, uncommon: 1, legendary: 2, mythic: 3 };

/** A YAML scalar safe to write bare, else double-quoted. */
const scalar = (s: string): string => (/^[A-Za-z0-9_][A-Za-z0-9_ .'-]*$/.test(s) && !/\s$/.test(s) ? s : JSON.stringify(s));

export function exportYaml(g: SpellDeck): string {
  const ids = Object.keys(g.deck).filter(id => g.deck[id] > 0 && CARDS[id])
    .sort((a, b) => RARITY_RANK[CARDS[a].rarity] - RARITY_RANK[CARDS[b].rarity] || CARDS[a].name.localeCompare(CARDS[b].name));
  const w = Math.max(0, ...ids.map(id => id.length));
  return [
    '# Spell VS Steel spell deck',
    `class: ${g.cls}`,
    ...(g.name ? [`name: ${scalar(g.name)}`] : []),
    'spells:',
    ...ids.map(id => `  ${`${id}:`.padEnd(w + 1)} ${g.deck[id]}  # ${CARDS[id].name} (${CARDS[id].rarity})`),
    '',
  ].join('\n');
}

/** Strip a trailing # comment that is outside quotes. */
function stripComment(line: string): string {
  let q: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === q) q = null; }
    else if (ch === '"' || ch === "'") q = ch;
    else if (ch === '#' && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i);
  }
  return line;
}

const unquote = (s: string): string => {
  s = s.trim();
  if (s.length >= 2 && (s[0] === '"' || s[0] === "'") && s[s.length - 1] === s[0]) {
    return s[0] === '"' ? JSON.parse(s.replace(/\\'/g, "'")) as string : s.slice(1, -1).replace(/''/g, "'");
  }
  return s;
};

/** Split `key: value` at the first colon outside quotes (card names like "Power Word: Shield" are quoted). */
function splitKey(s: string): [string, string] | null {
  let q: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === q) q = null; }
    else if (ch === '"' || ch === "'") q = ch;
    else if (ch === ':' && (i === s.length - 1 || /\s/.test(s[i + 1]))) return [unquote(s.slice(0, i)), s.slice(i + 1).trim()];
  }
  return null;
}

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Finds a card by id or by name, ignoring case, spaces and punctuation. */
function findCard(key: string): CardDef | undefined {
  if (CARDS[key]) return CARDS[key];
  const k = norm(key);
  return Object.values(CARDS).find(c => norm(c.id) === k || norm(c.name) === k);
}

/** Reads a spell deck and checks it against the deck rules. Returns the deck, or the first problem found. */
export function importYaml(text: string): { ok: true; spellDeck: SpellDeck } | { ok: false; error: string } {
  const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
  if (text.length > 20000) return fail('FILE IS TOO BIG FOR A SPELL DECK');
  let cls: string | undefined, name: string | undefined, inSpells = false;
  const entries: Array<[string, number, number]> = [];
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  for (let n = 0; n < lines.length; n++) {
    const raw = stripComment(lines[n]).replace(/\s+$/, '');
    if (!raw.trim() || raw.trim() === '---') continue;
    const indented = /^\s/.test(raw), line = raw.trim();
    if (!indented) {
      inSpells = false;
      const kv = splitKey(line);
      if (!kv) return fail(`LINE ${n + 1}: EXPECTED KEY: VALUE`);
      const [k, v] = kv;
      if (k === 'class') cls = unquote(v).toLowerCase();
      else if (k === 'name') name = unquote(v).slice(0, 40);
      else if (k === 'spells') { if (v && v !== '{}' && v !== '[]') return fail(`LINE ${n + 1}: PUT EACH SPELL ON ITS OWN LINE`); inSpells = true; }
      // other top-level keys are ignored, so files can carry notes
      continue;
    }
    if (!inSpells) continue;
    let key: string, count: number;
    if (line.startsWith('- ')) {
      // list form: "- fireball" or "- 3x Fireball"
      const item = unquote(line.slice(2));
      const m = /^(\d+)\s*x\s+(.+)$/i.exec(item);
      key = m ? unquote(m[2]) : item; count = m ? Number(m[1]) : 1;
    } else {
      const kv = splitKey(line);
      if (!kv) return fail(`LINE ${n + 1}: EXPECTED SPELL: COUNT`);
      key = kv[0];
      const v = unquote(kv[1]);
      if (!/^\d+$/.test(v)) return fail(`LINE ${n + 1}: COUNT FOR ${key.toUpperCase()} MUST BE A WHOLE NUMBER`);
      count = Number(v);
    }
    entries.push([key, count, n + 1]);
  }

  if (!cls) return fail('MISSING CLASS (E.G. CLASS: MAGE)');
  const classId = PLAYABLE.find(c => c === cls || CLASS_INFO[c].name.toLowerCase() === cls);
  if (!classId) return fail(`UNKNOWN CLASS ${cls.toUpperCase()}`);

  const deck: DeckCounts = {};
  for (const [key, count, line] of entries) {
    const card = findCard(key);
    if (!card) return fail(`LINE ${line}: NO SPELL CALLED ${key.toUpperCase()}`);
    if (card.cls !== classId) return fail(`${card.name.toUpperCase()} IS NOT A ${CLASS_INFO[classId].name} SPELL`);
    deck[card.id] = (deck[card.id] ?? 0) + count;
  }
  for (const id of Object.keys(deck)) if (!deck[id]) delete deck[id];
  const why = deckRuleBroken(deck);
  return why ? fail(why) : { ok: true, spellDeck: { cls: classId, name, deck } };
}

/** The first deck rule an imported deck breaks (the same limits the builder enforces when adding a card), or null. */
export function deckRuleBroken(deck: DeckCounts): string | null {
  for (const [id, k] of Object.entries(deck)) {
    const c = CARDS[id];
    if (k > MAX_COPIES[c.rarity]) return `${c.name.toUpperCase()}: MAX ${MAX_COPIES[c.rarity]} COPIES (HAS ${k})`;
  }
  if (deckSize(deck) > DECK_SIZE) return `TOO MANY SPELLS: ${deckSize(deck)} (MAX ${DECK_SIZE})`;
  if (countRarity(deck, 'legendary') > MAX_LEGENDARIES) return `TOO MANY LEGENDARIES: ${countRarity(deck, 'legendary')} (MAX ${MAX_LEGENDARIES})`;
  if (countRarity(deck, 'mythic') > MYTHICS_REQUIRED) return `ONLY ${MYTHICS_REQUIRED} MYTHIC ALLOWED`;
  return null;
}
