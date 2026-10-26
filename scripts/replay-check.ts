// Replays must play back exactly: record CPU vs CPU rounds the way the battle scene runs them (Draw
// screens that sit open for a while, ticking), play each tape into a fresh battle, and compare
// checksums every frame and at the end. Usage: npx tsx scripts/replay-check.ts [rounds]
import { Battle, NO_INTENT, type Intent } from '../src/game/battle';
import { Cpu } from '../src/game/ai';
import { starterDeck, toList } from '../src/game/deck';
import { battleHash } from '../src/net/hash';
import { CLASS_IDS } from '../src/game/classes';
import { recordRound, TapePlayer, type RoundTape } from '../src/game/replay';

const N = Number(process.argv[2] ?? 25);
const dt = 1 / 60;
let failures = 0;
for (let m = 0; m < N; m++) {
  const a = CLASS_IDS[m % CLASS_IDS.length], c = CLASS_IDS[Math.floor(m / CLASS_IDS.length) % CLASS_IDS.length];
  const b = new Battle({ cls: a, deck: toList(starterDeck(a)), name: 'A' }, { cls: c, deck: toList(starterDeck(c)), name: 'B' });
  let tape: RoundTape | null = null;
  recordRound(b, t => { tape = t; });
  const cpus = [new Cpu('normal'), new Cpu('normal')];
  const hashes: number[] = [];
  let customT = 0, frames = 0;
  while (!tape && frames < 60 * 400) {
    if (b.phase === 'custom') {
      // the Draw screen stays up a random while, and the battle keeps ticking under it
      if ((customT += dt) > 0.5 + Math.random()) { customT = 0; b.endCustom([cpus[0].pick(b, b.f[0]), Math.random() < 0.2 ? [] : cpus[1].pick(b, b.f[1])]); }
      else { b.update(dt, [NO_INTENT, NO_INTENT]); hashes.push(battleHash(b)); frames++; continue; }
    }
    if (b.canOpenCustom() && Math.random() < 0.02) { b.beginCustom(); continue; }
    const ins: [Intent, Intent] = [cpus[0].intent(b, b.f[0], dt), cpus[1].intent(b, b.f[1], dt)];
    b.update(dt, ins);
    hashes.push(battleHash(b));
    frames++;
  }
  const t = tape as RoundTape | null;
  // CPUs can stall a round for minutes; that says nothing about replays
  if (!t) { console.log(`round ${m}: ${a} vs ${c} still going after 400s, skipped`); continue; }
  const p = new TapePlayer(JSON.parse(JSON.stringify(t)) as RoundTape);
  let bad = -1;
  while (p.step()) if (battleHash(p.b) !== hashes[p.i - 1]) { bad = p.i; break; }
  const size = JSON.stringify(t).length;
  if (bad >= 0 || !p.matches) { failures++; console.log(`round ${m}: ${a} vs ${c} MISMATCH at update ${bad}`); }
  else console.log(`round ${m}: ${a} vs ${c}, ${t.n} updates, ${t.events.length} draw events, ${(size / 1024).toFixed(1)} KB, plays back exactly (winner ${t.winner})`);
}
console.log(failures ? `${failures} bad replay(s)` : 'all replays play back exactly');
process.exit(failures ? 1 : 0);
