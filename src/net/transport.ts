// How packets get between the two machines. Three ways, same interface:
//  - room:  claude.ai artifact "room" capability (presence in a named room). Works inside the
//           published artifact with no server of our own.
//  - peer:  WebRTC data channel through PeerJS. Signaling uses the free public PeerJS server unless
//           ?peer=host:port points at your own; for a hosted build (GitHub Pages, local dev).
//  - local: BroadcastChannel between tabs of one browser, with optional fake lag and loss, for testing.
import Peer, { type DataConnection, type PeerOptions } from 'peerjs';
import { isPacket, type Packet } from './protocol';

export type TransportKind = 'room' | 'peer' | 'local';

export interface Transport {
  readonly kind: TransportKind;
  send(p: Packet): void;
  onPacket(cb: (p: Packet) => void): void;
  /** The link died for good (the other side may still show up again on a new one). */
  onClose(cb: (reason: string) => void): void;
  /** The other side has gone quiet mid-match: rebuild the link if it can be (called every few seconds). */
  revive?(): void;
  close(): void;
}

const params = new URLSearchParams(location.search);
const num = (k: string, d: number): number => { const v = Number(params.get(k)); return Number.isFinite(v) && params.has(k) ? v : d; };

/** Which transport to use: ?net= wins, else the claude.ai room when it is there, else PeerJS. */
export async function pickTransport(): Promise<TransportKind> {
  const forced = params.get('net');
  if (forced === 'local' || forced === 'peer' || forced === 'room') return forced;
  return (await getRoom()) ? 'room' : 'peer';
}

export function openTransport(kind: TransportKind, role: 'host' | 'guest', code: string): Promise<Transport> {
  if (kind === 'local') return Promise.resolve(new LocalTransport(code));
  if (kind === 'room') return openRoom(code);
  return openPeer(role, code);
}

class Base {
  protected packetCbs: Array<(p: Packet) => void> = [];
  protected closeCbs: Array<(r: string) => void> = [];
  closed = false;
  onPacket(cb: (p: Packet) => void): void { this.packetCbs.push(cb); }
  onClose(cb: (r: string) => void): void { this.closeCbs.push(cb); }
  protected deliver(x: unknown): void { if (!this.closed && isPacket(x)) for (const cb of this.packetCbs) cb(x); }
  protected die(reason: string): void {
    if (this.closed) return;
    this.closed = true;
    for (const cb of this.closeCbs) cb(reason);
  }
}

// ---------- local (two tabs) ----------
class LocalTransport extends Base implements Transport {
  readonly kind = 'local';
  private ch: BroadcastChannel;
  private me = Math.random().toString(36).slice(2);
  // ?lag=ms&jitter=ms&drop=0..1 fake a bad connection
  private lag = num('lag', 0);
  private jitter = num('jitter', 0);
  private drop = num('drop', 0);
  constructor(code: string) {
    super();
    this.ch = new BroadcastChannel(`svs-${code}`);
    this.ch.onmessage = e => {
      const m = e.data as { from: string; p: unknown };
      if (!m || m.from === this.me) return;
      if (Math.random() < this.drop) return;
      const delay = this.lag + Math.random() * this.jitter;
      if (delay <= 0) this.deliver(m.p); else setTimeout(() => this.deliver(m.p), delay);
    };
  }
  send(p: Packet): void { if (!this.closed) this.ch.postMessage({ from: this.me, p }); }
  close(): void { this.closed = true; this.ch.close(); }
}

// ---------- PeerJS (WebRTC) ----------
function peerOptions(): PeerOptions {
  // ?peer=localhost:9000 uses your own PeerJS server (npx peerjs --port 9000) instead of the public one
  const custom = params.get('peer');
  if (!custom) return { debug: 0 };
  const [host, port, path] = custom.split(':');
  return { host, port: Number(port) || 443, path: path ? `/${path}` : '/', secure: location.protocol === 'https:' && host !== 'localhost', debug: 0 };
}

class PeerTransport extends Base implements Transport {
  readonly kind = 'peer';
  conn: DataConnection | null = null;
  /** `hostId`: the guest's way back to the host when the data channel drops. */
  constructor(private peer: Peer, private hostId?: string) {
    super();
    // lost the signaling server (needed to dial or be dialed again): get back on it with the same id
    peer.on('disconnected', () => { if (!this.closed) setTimeout(() => this.rejoinServer(), 1000); });
  }
  attach(c: DataConnection): void {
    if (this.conn && this.conn !== c) this.conn.close();
    this.conn = c;
    c.on('data', d => { if (this.conn === c) this.deliver(d); });
    c.on('close', () => {
      if (this.conn !== c) return;
      this.conn = null;
      // the guest dials back; the host keeps listening for it
      if (!this.closed && this.hostId) setTimeout(() => this.dial(), 500);
    });
    c.on('error', () => { /* the close handler or revive() takes it from here */ });
  }
  private rejoinServer(): void {
    if (this.closed || this.peer.destroyed || !this.peer.disconnected) return;
    try { this.peer.reconnect(); } catch { /* next revive() tries again */ }
  }
  private dial(): void {
    if (this.closed || !this.hostId || this.peer.destroyed) return;
    if (this.peer.disconnected) { this.rejoinServer(); return; }
    if (this.conn?.open) return;
    this.attach(this.peer.connect(this.hostId, { reliable: false, serialization: 'json' }));
  }
  revive(): void {
    if (this.closed) return;
    this.rejoinServer();
    // a channel can sit "open" over a dead route for a long while: the guest drops it and dials again
    if (this.hostId) { const c = this.conn; this.conn = null; c?.close(); this.dial(); }
  }
  send(p: Packet): void { if (this.conn?.open) try { this.conn.send(p); } catch { /* dropped; the next packet repeats it */ } }
  close(): void { this.closed = true; this.conn?.close(); this.peer.destroy(); }
  fail(reason: string): void { this.die(reason); }
}

function peerError(e: { type?: string; message?: string }): string {
  switch (e.type) {
    case 'unavailable-id': return 'ROOM CODE TAKEN, TRY AGAIN';
    case 'peer-unavailable': return 'NO ROOM WITH THAT CODE';
    case 'network': case 'server-error': case 'socket-error': case 'socket-closed': return 'CANNOT REACH THE MATCH SERVER';
    case 'browser-incompatible': return 'THIS BROWSER CANNOT PLAY ONLINE';
    default: return 'CONNECTION FAILED';
  }
}

function openPeer(role: 'host' | 'guest', code: string): Promise<Transport> {
  return new Promise((resolve, reject) => {
    const id = `spell-vs-steel-${code}`;
    const peer = role === 'host' ? new Peer(id, peerOptions()) : new Peer(peerOptions());
    const t = new PeerTransport(peer, role === 'guest' ? id : undefined);
    let settled = false;
    const done = (err?: string): void => {
      // once playing, errors (server hiccups, a redial that missed) are left to reconnecting; only silence ends a match
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) { peer.destroy(); reject(new Error(err)); } else resolve(t);
    };
    const timer = setTimeout(() => done(role === 'host' ? 'CANNOT REACH THE MATCH SERVER' : 'NO ANSWER FROM THAT ROOM'), 15000);
    peer.on('error', e => done(peerError(e)));
    if (role === 'host') {
      peer.on('open', () => done());
      peer.on('connection', c => t.attach(c));
    } else {
      peer.on('open', () => {
        const c = peer.connect(id, { reliable: false, serialization: 'json' });
        t.attach(c);
        c.on('open', () => done());
      });
    }
  });
}

// ---------- claude.ai room ----------
// Typed loosely on purpose: this is the artifact runtime's API (see the room capability docs).
interface RoomPeer { sameTab: boolean; presence: Record<string, unknown> }
interface RoomChange { joined: readonly RoomPeer[]; updated: readonly RoomPeer[] }
interface NamedRoom {
  presence(patch: Record<string, unknown>): Promise<void>;
  onPeers(fn: (c: RoomChange) => void, onError?: (e: { code: string }) => void): () => void;
  leave(): Promise<void>;
}
interface Room extends NamedRoom { join(name: string): Promise<NamedRoom> }

let roomP: Promise<Room | null> | null = null;
function getRoom(): Promise<Room | null> {
  const claude = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
  if (!claude?.use) return Promise.resolve(null);
  return (roomP ??= claude.use('room').then(r => (r as Room | null) ?? null, () => null));
}

/** Packets ride in our presence as { c: room code, p: packet }; the code filters out other games in a shared room. */
class RoomTransport extends Base implements Transport {
  readonly kind = 'room';
  private unsub: (() => void) | null = null;
  private rejoining = false;
  constructor(private r: NamedRoom, private code: string, private named: boolean, private main: Room) {
    super();
    this.listen();
  }
  private listen(): void {
    try { this.unsub?.(); } catch { /* already gone */ }
    this.unsub = this.r.onPeers(c => {
      for (const p of [...c.joined, ...c.updated]) if (!p.sameTab && p.presence.c === this.code && p.presence.p) this.deliver(p.presence.p);
    }, () => { this.unsub = null; /* a mid-match room error: revive() rejoins; only silence ends the match */ });
  }
  /** Rejoin the room (and listen again) after an error or a long silence. */
  revive(): void {
    if (this.closed || this.rejoining) return;
    this.rejoining = true;
    const back = this.named ? this.main.join(roomName(this.code)) : Promise.resolve(this.r);
    back.then(r => {
      if (this.closed) { if (this.named) r.leave().catch(() => {}); return; }
      if (r !== this.r && this.named) this.r.leave().catch(() => {});
      this.r = r;
      this.listen();
    }, () => { /* try again on the next revive() */ }).finally(() => { this.rejoining = false; });
  }
  send(p: Packet): void { if (!this.closed) this.r.presence({ c: this.code, p }).catch(() => { /* dropped; the next packet repeats it */ }); }
  close(): void {
    this.closed = true;
    try { this.unsub?.(); } catch { /* already gone */ }
    this.r.presence({ c: null, p: null }).catch(() => {});
    if (this.named) this.r.leave().catch(() => {});
  }
}

const roomName = (code: string): string => `svs-${code.toLowerCase()}`;

async function openRoom(code: string): Promise<Transport> {
  const room = await getRoom();
  if (!room) throw new Error('ONLINE ROOMS ARE NOT AVAILABLE HERE');
  // a named room per code; where named rooms are refused, share the page's main room instead
  try { return new RoomTransport(await room.join(roomName(code)), code, true, room); }
  catch { return new RoomTransport(room, code, false, room); }
}
