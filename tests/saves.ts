// The save module: old localStorage keys carry over, files round-trip, damaged or newer saves are handled,
// and the replay caps hold. Runs in Node on in-memory files. Usage: npx tsx tests/saves.ts
import {
  resetSaveForTests, getSave, setSave, flushSave, getReplays, setReplays, saveIsReadOnly, capReplays,
  SAVE_VERSION, RECENT_REPLAYS, MAX_KEPT_REPLAYS, type Legacy, type StoredReplay,
} from '../src/engine/save';
import { customDecks, createCustom, saveCustom, renameCustom, cloneCustom, deleteCustom, MAX_CUSTOM_DECKS, DECK_NAME_MAX } from '../src/game/deck';
import { loadMatch, sideDeck, deckLabel } from '../src/game/match';
import { loadRecords } from '../src/game/arcade';

let failed = 0;
function check(name: string, ok: boolean, detail = ''): void {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok || !detail ? '' : `: ${detail}`}`);
  if (!ok) failed++;
}
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

function legacyStore(init: Record<string, string>): Legacy & { map: Map<string, string> } {
  const map = new Map(Object.entries(init));
  return {
    map,
    get: k => map.get(k) ?? null,
    set: (k, v) => { map.set(k, v); },
    keys: () => [...map.keys()],
    remove: k => { map.delete(k); },
  };
}
const rep = (i: number, keep = false): StoredReplay & { rounds: unknown[] } => ({ id: `r${i}`, at: 1000 + i, keep, rounds: [] });
const settle = async (): Promise<void> => { await flushSave(); await new Promise(r => setTimeout(r, 0)); await flushSave(); };

async function main(): Promise<void> {
  // ---- legacy import: every old key lands in the new save, then the old keys go ----
  const oldReplays = [...Array.from({ length: 25 }, (_, i) => rep(i)), rep(90, true)];
  const legacy = legacyStore({
    'svs:keys': JSON.stringify({ up: 'KeyI', attack: 'KeyJ' }),
    'svs:p2keys': JSON.stringify({ up: 'ArrowUp' }),
    'svs:audio': JSON.stringify({ master: 3, musicOn: false }),
    'svs:muted': '1',
    'svs:deck:warrior': JSON.stringify({ step_slash: 4, 'not-a-card': 2 }),
    'svs:match': JSON.stringify({ p1: 'rogue', bestOf: 5 }),
    'svs:training': JSON.stringify({ act: 'dodge' }),
    'svs:tutorial': '1',
    'svs:arcade': JSON.stringify({ mage: { time: 321, continues: 1 } }),
    'svs:replays': JSON.stringify(oldReplays),
    'svs:rating': JSON.stringify({ elo: 1234 }),
    'svs:lab:script': 'run 10',
    'svs:touch': JSON.stringify({ size: 'L', left: true }),
    'unrelated': 'keep me',
  });
  const files = resetSaveForTests({}, legacy).files;
  check('keys carried over', same(getSave('keys'), { up: 'KeyI', attack: 'KeyJ' }));
  check('player 2 keys carried over', getSave('p2keys').up === 'ArrowUp');
  check('audio carried over', getSave('audio').master === 3 && getSave('audio').musicOn === false && getSave('muted'));
  check('tutorial flag carried over', getSave('tutorialDone'));
  check('training carried over', getSave('training')?.act === 'dodge');
  check('rating + lab carried over', getSave('rating')?.elo === 1234 && getSave('labScript') === 'run 10');
  check('arcade best carried over', loadRecords().mage?.time === 321);
  check('touch settings carried over', getSave('touch')?.size === 'L' && getSave('touch')?.left === true);
  check('match carried over', loadMatch().p1 === 'rogue' && loadMatch().bestOf === 5);
  const deck = customDecks('warrior')[0];
  check('deck carried over, unknown cards dropped', deck?.cards.step_slash === 4 && !('not-a-card' in deck.cards) && deck.name === 'MY SPELL DECK' && Object.keys(getSave('decks').warrior[0].cards).length === 2);
  const reps = getReplays();
  check('replays carried over within the cap', reps.length === RECENT_REPLAYS + 1 && reps.some(r => r.id === 'r90') && reps[0].at >= reps[1].at);
  await settle();
  check('save.json written with the version', JSON.parse(files['save.json']).v === SAVE_VERSION);
  check('replays.json written', JSON.parse(files['replays.json']).data.list.length === RECENT_REPLAYS + 1);
  check('old keys removed, others left alone', [...legacy.map.keys()].join() === 'unrelated', [...legacy.map.keys()].join());

  // ---- round trip: a fresh boot on the same files sees the same save ----
  setSave('tutorialDone', false);
  createCustom('mage', 'BURN', { 'm-fireball': 2 });
  await settle();
  resetSaveForTests({ ...files }, legacyStore({ 'svs:tutorial': '1' }));
  check('round trip', getSave('tutorialDone') === false && getSave('decks').mage[0].cards['m-fireball'] === 2 && getSave('keys').up === 'KeyI');
  check('legacy keys ignored once a save exists', getSave('tutorialDone') === false);

  // ---- touch settings saved under their own key after save.json existed: taken in late, then dropped ----
  const late = legacyStore({ 'svs:touch': JSON.stringify({ buzz: false }) });
  const lf = resetSaveForTests({ 'save.json': '{"game":"spell-vs-steel","v":1,"data":{"tutorialDone":true}}' }, late).files;
  check('late touch key taken in', getSave('touch')?.buzz === false && getSave('tutorialDone'));
  await settle();
  check('late touch key saved and dropped', JSON.parse(lf['save.json']).data.touch?.buzz === false && !late.map.has('svs:touch'));
  resetSaveForTests({ ...lf }, legacyStore({ 'svs:touch': JSON.stringify({ size: 'S' }) }));
  check('save wins over a stale touch key', getSave('touch')?.buzz === false && getSave('touch')?.size === undefined);

  // ---- damaged save: start fresh, keep the bad file aside ----
  const bad = resetSaveForTests({ 'save.json': '{"game":"spell-vs-steel","v":1,"data":' }).files;
  check('damaged save loads blank', getSave('tutorialDone') === false && same(getSave('keys'), {}));
  await settle();
  check('damaged save kept aside', bad['save.json.bad']?.startsWith('{"game"') === true && JSON.parse(bad['save.json']).v === SAVE_VERSION);

  // ---- hand-edited save can't reach Object.prototype or break types ----
  resetSaveForTests({ 'save.json': '{"game":"spell-vs-steel","v":1,"data":{"__proto__":{"polluted":1},"keys":{"up":5,"down":"KeyS"},"decks":{"__proto__":{"x":1},"rogue":{"r-stab":-1,"r-gouge":2}},"muted":"yes"}}' });
  check('no prototype pollution', ({} as Record<string, unknown>).polluted === undefined && Object.getPrototypeOf(getSave('decks')) === Object.prototype);
  check('wrong types dropped', same(getSave('keys'), { down: 'KeyS' }) && same(getSave('decks').rogue[0].cards, { 'r-gouge': 2 }) && getSave('muted') === false);
  resetSaveForTests({ 'save.json': '{"game":"spell-vs-steel","v":2,"data":{"decks":{"mage":[{"id":"d1","name":"A","cards":{}},{"id":"d1","name":"B","cards":{}},{"name":"C"},5],"rogue":{"r-stab":2}}}}' });
  check('bad deck entries dropped', same(getSave('decks').mage.map(d => d.name), ['A']) && !('rogue' in getSave('decks')));

  // ---- version 1 -> 2: the one custom deck per class becomes the first of a list, and the match setup follows ----
  const v1 = { decks: { warrior: { step_slash: 4, guard: 2 }, mage: {} }, match: { p1: 'warrior', p1Deck: 'custom', cpu: 'mage', cpuDeck: 'custom' } };
  resetSaveForTests({ 'save.json': JSON.stringify({ game: 'spell-vs-steel', v: 1, data: v1 }) });
  check('v1 deck migrated', same(getSave('decks').warrior, [{ id: 'd1', name: 'MY SPELL DECK', cards: { step_slash: 4, guard: 2 } }]) && !('mage' in getSave('decks')));
  check('v1 match deck migrated', loadMatch().p1Deck === 'custom:d1' && loadMatch().cpuDeck === 'starter');
  check('migrated deck label', deckLabel('warrior', 'custom:d1') === 'MY SPELL DECK');

  // ---- many decks per class: create, rename, clone, delete ----
  resetSaveForTests();
  const a = createCustom('rogue', 'my phantom', {})!, b = createCustom('rogue', 'MY PHANTOM', { shiv: 2 })!;
  check('names cleaned and kept apart', a.name === 'MY PHANTOM' && b.name === 'MY PHANTOM 2' && a.id !== b.id);
  saveCustom('rogue', b.id, { shiv: 3 });
  check('save one deck', customDecks('rogue')[1].cards.shiv === 3 && same(customDecks('rogue')[0].cards, {}));
  check('rename', renameCustom('rogue', a.id, 'night~ blade!') === 'NIGHT BLADE!' && customDecks('rogue')[0].name === 'NIGHT BLADE!');
  check('blank rename refused', renameCustom('rogue', a.id, '  ~ ') === null && customDecks('rogue')[0].name === 'NIGHT BLADE!');
  check('long names cut', renameCustom('rogue', a.id, 'X'.repeat(40))!.length === DECK_NAME_MAX);
  const c = cloneCustom('rogue', a.id)!;
  check('clone sits after its original', same(customDecks('rogue').map(d => d.id), [a.id, c.id, b.id]) && c.name.endsWith(' COPY') && c.name.length <= DECK_NAME_MAX);
  deleteCustom('rogue', a.id);
  check('delete', same(customDecks('rogue').map(d => d.id), [c.id, b.id]));
  const fresh = createCustom('rogue', 'X', {})!;
  check('ids never reused', ![a.id, b.id, c.id].includes(fresh.id));
  while (customDecks('rogue').length < MAX_CUSTOM_DECKS) createCustom('rogue', 'FILL', {});
  check('deck limit', createCustom('rogue', 'ONE MORE', {}) === null && cloneCustom('rogue', b.id) === null);
  const m = { ...loadMatch(), p1: 'rogue' as const, p1Deck: `custom:${b.id}` };
  check('unready deck fights as the starter', sideDeck(m, 0).length === 30);
  check('gone deck fights as the starter', sideDeck({ ...m, p1Deck: 'custom:nope' }, 0).length === 30);

  // ---- a save from a newer build is read but never overwritten ----
  const newer = '{"game":"spell-vs-steel","v":999,"data":{"tutorialDone":true}}';
  const nf = resetSaveForTests({ 'save.json': newer }).files;
  check('newer save readable', getSave('tutorialDone') && saveIsReadOnly());
  setSave('tutorialDone', false);
  await settle();
  check('newer save untouched', nf['save.json'] === newer && !('replays.json' in nf));

  // ---- replay caps: 20 recent + 20 kept, and the size budget ----
  resetSaveForTests();
  const many = [...Array.from({ length: 30 }, (_, i) => rep(i)), ...Array.from({ length: 25 }, (_, i) => rep(100 + i, true))];
  const kept = setReplays(many);
  check('20 recent + 20 kept', kept.filter(r => !r.keep).length === RECENT_REPLAYS && kept.filter(r => r.keep).length === MAX_KEPT_REPLAYS);
  check('newest recent kept', kept.filter(r => !r.keep).every(r => r.at >= 1010));
  const big = Array.from({ length: 10 }, (_, i) => ({ ...rep(i), pad: 'x'.repeat(1000) }));
  const fit = capReplays(big, 5000);
  check('size budget drops the oldest unkept', fit.length === 4 && fit[fit.length - 1].id === 'r6', fit.map(r => r.id).join());

  console.log(failed ? `\n${failed} save check(s) failed` : '\nall save checks passed');
  process.exit(failed ? 1 : 0);
}
void main();
