// The online driver for one round: schedules this side's controls, runs the battle through rollback
// (rollback.ts), keeps pace with the other machine, and opens and closes the Draw screen in step. It
// has no screen or keyboard of its own, so the online scene and the headless soak test
// (scripts/netsoak.ts) run exactly the same code.
import type { Battle, Side } from '../game/battle';
import { NO_INPUT, type NetInput } from './protocol';
import { Rollback, MAX_ROLLBACK } from './rollback';
import { clock, type NetSession } from './session';

export const STEP = 1 / 60;

export class Netplay {
  readonly rb: Rollback;
  /** Display frames in a row spent waiting because we got too far ahead of the other side. */
  stall = 0;
  /** Picks sent for this Draw screen; waiting on the rival's. */
  locked = false;
  /** Exactly what was sent, so both machines apply the same list. */
  private sent: number[] = [];
  /** Presses seen since the last scheduled input, merged into the next one. */
  private pend: NetInput | null = null;
  /** Smoothed frames we run ahead of the other side's clock (positive: we are ahead). */
  private lead = 0;
  private tickN = 0;
  /** Watchers (recorders, the soak test): each agreed frame (an update, or the Draw screen opening), each Draw screen's picks, each checksum. */
  onFrame?: (frame: number, ins: [NetInput, NetInput], kind: 'update' | 'draw') => void;
  onPicks?: (turn: number, picks: [number[], number[]]) => void;
  onHash?: (frame: number, hash: number) => void;

  /** `extra`: objects that watch the battle and must rewind with it (post-match stats). */
  constructor(readonly net: NetSession, readonly b: Battle, extra: object[] = []) {
    this.rb = new Rollback(b, net.side, { local: f => net.localInput(f), remote: f => net.remoteInput(f) }, extra, (f, h) => {
      net.recordHash(f, h);
      this.onHash?.(f, h);
    });
    this.rb.onConfirmed = (f, ins, kind) => this.onFrame?.(f, ins, kind);
  }

  get me(): Side { return this.net.side; }
  /** Frames shown (agreed plus guessed). */
  get frame(): number { return this.rb.frame; }
  /** The shown battle is the agreed one (results wait for this). */
  get settled(): boolean { return this.rb.settled; }

  /**
   * One display frame of the fight (or K.O.): schedule this side's controls `now`, then run the battle
   * forward. Returns 'custom' when a Draw screen opened, 'stall' when it is waiting on the other side.
   */
  advance(now: NetInput): 'custom' | 'stall' | null {
    const b = this.b, net = this.net;
    this.pend = this.pend ? merge(this.pend, now) : now;
    // our input goes in `net.delay` frames ahead, which hides small hiccups
    while (net.scheduled <= this.rb.frame + net.delay) {
      net.pushLocal(this.pend ?? held(now));
      this.pend = null;
    }
    const ran = this.rb.advance(this.framesToRun());
    net.frame = this.rb.frame;
    // the Draw screen only ever opens on a frame both sides agree on
    if (b.phase === 'custom') { this.stall = 0; return 'custom'; }
    if (ran === 0 && this.rb.ahead >= MAX_ROLLBACK) { this.stall++; return 'stall'; }
    this.stall = 0;
    return null;
  }

  /**
   * Frames to run this tick: one normally, two to catch up when the other side's clock is ahead,
   * none now and then when ours is ahead, so neither side keeps guessing further than it must.
   */
  private framesToRun(): number {
    const net = this.net, r = net.remote;
    this.tickN++;
    if (!r || r.fr === undefined || !net.rtt || net.status !== 'connected') return 1;
    // where the other side's clock is now: its last report, plus the trip and the time since
    const theirs = r.fr + (net.rtt / 2 + (clock.now() - net.heardAt)) / (1000 / 60);
    this.lead = this.lead * 0.9 + (this.rb.frame - theirs) * 0.1;
    if (this.lead < -2) return 2;
    if (this.lead > 2 && this.tickN % 6 === 0) return 0;
    return 1;
  }

  /** Lock in this side's Draw screen picks. */
  lock(picks: number[]): void {
    if (this.locked) return;
    this.locked = true;
    this.sent = this.net.setPicks(this.b.turn, picks);
  }

  /** On the Draw screen: once both sides' picks are in, close it. Returns true when the fight resumed. */
  settle(): boolean {
    const theirs = this.net.remotePicks(this.b.turn);
    if (!this.locked || !theirs) return false;
    const mine = this.sent.slice();
    const picks: [number[], number[]] = this.me === 0 ? [mine, theirs] : [theirs, mine];
    this.onPicks?.(this.b.turn, [picks[0].slice(), picks[1].slice()]);
    this.b.endCustom(picks);
    this.rb.resave();
    this.locked = false;
    return true;
  }
}

function merge(a: NetInput, b: NetInput): NetInput {
  return {
    move: b.move ?? a.move, held: b.held, attackHeld: b.attackHeld,
    attackPressed: a.attackPressed || b.attackPressed, castPressed: a.castPressed || b.castPressed, draw: a.draw || b.draw,
  };
}
/** Same held keys, no new presses. */
const held = (i: NetInput): NetInput => ({ ...NO_INPUT, held: i.held, attackHeld: i.attackHeld });
