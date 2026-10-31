// Every number worth tweaking after a playtest lives here. Each class's own numbers live in its folder
// (content/classes/<id>/tuning.ts) and are gathered here in roster order, so TUNING keeps one shape for the
// balance lab, sims and golden digest.
import warrior, { hp as warriorHp } from '../content/classes/warrior/tuning';
import mage, { hp as mageHp } from '../content/classes/mage/tuning';
import rogue, { hp as rogueHp } from '../content/classes/rogue/tuning';
import ranger, { hp as rangerHp } from '../content/classes/ranger/tuning';
import priest, { hp as priestHp } from '../content/classes/priest/tuning';

export const TUNING = {
  // re-searched after the CPU stopped freezing up when stunned mid-charge (#45): the HP-only patch closest to the 55-65 wheel at Normal, at Hard and with the starters (scripts/tune.ts)
  hp: { warrior: warriorHp, mage: mageHp, rogue: rogueHp, ranger: rangerHp, priest: priestHp },

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

  // each class's block, from its folder
  warrior,
  mage,
  rogue,
  ranger,
  priest,

  /** Each Poison stack deals this per second for poisonSeconds. */
  poisonDps: 50,
  poisonSeconds: 6,
  poisonMaxStacks: 3,
  /** Healing blessed panels (Sanctuary, Sacred Ground) heal their owner this much per second. */
  blessHps: 160,

  /** Frost Nova hits an enemy within this many columns of the caster. */
  frostNovaRange: 3,
  frostNovaDamage: 250,

  /** Frozen or stunned targets take this multiplier from all sources. */
  frozenBonus: 1.5,
  /** Hits this big make the target flinch (cancels charging, brief lockout). */
  flinchThreshold: 200,
  flinchTime: 0.3,
  /** No projectile flies faster than this (panels per second), so every shot can be read and dodged. */
  maxShotSpeed: 15,
  /** Hit pause: the whole fight stops this long on a hit, by tier (light, solid, big, K.O.). BN-style weight. */
  hitStop: [0.045, 0.105, 0.165, 0.375],
  /** Hits this soon after a pause don't pause again (unless they K.O.), so a flurry doesn't stutter. */
  hitStopGap: 0.18,
  /** Big hits (and K.O.s) slow the fight to this speed for a moment. */
  slowmo: { speed: 0.3, big: 0.525, ko: 1.35 },
  /** Effect animations play this much longer than they're timed (looks only, the rules keep their timing). */
  fxSlow: 1.25,
  /** Burning panels tick this often (seconds). */
  burnTick: 0.5,

  cpu: {
    easy: { think: 0.6, aim: 0.55, dodge: 0, castPatience: 3 },
    normal: { think: 0.22, aim: 0.9, dodge: 0.85, castPatience: 1.5 },
    hard: { think: 0.12, aim: 1, dodge: 1, castPatience: 0.4 },
  },
} as const;

export type Difficulty = keyof typeof TUNING.cpu;
