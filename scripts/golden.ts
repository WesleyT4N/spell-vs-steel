// Golden behavior check for refactors: plays a fixed set of CPU-vs-CPU matches with Math.random seeded, and
// prints one line per match (frames, winner, HP left, a rolling battle hash) plus a digest of the content tables.
// A pure refactor must reproduce scripts/golden.txt exactly; a gameplay change regenerates it in the same PR.
// Usage: npx tsx scripts/golden.ts            print to stdout
//        npx tsx scripts/golden.ts --write    rewrite scripts/golden.txt
//        npx tsx scripts/golden.ts --check    exit 1 if the output differs from scripts/golden.txt
import { readFileSync, writeFileSync } from 'node:fs';
import { Battle, type Intent } from '../src/game/battle';
import { Cpu } from '../src/game/ai';
import { ALL_CARDS } from '../src/game/cards';
import { CLASS_IDS, CLASS_INFO } from '../src/game/classes';
import { presetsFor, toList } from '../src/game/deck';
import { TUNING } from '../src/game/tuning';
import { battleHash } from '../src/net/hash';
import { seeded } from '../src/game/rng';

const FILE = new URL('./golden.txt', import.meta.url);
const SEEDS = 4;
const DT = 1 / 60;
const MAX_FRAMES = 60 * 300;

const fnv = (s: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
};

const out: string[] = [];

// Content tables: everything but the cast functions, in registry order.
out.push(`cards ${fnv(JSON.stringify(ALL_CARDS.map(c => [c.id, c.name, c.cls, c.cost, c.rarity, c.element, c.damaging, c.lock ?? null, c.dmg, c.gain ?? null, c.needsStealth ?? false, c.short, !!c.ai])))}`);
out.push(`classes ${fnv(JSON.stringify([CLASS_IDS, CLASS_IDS.map(c => CLASS_INFO[c])]))}`);
out.push(`decks ${fnv(JSON.stringify(CLASS_IDS.map(c => presetsFor(c))))}`);
out.push(`tuning ${fnv(JSON.stringify(TUNING))}`);

const realRandom = Math.random;
for (const a of CLASS_IDS) {
  for (const bc of CLASS_IDS) {
    const pa = presetsFor(a), pb = presetsFor(bc);
    for (let s = 0; s < SEEDS; s++) {
      // walk the preset lists so every Mythic deck gets played
      const i = (CLASS_IDS.indexOf(bc) + s) % pa.length, j = (CLASS_IDS.indexOf(a) + s) % pb.length;
      const seed = 7000 + CLASS_IDS.indexOf(a) * 100 + CLASS_IDS.indexOf(bc) * 10 + s;
      Math.random = seeded(seed * 31 + 5);
      const b = new Battle({ cls: a, deck: toList(pa[i].cards), name: 'A' }, { cls: bc, deck: toList(pb[j].cards), name: 'B' }, seed);
      const cpus = [new Cpu('normal'), new Cpu(s % 2 ? 'easy' : 'normal')];
      let frame = 0, roll = '';
      while (b.phase !== 'over' && frame < MAX_FRAMES) {
        if (b.phase === 'custom') b.endCustom([cpus[0].pick(b, b.f[0]), cpus[1].pick(b, b.f[1])]);
        else if (b.canOpenCustom() && Math.random() < 0.02) b.beginCustom();
        const intents: [Intent, Intent] = [cpus[0].intent(b, b.f[0], DT), cpus[1].intent(b, b.f[1], DT)];
        b.update(DT, intents);
        frame++;
        if (frame % 30 === 0) roll = fnv(roll + battleHash(b));
      }
      roll = fnv(roll + battleHash(b));
      out.push(`${a} ${pa[i].id} vs ${bc} ${pb[j].id} seed ${seed}: ${frame} frames, winner ${b.winner ?? '-'}, hp ${Math.round(b.f[0].hp)}/${Math.round(b.f[1].hp)}, turns ${b.turn}, hash ${roll}`);
    }
  }
}
Math.random = realRandom;

const text = out.join('\n') + '\n';
const mode = process.argv[2];
if (mode === '--write') {
  writeFileSync(FILE, text);
  console.log(`wrote ${out.length} lines to scripts/golden.txt`);
} else if (mode === '--check') {
  const want = readFileSync(FILE, 'utf8').split('\n'), got = text.split('\n');
  const diff = got.map((g, k) => (g === want[k] ? null : `- ${want[k] ?? '(missing)'}\n+ ${g}`)).filter(Boolean);
  if (want.length !== got.length) diff.push(`line count ${want.length} -> ${got.length}`);
  if (diff.length) {
    console.log(diff.slice(0, 20).join('\n'));
    console.log(`golden: ${diff.length} difference(s). If gameplay was meant to change, run npm run golden:write and commit it.`);
    process.exit(1);
  }
  console.log(`golden: all ${out.length} lines match`);
} else process.stdout.write(text);
