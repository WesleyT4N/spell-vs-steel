// Replays: a round is its seed, both fighters, and every frame's controls. The rules are
// deterministic (all randomness comes from the battle's seed, see online play), so feeding the same
// controls into a fresh battle plays the same round again. Recording wraps a battle's update and
// Draw screen calls, so it works the same for local versus, CPU matches and online play.
//
// Playback skips the Draw screens, as Battle Network replays do: the picks are applied the moment the
// screen opens and the fight carries straight on.
import { getReplays, setReplays, MAX_KEPT_REPLAYS } from '../engine/save';
import { Battle, NO_INTENT, type FighterSpec, type Intent, type Side } from './battle';
import { CARDS } from './cards';
import { TUNING } from './tuning';
import { battleHash } from '../net/hash';
import { PROTOCOL, decodeInput, encodeInput } from '../net/protocol';
import type { ClassId } from '../art/sprites';

const STEP = 1 / 60;

/** One recorded round. */
export interface RoundTape {
  seed: number;
  specs: [FighterSpec, FighterSpec];
  /** Each update's two inputs (two characters a side), run-length packed as [code, count]. */
  frames: Array<[string, number]>;
  /** Draw screens, by the update they came before: ['b', at] opened one, ['e', at, picks0, picks1] closed it. */
  events: Array<['b', number] | ['e', number, number[], number[]]>;
  /** Updates recorded, the battle's checksum when the round ended, and who won. */
  n: number;
  hash: number;
  winner: Side | null;
  /** Fighters changed after the battle was made (arcade's boss): [name, max HP] a side. */
  fx?: [[string, number], [string, number]];
}

export type ReplayMode = 'cpu' | 'arcade' | 'versus' | 'watch' | 'online' | 'ranked';

/** A whole set: every round played, newest last. */
export interface Replay {
  id: string;
  /** Rules fingerprint of the build that recorded it: a different one may not play back the same. */
  v: number;
  at: number;
  mode: ReplayMode;
  /** The side the recording player was on (null: nobody, or two at one keyboard). */
  me: Side | null;
  bestOf: 1 | 3 | 5;
  stage: string;
  rounds: RoundTape[];
  /** Kept: never pushed out by newer replays. */
  keep?: boolean;
}

/** Start recording `b`; `done` gets the tape once the round is over. Call before the first update. */
export function recordRound(b: Battle, done: (t: RoundTape) => void): void {
  const tape: RoundTape = { seed: b.seed, specs: [copySpec(b.specs[0]), copySpec(b.specs[1])], frames: [], events: [], n: 0, hash: 0, winner: null };
  let finished = false;
  const update = b.update.bind(b), begin = b.beginCustom.bind(b), end = b.endCustom.bind(b);
  b.update = (dt: number, ins: [Intent, Intent]): void => {
    if (finished) { update(dt, ins); return; }
    if (!tape.n) {
      const f = b.f.map(x => [x.name, x.maxHp] as [string, number]) as [[string, number], [string, number]];
      if (f.some((x, i) => x[0] !== tape.specs[i].name || x[1] !== TUNING.hp[tape.specs[i].cls as ClassId])) tape.fx = f;
    }
    const code = encode(ins[0]) + encode(ins[1]);
    const last = tape.frames[tape.frames.length - 1];
    if (last && last[0] === code) last[1]++; else tape.frames.push([code, 1]);
    tape.n++;
    update(dt, ins);
    if (b.phase === 'over') {
      finished = true;
      tape.hash = battleHash(b);
      tape.winner = b.winner;
      done(tape);
    }
  };
  b.beginCustom = (): void => { if (!finished) tape.events.push(['b', tape.n]); begin(); };
  b.endCustom = (picks: [number[], number[]]): void => {
    if (!finished) tape.events.push(['e', tape.n, picks[0].slice(), picks[1].slice()]);
    end(picks);
  };
}

const copySpec = (s: FighterSpec): FighterSpec => ({ cls: s.cls, deck: s.deck.slice(), name: s.name, skin: s.skin });
const encode = (i: Intent): string => encodeInput({ ...i, draw: false });

/** Plays a tape back into a fresh battle, one recorded update at a time. */
export class TapePlayer {
  readonly b: Battle;
  /** Updates run so far. */
  i = 0;
  private run = 0;
  private used = 0;
  private ev = 0;

  constructor(readonly tape: RoundTape) {
    this.b = new Battle(copySpec(tape.specs[0]), copySpec(tape.specs[1]), tape.seed);
    tape.fx?.forEach(([name, hp], i) => { const f = this.b.f[i]; f.name = name; f.maxHp = f.hp = hp; });
  }

  get done(): boolean { return this.b.phase === 'over' || this.i >= this.tape.n; }
  /** The battle ended where the recording did (false once a rules change has played it differently). */
  get matches(): boolean { return this.b.phase === 'over' && battleHash(this.b) === this.tape.hash; }

  /** Run the next recorded update, with any Draw screen due before it. False once the tape is done. */
  step(): boolean {
    const t = this.tape, b = this.b;
    while (this.ev < t.events.length && t.events[this.ev][1] <= this.i) {
      const e = t.events[this.ev++];
      if (e[0] === 'b') { if (b.phase === 'fight') b.beginCustom(); }
      else if (b.phase === 'custom') b.endCustom([e[2].slice(), e[3].slice()]);
    }
    if (this.done) return false;
    const run = t.frames[this.run];
    const a = decodeInput(run[0], 0), c = decodeInput(run[0], 2);
    if (++this.used >= run[1]) { this.run++; this.used = 0; }
    this.i++;
    b.update(STEP, [a ?? NO_INTENT, c ?? NO_INTENT]);
    return true;
  }

  /** Step through a Draw screen (and anything else that is not fighting) without showing it. */
  skipDraw(): void {
    let guard = 0;
    while (this.b.phase === 'custom' && this.step() && guard++ < 1e6) { /* fast-forward */ }
  }
}

/** Changes whenever the rules a replay depends on change: tuning, the card list, or the online protocol. */
export const RULES_VERSION = ((): number => {
  const cards = Object.values(CARDS).map(c => `${c.id}:${c.cost}`).join(',');
  const s = `${PROTOCOL}|${JSON.stringify(TUNING)}|${cards}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
})();

// ---------- saved replays (this browser only) ----------
// kept in the save module, which applies the caps: 20 newest + up to 20 kept, newest first
export function loadReplays(): Replay[] {
  return getReplays<Replay>().filter(r => Array.isArray(r.rounds)).map(r => ({ ...r }));
}

function store(list: Replay[]): void { setReplays(list); }

/** Add or update a replay (by id). */
export function saveReplay(r: Replay): void {
  const list = loadReplays().filter(x => x.id !== r.id);
  list.push(r);
  store(list);
}

export function deleteReplay(id: string): void { store(loadReplays().filter(r => r.id !== id)); }

/** Keep or unkeep a replay. False when the kept list is full. */
export function toggleKeep(id: string): boolean {
  const list = loadReplays();
  const r = list.find(x => x.id === id);
  if (!r) return false;
  if (!r.keep && list.filter(x => x.keep).length >= MAX_KEPT_REPLAYS) return false;
  r.keep = !r.keep;
  store(list);
  return true;
}

export function newReplayId(): string { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

/** Rounds won by each side. */
export function replayScore(r: Replay): [number, number] {
  const s: [number, number] = [0, 0];
  for (const t of r.rounds) if (t.winner !== null) s[t.winner]++;
  return s;
}

export const replayClasses = (r: Replay): [ClassId, ClassId] => [r.rounds[0].specs[0].cls, r.rounds[0].specs[1].cls];
