// Warrior numbers: HP, basic attacks, resource and spell constants. The balance lab edits these live
// through TUNING.warrior (game/tuning.ts gathers every class's block), so keep them plain numbers.

export const hp = 9650;

export default {
  lightDamage: 100,
  heavyDamage: 280,
  lightLock: 0.45,
  heavyLock: 0.4,
  rageMax: 5,
  rageLightHit: 0,
  rageHeavyHit: 1.5,
  /** Taking damage builds Rage in proportion to the damage: 1 pip per this much, capped per hit. */
  rageDamagePerPip: 400,
  rageWhenHitMax: 1,
};
