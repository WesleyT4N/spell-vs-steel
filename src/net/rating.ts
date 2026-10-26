// Ranked ratings: Elo, kept in the claude.ai artifact's database so everyone who plays the published
// page shares one ladder. Each player writes only their own rating (an access rule enforces it), and
// works out the change themselves from both ratings at the start of the set: the two machines play the
// same deterministic set, so they agree on who won.
//
// Where the database is missing (a hosted build, local tests) ratings stay in this browser.
import type { Side } from '../game/battle';

export const START_RATING = 1000;
/** Bigger swings while a player's rating is still settling. */
const K_NEW = 40, K = 24, SETTLED_AFTER = 10;

export interface Rating { rating: number; games: number; wins: number; losses: number }
export interface LadderRow extends Rating { id: string; name: string; you: boolean }

export const blankRating = (): Rating => ({ rating: START_RATING, games: 0, wins: 0, losses: 0 });

/** Chance that `a` beats `b`. */
export const expected = (a: number, b: number): number => 1 / (1 + 10 ** ((b - a) / 400));

/** Rating change for a player rated `me` who just won or lost a set against `them`. */
export function eloDelta(me: Rating, them: number, won: boolean): number {
  const k = me.games < SETTLED_AFTER ? K_NEW : K;
  return Math.round(k * ((won ? 1 : 0) - expected(me.rating, them)));
}

export function applyResult(me: Rating, them: number, won: boolean): Rating {
  const d = eloDelta(me, them, won);
  return { rating: Math.max(100, me.rating + d), games: me.games + 1, wins: me.wins + (won ? 1 : 0), losses: me.losses + (won ? 0 : 1) };
}

// ---------- where ratings live ----------
interface DocSnap { id: string; exists: boolean; data(): Record<string, unknown> | undefined }
interface DocRef { get(): Promise<DocSnap>; set(d: Record<string, unknown>): Promise<void> }
interface Query { orderBy(f: string, dir?: 'asc' | 'desc'): Query; limit(n: number): Query; get(): Promise<{ docs: DocSnap[] }> }
interface Db { doc(path: string): DocRef; collection(path: string): Query }
interface User { id(): Promise<string | null>; profiles(ids: string[]): Promise<Record<string, { name: string }>> }

type ClaudeUse = { use?: (n: string) => Promise<unknown> };
const use = <T>(name: string): Promise<T | null> => {
  const claude = (window as unknown as { claude?: ClaudeUse }).claude;
  if (!claude?.use) return Promise.resolve(null);
  return claude.use(name).then(x => (x as T | null) ?? null, () => null);
};

const toRating = (d: Record<string, unknown> | undefined): Rating => {
  const n = (v: unknown, def: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : def);
  return d ? { rating: n(d.rating, START_RATING), games: n(d.games, 0), wins: n(d.wins, 0), losses: n(d.losses, 0) } : blankRating();
};

export interface RatingStore {
  /** 'shared': one ladder for everyone on the page; 'local': this browser only. */
  readonly kind: 'shared' | 'local';
  mine(): Promise<Rating>;
  save(r: Rating): Promise<void>;
  ladder(n: number): Promise<LadderRow[]>;
}

class DbStore implements RatingStore {
  readonly kind = 'shared';
  constructor(private db: Db, private user: User, private uid: string) {}
  async mine(): Promise<Rating> { return toRating((await this.db.doc(`ratings/${this.uid}`).get()).data()); }
  async save(r: Rating): Promise<void> { await this.db.doc(`ratings/${this.uid}`).set({ ...r, at: Date.now() }); }
  async ladder(n: number): Promise<LadderRow[]> {
    const snap = await this.db.collection('ratings').orderBy('rating', 'desc').limit(n).get();
    const ids = snap.docs.map(d => d.id);
    const names = ids.length ? await this.user.profiles(ids).catch(() => ({} as Record<string, { name: string }>)) : {};
    return snap.docs.map(d => ({ ...toRating(d.data()), id: d.id, name: names[d.id]?.name || 'SOMEONE', you: d.id === this.uid }));
  }
}

const LOCAL_KEY = 'svs:rating';
class LocalStore implements RatingStore {
  readonly kind = 'local';
  async mine(): Promise<Rating> {
    try { return toRating(JSON.parse(localStorage.getItem(LOCAL_KEY) ?? 'null') ?? undefined); } catch { return blankRating(); }
  }
  async save(r: Rating): Promise<void> { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(r)); } catch { /* storage blocked */ } }
  async ladder(): Promise<LadderRow[]> { return [{ ...(await this.mine()), id: 'me', name: 'YOU', you: true }]; }
}

let storeP: Promise<RatingStore> | null = null;
/** The shared ladder when the page has the database and knows who you are, else this browser's. */
export function ratingStore(): Promise<RatingStore> {
  return (storeP ??= (async () => {
    if (new URLSearchParams(location.search).get('net') === 'local') return new LocalStore();
    const [db, user] = await Promise.all([use<Db>('db'), use<User>('user')]);
    const uid = user ? await user.id().catch(() => null) : null;
    return db && user && uid ? new DbStore(db, user, uid) : new LocalStore();
  })());
}

// ---------- leaving a ranked set early counts as a loss ----------
// A loss is written down when a ranked set starts and cleared when it is scored, so closing the page
// mid-set still costs the rating the next time ranked is opened.
const PENDING_KEY = 'svs:ranked-pending';
interface Pending { them: number; at: number }

export function armPending(them: number): void {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify({ them, at: Date.now() } satisfies Pending)); } catch { /* storage blocked */ }
}
export function clearPending(): void { try { localStorage.removeItem(PENDING_KEY); } catch { /* storage blocked */ } }

/** Score any ranked set this browser walked out of. Returns the rating after it. */
export async function settlePending(store: RatingStore): Promise<Rating> {
  let p: Pending | null = null;
  try { p = JSON.parse(localStorage.getItem(PENDING_KEY) ?? 'null') as Pending | null; } catch { /* none */ }
  const mine = await store.mine();
  if (!p || typeof p.them !== 'number') return mine;
  clearPending();
  const after = applyResult(mine, p.them, false);
  await store.save(after).catch(() => {});
  return after;
}

// ---------- the ranked set in progress ----------
/** What a ranked online match knows: both ratings going in, and the result once scored. */
export interface RankedSet {
  mine: Rating;
  them: number;
  /** Rating change once the set is scored (null until then). */
  delta: number | null;
  after?: Rating;
  /** The set that counts: the first one played. */
  setId?: string;
}

/** Ranked state per online session (absent: a friendly room match). */
const SETS = new WeakMap<object, RankedSet>();
export const rankedOf = (net: object): RankedSet | null => SETS.get(net) ?? null;

export function startRanked(net: object, mine: Rating, them: number): void {
  SETS.set(net, { mine, them, delta: null });
  armPending(them);
}

/** A round of the set `setId` ended with `score` (by side); scores the set once someone has won it. */
export async function rankedRound(net: object, side: Side, setId: string, score: [number, number], need: number): Promise<void> {
  const r = SETS.get(net);
  if (!r || r.delta !== null) return;
  r.setId ??= setId;
  if (r.setId !== setId || Math.max(...score) < need) return; // a rematch after the ranked set is a friendly
  const won = score[side] > score[1 - side];
  r.after = applyResult(r.mine, r.them, won);
  r.delta = r.after.rating - r.mine.rating;
  clearPending();
  await (await ratingStore()).save(r.after).catch(() => {});
}

/** The rival walked out before the set was decided: it goes down as a win. */
export async function rankedForfeit(net: object): Promise<void> {
  const r = SETS.get(net);
  if (!r || r.delta !== null) return;
  r.after = applyResult(r.mine, r.them, true);
  r.delta = r.after.rating - r.mine.rating;
  clearPending();
  await (await ratingStore()).save(r.after).catch(() => {});
}

/** One line for the results screen, e.g. "RATING 1016 (+16)". */
export function rankedNote(net: object, setId?: string): string {
  const r = SETS.get(net);
  if (!r || (r.setId && setId && r.setId !== setId)) return '';
  if (r.delta === null) return r.setId ? `RANKED SET   RATING ${r.mine.rating}` : 'RANKED SET';
  return `RATING ${r.after!.rating} (${r.delta >= 0 ? '+' : ''}${r.delta})`;
}
