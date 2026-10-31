// Priest numbers: HP, basic attacks, resource and spell constants. The balance lab edits these live
// through TUNING.priest (game/tuning.ts gathers every class's block), so keep them plain numbers.

export const hp = 6600;

export default {
  /** Holy Spark flight speed (panels per second, capped by maxShotSpeed). */
  shotSpeed: 12,
  lightDamage: 60,
  // Smite at 280 flinches (threshold 200 since 2026-10-28); it finds the enemy within smiteRange columns
  heavyDamage: 280,
  lightLock: 0.4,
  heavyLock: 0.5,
  /** Smite finds the enemy within this many columns (any row); farther away it lands this many panels ahead and misses. */
  smiteRange: 3,
  holyWallHp: 1000,
  holyWallTime: 6,
  smiteKnock: 0,
  manaStart: 3,
  manaPerDraw: 3,
  manaCap: 5,
  /** Cursed panels: damage per second to an enemy standing on one. Cursed or Hexed fighters deal this multiplier. */
  curseDps: 100,
  /** Each further second on the same cursed panel adds this much, up to curseMax per tick. */
  curseRamp: 40,
  curseMax: 260,
  weakened: 0.75,
  /** Blessed panels (all last until the next Draw screen): Hallowed Ground damage, Aegis Field shield, Wellspring Mana. */
  hallowedBonus: 1.35,
  blessShieldPerSec: 150,
  /** Every holy shield (Power Word: Shield, Aegis Field, Holy Sanctum) shares one pool up to this. */
  shieldCap: 1000,
  blessManaSeconds: 2,
};
