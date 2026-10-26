// Online soak test: whole online matches between two simulated machines, headless, over a fake
// network with lag, jitter, packet loss, duplicates, outages and claude.ai-room style "latest value
// only" delivery, with machines that hitch, run at different refresh rates or get backgrounded.
// Both machines run the real NetSession + Netplay (rollback) code (the same the online scene runs); CPUs press
// the keys. Every checksum is compared, so any desync shows up with the match seed to replay it.
//
//   npx tsx scripts/netsoak.ts [matches] [--jobs N] [--seed S] [--only scenario] [--verbose]
//   npx tsx scripts/netsoak.ts --replay <seed> --only <scenario>     (one match, step log)
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Battle, type Side } from '../src/game/battle';
import { Cpu } from '../src/game/ai';
import { presetsFor, toList } from '../src/game/deck';
import { CLASS_IDS } from '../src/game/classes';
import { seeded } from '../src/game/rng';
import { battleHash } from '../src/net/hash';
import { Netplay, STEP } from '../src/net/netplay';
import { NO_INPUT, type Hello, type NetInput, type Packet } from '../src/net/protocol';
import { NetSession, clock, type NetStatus } from '../src/net/session';
import type { Transport, TransportKind } from '../src/net/transport';
import { TUNING } from '../src/game/tuning';
import { SKINS, type ClassId } from '../src/art/sprites';

// ---------- scenarios ----------
interface Link { lag: number; jitter: number; loss: number; dup: number; burst?: number }
interface Scenario {
  name: string;
  /** host to guest, guest to host */
  links: (r: () => number) => [Link, Link];
  room?: boolean;
  /** [start s, length s] windows where everything is dropped, both ways */
  outages?: (r: () => number) => Array<[number, number]>;
  /** refresh rates of the two machines */
  hz?: (r: () => number) => [number, number];
  /** chance per second that a machine hitches (a long frame), and how long */
  hitch?: number;
  /** [machine, start s, length s]: the tab is in the background (no frames, no packets) */
  background?: (r: () => number) => Array<[0 | 1, number, number]>;
  /** times (s) at which the link dies outright (a dead WebRTC channel, a room error) until a machine calls revive() */
  deaths?: (r: () => number) => number[];
}

const between = (r: () => number, a: number, b: number): number => a + r() * (b - a);
const sym = (l: Link): [Link, Link] => [l, { ...l }];

const SCENARIOS: Scenario[] = [
  { name: 'lan', links: r => sym({ lag: between(r, 1, 10), jitter: between(r, 0, 4), loss: 0, dup: 0 }) },
  { name: 'typical', links: r => sym({ lag: between(r, 20, 70), jitter: between(r, 0, 25), loss: between(r, 0, 0.02), dup: 0.002 }) },
  { name: 'wifi', links: r => sym({ lag: between(r, 40, 120), jitter: between(r, 20, 120), loss: between(r, 0.03, 0.12), dup: 0.01, burst: 0.3 }) },
  { name: 'terrible', links: r => sym({ lag: between(r, 150, 300), jitter: between(r, 50, 250), loss: between(r, 0.15, 0.35), dup: 0.02, burst: 0.5 }) },
  { name: 'asymmetric', links: r => [{ lag: between(r, 10, 40), jitter: 5, loss: 0, dup: 0 }, { lag: between(r, 100, 250), jitter: between(r, 30, 120), loss: between(r, 0.1, 0.4), dup: 0.01, burst: 0.4 }] },
  { name: 'spikes', links: r => sym({ lag: between(r, 30, 80), jitter: 15, loss: 0.01, dup: 0 }), outages: r => Array.from({ length: 8 }, () => [between(r, 5, 150), between(r, 0.2, 3)] as [number, number]) },
  { name: 'outage', links: r => sym({ lag: between(r, 30, 80), jitter: 15, loss: 0.01, dup: 0 }), outages: r => [[between(r, 10, 60), between(r, 8, 25)]] },
  { name: 'room', room: true, links: r => sym({ lag: between(r, 40, 150), jitter: between(r, 10, 80), loss: between(r, 0, 0.05), dup: 0 }) },
  { name: 'room-bad', room: true, links: r => sym({ lag: between(r, 100, 300), jitter: between(r, 50, 200), loss: between(r, 0.05, 0.2), dup: 0 }), outages: r => [[between(r, 10, 60), between(r, 1, 5)]] },
  { name: 'refresh', links: r => sym({ lag: between(r, 20, 60), jitter: 10, loss: 0.01, dup: 0 }), hz: r => [[30, 60, 75, 120, 144][Math.floor(r() * 5)], [30, 60, 75, 120, 144][Math.floor(r() * 5)]], hitch: 0.3 },
  { name: 'deadlink', links: r => sym({ lag: between(r, 20, 80), jitter: 15, loss: 0.01, dup: 0 }), deaths: r => [between(r, 5, 40), between(r, 50, 120)] },
  { name: 'deadlink-room', room: true, links: r => sym({ lag: between(r, 40, 120), jitter: 30, loss: 0.01, dup: 0 }), deaths: r => [between(r, 5, 40), between(r, 50, 120)] },
  { name: 'background', links: r => sym({ lag: between(r, 20, 60), jitter: 10, loss: 0.01, dup: 0 }), background: r => [[r() < 0.5 ? 0 : 1, between(r, 10, 60), between(r, 2, 20)]] },
];

// ---------- the simulated wire ----------
type Ev = { at: number; seq: number; fn: () => void };
class Clock {
  t = 0;
  private q: Ev[] = [];
  private n = 0;
  at(at: number, fn: () => void): void {
    const ev = { at, seq: this.n++, fn };
    // binary insert, stable by seq
    let lo = 0, hi = this.q.length;
    while (lo < hi) { const m = (lo + hi) >> 1; const e = this.q[m]; if (e.at < at || (e.at === at && e.seq < ev.seq)) lo = m + 1; else hi = m; }
    this.q.splice(lo, 0, ev);
  }
  runUntil(t: number): void {
    while (this.q.length && this.q[0].at <= t) { const e = this.q.shift()!; this.t = e.at; e.fn(); }
    this.t = t;
  }
}

class SimTransport implements Transport {
  readonly kind: TransportKind;
  peer!: SimTransport;
  closed = false;
  sent = 0; dropped = 0;
  private cbs: Array<(p: Packet) => void> = [];
  private closeCbs: Array<(r: string) => void> = [];
  /** room: only the latest presence value travels, about 30 times a second */
  private latest: string | null = null;
  private flushing = false;
  private inBurst = false;
  /** shared by both ends: the link is dead until someone revives it */
  state = { dead: false, reviving: false };
  revives = 0;
  constructor(private clk: Clock, private link: Link, private room: boolean, private down: (t: number) => boolean, private r: () => number) {
    this.kind = room ? 'room' : 'peer';
  }
  send(p: Packet): void {
    if (this.closed) return;
    this.sent++;
    const wire = JSON.stringify(p);
    if (this.room) {
      this.latest = wire;
      if (!this.flushing) { this.flushing = true; this.clk.at(this.clk.t + between(this.r, 25, 40), () => { this.flushing = false; if (this.latest) this.ship(this.latest); this.latest = null; }); }
      return;
    }
    this.ship(wire);
  }
  private ship(wire: string): void {
    const l = this.link;
    // loss comes in bursts on bad links: once a packet drops, the next ones are likelier to
    const lossP = this.inBurst && l.burst ? Math.min(0.95, l.loss + l.burst) : l.loss;
    if (this.state.dead || this.down(this.clk.t) || this.r() < lossP) { this.dropped++; this.inBurst = true; return; }
    this.inBurst = false;
    const copies = this.r() < l.dup ? 2 : 1;
    for (let i = 0; i < copies; i++) {
      // room presence is ordered (latest wins); a data channel with reliable:false can reorder
      const d = Math.max(0, l.lag + (this.room ? 0 : this.r() * l.jitter) + (this.room ? this.r() * l.jitter * 0.3 : 0));
      this.clk.at(this.clk.t + d, () => { if (!this.peer.closed) for (const cb of this.peer.cbs) cb(JSON.parse(wire) as Packet); });
    }
  }
  revive(): void {
    this.revives++;
    const st = this.state;
    if (!st.dead || st.reviving) return;
    st.reviving = true;
    this.clk.at(this.clk.t + between(this.r, 300, 4000), () => { st.dead = false; st.reviving = false; });
  }
  onPacket(cb: (p: Packet) => void): void { this.cbs.push(cb); }
  onClose(cb: (r: string) => void): void { this.closeCbs.push(cb); }
  close(): void { this.closed = true; }
}

// ---------- one simulated machine (mirrors OnlineBattleScene) ----------
const roundSeed = (seed: number, r: number): number => (seed + Math.imul(r, 0x9e3779b9)) >>> 0;

interface RoundLog { hashes: Map<number, number>; picks: string[]; final?: number; winner?: Side | null; frames: number }

class Machine {
  net: NetSession;
  cpu: Cpu;
  ls: Netplay | null = null;
  b: Battle | null = null;
  score: [number, number] = [0, 0];
  roundNo = 0;
  logs = new Map<number, RoundLog>();
  think = 0;
  readyAt = -1;
  waitingNext = false;
  done = false;
  maxStall = 0;
  stalledFrames = 0;
  fightUpdates = 0;
  sets = 0;
  rematches: number;
  worstStatus: NetStatus = 'connected';
  reconnects = 0;
  minDelay = 99;
  maxDelay = 0;
  constructor(role: 'host' | 'guest', hello: Hello, t: SimTransport, bestOf: 1 | 3 | 5, private r: () => number, rematches: number) {
    this.net = new NetSession(role, 'SOAK', hello, t, bestOf);
    this.cpu = new Cpu(r() < 0.5 ? 'easy' : 'normal');
    this.rematches = rematches;
  }
  get need(): number { return Math.ceil(this.net.start!.bestOf / 2); }

  startRound(n: number): void {
    const net = this.net, me = net.side;
    const spec = (h: Hello, you: boolean) => ({ cls: h.cls, deck: h.deck.slice(), name: you ? 'YOU' : 'RIVAL', skin: h.skin });
    const specs = me === 0 ? [spec(net.hello, true), spec(net.rival!, false)] : [spec(net.rival!, false), spec(net.hello, true)];
    this.b = new Battle(specs[0], specs[1], roundSeed(net.start!.seed, n));
    this.roundNo = n;
    net.beginRound(n);
    this.ls = new Netplay(net, this.b);
    const log: RoundLog = { hashes: new Map(), picks: [], frames: 0 };
    this.logs.set(n, log);
    this.ls.onHash = (f, h) => log.hashes.set(f, h);
    this.ls.onPicks = (turn, p) => log.picks.push(`${turn}:${p[0].join(',')}/${p[1].join(',')}`);
    this.think = this.thinkTime();
    this.waitingNext = false;
    this.readyAt = -1;
  }

  private thinkTime(): number { return this.r() < 0.1 ? TUNING.customTimer : between(this.r, 0.3, 6); }

  /** One fixed 1/60 s update, like the scene's. */
  update(): void {
    const net = this.net;
    net.tick();
    if (net.status === 'reconnecting') this.reconnects += this.worstStatus === 'reconnecting' ? 0 : 1;
    if (net.status !== 'connected' && net.status !== 'waiting' && this.worstStatus !== 'lost') this.worstStatus = net.status;
    else if (net.status === 'connected' && this.worstStatus === 'reconnecting') this.worstStatus = 'connected';
    if (net.status === 'error' || net.status === 'left') return;
    if (!this.b) {
      // lobby: both sides say hello, then both are ready for round 1
      if (net.matched) { net.myReady = Math.max(net.myReady, 1); if (net.remoteReady >= 1) this.startRound(1); }
      return;
    }
    const b = this.b, ls = this.ls!;
    if (b.phase === 'custom') {
      if (!ls.locked) {
        this.think -= STEP;
        if (this.think <= 0) ls.lock(this.r() < 0.1 ? [] : this.cpu.pick(b, b.f[net.side]));
      }
      if (ls.settle()) this.think = this.thinkTime();
      return;
    }
    if (b.phase === 'over' && ls.settled) {
      const log = this.logs.get(this.roundNo)!;
      if (log.final === undefined) {
        log.final = battleHash(b); log.winner = b.winner; log.frames = ls.frame;
        if (b.winner !== null) this.score[b.winner]++;
        this.readyAt = between(this.r, 0.2, 4);
      }
      const setOver = this.score[0] >= this.need || this.score[1] >= this.need;
      if (setOver && this.rematches <= 0) { this.done = true; return; }
      if (!this.waitingNext) {
        this.readyAt -= STEP;
        if (this.readyAt <= 0) { this.waitingNext = true; net.myReady = this.roundNo + 1; }
        return;
      }
      if (net.remoteReady >= this.roundNo + 1) {
        if (setOver) { this.score = [0, 0]; this.rematches--; this.sets++; }
        this.startRound(this.roundNo + 1);
      }
      return;
    }
    const f = b.f[net.side];
    const now: NetInput = b.phase === 'fight'
      ? { ...this.cpu.intent(b, f, STEP), draw: b.canOpenCustom() && this.r() < 0.03 }
      : NO_INPUT;
    const res = ls.advance(now);
    this.fightUpdates++;
    this.minDelay = Math.min(this.minDelay, net.delay);
    this.maxDelay = Math.max(this.maxDelay, net.delay);
    if (res === 'stall') { this.stalledFrames++; this.maxStall = Math.max(this.maxStall, ls.stall); }
  }
}

// ---------- one match ----------
interface Result {
  seed: number; scenario: string; ok: boolean; problem?: string; long?: number;
  rounds: number; frames: number; simSecs: number; maxStallSecs: number; stallPct: number;
  delay: [number, number]; rtt: number; loss: number; desyncFlag: boolean; classes: string;
  reconnects?: number; delayRange?: [number, number];
}

/** A starter or one of the class's Mythic decks. */
function deckFor(cls: ClassId, r: () => number): string[] {
  const list = presetsFor(cls);
  return toList(list[Math.floor(r() * list.length)].cards);
}

function runMatch(seed: number, sc: Scenario, verbose = false): Result {
  // everything random in the run (CPUs, the wire, the host's seed) comes from this match's seed
  const r = seeded(seed);
  const realRandom = Math.random;
  Math.random = seeded(seed ^ 0x5bd1e995);
  const clk = new Clock();
  clock.now = () => clk.t;
  try {
    const [l0, l1] = sc.links(r);
    const outages = sc.outages?.(r) ?? [];
    const down = (t: number): boolean => outages.some(([s, len]) => t >= s * 1000 && t < (s + len) * 1000);
    const t0 = new SimTransport(clk, l0, !!sc.room, down, r), t1 = new SimTransport(clk, l1, !!sc.room, down, r);
    t0.peer = t1; t1.peer = t0;
    t1.state = t0.state;
    for (const at of sc.deaths?.(r) ?? []) clk.at(at * 1000, () => { t0.state.dead = true; });
    const classes = CLASS_IDS;
    const c0 = classes[Math.floor(r() * classes.length)], c1 = classes[Math.floor(r() * classes.length)];
    const skin = (c: ClassId): string => SKINS[c][0].id;
    const h0: Hello = { cls: c0, skin: skin(c0), deck: deckFor(c0, r) }, h1: Hello = { cls: c1, skin: skin(c1), deck: deckFor(c1, r) };
    const bestOf = ([1, 3, 3, 5] as const)[Math.floor(r() * 4)];
    const rematches = r() < 0.25 ? 1 : 0;
    const m = [new Machine('host', h0, t0, bestOf, r, rematches), new Machine('guest', h1, t1, bestOf, r, rematches)];
    const hz = sc.hz?.(r) ?? [60, 60];
    const bg = sc.background?.(r) ?? [];
    // each machine: a display frame every 1000/hz ms, fixed 1/60 updates from an accumulator capped at 0.1s (main.ts)
    const acc = [0, 0], last = [0, 0], pinged = [0, 0];
    // no new frame, Draw screen or round on either machine for a minute of simulated time means stuck
    let progress = -1, progressAt = 0;
    const progressOf = (x: Machine): number => x.roundNo * 1e7 + (x.ls?.frame ?? 0) * 10 + (x.b?.turn ?? 0) + (x.b?.phase === 'over' ? 5 : 0) + (x.waitingNext ? 1 : 0);
    let problem: string | undefined;
    const frameAt = (i: 0 | 1): void => {
      const tNow = clk.t;
      const hidden = bg.some(([w, s, len]) => w === i && tNow >= s * 1000 && tNow < (s + len) * 1000);
      let next = tNow + 1000 / hz[i];
      if (sc.hitch && r() < sc.hitch / hz[i]) next += between(r, 50, 400);
      m[i].net.away = hidden;
      if (!hidden) {
        acc[i] += Math.min(0.1, (tNow - last[i]) / 1000);
        last[i] = tNow;
        while (acc[i] >= STEP) { acc[i] -= STEP; m[i].update(); }
      } else {
        // rAF stops in a background tab (the 0.1 s cap covers the return); the session's keepalive timer pings twice a second
        last[i] = tNow;
        if (tNow - pinged[i] >= 500) { pinged[i] = tNow; m[i].net.tick(); }
      }
      if (!m[0].done || !m[1].done) clk.at(next, () => frameAt(i));
    };
    clk.at(between(r, 0, 16), () => frameAt(0));
    clk.at(between(r, 0, 500), () => frameAt(1));
    // run in slices, checking the logs as we go
    let checked = 0, long = 0;
    while (!(m[0].done && m[1].done)) {
      clk.runUntil(clk.t + 1000);
      for (const x of m) if (x.net.status === 'error' || x.net.status === 'left') problem ??= `${x.net.role} status ${x.net.status} ${x.net.error}`;
      if (m.some(x => x.net.desync)) problem ??= 'in-game DESYNC flag';
      const d = compare(m[0], m[1]);
      if (d) problem ??= d;
      const pr = progressOf(m[0]) + progressOf(m[1]) * 3;
      if (pr !== progress) { progress = pr; progressAt = clk.t; }
      if (clk.t - progressAt > 60000) problem ??= `stuck: host round ${m[0].roundNo} ${m[0].b?.phase} f${m[0].ls?.frame}, guest round ${m[1].roundNo} ${m[1].b?.phase} f${m[1].ls?.frame}`;
      // a round going 20 minutes is the CPUs never finishing each other, not the netcode: call it a draw
      if (m.every(x => x.ls && x.ls.frame > 60 * 60 * 20)) { long++; for (const x of m) x.done = true; }
      if (problem) break;
      if (verbose && clk.t - checked >= 10000) { checked = clk.t; console.log(`${(clk.t / 1000).toFixed(0)}s host r${m[0].roundNo} ${m[0].b?.phase} f${m[0].ls?.frame} | guest r${m[1].roundNo} ${m[1].b?.phase} f${m[1].ls?.frame} | hp ${m[0].b?.f.map(f => `${Math.round(f.hp)}@${f.col},${f.row}`).join(" ")} ${m[0].b?.f.map(f => `L${f.lock.toFixed(1)} C${f.charging ? f.charge.toFixed(1) : "-"} q${f.queue.length} sh${f.shields.map(s => s.kind + Math.round(s.hp)).join("+")} ${Object.entries(f.st).filter(([, v]) => v).map(([k, v]) => k + (+v).toFixed(1)).join(",")}`).join(" // ")} | status ${m[0].net.status}/${m[1].net.status} rtt ${m[0].net.rtt.toFixed(0)}`); }
    }
    for (const x of m) if (x.worstStatus === 'lost') problem ??= `${x.net.role} showed CONNECTION LOST`;
    const frames = [...m[0].logs.values()].reduce((a, l) => a + l.frames, 0);
    return {
      seed, scenario: sc.name, ok: !problem, problem, long,
      rounds: m[0].logs.size, frames, simSecs: Math.round(clk.t / 1000),
      maxStallSecs: Math.max(m[0].maxStall, m[1].maxStall) / 60,
      stallPct: (m[0].stalledFrames + m[1].stalledFrames) / Math.max(1, m[0].fightUpdates + m[1].fightUpdates),
      delay: [m[0].net.delay, m[1].net.delay], rtt: Math.round(m[0].net.rtt),
      loss: (t0.dropped + t1.dropped) / Math.max(1, t0.sent + t1.sent),
      desyncFlag: m.some(x => x.net.desync), classes: `${c0}-${c1}`,
      reconnects: m[0].reconnects + m[1].reconnects, delayRange: [Math.min(m[0].minDelay, m[1].minDelay), Math.max(m[0].maxDelay, m[1].maxDelay)],
    };
  } catch (e) {
    return { seed, scenario: sc.name, ok: false, problem: `crash: ${(e as Error).stack?.split('\n').slice(0, 4).join(' | ')}`, rounds: 0, frames: 0, simSecs: Math.round(clk.t / 1000), maxStallSecs: 0, stallPct: 0, delay: [0, 0], rtt: 0, loss: 0, desyncFlag: false, classes: '' };
  } finally {
    Math.random = realRandom;
  }
}

/** First difference between the two machines' records, or null. */
function compare(a: Machine, b: Machine): string | null {
  for (const [n, la] of a.logs) {
    const lb = b.logs.get(n);
    if (!lb) continue;
    for (const [f, h] of la.hashes) { const o = lb.hashes.get(f); if (o !== undefined && o !== h) return `DESYNC round ${n} frame ${f}`; }
    for (let i = 0; i < Math.min(la.picks.length, lb.picks.length); i++) if (la.picks[i] !== lb.picks[i]) return `picks differ round ${n}: ${la.picks[i]} vs ${lb.picks[i]}`;
    if (la.final !== undefined && lb.final !== undefined && (la.final !== lb.final || la.winner !== lb.winner)) return `DESYNC round ${n} final state`;
  }
  return null;
}

// ---------- CLI: shards across processes ----------
const args = process.argv.slice(2);
const flag = (k: string): string | undefined => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const N = Number(args.find(a => /^\d+$/.test(a)) ?? 220);
const jobs = Number(flag('--jobs') ?? 4);
const baseSeed = Number(flag('--seed') ?? 1);
const only = flag('--only');
const scenarios = only ? SCENARIOS.filter(s => s.name === only) : SCENARIOS;
const shard = flag('--shard');

if (flag('--replay')) {
  const sc = scenarios[0];
  const res = runMatch(Number(flag('--replay')), sc, true);
  console.log(JSON.stringify(res));
  process.exit(res.ok ? 0 : 1);
} else if (shard) {
  const [i, n] = shard.split('/').map(Number);
  for (let k = i; k < N; k += n) {
    const sc = scenarios[k % scenarios.length];
    const res = runMatch(baseSeed * 100003 + k, sc);
    process.send!(res);
  }
  process.exit(0);
} else {
  const self = fileURLToPath(import.meta.url);
  const all: Result[] = [];
  const started = Date.now();
  await Promise.all(Array.from({ length: jobs }, (_, i) => new Promise<void>(done => {
    const child = fork(self, [...args, '--shard', `${i}/${jobs}`], { execArgv: ['--import', 'tsx'] });
    child.on('message', m => {
      const res = m as Result;
      all.push(res);
      if (!res.ok) console.log(`FAIL seed ${res.seed} [${res.scenario}] ${res.classes}: ${res.problem}`);
      if (all.length % 50 === 0) console.log(`${all.length}/${N} matches, ${all.filter(x => !x.ok).length} failing (${((Date.now() - started) / 1000).toFixed(0)}s)`);
    });
    child.on('exit', () => done());
  })));
  report(all);
  if (flag('--out')) (await import('node:fs')).writeFileSync(flag('--out')!, JSON.stringify(all, null, 1));
  process.exit(all.every(x => x.ok) ? 0 : 1);
}

function report(all: Result[]): void {
  const rows = scenarios.map(sc => {
    const rs = all.filter(x => x.scenario === sc.name);
    const fails = rs.filter(x => !x.ok);
    const avg = (f: (x: Result) => number): number => rs.reduce((a, x) => a + f(x), 0) / Math.max(1, rs.length);
    return {
      scenario: sc.name, matches: rs.length, fail: fails.length,
      rounds: rs.reduce((a, x) => a + x.rounds, 0),
      'avg rtt ms': Math.round(avg(x => x.rtt)), 'avg delay f': +avg(x => (x.delay[0] + x.delay[1]) / 2).toFixed(1),
      'pkt loss %': +(avg(x => x.loss) * 100).toFixed(1), 'stall %': +(avg(x => x.stallPct) * 100).toFixed(1),
      'worst stall s': +Math.max(0, ...rs.map(x => x.maxStallSecs)).toFixed(1),
      'delay range': `${Math.min(99, ...rs.map(x => x.delayRange?.[0] ?? 99))}-${Math.max(0, ...rs.map(x => x.delayRange?.[1] ?? 0))}`,
      reconnects: rs.reduce((a, x) => a + (x.reconnects ?? 0), 0),
    };
  });
  console.table(rows);
  const fails = all.filter(x => !x.ok);
  const kinds = new Map<string, number>();
  for (const f of fails) { const k = (f.problem ?? '').replace(/\d+/g, '#'); kinds.set(k, (kinds.get(k) ?? 0) + 1); }
  for (const [k, n] of kinds) console.log(`${n}x ${k}`);
  const long = all.filter(x => x.long).length;
  if (long) console.log(`${long} match(es) cut short after a 20-minute round (CPUs not finishing; not a netcode problem)`);
  console.log(`${all.length} matches, ${all.reduce((a, x) => a + x.rounds, 0)} rounds, ${all.reduce((a, x) => a + x.frames, 0)} frames: ${fails.length ? `${fails.length} FAILED` : 'all in sync, none stuck'}`);
}
