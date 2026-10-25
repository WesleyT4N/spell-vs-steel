// Every number worth tweaking after a playtest lives here.

export const TUNING = {
  hp: { warrior: 870, mage: 720 },

  /** Seconds for the shared custom gauge to fill. */
  gaugeSeconds: 10,
  /** Custom screen countdown in seconds. */
  customTimer: 20,
  /** Spells drawn per custom screen. */
  handSize: 5,

  /** Seconds between steps when a direction is held. */
  moveRepeat: 0.16,

  /** Wind-up between pressing heavy attack and the swing. */
  heavyCharge: 1.0,

  warrior: {
    lightDamage: 7,
    heavyDamage: 32,
    lightLock: 0.45,
    heavyLock: 0.4,
    rageMax: 5,
    rageLightHit: 0,
    rageHeavyHit: 1.5,
    /** Taking damage builds Rage in proportion to the damage: 1 pip per this much, capped per hit. */
    rageDamagePerPip: 40,
    rageWhenHitMax: 1,
  },

  mage: {
    lightDamage: 6,
    heavyDamage: 28,
    lightLock: 0.4,
    heavyLock: 0.35,
    manaStart: 1,
    manaCap: 5,
  },

  /** Frost Nova hits an enemy within this many columns of the caster. */
  frostNovaRange: 2,
  frostNovaDamage: 20,

  /** Frozen or stunned targets take this multiplier from all sources. */
  frozenBonus: 1.5,
  /** Hits this big make the target flinch (cancels charging, brief lockout). */
  flinchThreshold: 28,
  flinchTime: 0.3,
  /** Burning panels tick this often (seconds). */
  burnTick: 0.5,

  cpu: {
    easy: { think: 0.6, aim: 0.55, dodge: 0, castPatience: 3 },
    normal: { think: 0.22, aim: 0.9, dodge: 0.85, castPatience: 1.5 },
  },
} as const;

export type Difficulty = keyof typeof TUNING.cpu;
