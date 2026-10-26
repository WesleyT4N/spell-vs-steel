// Automatic number search: finds small class-scoped tweaks (HP, basic attacks, spell power) that move every
// wheel matchup into the target band (src: scripts/balancelib.ts BAND), preferring as few and as small changes as possible.
// Method: measure how each knob moves each matchup (finite differences with shared dice), solve a sparse
// least-squares step on that linear model, check the step with fresh sims, repeat.
// Usage: npx tsx scripts/tune.ts --out dir [--pool preset-style] [--cpu normal,hard (averaged)] [--n 6] [--check-n 24] [--iters 3]
//        [--kinds hp,power,light,heavy] [--lambda 3] [--h 0.1] [--max 0.2]
//        [--decks]  also keep each ready-made deck within 4 points of its class, with each Mythic's own power as extra knobs
//        [--start dir/tune.json]  start from the best patch of an earlier run
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { classIds } from '../src/dev/simulate';
import { toScript } from '../src/dev/script';
import type { Difficulty } from '../src/game/tuning';
import type { PoolKind } from '../src/dev/archetypes';
import { presetsFor } from '../src/game/deck';
import { SimPool } from './simpool';
import { BAND, DECK_SLACK, PAIRS, cardKnob, classRates, deckGaps, describeKnob, evaluate, knobsFor, loss, pairLabel, patchOverrides, roundPatch, type EvalSpec, type Knob, type Patch, type Rates } from './balancelib';

const o = { out: '', pool: 'preset-style' as PoolKind, cpu: ['normal', 'hard'] as Difficulty[], n: 6, checkN: 24, iters: 3, kinds: ['hp', 'power', 'light', 'heavy'] as Knob['kind'][], lambda: 3, h: 0.1, max: 0.2, decks: false, start: '' };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i], v = (): string => argv[++i] ?? '';
  if (a === '--out') o.out = v();
  else if (a === '--pool') o.pool = v() as PoolKind;
  else if (a === '--cpu') o.cpu = v().split(',') as Difficulty[];
  else if (a === '--n') o.n = Number(v());
  else if (a === '--check-n') o.checkN = Number(v());
  else if (a === '--iters') o.iters = Number(v());
  else if (a === '--kinds') o.kinds = v().split(',') as Knob['kind'][];
  else if (a === '--lambda') o.lambda = Number(v());
  else if (a === '--h') o.h = Number(v());
  else if (a === '--max') o.max = Number(v());
  else if (a === '--decks') o.decks = true;
  else if (a === '--start') o.start = v();
  else throw new Error(`unknown option ${a}`);
}
if (!o.out) throw new Error('--out dir is required');
mkdirSync(o.out, { recursive: true });

const classes = classIds();
const mythicDecks = classes.flatMap(c => presetsFor(c).filter(p => p.id !== 'starter').map(p => ({ key: `${c}:${p.id}`, mythic: p.mythic })));
const deckKeys = o.decks ? classes.flatMap(c => presetsFor(c).map(p => `${c}:${p.id}`)) : [];
const knobs = [...knobsFor(classes, o.kinds), ...(o.decks ? mythicDecks.map(d => cardKnob(d.mythic)) : [])];
/** How much a deck point off counts against a matchup point off. */
const DECK_W = 0.5;
const pool = new SimPool();
const log: string[] = [];
const say = (s: string): void => { console.log(s); log.push(s); };
const fmt = (r: Rates): string => PAIRS.map((p, i) => `${pairLabel(p)} ${(r[i] * 100).toFixed(1)}`).join(' | ')
  + (deckKeys.length ? `\n  decks vs class: ${deckKeys.map((k, i) => `${k.split(':')[1]} ${r[PAIRS.length + i] >= 0 ? '+' : ''}${(r[PAIRS.length + i] * 100).toFixed(1)}`).join(', ')}` : '');
const fmtPatch = (p: Patch): string => knobs.filter(k => p[k.id]).map(k => describeKnob(k, p[k.id])).join('; ') || '(no change)';
const l1 = (p: Patch): number => Object.values(p).reduce((s, v) => s + Math.abs(v), 0);

async function rates(p: Patch, n: number, rep = 0): Promise<Rates> {
  // every CPU level at once, averaged: the matchups should hold for careful and sloppy play alike
  const each = await Promise.all(o.cpu.map(async cpu => {
    const spec: EvalSpec = { kind: o.pool, cpu, n, classes };
    const { plan, res } = await evaluate(pool, spec, patchOverrides(p, knobs), rep);
    const gaps = deckKeys.length ? deckGaps(plan, res) : {};
    return [...classRates(plan, res).rates, ...deckKeys.map(k => gaps[k] ?? 0)];
  }));
  return each[0].map((_, i) => each.reduce((s, r) => s + r[i], 0) / each.length);
}

/** Metrics: the 10 wheel rates, then (with --decks) each deck's gap to its class. */
const deckLoss = (m: Rates): number => m.slice(PAIRS.length).reduce((s, g) => s + DECK_W * (Math.max(0, Math.abs(g) - DECK_SLACK) * 100) ** 2, 0);
const total = (m: Rates): number => loss(m.slice(0, PAIRS.length)) + deckLoss(m);

/** d loss / d metric (the loss is piecewise quadratic, so this is exact). */
function grad(r: Rates): number[] {
  return r.map((v, i) => {
    let g = 0;
    if (i >= PAIRS.length) {
      const over = Math.abs(v) - DECK_SLACK;
      return over > 0 ? Math.sign(v) * 2 * DECK_W * over * 1e4 : 0;
    }
    if (v < BAND[0]) g -= 2 * (BAND[0] - v) * 1e4;
    if (v > BAND[1]) g += 2 * (v - BAND[1]) * 1e4;
    if (v < 0.5) g -= 4 * (0.5 - v) * 1e4;
    return g;
  });
}

/**
 * Minimize loss(r0 + J (x - x0)) + lambda * 100 * |x|_1 within |x| <= max, by proximal gradient (ISTA).
 * The L1 term keeps knobs at exactly zero unless they pay for themselves.
 */
function solve(r0: Rates, J: number[][], x0: number[], lambda: number): number[] {
  const x = x0.slice();
  const predict = (xx: number[]): Rates => r0.map((v, i) => v + J[i].reduce((s, jik, k) => s + jik * (xx[k] - x0[k]), 0));
  // step size from the largest curvature: loss'' <= 6e4 per pair
  let lip = 0;
  for (let k = 0; k < x.length; k++) lip += J.reduce((s, row) => s + row[k] * row[k], 0);
  const step = 1 / (6e4 * Math.max(lip, 1e-6)); // the deck terms curve less (2e4 * DECK_W)
  for (let it = 0; it < 20000; it++) {
    const g = grad(predict(x));
    for (let k = 0; k < x.length; k++) {
      const gk = J.reduce((s, row, i) => s + row[k] * g[i], 0);
      let v = x[k] - step * gk;
      const t = step * lambda * 100;
      v = Math.sign(v) * Math.max(0, Math.abs(v) - t);
      x[k] = Math.max(-o.max, Math.min(o.max, v));
    }
  }
  return x;
}

const toPatch = (x: number[]): Patch => Object.fromEntries(knobs.map((k, i) => [k.id, x[i]]).filter(([, v]) => Math.abs(v as number) > 1e-4));
const toVec = (p: Patch): number[] => knobs.map(k => p[k.id] ?? 0);
const t0 = Date.now();
const elapsed = (): string => `${((Date.now() - t0) / 60000).toFixed(1)}m`;

say(`tune: ${o.pool} @ ${o.cpu}, ${knobs.length} knobs (${o.kinds.join(', ')}), n ${o.n} per deck pair for slopes, ${o.checkN} for checks, lambda ${o.lambda}, band ${BAND.map(b => Math.round(b * 100)).join('-')}`);
let cur: Patch = o.start ? (JSON.parse(readFileSync(o.start, 'utf8')) as { history: Array<{ patch: Patch }> }).history.at(-1)!.patch : {};
let curRates = await rates(cur, o.checkN, 99);
say(`start: ${fmtPatch(cur)}, loss ${total(curRates).toFixed(0)}\n  ${fmt(curRates)}`);
const history: unknown[] = [{ iter: 0, patch: cur, rates: curRates, loss: total(curRates) }];
let J: number[][] = [];

for (let iter = 1; iter <= o.iters; iter++) {
  // slopes at the current patch, with shared dice so the difference is the knob, not luck
  const base = await rates(cur, o.n, iter);
  J = base.map(() => knobs.map(() => 0));
  const probes = await Promise.all(knobs.map(k => rates({ ...cur, [k.id]: (cur[k.id] ?? 0) + o.h }, o.n, iter)));
  probes.forEach((r, k) => r.forEach((v, i) => { J[i][k] = (v - base[i]) / o.h; }));
  say(`iter ${iter} (${elapsed()}): slopes measured; biggest per knob (pts per +10%):`);
  for (let k = 0; k < knobs.length; k++) {
    const top = J.map((row, i) => [i, row[k]] as const).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 3);
    say(`  ${knobs[k].id.padEnd(22)} ${top.map(([i, v]) => `${i < PAIRS.length ? pairLabel(PAIRS[i]) : deckKeys[i - PAIRS.length]} ${(v * 10).toFixed(1)}`).join(', ')}`);
  }
  const x0 = toVec(cur);
  const xNew = solve(curRates, J, x0, o.lambda);
  let cand = roundPatch(toPatch(xNew), knobs);
  let candRates = await rates(cand, o.checkN, 99);
  say(`  proposed: ${fmtPatch(cand)}\n  checked: loss ${total(candRates).toFixed(0)} (was ${total(curRates).toFixed(0)})\n  ${fmt(candRates)}`);
  if (total(candRates) >= total(curRates)) {
    const half = roundPatch(toPatch(x0.map((v, k) => (v + xNew[k]) / 2)), knobs);
    const halfRates = await rates(half, o.checkN, 99);
    say(`  half step: ${fmtPatch(half)} -> loss ${total(halfRates).toFixed(0)}`);
    if (total(halfRates) < total(curRates)) { cand = half; candRates = halfRates; } else { say('  no improvement, stopping'); break; }
  }
  cur = cand;
  curRates = candRates;
  history.push({ iter, patch: cur, rates: curRates, loss: total(curRates), J });
  writeFileSync(join(o.out, 'tune.json'), JSON.stringify({ o, knobs, deckKeys, history, log }, null, 1));
}

// trade-off: fewer knobs vs fit, from the last slopes, each checked with sims
say(`\nsparsity sweep (${elapsed()}):`);
const front: unknown[] = [];
for (const lam of [o.lambda * 4, o.lambda * 2, o.lambda, o.lambda / 2]) {
  const p = roundPatch(toPatch(solve(curRates, J, toVec(cur), lam)), knobs);
  const r = await rates(p, o.checkN, 99);
  say(`  lambda ${lam}: ${Object.keys(p).length} knobs, size ${(l1(p) * 100).toFixed(0)}%, loss ${total(r).toFixed(0)}: ${fmtPatch(p)}`);
  front.push({ lambda: lam, patch: p, rates: r, loss: total(r) });
}
pool.close();
writeFileSync(join(o.out, 'tune.json'), JSON.stringify({ o, knobs, deckKeys, history, front, log, script: toScript(patchOverrides(cur, knobs)) }, null, 1));
say(`done in ${elapsed()}; best: ${fmtPatch(cur)}`);
