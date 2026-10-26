// Rollback check: a battle run through the rollback netcode, with the other player's inputs arriving
// late and in bursts (so it guesses wrong, goes back and replays all the time), must end up exactly
// like the same battle run straight through. Both machines (side 0 and side 1) are checked, every
// confirmed checksum is compared, and the post-match stats must agree too.
// Usage: npx tsx scripts/rollcheck.ts [matches] [max latency in frames]
import { Battle, type Side } from '../src/game/battle';
import { Cpu } from '../src/game/ai';
import { presetsFor, toList } from '../src/game/deck';
import { battleHash } from '../src/net/hash';
import { seeded } from '../src/game/rng';
import { CLASS_IDS } from '../src/game/classes';
import { trackStats, statsRollbackRoots } from '../src/game/stats';
import { Rollback } from '../src/net/rollback';
import { saveBattle, loadBattle } from '../src/net/snapshot';
import type { NetInput } from '../src/net/protocol';
import { recordRound, TapeWriter, type RoundTape } from '../src/game/replay';

const N = Number(process.argv[2] ?? 25);
const MAX_LAT = Number(process.argv[3] ?? 14);
const DELAY = 2;
const dt = 1 / 60;
let failures = 0, totalRb = 0, worstRb = 0, frames = 0;
let snapUs = 0, snaps = 0;

for (let m = 0; m < N; m++) {
  const seed = 5000 + m;
  const ca = CLASS_IDS[m % CLASS_IDS.length], cb = CLASS_IDS[Math.floor(m / CLASS_IDS.length) % CLASS_IDS.length];
  // vary the decks across the starters and Mythic decks so most cards get cast
  const da = presetsFor(ca)[m % presetsFor(ca).length], db = presetsFor(cb)[(m + 1) % presetsFor(cb).length];
  const make = (): Battle => new Battle({ cls: ca, deck: toList(da.cards), name: 'A' }, { cls: cb, deck: toList(db.cards), name: 'B' }, seed);

  // 1. the reference battle, straight through; CPUs make the inputs and picks
  const x = make(), xs = trackStats(x);
  let xTape: RoundTape | null = null;
  recordRound(x, t => { xTape = t; });
  const cpus = [new Cpu('normal'), new Cpu('normal')];
  const rng = seeded(seed * 13);
  const ins: Array<[NetInput, NetInput]> = [];
  const picks: Array<[number[], number[]]> = [];
  const hashes: number[] = [battleHash(x)];
  while (x.phase !== 'over' && ins.length < 60 * 300) {
    if (x.phase === 'custom') {
      const p: [number[], number[]] = [cpus[0].pick(x, x.f[0]), cpus[1].pick(x, x.f[1])];
      picks[x.turn] = [p[0].slice(), p[1].slice()];
      x.endCustom(p);
    }
    const draw = x.canOpenCustom() && rng() < 0.03;
    const pair = [0, 1].map(s => ({ ...cpus[s].intent(x, x.f[s], dt), draw: draw && (s === 0) === rng() < 0.5 })) as [NetInput, NetInput];
    ins.push(pair);
    if ((pair[0].draw || pair[1].draw) && x.canOpenCustom()) x.beginCustom();
    else x.update(dt, pair);
    hashes.push(battleHash(x));
  }
  frames += ins.length;

  // 2. each machine through rollback, the rival's inputs arriving 0..MAX_LAT frames late with spikes
  for (const me of [0, 1] as Side[]) {
    const y = make(), ys = trackStats(y);
    const net = seeded(seed * 31 + me);
    let remoteKnown = 0, bad = '';
    const rb = new Rollback(y, me, {
      local: f => f < rb.frame + DELAY + 1 && f < ins.length ? ins[f][me] : null,
      remote: f => f < remoteKnown && f < ins.length ? ins[f][1 - me] : null,
    }, statsRollbackRoots(ys), (f, h) => { if (h !== hashes[f] && !bad) bad = `checksum differs at frame ${f}`; });
    const w = new TapeWriter(y);
    rb.onConfirmed = (kind, i) => { if (kind === 'draw') w.beginCustom(); else w.update(i); };
    let ticks = 0, spike = 0;
    while (!(y.phase === 'over' && rb.settled) && rb.confirmed < ins.length && ticks < 60 * 600 && !bad) {
      ticks++;
      if (y.phase === 'custom') {
        if (!rb.settled) { bad = 'Draw screen on a guessed frame'; break; }
        const p = picks[y.turn];
        if (!p) { bad = `Draw screen ${y.turn} never opened in the reference`; break; }
        w.endCustom([p[0].slice(), p[1].slice()]);
        y.endCustom([p[0].slice(), p[1].slice()]);
        rb.resave();
        // the other side sat on the Draw screen too: its inputs come in fresh
        remoteKnown = Math.max(remoteKnown, rb.frame);
      }
      if (spike > 0) spike--;
      else if (net() < 0.01) spike = 10 + Math.floor(net() * 20);
      const lat = spike > 0 ? 99 : Math.floor(net() * (MAX_LAT + 1));
      remoteKnown = Math.max(remoteKnown, rb.frame + DELAY - lat);
      rb.advance(net() < 0.1 ? 2 : 1);
      // the rival's inputs only exist once its own clock gets there
      if (rb.frame >= ins.length && y.phase !== 'over') remoteKnown = ins.length;
    }
    if (!bad && y.phase !== x.phase) bad = `never finished (frame ${rb.frame}/${ins.length}, confirmed ${rb.confirmed})`;
    if (!bad && battleHash(y) !== hashes[hashes.length - 1]) bad = 'final state differs';
    if (!bad && y.winner !== x.winner) bad = 'different winner';
    if (!bad && JSON.stringify(ys) !== JSON.stringify(xs)) bad = 'post-match stats differ';
    if (!bad && xTape && JSON.stringify({ ...w.finish(), hash: 0 }) !== JSON.stringify({ ...(xTape as RoundTape), hash: 0 })) { const a = w.finish(), c = xTape as RoundTape; bad = `replay tape differs: n ${a.n}/${c.n} ev ${JSON.stringify(a.events.slice(0,4))} vs ${JSON.stringify(c.events.slice(0,4))} fr ${a.frames.length}/${c.frames.length} hash ${a.hash === c.hash}`; }
    totalRb += rb.rollbacks;
    worstRb = Math.max(worstRb, rb.maxRollback);
    if (bad) { failures++; console.log(`match ${m} side ${me}: ${ca} (${da.name}) vs ${cb} (${db.name}): ${bad}`); }
  }
  if (m % 5 === 0) {
    // timing: one save + restore of a mid-fight battle
    const t0 = performance.now();
    for (let i = 0; i < 200; i++) loadBattle(x, saveBattle(x, [xs]));
    snapUs += (performance.now() - t0) * 1000; snaps += 200;
  }
  console.log(`match ${m}: ${ca} vs ${cb}, ${ins.length} frames, ${failures ? 'failures so far: ' + failures : 'ok'}`);
}
console.log(`${N} matches, ${frames} frames, ${totalRb} corrections (longest ${worstRb} frames), save+restore ${(snapUs / snaps).toFixed(1)}us`);
console.log(failures ? `${failures} FAILED` : 'rollback matches straight play');
process.exit(failures ? 1 : 0);
