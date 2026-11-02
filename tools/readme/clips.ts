// The README's clips and stills, set up the way the game builds each screen. capture.ts opens one by name, steps the
// clock a frame at a time, presses the keys the clip lists, and turns the canvas into a GIF (docs/media/<name>.gif).
// Every fight is CPU vs CPU on a seeded Math.random, so a clip comes out the same each time it is captured.
import '../../tests/screens/frameClock';
import * as game from '../../src/main';
import { useStage } from '../../src/game/battleView';
import { setScene, getScene } from '../../src/scenes/scene';
import { run } from '../../src/dev/screens';
import { TitleScene } from '../../src/scenes/title';
import { CharSelectScene } from '../../src/scenes/select';
import { BattleScene } from '../../src/scenes/battle';
import { ExpeditionMapScene, ExpeditionBattleScene } from '../../src/scenes/expedition';
import { ModsScene } from '../../src/scenes/mods';
import { MODS } from '../../src/mods';
import { newRun, addRelic, addSpell, makeFight, nextAct, type ExpeditionRun } from '../../src/game/expedition';
import { MOBS } from '../../src/game/mobs';
import { loadMatch, saveMatch, type MatchConfig } from '../../src/game/match';
import { Cpu } from '../../src/game/ai';
import { SKINS, type ClassId } from '../../src/art/sprites';

/** One clip: how to open it, how long to record, and keys to press along the way (seconds from the start). */
export interface Clip { setup(): void; secs: number; fps?: number; keys?: [number, string][]; still?: boolean }

const match = (over: Partial<MatchConfig> = {}): MatchConfig => ({ ...loadMatch(), difficulty: 'hard', ...over });
const battle = (): BattleScene => getScene() as BattleScene;

/** A CPU vs CPU fight on `stage`, the opening Draw screen done and `lead` seconds in. */
function watch(p1: ClassId, cpu: ClassId, stage: string, lead = 1.5): void {
  useStage(stage);
  setScene(new BattleScene(match({ p1, cpu, stage, bestOf: 3 }), [0, 0], undefined, [], ['cpu', 'cpu']));
  run(lead);
}

function expRun(floors: number, act: number): ExpeditionRun {
  const r = newRun('mage', SKINS.mage[0].id, 4242);
  for (let a = 0; a < act; a++) nextAct(r);
  for (let f = 0; f < floors; f++) {
    const n = r.map.find(x => x.floor === f && x.lane === 1)!;
    r.at = n.id; r.path.push(n.id); r.stats.floors = f + 1; r.stats.fights++;
  }
  addRelic(r, 'whetstone'); addSpell(r, 'flamestrike'); r.gold = 137;
  return r;
}

/** An Expedition fight with the Mage played by the CPU, so the clip plays itself. */
function expFight(pack: string[], act: number): void {
  const r = expRun(3, act), node = { ...r.map[r.at], kind: (MOBS[pack[0]].rank === 'boss' ? 'boss' : 'fight') as 'fight', pack };
  const s = new ExpeditionBattleScene(r, node, makeFight(r, pack, 99));
  s.ctl[0] = 'cpu';
  (s as unknown as { cpu0: Cpu }).cpu0 = new Cpu('hard');
  setScene(s);
  run(1.2);
}

export const clips: Record<string, Clip> = {
  'title': { setup: () => { const t = new TitleScene(); t.intro = 99; setScene(t); }, secs: 7 },
  'hero': { setup: () => watch('mage', 'warrior', 'frostpeak', 2), secs: 9 },
  'class-warrior': { setup: () => watch('warrior', 'rogue', 'colosseum', 2.5), secs: 5 },
  'class-mage': { setup: () => watch('mage', 'priest', 'archive', 2.5), secs: 5 },
  'class-rogue': { setup: () => watch('rogue', 'mage', 'courtyard', 2.5), secs: 5 },
  'class-ranger': { setup: () => watch('ranger', 'warrior', 'elderwood', 2.5), secs: 5 },
  'class-priest': { setup: () => watch('priest', 'ranger', 'frostpeak', 2.5), secs: 5 },
  'cast': { setup: () => watch('ranger', 'mage', 'emberforge', 3), secs: 6 },
  'fight': { setup: () => watch('priest', 'warrior', 'elderwood', 4), secs: 6 },
  // the opening Draw screen as the Mage: read the hand, queue Fireball then Deep Freeze, and FIGHT!
  'draw': {
    setup: () => {
      useStage('frostpeak');
      setScene(new BattleScene(match({ p1: 'mage', cpu: 'warrior', stage: 'frostpeak' })));
      run(0.3);
      const b = battle().b;
      b.offer[0] = ['arcane_missiles', 'fireball', 'ice_wall', 'deep_freeze', 'arcane_power'];
      b.f[0].resMax = 5; b.f[0].res = 5;
    },
    secs: 6,
    keys: [[0.6, 'KeyD'], [1.3, 'Enter'], [2.0, 'KeyD'], [2.6, 'Enter'], [3.3, 'KeyD'], [3.9, 'Enter']],
  },
  // fighter select: from the Warrior across to the Mage
  'select': {
    setup: () => { saveMatch({ ...loadMatch(), p1: 'warrior' }); setScene(new CharSelectScene()); },
    secs: 6,
    keys: [[1.0, 'KeyD'], [2.0, 'KeyD'], [3.0, 'KeyD'], [4.0, 'KeyD']],
  },
  // the Mage finishes a nearly beaten Warrior, then the round's stats
  'ko': {
    setup: () => {
      watch('mage', 'warrior', 'courtyard', 2);
      const b = battle().b;
      b.f[1].hp = Math.round(b.f[1].maxHp * 0.08);
      run(30, () => b.f[1].hp < b.f[1].maxHp * 0.03 || b.phase !== 'fight');
    },
    secs: 7,
  },
  'expedition-map': { setup: () => setScene(new ExpeditionMapScene(expRun(3, 0))), secs: 0, still: true },
  'expedition': { setup: () => expFight(['ghoul', 'banshee', 'skelarcher'], 1), secs: 7 },
  'mods': { setup: () => { const m = new ModsScene(); m.cur = Math.max(0, MODS.findIndex(e => e.id === 'wes-skin')); setScene(m); run(0.2); }, secs: 0, still: true },
};

declare global { interface Window { __clips: unknown } }
const ready = (game as { ready?: Promise<void> }).ready ?? Promise.resolve();
void ready.then(() => {
  window.__clips = {
    names: Object.keys(clips),
    info: (n: string) => { const c = clips[n]; return { secs: c.secs, fps: c.fps ?? 10, keys: c.keys ?? [], still: !!c.still }; },
    show: (n: string) => clips[n].setup(),
  };
});
