// True combos: a run of hits where every hit after the first lands while the target can't act.
// "Can't act" means frozen, stunned, asleep, or in hitstun (the flinch after a hit of flinchThreshold (200)+ damage).
// Knockback only counts through the flinch that comes with it; roots, silences and slows don't count,
// since a rooted or silenced fighter can still fight back.
// Display only: the battle reports its hits here, and nothing in the rules reads it back,
// so it never touches the online checksum.
import type { Battle, Fighter, Side } from './battle';

/** Seconds a finished combo stays on screen. */
export const COMBO_HOLD = 1.6;

export function cantAct(f: Fighter): boolean {
  return f.st.frozen > 0 || f.st.stunned > 0 || f.st.sleep > 0 || f.st.flinch > 0;
}

export interface ComboRun { hits: number; dmg: number }

export class ComboTracker {
  /** The run each side is landing right now (index = attacker). */
  cur: [ComboRun, ComboRun] = [{ hits: 0, dmg: 0 }, { hits: 0, dmg: 0 }];
  /** The last true combo each side finished, and how long ago. */
  last: [ComboRun & { ago: number } | null, ComboRun & { ago: number } | null] = [null, null];
  /** Best true combo per side (by damage, ties by hits), and how many each side landed: for post-match stats. */
  best: [ComboRun, ComboRun] = [{ hits: 0, dmg: 0 }, { hits: 0, dmg: 0 }];
  count: [number, number] = [0, 0];

  /** A hit for `amt` landed on `target`; `locked` is whether the target couldn't act as it landed. */
  hit(target: Fighter, amt: number, dot: boolean, locked: boolean): void {
    const a = (1 - target.side) as Side, run = this.cur[a];
    // damage over time adds to a running combo but is never a hit of its own
    if (dot) { if (run.hits > 0 && locked) run.dmg += amt; return; }
    if (run.hits > 0 && locked) { run.hits++; run.dmg += amt; return; }
    // the target could act, or there was no combo: this hit starts a new one
    this.end(a);
    this.cur[a] = { hits: 1, dmg: amt };
  }

  /** Once per frame: a combo ends the moment its target can act again. */
  update(b: Battle, dt: number): void {
    for (const a of [0, 1] as Side[]) {
      const l = this.last[a];
      if (l && (l.ago += dt) > COMBO_HOLD) this.last[a] = null;
      if (this.cur[a].hits > 0 && !cantAct(b.f[1 - a])) this.end(a);
    }
  }

  /** What to show for side `a`: the live combo once it is 2+ hits, else the one that just ended. */
  shown(a: Side): (ComboRun & { live: boolean; ago: number }) | null {
    const run = this.cur[a];
    if (run.hits >= 2) return { ...run, live: true, ago: 0 };
    const l = this.last[a];
    return l ? { ...l, live: false } : null;
  }

  reset(): void {
    this.cur = [{ hits: 0, dmg: 0 }, { hits: 0, dmg: 0 }];
    this.last = [null, null];
  }

  private end(a: Side): void {
    const run = this.cur[a];
    if (run.hits >= 2) {
      this.count[a]++;
      const bst = this.best[a];
      if (run.dmg > bst.dmg || (run.dmg === bst.dmg && run.hits > bst.hits)) this.best[a] = { ...run };
      this.last[a] = { ...run, ago: 0 };
    }
    this.cur[a] = { hits: 0, dmg: 0 };
  }
}
