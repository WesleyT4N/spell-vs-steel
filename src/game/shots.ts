// Shot helpers shared by the engine and class rules. Kept apart from battle.ts so class modules can use them
// without importing the engine (battle.ts imports the class registry, so that would be a cycle).
import type { HitOpts, Side } from './battle';
import { effect, type ShotHit } from '../content/effects';

/** Stereo position of a column: -1 left edge to +1 right edge. */
export const panOf = (col: number): number => (col - 2.5) / 3;

/** A basic shot (the Ranger's Arrow, every class's projectile attack). `fx`: a look to play where it hits a fighter. */
export const basicShot = effect('battle.basicShot', (b, a: { side: Side; dmg: number; opts: HitOpts; fx?: string }, h: ShotHit) => {
  if (h.w) b.hitWall(h.w, a.dmg, b.f[a.side], a.opts);
  else if (h.t) { b.damage(h.t, a.dmg, b.f[a.side], a.opts); if (a.fx) b.addFx(a.fx, a.side, h.t.col, h.t.row, 0.3); }
});
