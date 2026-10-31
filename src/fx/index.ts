// Which battle fx play a pixelfx-method effect (see docs/FX.md). Any fx kind not registered here keeps its
// hand-drawn version in src/game/fxView.ts.
import { registerPfx, registerShotPfx, type PfxModule } from '../game/pfx';

/** Every effect module, by id ("warrior/cleave-a"), for the labs and the contact-sheet tool. */
export const EFFECTS: Record<string, PfxModule> = Object.fromEntries(
  Object.entries(import.meta.glob<{ default: PfxModule }>('./*/*.ts', { eager: true }))
    .map(([path, m]) => [path.slice(2, -3), m.default]),
);

/** The effect each fx kind plays in the game. */
export const PLAYS: Record<string, string> = {
  cleave: 'warrior/cleave',
  cleaveHeavy: 'warrior/cleave-heavy',
  stepSlash: 'warrior/step-slash',
  thrust: 'warrior/thrust',
  leapSmash: 'warrior/leap-smash',
  execute: 'warrior/execute',
  hammer: 'warrior/hammer',
  shieldSlam: 'warrior/shield-slam',
  mortal: 'warrior/mortal',
  rampage: 'warrior/rampage',
  groundSlam: 'warrior/ground-slam',
  shatter: 'warrior/shatter',
  lastStandBlast: 'warrior/last-stand-blast',
  wide: 'warrior/wide',
  seismic: 'warrior/seismic',
  titanFall: 'warrior/titan-fall',
  battleShout: 'warrior/battle-shout',
  roar: 'warrior/roar',
  berserk: 'warrior/berserk',
  rally: 'warrior/rally',
  avatar: 'warrior/avatar',
  lastStand: 'warrior/last-stand',
  guardUp: 'warrior/guard-up',
  ironSkin: 'warrior/iron-skin',
  unbreakable: 'warrior/unbreakable',
  reflectUp: 'warrior/reflect-up',
  wallRise: 'warrior/wall-rise',
  banner: 'warrior/banner',
};

for (const [kind, id] of Object.entries(PLAYS)) registerPfx(kind, EFFECTS[id]);

/** The effect each flying projectile kind plays (Projectile.kind); kinds not listed keep their hand-drawn shot. */
export const SHOT_PLAYS: Record<string, string> = {};

for (const [kind, id] of Object.entries(SHOT_PLAYS)) registerShotPfx(kind, EFFECTS[id]);
