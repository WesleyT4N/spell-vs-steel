// Headless Expedition fights: the CPU plays each class against every pack of an act, its elites and its boss.
// Act 1 uses the Expedition starter; later acts the full class starter (about what a run has drafted by then).
// Catches crashes and reports win rate and HP lost, for tuning monster numbers.
// Usage: npx tsx scripts/expedition-check.ts [fights per pack] [easy|normal|hard] [act=1|2|3]
import { Cpu } from '../src/game/ai';
import { styleById } from '../src/game/playstyles';
import { PLAYABLE } from '../src/game/classes';
import { defaultSkin } from '../src/art/sprites';
import { newRun, makeFight, ACTS } from '../src/game/expedition';
import { starterDeck } from '../src/game/deck';
import { MOBS } from '../src/game/mobs';
import type { Difficulty } from '../src/game/tuning';

const args = process.argv.slice(2);
const N = Number(args.find(a => /^\d+$/.test(a)) ?? 10);
const level = (args.find(a => /^(easy|normal|hard)$/.test(a)) ?? 'normal') as Difficulty;
const actArg = args.find(a => a.startsWith('act='));
const acts = actArg ? [Number(actArg.slice(4)) - 1] : [0, 1, 2];
const DT = 1 / 30, LIMIT = 300;
let failures = 0;

for (const act of acts) for (const cls of PLAYABLE) {
  const A = ACTS[act], packs = [...A.early, ...A.late, ...A.elites, [A.boss]];
  const rows: string[] = [];
  for (const pack of packs) {
    let wins = 0, lost = 0, secs = 0;
    for (let i = 0; i < N; i++) {
      const run = newRun(cls, defaultSkin(cls), 1000 + i);
      if (act > 0) run.deck = starterDeck(cls);
      const b = makeFight(run, pack, 77 + i * 31);
      const cpu = new Cpu(level, styleById(''));
      let t = 0;
      while (b.phase !== 'ko' && b.phase !== 'over' && t < LIMIT) {
        if (b.phase === 'custom') b.endCustom([cpu.pick(b, b.f[0]), []]);
        else if (cpu.wantsDraw(b, b.f[0], DT)) b.beginCustom();
        b.update(DT, [cpu.intent(b, b.f[0], DT), { move: null, held: null, attackPressed: false, attackHeld: false, castPressed: false }]);
        t += DT;
      }
      if (b.winner === 0) wins++;
      lost += 1 - Math.max(0, b.f[0].hp) / b.f[0].maxHp;
      secs += t;
      if (t >= LIMIT) failures++;
    }
    rows.push(`  ${pack.map(k => MOBS[k].name).join(' + ').padEnd(40)} win ${String(Math.round((wins / N) * 100)).padStart(3)}%  hp lost ${String(Math.round((lost / N) * 100)).padStart(3)}%  ${Math.round(secs / N)}s`);
  }
  console.log(`${A.name}: ${cls} (${level} CPU)`);
  console.log(rows.join('\n'));
}
if (failures) { console.log(`${failures} fights hit the ${LIMIT}s limit`); }
