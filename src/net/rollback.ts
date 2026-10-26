// Rollback netcode (GGPO style) over one battle.
//
// Frame i runs on both players' inputs for frame i. Ours are known at once (a frame or two of input
// delay smooths small hiccups); the other player's arrive a trip later. Instead of waiting for them
// (lockstep) we guess they kept holding what they held and stopped pressing anything new, and run
// ahead. When their real inputs land, the battle goes back to the last frame where both inputs were
// known (the confirmed frame), replays the frames whose inputs are now known, saves that as the new
// confirmed state, and runs the guessed frames again on top. A correct guess changes nothing; a wrong
// one shows as a short correction instead of a freeze.
//
// Rules that stay on confirmed frames only:
//  - the Draw screen opens on a confirmed frame, so it never opens on a guess and closes again;
//  - the round ends on a confirmed frame (a guessed K.O. can still be undone);
//  - desync checksums are taken on confirmed frames.
// Sounds play when a frame runs for the first time; replays run silent.
import { Battle } from '../game/battle';
import { withoutSfx } from '../engine/audio';
import { NO_INPUT, type NetInput } from './protocol';
import { loadBattle, saveBattle, type Snapshot } from './snapshot';
import { battleHash } from './hash';

const STEP = 1 / 60;
/** Furthest we run ahead of the other player's last known input before waiting for them. */
export const MAX_ROLLBACK = 10;
/** Frames between desync checksums. */
const HASH_EVERY = 30;

/** The guess for a frame we have no input for yet: keep holding, press nothing new. */
export const predictFrom = (last: NetInput | null): NetInput =>
  last ? { ...NO_INPUT, held: last.held, attackHeld: last.attackHeld } : NO_INPUT;

/** Where the inputs come from: index = frame. A missing frame returns null. */
export interface InputSource {
  local(frame: number): NetInput | null;
  remote(frame: number): NetInput | null;
}

export class Rollback {
  /** Frames run in the battle as shown (confirmed plus guessed). */
  frame = 0;
  /** Frames run on known inputs only; `snap` holds the battle at this point. */
  confirmed = 0;
  /** Frames replayed by the latest correction (0 when the guess held), and the most this round. */
  lastRollback = 0;
  maxRollback = 0;
  /** Corrections that changed a guess, this round. */
  rollbacks = 0;
  /**
   * Called once for each confirmed frame, just before it runs: what the agreed battle did (an update
   * on `ins`, or opening the Draw screen). Each frame is confirmed exactly once, so this is where
   * replays get recorded.
   */
  onConfirmed?: (kind: 'update' | 'draw', ins: [NetInput, NetInput]) => void;
  private snap: Snapshot;
  /** The remote input each guessed frame ran on (index = frame). */
  private guessed: NetInput[] = [];

  /**
   * `me` is this machine's side. `extra` are objects that watch the battle and must roll back with it
   * (post-match stats). `onHash` gets a checksum every HASH_EVERY confirmed frames.
   */
  constructor(readonly b: Battle, readonly me: 0 | 1, readonly inputs: InputSource, readonly extra: object[] = [], readonly onHash?: (frame: number, h: number) => void) {
    this.snap = saveBattle(b, extra);
  }

  /** Battle frames run past what both sides agree on. */
  get ahead(): number { return this.frame - this.confirmed; }

  /** The shown battle is the agreed one: what the Draw screen and results need. */
  get settled(): boolean { return this.frame === this.confirmed; }

  /** Call after changing the battle outside of `advance` (Draw screen picks), with nothing guessed. */
  resave(): void {
    this.snap = saveBattle(this.b, this.extra);
    this.guessed.length = this.frame;
  }

  /**
   * Take in whatever inputs arrived, then try to run `want` new frames. Returns how many ran
   * (fewer when we are too far ahead of the other player, or the battle stopped).
   */
  advance(want: number): number {
    this.confirm();
    let ran = 0;
    while (ran < want && this.b.phase !== 'custom' && this.b.phase !== 'over' && this.ahead < MAX_ROLLBACK) {
      if (!this.inputs.local(this.frame)) break;
      if (this.settled && this.inputs.remote(this.frame)) {
        // both inputs known already: the frame is confirmed as it runs
        this.runConfirmed(this.frame);
        this.snap = saveBattle(this.b, this.extra);
      } else this.runGuess();
      ran++;
    }
    return ran;
  }

  /** Move the confirmed frame up to the newest frame with both inputs, replaying the guessed ones. */
  private confirm(): void {
    let upto = this.confirmed;
    while (upto < this.frame && this.inputs.remote(upto) && this.inputs.local(upto)) upto++;
    if (upto === this.confirmed) return;
    let wrong = false;
    for (let f = this.confirmed; f < upto && !wrong; f++) wrong = !same(this.guessed[f], this.inputs.remote(f)!);
    // Always replay, even when every guess held: the guessed frames ignored Draw presses, and the
    // checksums need the confirmed frames. Replays are cheap (a frame runs in microseconds).
    const target = this.frame, from = this.confirmed;
    loadBattle(this.b, this.snap);
    this.frame = from;
    withoutSfx(() => {
      while (this.frame < upto && this.b.phase !== 'custom' && this.b.phase !== 'over') this.runConfirmed(this.frame);
      this.snap = saveBattle(this.b, this.extra);
      if (this.b.phase === 'custom' || this.b.phase === 'over') return;
      while (this.frame < target && this.inputs.local(this.frame)) this.runGuess();
    });
    this.lastRollback = wrong ? target - from : 0;
    if (wrong) { this.rollbacks++; this.maxRollback = Math.max(this.maxRollback, this.lastRollback); }
  }

  /** Run frame `frame` on known inputs (Draw presses count) and confirm it. */
  private runConfirmed(f: number): void {
    const theirs = this.inputs.remote(f)!;
    this.runFrame(this.inputs.local(f)!, theirs, true);
    this.guessed[f] = theirs;
    this.frame = this.confirmed = f + 1;
    if (this.confirmed % HASH_EVERY === 0) this.onHash?.(this.confirmed, battleHash(this.b));
  }

  /** Run the next frame on our input and a guess of theirs (or their input, ahead of a gap). */
  private runGuess(): void {
    const f = this.frame;
    const g = this.inputs.remote(f) ?? predictFrom(this.lastRemote(f));
    this.guessed[f] = g;
    this.runFrame(this.inputs.local(f)!, g, false);
    this.frame = f + 1;
  }

  private runFrame(mine: NetInput, theirs: NetInput, real: boolean): void {
    const ins: [NetInput, NetInput] = this.me === 0 ? [mine, theirs] : [theirs, mine];
    const b = this.b;
    if (real && (ins[0].draw || ins[1].draw) && b.canOpenCustom()) { this.onConfirmed?.('draw', ins); b.beginCustom(); return; }
    if (real) this.onConfirmed?.('update', ins);
    b.update(STEP, ins);
  }

  private lastRemote(frame: number): NetInput | null {
    for (let f = frame - 1; f >= 0 && f >= frame - 600; f--) { const r = this.inputs.remote(f); if (r) return r; }
    return null;
  }
}

const same = (a: NetInput | undefined, b: NetInput): boolean =>
  !!a && a.move === b.move && a.held === b.held && a.attackPressed === b.attackPressed && a.attackHeld === b.attackHeld
  && a.castPressed === b.castPressed && a.draw === b.draw;
