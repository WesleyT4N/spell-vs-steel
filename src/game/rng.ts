// Seeded random numbers. Online play runs the same battle on both machines, so every roll in the
// rules has to come from the battle's own generator instead of Math.random.
export type Rng = () => number;

/** mulberry32: tiny, fast, good enough for card draws and random panels. Returns [0, 1). */
export function seeded(seed: number): Rng & { state: () => number; setState: (v: number) => void } {
  let s = seed >>> 0;
  const next = (() => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }) as Rng & { state: () => number; setState: (v: number) => void };
  next.state = () => s;
  /** Rewind the generator (rollback netcode restores it with the rest of the battle). */
  next.setState = v => { s = v >>> 0; };
  return next;
}

export const randomSeed = (): number => Math.floor(Math.random() * 4294967296);

/** Fisher-Yates on a copy. Pass the battle's generator for anything the rules depend on. */
export function shuffle<T>(a: T[], rand: Rng = Math.random): T[] {
  const o = a.slice();
  for (let i = o.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [o[i], o[j]] = [o[j], o[i]];
  }
  return o;
}
