// Matchup grid over deck pools: the job list, running one job, folding results into class and deck grids,
// and Wes's balance rules. Shared by scripts/balance.ts (worker threads) and the balance lab (web workers).
import { runMatch, wilson, type SideSpec } from './simulate';
import { deckPool, type PoolDeck, type PoolKind } from './archetypes';
import type { ClassId } from '../art/sprites';

export interface GridJob { i: number; a: SideSpec; b: SideSpec; n: number; tick: number }
/** Wins and losses are from deck `a`'s point of view, whichever side it started on. */
export interface GridJobResult {
  i: number; wins: number; losses: number; draws: number; time: number;
  /** Per card, [matches it was cast in, of those won], for deck a (0) and deck b (1). */
  casts: [Record<string, [number, number]>, Record<string, [number, number]>];
}

export interface Cell { wins: number; losses: number; draws: number }

export interface GridReport {
  kind: PoolKind;
  decks: PoolDeck[];
  /** Class vs class, from the row's side. */
  grid: Record<string, Record<string, Cell>>;
  /** Deck key vs class. */
  deckGrid: Record<string, Record<string, Cell>>;
  /** Per card id: matches cast in, of those won. */
  cards: Record<string, [number, number]>;
  matches: number;
  avgTime: number;
}

/** Intended soft-counter wheel (design doc): each class should beat these two. */
export const WHEEL: Record<string, string[]> = {
  warrior: ['rogue', 'ranger'], mage: ['warrior', 'priest'], rogue: ['mage', 'priest'], ranger: ['mage', 'rogue'], priest: ['warrior', 'ranger'],
};
/** Win rate bands (Wes): favorable from 53%, a counter should sit near 60-40, past 67-33 is too lopsided. */
export const FAV = 0.53, LOPSIDED = 0.67;

export interface GridPlan { kind: PoolKind; decks: PoolDeck[]; pairs: Array<[PoolDeck, PoolDeck]>; jobs: GridJob[] }

/** Every pair of decks from different classes, once each; `n` matches per pair with sides alternating. */
export function planGrid(classes: ClassId[], kind: PoolKind, k: number, seed: number, n: number, hz: number): GridPlan {
  const decks = classes.flatMap((c, ci) => deckPool(c, kind, k, seed * 1000 + ci));
  const pairs: GridPlan['pairs'] = [], jobs: GridJob[] = [];
  for (let x = 0; x < decks.length; x++) for (let y = x + 1; y < decks.length; y++) {
    if (decks[x].cls === decks[y].cls) continue;
    pairs.push([decks[x], decks[y]]);
    jobs.push({ i: jobs.length, a: spec(decks[x]), b: spec(decks[y]), n, tick: 1 / hz });
  }
  return { kind, decks, pairs, jobs };
}

const spec = (d: PoolDeck): SideSpec => ({ cls: d.cls, deck: d.deck, cpu: 'normal', label: d.key });

export function runJob(job: GridJob): GridJobResult {
  const r: GridJobResult = { i: job.i, wins: 0, losses: 0, draws: 0, time: 0, casts: [{}, {}] };
  for (let m = 0; m < job.n; m++) {
    const flip = m % 2 === 1;
    const res = flip ? runMatch(job.b, job.a, job.tick) : runMatch(job.a, job.b, job.tick);
    const aSide = flip ? 1 : 0;
    r.time += res.time;
    if (res.winner === null) r.draws++; else if (res.winner === aSide) r.wins++; else r.losses++;
    for (const who of [0, 1] as const) {
      const side = who === 0 ? aSide : 1 - aSide;
      for (const id of new Set(res.casts[side])) {
        const c = (r.casts[who][id] ??= [0, 0]);
        c[0]++;
        if (res.winner === side) c[1]++;
      }
    }
  }
  return r;
}

/** Fold job results (indexed by job.i; missing ones are skipped, so a partial run still reads). */
export function foldGrid(plan: GridPlan, results: Array<GridJobResult | undefined>): GridReport {
  const grid: GridReport['grid'] = {}, deckGrid: GridReport['deckGrid'] = {}, cards: GridReport['cards'] = {};
  const add = (t: Record<string, Record<string, Cell>>, r: string, c: string, w: number, l: number, d: number): void => {
    const cell = ((t[r] ??= {})[c] ??= { wins: 0, losses: 0, draws: 0 });
    cell.wins += w; cell.losses += l; cell.draws += d;
  };
  let matches = 0, time = 0;
  results.forEach((r, i) => {
    if (!r) return;
    const [da, db] = plan.pairs[i];
    matches += r.wins + r.losses + r.draws;
    time += r.time;
    add(grid, da.cls, db.cls, r.wins, r.losses, r.draws);
    add(grid, db.cls, da.cls, r.losses, r.wins, r.draws);
    add(deckGrid, da.key, db.cls, r.wins, r.losses, r.draws);
    add(deckGrid, db.key, da.cls, r.losses, r.wins, r.draws);
    for (const [who, d] of [[0, da], [1, db]] as const) {
      for (const [id, [n, w]] of Object.entries(r.casts[who])) {
        if (!(id in d.deck)) continue;
        const c = (cards[id] ??= [0, 0]);
        c[0] += n; c[1] += w;
      }
    }
  });
  return { kind: plan.kind, decks: plan.decks, grid, deckGrid, cards, matches, avgTime: matches ? time / matches : 0 };
}

export const cellRate = (c?: Cell): number => (c && c.wins + c.losses ? c.wins / (c.wins + c.losses) : NaN);

export function cellRange(c?: Cell): [number, number] {
  return c ? wilson(c.wins, c.wins + c.losses) : [0, 1];
}

/** A class's record against everyone, pooled. */
export function classTotal(r: GridReport, cls: string): Cell {
  return Object.values(r.grid[cls] ?? {}).reduce((s, c) => ({ wins: s.wins + c.wins, losses: s.losses + c.losses, draws: s.draws + c.draws }), { wins: 0, losses: 0, draws: 0 });
}

export const favorable = (r: GridReport, a: string, classes: string[]): string[] => classes.filter(b => b !== a && cellRate(r.grid[a]?.[b]) >= FAV);

/** Wes's rules: at least 2 favorable matchups, nothing past 67-33, and the intended wheel holds. */
export function ruleChecks(r: GridReport, a: string, classes: string[]): string[] {
  const out: string[] = [];
  const pc = (v: number): string => `${Math.round(v * 100)}%`;
  const fav = favorable(r, a, classes);
  if (fav.length < 2) out.push(`only ${fav.length} favorable`);
  for (const b of classes) {
    if (a === b) continue;
    const v = cellRate(r.grid[a]?.[b]);
    if (v >= LOPSIDED) out.push(`stomps ${b} ${pc(v)}`);
  }
  for (const b of WHEEL[a] ?? []) {
    if (!classes.includes(b)) continue;
    const v = cellRate(r.grid[a]?.[b]);
    if (v < 0.5) out.push(`should beat ${b}, has ${pc(v)}`);
  }
  return out;
}
