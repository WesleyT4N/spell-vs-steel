// Boots the real game, then lets the screen tests open any screen directly: `__test.show(name)`.
// Each screen is built the way the game builds it and run for a moment, so the shot shows it settled.
// Add a screen here when you add one to the game; the runner (run.ts) shoots every entry at every screen shape.
import './frameClock';
import '../../src/main';
import { setScene, getScene } from '../../src/scenes/scene';
import { endFrame } from '../../src/engine/input';
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

/** A CPU vs CPU set to watch, so the fight plays itself. */
function watch(over: Partial<MatchConfig> = {}): BattleScene {
  const s = new BattleScene(match({ p1: 'warrior', cpu: 'mage', bestOf: 3, ...over }), [0, 0], undefined, [], ['cpu', 'cpu']);
  setScene(s);
  return s;
}

const screens: Record<string, () => void> = {
  'title': title,
  'options': () => setScene(new OptionsScene(title)),
  'key-mapping': () => setScene(new ControlsScene(title)),
  'select-fighter': () => setScene(new CharSelectScene()),
  'select-skin': () => setScene(new CharSelectScene(undefined, 1)),
  'select-rival': () => setScene(new CharSelectScene(undefined, 2)),
  'select-rival-skin': () => setScene(new CharSelectScene(undefined, 3)),
  'select-decks': () => setScene(new CharSelectScene(undefined, 4)),
  'select-training': () => setScene(new CharSelectScene(undefined, 0, 'training')),
  'select-tutorial': () => setScene(new CharSelectScene(undefined, 0, 'tutorial')),
  'stage-select': () => setScene(new StageSelectScene()),
  'online-lobby': () => setScene(new OnlineScene()),
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
  'training': () => { setScene(new TrainingScene(match({ p1: 'rogue', cpu: 'warrior' }))); run(1); },
  ...Object.fromEntries(PLAYABLE.map(c => [`tutorial-${c}`, () => { setScene(new TutorialScene(c)); run(1); }])),
  'dev-menu': () => setScene(new DevMenuScene(title)),
  'encyclopedia': () => setScene(new EncyclopediaScene(title)),
  'balance-lab': () => setScene(new LabScene(title)),
};

declare global { interface Window { __test: unknown } }
window.__test = {
  names: Object.keys(screens),
  show(name: string): void {
    const open = screens[name];
    if (!open) throw new Error(`no screen named ${name}`);
    open();
  },
};
