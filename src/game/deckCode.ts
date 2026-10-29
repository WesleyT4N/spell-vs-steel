// Spell deck share codes: a short line of text to paste to a friend, like
//
//   SVS1-MAGE-4QZ1C7XK0...R2-PYROMANCER
//
// "SVS1", the class, the spells and a two-character check, then the deck's name (spaces as _), which is
// optional. The spells come in groups by copy count: the count, how many spells have it, then three characters
// per spell, a 15-bit hash of its card id. Hashes, not positions in the card list, so adding cards to a class
// never changes the codes of decks that already exist (tests/deckCode.ts fails if two spells of one class ever
// hash alike). The letters are Crockford base 32: no I, L, O or U, case doesn't
// matter, and a mistyped O, I or L still reads. Reading a code never runs anything: it only looks spells up in
// the class's own pool and then checks the deck rules, the same way a YAML import does.
import { cardsFor, MAX_COPIES, type CardDef } from './cards';
import { CLASS_INFO, PLAYABLE } from './classes';
import { cleanDeckName, type DeckCounts } from './deck';
import { deckRuleBroken, type SpellDeck } from './deckYaml';
import type { ClassId } from '../art/sprites';

const PREFIX = 'SVS1';
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
/** Codes longer than this aren't spell decks (30 spells is at most 30 entries, 98 characters). */
const MAX_LEN = 200;

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  // FNV's low bits mix poorly on their own: finish with murmur3's avalanche
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** A card's 15-bit share hash. */
export const cardHash = (id: string): number => fnv1a(id) % 32768;

const enc = (v: number, n: number): string => {
  let s = '';
  for (let i = 0; i < n; i++) { s = ALPHABET[v % 32] + s; v = Math.floor(v / 32); }
  return s;
};

/** Reads base 32 (upper case already), with the Crockford stand-ins for misread letters; -1 when it isn't. */
const dec = (s: string): number => {
  let v = 0;
  for (const ch of s.replace(/O/g, '0').replace(/[IL]/g, '1')) {
    const d = ALPHABET.indexOf(ch);
    if (d < 0) return -1;
    v = v * 32 + d;
  }
  return v;
};

const check = (cls: ClassId, body: string): string => enc(fnv1a(`${cls}|${body}`) % 1024, 2);

/** The class's spells by share hash. */
const byHash = (cls: ClassId): Map<number, CardDef> => new Map(cardsFor(cls).map(c => [cardHash(c.id), c]));

export function encodeDeckCode(g: SpellDeck): string {
  const own = new Set(cardsFor(g.cls).map(c => c.id));
  const ids = Object.keys(g.deck).filter(id => own.has(id) && g.deck[id] > 0);
  let body = '';
  for (let n = 4; n >= 1; n--) {
    const group = ids.filter(id => Math.min(g.deck[id], 4) === n).map(id => enc(cardHash(id), 3)).sort();
    if (group.length) body += `${n}${enc(group.length, 1)}${group.join('')}`;
  }
  const name = cleanDeckName(g.name ?? '').trim().replace(/ /g, '_');
  return `${PREFIX}-${g.cls.toUpperCase()}-${body}${check(g.cls, body)}${name ? `-${name}` : ''}`;
}

/** Whether some pasted text holds a share code (so it is read as one, not as YAML). */
export const hasDeckCode = (text: string): boolean => new RegExp(`(^|\\s)${PREFIX}-`, 'i').test(text);

/**
 * Reads the first share code in `text` (a chat message around it is fine, and so is a code a chat app broke
 * over two lines) and checks it against the deck rules. Returns the deck, or what is wrong with the code.
 */
export function decodeDeckCode(text: string): { ok: true; spellDeck: SpellDeck } | { ok: false; error: string } {
  const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
  if (text.length > 20000) return fail('TOO MUCH TEXT FOR A SPELL DECK CODE');
  const words = text.trim().split(/\s+/), at = words.findIndex(w => w.toUpperCase().startsWith(`${PREFIX}-`));
  if (at < 0) return fail(`NO SPELL DECK CODE (THEY START ${PREFIX}-)`);
  let last: string | null = null;
  // a code broken over lines: join the next pieces until the check matches
  for (let n = 1; n <= 4 && at + n <= words.length; n++) {
    const r = readCode(words.slice(at, at + n).join(''));
    if (r.ok) return r;
    last ??= r.error;
  }
  return fail(last!);
}

function readCode(code: string): { ok: true; spellDeck: SpellDeck } | { ok: false; error: string } {
  const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
  if (code.length > MAX_LEN) return fail('THAT CODE IS TOO LONG FOR A SPELL DECK');
  const m = /^[^-]+-([A-Za-z]+)-([0-9A-Za-z]+)(?:-(.*))?$/.exec(code);
  if (!m) return fail('THAT CODE IS NOT COMPLETE');
  const cls = PLAYABLE.find(c => c === m[1].toLowerCase());
  if (!cls) return fail(`UNKNOWN CLASS ${m[1].toUpperCase()}`);
  const all = m[2].toUpperCase();
  if (all.length < 2) return fail('THAT CODE IS NOT COMPLETE');
  const body = all.slice(0, -2).replace(/O/g, '0').replace(/[IL]/g, '1');
  if (all.slice(-2).replace(/O/g, '0').replace(/[IL]/g, '1') !== check(cls, body)) return fail('THAT CODE HAS A TYPO OR IS CUT OFF');

  const pool = byHash(cls), deck: DeckCounts = {};
  for (let i = 0; i < body.length;) {
    const n = dec(body[i]), k = dec(body[i + 1] ?? '');
    if (n < 1 || n > 4 || k < 1 || i + 2 + k * 3 > body.length) return fail('THAT CODE IS NOT A SPELL DECK');
    for (let j = 0; j < k; j++) {
      const card = pool.get(dec(body.slice(i + 2 + j * 3, i + 5 + j * 3)));
      // a spell this version of the game doesn't have (a newer game's code, or a forged one)
      if (!card) return fail(`THAT CODE HAS A SPELL THIS ${CLASS_INFO[cls].name} DOES NOT KNOW. UPDATE THE GAME?`);
      if (deck[card.id]) return fail(`THAT CODE LISTS ${card.name.toUpperCase()} TWICE`);
      deck[card.id] = n;
      if (n > MAX_COPIES[card.rarity]) return fail(`${card.name.toUpperCase()}: MAX ${MAX_COPIES[card.rarity]} COPIES (HAS ${n})`);
    }
    i += 2 + k * 3;
  }
  const why = deckRuleBroken(deck);
  if (why) return fail(why);
  const name = cleanDeckName((m[3] ?? '').replace(/_/g, ' ')).trim();
  return { ok: true, spellDeck: { cls, name: name || undefined, deck } };
}
