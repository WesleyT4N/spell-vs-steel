// Boots the real game, then lets the screen tests open any screen directly: `__test.show(name)`.
// Each screen is built the way the game builds it and run for a moment, so the shot shows it settled.
// Add a screen here when you add one to the game; the runner (run.ts) shoots every entry at every screen shape.
import './frameClock';
import '../../src/main';
import { setScene, getScene } from '../../src/scenes/scene';
import { endFrame, pollInput } from '../../src/engine/input';
import { spread } from '../../src/engine/gfx';
import { TitleScene } from '../../src/scenes/title';
import { OptionsScene } from '../../src/scenes/options';
import { ControlsScene } from '../../src/scenes/controls';
import { CharSelectScene } from '../../src/scenes/select';
import { StageSelectScene } from '../../src/scenes/stageSelect';
import { DeckSelectScene } from '../../src/scenes/deckSelect';
import { DeckBuilderScene } from '../../src/scenes/deckbuilder';
import { OnlineScene } from '../../src/scenes/online';
import { BattleScene } from '../../src/scenes/battle';
import { TrainingScene } from '../../src/scenes/training';
import { TutorialScene } from '../../src/scenes/tutorial';
import { DevMenuScene } from '../../src/scenes/devMenu';
import { EncyclopediaScene } from '../../src/scenes/encyclopedia';
import { LabScene } from '../../src/scenes/lab';
import { ArcadeLadderScene, ArcadeClearScene } from '../../src/scenes/arcade';
import { buildLadder, type ArcadeRun } from '../../src/game/arcade';
import { loadMatch, type MatchConfig } from '../../src/game/match';
import { PLAYABLE } from '../../src/game/classes';
import { SKINS, type ClassId } from '../../src/art/sprites';
import { LobbyScene } from '../../src/scenes/lobby';
import { RankedScene } from '../../src/scenes/ranked';
import { ReplaysScene, ReplayScene } from '../../src/scenes/replays';
import { ProfileScene } from '../../src/scenes/profile';
import { Battle, type Intent } from '../../src/game/battle';
import { Cpu } from '../../src/game/ai';
import { TapeWriter } from '../../src/game/replay';
import { TournamentScene } from '../../src/scenes/tournament';
import { tournaments, type Bracket } from '../../src/net/tournament';
import { lobbyId, type Lobby, type Here } from '../../src/net/lobby';
import type { Search } from '../../src/net/matchmaking';
import type { RatingStore } from '../../src/net/rating';
import type { Replay } from '../../src/game/replay';
import { NetSession } from '../../src/net/session';
import type { Transport } from '../../src/net/transport';
import type { Packet } from '../../src/net/protocol';
import { OnlineBattleScene } from '../../src/scenes/onlineBattle';
import { startRanked } from '../../src/net/rating';
import { roundRecord } from '../../src/game/stats';
import { presetDeck, toList } from '../../src/game/deck';

const STEP = 1 / 60;
/** Run the current screen's update for `seconds` of game time without drawing (much faster than real frames). */
function run(seconds: number, until?: () => boolean): void {
  for (let t = 0; t < seconds && !until?.(); t += STEP) { getScene()?.update(STEP); endFrame(); }
}
const title = (): void => setScene(new TitleScene());
const match = (over: Partial<MatchConfig> = {}): MatchConfig => ({ ...loadMatch(), ...over });
const battle = (): BattleScene => getScene() as BattleScene;

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
  return host;
}
const loadMatchDeck = (cls: ClassId = 'warrior'): string[] => toList(presetDeck(cls, 'starter'));

const screens: Record<string, () => void> = {
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
  'select-training': () => setScene(new CharSelectScene(undefined, 0, 'training')),
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
  // a ready-made deck's spells open over the start-from picker (on phones in portrait; wider screens list it on hover)
  'deck-builder-peek': () => { const d = new DeckBuilderScene('ranger', title); (d as unknown as { peek: number; pickSel: number }).peek = 1; (d as unknown as { pickSel: number }).pickSel = 1; setScene(d); },
  ...Object.fromEntries(PLAYABLE.map(c => [`deck-builder-${c}`, () => setScene(new DeckBuilderScene(c, title))])),
  // the opening Draw screen, with you on the left against the CPU
  'battle-draw': () => { setScene(new BattleScene(match({ p1: 'warrior', cpu: 'mage' }))); run(0.5); },
  'battle-fight': () => { watch(); run(8, () => battle().b.phase === 'over'); },
  // mid-fight as the player, so phones show the fight pad
  'battle-player': () => { setScene(new BattleScene(match({ p1: 'priest', cpu: 'ranger' }))); run(0.5); battle().b.endCustom([[0, 1], []]); run(3); },
  // area-spell telegraphs in team colors: yours blue on their side, theirs red on yours (flash, reticle, lob shadow)
  'battle-warns': () => { setScene(new BattleScene(match({ p1: 'warrior', cpu: 'mage' }))); run(0.5); battle().b.endCustom([[], []]); run(0.3); warns(); run(0.5); },
  // the human on the right: the blue team follows you to the right side
  'battle-warns-right': () => { setScene(new BattleScene(match({ p1: 'rogue', cpu: 'priest' }), [0, 0], undefined, [], ['cpu', 'player'])); run(0.5); battle().b.endCustom([[], []]); run(0.3); warns(); run(0.5); },
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
};

declare global { interface Window { __test: unknown } }
window.__test = {
  names: Object.keys(screens),
  /** True when the screen shown uses its full-height phone layout (it fills the whole window, not the top half). */
  tall: (): boolean => spread.tall,
  show(name: string): void {
    const open = screens[name];
    if (!open) throw new Error(`no screen named ${name}`);
    open();
  },
};
