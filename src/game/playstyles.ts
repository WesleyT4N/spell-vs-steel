// CPU playstyles: how a CPU fights, separate from how well (Difficulty). Each class has three, one per broad
// temperament, and each names the deck archetype it plays best with (src/dev/archetypes.ts) for the sims.
import type { ClassId } from '../art/sprites';
import { CARDS } from './cards';
import type { Difficulty } from './tuning';
import { BASE } from './temperaments';
import { CLASSES, classModule } from '../content/classes';

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

/** The CPU as it always played: the default for Versus and the sims. */
export const BALANCED: Playstyle = { ...BASE, id: 'balanced', name: 'Balanced', cls: null, kind: 'balanced', desc: 'The standard CPU.' };

/** Every class's styles, in roster order (read live from the class registry). */
export const allStyles = (): Playstyle[] => CLASSES.all().flatMap(m => m.cpu.styles);

export const stylesFor = (cls: ClassId): Playstyle[] => classModule(cls).cpu.styles;
export const styleById = (id: string): Playstyle => allStyles().find(s => s.id === id) ?? BALANCED;

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
 * Normal any of its three, Hard the one that does best against the player's class (the class's cpu.counter, from sims).
 */
export function styleFor(cls: ClassId, d: Difficulty, foe: ClassId, rand: () => number): Playstyle {
  const mine = stylesFor(cls);
  if (!mine.length) return BALANCED;
  if (d === 'easy') return mine.find(s => s.kind === 'aggro') ?? mine[0];
  const counter = d === 'hard' ? classModule(cls).cpu.counter[foe] : undefined;
  if (counter) return styleById(counter);
  return mine[Math.floor(rand() * mine.length)];
}

