// Headless CPU-vs-CPU matches with per-card stats. Used by the balance lab and scripts/sim.ts.
import { PLAYABLE } from '../game/classes';
import { Battle, type Side } from '../game/battle';
import { Cpu } from '../game/ai';
import { randomSeed } from '../game/rng';
import { styleById } from '../game/playstyles';
import { CARDS } from '../game/cards';
import { starterDeck, toList, type DeckCounts } from '../game/deck';
import type { Difficulty } from '../game/tuning';
import { SKINS, type ClassId } from '../art/sprites';
import { instrument } from './instrument';

/** Every class with sprites; new classes show up in the dev tools as soon as they are added. */
export const classIds = (): ClassId[] => (Object.keys(SKINS) as ClassId[]).filter(c => PLAYABLE.includes(c));

export interface SideSpec { cls: ClassId; deck: DeckCounts; cpu: Difficulty; label?: string; /** Playstyle id (default: balanced). */ style?: string }

export interface MatchResult {
  winner: Side | null;
  time: number;
  turns: number;
  /** Damage dealt per side by source ('light', 'heavy', card id or 'other'). */
  dmg: [Record<string, number>, Record<string, number>];
  casts: [string[], string[]];
  hpLeft: [number, number];
}

/** The game's own frame step. */
export const DT = 1 / 60;
/** Matches that run longer than this are called a draw. */
export const TIME_LIMIT = 600;

/**
 * `tick` = seconds per simulation step. Every rule in Battle and the CPU is written in seconds,
 * so a coarser tick (e.g. 1/30) plays the same match in fewer steps; scripts/balance.ts --tick checks it against 1/60.
 */
export function runMatch(a: SideSpec, bSpec: SideSpec, tick: number = DT, seed: number = randomSeed()): MatchResult {
  // the CPUs seed their rolls from the battle, so the same seed plays the same match
  const b = new Battle({ cls: a.cls, deck: toList(a.deck), name: 'A' }, { cls: bSpec.cls, deck: toList(bSpec.deck), name: 'B' }, seed);
  const probe = instrument(b);
  const dmg: MatchResult['dmg'] = [{}, {}];
  probe.onHit = h => {
    if (h.by === null || !h.dealt) return;
    dmg[h.by][h.source] = (dmg[h.by][h.source] ?? 0) + h.dealt;
  };
  const cpus = [new Cpu(a.cpu, styleById(a.style ?? '')), new Cpu(bSpec.cpu, styleById(bSpec.style ?? ''))];
  let t = 0;
  // the winner is known at the KO, so the 2s KO animation is skipped
  while (b.phase !== 'over' && b.phase !== 'ko' && t < TIME_LIMIT) {
    if (b.phase === 'custom') b.endCustom([cpus[0].pick(b, b.f[0]), cpus[1].pick(b, b.f[1])]);
    // the player opens the Draw screen whenever they like; side A's CPU opens it a little after it fills
    else if (cpus[0].wantsDraw(b, b.f[0], tick)) b.beginCustom();
    b.update(tick, [cpus[0].intent(b, b.f[0], tick), cpus[1].intent(b, b.f[1], tick)]);
    t += tick;
  }
  return { winner: b.winner, time: t, turns: b.turn, dmg, casts: probe.casts, hpLeft: [b.f[0].hp / b.f[0].maxHp, b.f[1].hp / b.f[1].maxHp] };
}

export interface CardStat {
  id: string;
  side: Side;
  /** Matches where the side ran this card. */
  matches: number;
  casts: number;
  dmg: number;
  /** Matches where it was cast at least once, and how many of those were won. */
  castIn: number;
  castWins: number;
}

export interface SeriesStats {
  n: number;
  wins: [number, number];
  draws: number;
  time: number;
  turns: number;
  /** Per side: basic (light + heavy), spell, other. */
  split: [{ basic: number; spell: number; other: number }, { basic: number; spell: number; other: number }];
  cards: Map<string, CardStat>;
}

export function emptyStats(): SeriesStats {
  return { n: 0, wins: [0, 0], draws: 0, time: 0, turns: 0, split: [{ basic: 0, spell: 0, other: 0 }, { basic: 0, spell: 0, other: 0 }], cards: new Map() };
}

/** Fold one match into running stats. */
export function addMatch(s: SeriesStats, r: MatchResult, specs: [SideSpec, SideSpec]): void {
  s.n++;
  if (r.winner === null) s.draws++; else s.wins[r.winner]++;
  s.time += r.time;
  s.turns += r.turns;
  for (const side of [0, 1] as const) {
    for (const [src, v] of Object.entries(r.dmg[side])) {
      const k = src === 'light' || src === 'heavy' ? 'basic' : src === 'other' ? 'other' : 'spell';
      s.split[side][k] += v;
    }
    const cast = new Set(r.casts[side]);
    for (const id of Object.keys(specs[side].deck)) {
      const key = `${side}:${id}`;
      let c = s.cards.get(key);
      if (!c) { c = { id, side, matches: 0, casts: 0, dmg: 0, castIn: 0, castWins: 0 }; s.cards.set(key, c); }
      c.matches++;
      c.casts += r.casts[side].filter(x => x === id).length;
      c.dmg += r.dmg[side][id] ?? 0;
      if (cast.has(id)) { c.castIn++; if (r.winner === side) c.castWins++; }
    }
  }
}

/** Runs `n` matches in one go (for scripts; the lab runs them in slices so the page stays responsive). */
export function runSeries(a: SideSpec, bSpec: SideSpec, n: number): SeriesStats {
  const s = emptyStats();
  for (let i = 0; i < n; i++) addMatch(s, runMatch(a, bSpec), [a, bSpec]);
  return s;
}

export const starterSpec = (cls: ClassId, cpu: Difficulty = 'normal'): SideSpec => ({ cls, deck: starterDeck(cls), cpu });

/** Wilson 95% interval for a win rate, as [low, high] in 0..1. */
export function wilson(wins: number, n: number): [number, number] {
  if (!n) return [0, 1];
  const z = 1.96, p = wins / n;
  const d = 1 + z * z / n, c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return [(c - m) / d, (c + m) / d];
}

export const cardName = (id: string): string => CARDS[id]?.name ?? id;
