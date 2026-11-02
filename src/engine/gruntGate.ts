// Attack grunts are flavor, not feedback: each fighter grunts at most once every GRUNT_GAP ms, so a run of heavy
// attacks gets one grunt instead of a chant. Listener side only; the battle sim never sees this.

export const GRUNT_GAP = 2500;

/** One gate per pair of fighters (side 0 and 1). `allow` says if this fighter may grunt now, and if so starts its wait. */
export function gruntGate(gap = GRUNT_GAP): { allow(side: 0 | 1, now: number): boolean; reset(): void } {
  const last = [-Infinity, -Infinity];
  return {
    allow(side, now) {
      if (now < last[side]) last[side] = -Infinity; // the clock went back (a new battle's clock): start fresh
      if (now - last[side] < gap) return false;
      last[side] = now;
      return true;
    },
    reset() { last[0] = last[1] = -Infinity; },
  };
}
