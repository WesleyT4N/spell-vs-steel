// CPU playstyles: how a CPU fights, separate from how well (Difficulty). Each class has three, one per broad
// temperament, and each names the deck archetype it plays best with (src/dev/archetypes.ts) for the sims.
import type { ClassId } from '../art/sprites';
import { CARDS } from './cards';
import type { Difficulty } from './tuning';

export type Temperament = 'aggro' | 'conservative' | 'defensive';
export type Role = 'damage' | 'defense' | 'control' | 'setup';

export interface Playstyle {
  id: string;
  name: string;
  cls: ClassId | null;
  kind: Temperament | 'balanced';
  desc: string;
  /** Archetype id from src/dev/archetypes.ts that suits this style (sims pair them). */
  deck?: string;
  /** Multiplies the chance to step out of a telegraph or a shot. */
  dodge: number;
  /** Chance per decision to sidestep out of the enemy's row when they are close or charging a heavy. */
  evade: number;
  /** Multiplies how often basic attacks are thrown and heavies charged. */
  attack: number;
  /** -1 hang back, 0 the class's usual spot, 1 press forward (melee classes already fight at the border). */
  range: -1 | 0 | 1;
  /** Multiplies how long the top spell waits for a good moment before it is cast anyway. */
  patience: number;
  /** Chance per decision to cast the top spell even when it is not a good moment. */
  eager: number;
  /** Save resource for spells costing at least this much (0: never save). */
  bigMin: number;
  /** Card pick bias by role, added to a card's cost when ranking the offer. */
  prefer: Record<Role, number>;
}

/** Spells whose job is to keep you alive. */
const DEFENSE = new Set([
  'guard', 'iron_skin', 'shield_wall', 'unbreakable', 'spell_reflection', 'last_stand', 'intimidating_roar', 'rallying_cry',
  'arcane_barrier', 'blink', 'ice_wall', 'ice_block', 'glacial_fortress',
  'evasion', 'cloak_of_shadows', 'riposte', 'shadow_clone', 'vanish', 'smokescreen',
  'disengage', 'feign_death', 'spirit_bear',
  'flash_heal', 'power_word_shield', 'sanctuary', 'holy_wall', 'aegis_field', 'sacred_ground', 'divine_hymn', 'holy_sanctum', 'prayer',
]);
/** Spells that lock the enemy down or move them. */
const CONTROL = new Set([
  'chain_hook', 'war_banner', 'ground_shatter', 'shield_slam',
  'repulse', 'frost_nova', 'deep_freeze', 'blizzard', 'counterspell',
  'kick', 'blind', 'kidney_shot',
  'net', 'freezing_trap', 'tripwire', 'wyvern_sting', 'minefield', 'hunters_domain',
  'psychic_scream', 'hex',
]);

export function roleOf(id: string): Role {
  if (DEFENSE.has(id)) return 'defense';
  if (CONTROL.has(id)) return 'control';
  return CARDS[id]?.damaging ? 'damage' : 'setup';
}

const BASE = { dodge: 1, evade: 0, attack: 1, range: 0 as const, patience: 1, eager: 0, bigMin: 4, prefer: { damage: 0, defense: 0, control: 0, setup: 0 } };

/** The CPU as it always played: the default for Versus and the sims. */
export const BALANCED: Playstyle = { ...BASE, id: 'balanced', name: 'Balanced', cls: null, kind: 'balanced', desc: 'The standard CPU.' };

// the three temperaments; class styles start from one and add their flavor
const AGGRO = { ...BASE, kind: 'aggro' as const, dodge: 0.6, attack: 1.4, range: 1 as const, patience: 0.4, eager: 0.25, bigMin: 0, prefer: { damage: 2, defense: -2, control: 0, setup: -1 } };
const CONSERVATIVE = { ...BASE, kind: 'conservative' as const, attack: 0.8, patience: 2.5, eager: 0, bigMin: 3, prefer: { damage: 1, defense: 0, control: 1, setup: 0 } };
const DEFENSIVE = { ...BASE, kind: 'defensive' as const, dodge: 1.3, evade: 0.35, attack: 0.7, range: -1 as const, patience: 1.5, bigMin: 0, prefer: { damage: -1, defense: 3, control: 1, setup: 0 } };

export const PLAYSTYLES: Playstyle[] = [
  { ...AGGRO, id: 'warrior_berserker', name: 'Berserker', cls: 'warrior', deck: 'berserker', desc: 'Lives on the border, swings constantly and spends Rage the moment it has it.' },
  { ...CONSERVATIVE, id: 'warrior_warlord', name: 'Warlord', cls: 'warrior', deck: 'warlord', desc: 'Hooks and zones first, banks Rage for Titan\'s Fall and Rampage.' },
  { ...DEFENSIVE, range: 0, id: 'warrior_juggernaut', name: 'Juggernaut', cls: 'warrior', deck: 'juggernaut', desc: 'Guards and walls up, builds Rage from blocked hits, punishes from behind its shield.' },

  { ...AGGRO, id: 'mage_blaster', name: 'Blaster', cls: 'mage', deck: 'pyromancer', desc: 'Casts everything as soon as it can, from the front of its area.' },
  { ...CONSERVATIVE, id: 'mage_archmage', name: 'Archmage', cls: 'mage', deck: 'arcanist', desc: 'Ramps Mana and waits for the right moment for Meteor and Arcane Surge.' },
  { ...DEFENSIVE, id: 'mage_kiter', name: 'Kiter', cls: 'mage', deck: 'cryomancer', desc: 'Keeps to the back column behind ice, freezes anyone who comes close.' },

  { ...AGGRO, id: 'rogue_cutthroat', name: 'Cutthroat', cls: 'rogue', deck: 'assassin', desc: 'Blinks in over and over, never waits for Stealth.' },
  { ...CONSERVATIVE, bigMin: 4, id: 'rogue_shadow', name: 'Shadow', cls: 'rogue', deck: 'shadow', desc: 'Waits in Stealth for a big Ambush or Eviscerate.' },
  { ...DEFENSIVE, range: 0, id: 'rogue_duelist', name: 'Duelist', cls: 'rogue', deck: 'poisoner', desc: 'Dodges, parries and cloaks while Poison ticks.' },

  { ...AGGRO, range: 0, id: 'ranger_skirmisher', name: 'Skirmisher', cls: 'ranger', deck: 'beastmaster', desc: 'Keeps the pets and arrows coming, chases the enemy\'s row.' },
  { ...CONSERVATIVE, id: 'ranger_sniper', name: 'Sniper', cls: 'ranger', deck: 'marksman', desc: 'Stands still for Energy and holds for Power Shot and Kill Shot.' },
  { ...DEFENSIVE, id: 'ranger_trapper', name: 'Trapper', cls: 'ranger', deck: 'trapper', desc: 'Hangs back, mines the enemy area and Disengages from anyone close.' },

  { ...AGGRO, id: 'priest_zealot', name: 'Zealot', cls: 'priest', deck: 'holy', desc: 'Holy Fire and Penance on cooldown, pushes up to Smite range.' },
  { ...CONSERVATIVE, id: 'priest_plaguelord', name: 'Plaguelord', cls: 'priest', deck: 'shadow', desc: 'Curses and DoTs first, waits for them to stack before spending big.' },
  { ...DEFENSIVE, id: 'priest_shepherd', name: 'Shepherd', cls: 'priest', deck: 'sanctum', desc: 'Shields, heals and blessed ground; outlasts the enemy.' },
];

export const stylesFor = (cls: ClassId): Playstyle[] => PLAYSTYLES.filter(s => s.cls === cls);
export const styleById = (id: string): Playstyle => PLAYSTYLES.find(s => s.id === id) ?? BALANCED;

/** How fully each difficulty commits to its style. Full commitment exaggerates a style's weak spots, so every level plays it at half strength for now. */
const COMMIT: Record<Difficulty, number> = { easy: 0.5, normal: 0.5, hard: 0.5 };

/** A style as played at a difficulty: its numeric knobs pulled toward the standard CPU by (1 - commitment). */
export function playedAt(s: Playstyle, d: Difficulty): Playstyle {
  const k = COMMIT[d];
  if (k === 1) return s;
  const mix = (a: number, base: number): number => base + (a - base) * k;
  const prefer = Object.fromEntries(Object.entries(s.prefer).map(([r, v]) => [r, mix(v, 0)])) as Record<Role, number>;
  return { ...s, dodge: mix(s.dodge, 1), evade: mix(s.evade, 0), attack: mix(s.attack, 1), patience: mix(s.patience, 1), eager: mix(s.eager, 0), prefer };
}

/**
 * The style a CPU of this class brings to a match: Easy always plays its readable aggro style,
 * Normal any of its three, Hard the one that does best against the player's class (COUNTER, from sims).
 */
export function styleFor(cls: ClassId, d: Difficulty, foe: ClassId, rand: () => number = Math.random): Playstyle {
  const mine = stylesFor(cls);
  if (!mine.length) return BALANCED;
  if (d === 'easy') return mine.find(s => s.kind === 'aggro') ?? mine[0];
  const counter = d === 'hard' ? COUNTER[cls]?.[foe] : undefined;
  if (counter) return styleById(counter);
  return mine[Math.floor(rand() * mine.length)];
}

/** Hard CPU's pick per matchup: CPU class -> player class -> style id. From `npm run balance -- --pools style-starter --cpu hard`. */
const COUNTER: Partial<Record<ClassId, Partial<Record<ClassId, string>>>> = {
  warrior: { mage: 'warrior_juggernaut', rogue: 'warrior_berserker', ranger: 'warrior_juggernaut', priest: 'warrior_juggernaut' },
  mage: { warrior: 'mage_archmage', rogue: 'mage_blaster', ranger: 'mage_blaster', priest: 'mage_blaster' },
  rogue: { warrior: 'rogue_cutthroat', mage: 'rogue_cutthroat', ranger: 'rogue_duelist', priest: 'rogue_cutthroat' },
  ranger: { warrior: 'ranger_sniper', mage: 'ranger_sniper', rogue: 'ranger_sniper', priest: 'ranger_sniper' },
  priest: { warrior: 'priest_plaguelord', mage: 'priest_plaguelord', rogue: 'priest_plaguelord', ranger: 'priest_shepherd' },
};
