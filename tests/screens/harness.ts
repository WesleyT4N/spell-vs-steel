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
    secs: 70 + i * 23, dealt: 900 + i * 110, taken: 300 + i * 90, tries: i === 3 ? 2 : 1, best: null,
  }));
  return { m, ladder, at: Math.min(at, ladder.length - 1), continues: 1, time: 512, tries: 1, fights };
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

const screens: Record<string, () => void> = {
  'title': title,
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
  'select-decks': () => setScene(new CharSelectScene(undefined, 4)),
  'select-training': () => setScene(new CharSelectScene(undefined, 0, 'training')),
  'select-tutorial': () => setScene(new CharSelectScene(undefined, 0, 'tutorial')),
  'stage-select': () => setScene(new StageSelectScene()),
  'online-lobby': () => setScene(new OnlineScene()),
  // typing a room code to join, three letters in
  'online-code': () => { const o = new OnlineScene(); o.mode = 'code'; o.code = 'KQZ'; setScene(o); },
  ...Object.fromEntries(PLAYABLE.map(c => [`deck-builder-${c}`, () => setScene(new DeckBuilderScene(c, title))])),
  // the opening Draw screen, with you on the left against the CPU
  'battle-draw': () => { setScene(new BattleScene(match({ p1: 'warrior', cpu: 'mage' }))); run(0.5); },
  'battle-fight': () => { watch(); run(8, () => battle().b.phase === 'over'); },
  // mid-fight as the player, so phones show the fight pad
  'battle-player': () => { setScene(new BattleScene(match({ p1: 'priest', cpu: 'ranger' }))); run(0.5); battle().b.endCustom([[0, 1], []]); run(3); },
  'battle-pause': () => { setScene(new BattleScene(match({ p1: 'mage', cpu: 'rogue' }))); run(0.5); battle().b.endCustom([[], []]); run(2); battle().paused = true; },
  // a whole round played out by two CPUs, ending on the results screen
  'battle-results': () => { watch({ p1: 'ranger', cpu: 'priest' }); run(400, () => battle().b.phase === 'over'); run(3); },
  'battle-double-ko': () => { watch({ p1: 'warrior', cpu: 'rogue' }); run(0.5); battle().b.endCustom([[], []]); run(1); for (const f of battle().b.f) f.hp = 0; run(1); },
  'battle-draw-result': () => { watch({ p1: 'warrior', cpu: 'rogue' }); run(0.5); battle().b.endCustom([[], []]); run(1); for (const f of battle().b.f) f.hp = 0; run(400, () => battle().b.phase === 'over'); run(3); },
  // the arcade ladder two fights in, and a cleared run
  'arcade-ladder': () => setScene(new ArcadeLadderScene(arcadeRun(2))),
  'arcade-clear': () => setScene(new ArcadeClearScene(arcadeRun(5))),
  'training': () => { setScene(new TrainingScene(match({ p1: 'rogue', cpu: 'warrior' }))); run(1); },
  // the training settings menu, paused mid-fight
  'training-menu': () => { setScene(new TrainingScene(match({ p1: 'rogue', cpu: 'warrior' }))); run(0.5); battle().b.endCustom([[], []]); run(1); battle().paused = true; run(0.1); },
  ...Object.fromEntries(PLAYABLE.map(c => [`tutorial-${c}`, () => { setScene(new TutorialScene(c)); run(1); }])),
  // the tutorial's lesson goal mid-fight, and its end screen
  'tutorial-goal': () => { const t = new TutorialScene('mage'); setScene(t); t.page = t.pages.length; run(1); },
  'tutorial-done': () => { const t = new TutorialScene('rogue'); setScene(t); t.done = true; run(0.2); },
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
