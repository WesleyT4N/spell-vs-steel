// Effects as plain data. Anything that happens later (a telegraphed strike, the next of a spell's hits, a
// projectile's impact, a sprite lunge) is scheduled as a record: the id of a registered effect and its
// arguments. The battle's state then holds no functions, so rollback snapshots, replays and checksums see
// all of it, and a data-only mod can name a built-in effect by id.
//
// Arguments are plain data (numbers, strings, cells, cast refs) or references to the battle's own objects
// (a pet, a shared counter object). Never a function, and never a value the effect should read live:
// effects look fighters up by side when they run.
import { Registry } from './registry';
import type { Battle, CastCtx, Fighter, Projectile, Wall } from '../game/battle';

export interface EffectRec<H = void> {
  /** Id of a registered effect. */
  fx: string;
  /** Its arguments. */
  a: object;
  /** Notes from whoever watches the battle (post-match stats credit a hit to the cast that scheduled it). */
  w?: Record<string, unknown>;
  /** Type only: what the effect is handed when it runs (a projectile's hit, an animation's progress). */
  readonly h?: H;
}

/** What a projectile's effect is handed when it lands: the fighter or wall it hit (or neither), and where. */
export interface ShotHit { t: Fighter | null; w: Wall | null; col: number; p: Projectile }

interface Effect { id: string; run: (b: Battle, a: never, h: never) => void }
export const EFFECTS = new Registry<Effect>('effect');

/** Register effect `id`; returns a maker of its records. */
export function effect<A extends object, H = void>(id: string, run: (b: Battle, a: A, h: H) => void): (a: A) => EffectRec<H> {
  EFFECTS.register({ id, run: run as Effect['run'] });
  return a => ({ fx: id, a });
}

/**
 * A later step of a spell. It runs with the cast rebuilt from its ref: the caster and foe looked up live, the
 * damage multiplier and the rest as they were at cast time. Ids are `<card>.<step>`.
 */
export function spellStep<A extends object = Record<string, never>, H = void>(id: string, run: (x: CastCtx, a: A, h: H) => void): (x: CastCtx, a?: A) => EffectRec<H> {
  EFFECTS.register({ id, run: ((b: Battle, a: A & { x: CastCtx['ref'] }, h: H) => run(b.ctxOf(a.x), a, h)) as Effect['run'] });
  return (x, a) => ({ fx: id, a: { ...a, x: x.ref } });
}

/** Run a record's effect. */
export function runEffect<H>(b: Battle, rec: EffectRec<H>, h: H): void {
  const e = EFFECTS.get(rec.fx);
  if (!e) throw new Error(`unknown effect '${rec.fx}'`);
  (e.run as (b: Battle, a: object, h: H) => void)(b, rec.a, h);
}
