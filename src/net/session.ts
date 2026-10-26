// One online match between two machines: the handshake, readiness for each round, and the input
// buffers. Both machines run the same seeded battle and only trade controls, so the simulation
// itself never crosses the wire.
//
// The input you press now is scheduled a small `delay` ahead and sent to the other side. The battle
// does not wait for the other side's inputs: rollback netcode (rollback.ts) guesses them, and goes
// back and replays when the real ones land. The delay grows a little with ping so corrections stay
// short; a long silence still waits (after MAX_ROLLBACK guessed frames).
import { CARDS } from '../game/cards';
import { SKINS, type ClassId } from '../art/sprites';
import { PROTOCOL, decodeInput, encodeInput, type Hello, type Lobby, type NetInput, type Packet } from './protocol';
import type { Transport } from './transport';

const WINDOW = 600;          // most frames of inputs re-sent per packet (10s)
const QUIET_AFTER = 1500;    // ms of silence before the screen says RECONNECTING
const LOST_AFTER = 30000;    // ms of silence before the match counts as dropped
const AWAY_LOST_AFTER = 180000; // the same while the rival's tab is in the background (it still pings once a second)
const REVIVE_EVERY = 3000;   // ms between attempts to rebuild a quiet link
const STEP_MS = 1000 / 60;
const MAX_DELAY = 8;

/** Where the session reads the time; the soak test swaps in a simulated clock. */
export const clock = { now: (): number => performance.now() };

/**
 * waiting: no word from the other side yet. reconnecting: they went quiet mid-match; the game holds
 * and picks up where it was if they come back within LOST_AFTER. lost: they did not.
 */
export type NetStatus = 'waiting' | 'connected' | 'reconnecting' | 'lost' | 'left' | 'error';

export class NetSession {
  readonly id = Math.random().toString(36).slice(2, 10);
  status: NetStatus = 'waiting';
  error = '';
  /** Latest packet from the other side. */
  remote: Packet | null = null;
  start?: { seed: number; bestOf: 1 | 3 | 5 };
  myReady = 0;
  round = 0;
  delay = 2;
  /** This side's current battle frame, sent so the other side can keep pace. */
  frame = 0;
  /** When the latest packet from the other side arrived (performance.now()). */
  heardAt = 0;
  /** Smoothed round-trip time in ms (0 until measured). */
  rtt = 0;
  desync = false;
  /** Spread of the round-trip samples (ms), for picking an input delay that covers the jitter. */
  rttDev = 0;
  /** This page is in a background tab: it only pings, so the other side waits instead of timing out. */
  away = false;
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
  private stopKeepalive?: () => void;
  private revivedAt = 0;

  constructor(readonly role: 'host' | 'guest', readonly code: string, public hello: Hello, readonly transport: Transport, bestOf: 1 | 3 | 5) {
    if (role === 'host') this.start = { seed: Math.floor(Math.random() * 4294967296), bestOf };
    transport.onPacket(p => this.receive(p));
    transport.onClose(reason => { if (this.status !== 'left') { this.status = 'error'; this.error = reason; } });
    this.stopKeepalive = keepalive(this);
  }

  get side(): 0 | 1 { return this.role === 'host' ? 0 : 1; }
  get rival(): Hello | null { return this.remote?.hello ?? null; }
  get rivalLobby(): Lobby | null { return this.remote?.lobby ?? null; }
  get remoteReady(): number { return this.remote?.ready ?? 0; }
  get remoteDelay(): number { return this.remote?.delay ?? this.delay; }
  /** The other player's tab is in the background. */
  get rivalAway(): boolean { return !!this.remote?.away; }
  /** Seconds left before a quiet rival counts as gone. */
  get graceLeft(): number { return Math.max(0, ((this.rivalAway ? AWAY_LOST_AFTER : LOST_AFTER) - (clock.now() - this.lastHeard)) / 1000); }
  /** Both sides have said hello and the host's match settings are known. */
  get matched(): boolean { return this.status === 'connected' && !!this.start && !!this.remote; }

  /** Call every frame: sends this side's state and watches for silence. */
  tick(): void {
    const now = clock.now();
    const quiet = now - this.lastHeard;
    if ((this.status === 'connected' || this.status === 'reconnecting') && quiet > (this.rivalAway ? AWAY_LOST_AFTER : LOST_AFTER)) this.status = 'lost';
    else if (this.status === 'connected' && quiet > QUIET_AFTER) this.status = 'reconnecting';
    // while quiet, have the transport rebuild its link every few seconds (the rival may have tabbed out: that is fine too)
    if (this.status === 'reconnecting' && !this.rivalAway && now - this.revivedAt > REVIVE_EVERY) {
      this.revivedAt = now;
      this.transport.revive?.();
    }
    if (this.status === 'error' || this.status === 'left') return;
    const from = Math.max(this.remoteAck + 1, this.local.length - WINDOW, 0);
    const p: Packet = {
      v: PROTOCOL, id: this.id, role: this.role, seq: ++this.seq,
      t: Math.round(now), et: this.remoteT, ed: this.remoteT ? Math.round(now - this.remoteAt) : 0,
      hello: this.hello, lobby: this.lobby, start: this.role === 'host' ? this.start : undefined,
      ready: this.myReady, round: this.round, delay: this.delay, fr: this.frame,
      base: from, inp: this.local.slice(from).join(''), ack: this.remoteContig,
      picks: this.picks, hash: this.hash, bye: this.bye || undefined, away: this.away || undefined,
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
    const now = clock.now();
    if (p.et > 0) {
      const sample = Math.max(0, now - p.et - p.ed);
      // a packet held up by an outage or a background tab says nothing about the line
      if (!p.away && !this.away && sample < 3000) {
        this.rttDev = this.rtt ? this.rttDev * 0.9 + Math.abs(sample - this.rtt) * 0.1 : sample / 4;
        this.rtt = this.rtt ? this.rtt * 0.85 + sample * 0.15 : sample;
      }
    }
    this.remoteT = p.t;
    this.remoteAt = now;
    this.lastHeard = now;
    this.heardAt = now;
    this.remote = p;
    if (p.bye) { this.status = 'left'; return; }
    if (this.status === 'waiting' || this.status === 'reconnecting' || this.status === 'lost') this.status = 'connected';
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

  /**
   * Input delay (frames) for a round. Two covers a good connection; on a slow or jittery one, delay
   * takes over part of the trip so rollback corrections stay around six frames or less.
   */
  targetDelay(): number {
    if (!this.rtt) return 2;
    let d = Math.ceil((this.rtt / 2 + this.rttDev) / STEP_MS) - 6;
    if (this.transport.kind === 'room') d += 1; // presence is sent about 30 times a second
    return Math.min(MAX_DELAY, Math.max(2, d));
  }

  /** Start round `r`: clear the buffers and pick an input delay from the measured ping. */
  beginRound(r: number): void {
    this.round = r;
    this.frame = 0;
    this.delay = this.targetDelay();
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

  /** Lock in this Draw screen's picks; returns the list as sent (both machines apply exactly that). */
  setPicks(turn: number, p: number[]): number[] {
    this.picks = { round: this.round, turn, p: p.filter(n => Number.isInteger(n)).slice(0, 5) };
    return this.picks.p.slice();
  }
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

  /** Hang up without a goodbye (the other side is already gone). */
  close(): void {
    this.stopKeepalive?.();
    this.transport.close();
  }

  /** Tell the other side we are leaving, then close. */
  leave(): void {
    this.stopKeepalive?.();
    this.bye = true;
    this.tick();
    this.status = 'left';
    setTimeout(() => this.transport.close(), 300);
  }
}

/**
 * A background tab gets no animation frames, so the game loop (and with it every packet) stops.
 * Keep pinging from a timer while hidden, flagged `away`, so the other side waits for us rather
 * than calling the match lost. Browsers slow hidden-tab timers to about once a second, plenty here.
 */
function keepalive(net: NetSession): (() => void) | undefined {
  if (typeof document === 'undefined') return undefined;
  let timer = 0;
  const check = (): void => {
    net.away = document.hidden;
    clearInterval(timer);
    if (document.hidden) timer = window.setInterval(() => { if (net.status === 'left' || net.status === 'error') clearInterval(timer); else net.tick(); }, 500);
  };
  document.addEventListener('visibilitychange', check);
  check();
  return () => { clearInterval(timer); document.removeEventListener('visibilitychange', check); };
}

function validHello(h: Hello): boolean {
  const classes = Object.keys(SKINS) as ClassId[];
  if (!classes.includes(h.cls) || typeof h.skin !== 'string') return false;
  if (h.deck.length < 1 || h.deck.length > 40) return false;
  return h.deck.every(id => CARDS[id]?.cls === h.cls);
}
