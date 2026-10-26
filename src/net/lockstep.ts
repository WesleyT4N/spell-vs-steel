// The lockstep driver for one online round: schedules this side's controls, runs a battle frame only
// once both sides' controls for it are in, opens and closes the Draw screen in step, and records
// checksums. It has no screen or keyboard of its own, so the online scene and the headless soak test
// (scripts/netsoak.ts) run exactly the same code.
import type { Battle, Side } from '../game/battle';
import { battleHash } from './hash';
import { NO_INPUT, type NetInput } from './protocol';
import type { NetSession } from './session';

export const STEP = 1 / 60;
/** Frames between checksums sent to the other side. */
export const HASH_EVERY = 30;

export class Lockstep {
  /** Next lockstep frame to run. */
  frame = 0;
  /** Display frames in a row spent waiting for the other side's input. */
  stall = 0;
  /** Presses seen while waiting on the other side, merged into the next scheduled input. */
  private pend: NetInput | null = null;
  /** Picks sent for this Draw screen; waiting on the rival's. */
  locked = false;
  /** Exactly what was sent, so both machines apply the same list. */
  private sent: number[] = [];
  /** Watchers (recorders, the soak test): every frame's two inputs, each Draw screen's picks, each checksum. */
  onFrame?: (frame: number, ins: [NetInput, NetInput]) => void;
  onPicks?: (turn: number, picks: [number[], number[]]) => void;
  onHash?: (frame: number, hash: number) => void;
  /** Delay retuning: display frames counted and separate waits seen in the current second, calm seconds in a row. */
  private tuneN = 0;
  private tuneStalls = 0;
  private calm = 0;

  constructor(readonly net: NetSession, readonly b: Battle) {}

  get me(): Side { return this.net.side; }

  /**
   * One display frame of the fight (or K.O.): schedule this side's controls `now`, then run one
   * battle frame, or two when the other side is ahead of us. Returns 'custom' when a Draw screen
   * opened, 'stall' when it is waiting on the other side.
   */
  advance(now: NetInput): 'custom' | 'stall' | null {
    const b = this.b, net = this.net;
    this.pend = this.pend ? merge(this.pend, now) : now;
    this.retune();
    const behind = net.remoteContig - net.remoteDelay > this.frame + 2;
    for (let n = behind ? 2 : 1; n > 0; n--) {
      // a loop, so a raised delay fills its gap at once (a lowered one just skips a frame of scheduling)
      while (net.scheduled <= this.frame + net.delay) {
        net.pushLocal(this.pend ?? held(now));
        this.pend = null;
      }
      const theirs = net.remoteInput(this.frame), mine = net.localInput(this.frame);
      if (!theirs || !mine) {
        // count each wait once: many short waits mean the line's jitter outruns the delay, while one
        // long wait is a hitch or a dropout that more delay would not have hidden
        if (this.stall++ === 0) this.tuneStalls++;
        return 'stall';
      }
      this.stall = 0;
      const ins: [NetInput, NetInput] = this.me === 0 ? [mine, theirs] : [theirs, mine];
      this.onFrame?.(this.frame, ins);
      this.frame++;
      if (b.phase === 'fight' && (ins[0].draw || ins[1].draw) && b.canOpenCustom()) {
        b.beginCustom();
        return 'custom';
      }
      b.update(STEP, ins);
      if (this.frame % HASH_EVERY === 0) {
        const h = battleHash(b);
        net.recordHash(this.frame, h);
        this.onHash?.(this.frame, h);
      }
      if (b.phase !== 'fight' && b.phase !== 'ko') break;
    }
    return null;
  }

  /**
   * Every second, nudge this side's input delay by a frame: up when play kept waiting on packets
   * (the line is worse than the ping said), down after a few smooth seconds above what the ping needs.
   * Only this side's own scheduling changes, so the two machines stay in step whatever either picks.
   */
  private retune(): void {
    const net = this.net;
    if (++this.tuneN < 60) return;
    const stalls = this.tuneStalls;
    this.tuneN = 0;
    this.tuneStalls = 0;
    // waiting on a rival who is reconnecting or tabbed out says nothing about the line
    if (net.status !== 'connected' || net.rivalAway) { this.calm = 0; return; }
    const target = net.targetDelay();
    if (stalls >= 3 || net.delay < target - 1) { net.nudgeDelay(true); this.calm = 0; return; }
    this.calm = stalls ? 0 : this.calm + 1;
    if (this.calm >= 3 && net.delay > target) { net.nudgeDelay(false); this.calm = 0; }
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
