// Which battle fx play a pixelfx-method effect (see docs/FX.md). Any fx kind not registered here keeps its
// hand-drawn version in src/game/fxView.ts.
import { registerPfx, type PfxModule } from '../game/pfx';

/** Every effect module, by id ("warrior/cleave-a"), for the labs and the contact-sheet tool. */
export const EFFECTS: Record<string, PfxModule> = Object.fromEntries(
  Object.entries(import.meta.glob<{ default: PfxModule }>('./*/*.ts', { eager: true }))
    .map(([path, m]) => [path.slice(2, -3), m.default]),
);

/** The effect each fx kind plays in the game. */
export const PLAYS: Record<string, string> = {};

for (const [kind, id] of Object.entries(PLAYS)) registerPfx(kind, EFFECTS[id]);
