// Stand-in for battle3d.ts in every build except `--mode lowpoly` (see vite.config.ts), so the regular dev and
// prod builds never bundle three.js. Same exports; the 3D pass reports "unavailable" and battles draw in 2D.
import type { Ctx } from '../engine/gfx';
import type { Stage } from '../art/arena';
import type { Battle, Fighter } from '../game/battle';
import type { Look } from '../game/fighterAnim';

export function panel3d(_col: number, _row: number, _v: unknown): void {}
export function drawBattle3D(_c: Ctx, _b: Battle, _st: Stage, _me: 0 | 1 | 'all', _looks: Map<Fighter, Look>): boolean { return false; }
