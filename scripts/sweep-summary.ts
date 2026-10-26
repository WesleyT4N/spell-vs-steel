// Folds one or more sweep.json files (scripts/sweep.ts) into a compact summary for the balance report.
// Usage: npx tsx scripts/sweep-summary.ts out.json label=dir/sweep.json [label=dir/sweep.json ...]
import { readFileSync, writeFileSync } from 'node:fs';
import { styleFor } from '../src/game/playstyles';
import { cardName } from '../src/dev/simulate';
import { CARDS } from '../src/game/cards';
import type { ClassId } from '../src/art/sprites';
import type { Difficulty } from '../src/game/tuning';

interface Deck { key: string; cls: ClassId; name: string; style: string }
interface Pair { a: string; b: string; w: number; l: number; d: number; t: number; ca: Record<string, [number, number]>; cb: Record<string, [number, number]> }
interface Run { cpu: Difficulty; kind: string; n: number; decks: Deck[]; pairs: Pair[] }
interface Sweep { classes: ClassId[]; script: string; matches: number; seconds: number; runs: Run[] }

type Tally = Record<string, Record<string, [number, number]>>;
const bump = (t: Tally, r: string, c: string, w: number, l: number): void => {
  const x = ((t[r] ??= {})[c] ??= [0, 0]);
  x[0] += w; x[1] += l;
};
const rate = (x?: [number, number]): number | null => (x && x[0] + x[1] ? Math.round(1000 * x[0] / (x[0] + x[1])) / 10 : null);
const table = (t: Tally): Record<string, Record<string, number | null>> =>
  Object.fromEntries(Object.entries(t).map(([r, row]) => [r, Object.fromEntries(Object.entries(row).map(([c, x]) => [c, rate(x)]))]));
const total = (row: Record<string, [number, number]> = {}): [number, number] =>
  Object.values(row).reduce<[number, number]>((s, x) => [s[0] + x[0], s[1] + x[1]], [0, 0]);

function summarize(s: Sweep) {
  const out: Record<string, unknown> = { script: s.script, matches: s.matches, seconds: s.seconds, runs: [] as unknown[] };
  for (const run of s.runs) {
    const deck = Object.fromEntries(run.decks.map(d => [d.key, d]));
    const cls: Tally = {}, shipped: Tally = {}, byDeck: Tally = {}, byStyle: Tally = {};
    const cards: Record<string, [number, number]> = {};
    let matches = 0, time = 0, draws = 0;
    for (const p of run.pairs) {
      const A = deck[p.a], B = deck[p.b];
      matches += p.w + p.l + p.d; time += p.t; draws += p.d;
      bump(cls, A.cls, B.cls, p.w, p.l); bump(cls, B.cls, A.cls, p.l, p.w);
      if (run.kind === 'preset-style') {
        const ship = run.cpu === 'normal' || (A.style === styleFor(A.cls, run.cpu, B.cls).id && B.style === styleFor(B.cls, run.cpu, A.cls).id);
        if (ship) { bump(shipped, A.cls, B.cls, p.w, p.l); bump(shipped, B.cls, A.cls, p.l, p.w); }
        const dk = (d: Deck): string => d.key.split('/')[0];
        bump(byDeck, dk(A), B.cls, p.w, p.l); bump(byDeck, dk(B), A.cls, p.l, p.w);
        bump(byStyle, `${A.cls}:${A.style}`, B.cls, p.w, p.l); bump(byStyle, `${B.cls}:${B.style}`, A.cls, p.l, p.w);
      }
      if (run.kind === 'random') { bump(byDeck, p.a, B.cls, p.w, p.l); bump(byDeck, p.b, A.cls, p.l, p.w); }
      for (const [id, [n, w]] of [...Object.entries(p.ca), ...Object.entries(p.cb)]) {
        const c = (cards[id] ??= [0, 0]);
        c[0] += n; c[1] += w;
      }
    }
    const names = Object.fromEntries(run.decks.map(d => [d.key.split('/')[0], d.name.replace(/ \(.*\)$/, '')]));
    const classAvg = Object.fromEntries(Object.entries(cls).map(([c, row]) => [c, rate(total(row))]));
    out.runs = [...(out.runs as unknown[]), {
      cpu: run.cpu, kind: run.kind, matches, draws, avgTime: Math.round(10 * time / Math.max(1, matches)) / 10,
      grid: table(cls), classAvg,
      shipped: run.kind === 'preset-style' ? table(shipped) : undefined,
      decks: Object.entries(byDeck).map(([k, row]) => ({ key: k, cls: k.split(':')[0], name: names[k] ?? k, overall: rate(total(row)), vs: table({ x: row }).x })),
      styles: Object.entries(byStyle).map(([k, row]) => ({ key: k, overall: rate(total(row)), vs: table({ x: row }).x })),
      cards: Object.entries(cards).filter(([id, [n]]) => CARDS[id] && n >= 200).map(([id, [n, w]]) => ({ id, name: cardName(id), cls: CARDS[id].cls, rarity: CARDS[id].rarity, n, wr: Math.round(1000 * w / n) / 10, delta: Math.round(1000 * w / n - 10 * (classAvg[CARDS[id].cls] ?? 50)) / 10 })),
    }];
  }
  return out;
}

const [outFile, ...inputs] = process.argv.slice(2);
const res: Record<string, unknown> = {};
for (const arg of inputs) {
  const [label, file] = arg.split('=');
  res[label] = summarize(JSON.parse(readFileSync(file, 'utf8')) as Sweep);
}
writeFileSync(outFile, JSON.stringify(res));
console.error(`wrote ${outFile}`);
