// Mage numbers: HP, basic attacks, resource and spell constants. The balance lab edits these live
// through TUNING.mage (game/tuning.ts gathers every class's block), so keep them plain numbers.

export const hp = 6900;

export default {
  /** Arcane Orb and Beam flight speed (panels per second, capped by maxShotSpeed). */
  shotSpeed: 14,
  lightDamage: 60,
  heavyDamage: 280,
  lightLock: 0.4,
  heavyLock: 0.35,
  manaStart: 1,
  manaCap: 5,
  /** Counterspell also silences the caster it cancels for this long. */
  counterSilence: 3,
  /** Meteor: seconds from cast until it lands (the plus-shape warning shows the whole time). */
  meteorFall: 1.5,
  /** Arcane Blast: damage multiplier on the caster's next damaging spell. */
  blastEmpower: 1.25,
};
