// Parallel balance grid: every class against every class over many deck pairings, on all CPU cores.
// Usage: npx tsx scripts/balance.ts [options]   (or npm run balance -- [options])
//   --pools starter,archetype,variant,random,style,style-starter  which deck pools to run, one grid each (default starter,archetype,random)
//                    style = each CPU playstyle with its matching archetype deck; style-starter = each playstyle with the starter
//   --n 40           matches per deck pair (half with each side first)
//   --k 4            random decks per class (random pool) or builds per archetype (variant pool)
//   --classes a,b    only these classes
//   --workers 4      worker threads (default: all cores)
//   --cpu normal     CPU difficulty for both sides (easy, normal, hard)
//   --seed 1         seed for the random and variant decks, so a run can be repeated with the same lists
//   --tick 60        simulation steps per second (the game runs at 60). 30 is ~1.4x faster and within a few points.
//   --check-tick     also run each pool at 60 and print how far --tick moved each cell
//   --cards          also report win rate by card across the decks that ran it
//   --script file    balance script for this run only (same format as the lab's Script box, see src/dev/script.ts)
//   --set line       one script line for this run only (repeatable), e.g. --set "priest.curseMax = 18"
//   --out dir        write report.md and results.json there
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { classIds, cardName } from '../src/dev/simulate';
import { archetypesFor, mythicOf, type PoolKind } from '../src/dev/archetypes';
import { planGrid, runJob, foldGrid, cellRate, cellRange, classTotal, favorable, ruleChecks, WHEEL, FAV, THIN, LOPSIDED, type GridJob, type GridJobResult, type GridReport } from '../src/dev/grid';
import { applyOverrides, overrideCount, type Overrides } from '../src/dev/tuningEdit';
import { parseScript, toScript } from '../src/dev/script';
import { CARDS } from '../src/game/cards';
import type { ClassId } from '../src/art/sprites';
import type { Difficulty } from '../src/game/tuning';

// Workers start from plain JS that registers tsx, then load this same file.
const BOOT = `const { workerData } = require('node:worker_threads');
import('tsx/esm/api').then(m => { m.register(); return import(workerData.file); });`;

if (!isMainThread) {
  applyOverrides((workerData as { ov: Overrides }).ov);
  parentPort!.on('message', (job: GridJob) => parentPort!.postMessage(runJob(job)));
}

function parseArgs(argv: string[]) {
  const o = { pools: ['starter', 'archetype', 'random'] as PoolKind[], n: 40, k: 4, classes: [] as string[], workers: availableParallelism(), seed: 1, cpu: 'normal' as Difficulty, hz: 60, checkTick: false, cards: false, out: '', script: '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], v = (): string => argv[++i] ?? '';
    if (a === '--pools') o.pools = v().split(',') as PoolKind[];
    else if (a === '--n') o.n = Number(v());
    else if (a === '--k') o.k = Number(v());
    else if (a === '--classes') o.classes = v().split(',');
    else if (a === '--workers') o.workers = Number(v());
    else if (a === '--seed') o.seed = Number(v());
    else if (a === '--cpu') o.cpu = v() as Difficulty;
    else if (a === '--tick') o.hz = Number(v());
    else if (a === '--check-tick') o.checkTick = true;
    else if (a === '--cards') o.cards = true;
    else if (a === '--out') o.out = v();
    else if (a === '--script') o.script += readFileSync(v(), 'utf8') + '\n';
    else if (a === '--set') o.script += v() + '\n';
    else throw new Error(`unknown option ${a}`);
  }
  return o;
}

const pct = (v: number): string => (Number.isNaN(v) ? '  - ' : `${Math.round(v * 100)}`.padStart(3) + '%');
const short = (cls: string): string => cls.slice(0, 2).toUpperCase();

/** A fixed set of worker threads fed one deck pair at a time. */
class Pool {
  workers: Worker[] = [];
  private queue: GridJob[] = [];
  private results: GridJobResult[] = [];
  private done = 0;
  private total = 0;
  private finish: () => void = () => {};
  constructor(count: number, ov: Overrides) {
    for (let i = 0; i < count; i++) {
      const w = new Worker(BOOT, { eval: true, workerData: { ov, file: import.meta.url } });
      w.on('message', (r: GridJobResult) => { this.results[r.i] = r; this.done++; this.feed(w); });
      w.on('error', e => { console.error(e); process.exit(1); });
      this.workers.push(w);
    }
  }
  run(jobs: GridJob[]): Promise<GridJobResult[]> {
    this.queue = jobs.slice();
    this.results = [];
    this.done = 0;
    this.total = jobs.length;
    return new Promise(res => {
      this.finish = () => res(this.results);
      if (!jobs.length) return res([]);
      for (const w of this.workers) this.feed(w);
    });
  }
  private feed(w: Worker): void {
    if (process.stderr.isTTY) process.stderr.write(`\r  ${this.done}/${this.total} deck pairs`);
    if (this.done === this.total) { if (process.stderr.isTTY) process.stderr.write('\r' + ' '.repeat(40) + '\r'); this.finish(); return; }
    const j = this.queue.shift();
    if (j) w.postMessage(j);
  }
  close(): void { for (const w of this.workers) void w.terminate(); }
}

async function runPool(pool: Pool, kind: PoolKind, classes: ClassId[], o: ReturnType<typeof parseArgs>, hz = o.hz): Promise<GridReport> {
  const plan = planGrid(classes, kind, o.k, o.seed, o.n, hz, o.cpu);
  const t0 = Date.now();
  const r = foldGrid(plan, await pool.run(plan.jobs));
  console.error(`  ${kind} @${hz}Hz: ${plan.decks.length} decks, ${plan.jobs.length} deck pairs, ${r.matches} matches in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return r;
}

function classGridText(r: GridReport, classes: ClassId[]): string[] {
  const lines = [`${'row wins vs'.padEnd(10)}${classes.map(c => short(c).padStart(5)).join('')}   fav  check`];
  for (const a of classes) {
    const vals = classes.map(b => (a === b ? NaN : cellRate(r.grid[a]?.[b])));
    lines.push(`${a.padEnd(10)}${vals.map(v => pct(v).padStart(5)).join('')}   ${String(favorable(r, a, classes).length).padStart(3)}  ${ruleChecks(r, a, classes).join('; ') || 'ok'}`);
  }
  return lines;
}

function deckTable(r: GridReport, classes: ClassId[]): string[] {
  const lines = [`| Deck | Mythic | ${classes.map(short).join(' | ')} | Overall |`, `|---|---|${classes.map(() => '---:').join('|')}|---:|`];
  for (const d of r.decks) {
    const row = r.deckGrid[d.key] ?? {};
    const tot = Object.values(row).reduce((s, c) => ({ wins: s.wins + c.wins, losses: s.losses + c.losses, draws: s.draws + c.draws }), { wins: 0, losses: 0, draws: 0 });
    lines.push(`| ${d.key} | ${cardName(mythicOf(d.deck))} | ${classes.map(c => (c === d.cls ? '-' : pct(cellRate(row[c])).trim())).join(' | ')} | ${pct(cellRate(tot)).trim()} |`);
  }
  return lines;
}

function cardLines(r: GridReport, classes: ClassId[], minCasts: number): string[] {
  const out: string[] = [];
  for (const cls of classes) {
    const base = cellRate(classTotal(r, cls));
    const rows = Object.entries(r.cards).filter(([id, [n]]) => CARDS[id]?.cls === cls && n >= minCasts)
      .map(([id, [n, w]]) => ({ id, n, wr: w / n })).sort((x, y) => y.wr - x.wr);
    if (!rows.length) continue;
    out.push(`${cls} (class average ${pct(base).trim()}): win % in matches where the card was cast`);
    for (const c of rows) {
      const d = Math.round((c.wr - base) * 100);
      out.push(`  ${cardName(c.id).padEnd(20)} ${pct(c.wr)}  (${c.n} matches, ${d >= 0 ? '+' : ''}${d})`);
    }
  }
  return out;
}

async function main(): Promise<void> {
  const o = parseArgs(process.argv.slice(2));
  const script = parseScript(o.script);
  if (script.errors.length) { console.error(script.errors.join('\n')); process.exit(1); }
  const ov = script.overrides;
  applyOverrides(ov);
  const classes = classIds().filter(c => !o.classes.length || o.classes.includes(c));
  const pool = new Pool(Math.max(1, o.workers), ov);
  console.error(`balance: ${classes.join(', ')} | pools ${o.pools.join(', ')} | ${o.n} matches per deck pair | ${o.cpu} CPU | ${o.hz}Hz | ${pool.workers.length} workers`);
  if (overrideCount(ov)) console.error(`  script:\n${toScript(ov).replace(/^/gm, '    ')}`);
  const reports: GridReport[] = [];
  for (const kind of o.pools) reports.push(await runPool(pool, kind, classes, o));
  if (o.checkTick) {
    for (const r of reports) {
      const ref = await runPool(pool, r.kind, classes, o, 60);
      const perCell = ref.matches / (classes.length * (classes.length - 1) / 2);
      console.log(`\n== ${r.kind}: ${o.hz}Hz minus 60Hz, per cell (two same-speed runs differ by about +-${(100 * 1.4 / Math.sqrt(perCell)).toFixed(1)} from chance alone) ==`);
      let worst = 0, sum = 0, cells = 0;
      for (const a of classes) {
        console.log(`${a.padEnd(10)}${classes.map(b => {
          if (a === b) return '    -';
          const d = (cellRate(r.grid[a]?.[b]) - cellRate(ref.grid[a]?.[b])) * 100;
          worst = Math.max(worst, Math.abs(d)); sum += Math.abs(d); cells++;
          return `${d >= 0 ? '+' : ''}${d.toFixed(0)}`.padStart(5);
        }).join('')}`);
      }
      console.log(`mean |diff| ${(sum / cells).toFixed(1)} points, worst ${worst.toFixed(0)}; avg match ${r.avgTime.toFixed(1)}s vs ${ref.avgTime.toFixed(1)}s`);
    }
  }
  pool.close();

  const md: string[] = [`# Balance grid`, '', `Classes: ${classes.join(', ')}. ${o.n} matches per deck pair (sides alternate), ${o.cpu} CPU on both sides, ${o.hz} steps per second, seed ${o.seed}.`, ''];
  if (overrideCount(ov)) md.push('Script for this run:', '', '```', toScript(ov), '```', '');
  md.push(`Rules checked: every class has at least 2 favorable matchups (over ${FAV * 100}%, flagged thin under ${THIN * 100}%), nothing at or past ${LOPSIDED * 100}-${100 - LOPSIDED * 100}, and each class beats its two intended counters (${Object.entries(WHEEL).map(([a, bs]) => `${a} > ${bs.join(', ')}`).join('; ')}).`, '');
  for (const r of reports) {
    const text = classGridText(r, classes);
    console.log(`\n== ${r.kind} decks (${r.decks.length} decks, ${r.matches} matches, avg match ${r.avgTime.toFixed(0)}s) ==`);
    console.log(text.join('\n'));
    md.push(`## ${r.kind} decks`, '', `${r.decks.length} decks, ${r.matches} matches, average match ${r.avgTime.toFixed(0)}s.`, '', '```', ...text, '```', '');
    md.push('95% ranges for each cell:', '', `| | ${classes.map(short).join(' | ')} |`, `|---|${classes.map(() => '---').join('|')}|`);
    for (const a of classes) md.push(`| ${a} | ${classes.map(b => { if (a === b) return '-'; const [lo, hi] = cellRange(r.grid[a]?.[b]); return `${Math.round(lo * 100)}-${Math.round(hi * 100)}`; }).join(' | ')} |`);
    md.push('');
    if (r.kind !== 'starter') md.push('By deck (row deck\'s win % against each class):', '', ...deckTable(r, classes), '');
    if (o.cards) {
      const cl = cardLines(r, classes, Math.max(10, o.n));
      console.log(cl.join('\n'));
      md.push('Card win rates (far above the class average: a card to look at; far below: dead weight):', '', '```', ...cl, '```', '');
    }
  }
  if (o.out) {
    mkdirSync(o.out, { recursive: true });
    writeFileSync(join(o.out, 'report.md'), md.join('\n'));
    const pools = reports.map(r => ({ kind: r.kind, grid: r.grid, deckGrid: r.deckGrid, cards: r.cards, decks: r.decks.map(d => ({ key: d.key, deck: d.deck })) }));
    writeFileSync(join(o.out, 'results.json'), JSON.stringify({ classes, n: o.n, seed: o.seed, hz: o.hz, overrides: ov, archetypes: Object.fromEntries(classes.map(c => [c, archetypesFor(c).map(a => ({ id: a.id, name: a.name, plan: a.plan }))])), pools }, null, 1));
    console.error(`  wrote ${join(o.out, 'report.md')} and results.json`);
  }
}

if (isMainThread) await main();
