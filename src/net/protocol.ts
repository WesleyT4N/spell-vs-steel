// What the two machines tell each other. Every packet is the sender's whole current state (its
// recent inputs, picks, readiness), never a one-off event, so a dropped or merged packet loses
// nothing: the next one repeats it. That lets the same protocol ride on a data channel at 60 Hz or
// on claude.ai room presence, which keeps only the latest value.
import type { ClassId } from '../art/sprites';
import type { Dir, Intent } from '../game/battle';

/** Bump when the rules or the protocol change, so mismatched builds refuse to play each other. */
export const PROTOCOL = 4;

export interface Hello { cls: ClassId; skin: string; deck: string[] }

/** Character and stage select: where this side's cursor is and what it has locked in. */
export interface Lobby {
  /** 0 picking a fighter, 1 picking a skin, 2 fighter locked in (final). */
  step: 0 | 1 | 2;
  /** Roster tile under the cursor (the last one is RANDOM). */
  tile: number;
  /** Stage under the cursor, or this side's vote once `voted` ('random' is a vote too). */
  stage: string;
  voted: boolean;
}

export interface Packet {
  v: number;
  /** Random id for this page load: tells a reload from the same player. */
  id: string;
  role: 'host' | 'guest';
  seq: number;
  /** Sender's clock (ms), and the last clock it heard from us plus how long ago, for round-trip time. */
  t: number;
  et: number;
  ed: number;
  /** This side's fighter: the latest pick during character select, final once `lobby.step` is 2. */
  hello: Hello;
  lobby?: Lobby;
  /** Host only: the match everyone plays. */
  start?: { seed: number; bestOf: 1 | 3 | 5 };
  /** Highest round this side is ready to start (1 = first round). */
  ready: number;
  /** Round the inputs below belong to. */
  round: number;
  /** This side's input delay in frames. */
  delay: number;
  /** This side's current battle frame, so the faster machine can ease off (rollback time sync). */
  fr?: number;
  /** Inputs for frames base, base+1, ... (two characters per frame). */
  base: number;
  inp: string;
  /** Highest frame of the other side's inputs received without gaps (-1: none). */
  ack: number;
  /** The spells this side picked on its latest Draw screen. */
  picks?: { round: number; turn: number; p: number[] };
  /** [frame, checksum] of a recent frame, for desync detection. */
  hash?: [number, number];
  bye?: boolean;
}

/** One frame of a player's controls, packed into 10 bits. */
export interface NetInput extends Intent { draw: boolean }
export const NO_INPUT: NetInput = { move: null, held: null, attackPressed: false, attackHeld: false, castPressed: false, draw: false };

const DIRS: Array<Dir | null> = [null, 'up', 'down', 'left', 'right'];
const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function encodeInput(i: NetInput): string {
  const v = DIRS.indexOf(i.move) | (DIRS.indexOf(i.held) << 3)
    | (i.attackPressed ? 64 : 0) | (i.attackHeld ? 128 : 0) | (i.castPressed ? 256 : 0) | (i.draw ? 512 : 0);
  return A[v >> 5] + A[v & 31];
}

export function decodeInput(s: string, at = 0): NetInput | null {
  const hi = A.indexOf(s[at]), lo = A.indexOf(s[at + 1]);
  if (hi < 0 || lo < 0) return null;
  const v = (hi << 5) | lo;
  return {
    move: DIRS[v & 7] ?? null, held: DIRS[(v >> 3) & 7] ?? null,
    attackPressed: !!(v & 64), attackHeld: !!(v & 128), castPressed: !!(v & 256), draw: !!(v & 512),
  };
}

/** Light check that a packet from the other side has the fields we read. */
export function isPacket(x: unknown): x is Packet {
  const p = x as Packet;
  return !!p && typeof p === 'object' && typeof p.v === 'number' && typeof p.id === 'string'
    && (p.role === 'host' || p.role === 'guest') && typeof p.seq === 'number' && typeof p.inp === 'string'
    && typeof p.base === 'number' && typeof p.round === 'number' && !!p.hello && Array.isArray(p.hello.deck);
}

/** Room codes: 5 letters with no look-alikes (no I, O, 0, 1). */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LEN = 5;
export function newRoomCode(): string {
  let s = '';
  for (let i = 0; i < CODE_LEN; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}
export const isCodeChar = (ch: string): boolean => CODE_CHARS.includes(ch);
