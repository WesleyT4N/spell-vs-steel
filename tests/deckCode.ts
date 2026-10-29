// Spell deck share codes: every class's spells hash apart, every ready-made deck round-trips, and bad or
// forged codes are refused with a reason. Usage: npx tsx tests/deckCode.ts
import { cardHash, decodeDeckCode, encodeDeckCode, hasDeckCode } from '../src/game/deckCode';
import { importYaml } from '../src/game/deckYaml';
import { cardsFor } from '../src/game/cards';
import { PLAYABLE } from '../src/game/classes';
import { presetsFor } from '../src/game/deck';

let failed = 0;
function check(name: string, ok: boolean, detail = ''): void {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok || !detail ? '' : `: ${detail}`}`);
  if (!ok) failed++;
}
const same = (a: Record<string, number>, b: Record<string, number>): boolean =>
  JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());
const refused = (code: string, want: RegExp): void => {
  const r = decodeDeckCode(code);
  check(`refuses ${code.slice(0, 40)}`, !r.ok && want.test(r.error), r.ok ? 'accepted' : r.error);
};

for (const cls of PLAYABLE) {
  const seen = new Map<number, string>();
  const clash = cardsFor(cls).map(c => { const h = cardHash(c.id), o = seen.get(h); seen.set(h, c.id); return o ? `${o} / ${c.id}` : ''; }).filter(Boolean);
  check(`${cls}: no two spells share a hash`, !clash.length, clash.join(', '));
  for (const p of presetsFor(cls)) {
    const code = encodeDeckCode({ cls, name: p.name, deck: p.cards });
    const r = decodeDeckCode(code);
    check(`${cls} ${p.id}: round-trips (${code.length} chars)`, r.ok && r.spellDeck.cls === cls && same(r.spellDeck.deck, p.cards) && r.spellDeck.name === p.name.toUpperCase(), r.ok ? '' : r.error);
  }
}

const mage = presetsFor('mage')[0], code = encodeDeckCode({ cls: 'mage', name: 'Fire & Ice-2', deck: mage.cards });
check('code is upper case and has no spaces', code === code.toUpperCase() && !/\s/.test(code), code);
check('name keeps font characters, spaces as _', code.endsWith('-FIRE_ICE-2'), code);
check('lower case reads', decodeDeckCode(code.toLowerCase()).ok);
check('inside a chat message', decodeDeckCode(`try my deck: ${code} it's great`).ok);
const cut = code.indexOf('-', 10) - 7;
check('broken over two lines', decodeDeckCode(`${code.slice(0, cut)}\n${code.slice(cut)}`).ok);
check('no name is fine', (r => r.ok && r.spellDeck.name === undefined)(decodeDeckCode(encodeDeckCode({ cls: 'mage', deck: mage.cards }))));
check('hasDeckCode', hasDeckCode(`x ${code}`) && !hasDeckCode('class: mage\nspells:\n  fireball: 2'));
check('empty deck round-trips', (r => r.ok && !Object.keys(r.spellDeck.deck).length)(decodeDeckCode(encodeDeckCode({ cls: 'rogue', deck: {} }))));
// a mistyped O for 0 still reads
const zero = code.replace(/0/, 'O');
check('O reads as 0', zero === code || decodeDeckCode(zero).ok);

// broken, forged and rule-breaking codes
const body = code.split('-')[2];
refused('SVS1-MAGE', /NOT COMPLETE/);
refused(`SVS1-PALADIN-${body}`, /UNKNOWN CLASS/);
refused(`SVS1-MAGE-${body.slice(0, -1)}`, /NOT COMPLETE|TYPO/);
refused(`SVS1-MAGE-${body.slice(0, 3) === 'ZZZ' ? 'YYY' : 'ZZZ'}${body.slice(3)}`, /TYPO/);
refused(`SVS1-WARRIOR-${body}`, /TYPO/);
refused('hello there', /NO SPELL DECK CODE/);
refused(`SVS1-MAGE-${'A'.repeat(300)}`, /TOO LONG/);
// codes built with a valid check but against the rules: too many copies, two Mythics, a spell the class lacks
const forge = (cls: 'mage', deck: Record<string, number>): string => encodeDeckCode({ cls, deck });
const mythics = cardsFor('mage').filter(c => c.rarity === 'mythic').map(c => c.id);
refused(forge('mage', { [mythics[0]]: 1, [mythics[1]]: 1 }), /MYTHIC/);
const leg = cardsFor('mage').find(c => c.rarity === 'legendary')!;
refused(forge('mage', { [leg.id]: 2 }), /MAX 1 COPIES/);
const commons = cardsFor('mage').filter(c => c.rarity === 'common');
refused(forge('mage', Object.fromEntries(commons.slice(0, 8).map(c => [c.id, 4]))), /TOO MANY SPELLS/);
// a warrior spell in a mage code is simply dropped when encoding, and a stray __proto__ never gets in
check('other class spells are left out', !(r => r.ok && Object.keys(r.spellDeck.deck).includes('step_slash'))(decodeDeckCode(forge('mage', { step_slash: 2, __proto__: 1 } as Record<string, number>))));
// YAML still imports, sharing the rule checks
check('YAML import still works', importYaml('class: mage\nspells:\n  fireball: 2').ok);
check('YAML refuses __proto__', !importYaml('class: mage\nspells:\n  __proto__: 2').ok);

console.log(failed ? `\n${failed} FAILED` : '\nall deck code checks passed');
process.exit(failed ? 1 : 0);
