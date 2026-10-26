// Arcade ladder: one run through every other class, the CPU getting tougher each fight, then your own shadow.
// A run lives in memory; only the best clear per class is saved.
import { getSave, setSave } from '../engine/save';
import { SKINS, mirrorSkin, skinOf, type ClassId } from '../art/sprites';
import { STAGE_IDS } from '../art/stages';
import { PLAYABLE } from './classes';
import { presetsFor } from './deck';
import type { MatchConfig } from './match';
import type { Difficulty } from './tuning';

export interface Rung {
  cls: ClassId;
  skin: string;
  difficulty: Difficulty;
  /** Ready-made deck id the CPU fights with. */
  deck: string;
  stage: string;
  boss: boolean;
  /** The rival's HP and damage as a share of the full kit (1 = full power, the boss only). */
  power: number;
}

/** How a won fight went, for the clear screen. */
export interface FightRecord {
  cls: ClassId;
  skin: string;
  difficulty: Difficulty;
  boss: boolean;
  /** Rounds won and lost in the deciding set. */
  rounds: [number, number];
  secs: number;
  dealt: number;
  taken: number;
  /** Sets played to win it (1 + continues used here). */
  tries: number;
  /** Your top spell of the set and what it did (damage plus healing). */
  best: [string, number] | null;
}

export interface ArcadeRun {
  /** Your fighter, skin and deck choice for the whole run (MatchConfig.p1 side). */
  m: MatchConfig;
  ladder: Rung[];
  /** Index of the fight up next. */
  at: number;
  continues: number;
  /** Seconds spent fighting, summed over every round. */
  time: number;
  /** Sets played on the current rung. */
  tries: number;
  fights: FightRecord[];
}

/**
 * The rival fights, in order: CPU level, deck, and power (HP and damage as a share of the full kit).
 * Every rival is weaker than a real opponent and each one a step tougher; only the boss fights at full power.
 */
const CLIMB: Array<{ difficulty: Difficulty; mythic: boolean; power: number }> = [
  { difficulty: 'easy', mythic: false, power: 0.6 },
  { difficulty: 'normal', mythic: false, power: 0.7 },
  { difficulty: 'normal', mythic: true, power: 0.8 },
  { difficulty: 'hard', mythic: true, power: 0.9 },
];
/** The Shadow Self boss: your class and deck in black, on Hard, with this much HP. */
export const BOSS_HP = 1.5;
export const BOSS_SKIN = 'black';

function shuffle<T>(list: T[], rand: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const mythics = (cls: ClassId): string[] => presetsFor(cls).map(p => p.id).filter(id => id !== 'starter');
const pick = <T>(list: T[], rand: () => number): T => list[Math.floor(rand() * list.length)];

/**
 * The four other classes in a random order, Easy to Hard, then the boss: your own class with your own deck.
 * The first two rivals play their starter, later ones a Mythic deck; every fight is on a different stage.
 */
export function buildLadder(m: MatchConfig, rand: () => number = Math.random): Rung[] {
  const stages = shuffle(STAGE_IDS, rand);
  const rivals = shuffle(PLAYABLE.filter(c => c !== m.p1), rand).slice(0, CLIMB.length);
  const rungs: Rung[] = rivals.map((cls, i) => ({
    cls,
    skin: pick(SKINS[cls], rand).id,
    difficulty: CLIMB[i].difficulty,
    deck: CLIMB[i].mythic ? pick(mythics(cls), rand) : 'starter',
    stage: stages[i % stages.length],
    boss: false,
    power: CLIMB[i].power,
  }));
  // in black, unless you already wear it
  rungs.push({ cls: m.p1, skin: mirrorSkin(m.p1, skinOf(m.p1, m.p1Skin[m.p1]).id, BOSS_SKIN), difficulty: 'hard', deck: m.p1Deck, stage: stages[rungs.length % stages.length], boss: true, power: 1 });
  return rungs;
}

export function newRun(m: MatchConfig): ArcadeRun {
  return { m: { ...m, sides: ['player', 'cpu'], bestOf: 3 }, ladder: buildLadder(m), at: 0, continues: 0, time: 0, tries: 1, fights: [] };
}

/** The match setup for the run's next fight. */
export function rungMatch(run: ArcadeRun): MatchConfig {
  const r = run.ladder[run.at];
  return { ...run.m, cpu: r.cls, cpuDeck: r.deck, difficulty: r.difficulty, cpuSkin: { ...run.m.cpuSkin, [r.cls]: r.skin }, stage: r.stage };
}

export interface ArcadeRecord { time: number; continues: number }
export function loadRecords(): Partial<Record<ClassId, ArcadeRecord>> {
  return { ...getSave('arcade') } as Partial<Record<ClassId, ArcadeRecord>>;
}

/** Saves a clear if it beats the class's best (fewer continues first, then faster). True when it is a new best. */
export function saveClear(cls: ClassId, rec: ArcadeRecord): boolean {
  const all = loadRecords(), old = all[cls];
  const better = !old || rec.continues < old.continues || (rec.continues === old.continues && rec.time < old.time);
  if (!better) return false;
  all[cls] = rec;
  setSave('arcade', all as Record<string, ArcadeRecord>);
  return true;
}

export const clock = (s: number): string => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
