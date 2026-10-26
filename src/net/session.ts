// One online match between two machines: the handshake, readiness for each round, and the
// delay-based lockstep input buffers. Both machines run the same seeded battle and only trade
// controls, so the simulation itself never crosses the wire.
//
// Lockstep: the input you press now is scheduled `delay` frames ahead and sent to the other side;
// frame N only runs once both sides' inputs for N are in. With the delay covering the one-way trip,
// play never waits; on a lag spike it pauses instead of rubber-banding, and both players feel the
// same delay (fair, and in keeping with "no tight timing windows").
import { CARDS } from '../game/cards';
import { SKINS, type ClassId } from '../art/sprites';
import { PROTOCOL, decodeInput, encodeInput, type Hello, type Lobby, type NetInput, type Packet } from './protocol';
import type { Transport } from './transport';

const WINDOW = 600;        // most frames of inputs re-sent per packet (10s)
const LOST_AFTER = 6000;   // ms of silence before the match counts as dropped
const STEP_MS = 1000 / 60;

export type NetStatus = 'waiting' | 'connected' | 'lost' | 'left' | 'error';

export class NetSession {
  readonly id = Math.random().toString(36).slice(2, 10);
  status: NetStatus = 'waiting';
  error = '';
  /** Latest packet from the other side. */
  remote: Packet | null = null;
  start?: { seed: number; bestOf: 1 | 3 | 5 };
  myReady = 0;
  round = 0;
  delay = 4;
  /** Smoothed round-trip time in ms (0 until measured). */
  rtt = 0;
  desync = false;
  /** This side's character and stage select state. */
  lobby: Lobby = { step: 0, tile: 0, stage: 'colosseum', voted: false };

  private seq = 0;
  private lastSeq = -1;
  private lastHeard = 0;
  private remoteT = 0;
  private remoteAt = 0;
  private local: string[] = [];
  private remoteIn: string[] = [];
  /** Highest frame of remote input held with no gaps. */
  remoteContig = -1;
  private remoteAck = -1;
  private picks?: { round: number; turn: number; p: number[] };
  private hash?: [number, number];
  private hashes = new Map<number, number>();
  private bye = false;

  constructor(readonly role: 'host' | 'guest', readonly code: string, public hello: Hello, readonly transport: Transport, bestOf: 1 | 3 | 5) {
    if (role === 'host') this.start = { seed: Math.floor(Math.random() * 4294967296), bestOf };
    transport.onPacket(p => this.receive(p));
    transport.onClose(reason => { if (this.status !== 'left') { this.status = 'error'; this.error = reason; } });
  }

  get side(): 0 | 1 { return this.role === 'host' ? 0 : 1; }
  get rival(): Hello | null { return this.remote?.hello ?? null; }
  get rivalLobby(): Lobby | null { return this.remote?.lobby ?? null; }
  get remoteReady(): number { return this.remote?.ready ?? 0; }
  get remoteDelay(): number { return this.remote?.delay ?? this.delay; }
  /** Both sides have said hello and the host's match settings are known. */
  get matched(): boolean { return this.status === 'connected' && !!this.start && !!this.remote; }

  /** Call every frame: sends this side's state and watches for silence. */
  tick(): void {
    const now = performance.now();
    if (this.status === 'connected' && now - this.lastHeard > LOST_AFTER) this.status = 'lost';
    if (this.status === 'error' || this.status === 'left') return;
    const from = Math.max(this.remoteAck + 1, this.local.length - WINDOW, 0);
    const p: Packet = {
      v: PROTOCOL, id: this.id, role: this.role, seq: ++this.seq,
      t: Math.round(now), et: this.remoteT, ed: this.remoteT ? Math.round(now - this.remoteAt) : 0,
      hello: this.hello, lobby: this.lobby, start: this.role === 'host' ? this.start : undefined,
      ready: this.myReady, round: this.round, delay: this.delay,
      base: from, inp: this.local.slice(from).join(''), ack: this.remoteContig,
      picks: this.picks, hash: this.hash, bye: this.bye || undefined,
    };
    this.transport.send(p);
  }

  private receive(p: Packet): void {
    if (p.role === this.role) return; // our own other tab, or a second host on the code
    if (p.v !== PROTOCOL) { this.status = 'error'; this.error = 'DIFFERENT GAME VERSIONS: RELOAD BOTH PAGES'; return; }
    if (this.remote && p.id !== this.remote.id) {
      // the other player reloaded: only a fresh start in the lobby can take them back
      if (this.round > 0) return;
      this.lastSeq = -1;
    }
    if (p.seq <= this.lastSeq) return; // late, out-of-order packet
    if (!validHello(p.hello)) { this.status = 'error'; this.error = 'THE OTHER PLAYER SENT A BAD DECK'; return; }
    this.lastSeq = p.seq;
    const now = performance.now();
    if (p.et > 0) {
      const sample = Math.max(0, now - p.et - p.ed);
      this.rtt = this.rtt ? this.rtt * 0.85 + sample * 0.15 : sample;
    }
    this.remoteT = p.t;
    this.remoteAt = now;
    this.lastHeard = now;
    this.remote = p;
    if (p.bye) { this.status = 'left'; return; }
    if (this.status === 'waiting' || this.status === 'lost') this.status = 'connected';
    if (this.role === 'guest' && p.start) this.start = p.start;

    if (p.round === this.round && this.round > 0) {
      this.remoteAck = Math.max(this.remoteAck, p.ack);
      for (let i = 0; i < p.inp.length / 2; i++) {
        const f = p.base + i;
        if (this.remoteIn[f] === undefined) this.remoteIn[f] = p.inp.slice(i * 2, i * 2 + 2);
      }
      while (this.remoteIn[this.remoteContig + 1] !== undefined) this.remoteContig++;
      if (p.hash) {
        const mine = this.hashes.get(p.hash[0]);
        if (mine !== undefined && mine !== p.hash[1]) this.desync = true;
      }
    }
  }

  /** Start round `r`: clear the buffers and pick an input delay from the measured ping. */
  beginRound(r: number): void {
    this.round = r;
    // one-way trip in frames, plus slack for jitter
    this.delay = this.rtt ? Math.min(15, Math.max(2, Math.round(this.rtt / 2 / STEP_MS) + 2)) : 4;
    if (this.transport.kind === 'room') this.delay += 2; // presence is sent about 30 times a second
    this.local = Array(this.delay).fill(encodeInput({ move: null, held: null, attackPressed: false, attackHeld: false, castPressed: false, draw: false }));
    this.remoteIn = [];
    this.remoteContig = -1;
    this.remoteAck = -1;
    this.picks = undefined;
    this.hash = undefined;
    this.hashes.clear();
    this.desync = false;
  }

  /** Frames of local input scheduled so far. */
  get scheduled(): number { return this.local.length; }
  pushLocal(i: NetInput): void { this.local.push(encodeInput(i)); }
  localInput(frame: number): NetInput | null { const s = this.local[frame]; return s ? decodeInput(s) : null; }
  remoteInput(frame: number): NetInput | null { const s = this.remoteIn[frame]; return s ? decodeInput(s) : null; }

  setPicks(turn: number, p: number[]): void { this.picks = { round: this.round, turn, p: p.slice(0, 5) }; }
  /** The other side's picks for this Draw screen, once they are in. */
  remotePicks(turn: number): number[] | null {
    const rp = this.remote?.picks;
    return rp && rp.round === this.round && rp.turn === turn ? rp.p.filter(n => Number.isInteger(n)) : null;
  }

  recordHash(frame: number, h: number): void {
    this.hashes.set(frame, h);
    if (this.hashes.size > 40) this.hashes.delete(this.hashes.keys().next().value as number);
    this.hash = [frame, h];
  }

  /** Tell the other side we are leaving, then close. */
  leave(): void {
    this.bye = true;
    this.tick();
    this.status = 'left';
    setTimeout(() => this.transport.close(), 300);
  }
}

function validHello(h: Hello): boolean {
  const classes = Object.keys(SKINS) as ClassId[];
  if (!classes.includes(h.cls) || typeof h.skin !== 'string') return false;
  if (h.deck.length < 1 || h.deck.length > 40) return false;
  return h.deck.every(id => CARDS[id]?.cls === h.cls);
}
