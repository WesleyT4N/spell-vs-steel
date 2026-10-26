// Scripted full matches: CPU vs CPU for every class pair (mirrors included), with the starter and every
// ready-made deck, at each CPU level. Every match is seeded, so a failure prints a seed that replays it.
// Each frame checks invariants that should never break whatever the balance is (HP and resources in range,
// fighters on the grid and apart, nothing piling up), and each match must end in a KO within the time limit.
// Usage: npx tsx tests/matches.ts [--quick] [--rounds 3] [--only warrior,mage] [--seed 123]
import { Battle, COLS, ROWS, type Fighter } from '../src/game/battle';
import { Cpu } from '../src/game/ai';
import { presetsFor, toList, validate, type DeckCounts } from '../src/game/deck';
import { battleHash } from '../src/net/hash';
import { seeded } from '../src/game/rng';
import { TUNING, type Difficulty } from '../src/game/tuning';
import { classIds } from '../src/dev/simulate';
import type { ClassId } from '../src/art/sprites';

const args = process.argv.slice(2);
const quick = args.includes('--quick');
const flag = (name: string): string | undefined => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const only = flag('--only')?.split(',') as ClassId[] | undefined;
const oneSeed = flag('--seed');
/** How many times each pairing is played, on different seeds. */
const rounds = Number(flag('--rounds') ?? (quick || oneSeed ? 1 : 3));

const DT = 1 / 60;
/** No real match comes close to this; a match that runs past it has stalled. */
const LIMIT = 300;
/** Lists that grow without bound mean something is never cleaned up. */
const PILE = 400;
const levels = Object.keys(TUNING.cpu) as Difficulty[];

interface Spec { cls: ClassId; deck: DeckCounts; label: string }
interface Case { a: Spec; b: Spec; cpu: [Difficulty, Difficulty]; seed: number }

const classes = classIds().filter(c => !only || only.includes(c));
let failures = 0;
const fail = (c: Case, msg: string): void => {
  failures++;
  console.log(`FAIL ${c.a.cls}/${c.a.label} vs ${c.b.cls}/${c.b.label} (${c.cpu.join('/')}, seed ${c.seed}): ${msg}`);
};

// every ready-made deck must be a legal grimoire, or the CPU and the player fight with something the builder refuses
for (const cls of classes) for (const p of presetsFor(cls)) {
  const errs = validate(p.cards);
  if (errs.length) { failures++; console.log(`FAIL deck ${cls}/${p.id} is not legal: ${errs.join('; ')}`); }
}

function checkFighter(f: Fighter): string | null {
  const who = `side ${f.side} (${f.cls})`;
  if (!Number.isFinite(f.hp) || !Number.isFinite(f.maxHp)) return `${who} HP is ${f.hp}/${f.maxHp}`;
  if (f.hp > f.maxHp + 1e-6) return `${who} HP ${f.hp} over max ${f.maxHp}`;
  // Mage Mana can go over the bar on purpose (bonus Mana carried into a turn); every other resource stops at its cap
  const cap = f.cls === 'mage' ? 99 : f.resMax;
  if (!Number.isFinite(f.res) || f.res < -1e-6 || f.res > cap + 1e-6) return `${who} resource ${f.res} outside 0..${cap}`;
  if (f.resMax > 5) return `${who} resource cap ${f.resMax} over 5`;
  if (!Number.isInteger(f.col) || !Number.isInteger(f.row) || f.col < 0 || f.col >= COLS || f.row < 0 || f.row >= ROWS) return `${who} off the grid at ${f.col},${f.row}`;
  return null;
}

/**
 * Plays one match. The CPUs seed their rolls from the battle, so the whole match replays from `seed`.
 * Math.random gets a different stream on every play, so a rule or CPU roll that still leans on it shows up as a failed replay.
 */
let plays = 0;
function play(c: Case): { b: Battle; hashes: number[] } | null {
  const real = Math.random;
  Math.random = seeded(++plays * 7919);
  try {
    const b = new Battle({ cls: c.a.cls, deck: toList(c.a.deck), name: 'A' }, { cls: c.b.cls, deck: toList(c.b.deck), name: 'B' }, c.seed);
    const cpus = [new Cpu(c.cpu[0]), new Cpu(c.cpu[1])];
    const hashes: number[] = [];
    let frame = 0;
    while (b.phase !== 'over') {
      if (b.phase === 'custom') b.endCustom([cpus[0].pick(b, b.f[0]), cpus[1].pick(b, b.f[1])]);
      else if (cpus[0].wantsDraw(b, b.f[0], DT)) b.beginCustom();
      b.update(DT, [cpus[0].intent(b, b.f[0], DT), cpus[1].intent(b, b.f[1], DT)]);
      frame++;
      if (frame % 30 === 0) hashes.push(battleHash(b));
      for (const f of b.f) { const e = checkFighter(f); if (e) { fail(c, `frame ${frame}: ${e}`); return null; } }
      if (!b.f[0].dead && !b.f[1].dead && b.f[0].col === b.f[1].col && b.f[0].row === b.f[1].row) { fail(c, `frame ${frame}: both fighters on ${b.f[0].col},${b.f[0].row}`); return null; }
      for (const [name, list] of [['projectiles', b.projectiles], ['fx', b.fx], ['walls', b.walls], ['traps', b.traps], ['pets', b.pets], ['warns', b.warns]] as const) {
        if (list.length > PILE) { fail(c, `frame ${frame}: ${list.length} ${name} alive`); return null; }
      }
      if (frame * DT > LIMIT) { fail(c, `no KO after ${LIMIT}s (HP ${Math.round(b.f[0].hp)}/${Math.round(b.f[1].hp)}, turn ${b.turn})`); return null; }
    }
    const w = b.winner;
    if (w === null) { fail(c, 'match ended with no winner'); return null; }
    if (b.f[1 - w].hp > 0) { fail(c, `side ${w} won but the loser has ${b.f[1 - w].hp} HP`); return null; }
    if (b.f[w].hp <= 0) { fail(c, `side ${w} won with ${b.f[w].hp} HP`); return null; }
    if (b.turn < 1) { fail(c, 'the Draw screen never opened'); return null; }
    return { b, hashes };
  } catch (e) {
    fail(c, `threw ${(e as Error).stack ?? e}`);
    return null;
  } finally {
    Math.random = real;
  }
}

const cases: Case[] = [];
let seed = Number(oneSeed ?? 1);
const next = (): number => oneSeed ? Number(oneSeed) : seed++;
const starter = (cls: ClassId): Spec => ({ cls, deck: presetsFor(cls)[0].cards, label: presetsFor(cls)[0].id });
// every class pair, both sides, mirrors included, with the starters at every CPU level
for (let r = 0; r < rounds; r++) {
  for (const a of classes) for (const bc of classes) for (const lv of quick ? ['normal' as Difficulty] : levels) {
    cases.push({ a: starter(a), b: starter(bc), cpu: [lv, lv], seed: next() });
  }
  // every ready-made deck against every class's starter
  for (const a of classes) for (const p of presetsFor(a).slice(1)) for (const bc of classes) {
    cases.push({ a: { cls: a, deck: p.cards, label: p.id }, b: starter(bc), cpu: ['normal', 'normal'], seed: next() });
  }
}

const t0 = Date.now();
let played = 0, totalTime = 0, replayed = 0;
for (const [i, c] of cases.entries()) {
  const r = play(c);
  if (!r) continue;
  played++;
  totalTime += r.b.time;
  // one in five also replays from the same seed and must match frame for frame
  if (i % 5 === 0) {
    const again = play(c);
    replayed++;
    if (again && again.hashes.join() !== r.hashes.join()) fail(c, 'replaying the same seed played a different match');
  }
}
console.log(`${played}/${cases.length} matches finished cleanly (${replayed} replayed), avg ${(totalTime / Math.max(1, played)).toFixed(0)}s of game time, ${((Date.now() - t0) / 1000).toFixed(1)}s wall`);
console.log(failures ? `${failures} failure(s)` : 'all matches ok');
process.exit(failures ? 1 : 0);
