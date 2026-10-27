// Rules fuzzer: random legal decks, random (and CPU) inputs, random Draw-screen picks, training resets.
// Every frame it checks that nothing threw, numbers stay finite and in range, fighters stand on legal
// panels, lists stay bounded, and nobody stays locked or crowd-controlled forever. Each match is also
// replayed from the same seed and inputs to prove the rules stay deterministic under chaotic input.
// Usage: npx tsx scripts/fuzz.ts [matches] [seed]
import { Battle, COLS, ROWS, type Intent, type Dir, type Fighter } from '../src/game/battle';
import { Cpu } from '../src/game/ai';
import { cardsFor } from '../src/game/cards';
import { canAdd, validate, toList, presetsFor, type DeckCounts } from '../src/game/deck';
import { battleHash } from '../src/net/hash';
import { seeded, type Rng } from '../src/game/rng';
import { CLASS_IDS, type ClassId } from '../src/game/classes';
import { trackStats } from '../src/game/stats';
import { TUNING, type Difficulty } from '../src/game/tuning';

const N = Number(process.argv[2] ?? 200);
/** FUZZ_MATCH=n replays just match n (same seed base) to dig into a report. */
const ONLY = process.env.FUZZ_MATCH === undefined ? -1 : Number(process.env.FUZZ_MATCH);
const BASE = Number(process.argv[3] ?? 1);
const DT = 1 / 60;
const MAX_FRAMES = 60 * 240;
const DIRS: Dir[] = ['up', 'down', 'left', 'right'];

/** A random legal spell deck: one Mythic, up to five Legendaries, filled with whatever fits. */
function randomDeck(cls: ClassId, r: Rng): DeckCounts {
  const pool = cardsFor(cls);
  const d: DeckCounts = {};
  const mythics = pool.filter(c => c.rarity === 'mythic');
  d[mythics[Math.floor(r() * mythics.length)].id] = 1;
  let guard = 0;
  while (Object.values(d).reduce((a, b) => a + b, 0) < 30 && guard++ < 2000) {
    const c = pool[Math.floor(r() * pool.length)];
    if (c.rarity === 'mythic') continue;
    if (!canAdd(d, c)) d[c.id] = (d[c.id] ?? 0) + 1;
  }
  return d;
}

type Mode = 'chaos' | 'masher' | 'cpu';
interface Driver { mode: Mode; cpu: Cpu; held: Dir | null; heldT: number }

function chaosIntent(dr: Driver, r: Rng): Intent {
  if (dr.heldT <= 0) { dr.held = r() < 0.4 ? null : DIRS[Math.floor(r() * 4)]; dr.heldT = r() * 0.6; }
  dr.heldT -= DT;
  const masher = dr.mode === 'masher';
  return {
    move: r() < (masher ? 0.3 : 0.08) ? DIRS[Math.floor(r() * 4)] : null,
    held: dr.held,
    attackPressed: r() < (masher ? 0.4 : 0.06),
    attackHeld: r() < (masher ? 0.5 : 0.3),
    castPressed: r() < (masher ? 0.4 : 0.05),
  };
}

function randomPicks(offer: string[], r: Rng): number[] {
  const roll = r();
  if (roll < 0.1) return [];
  if (roll < 0.15) return [0, 0, 1, 9, -1, 2]; // duplicates and out of range must be ignored
  const idx = offer.map((_, i) => i).filter(() => r() < 0.6);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx;
}

interface Problem { match: number; frame: number; what: string }
const problems: Problem[] = [];
const seen = new Set<string>();
function report(match: number, frame: number, what: string): void {
  const key = what.replace(/[-\d.]+/g, '#');
  if (seen.has(key)) return;
  seen.add(key);
  problems.push({ match, frame, what });
}

// Mage Mana may overflow the cap by the Arcane Barrier / Evocation bonus ("+1 Mana next turn")
const CC: Array<keyof Fighter['st']> = ['frozen', 'stunned', 'sleep', 'rooted', 'silenced'];

function check(b: Battle, m: number, frame: number, lockT: [number, number]): void {
  for (const f of b.f) {
    const tag = `${f.cls}#${f.side}`;
    if (!Number.isFinite(f.hp) || f.hp > f.maxHp + 1e-6) report(m, frame, `${tag} hp out of range: ${f.hp}/${f.maxHp}`);
    if (!Number.isFinite(f.res) || f.res < -1e-6 || f.res > Math.max(f.resMax, 5) + (f.cls === 'mage' ? 3 : 0) + 1e-6) report(m, frame, `${tag} resource out of range: ${f.res}/${f.resMax}`);
    if (!Number.isInteger(f.col) || !Number.isInteger(f.row) || f.col < 0 || f.col >= COLS || f.row < 0 || f.row >= ROWS) report(m, frame, `${tag} off grid at ${f.col},${f.row}`);
    else if (!f.dead && b.phase === 'fight') {
      const p = b.panels[f.col][f.row];
      // a Rogue mid-backstab stands behind the enemy until it blinks home
      if (p.owner !== f.side && f.homeCol < 0) report(m, frame, `${tag} standing on enemy panel ${f.col},${f.row}`);
      if (b.walls.some(w => w.col === f.col && w.row === f.row)) report(m, frame, `${tag} inside a wall at ${f.col},${f.row}`);
    }
    for (const [k, v] of Object.entries(f.st)) if (!Number.isFinite(v)) report(m, frame, `${tag} status ${k} not finite: ${v}`);
    for (const k of CC) if (f.st[k] > 12) report(m, frame, `${tag} ${k} for ${f.st[k].toFixed(1)}s`);
    for (const k of ['lock', 'castCd', 'stepCd', 'moveCd', 'charge', 'poison', 'dx', 'dy'] as const) if (!Number.isFinite(f[k])) report(m, frame, `${tag} ${k} not finite: ${f[k]}`);
    if (f.deck.length + f.discard.length + f.queue.length + b.offer[f.side].length > 30) report(m, frame, `${tag} has more than 30 cards in play`);
    if (f.lock > 4) report(m, frame, `${tag} action lock of ${f.lock.toFixed(1)}s`);
    // chained crowd control is fine; being unable to act for 10s straight is a stuck fighter
    const out = f.st.frozen > 0 || f.st.stunned > 0 || f.st.sleep > 0 || f.st.channel > 0 || f.st.iceBlock > 0;
    lockT[f.side] = out && b.phase === 'fight' ? lockT[f.side] + DT : 0;
    if (lockT[f.side] > 10) report(m, frame, `${tag} unable to act for 10s straight`);
  }
  const lists: Array<[string, unknown[]]> = [['timers', b.timers], ['fx', b.fx], ['projectiles', b.projectiles], ['anims', b.anims], ['texts', b.texts], ['walls', b.walls], ['traps', b.traps], ['pets', b.pets], ['warns', b.warns], ['marks', b.marks]];
  for (const [name, l] of lists) if (l.length > 400) report(m, frame, `${name} grew to ${l.length}`);
  if (!Number.isFinite(b.gauge)) report(m, frame, `gauge not finite`);
}

interface Run { hashes: number[]; frames: number; phase: string; winner: number | null }

function play(m: number, seed: number, verify: boolean): Run {
  const r = seeded(seed * 31 + 7);
  const a = CLASS_IDS[Math.floor(r() * CLASS_IDS.length)], bc = CLASS_IDS[Math.floor(r() * CLASS_IDS.length)];
  const deckOf = (cls: ClassId): DeckCounts => {
    const roll = r();
    if (roll < 0.5) return randomDeck(cls, r);
    const ps = presetsFor(cls);
    return { ...ps[Math.floor(r() * ps.length)].cards };
  };
  const da = deckOf(a), db = deckOf(bc);
  for (const [cls, d] of [[a, da], [bc, db]] as const) { const errs = validate(d); if (errs.length) report(m, 0, `${cls} deck invalid: ${errs.join(', ')}`); }
  const b = new Battle({ cls: a, deck: toList(da), name: 'A' }, { cls: bc, deck: toList(db), name: 'B' }, seed);
  const training = r() < 0.15;
  b.noKo = training;
  if (verify) trackStats(b);
  const diffs = Object.keys(TUNING.cpu) as Difficulty[];
  const modes: Mode[] = ['chaos', 'masher', 'cpu'];
  const drivers: Driver[] = [0, 1].map(() => ({ mode: modes[Math.floor(r() * 3)], cpu: new Cpu(diffs[Math.floor(r() * diffs.length)]), held: null, heldT: 0 }));
  // CPUs roll their own Math.random; seed it per match so a replay sees identical intents
  const lockT: [number, number] = [0, 0];
  const hashes: number[] = [];
  let frame = 0;
  const limit = training ? 60 * 90 : MAX_FRAMES;
  while (b.phase !== 'over' && frame < limit) {
    if (b.phase === 'custom') {
      const picks = [0, 1].map(s => drivers[s].mode === 'cpu' && r() < 0.8 ? drivers[s].cpu.pick(b, b.f[s]) : randomPicks(b.offer[s], r)) as [number[], number[]];
      b.endCustom(picks);
    } else if (b.canOpenCustom() && r() < 0.03) b.beginCustom();
    if (training && r() < 0.002) b.resetField();
    const intents = [0, 1].map(s => drivers[s].mode === 'cpu' ? drivers[s].cpu.intent(b, b.f[s], DT) : chaosIntent(drivers[s], r)) as [Intent, Intent];
    b.update(DT, intents);
    frame++;
    check(b, m, frame, lockT);
    hashes.push(battleHash(b));
  }
  return { hashes, frames: frame, phase: b.phase, winner: b.winner };
}

const realRandom = Math.random;
let crashes = 0, desyncs = 0, unfinished = 0;
const t0 = Date.now();
for (let m = ONLY >= 0 ? ONLY : 0; m < (ONLY >= 0 ? ONLY + 1 : N); m++) {
  const seed = BASE * 100000 + m;
  let first: Run;
  try {
    Math.random = seeded(seed ^ 0x5bd1e995);
    first = play(m, seed, false);
    Math.random = seeded(seed ^ 0x5bd1e995);
    const again = play(m, seed, true);
    const at = first.hashes.findIndex((h, i) => h !== again.hashes[i]);
    if (at >= 0 || first.frames !== again.frames) { desyncs++; report(m, at, `replay diverged at frame ${at}`); }
  } catch (e) {
    crashes++;
    report(m, -1, `CRASH ${(e as Error).stack?.split('\n').slice(0, 4).join(' | ')}`);
    continue;
  } finally { Math.random = realRandom; }
  if (first.phase !== 'over') unfinished++;
}
console.log(`${N} matches in ${((Date.now() - t0) / 1000).toFixed(1)}s: ${crashes} crash(es), ${desyncs} replay divergence(s), ${unfinished} hit the time cap (normal for chaos vs chaos)`);
for (const p of problems) console.log(`  match ${p.match} frame ${p.frame}: ${p.what}`);
process.exit(problems.length ? 1 : 0);
