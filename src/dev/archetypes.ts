// Deck pools for the balance sims: common archetypes per class (one per Mythic) and random legal decks.
// Archetypes are keyed by class id as a plain string so a class that is not in this build is skipped.
import { CARDS, ALL_CARDS, MAX_COPIES, type CardDef } from '../game/cards';
import { DECK_SIZE, MAX_LEGENDARIES, canAdd, validate, deckSize, starterDeck, type DeckCounts } from '../game/deck';
import { seeded, type Rng } from '../game/rng';
import type { ClassId } from '../art/sprites';
import { stylesFor } from '../game/playstyles';

export interface Archetype {
  id: string;
  name: string;
  /** One-line plan, shown in reports. */
  plan: string;
  /** Cards every build of this archetype runs (the Mythic included). */
  core: DeckCounts;
  /** Cards that fill the rest, best first. Fixed builds take them in order; variants pick by weight. */
  flex: string[];
}

export const ARCHETYPES: Record<string, Archetype[]> = {
  warrior: [
    {
      id: 'berserker', name: 'Berserker', plan: 'All-in damage: Rage spenders, Battle Shout, Avatar of War.',
      core: { step_slash: 4, lunge: 4, execute: 3, battle_shout: 3, chain_hook: 3, wide_cleave: 2, leap_strike: 2, rampage: 1, berserk: 1, mortal_strike: 1, rallying_cry: 1, avatar_of_war: 1 },
      flex: ['guard', 'iron_skin', 'shieldbreaker', 'shield_slam', 'ground_slam'],
    },
    {
      id: 'juggernaut', name: 'Juggernaut', plan: 'Block, build Rage off hits, survive with Last Stand.',
      core: { guard: 4, iron_skin: 4, shield_wall: 3, shieldbreaker: 3, execute: 3, intimidating_roar: 2, unbreakable: 1, shield_slam: 1, rallying_cry: 1, spell_reflection: 1, last_stand: 1 },
      flex: ['lunge', 'chain_hook', 'step_slash', 'wide_cleave', 'mortal_strike'],
    },
    {
      id: 'warlord', name: 'Warlord', plan: 'Grid control: hooks, stolen columns, holes, Titan\'s Fall.',
      core: { chain_hook: 4, lunge: 3, execute: 3, war_banner: 2, ground_slam: 2, seismic_wave: 2, wide_cleave: 2, guard: 2, ground_shatter: 1, shield_slam: 1, mortal_strike: 1, titans_fall: 1 },
      flex: ['step_slash', 'battle_shout', 'iron_skin', 'shieldbreaker', 'rampage'],
    },
  ],
  mage: [
    {
      id: 'pyromancer', name: 'Pyromancer', plan: 'Burn panels, then Scorch them; Inferno to finish.',
      core: { ignite: 4, fireball: 4, scorch: 4, arcane_missiles: 3, arcane_focus: 2, flamestrike: 2, ice_wall: 2, dragons_breath: 1, meteor: 1, comet_storm: 1, inferno: 1 },
      flex: ['arcane_barrier', 'blink', 'repulse', 'arcane_intellect', 'evocation'],
    },
    {
      id: 'cryomancer', name: 'Cryomancer', plan: 'Freeze locks into big hits; Glacial Fortress walls the row.',
      core: { frost_nova: 4, ice_wall: 3, repulse: 3, fireball: 3, arcane_missiles: 3, blizzard: 2, ice_block: 2, arcane_blast: 2, deep_freeze: 1, counterspell: 1, meteor: 1, glacial_fortress: 1 },
      flex: ['arcane_barrier', 'arcane_focus', 'blink', 'scorch', 'flamestrike'],
    },
    {
      id: 'arcanist', name: 'Arcanist', plan: 'Ramp Mana, then Ascendance doubles every spell.',
      core: { arcane_missiles: 4, arcane_focus: 4, arcane_barrier: 3, arcane_intellect: 2, arcane_blast: 2, fireball: 3, blink: 2, arcane_surge: 1, arcane_power: 1, evocation: 1, deep_freeze: 1, ascendance: 1 },
      flex: ['frost_nova', 'repulse', 'ice_wall', 'flamestrike', 'counterspell'],
    },
  ],
  rogue: [
    {
      id: 'assassin', name: 'Assassin', plan: 'Stealth openers into burst, Death Mark doubles down.',
      core: { shadowstep: 4, vanish: 3, ambush: 3, shiv: 4, cold_blood: 2, kick: 2, eviscerate: 1, kidney_shot: 1, killing_spree: 1, blind: 1, death_mark: 1 },
      flex: ['evasion', 'pickpocket', 'riposte', 'fan_of_knives', 'shadow_dance'],
    },
    {
      id: 'poisoner', name: 'Poisoner', plan: 'Stack Poison and cash it in; Pandemic makes it stick.',
      core: { poison_vial: 4, deadly_poison: 4, envenom: 4, shiv: 3, shadowstep: 3, fan_of_knives: 2, cloak_of_shadows: 2, eviscerate: 1, adrenaline_rush: 1, kidney_shot: 1, pandemic: 1 },
      flex: ['vanish', 'evasion', 'kick', 'pickpocket', 'killing_spree'],
    },
    {
      id: 'shadow', name: 'Shadow', plan: 'Live in Stealth: Shadow Dance, decoys, Night\'s Embrace.',
      core: { vanish: 4, ambush: 4, shadowstep: 4, evasion: 2, shiv: 3, cold_blood: 2, shadow_dance: 1, smokescreen: 1, shadow_clone: 1, blind: 1, eviscerate: 1, nights_embrace: 1 },
      flex: ['kick', 'pickpocket', 'riposte', 'killing_spree', 'fan_of_knives'],
    },
  ],
  ranger: [
    {
      id: 'marksman', name: 'Marksman', plan: 'Stand still, charge big shots; Deadeye turret.',
      core: { steady_focus: 4, power_shot: 4, hunters_mark: 3, hawk_strike: 3, multi_shot: 3, net: 2, rapid_fire: 2, kill_shot: 1, explosive_shot: 1, feign_death: 1, deadeye: 1 },
      flex: ['disengage', 'freezing_trap', 'volley', 'call_wolf', 'barrage'],
    },
    {
      id: 'trapper', name: 'Trapper', plan: 'Mine the enemy area; Hunter\'s Domain traps every panel.',
      core: { freezing_trap: 4, explosive_trap: 4, hawk_strike: 3, net: 3, power_shot: 3, tripwire: 2, volley: 2, minefield: 1, explosive_shot: 1, kill_shot: 1, hunters_domain: 1 },
      flex: ['steady_focus', 'disengage', 'multi_shot', 'barrage', 'wyvern_sting'],
    },
    {
      id: 'beastmaster', name: 'Beastmaster', plan: 'Wolves, hawk and bear do the work; Call of the Wild.',
      core: { call_wolf: 4, hawk_strike: 4, steady_focus: 3, net: 2, multi_shot: 3, spirit_bear: 2, kill_command: 1, bestial_wrath: 1, kill_shot: 1, feign_death: 1, call_of_the_wild: 1 },
      flex: ['power_shot', 'disengage', 'freezing_trap', 'hunters_mark', 'wyvern_sting'],
    },
  ],
  priest: [
    {
      id: 'shadow', name: 'Shadow', plan: 'DoTs and cursed panels; Shadowform doubles the ticks.',
      core: { shadow_word_pain: 4, devouring_plague: 4, desecrate: 4, prayer: 2, flash_heal: 2, hex: 2, mind_sear: 2, void_rift: 1, psychic_scream: 1, shadow_word_death: 1, shadowform: 1 },
      flex: ['penance', 'power_word_shield', 'holy_fire', 'sanctuary', 'halo'],
    },
    {
      id: 'holy', name: 'Holy', plan: 'Direct holy damage from a blessed panel; Wrath of Heaven.',
      core: { holy_fire: 4, penance: 4, hallowed_ground: 3, flash_heal: 3, prayer: 2, holy_nova: 2, shadow_word_pain: 2, halo: 1, shadow_word_death: 1, psychic_scream: 1, wrath_of_heaven: 1 },
      flex: ['power_word_shield', 'sanctuary', 'wellspring', 'devouring_plague', 'void_rift'],
    },
    {
      id: 'sanctum', name: 'Sanctum', plan: 'Out-heal and out-shield, win the long game with Holy Sanctum.',
      core: { power_word_shield: 4, flash_heal: 3, sanctuary: 3, prayer: 2, holy_fire: 3, penance: 3, wellspring: 2, shadow_word_pain: 2, aegis_field: 1, sacred_ground: 1, divine_hymn: 1, halo: 1, holy_sanctum: 1 },
      flex: ['hallowed_ground', 'devouring_plague', 'holy_wall', 'hex', 'power_infusion'],
    },
  ],
};

/** Archetypes whose cards all exist in this build. */
export function archetypesFor(cls: ClassId): Archetype[] {
  return (ARCHETYPES[cls] ?? []).filter(a => Object.keys(a.core).every(id => CARDS[id]?.cls === cls));
}

const classCards = (cls: ClassId): CardDef[] => ALL_CARDS.filter(c => c.cls === cls);

function addOne(d: DeckCounts, id: string): boolean {
  const c = CARDS[id];
  if (!c || canAdd(d, c)) return false;
  d[id] = (d[id] ?? 0) + 1;
  return true;
}

/** Fill to 30 from `ids`, one copy at a time, cycling in order (fixed) or by random pick (variant). */
function fill(d: DeckCounts, ids: string[], rand?: Rng): void {
  let open = ids.filter(id => CARDS[id]);
  while (deckSize(d) < DECK_SIZE && open.length) {
    const i = rand ? Math.floor(rand() * open.length) : 0;
    const id = open[i];
    if (!addOne(d, id)) { open.splice(i, 1); continue; }
    // fixed builds take a card up to its copy limit before moving to the next one
    if (rand && (d[id] ?? 0) >= MAX_COPIES[CARDS[id].rarity]) open.splice(i, 1);
  }
}

/** Builds a legal deck for an archetype. Without a generator it is the archetype's fixed reference list. */
export function buildArchetype(cls: ClassId, a: Archetype, rand?: Rng): DeckCounts {
  const d: DeckCounts = {};
  for (const [id, n] of Object.entries(a.core)) for (let i = 0; i < n; i++) addOne(d, id);
  fill(d, a.flex, rand);
  // still short (a card in flex is missing from this build): top up from the class's commons and uncommons
  fill(d, classCards(cls).filter(c => c.rarity === 'common' || c.rarity === 'uncommon').map(c => c.id), rand);
  return d;
}

/** A random legal deck: 1 random Mythic, 0-5 random Legendaries, the rest random commons and uncommons. */
export function randomDeck(cls: ClassId, rand: Rng): DeckCounts {
  const pool = classCards(cls);
  const pick = <T>(xs: T[]): T => xs[Math.floor(rand() * xs.length)];
  const d: DeckCounts = {};
  addOne(d, pick(pool.filter(c => c.rarity === 'mythic')).id);
  const legs = pool.filter(c => c.rarity === 'legendary');
  const nLeg = Math.floor(rand() * (MAX_LEGENDARIES + 1));
  for (let i = 0; i < nLeg && legs.length; i++) addOne(d, legs.splice(Math.floor(rand() * legs.length), 1)[0].id);
  // 6-10 distinct commons/uncommons, then fill with copies of those so decks look like real lists
  const rest = pool.filter(c => c.rarity === 'common' || c.rarity === 'uncommon').map(c => c.id);
  const picks: string[] = [];
  const nPick = 6 + Math.floor(rand() * 5);
  while (picks.length < nPick && rest.length) picks.push(rest.splice(Math.floor(rand() * rest.length), 1)[0]);
  fill(d, picks, rand);
  fill(d, rest, rand);
  return d;
}

export interface PoolDeck { cls: ClassId; key: string; name: string; deck: DeckCounts; /** CPU playstyle id (default: balanced). */ style?: string }

export type PoolKind = 'starter' | 'archetype' | 'variant' | 'random' | 'style' | 'style-starter';

/**
 * Decks for one class. `starter` = the shipped starter, `archetype` = each archetype's fixed list,
 * `variant` = `k` random builds of each archetype, `random` = `k` random legal decks,
 * `style` = each CPU playstyle with its matching archetype, `style-starter` = each playstyle with the starter.
 */
export function deckPool(cls: ClassId, kind: PoolKind, k: number, seed: number): PoolDeck[] {
  const rand = seeded(seed);
  const out: PoolDeck[] = [];
  if (kind === 'starter') out.push({ cls, key: `${cls}:starter`, name: 'Starter', deck: starterDeck(cls) });
  if (kind === 'archetype') for (const a of archetypesFor(cls)) out.push({ cls, key: `${cls}:${a.id}`, name: a.name, deck: buildArchetype(cls, a) });
  if (kind === 'variant') {
    for (const a of archetypesFor(cls)) for (let i = 0; i < k; i++) out.push({ cls, key: `${cls}:${a.id}#${i + 1}`, name: `${a.name} #${i + 1}`, deck: buildArchetype(cls, a, rand) });
  }
  if (kind === 'style' || kind === 'style-starter') {
    for (const s of stylesFor(cls)) {
      const a = archetypesFor(cls).find(x => x.id === s.deck);
      const deck = kind === 'style' && a ? buildArchetype(cls, a) : starterDeck(cls);
      out.push({ cls, key: `${cls}:${s.id.replace(`${cls}_`, '')}`, name: s.name, deck, style: s.id });
    }
  }
  if (kind === 'random') for (let i = 0; i < k; i++) out.push({ cls, key: `${cls}:random#${i + 1}`, name: `Random #${i + 1}`, deck: randomDeck(cls, rand) });
  for (const p of out) {
    const errs = validate(p.deck);
    if (errs.length) throw new Error(`${p.key} is not a legal deck: ${errs.join(', ')}`);
  }
  return out;
}

/** The Mythic a deck runs, for grouping results. */
export const mythicOf = (d: DeckCounts): string => Object.keys(d).find(id => CARDS[id]?.rarity === 'mythic') ?? '-';
