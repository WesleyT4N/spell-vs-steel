// Rogue numbers: HP, basic attacks, resource and spell constants. The balance lab edits these live
// through TUNING.rogue (game/tuning.ts gathers every class's block), so keep them plain numbers.

// Basics follow the same x0.7 scale as Warrior and Mage.

export const hp = 6500;

export default {
  /** Throwing Knife flight speed (panels per second, capped by maxShotSpeed). */
  shotSpeed: 12,
  /** Light: a dagger stab that hits every panel up to `stabReach` ahead. Heavy: a throwing knife down the row. */
  // light 120 / 6500 HP: sims put the Rogue near 60% vs Mage and 40% vs Warrior (2026-10-25)
  lightDamage: 100,
  heavyDamage: 220,
  stabReach: 1,
  lightLock: 0.35,
  heavyLock: 0.35,
  /** Energy tops up to this at every Draw screen (5 = a full refill, so every turn can chain cheap skills). */
  energyTopUp: 5,
  energyCap: 5,
  /** After a backstab the Rogue may keep acting from in front of the enemy this long before blinking home. */
  backstabWindow: 2,
  /** Vanish: the next attack spell stuns for this long. */
  vanishStun: 2,
  riposteDamage: 800,
};
