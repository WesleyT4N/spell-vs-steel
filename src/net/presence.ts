// Shared "who is here right now" for the lobby and the ranked queue, without a server of our own: one
// field of this page's presence in the claude.ai artifact's main room, which everyone viewing the page
// shares. Each feature keeps its own field (`rq` for the queue, `lb` for the lobby), so they never
// step on each other or on the room transport's packets.
//
// ?net=local carries the same fields between tabs on a BroadcastChannel, for testing.

/** Someone else's value for the field. `by` is their account id when the page knows it. */
export interface Seen<T> { v: T; by: string | null }

export interface PresenceField<T> {
  /** Set or clear this page's value. */
  set(v: T | null): void;
  /** Everyone else's current values. */
  others(): Array<Seen<T>>;
  close(): void;
}

/** Not heard from for this long: gone (local tabs only; the room tracks this itself). */
const STALE_MS = 4000;

interface RoomPeer { sameTab: boolean; by?: string | null; presence: Record<string, unknown> }
interface Room {
  presence(patch: Record<string, unknown>): Promise<void>;
  peers(): readonly RoomPeer[];
}

class RoomField<T> implements PresenceField<T> {
  constructor(private room: Room, private key: string, private valid: (x: unknown) => x is T) {}
  set(v: T | null): void { this.room.presence({ [this.key]: v }).catch(() => { /* the next set repeats it */ }); }
  others(): Array<Seen<T>> {
    const out: Array<Seen<T>> = [];
    for (const p of this.room.peers()) {
      const v = p.presence[this.key];
      if (!p.sameTab && this.valid(v)) out.push({ v, by: p.by ?? null });
    }
    return out;
  }
  close(): void { this.set(null); }
}

class LocalField<T> implements PresenceField<T> {
  private ch: BroadcastChannel;
  private me = Math.random().toString(36).slice(2);
  private seen = new Map<string, { v: T; at: number }>();
  private mine: T | null = null;
  private beat: number;
  constructor(key: string, private valid: (x: unknown) => x is T) {
    this.ch = new BroadcastChannel(`svs-presence-${key}`);
    this.ch.onmessage = ev => {
      const m = ev.data as { from: string; v: unknown };
      if (!m || m.from === this.me) return;
      if (this.valid(m.v)) this.seen.set(m.from, { v: m.v, at: Date.now() });
      else this.seen.delete(m.from);
    };
    // presence is kept up to date for newcomers: say it again every second
    this.beat = window.setInterval(() => { if (this.mine) this.post(); }, 1000);
  }
  private post(): void { this.ch.postMessage({ from: this.me, v: this.mine }); }
  set(v: T | null): void { this.mine = v; this.post(); }
  others(): Array<Seen<T>> {
    const now = Date.now();
    return [...this.seen.values()].filter(x => now - x.at < STALE_MS).map(x => ({ v: x.v, by: null }));
  }
  close(): void { this.set(null); window.clearInterval(this.beat); this.ch.close(); }
}

let roomP: Promise<Room | null> | null = null;
function mainRoom(): Promise<Room | null> {
  const claude = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
  if (!claude?.use) return Promise.resolve(null);
  return (roomP ??= claude.use('room').then(r => (r as Room | null) ?? null, () => null));
}

/** One presence field shared with everyone on the page; null where there is no room (hosted builds). */
export async function openPresence<T>(key: string, valid: (x: unknown) => x is T): Promise<PresenceField<T> | null> {
  if (new URLSearchParams(location.search).get('net') === 'local') return new LocalField(key, valid);
  const room = await mainRoom();
  return room ? new RoomField(room, key, valid) : null;
}
