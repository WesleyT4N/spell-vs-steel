// The full balance sweep: every class against every class at every CPU level, over the shipped decks
// (starter + Mythic decks) played in every CPU playstyle, the starters alone, and random legal decks.
// Usage: npx tsx scripts/sweep.ts --out dir [--cpu easy,normal,hard] [--n 200] [--starter-n 4000] [--random-k 12 --random-n 40]
//        [--script file] [--set "hp.mage = 700"]   (balance script applied to every match, see src/dev/script.ts)
// Writes dir/sweep.json (raw results per deck pair, card casts included) and prints the class grids.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { classIds } from '../src/dev/simulate';
import { parseScript, toScript } from '../src/dev/script';
import { styleFor } from '../src/game/playstyles';
import type { Difficulty } from '../src/game/tuning';
import type { PoolKind } from '../src/dev/archetypes';
import { SimPool } from './simpool';
import { PAIRS, classRates, evaluate, loss, pairLabel } from './balancelib';

const o = { out: '', cpu: ['easy', 'normal', 'hard'] as Difficulty[], n: 200, starterN: 4000, randomK: 12, randomN: 40, script: '', seed: 1 };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i], v = (): string => argv[++i] ?? '';
  if (a === '--out') o.out = v();
  else if (a === '--cpu') o.cpu = v().split(',') as Difficulty[];
  else if (a === '--n') o.n = Number(v());
  else if (a === '--starter-n') o.starterN = Number(v());
  else if (a === '--random-k') o.randomK = Number(v());
  else if (a === '--random-n') o.randomN = Number(v());
  else if (a === '--seed') o.seed = Number(v());
  else if (a === '--script') o.script += readFileSync(v(), 'utf8') + '\n';
  else if (a === '--set') o.script += v() + '\n';
  else throw new Error(`unknown option ${a}`);
}
if (!o.out) throw new Error('--out dir is required');
const script = parseScript(o.script);
if (script.errors.length) { console.error(script.errors.join('\n')); process.exit(1); }
const ov = script.overrides;

const classes = classIds();
const pool = new SimPool();
const runs: unknown[] = [];
const t0 = Date.now();
let total = 0;
console.error(`sweep: ${pool.size} workers${o.script.trim() ? `, script:\n${toScript(ov)}` : ''}`);

const pools: Array<{ kind: PoolKind; n: number; k?: number }> = [
  { kind: 'preset-style', n: o.n },
  { kind: 'starter', n: o.starterN },
  ...(o.randomK > 0 ? [{ kind: 'random' as PoolKind, n: o.randomN, k: o.randomK }] : []),
];
for (const cpu of o.cpu) {
  for (const p of pools) {
    const t = Date.now();
    const { plan, res } = await evaluate(pool, { kind: p.kind, cpu, n: p.n, k: p.k, seed: o.seed, classes }, ov);
    const matches = res.reduce((s, r) => s + r.wins + r.losses + r.draws, 0);
    total += matches;
    const all = classRates(plan, res);
    const lines = [`== ${cpu} / ${p.kind}: ${plan.decks.length} decks, ${matches} matches in ${((Date.now() - t) / 1000).toFixed(0)}s, loss ${loss(all.rates).toFixed(0)} ==`];
    lines.push(PAIRS.map((pr, i) => `${pairLabel(pr)} ${(all.rates[i] * 100).toFixed(1)}`).join(' | '));
    if (p.kind === 'preset-style' && cpu !== 'normal') {
      // the styles this level actually brings: Easy its aggro style, Hard the counter-pick
      const shipped = classRates(plan, res, i => {
        const [a, b] = plan.pairs[i];
        return a.style === styleFor(a.cls, cpu, b.cls).id && b.style === styleFor(b.cls, cpu, a.cls).id;
      });
      lines.push(`  as shipped (${cpu} style picks): ${PAIRS.map((pr, i) => `${pairLabel(pr)} ${(shipped.rates[i] * 100).toFixed(1)}`).join(' | ')}`);
    }
    console.log(lines.join('\n'));
    runs.push({
      cpu, kind: p.kind, n: p.n,
      decks: plan.decks.map(d => ({ key: d.key, cls: d.cls, name: d.name, style: d.style ?? 'balanced', deck: d.deck })),
      pairs: plan.pairs.map(([a, b], i) => ({ a: a.key, b: b.key, w: res[i].wins, l: res[i].losses, d: res[i].draws, t: Math.round(res[i].time), ca: res[i].casts[0], cb: res[i].casts[1] })),
    });
  }
}
pool.close();
mkdirSync(o.out, { recursive: true });
writeFileSync(join(o.out, 'sweep.json'), JSON.stringify({ classes, overrides: ov, script: toScript(ov), matches: total, seconds: (Date.now() - t0) / 1000, runs }));
console.error(`${total} matches in ${((Date.now() - t0) / 1000).toFixed(0)}s; wrote ${join(o.out, 'sweep.json')}`);
