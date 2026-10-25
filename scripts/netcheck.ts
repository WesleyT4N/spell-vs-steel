// Determinism check for online play: two battles built from the same seed and fed the same inputs
// must stay identical frame for frame. Usage: npx tsx scripts/netcheck.ts [matches]
import { Battle, type Intent, type Dir } from '../src/game/battle';
import { Cpu } from '../src/game/ai';
import { starterDeck, toList } from '../src/game/deck';
import { battleHash } from '../src/net/hash';
import { seeded } from '../src/game/rng';
import { CLASS_IDS } from '../src/game/classes';

const N = Number(process.argv[2] ?? 20);
const classes = CLASS_IDS;
let failures = 0;
for (let m = 0; m < N; m++) {
  const seed = 1000 + m;
  const a = classes[m % classes.length], bc = classes[Math.floor(m / classes.length) % classes.length];
  const make = (): Battle => new Battle({ cls: a, deck: toList(starterDeck(a)), name: 'A' }, { cls: bc, deck: toList(starterDeck(bc)), name: 'B' }, seed);
  const x = make(), y = make();
  // inputs come from CPUs driving battle x (their own Math.random is fine: the intents are what get shared)
  const cpus = [new Cpu('normal'), new Cpu('normal')];
  const pickRng = seeded(seed * 7);
  const dt = 1 / 60;
  let frame = 0, bad = -1;
  while (x.phase !== 'over' && frame < 60 * 300) {
    if (x.phase === 'custom') {
      const picks: [number[], number[]] = [cpus[0].pick(x, x.f[0]), cpus[1].pick(x, x.f[1])];
      if (pickRng() < 0.2) picks[1] = [];
      x.endCustom([picks[0].slice(), picks[1].slice()]);
      y.endCustom([picks[0].slice(), picks[1].slice()]);
    }
    const intents: [Intent, Intent] = [cpus[0].intent(x, x.f[0], dt), cpus[1].intent(x, x.f[1], dt)];
    const copy = intents.map(i => ({ ...i, move: i.move as Dir | null })) as [Intent, Intent];
    if (x.canOpenCustom() && pickRng() < 0.02) { x.beginCustom(); y.beginCustom(); }
    x.update(dt, intents);
    y.update(dt, copy);
    frame++;
    if (battleHash(x) !== battleHash(y)) { bad = frame; break; }
  }
  if (bad >= 0) { failures++; console.log(`match ${m}: DESYNC at frame ${bad}`); }
  else console.log(`match ${m}: ${a} vs ${bc}, ${frame} frames, in sync (winner ${x.winner})`);
}
// different seeds should give different battles
const d1 = new Battle({ cls: 'mage', deck: toList(starterDeck('mage')), name: 'A' }, { cls: 'mage', deck: toList(starterDeck('mage')), name: 'B' }, 1);
const d2 = new Battle({ cls: 'mage', deck: toList(starterDeck('mage')), name: 'A' }, { cls: 'mage', deck: toList(starterDeck('mage')), name: 'B' }, 2);
if (d1.offer[0].join() === d2.offer[0].join() && d1.offer[1].join() === d2.offer[1].join()) console.log('warning: seeds 1 and 2 drew the same hands');
console.log(failures ? `${failures} desync(s)` : 'all in sync');
process.exit(failures ? 1 : 0);
