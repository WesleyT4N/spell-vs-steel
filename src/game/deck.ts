// Spell deck rules, starter decks and browser storage for custom decks.
import { getSave, updateSave, saveIsReadOnly } from '../engine/save';
import { CARDS, MAX_COPIES, type CardDef } from './cards';
import type { ClassId } from '../art/sprites';

export const DECK_SIZE = 30;
export const MAX_LEGENDARIES = 5;
export const MYTHICS_REQUIRED = 1;

/** Card id -> copies. */
export type DeckCounts = Record<string, number>;

export const STARTERS: Record<ClassId, DeckCounts> = {
  warrior: {
    step_slash: 4, guard: 3, lunge: 3, iron_skin: 2, shield_wall: 2, execute: 3, chain_hook: 3, shieldbreaker: 2, battle_shout: 2,
    leap_strike: 1, wide_cleave: 1,
    rampage: 1, shield_slam: 1, rallying_cry: 1,
    titans_fall: 1,
  },
  mage: {
    arcane_missiles: 4, arcane_focus: 3, arcane_barrier: 2, blink: 2, repulse: 2, ignite: 3, fireball: 3, scorch: 2, ice_wall: 2, frost_nova: 2,
    arcane_blast: 1, flamestrike: 1,
    meteor: 1, deep_freeze: 1,
    inferno: 1,
  },
  rogue: {
    vanish: 3, shadowstep: 4, ambush: 3, shiv: 4, evasion: 1, kick: 2, poison_vial: 2, deadly_poison: 2, envenom: 2,
    cold_blood: 2, riposte: 1, pickpocket: 1,
    eviscerate: 1, kidney_shot: 1,
    death_mark: 1,
  },
  ranger: {
    steady_focus: 3, hawk_strike: 4, hunters_mark: 2, net: 2, disengage: 2, freezing_trap: 2, explosive_trap: 2, multi_shot: 3, call_wolf: 2, power_shot: 3,
    rapid_fire: 1, volley: 1,
    kill_shot: 1, explosive_shot: 1,
    deadeye: 1,
  },
  priest: {
    prayer: 2, flash_heal: 3, holy_fire: 3, penance: 3, power_word_shield: 2, hallowed_ground: 2, sanctuary: 2, shadow_word_pain: 3, devouring_plague: 2, desecrate: 2,
    wellspring: 1, hex: 1, mind_sear: 1,
    halo: 1, void_rift: 1,
    wrath_of_heaven: 1,
  },
};

export const starterDeck = (cls: ClassId): DeckCounts => ({ ...STARTERS[cls] });
export const STARTER_NAME: Record<ClassId, string> = { warrior: 'Brawler', mage: 'Elementalist', rogue: 'Assassin', ranger: 'Hunter', priest: 'Disciple' };

/** A ready-made deck: the starter, or one built around one of the class's Mythics. */
export interface DeckPreset { id: string; name: string; mythic: string; cards: DeckCounts }

/** One deck per Mythic, picked on the character select alongside the starter and the custom deck. */
const MYTHIC_DECKS: Record<ClassId, DeckPreset[]> = {
  warrior: [
    {
      id: 'earthshaker', name: 'Earthshaker', mythic: 'titans_fall', cards: {
        step_slash: 3, guard: 3, lunge: 3, iron_skin: 3, shield_wall: 2, execute: 2, chain_hook: 3, shieldbreaker: 2, battle_shout: 2,
        ground_slam: 2, leap_strike: 1,
        ground_shatter: 1, shield_slam: 1, rallying_cry: 1,
        titans_fall: 1,
      },
    },
    {
      id: 'juggernaut', name: 'Juggernaut', mythic: 'avatar_of_war', cards: {
        step_slash: 3, guard: 4, lunge: 3, iron_skin: 3, execute: 3, chain_hook: 3, shieldbreaker: 2, battle_shout: 2,
        leap_strike: 2, wide_cleave: 1,
        rampage: 1, mortal_strike: 1, berserk: 1,
        avatar_of_war: 1,
      },
    },
    {
      id: 'bulwark', name: 'Bulwark', mythic: 'last_stand', cards: {
        guard: 3, iron_skin: 3, shield_wall: 2, step_slash: 4, lunge: 3, execute: 3, chain_hook: 3, intimidating_roar: 2,
        wide_cleave: 2, leap_strike: 1,
        unbreakable: 1, rallying_cry: 1, spell_reflection: 1,
        last_stand: 1,
      },
    },
  ],
  mage: [
    {
      id: 'pyromancer', name: 'Pyromancer', mythic: 'inferno', cards: {
        arcane_missiles: 4, arcane_focus: 3, arcane_barrier: 2, blink: 2, ignite: 4, fireball: 4, scorch: 3, frost_nova: 1,
        flamestrike: 2, arcane_blast: 1,
        dragons_breath: 1, meteor: 1, deep_freeze: 1,
        inferno: 1,
      },
    },
    {
      id: 'archmage', name: 'Archmage', mythic: 'ascendance', cards: {
        arcane_missiles: 4, arcane_focus: 4, arcane_barrier: 3, blink: 2, repulse: 2, ignite: 2, fireball: 3, frost_nova: 2,
        arcane_intellect: 2, arcane_blast: 2,
        arcane_surge: 1, arcane_power: 1, counterspell: 1,
        ascendance: 1,
      },
    },
    {
      id: 'cryomancer', name: 'Cryomancer', mythic: 'glacial_fortress', cards: {
        arcane_missiles: 4, arcane_focus: 3, arcane_barrier: 2, blink: 2, repulse: 1, ice_wall: 2, frost_nova: 4, fireball: 3, ignite: 1, scorch: 1,
        blizzard: 2, arcane_blast: 1,
        deep_freeze: 1, meteor: 1, arcane_surge: 1,
        glacial_fortress: 1,
      },
    },
  ],
  rogue: [
    {
      id: 'executioner', name: 'Executioner', mythic: 'death_mark', cards: {
        vanish: 3, shadowstep: 4, ambush: 3, shiv: 4, evasion: 1, kick: 2, fan_of_knives: 2, deadly_poison: 2, envenom: 2,
        cold_blood: 2, blade_flurry: 1,
        eviscerate: 1, killing_spree: 1, kidney_shot: 1,
        death_mark: 1,
      },
    },
    {
      id: 'plaguebringer', name: 'Plaguebringer', mythic: 'pandemic', cards: {
        shadowstep: 4, shiv: 3, envenom: 4, deadly_poison: 4, poison_vial: 3, vanish: 2, kick: 2,
        pickpocket: 2, cold_blood: 2,
        eviscerate: 1, kidney_shot: 1, adrenaline_rush: 1,
        pandemic: 1,
      },
    },
    {
      id: 'phantom', name: 'Phantom', mythic: 'nights_embrace', cards: {
        vanish: 4, shadowstep: 4, ambush: 4, shiv: 3, evasion: 2, kick: 2, fan_of_knives: 2, deadly_poison: 1,
        cold_blood: 2, blade_flurry: 1, riposte: 1,
        shadow_dance: 1, shadow_clone: 1, eviscerate: 1,
        nights_embrace: 1,
      },
    },
  ],
  ranger: [
    {
      id: 'marksman', name: 'Marksman', mythic: 'deadeye', cards: {
        steady_focus: 4, hawk_strike: 3, hunters_mark: 3, net: 2, disengage: 2, multi_shot: 3, power_shot: 4, freezing_trap: 2,
        rapid_fire: 2, light_footed: 1,
        kill_shot: 1, explosive_shot: 1, feign_death: 1,
        deadeye: 1,
      },
    },
    {
      id: 'trapper', name: 'Trapper', mythic: 'hunters_domain', cards: {
        freezing_trap: 3, explosive_trap: 4, power_shot: 3, hawk_strike: 4, multi_shot: 3, steady_focus: 3, net: 2, disengage: 1,
        tripwire: 2, rapid_fire: 1,
        explosive_shot: 1, minefield: 1, kill_shot: 1,
        hunters_domain: 1,
      },
    },
    {
      id: 'beastmaster', name: 'Beastmaster', mythic: 'call_of_the_wild', cards: {
        call_wolf: 3, hawk_strike: 2, steady_focus: 3, hunters_mark: 2, net: 3, disengage: 3, multi_shot: 2, power_shot: 1, freezing_trap: 2, explosive_trap: 2,
        spirit_bear: 1, rapid_fire: 1, light_footed: 1,
        kill_command: 1, bestial_wrath: 1, feign_death: 1,
        call_of_the_wild: 1,
      },
    },
  ],
  priest: [
    {
      id: 'lightbringer', name: 'Lightbringer', mythic: 'wrath_of_heaven', cards: {
        prayer: 3, flash_heal: 2, holy_fire: 4, penance: 4, power_word_shield: 2, hallowed_ground: 4, sanctuary: 2, shadow_word_pain: 2,
        wellspring: 2, holy_nova: 1,
        halo: 1, power_infusion: 1, shadow_word_death: 1,
        wrath_of_heaven: 1,
      },
    },
    {
      id: 'sanctifier', name: 'Sanctifier', mythic: 'holy_sanctum', cards: {
        prayer: 3, flash_heal: 3, holy_fire: 3, penance: 3, power_word_shield: 2, hallowed_ground: 3, sanctuary: 3, shadow_word_pain: 3,
        wellspring: 2, holy_wall: 1,
        aegis_field: 1, sacred_ground: 1, halo: 1,
        holy_sanctum: 1,
      },
    },
    {
      id: 'voidcaller', name: 'Voidcaller', mythic: 'shadowform', cards: {
        prayer: 2, flash_heal: 1, holy_fire: 3, penance: 3, power_word_shield: 2, shadow_word_pain: 4, devouring_plague: 4, desecrate: 3, hallowed_ground: 1,
        mind_sear: 1, hex: 1, wellspring: 1,
        void_rift: 1, shadow_word_death: 1, halo: 1,
        shadowform: 1,
      },
    },
  ],
};

/** Every ready-made deck for a class: the starter first, then the Mythic decks. */
export const presetsFor = (cls: ClassId): DeckPreset[] => [
  { id: 'starter', name: STARTER_NAME[cls], mythic: Object.keys(STARTERS[cls]).find(id => CARDS[id]?.rarity === 'mythic') ?? '', cards: STARTERS[cls] },
  ...MYTHIC_DECKS[cls],
];

/** A ready-made deck by id (falls back to the starter). */
export const presetDeck = (cls: ClassId, id: string): DeckCounts => ({ ...(presetsFor(cls).find(p => p.id === id) ?? presetsFor(cls)[0]).cards });
export const presetName = (cls: ClassId, id: string): string => (presetsFor(cls).find(p => p.id === id) ?? presetsFor(cls)[0]).name;

export const deckSize = (d: DeckCounts): number => Object.values(d).reduce((a, b) => a + b, 0);
export const countRarity = (d: DeckCounts, r: CardDef['rarity']): number =>
  Object.entries(d).reduce((a, [id, n]) => a + (CARDS[id]?.rarity === r ? n : 0), 0);

/** Can one more copy of this card be added? Returns a reason when not. */
export function canAdd(d: DeckCounts, card: CardDef): string | null {
  const have = d[card.id] ?? 0;
  if (deckSize(d) >= DECK_SIZE) return 'DECK IS FULL';
  if (have >= MAX_COPIES[card.rarity]) return `MAX ${MAX_COPIES[card.rarity]} COPIES`;
  if (card.rarity === 'legendary' && countRarity(d, 'legendary') >= MAX_LEGENDARIES) return `MAX ${MAX_LEGENDARIES} LEGENDARIES`;
  if (card.rarity === 'mythic' && countRarity(d, 'mythic') >= MYTHICS_REQUIRED) return 'ONLY 1 MYTHIC';
  return null;
}

export function validate(d: DeckCounts): string[] {
  const errs: string[] = [];
  const n = deckSize(d);
  if (n !== DECK_SIZE) errs.push(`NEEDS ${DECK_SIZE} SPELLS (HAS ${n})`);
  if (countRarity(d, 'mythic') !== MYTHICS_REQUIRED) errs.push('NEEDS EXACTLY 1 MYTHIC');
  if (countRarity(d, 'legendary') > MAX_LEGENDARIES) errs.push(`MAX ${MAX_LEGENDARIES} LEGENDARIES`);
  for (const [id, k] of Object.entries(d)) {
    const c = CARDS[id];
    if (c && k > MAX_COPIES[c.rarity]) errs.push(`TOO MANY ${c.name.toUpperCase()}`);
  }
  return errs;
}

export const toList = (d: DeckCounts): string[] => Object.entries(d).flatMap(([id, n]) => Array(n).fill(id));

export function loadCustom(cls: ClassId): DeckCounts | null {
  const saved = getSave('decks')[cls];
  if (!saved) return null;
  const d: DeckCounts = {};
  for (const [id, n] of Object.entries(saved)) if (CARDS[id]?.cls === cls) d[id] = n;
  return d;
}

export function saveCustom(cls: ClassId, d: DeckCounts): boolean {
  updateSave('decks', all => ({ ...all, [cls]: { ...d } }));
  return !saveIsReadOnly();
}
