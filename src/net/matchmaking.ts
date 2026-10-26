// Ranked matchmaking with no server of our own: everyone searching sets a "queue" entry in their
// presence in the page's lobby room (the claude.ai artifact room everyone on the page shares), with
// their rating and when they started looking. Every searcher sorts the same list the same way and pairs
// players off greedily by closest rating, with the allowed gap widening the longer someone waits. When
// two players each point at the other, they are matched: the room code comes from both ids, and the one
// with the smaller id hosts. Views that briefly disagree just point at nobody until they catch up.
//
// ?net=local runs the same queue over a BroadcastChannel between tabs, for testing.
import { PROTOCOL, CODE_LEN } from './protocol';

/** One searcher, as everyone sees them. */
export interface QueueEntry {
  v: number;
  /** Random id for this search. */
  id: string;
  rating: number;
  /** When they started searching (their clock, ms). */
  since: number;
  /** The searcher they want to play (both pointing at each other = matched). */
  want: string | null;
}

export interface Match { code: string; role: 'host' | 'guest'; rival: QueueEntry }

/** Rating gap allowed at the start of a search, how fast it widens, and its cap. */
const GAP0 = 100, GAP_PER_S = 25, GAP_MAX = 800;
/** A searcher not heard from for this long has gone. */
const STALE_MS = 4000;

export const searchGap = (waitedMs: number): number => Math.min(GAP_MAX, GAP0 + (GAP_PER_S * waitedMs) / 1000);

/**
 * Pair everyone off: oldest search first, each takes the closest-rated unpaired player whose gap fits
 * both of their waits. Pure, so every searcher computes the same pairs from the same list.
 */
export function pairUp(list: readonly QueueEntry[], now: number): Map<string, string> {
  const order = [...list].sort((a, b) => a.since - b.since || (a.id < b.id ? -1 : 1));
  const paired = new Map<string, string>();
  for (const a of order) {
    if (paired.has(a.id)) continue;
    let best: QueueEntry | null = null;
    for (const b of order) {
      if (b === a || paired.has(b.id)) continue;
      const gap = Math.abs(a.rating - b.rating);
      if (gap > Math.max(searchGap(now - a.since), searchGap(now - b.since))) continue;
      if (!best || gap < Math.abs(a.rating - best.rating)) best = b;
    }
    if (best) { paired.set(a.id, best.id); paired.set(best.id, a.id); }
  }
  return paired;
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** The room code two matched players meet in: the same on both machines. */
export function matchCode(a: string, b: string): string {
  const s = a < b ? `${a}|${b}` : `${b}|${a}`;
  let h = 0x811c9dc5, out = '';
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  for (let i = 0; i < CODE_LEN; i++) { out += CODE_CHARS[(h >>> 0) % CODE_CHARS.length]; h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); }
  return out;
}

// ---------- the lobby the queue lives in ----------
interface Lobby {
  /** Set or clear this page's queue entry. */
  set(e: QueueEntry | null): void;
  /** Everyone else's current entries. */
  others(): QueueEntry[];
  close(): void;
}

const isEntry = (x: unknown): x is QueueEntry => {
  const e = x as QueueEntry;
  return !!e && typeof e === 'object' && typeof e.id === 'string' && typeof e.rating === 'number' && typeof e.since === 'number' && typeof e.v === 'number';
};

interface RoomPeer { sameTab: boolean; presence: Record<string, unknown> }
interface Room {
  presence(patch: Record<string, unknown>): Promise<void>;
  peers(): readonly RoomPeer[];
}

class RoomLobby implements Lobby {
  constructor(private room: Room) {}
  set(e: QueueEntry | null): void { this.room.presence({ rq: e }).catch(() => { /* the next tick sends it again */ }); }
  others(): QueueEntry[] {
    return this.room.peers().filter(p => !p.sameTab && isEntry(p.presence.rq)).map(p => p.presence.rq as QueueEntry);
  }
  close(): void { this.set(null); }
}

class LocalLobby implements Lobby {
  private ch = new BroadcastChannel('svs-ranked-queue');
  private seen = new Map<string, { e: QueueEntry; at: number }>();
  private mine: QueueEntry | null = null;
  constructor() {
    this.ch.onmessage = ev => {
      const m = ev.data as { e: unknown; gone?: string };
      if (m.gone) this.seen.delete(m.gone);
      if (isEntry(m.e)) this.seen.set(m.e.id, { e: m.e, at: Date.now() });
    };
  }
  set(e: QueueEntry | null): void {
    if (!e && this.mine) this.ch.postMessage({ e: null, gone: this.mine.id });
    this.mine = e;
    if (e) this.ch.postMessage({ e });
  }
  others(): QueueEntry[] {
    const now = Date.now();
    return [...this.seen.values()].filter(x => now - x.at < STALE_MS && x.e.id !== this.mine?.id).map(x => x.e);
  }
  close(): void { this.set(null); this.ch.close(); }
}

async function openLobby(): Promise<Lobby | null> {
  if (new URLSearchParams(location.search).get('net') === 'local') return new LocalLobby();
  const claude = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
  if (!claude?.use) return null;
  const room = await claude.use('room').then(r => r as Room | null, () => null);
  return room ? new RoomLobby(room) : null;
}

/** A search in progress. Call `tick` every frame or so; `match` is set once paired. */
export class Search {
  readonly me: QueueEntry;
  match: Match | null = null;
  /** Other searchers on a matching build, last tick. */
  searching = 0;
  private lastSend = 0;
  private wantSince = 0;

  private constructor(private lobby: Lobby, rating: number) {
    this.me = { v: PROTOCOL, id: Math.random().toString(36).slice(2, 10), rating, since: Date.now(), want: null };
    lobby.set(this.me);
  }

  /** Start searching; null where there is no lobby to search in (hosted builds). */
  static async start(rating: number): Promise<Search | null> {
    const lobby = await openLobby();
    return lobby ? new Search(lobby, rating) : null;
  }

  get waited(): number { return Date.now() - this.me.since; }

  tick(): void {
    if (this.match) return;
    const now = Date.now();
    const others = this.lobby.others().filter(e => e.v === PROTOCOL);
    this.searching = others.length;
    const want = pairUp([this.me, ...others], now).get(this.me.id) ?? null;
    // keep pointing at someone for a moment even if a view flickers, so two players can meet
    const keep = this.me.want && others.some(e => e.id === this.me.want) && now - this.wantSince < 3000;
    const next = keep ? this.me.want : want;
    // presence keeps the latest value; the local lobby needs a heartbeat
    if (next !== this.me.want || now - this.lastSend > 1000) {
      if (next !== this.me.want) { this.me.want = next; this.wantSince = now; }
      this.lastSend = now;
      this.lobby.set({ ...this.me });
    }
    const rival = others.find(e => e.id === this.me.want);
    if (rival && rival.want === this.me.id) {
      this.match = { code: matchCode(this.me.id, rival.id), role: this.me.id < rival.id ? 'host' : 'guest', rival };
      // stay pointed at them a little longer, in case they have not seen us point back yet
      window.setTimeout(() => this.lobby.close(), 4000);
    }
  }

  cancel(): void { this.lobby.close(); }
}
