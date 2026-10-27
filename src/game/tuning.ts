// Every number worth tweaking after a playtest lives here.

export const TUNING = {
  // re-searched after the CPU stopped freezing up when stunned mid-charge (#45): the HP-only patch closest to the 55-65 wheel at Normal, at Hard and with the starters (scripts/tune.ts)
  hp: { warrior: 890, mage: 665, rogue: 650, ranger: 695, priest: 630 },

  /** Seconds for the shared custom gauge to fill. */
  gaugeSeconds: 10,
  /** Custom screen countdown in seconds. */
  customTimer: 20,
  /** Spells drawn per custom screen. */
  handSize: 5,

  /** Seconds between steps when a direction is held. */
  moveRepeat: 0.16,
  /** Minimum seconds between any two steps, taps included, so nobody can jitter back and forth. A tap during it is buffered. */
  moveCooldown: 0.1,
  /** Global cooldown: minimum seconds between two spell casts. */
  castCooldown: 0.5,
  /** Area spells (columns, rows, zones, rains) flash their panels this long before the hit lands, BN style.
   *  Long enough to step out of after online input delay; spells with their own longer telegraph keep it. */
  warnTime: 0.5,
  /** Shortest freeze or stun in seconds, so the attacker always gets a follow-up cast in. */
  ccMin: 2,

  /** Holding the attack button this long arms the heavy attack. */
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
    /** Counterspell also silences the caster it cancels for this long. */
    counterSilence: 3,
  },

  // Draft classes (Rogue, Ranger, Priest): basics follow the same x0.7 scale as Warrior and Mage.
  rogue: {
    /** Light: a dagger stab that hits every panel up to `stabReach` ahead. Heavy: a throwing knife down the row. */
    // light 12 / 650 HP: sims put the Rogue near 60% vs Mage and 40% vs Warrior (2026-10-25)
    lightDamage: 12,
    heavyDamage: 22,
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
    riposteDamage: 80,
  },

  ranger: {
    /** Light: a travel-time Arrow (panels per second). Heavy: an instant Aimed Shot on the normal charge. */
    // heavy 20 / 740 HP: sims put the Ranger at ~39% vs Warrior, ~63% vs Mage, ~60% vs Rogue (2026-10-25)
    lightDamage: 8,
    heavyDamage: 20,
    arrowSpeed: 14,
    lightLock: 0.4,
    heavyLock: 0.4,
    /** Steady Focus: damage multiplier while rooted. */
    focusBonus: 1.25,
    tripwireStun: 2,
    energyStart: 2,
    energyCap: 5,
    /** Standing still this long gives 1 Energy (plus 1 per Draw screen). */
    stillSeconds: 2,
  },

  priest: {
    lightDamage: 6,
    // Smite at 28 flinches like the Mage heavy; sims at 700 HP (1000 matches each): ~66% vs Warrior, ~53% vs Mage, ~45% vs Rogue, ~42% vs Ranger (2026-10-25)
    heavyDamage: 28,
    lightLock: 0.4,
    heavyLock: 0.5,
    /** Smite lands this many panels ahead and heals the Priest on a hit. */
    smiteRange: 3,
    holyWallHp: 100,
    holyWallTime: 6,
    smiteHeal: 10,
    smiteKnock: 0,
    manaStart: 3,
    manaPerDraw: 3,
    manaCap: 5,
    /** Cursed panels: damage per second to an enemy standing on one. Cursed or Hexed fighters deal this multiplier. */
    curseDps: 10,
    /** Each further second on the same cursed panel adds this much, up to curseMax per tick. */
    curseRamp: 4,
    curseMax: 26,
    weakened: 0.75,
    /** Blessed panels (all last until the next Draw screen): Hallowed Ground damage, Aegis Field shield, Wellspring Mana. */
    hallowedBonus: 1.35,
    blessShieldPerSec: 15,
    /** Every holy shield (Power Word: Shield, Aegis Field, Holy Sanctum) shares one pool up to this. */
    shieldCap: 100,
    blessManaSeconds: 2,
  },

  /** Each Poison stack deals this per second for poisonSeconds. */
  poisonDps: 5,
  poisonSeconds: 6,
  poisonMaxStacks: 3,
  /** Healing blessed panels (Sanctuary, Sacred Ground) heal their owner this much per second. */
  blessHps: 12,

  /** Frost Nova hits an enemy within this many columns of the caster. */
  frostNovaRange: 3,
  frostNovaDamage: 25,

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
    hard: { think: 0.12, aim: 1, dodge: 1, castPatience: 0.4 },
  },
} as const;

export type Difficulty = keyof typeof TUNING.cpu;
