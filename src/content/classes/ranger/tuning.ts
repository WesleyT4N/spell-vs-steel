// Ranger numbers: HP, basic attacks, resource and spell constants. The balance lab edits these live
// through TUNING.ranger (game/tuning.ts gathers every class's block), so keep them plain numbers.

export const hp = 7650;

export default {
  /** Light: a travel-time Arrow (panels per second). Heavy: an Aimed Shot on the normal charge, flying at aimedSpeed. */
  // heavy 200 / 7400 HP: sims put the Ranger at ~39% vs Warrior, ~63% vs Mage, ~60% vs Rogue (2026-10-25)
  lightDamage: 100,
  heavyDamage: 200,
  arrowSpeed: 12,
  /** Aimed Shot, the sniper shot: the one projectile allowed past maxShotSpeed (Wes). */
  aimedSpeed: 15,
  lightLock: 0.4,
  heavyLock: 0.4,
  /** Steady Focus: damage multiplier while rooted. */
  focusBonus: 1.25,
  tripwireStun: 2,
  energyStart: 2,
  energyCap: 5,
  /** Standing still this long gives 1 Energy (plus 1 per Draw screen). */
  stillSeconds: 2,
};
