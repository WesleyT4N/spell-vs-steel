// Every screen of the game, opened directly and set up the way the game builds it: the screen tests shoot each one
// at every screen shape (tests/screens/), and the Art Lab's Screens tab opens them. Online screens get made-up
// rivals over in-memory links; some entries write decks or match settings, so the Art Lab pauses saves first.
// Add a screen here when you add one to the game.
import { useStage } from '../game/battleView';
import { setScene, getScene } from '../scenes/scene';
import { endFrame, pollInput } from '../engine/input';
import { TitleScene } from '../scenes/title';
import { OptionsScene } from '../scenes/options';
import { ControlsScene } from '../scenes/controls';
import { CharSelectScene } from '../scenes/select';
import { StageSelectScene } from '../scenes/stageSelect';
import { DeckSelectScene } from '../scenes/deckSelect';
import { DeckBuilderScene } from '../scenes/deckbuilder';
import { OnlineScene } from '../scenes/online';
import { BattleScene } from '../scenes/battle';
import { TrainingScene } from '../scenes/training';
import { TutorialScene } from '../scenes/tutorial';
import { DevMenuScene } from '../scenes/devMenu';
import { EncyclopediaScene } from '../scenes/encyclopedia';
import { LabScene } from '../scenes/lab';
import { ArtLabScene } from '../scenes/artLab';
import { ArcadeLadderScene, ArcadeClearScene } from '../scenes/arcade';
import { ExpeditionMapScene, ExpeditionBattleScene, RewardScene, RestScene, ShopScene, DeckScene, RunOverScene } from '../scenes/expedition';
import { newRun, addRelic, addSpell, makeFight, nextAct, type ExpeditionRun } from '../game/expedition';
import { MOBS } from '../game/mobs';
import { buildLadder, type ArcadeRun } from '../game/arcade';
import { loadMatch, saveMatch, type MatchConfig } from '../game/match';
import { encodeDeckCode } from '../game/deckCode';
import { PLAYABLE } from '../game/classes';
import { SKINS, type ClassId } from '../art/sprites';
import { LobbyScene } from '../scenes/lobby';
import { RankedScene } from '../scenes/ranked';
import { ReplaysScene, ReplayScene } from '../scenes/replays';
import { ProfileScene } from '../scenes/profile';
import { ModsScene } from '../scenes/mods';
import { MODS, setModOn } from '../mods';
import { Battle, type Intent } from '../game/battle';
import { Cpu } from '../game/ai';
import { TapeWriter } from '../game/replay';
import { TournamentScene } from '../scenes/tournament';
import { tournaments, type Bracket } from '../net/tournament';
import { lobbyId, type Lobby, type Here } from '../net/lobby';
import type { Search } from '../net/matchmaking';
import type { RatingStore } from '../net/rating';
import type { Replay } from '../game/replay';
import { NetSession } from '../net/session';
import type { Transport } from '../net/transport';
import type { Packet } from '../net/protocol';
import { OnlineBattleScene } from '../scenes/onlineBattle';
import { startRanked } from '../net/rating';
import { roundRecord } from '../game/stats';
import { presetDeck, presetsFor, toList, createCustom, customChoice } from '../game/deck';

const STEP = 1 / 60;
/** Run the current screen's update for `seconds` of game time without drawing (much faster than real frames). */
export function run(seconds: number, until?: () => boolean): void {
  for (let t = 0; t < seconds && !until?.(); t += STEP) { getScene()?.update(STEP); endFrame(); }
}
const title = (): void => setScene(new TitleScene());
const match = (over: Partial<MatchConfig> = {}): MatchConfig => ({ ...loadMatch(), ...over });
const battle = (): BattleScene => getScene() as BattleScene;

/** An Expedition run as a mage, the same map every time; `floors` nodes walked up the middle lane. */
function expRun(floors = 0, act = 0): ExpeditionRun {
  const r = newRun('mage', SKINS.mage[0].id, 4242);
  for (let a = 0; a < act; a++) nextAct(r);
  for (let f = 0; f < floors; f++) {
    const n = r.map.find(x => x.floor === f && x.lane === 1)!;
    r.at = n.id; r.path.push(n.id); r.stats.floors = f + 1; r.stats.fights++;
  }
  if (floors > 2) { addRelic(r, 'whetstone'); addRelic(r, 'sapflask'); addSpell(r, 'flamestrike'); r.gold = 137; r.hp = Math.round(r.maxHp * 0.62); }
  return r;
}
/** An Expedition fight against `pack`, the Draw screen closed and a few seconds in. */
function expFight(pack: string[], secs = 3, act = 0): void {
  const r = expRun(3, act), node = { ...r.map[r.at], kind: (MOBS[pack[0]].rank === 'boss' ? 'boss' : 'fight') as 'fight', pack };
  setScene(new ExpeditionBattleScene(r, node, makeFight(r, pack, 99)));
  run(0.5); battle().b.endCustom([[0, 1], []]); run(secs);
}

/** An arcade run as a warrior, `at` fights won, with the same ladder every time. */
function arcadeRun(at: number): ArcadeRun {
  let seed = 7;
  const m = match({ p1: 'warrior', sides: ['player', 'cpu'], bestOf: 3 });
  const ladder = buildLadder(m, () => (seed = (seed * 16807) % 2147483647) / 2147483647);
  const fights = ladder.slice(0, at).map((r, i) => ({
    cls: r.cls, skin: r.skin, difficulty: r.difficulty, boss: r.boss, rounds: [2, i % 2] as [number, number],
    secs: 70 + i * 23, dealt: 9000 + i * 1100, taken: 3000 + i * 900, tries: i === 3 ? 2 : 1, best: null,
  }));
  return { m, ladder, at: Math.min(at, ladder.length - 1), continues: 1, time: 512, tries: 1, fights };
}

/** Telegraphs from both sides that stay up for a while: left side hits column 4 and locks on (5, 0); right side hits column 1 and lobs at (0, 2). */
function warns(): void {
  const b = battle().b;
  b.warn(0, [[4, 0], [4, 1], [4, 2]], 3);
  b.warn(0, [[5, 0]], 3, undefined, 'reticle');
  b.warn(1, [[1, 0], [1, 1], [1, 2]], 3);
  b.warn(1, [[0, 2]], 3, undefined, 'shadow');
}

/** A CPU vs CPU set to watch, so the fight plays itself. */
function watch(over: Partial<MatchConfig> = {}): BattleScene {
  const s = new BattleScene(match({ p1: 'warrior', cpu: 'mage', bestOf: 3, ...over }), [0, 0], undefined, [], ['cpu', 'cpu']);
  setScene(s);
  return s;
}

/** Plug in a standard-mapping pad and tap A, so the game sees a pad in use. */
function fakePad(): void {
  const buttons = Array.from({ length: 17 }, (_, i) => ({ pressed: i === 0, value: i === 0 ? 1 : 0, touched: false }));
  const pad = { index: 0, id: 'test pad', connected: true, mapping: 'standard', buttons, axes: [0, 0, 0, 0], timestamp: 0 };
  Object.defineProperty(navigator, 'getGamepads', { value: () => [pad, null, null, null], configurable: true });
  pollInput();
  buttons[0] = { pressed: false, value: 0, touched: false };
  pollInput();
  endFrame();
}

// ---- online screens with made-up rivals (the real ones need a live room) ----
const AT = Date.UTC(2026, 9, 26, 21, 14);
const here = (id: string, name: string, cls: ClassId, rating: number, bestOf: 1 | 3 | 5 = 3): Here =>
  ({ e: { v: 1, id, cls, skin: '', rating, bestOf, chat: [], ch: null, acc: null, dec: null }, name, by: null } as unknown as Here);
const RIVALS = [here('a1', 'NIGHTOWL', 'rogue', 1342), here('b2', 'EMBERWITCH', 'mage', 1288, 1), here('c3', 'IRONSIDE', 'warrior', 1231), here('d4', 'QUIVER', 'ranger', 1190, 5), here('e5', 'DAWNLIGHT', 'priest', 1176)];
/** A lobby with five others in it and a short chat, without joining a real room. */
function fakeLobby(incoming = false): LobbyScene {
  const s = new LobbyScene();
  s.enter = () => {};
  const me = { v: 1, id: lobbyId(), cls: s.m.p1, skin: '', rating: 1250, bestOf: 3, chat: [], ch: { to: 'c3', n: 1 }, acc: null, dec: null };
  const log = [['NIGHTOWL', 'ANYONE UP FOR A BEST OF 3?'], ['YOU', 'SURE, SENDING A CHALLENGE'], ['EMBERWITCH', 'GG LAST ROUND, THAT FREEZE WAS MEAN']]
    .map(([name, text], i) => ({ from: name, name, text, mine: name === 'YOU', at: AT + i }));
  s.lobby = { me, myName: 'YOU', here: RIVALS, log, incoming: incoming ? [RIVALS[1]] : [], searching: 2, answer: null, meet: null, tick() {}, leave() {} } as unknown as Lobby;
  s.mode = 'lobby';
  return s;
}
/** A replay of a set between two classes, `wins` being who took each round. */
function fakeReplay(id: string, mode: Replay['mode'], a: ClassId, b: ClassId, wins: Array<0 | 1>, ago: number, keep = false): Replay {
  const specs = [{ cls: a, deck: [], name: a.toUpperCase() }, { cls: b, deck: [], name: b.toUpperCase() }];
  const rounds = wins.map((w, i) => ({ seed: i, specs, frames: [], events: [], n: 3600 + i * 1700, hash: 0, winner: w }));
  return { id, v: 0, at: AT - ago * 3600_000, mode, me: 0, bestOf: wins.length > 1 ? 3 : 1, stage: 'plains', rounds, keep } as unknown as Replay;
}
/** A real recorded round (CPU vs CPU, warrior against mage), `secs` of fighting long, to play back. */
function recordedReplay(secs = 40): Replay {
  const deck = (c: ClassId): string[] => toList(presetDeck(c, 'starter'));
  const b = new Battle({ cls: 'warrior', deck: deck('warrior'), name: 'YOU' }, { cls: 'mage', deck: deck('mage'), name: 'RIVAL' }, 1234);
  const w = new TapeWriter(b), cpus = [new Cpu('hard'), new Cpu('hard')];
  for (let f = 0; f < secs * 60 && b.phase !== 'over'; f++) {
    if (b.phase === 'custom') { const picks: [number[], number[]] = [cpus[0].pick(b, b.f[0]), cpus[1].pick(b, b.f[1])]; w.endCustom(picks); b.endCustom(picks); }
    if (b.canOpenCustom() && f % 900 === 899) { w.beginCustom(); b.beginCustom(); continue; }
    const ins: [Intent, Intent] = [cpus[0].intent(b, b.f[0], STEP), cpus[1].intent(b, b.f[1], STEP)];
    w.update(ins);
    b.update(STEP, ins);
  }
  return { id: 'rw', v: 0, at: AT, mode: 'cpu', me: 0, bestOf: 3, stage: 'plains', rounds: [w.finish()] } as unknown as Replay;
}
function fakeProfile(empty: boolean): ProfileScene {
  const s = new ProfileScene();
  s.enter = () => {};
  if (empty) {
    s.profile = { classes: {}, modes: {}, decks: {} };
    s.rating = { rating: 1000, games: 0, wins: 0, losses: 0 };
    s.arcade = {};
    s.replays = 0;
    return s;
  }
  s.profile = {
    classes: { warrior: { w: 21, l: 9 }, mage: { w: 7, l: 8 }, rogue: { w: 2, l: 4 }, priest: { w: 5, l: 1 } },
    modes: { cpu: { w: 14, l: 6 }, arcade: { w: 9, l: 3 }, online: { w: 4, l: 6 }, ranked: { w: 8, l: 7 } },
    decks: { 'warrior|starter': 18, 'warrior|custom': 9, 'mage|starter': 15 },
  };
  s.rating = { rating: 1284, games: 15, wins: 8, losses: 7 };
  s.arcade = { warrior: { time: 754, continues: 0 }, mage: { time: 1022, continues: 2 } };
  s.replays = 9;
  return s;
}
function fakeTournament(state: Bracket['state']): TournamentScene {
  const me = lobbyId();
  const b: Bracket = state === 'open'
    ? { v: 1, tid: 'tq', host: 'a1', size: 4, state, players: ['a1', 'b2'], won: [null, null, null] }
    : { v: 1, tid: 'tq', host: 'a1', size: 8, state, players: ['a1', me, 'b2', 'c3', 'd4', null, 'e5', 'f6'], won: [me, 'c3', 'd4', 'e5', null, null, null] };
  const t = tournaments as unknown as { all: () => Bracket[]; tid: string | null };
  t.all = () => [b];
  t.tid = state === 'open' ? null : 'tq';
  const s = new TournamentScene();
  s.enter = () => {};
  s.lobby = { here: RIVALS, tick() {}, leave() {} } as unknown as Lobby;
  s.mode = state === 'open' ? 'browse' : 'in';
  return s;
}

/**
 * An online match against a made-up rival over an in-memory link: the rival's side answers every packet at once,
 * so the session stays connected. `matched` false leaves the host alone in the room, waiting.
 */
function fakeNet(matched = true, as: 'host' | 'guest' = 'host'): NetSession {
  const hello = (cls: ClassId) => ({ cls, skin: SKINS[cls][0].id, deck: [] as string[] });
  const pipe = (): Transport & { peer?: Transport & { cb?: (p: Packet) => void }; cb?: (p: Packet) => void } => ({
    kind: 'local', cb: undefined, peer: undefined,
    send(p) { this.peer?.cb?.(JSON.parse(JSON.stringify(p)) as Packet); },
    onPacket(cb) { this.cb = cb; }, onClose() {}, close() {},
  });
  const a = pipe(), b = pipe();
  const host = new NetSession('host', 'KQZ7M', { ...hello('warrior'), deck: loadMatchDeck() }, a, 3);
  if (!matched) return host;
  a.peer = b; b.peer = a;
  const guest = new NetSession('guest', 'KQZ7M', { ...hello('mage'), deck: loadMatchDeck('mage') }, b, 3);
  // the rival answers each packet with its own
  // (or, playing as the guest, the host answers each of yours)
  if (as === 'guest') { const onA = a.cb!; a.cb = p => { onA(p); host.tick(); }; guest.tick(); return guest; }
  const onB = b.cb!;
  b.cb = p => { onB(p); guest.tick(); };
  host.tick();
  RIVAL_NET.set(host, guest);
  return host;
}
/** The rival's own session behind a fakeNet(), to answer for them. */
const RIVAL_NET = new WeakMap<NetSession, NetSession>();
/** An online best of 3 you just won 2-0, on its results screen; `rival` is what the rival picked there first. */
function onlineSetOver(rival: 'rematch' | 'change' | null = null): OnlineBattleScene {
  const net = fakeNet(), them = RIVAL_NET.get(net)!;
  const s = new OnlineBattleScene(net, [1, 0], 2);
  setScene(s);
  run(0.2);
  s.b.phase = 'over'; s.b.winner = 0; s.ended = true; s.score[0]++; s.rounds.push(roundRecord(s.b, s.stats));
  if (rival) { them.myReady = 3; if (rival === 'change') them.myRepick = 3; them.tick(); }
  run(0.5);
  return s;
}
const loadMatchDeck = (cls: ClassId = 'warrior'): string[] => toList(presetDeck(cls, 'starter'));

/** `n` spell decks of your own for a class (the second one half built), the first picked for your next fight. */
function myDecks(cls: ClassId = 'warrior', n = 3): string[] {
  const p = presetsFor(cls);
  const ids = Array.from({ length: n }, (_, i) => {
    const src = p[i % p.length];
    const cards = i === 1 ? Object.fromEntries(Object.entries(src.cards).slice(0, 6)) : src.cards;
    return createCustom(cls, i === 1 ? 'WORK IN PROGRESS' : `MY ${src.name}`, cards)!.id;
  });
  saveMatch(match({ p1: cls, p1Deck: customChoice(ids[0]) }));
  return ids;
}
type Builder = { listSel: number; onActs: boolean; actSel: number; act(a: string): void; choosePick(id: string): void; naming: { entry: { text: string } } | null };
const builder = (): Builder => getScene() as unknown as Builder;

/** Opens each screen by name. */
export const screens: Record<string, () => void> = {
  'title': title,
  // the duel mid-flight: one shot of each kind crossing the menu (and the wind-up glow before the mage's)
  ...Object.fromEntries((['mage', 'warrior', 'rogue', 'ranger'] as const).map((c, i) => [`title-shot-${c}`, () => {
    const t = new TitleScene();
    t.intro = 99; t.fighters = [c, c === 'mage' ? 'priest' : 'mage']; t.swapSide = 0; t.swapT = 1.6 + i * 0.05;
    setScene(t);
  }])),
  'title-hit': () => { const t = new TitleScene(); t.intro = 99; t.swapSide = 0; t.swapT = 2.0; setScene(t); run(0.12); },
  'title-poof': () => { const t = new TitleScene(); t.intro = 99; t.swapSide = 1; t.swapT = 0.15; setScene(t); },
  'title-windup': () => { const t = new TitleScene(); t.intro = 99; t.swapSide = 0; t.swapT = 1.25; setScene(t); },
  'options': () => setScene(new OptionsScene(title)),
  // the phone layout's second tab: pad size, left-handed and vibration
  'options-touch': () => { const o = new OptionsScene(title); o.tab = 1; setScene(o); },
  'key-mapping': () => setScene(new ControlsScene(title)),
  // a pad plugged in and just pressed: the PAD column is live and hints name pad buttons
  'key-mapping-pad': () => { fakePad(); setScene(new ControlsScene(title)); run(0.1); },
  'select-fighter': () => setScene(new CharSelectScene()),
  'select-skin': () => setScene(new CharSelectScene(undefined, 1)),
  'select-rival': () => setScene(new CharSelectScene(undefined, 2)),
  'select-rival-skin': () => setScene(new CharSelectScene(undefined, 3)),
  // the spell deck select: both sides in versus, the cursor on the CPU's list, on the bottom row; arcade and training
  'deck-select': () => setScene(new DeckSelectScene()),
  'deck-select-cpu': () => { const d = new DeckSelectScene(); d.side = 1; setScene(d); },
  'deck-select-options': () => { const d = new DeckSelectScene(); d.low = true; d.chip = 1; setScene(d); },
  'deck-select-arcade': () => setScene(new DeckSelectScene('arcade')),
  'deck-select-training': () => setScene(new DeckSelectScene('training')),
  // three decks of your own in the list, one of them picked; then eight, so the list scrolls to the cursor near the end
  'deck-select-mine': () => { myDecks(); setScene(new DeckSelectScene()); },
  'deck-select-many': () => {
    myDecks('warrior', 8);
    const d = new DeckSelectScene();
    d.row[0] = 10;
    (d as unknown as { follow: boolean[] }).follow[0] = true;
    setScene(d);
  },
  'select-training': () => setScene(new CharSelectScene(undefined, 0, 'training')),
  'select-expedition': () => setScene(new CharSelectScene(undefined, 0, 'expedition')),
  'select-tutorial': () => setScene(new CharSelectScene(undefined, 0, 'tutorial')),
  'stage-select': () => setScene(new StageSelectScene()),
  'online-lobby': () => setScene(new OnlineScene()),
  // typing a room code to join, three letters in
  'online-code': () => { const o = new OnlineScene(); o.mode = 'code'; o.code = 'KQZ'; setScene(o); },
  // a room opened and its code up, waiting for a friend to join
  'online-room': () => { const o = new OnlineScene(); o.enter = () => {}; o.kind = 'peer'; o.code = 'KQZ7M'; o.net = fakeNet(false); o.mode = 'room'; setScene(o); },
  // picking fighters against a rival who is still choosing
  'online-select': () => setScene(new CharSelectScene(fakeNet())),
  'online-stage': () => setScene(new StageSelectScene(fakeNet())),
  // the Draw screen once your picks are locked in and the rival is still choosing
  // online as the guest, on the right: your side and your telegraphs are still blue
  'online-battle-guest': () => { const s = new OnlineBattleScene(fakeNet(true, 'guest'), [0, 0], 1); setScene(s); run(0.3); s.b.endCustom([[], []]); run(0.3); warns(); run(0.5); },
  'online-draw-locked': () => { const s = new OnlineBattleScene(fakeNet(), [0, 0], 1); setScene(s); run(0.3); s.picks = [0]; (s as unknown as { confirmCustom(): void }).confirmCustom(); run(0.2); },
  // the end of a ranked round: the results carry the ranked note
  'online-results-ranked': () => {
    const net = fakeNet();
    startRanked(net, { rating: 1250, games: 19, wins: 12, losses: 7 }, 1288);
    const s = new OnlineBattleScene(net, [0, 0], 1);
    setScene(s);
    run(0.2);
    s.b.phase = 'over'; s.b.winner = 0; s.ended = true; s.score[0]++; s.rounds.push(roundRecord(s.b, s.stats));
    run(0.5);
  },
  // a set decided: the rival asked for a rematch first; you asked to change fighters and wait on the rival;
  // and both agreed to change fighters, so it's back to the character select in the same room
  'online-rematch': () => onlineSetOver('rematch'),
  'online-rematch-waiting': () => { const s = onlineSetOver(); s.waitingNext = true; s.net.myRepick = s.net.myReady = 3; s.resultSel = 1; run(0.2); },
  'online-rematch-repick': () => { const s = onlineSetOver('change'); s.waitingNext = true; s.net.myReady = 3; run(0.3); },
  // a ready-made deck's spells open over the start-from picker (on phones in portrait; wider screens list it on hover)
  'deck-builder-peek': () => { const d = new DeckBuilderScene('ranger', title); (d as unknown as { peek: number; pickSel: number }).peek = 1; (d as unknown as { pickSel: number }).pickSel = 1; setScene(d); },
  ...Object.fromEntries(PLAYABLE.map(c => [`deck-builder-${c}`, () => setScene(new DeckBuilderScene(c, title))])),
  // your decks: the list; one opened (its actions on wider screens, its sheet on phones); DELETE pressed once
  'deck-builder-list': () => { myDecks(); setScene(new DeckBuilderScene('warrior', title)); },
  'deck-builder-actions': () => { myDecks(); setScene(new DeckBuilderScene('warrior', title)); Object.assign(builder(), { listSel: 1, onActs: true, actSel: 2 }); },
  'deck-builder-delete': () => { myDecks(); setScene(new DeckBuilderScene('warrior', title)); Object.assign(builder(), { onActs: true, actSel: 3 }); builder().act('DELETE'); },
  // renaming: typing on a keyboard, and picking letters on a pad
  'deck-builder-rename': () => { myDecks(); setScene(new DeckBuilderScene('warrior', title)); builder().act('RENAME'); builder().naming!.entry.text = 'EARTHQUAKE'; },
  'deck-builder-rename-pad': () => { fakePad(); myDecks(); setScene(new DeckBuilderScene('warrior', title)); builder().act('RENAME'); run(0.1); },
  // a new deck asks for its name first (a ready-made start, on a keyboard and on a pad), and so does CLONE
  'deck-builder-new-name': () => { setScene(new DeckBuilderScene('priest', title)); builder().choosePick('starter'); },
  'deck-builder-new-name-pad': () => { fakePad(); setScene(new DeckBuilderScene('priest', title)); run(0.1); builder().choosePick('empty'); run(0.1); },
  'deck-builder-clone-name': () => { myDecks(); setScene(new DeckBuilderScene('warrior', title)); builder().act('CLONE'); },
  // SHARE on one of your decks: the code to copy and the import box (a pad gets its button hints); the import-only
  // panel from the start-from picker, with a refused code's reason showing
  'deck-builder-share': () => { myDecks(); setScene(new DeckBuilderScene('warrior', title)); builder().act('SHARE'); },
  'deck-builder-share-pad': () => { fakePad(); myDecks(); setScene(new DeckBuilderScene('warrior', title)); run(0.1); builder().act('SHARE'); },
  'deck-builder-import': () => {
    setScene(new DeckBuilderScene('mage', title));
    const d = builder(); d.choosePick('import');
    const box = document.querySelector<HTMLTextAreaElement>('.svs-share textarea')!;
    box.value = 'SVS1-MAGE-4ZZZZ12';
    document.querySelectorAll<HTMLButtonElement>('.svs-share button').forEach(b => { if (b.textContent === 'Import') b.click(); });
  },
  // a good code asks for the new deck's name (its own name filled in) before it is saved
  'deck-builder-import-name': () => {
    setScene(new DeckBuilderScene('mage', title));
    builder().choosePick('import');
    const box = document.querySelector<HTMLTextAreaElement>('.svs-share textarea')!;
    box.value = encodeDeckCode({ cls: 'rogue', name: 'KNIFE PARTY', deck: presetsFor('rogue')[0].cards });
    document.querySelectorAll<HTMLButtonElement>('.svs-share button').forEach(b => { if (b.textContent === 'Import') b.click(); });
  },
  // editing one of your decks (opened from the deck select's EDIT)
  'deck-builder-edit': () => { const [id] = myDecks('mage'); setScene(new DeckBuilderScene('mage', title, id)); },
  // the opening Draw screen, with you on the left against the CPU
  'battle-draw': () => { setScene(new BattleScene(match({ p1: 'warrior', cpu: 'mage' }))); run(0.5); },
  // Arcane Power picked first: the rest of the hand shows its lowered costs in the modifier look
  'battle-draw-modified': () => {
    setScene(new BattleScene(match({ p1: 'mage', cpu: 'warrior' }))); run(0.2);
    const s = battle(), b = s.b;
    b.offer[0] = ['arcane_power', 'fireball', 'flamestrike', 'arcane_missiles', 'deep_freeze'];
    b.f[0].resMax = 4; b.f[0].res = 4;
    (s as unknown as { picks: number[] }).picks = [0, 1];
    s.cursor = 2; run(0.5);
  },
  // the same picks with the cursor on FIGHT: the cast order lists the lowered costs
  'battle-draw-modified-order': () => {
    setScene(new BattleScene(match({ p1: 'mage', cpu: 'warrior' }))); run(0.2);
    const s = battle(), b = s.b;
    b.offer[0] = ['arcane_power', 'fireball', 'flamestrike', 'arcane_missiles', 'deep_freeze'];
    b.f[0].resMax = 5; b.f[0].res = 5;
    (s as unknown as { picks: number[] }).picks = [0, 3, 1];
    s.cursor = 5; run(0.5);
  },
  // mid-fight with Arcane Power up: the next-spell plate and the chip over your head show the lowered cost
  'battle-player-modified': () => {
    setScene(new BattleScene(match({ p1: 'mage', cpu: 'warrior' }))); run(0.5);
    const b = battle().b; b.endCustom([[], []]); run(1);
    const f = b.f[0]; f.powerLeft = 2; f.queue = ['flamestrike', 'fireball']; f.resMax = 4; f.res = 4; run(0.2);
  },
  // Arcane Blast picked: the next damaging card in the hand shows +25% damage, with the cursor on it
  'battle-draw-empowered': () => {
    setScene(new BattleScene(match({ p1: 'mage', cpu: 'warrior' }))); run(0.2);
    const s = battle(), b = s.b;
    b.offer[0] = ['arcane_blast', 'ice_wall', 'meteor', 'deep_freeze', 'arcane_missiles'];
    b.f[0].resMax = 5; b.f[0].res = 5;
    (s as unknown as { picks: number[] }).picks = [0, 1];
    s.cursor = 2; run(0.5);
  },
  // mid-fight, empowered with a damaging spell next: the next-spell plate shows +25%
  'battle-player-empowered': () => {
    setScene(new BattleScene(match({ p1: 'mage', cpu: 'warrior' }))); run(0.5);
    const b = battle().b; b.endCustom([[], []]); run(1);
    const f = b.f[0]; f.empowered = 1.25; f.queue = ['meteor', 'fireball']; f.resMax = 5; f.res = 5; run(0.2);
  },
  // every stage's backdrop behind a live fight (Expedition's Crypt included)
  ...Object.fromEntries(['colosseum', 'courtyard', 'archive', 'frostpeak', 'emberforge', 'elderwood', 'crypt'].map(id => [`battle-stage-${id}`, () => {
    useStage(id); setScene(new BattleScene(match({ p1: 'ranger', cpu: 'rogue', stage: id }))); run(0.5); battle().b.endCustom([[], []]); run(1.5);
  }])),
  'battle-fight': () => { watch(); run(8, () => battle().b.phase === 'over'); },
  // mid-fight as the player, so phones show the fight pad
  'battle-player': () => { setScene(new BattleScene(match({ p1: 'priest', cpu: 'ranger' }))); run(0.5); battle().b.endCustom([[0, 1], []]); run(3); },
  // area-spell telegraphs in team colors: yours blue on their side, theirs red on yours (flash, reticle, lob shadow)
  'battle-warns': () => { setScene(new BattleScene(match({ p1: 'warrior', cpu: 'mage' }))); run(0.5); battle().b.endCustom([[], []]); run(0.3); warns(); run(0.5); },
  // the human on the right: the blue team follows you to the right side
  'battle-warns-right': () => { setScene(new BattleScene(match({ p1: 'rogue', cpu: 'priest' }), [0, 0], undefined, [], ['cpu', 'player'])); run(0.5); battle().b.endCustom([[], []]); run(0.3); warns(); run(0.5); },
  // Mage buffs in the status tags: Arcane Blast's EMPOWER next to Arcane Power's discount
  'battle-empowered': () => { setScene(new BattleScene(match({ p1: 'mage', cpu: 'priest' }))); run(0.5); battle().b.endCustom([[], []]); run(0.5); const f = battle().b.f[0]; f.empowered = 1.25; f.powerLeft = 2; run(0.5); },
  'battle-pause': () => { setScene(new BattleScene(match({ p1: 'mage', cpu: 'rogue' }))); run(0.5); battle().b.endCustom([[], []]); run(2); battle().paused = true; },
  // a whole round played out by two CPUs, ending on the results screen
  'battle-results': () => { watch({ p1: 'ranger', cpu: 'priest' }); run(400, () => battle().b.phase === 'over'); run(3); },
  // the stats screen's last tab: the per-round table and the damage-per-turn chart with its bar labels
  'battle-results-rounds': () => { watch({ p1: 'ranger', cpu: 'priest' }); run(400, () => battle().b.phase === 'over'); run(3); battle().statsPanel.tab = 2; run(0.1); },
  // big damage numbers and a live combo tag (frozen target, so the hits combo)
  'battle-hits': () => {
    watch({ p1: 'warrior', cpu: 'mage' }); run(0.5); battle().b.endCustom([[], []]); run(0.5);
    const b = battle().b, [w, m] = b.f;
    b.damage(m, 1000, w, { spell: true, freeze: 2, element: 'frost' }); run(0.5);
    b.damage(m, 280, w, { basic: 'heavy', element: 'steel' }); run(0.5);
    b.damage(m, 1767, w, { spell: true, element: 'fire' }); run(0.2);
  },
  'battle-double-ko': () => { watch({ p1: 'warrior', cpu: 'rogue' }); run(0.5); battle().b.endCustom([[], []]); run(1); for (const f of battle().b.f) f.hp = 0; run(1); },
  'battle-draw-result': () => { watch({ p1: 'warrior', cpu: 'rogue' }); run(0.5); battle().b.endCustom([[], []]); run(1); for (const f of battle().b.f) f.hp = 0; run(400, () => battle().b.phase === 'over'); run(3); },
  // the arcade ladder two fights in, with the boss up next, and a cleared run
  'arcade-ladder': () => setScene(new ArcadeLadderScene(arcadeRun(2))),
  'arcade-ladder-boss': () => setScene(new ArcadeLadderScene(arcadeRun(4))),
  'arcade-clear': () => setScene(new ArcadeClearScene(arcadeRun(5))),
  // Expedition: the map at the start and three floors in, the abandon prompt, fights, rewards, rest, shop, deck, the end
  'exp-map': () => setScene(new ExpeditionMapScene(expRun())),
  'exp-map-mid': () => setScene(new ExpeditionMapScene(expRun(3))),
  'exp-map-quit': () => { const s = new ExpeditionMapScene(expRun(3)); s.quitting = true; setScene(s); },
  'exp-draw': () => { const r = expRun(3); setScene(new ExpeditionBattleScene(r, r.map[r.at], makeFight(r, ['stumpkin', 'webspinner', 'wisp'], 99))); run(0.5); },
  'exp-fight': () => expFight(['stumpkin', 'webspinner', 'wisp']),
  'exp-fight-elite': () => expFight(['thornmother'], 4),
  'exp-fight-boss': () => expFight(['oakheart'], 4),
  'exp-act2-intro': () => setScene(new ExpeditionMapScene(expRun(0, 1), true)),
  'exp-act2-map': () => setScene(new ExpeditionMapScene(expRun(3, 1))),
  'exp-act2-fight': () => expFight(['ghoul', 'banshee', 'skelarcher'], 3, 1),
  'exp-act2-elite': () => expFight(['colossus'], 4, 1),
  'exp-act2-boss': () => expFight(['boneking'], 5, 1),
  'exp-act3-map': () => setScene(new ExpeditionMapScene(expRun(3, 2))),
  'exp-act3-fight': () => expFight(['golem', 'shaman', 'imp'], 3, 2),
  'exp-act3-elite': () => expFight(['titan'], 4, 2),
  'exp-act3-boss': () => expFight(['emberwyrm'], 5, 2),
  // a fight won and a fight lost, played through to what comes after (the rewards, the end of the run)
  // monsters that move: the sprite itself dashes or leaps (caught mid-move)
  'exp-wolf-dash': () => { expFight(['wolf'], 0); run(10, () => battle().b.mobs[0].dx < -60); },
  'exp-ghoul-leap': () => { expFight(['ghoul'], 0, 1); run(10, () => battle().b.mobs[0].dy < -12); },
  'exp-rider-charge': () => { expFight(['drakerider'], 0, 2); run(14, () => battle().b.mobs[0].dx < -60); },
  'exp-fight-won': () => { expFight(['stumpkin', 'wolf'], 1); for (const m of battle().b.mobs) m.hp = 0; run(6, () => !(getScene() instanceof ExpeditionBattleScene)); },
  'exp-fight-lost': () => { expFight(['stumpkin', 'wolf'], 1); battle().b.f[0].hp = 0; run(6, () => !(getScene() instanceof ExpeditionBattleScene)); },
  'exp-reward': () => { const r = expRun(3); setScene(new RewardScene(r, r.map[r.at])); },
  'exp-reward-elite': () => { const r = expRun(3); setScene(new RewardScene(r, { ...r.map[r.at], kind: 'elite', pack: ['alpha'] })); },
  'exp-rest': () => setScene(new RestScene(expRun(3))),
  'exp-shop': () => setScene(new ShopScene(expRun(3))),
  'exp-deck': () => setScene(new DeckScene(expRun(3), 'view')),
  'exp-deck-remove': () => setScene(new DeckScene(expRun(3), 'remove')),
  'exp-over': () => { const r = expRun(3); r.over = 'dead'; r.stats.kills = 7; r.stats.secs = 213; r.stats.dealt = 18240; setScene(new RunOverScene(r)); },
  'exp-won': () => { const r = expRun(3, 2); r.over = 'won'; r.stats.floors = 24; r.stats.kills = 19; r.stats.secs = 812; setScene(new RunOverScene(r)); },
  'training': () => { setScene(new TrainingScene(match({ p1: 'rogue', cpu: 'warrior' }))); run(1); },
  // the training settings menu, paused mid-fight
  'training-menu': () => { setScene(new TrainingScene(match({ p1: 'rogue', cpu: 'warrior' }))); run(0.5); battle().b.endCustom([[], []]); run(1); battle().paused = true; run(0.1); },
  ...Object.fromEntries(PLAYABLE.map(c => [`tutorial-${c}`, () => { setScene(new TutorialScene(c)); run(1); }])),
  // the tutorial's lesson goal mid-fight, and its end screen
  'tutorial-goal': () => { const t = new TutorialScene('mage'); setScene(t); t.page = t.pages.length; run(1); },
  'tutorial-done': () => { const t = new TutorialScene('rogue'); setScene(t); t.done = true; run(0.2); },
  // the online lobby: players, the chat tab, and a challenge coming in
  'lobby': () => setScene(fakeLobby()),
  'lobby-chat': () => { const s = fakeLobby(); s.tab = 1; setScene(s); },
  'lobby-challenged': () => setScene(fakeLobby(true)),
  // searching the ranked queue, with a ladder
  'ranked': () => {
    const s = new RankedScene();
    s.enter = () => {};
    s.store = { kind: 'room' } as unknown as RatingStore;
    s.rating = { rating: 1250, games: 19, wins: 12, losses: 7 };
    s.ladder = RIVALS.map((h, i) => ({ id: h.e.id, name: h.name, rating: h.e.rating, games: 20 - i, wins: 14 - i, losses: 6 + i, you: false }));
    s.ladder.splice(3, 0, { id: lobbyId(), name: 'YOU', rating: 1250, games: 19, wins: 12, losses: 7, you: true });
    s.search = { waited: 42_000, searching: 2, match: null, tick() {}, cancel() {} } as unknown as Search;
    s.mode = 'search';
    setScene(s);
  },
  'replays': () => {
    const s = new ReplaysScene();
    s.list = [
      fakeReplay('r1', 'ranked', 'warrior', 'mage', [0, 1, 0], 1, true), fakeReplay('r2', 'arcade', 'warrior', 'rogue', [0, 0], 3),
      fakeReplay('r3', 'online', 'priest', 'ranger', [1, 1], 20), fakeReplay('r4', 'cpu', 'mage', 'priest', [0], 26),
      fakeReplay('r5', 'versus', 'ranger', 'rogue', [1, 0, 1], 50), fakeReplay('r6', 'watch', 'rogue', 'warrior', [0, 1, 1], 70),
      fakeReplay('r7', 'ranked', 'warrior', 'priest', [0, 0], 80), fakeReplay('r8', 'online', 'mage', 'mage', [1, 0, 0], 99),
      fakeReplay('r9', 'arcade', 'warrior', 'ranger', [0, 0], 120),
    ];
    setScene(s);
  },
  'replays-empty': () => { const s = new ReplaysScene(); s.list = []; setScene(s); },
  'profile': () => setScene(fakeProfile(false)),
  // MODS: the shipped Wes (Mage) and Hazel Druid (Ranger) skins, Hazel picked; then one switched off, and the import panel
  'mods': () => { const m = new ModsScene(); m.cur = Math.max(0, MODS.findIndex(e => e.id === 'hazel-druid-skin')); setScene(m); run(0.2); },
  'mods-off': () => { setModOn('wes-skin', false); const m = new ModsScene(); setScene(m); run(0.2); },
  'mods-import': () => { const m = new ModsScene(); setScene(m); (m as unknown as { openImport(): void }).openImport(); run(0.1); },
  // the mod skins on the fighter select and in a fight
  'select-mod-skin': () => { saveMatch({ ...loadMatch(), p1: 'mage', p1Skin: { ...loadMatch().p1Skin, mage: 'wes' } }); setScene(new CharSelectScene(undefined, 1)); run(0.2); },
  'battle-mod-skins': () => {
    setScene(new BattleScene(match({ p1: 'mage', cpu: 'ranger', p1Skin: { ...loadMatch().p1Skin, mage: 'wes' }, cpuSkin: { ...loadMatch().cpuSkin, ranger: 'hazel' } })));
    run(0.5); battle().b.endCustom([[], []]); run(1.2);
  },
  'profile-empty': () => setScene(fakeProfile(true)),
  // watching a replay, and paused in slow motion
  'replay-watch': () => { setScene(new ReplayScene(recordedReplay())); run(8); },
  'replay-paused': () => {
    const s = new ReplayScene(recordedReplay());
    setScene(s);
    run(8);
    Object.assign(s, { speed: 0, halt: true });
  },
  // open tournaments to join, and an 8-player bracket a round in
  'tournament-browse': () => setScene(fakeTournament('open')),
  'tournament-bracket': () => setScene(fakeTournament('live')),
  'dev-menu': () => setScene(new DevMenuScene(title)),
  'encyclopedia': () => setScene(new EncyclopediaScene(title)),
  // a card open for reading (on phones, the sheet with its clip and rules)
  'encyclopedia-card': () => { const e = new EncyclopediaScene(title, () => {}); e.cls = 'mage'; e.sel = e.reading = 4; setScene(e); run(0.5); },
  'balance-lab': () => setScene(new LabScene(title)),
  // Warrior's light attack, mid-swing
  'art-lab': () => { setScene(new ArtLabScene(title, { tab: 'warrior', section: 'fx', zoom: 1 })); run(0.15); },
  'art-lab-anims': () => { setScene(new ArtLabScene(title, { tab: 'rogue', section: 'anims', entry: 6, zoom: 3 })); run(0.35); },
  'art-lab-sprites': () => { setScene(new ArtLabScene(title, { tab: 'mage', section: 'sprites' })); run(0.05); },
  'art-lab-sounds': () => { setScene(new ArtLabScene(title, { tab: 'priest', section: 'sounds', entry: 7 })); run(0.6); },
  // every panel state on the first stage
  'art-lab-stages': () => { setScene(new ArtLabScene(title, { tab: 'stages', entry: 1 })); run(0.15); },
  // the Screens tab's list of every screen
  'art-lab-screens': () => { setScene(new ArtLabScene(title, { tab: 'screens' })); run(0.15); },
};
