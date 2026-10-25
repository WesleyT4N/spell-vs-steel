// Headless CPU-vs-CPU simulation: catches crashes and reports match stats.
// Usage: npx tsx scripts/sim.ts [matches]
import { Battle } from '../src/game/battle';
import { Cpu } from '../src/game/ai';
import { starterDeck, toList } from '../src/game/deck';
import type { ClassId } from '../src/art/sprites';

const N = Number(process.argv[2] ?? 20);
const pairs: Array<[ClassId, ClassId]> = [['warrior', 'mage'], ['mage', 'warrior'], ['warrior', 'warrior'], ['mage', 'mage']];
for (const [a, bCls] of pairs) {
  const wins = [0, 0];
  let totalTime = 0, timeouts = 0, turns = 0;
  const dmg = { basic: 0, spell: 0, other: 0 };
  for (let i = 0; i < N; i++) {
    const b = new Battle({ cls: a, deck: toList(starterDeck(a)), name: 'A' }, { cls: bCls, deck: toList(starterDeck(bCls)), name: 'B' });
    const cpus = [new Cpu('normal'), new Cpu('normal')];
    const dt = 1 / 60;
    let t = 0;
    while (b.phase !== 'over' && t < 600) {
      if (b.phase === 'custom') b.endCustom([cpus[0].pick(b, b.f[0]), cpus[1].pick(b, b.f[1])]);
      else if (b.canOpenCustom() && Math.random() < 0.02) b.beginCustom();
      b.update(dt, [cpus[0].intent(b, b.f[0], dt), cpus[1].intent(b, b.f[1], dt)]);
      t += dt;
    }
    if (b.winner === null) timeouts++; else wins[b.winner]++;
    totalTime += t;
    turns += b.turn;
    for (const st of b.stats) { dmg.basic += st.basic; dmg.spell += st.spell; dmg.other += st.other; }
  }
  console.log(`${a} vs ${bCls}: wins ${wins[0]}-${wins[1]}, timeouts ${timeouts}, avg ${(totalTime / N).toFixed(0)}s, avg turns ${(turns / N).toFixed(1)}, dmg basic/spell/other ${dmg.basic}/${dmg.spell}/${dmg.other}`);
}
