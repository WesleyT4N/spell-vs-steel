// Shared pieces of the big balance runs: the class-scoped knobs the tuner may turn, how a patch becomes
// overrides, and how far a class grid sits from Wes's targets.
import { planGrid, type GridJobResult, type GridPlan } from '../src/dev/grid';
import { defaultTuning } from '../src/dev/tuningEdit';
import type { Overrides } from '../src/dev/tuningEdit';
import { ALL_CARDS, CARDS } from '../src/game/cards';
import type { PoolKind } from '../src/dev/archetypes';
import type { ClassId } from '../src/art/sprites';
import type { Difficulty } from '../src/game/tuning';
import { SimPool } from './simpool';

/** The intended wheel (design doc): each pair once, favored class first. Five classes, so every pair is a counter. */
export const PAIRS: Array<[ClassId, ClassId]> = [
  ['warrior', 'rogue'], ['warrior', 'ranger'], ['mage', 'warrior'], ['mage', 'priest'], ['rogue', 'mage'],
  ['rogue', 'priest'], ['ranger', 'mage'], ['ranger', 'rogue'], ['priest', 'warrior'], ['priest', 'ranger'],
];
/** Target band for the favored side (Wes: counters near 60-40, 50-50 is OK). Inside it costs nothing. */
export const BAND: [number, number] = [0.55, 0.65];

/**
 * A knob only ever touches one class's own numbers (no cross-class rules):
 * its HP, its basic attacks, or the power of all its spells.
 */
export interface Knob { id: string; cls: ClassId; kind: 'hp' | 'light' | 'heavy' | 'power' | 'speed' | 'card'; card?: string }

export function knobsFor(classes: ClassId[], kinds: Knob['kind'][] = ['hp', 'power', 'light', 'heavy']): Knob[] {
  // the Warrior has no basic projectile, so no speed knob
  return classes.flatMap(cls => kinds.filter(k => k !== 'card' && !(k === 'speed' && cls === 'warrior')).map(kind => ({ id: `${cls}.${kind}`, cls, kind })));
}

/** One card's own power (used for the Mythic each ready-made deck is built around). */
export const cardKnob = (id: string): Knob => ({ id: `${id}.power`, cls: CARDS[id].cls as ClassId, kind: 'card', card: id });

/** A patch: knob id -> relative change (0.05 = +5%). */
export type Patch = Record<string, number>;

export function knobPath(k: Knob): string {
  if (k.kind === 'speed') return k.cls === 'ranger' ? 'ranger.arrowSpeed' : `${k.cls}.shotSpeed`;
  return k.kind === 'hp' ? `hp.${k.cls}` : k.kind === 'light' ? `${k.cls}.lightDamage` : `${k.cls}.heavyDamage`;
}

export function patchOverrides(p: Patch, knobs: Knob[]): Overrides {
  const ov: Overrides = { tuning: {}, cardPower: {}, cardCost: {} };
  for (const k of knobs) {
    const x = p[k.id] ?? 0;
    if (!x) continue;
    if (k.kind === 'power') for (const c of ALL_CARDS) { if (c.cls === k.cls) ov.cardPower[c.id] = (ov.cardPower[c.id] ?? 1) * (1 + x); }
    else if (k.kind === 'card') ov.cardPower[k.card!] = (ov.cardPower[k.card!] ?? 1) * (1 + x);
    else ov.tuning[knobPath(k)] = defaultTuning(knobPath(k)) * (1 + x);
  }
  return ov;
}

/** A patch in shipped units, rounded the way a designer would write it (HP to 5, damage to whole points, spell power to 1%). */
export function roundPatch(p: Patch, knobs: Knob[]): Patch {
  const out: Patch = {};
  for (const k of knobs) {
    const x = p[k.id] ?? 0;
    if (!x) continue;
    if (k.kind === 'power' || k.kind === 'card') { const r = Math.round(x * 100) / 100; if (r) out[k.id] = r; continue; }
    const base = defaultTuning(knobPath(k));
    const step = k.kind === 'hp' ? 5 : 1;
    const v = Math.round(base * (1 + x) / step) * step;
    if (v !== base) out[k.id] = v / base - 1;
  }
  return out;
}

export function describeKnob(k: Knob, x: number): string {
  if (k.kind === 'power') return `${k.cls} spells ${x >= 0 ? '+' : ''}${Math.round(x * 100)}%`;
  if (k.kind === 'card') return `${CARDS[k.card!].name} ${x >= 0 ? '+' : ''}${Math.round(x * 100)}%`;
  const base = defaultTuning(knobPath(k));
  const v = Math.round(base * (1 + x) * 10) / 10;
  const what = k.kind === 'hp' ? 'HP' : k.kind === 'light' ? 'light attack' : k.kind === 'speed' ? 'shot speed' : 'heavy attack';
  return `${k.cls} ${what} ${base} -> ${v}`;
}

/** Win rate of the favored class in each wheel pair, in PAIRS order. */
export type Rates = number[];

/** Points outside the band, squared and summed; a favored class under 50% costs triple (it breaks the 2-favorable rule). */
export function loss(r: Rates): number {
  let s = 0;
  for (const v of r) {
    const lo = Math.max(0, BAND[0] - v) * 100, hi = Math.max(0, v - BAND[1]) * 100;
    s += lo * lo + hi * hi + (v < 0.5 ? 2 * ((0.5 - v) * 100) ** 2 : 0);
  }
  return s;
}

export const pairLabel = ([a, b]: [ClassId, ClassId]): string => `${a} > ${b}`;

/** Class grid (row's wins/losses vs column) folded from raw pair results. `keep` filters deck pairs. */
export function classRates(plan: GridPlan, res: GridJobResult[], keep: (i: number) => boolean = () => true): { rates: Rates; n: number[] } {
  const w: Record<string, number> = {}, l: Record<string, number> = {};
  res.forEach((r, i) => {
    if (!keep(i)) return;
    const [a, b] = plan.pairs[i];
    w[`${a.cls}|${b.cls}`] = (w[`${a.cls}|${b.cls}`] ?? 0) + r.wins;
    l[`${a.cls}|${b.cls}`] = (l[`${a.cls}|${b.cls}`] ?? 0) + r.losses;
    w[`${b.cls}|${a.cls}`] = (w[`${b.cls}|${a.cls}`] ?? 0) + r.losses;
    l[`${b.cls}|${a.cls}`] = (l[`${b.cls}|${a.cls}`] ?? 0) + r.wins;
  });
  const rates = PAIRS.map(([a, b]) => { const W = w[`${a}|${b}`] ?? 0, L = l[`${a}|${b}`] ?? 0; return W + L ? W / (W + L) : 0.5; });
  const n = PAIRS.map(([a, b]) => (w[`${a}|${b}`] ?? 0) + (l[`${a}|${b}`] ?? 0));
  return { rates, n };
}

export interface EvalSpec { kind: PoolKind; cpu: Difficulty; n: number; k?: number; seed?: number; classes: ClassId[] }

/** Run one patch over one pool; jobs get fixed seeds so different patches see the same dice. */
export async function evaluate(pool: SimPool, spec: EvalSpec, ov: Overrides, rep = 0): Promise<{ plan: GridPlan; res: GridJobResult[] }> {
  const plan = planGrid(spec.classes, spec.kind, spec.k ?? 4, spec.seed ?? 1, spec.n, 60, spec.cpu);
  const res = await pool.run(plan.jobs.map(job => ({ job, ov, seed: (spec.seed ?? 1) * 7919 + job.i * 104729 + rep * 15485863 })));
  return { plan, res };
}

/** Each ready-made deck's win rate minus its class's, over a preset-style run (playstyles pooled). Keys like "warrior:bulwark". */
export function deckGaps(plan: GridPlan, res: GridJobResult[]): Record<string, number> {
  const deck: Record<string, [number, number]> = {}, cls: Record<string, [number, number]> = {};
  const add = (t: Record<string, [number, number]>, k: string, w: number, l: number): void => { const x = (t[k] ??= [0, 0]); x[0] += w; x[1] += l; };
  res.forEach((r, i) => {
    const [a, b] = plan.pairs[i];
    add(deck, a.key.split('/')[0], r.wins, r.losses); add(deck, b.key.split('/')[0], r.losses, r.wins);
    add(cls, a.cls, r.wins, r.losses); add(cls, b.cls, r.losses, r.wins);
  });
  const rt = (x: [number, number]): number => x[0] / Math.max(1, x[0] + x[1]);
  return Object.fromEntries(Object.entries(deck).map(([k, x]) => [k, rt(x) - rt(cls[k.split(':')[0]])]));
}
/** Ready-made decks may sit this far from their class average for free. */
export const DECK_SLACK = 0.04;
