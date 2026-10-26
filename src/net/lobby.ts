// The online lobby: who is on the page right now, a chat, and challenges. It lives in presence (see
// presence.ts), so there is nothing to host: each player's entry carries their fighter, rating, their
// last few chat lines, and any challenge they have sent or answered. Chat lines are merged into one log
// by everyone who sees them; a newcomer gets each player's last few lines.
//
// A challenge: A points `ch` at B; B accepts by pointing `acc` at A (or turns it down with `dec`). Once
// each sees the other pointing back, they meet on a room code made from both ids; the challenger hosts.
import type { ClassId } from '../art/sprites';
import { PROTOCOL } from './protocol';
import { openPresence, type PresenceField } from './presence';
import { matchCode, isQueueEntry, type QueueEntry } from './matchmaking';
import { SKINS } from '../art/sprites';

export const CHAT_MAX = 60;
/** Lines each player keeps in their presence for newcomers. */
const KEEP_LINES = 6;
/** Lines the log keeps. */
const LOG_LINES = 50;

export interface LobbyEntry {
  v: number;
  /** Random id for this page load. */
  id: string;
  cls: ClassId;
  skin: string;
  rating: number;
  bestOf: 1 | 3 | 5;
  /** Recent chat: [line number, text]. */
  chat: Array<[number, string]>;
  /** Challenge sent: who to, and a number so a new challenge differs from an old one. */
  ch: { to: string; n: number } | null;
  /** Challenge accepted (the challenger's id) or turned down. */
  acc: string | null;
  dec: string | null;
}

export interface Here { e: LobbyEntry; name: string; by: string | null }
export interface ChatLine { from: string; name: string; text: string; mine: boolean; at: number }
export interface Meet { code: string; role: 'host' | 'guest'; rival: Here }

const isEntry = (x: unknown): x is LobbyEntry => {
  const e = x as LobbyEntry;
  return !!e && typeof e === 'object' && typeof e.id === 'string' && typeof e.v === 'number' && typeof e.rating === 'number'
    && typeof e.cls === 'string' && e.cls in SKINS && Array.isArray(e.chat);
};

interface User { me(): Promise<{ id: string | null; name?: string }>; profiles(ids: string[]): Promise<Record<string, { name: string }>> }
const useUser = (): Promise<User | null> => {
  const claude = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
  if (!claude?.use) return Promise.resolve(null);
  return claude.use('user').then(u => (u as User | null) ?? null, () => null);
};

/** One id per page load, so leaving and coming back to the lobby keeps the same seat. */
const MY_ID = Math.random().toString(36).slice(2, 10);

export class Lobby {
  me: LobbyEntry;
  myName = 'YOU';
  here: Here[] = [];
  /** Players searching the ranked queue right now. */
  searching = 0;
  log: ChatLine[] = [];
  /** Challenges sent to us that are still standing. */
  incoming: Here[] = [];
  /** How our outgoing challenge ended, for a message. */
  answer: 'declined' | 'gone' | null = null;
  meet: Meet | null = null;

  private seenLines = new Set<string>();
  private lineNo = 0;
  private names = new Map<string, string>();
  private asked = new Set<string>();
  private lastSet = 0;

  private constructor(private field: PresenceField<LobbyEntry>, private queue: PresenceField<QueueEntry> | null, private user: User | null, entry: Omit<LobbyEntry, 'v' | 'id' | 'chat' | 'ch' | 'acc' | 'dec'>) {
    this.me = { v: PROTOCOL, id: MY_ID, chat: [], ch: null, acc: null, dec: null, ...entry };
    this.push();
    void user?.me().then(m => { if (m.name) this.myName = m.name.toUpperCase(); });
  }

  /** Join the lobby; null where there is no room to share (hosted builds). */
  static async join(entry: Omit<LobbyEntry, 'v' | 'id' | 'chat' | 'ch' | 'acc' | 'dec'>): Promise<Lobby | null> {
    const field = await openPresence('lb', isEntry);
    if (!field) return null;
    const [queue, user] = await Promise.all([openPresence('rq', isQueueEntry), useUser()]);
    return new Lobby(field, queue, user, entry);
  }

  private push(): void { this.lastSet = Date.now(); this.field.set({ ...this.me, chat: this.me.chat.slice() }); }

  private nameOf(e: LobbyEntry, by: string | null): string {
    if (by) {
      const n = this.names.get(by);
      if (n) return n;
      if (!this.asked.has(by) && this.user) {
        this.asked.add(by);
        void this.user.profiles([by]).then(p => { const nm = p[by]?.name; if (nm) this.names.set(by, nm.toUpperCase().slice(0, 14)); }, () => {});
      }
    }
    return `PLAYER ${e.id.slice(0, 4).toUpperCase()}`;
  }

  say(text: string): void {
    const t = text.trim().slice(0, CHAT_MAX);
    if (!t) return;
    const n = Math.max(Date.now(), this.lineNo + 1); // unique across visits, so others never mistake it for an old line
    this.lineNo = n;
    this.me.chat = [...this.me.chat, [n, t] as [number, string]].slice(-KEEP_LINES);
    this.addLine(this.me.id, this.myName, n, t, true);
    this.push();
  }

  private addLine(from: string, name: string, n: number, text: string, mine: boolean): void {
    const key = `${from}:${n}`;
    if (this.seenLines.has(key)) return;
    this.seenLines.add(key);
    this.log.push({ from, name, text, mine, at: Date.now() });
    if (this.log.length > LOG_LINES) this.log.splice(0, this.log.length - LOG_LINES);
  }

  challenge(to: string): void {
    this.me.ch = { to, n: Date.now() };
    this.answer = null;
    this.push();
  }
  cancelChallenge(): void { this.me.ch = null; this.push(); }
  accept(from: string): void { this.me.acc = from; this.me.dec = null; this.push(); }
  decline(from: string): void { this.me.dec = from; this.push(); }

  /** Call every frame: reads everyone, merges chat, and settles challenges. */
  tick(): void {
    if (this.meet) return;
    const now = Date.now();
    this.here = this.field.others().filter(o => o.v.v === PROTOCOL && o.v.id !== this.me.id).map(o => ({ e: o.v, by: o.by, name: this.nameOf(o.v, o.by) }));
    this.searching = this.queue?.others().length ?? 0;
    for (const h of this.here) for (const [n, text] of h.e.chat) if (typeof n === 'number' && typeof text === 'string') this.addLine(h.e.id, h.name, n, text.slice(0, CHAT_MAX), false);
    this.incoming = this.here.filter(h => h.e.ch?.to === this.me.id && this.me.dec !== h.e.id);

    // our challenge
    const ch = this.me.ch;
    if (ch) {
      const them = this.here.find(h => h.e.id === ch.to);
      if (!them) { this.me.ch = null; this.answer = 'gone'; this.push(); }
      else if (them.e.dec === this.me.id) { this.me.ch = null; this.answer = 'declined'; this.push(); }
      else if (them.e.acc === this.me.id) this.meet = { code: matchCode(`lb${this.me.id}`, `lb${them.e.id}`), role: 'host', rival: them };
    }
    // a challenge we accepted
    if (!this.meet && this.me.acc) {
      const them = this.here.find(h => h.e.id === this.me.acc);
      if (!them || them.e.ch?.to !== this.me.id) { this.me.acc = null; this.push(); }
      else this.meet = { code: matchCode(`lb${them.e.id}`, `lb${this.me.id}`), role: 'guest', rival: them };
    }
    if (now - this.lastSet > 1000) this.push();
  }

  /** Leave the lobby. After a meet, stay visible a few seconds so the rival sees us accept. */
  leave(): void {
    if (this.meet) window.setTimeout(() => { this.field.close(); this.queue?.close(); }, 4000);
    else { this.field.close(); this.queue?.close(); }
  }
}
