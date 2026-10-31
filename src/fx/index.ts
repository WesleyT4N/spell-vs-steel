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
  // Mage
  arcaneHit: 'mage/arcane-blast',
  arcaneSurge: 'mage/arcane-surge',
  blink: 'mage/blink',
  counter: 'mage/counterspell',
  arcaneFocus: 'mage/arcane-focus',
  arcaneBarrier: 'mage/arcane-barrier',
  arcaneIntellect: 'mage/arcane-intellect',
  arcanePower: 'mage/arcane-power',
  evocation: 'mage/evocation',
  ascendance: 'mage/ascendance',
  fireballBlast: 'mage/fireball-blast',
  pillar: 'mage/flamestrike',
  meteorFall: 'mage/meteor-fall',
  meteorBlast: 'mage/meteor',
  comet: 'mage/comet',
  dragonsBreath: 'mage/dragons-breath',
  inferno: 'mage/inferno',
  ignite: 'mage/ignite',
  scorch: 'mage/scorch',
  novaZone: 'mage/frost-nova-zone',
  nova: 'mage/frost-nova',
  shard: 'mage/blizzard',
  deepFreeze: 'mage/deep-freeze',
  iceWall: 'mage/ice-wall',
  iceBlock: 'mage/ice-block',
  glacialFortress: 'mage/glacial-fortress',
};

for (const [kind, id] of Object.entries(PLAYS)) registerPfx(kind, EFFECTS[id]);

/** The effect each flying projectile kind plays (Projectile.kind); kinds not listed keep their hand-drawn shot. */
export const SHOT_PLAYS: Record<string, string> = {
  orb: 'mage/rune-star',
  beam: 'mage/rune-comet',
  missile: 'mage/arcane-missiles',
  gust: 'mage/repulse',
  fireball: 'mage/fireball',
};

for (const [kind, id] of Object.entries(SHOT_PLAYS)) registerShotPfx(kind, EFFECTS[id]);
