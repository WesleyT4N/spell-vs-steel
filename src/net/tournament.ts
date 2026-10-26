// Tournaments: a single-elimination bracket of 4 or 8 players, best-of-3 sets, run from the lobby with
// no server of our own. The player who opens it hosts: their page keeps the bracket in its presence
// (`tb`), and everyone else talks to it through theirs (`tr`): asking to join, saying they are ready
// for their next set, and reporting who won. The host's page keeps running the bracket in the
// background while the host plays their own sets. If the host leaves, the tournament ends.
//
// Players are lobby ids (one per page load); names come from the lobby.
import { PROTOCOL } from './protocol';
import { openPresence, type PresenceField } from './presence';
import { matchCode } from './matchmaking';
import { lobbyId } from './lobby';

export type Size = 4 | 8;

export interface Bracket {
  v: number;
  tid: string;
  host: string;
  size: Size;
  state: 'open' | 'live' | 'done';
  /** Seats in bracket order once live (null: a bye); while open, everyone who has joined. */
  players: Array<string | null>;
  /** Winner of each set, as a player id, in bracket order: round one's sets, then round two's, ... */
  won: Array<string | null>;
}

/** What a player tells the host. */
export interface Note {
  /** The player's lobby id. */
  id: string;
  tid: string;
  join: boolean;
  /** Ready for this set (index into `won`). */
  ready: number | null;
  /** Result of a set: [set, winner]. */
  rep: [number, string] | null;
}

const isBracket = (x: unknown): x is Bracket => {
  const b = x as Bracket;
  return !!b && typeof b === 'object' && typeof b.tid === 'string' && (b.size === 4 || b.size === 8) && Array.isArray(b.players) && Array.isArray(b.won);
};
const isNote = (x: unknown): x is Note => { const n = x as Note; return !!n && typeof n === 'object' && typeof n.tid === 'string' && typeof n.id === 'string'; };

// ---------- bracket shape ----------
export const rounds = (size: Size): number => (size === 8 ? 3 : 2);
/** Index into `won` of round r's set j. */
export const setIndex = (size: Size, r: number, j: number): number => { let k = 0; for (let i = 0; i < r; i++) k += size >> (i + 1); return k + j; };
export const setsIn = (size: Size, r: number): number => size >> (r + 1);

/** The two players of round r's set j (null: not decided yet, or a bye). */
export function setPlayers(b: Bracket, r: number, j: number): [string | null, string | null] {
  if (r === 0) return [b.players[2 * j] ?? null, b.players[2 * j + 1] ?? null];
  return [b.won[setIndex(b.size, r - 1, 2 * j)] ?? null, b.won[setIndex(b.size, r - 1, 2 * j + 1)] ?? null];
}

/** A set is settled once it has a winner, or when nobody can ever reach it (byes on both sides). */
function settled(b: Bracket, r: number, j: number): boolean {
  if (b.won[setIndex(b.size, r, j)]) return true;
  const [x, y] = setPlayers(b, r, j);
  return !x && !y && feedersDone(b, r, j);
}
const feedersDone = (b: Bracket, r: number, j: number): boolean => r === 0 || (settled(b, r - 1, 2 * j) && settled(b, r - 1, 2 * j + 1));

/** Fill in byes: a set with one player once its feeders are done goes to that player. */
export function advanceByes(b: Bracket): void {
  for (let r = 0; r < rounds(b.size); r++) for (let j = 0; j < setsIn(b.size, r); j++) {
    const k = setIndex(b.size, r, j);
    if (b.won[k] || !feedersDone(b, r, j)) continue;
    const [x, y] = setPlayers(b, r, j);
    if (x && !y) b.won[k] = x;
    else if (y && !x) b.won[k] = y;
  }
  const final = b.won[b.size - 2];
  if (final) b.state = 'done';
}

/** The set `me` plays next: its index, round, slot and rival; null when out, done or waiting. */
export function nextSet(b: Bracket, me: string): { k: number; r: number; j: number; rival: string; top: boolean } | null {
  if (b.state !== 'live') return null;
  for (let r = 0; r < rounds(b.size); r++) for (let j = 0; j < setsIn(b.size, r); j++) {
    const k = setIndex(b.size, r, j);
    if (b.won[k]) continue;
    const [x, y] = setPlayers(b, r, j);
    if (x && y && (x === me || y === me)) return { k, r, j, rival: x === me ? y : x, top: x === me };
  }
  return null;
}

export const champion = (b: Bracket): string | null => (b.state === 'done' ? b.won[b.size - 2] : null);
export const setCode = (b: Bracket, k: number): string => matchCode(`t${b.tid}`, `s${k}`);

// ---------- running one (this page) ----------
function shuffle<T>(a: T[]): T[] { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/** This page's tournament: hosting one, or joined to someone else's. One at a time. */
class Tournaments {
  tb: PresenceField<Bracket> | null = null;
  tr: PresenceField<Note> | null = null;
  /** The bracket we host. */
  mine: Bracket | null = null;
  /** The tournament we are in (ours or another's). */
  tid: string | null = null;
  note: Note | null = null;
  private timer = 0;

  /** Start listening for tournaments on the page; false where there is no room. */
  async open(): Promise<boolean> {
    this.tb ??= await openPresence('tb', isBracket);
    this.tr ??= await openPresence('tr', isNote);
    if (!this.timer) this.timer = window.setInterval(() => this.host(), 250);
    return !!(this.tb && this.tr);
  }

  /** Every tournament on the page, ours included. */
  all(): Bracket[] {
    const list = (this.tb?.others() ?? []).map(o => o.v).filter(b => b.v === PROTOCOL);
    return this.mine ? [this.mine, ...list] : list;
  }
  current(): Bracket | null { return this.all().find(b => b.tid === this.tid) ?? null; }

  async create(size: Size): Promise<boolean> {
    if (!(await this.open())) return false;
    this.leave();
    const me = lobbyId();
    this.mine = { v: PROTOCOL, tid: Math.random().toString(36).slice(2, 8), host: me, size, state: 'open', players: [me], won: Array(size - 1).fill(null) };
    this.tid = this.mine.tid;
    this.tb!.set(this.mine);
    return true;
  }

  async join(tid: string): Promise<boolean> {
    if (!(await this.open())) return false;
    this.leave();
    this.tid = tid;
    this.say({ id: lobbyId(), tid, join: true, ready: null, rep: null });
    return true;
  }

  /** Start with whoever has joined; empty seats become byes. Host only. */
  start(): void {
    const b = this.mine;
    if (!b || b.state !== 'open' || b.players.filter(Boolean).length < 2) return;
    const seats: Array<string | null> = shuffle(b.players.slice());
    while (seats.length < b.size) seats.push(null);
    // spread the byes: a bye seat never faces another bye in round one when it can be helped
    const real = seats.filter(Boolean) as string[];
    const out: Array<string | null> = Array(b.size).fill(null);
    let i = 0;
    for (let j = 0; j < b.size / 2 && i < real.length; j++) out[2 * j] = real[i++];
    for (let j = 0; j < b.size / 2 && i < real.length; j++) out[2 * j + 1] = real[i++];
    b.players = out;
    b.state = 'live';
    advanceByes(b);
    this.tb!.set({ ...b });
  }

  ready(k: number | null): void { if (this.note && this.note.ready !== k) this.say({ ...this.note, ready: k }); }
  report(k: number, winner: string): void {
    if (this.mine) { this.record(k, winner); return; }
    if (this.note) this.say({ ...this.note, rep: [k, winner], ready: null });
  }

  private say(n: Note): void { this.note = n; this.tr?.set(n); }

  private record(k: number, winner: string): void {
    const b = this.mine!;
    if (b.state !== 'live' || b.won[k]) return;
    // only a player of that set can win it
    const r = [0, 1, 2].find(x => k < setIndex(b.size, x + 1, 0)) ?? 0, j = k - setIndex(b.size, r, 0);
    const [x, y] = setPlayers(b, r, j);
    if (winner !== x && winner !== y) return;
    b.won[k] = winner;
    advanceByes(b);
    this.tb!.set({ ...b, won: b.won.slice() });
  }

  /** The host's side, every quarter second: take joins and results. */
  private host(): void {
    const b = this.mine;
    if (!b || !this.tr) return;
    let changed = false;
    for (const { v: n } of this.tr.others()) {
      if (n.tid !== b.tid) continue;
      if (n.rep) this.record(n.rep[0], n.rep[1]);
    }
    if (b.state === 'open') {
      // joins: everyone asking, in a stable order, until the seats are full
      const asking = this.tr.others().map(o => o.v).filter(n => n.tid === b.tid && n.join);
      for (const n of asking) {
        const id = n.id;
        if (!b.players.includes(id) && b.players.length < b.size) { b.players.push(id); changed = true; }
      }
      // gone players drop out before the start
      const here = new Set(asking.map(n => n.id));
      const kept = b.players.filter(p => p === b.host || (p !== null && here.has(p)));
      if (kept.length !== b.players.length) { b.players = kept; changed = true; }
    }
    if (changed) this.tb!.set({ ...b, players: b.players.slice() });
  }

  /** Who is ready for which set (from everyone's notes), for the bracket screen and meeting. */
  readyFor(k: number): Set<string> {
    const out = new Set<string>();
    for (const { v: n } of this.tr?.others() ?? []) if (n.tid === this.tid && n.ready === k) out.add(n.id);
    if (this.note?.ready === k) out.add(lobbyId());
    return out;
  }

  leave(): void {
    if (this.mine) this.tb?.set(null);
    this.mine = null;
    this.tid = null;
    this.note = null;
    this.tr?.set(null);
  }
}

export const tournaments = new Tournaments();
