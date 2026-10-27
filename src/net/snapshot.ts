// Save and restore a whole battle, for rollback netcode: when the other player's real input turns
// out different from the guess, the battle goes back to the last frame both inputs were known and
// runs forward again.
//
// The battle keeps closures in its state (scheduled timers, animations, projectile hit handlers),
// and those closures hold on to the battle's own objects: fighters, pets, walls. A plain deep copy
// would leave them pointing at the old objects. So a snapshot records every object reachable from
// the battle together with its field values, and restoring writes those values back into the very
// same objects. Every reference, inside a closure or not, stays valid, and objects created after
// the snapshot simply drop out of the restored graph. Functions are kept as values, not walked.
//
// The one piece of hidden state, the seeded generator's counter, is saved explicitly.
// `npm run rollcheck` proves that rolling back and resimulating gives the same battle as never
// rolling back at all.
import type { Battle } from '../game/battle';

type Rec =
  | { o: unknown[]; a: unknown[] }
  | { o: Map<unknown, unknown>; m: Array<[unknown, unknown]> }
  | { o: Record<string, unknown>; k: string[]; v: unknown[] };

export interface Snapshot { recs: Rec[]; rng: number }

/** Record `roots` and everything they reach. */
export function snapshotGraph(roots: object[]): Rec[] {
  const seen = new Set<object>();
  const recs: Rec[] = [];
  const stack: object[] = [];
  const visit = (x: unknown): void => {
    if (x === null || typeof x !== 'object' || seen.has(x)) return;
    // immutable data (card definitions and the like) needs no saving
    if (Object.isFrozen(x) || x instanceof WeakMap || x instanceof WeakSet) return;
    seen.add(x);
    stack.push(x);
  };
  for (const r of roots) visit(r);
  while (stack.length) {
    const o = stack.pop()!;
    if (Array.isArray(o)) {
      const a = o.slice();
      for (const v of a) visit(v);
      recs.push({ o, a });
    } else if (o instanceof Map) {
      const m = [...o.entries()];
      for (const [k, v] of m) { visit(k); visit(v); }
      recs.push({ o, m });
    } else {
      const obj = o as Record<string, unknown>;
      const k = Object.keys(obj);
      const v = new Array<unknown>(k.length);
      for (let i = 0; i < k.length; i++) { v[i] = obj[k[i]]; visit(v[i]); }
      recs.push({ o: obj, k, v });
    }
  }
  return recs;
}

/** Put every recorded object back the way it was. */
export function restoreGraph(recs: Rec[]): void {
  for (const r of recs) {
    if ('a' in r) {
      r.o.length = r.a.length;
      for (let i = 0; i < r.a.length; i++) r.o[i] = r.a[i];
    } else if ('m' in r) {
      r.o.clear();
      for (const [k, v] of r.m) r.o.set(k, v);
    } else {
      const o = r.o;
      // fields added since the snapshot go (rare: the battle's objects keep one shape)
      const ks = Object.keys(o);
      if (ks.length !== r.k.length) for (const key of ks) if (!r.k.includes(key)) delete o[key];
      for (let i = 0; i < r.k.length; i++) o[r.k[i]] = r.v[i];
    }
  }
}

/** Save battle `b` (and any `extra` objects that watch it, such as post-match stats). */
export function saveBattle(b: Battle, extra: object[] = []): Snapshot {
  return { recs: snapshotGraph([b, ...extra]), rng: b.rand.state() };
}

export function loadBattle(b: Battle, s: Snapshot): void {
  restoreGraph(s.recs);
  b.rand.setState(s.rng);
}
