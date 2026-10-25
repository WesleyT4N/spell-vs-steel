// Headless CPU-vs-CPU simulation: catches crashes and reports match stats.
// Usage: npx tsx scripts/sim.ts [matches] [--cards]
//   --cards  also prints per-card casts, damage and win rate when cast, per matchup
import { classIds, runSeries, starterSpec, cardName, wilson } from '../src/dev/simulate';
import type { ClassId } from '../src/art/sprites';

const args = process.argv.slice(2);
const N = Number(args.find(a => /^\d+$/.test(a)) ?? 20);
const showCards = args.includes('--cards');
const pct = (v: number): string => `${Math.round(v * 100)}%`;

const pairs: Array<[ClassId, ClassId]> = [];
const ids = classIds();
for (const a of ids) for (const b of ids) if (a !== b) pairs.push([a, b]);
for (const a of ids) pairs.push([a, a]);

for (const [a, bCls] of pairs) {
  const s = runSeries(starterSpec(a), starterSpec(bCls), N);
  const dmg = { basic: 0, spell: 0, other: 0 };
  for (const sp of s.split) { dmg.basic += sp.basic; dmg.spell += sp.spell; dmg.other += sp.other; }
  const [lo, hi] = wilson(s.wins[0], s.n - s.draws);
  console.log(`${a} vs ${bCls}: wins ${s.wins[0]}-${s.wins[1]} (95% ${pct(lo)}-${pct(hi)}), timeouts ${s.draws}, avg ${(s.time / N).toFixed(0)}s, avg turns ${(s.turns / N).toFixed(1)}, dmg basic/spell/other ${dmg.basic}/${dmg.spell}/${dmg.other}`);
  if (!showCards) continue;
  for (const side of [0, 1] as const) {
    const cls = side === 0 ? a : bCls;
    const rows = [...s.cards.values()].filter(c => c.side === side).sort((x, y) => y.dmg - x.dmg);
    const total = Object.values(s.split[side]).reduce((x, y) => x + y, 0) || 1;
    console.log(`  ${cls} (side ${side}): card, casts/match, dmg/cast, share of side dmg, win% when cast`);
    for (const c of rows) {
      const per = c.casts ? Math.round(c.dmg / c.casts) : 0;
      const wr = c.castIn ? pct(c.castWins / c.castIn) : '-';
      console.log(`    ${cardName(c.id).padEnd(20)} ${(c.casts / c.matches).toFixed(2).padStart(5)} ${String(per).padStart(5)} ${pct(c.dmg / total).padStart(5)} ${wr.padStart(5)}`);
    }
  }
}
