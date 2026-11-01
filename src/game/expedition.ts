// Expedition: the roguelike run. Three acts (the Forest, the Crypt, the Volcano), each a seeded branching map of
// fights, elites, rest stops and a shop with a boss on top; a spell deck drafted as you go, gold and relics.
// A run lives in memory only (no saving mid-run yet).
import { CARDS, MAX_COPIES, type CardDef } from './cards';
import { starterDeck, deckSize, countRarity, toList, DECK_SIZE, MAX_LEGENDARIES, type DeckCounts } from './deck';
import { seeded, randomSeed } from './rng';
import { TUNING } from './tuning';
import type { ClassId } from '../art/sprites';
import { Battle } from './battle';
import { setupPack } from './mobs';

export type NodeKind = 'fight' | 'elite' | 'rest' | 'shop' | 'boss';

export interface MapNode {
  id: number;
  floor: number;
  /** Lane 0..2, left to right. */
  lane: number;
  kind: NodeKind;
  /** Ids of the nodes on the next floor this one leads to. */
  next: number[];
  /** Monster ids for fight, elite and boss nodes. */
  pack: string[];
}

export interface Relic { id: string; name: string; text: string }
export const RELICS: Relic[] = [
  { id: 'heartwood', name: 'HEARTWOOD', text: '+10% MAX HP' },
  { id: 'whetstone', name: 'WHETSTONE', text: 'YOU DEAL +10% DAMAGE' },
  { id: 'ironbark', name: 'IRONBARK', text: 'START FIGHTS WITH A 400 SHIELD' },
  { id: 'drum', name: 'BATTLE DRUM', text: 'START FIGHTS WITH +2 RESOURCE' },
  { id: 'tally', name: "HUNTER'S TALLY", text: '+5 GOLD AFTER EVERY FIGHT' },
  { id: 'sapflask', name: 'SAP FLASK', text: 'HEAL 5% AFTER EVERY FIGHT' },
  { id: 'clover', name: 'LUCKY CLOVER', text: 'SPELL REWARDS SHOW 4 CHOICES' },
  { id: 'moonwell', name: 'MOONWELL', text: 'REST STOPS HEAL 50%' },
];
export const relicOf = (id: string): Relic => RELICS.find(r => r.id === id) ?? RELICS[0];

export const FLOORS = 7;
export const BOSS_FLOOR = FLOORS;
export const PRICE = { common: 40, uncommon: 70, legendary: 150, relic: 120, remove: 60 };
export const REST_HEAL = 0.3;

export interface RunStats { fights: number; elites: number; kills: number; dealt: number; taken: number; secs: number; floors: number }

export interface ExpeditionRun {
  cls: ClassId;
  skin: string;
  seed: number;
  /** 0 the Forest, 1 the Crypt, 2 the Volcano. */
  act: number;
  map: MapNode[];
  /** The node you stand on (-1 before the first floor). */
  at: number;
  /** Nodes already cleared, in order. */
  path: number[];
  hp: number;
  maxHp: number;
  gold: number;
  deck: DeckCounts;
  relics: string[];
  removeCost: number;
  stats: RunStats;
  /** Rolls for rewards and shops, apart from the map's so a map plays the same whatever you buy. */
  roll: () => number;
  /** How the run ended. */
  over: '' | 'dead' | 'won';
}

export const has = (run: ExpeditionRun, relic: string): boolean => run.relics.includes(relic);

/**
 * The Expedition starter: about half of the class starter's commons, 10 spells. No Legendary or Mythic: those
 * are found on the way.
 */
export function expeditionStarter(cls: ClassId): DeckCounts {
  const out: DeckCounts = {};
  let n = 0;
  for (const [id, k] of Object.entries(starterDeck(cls))) {
    if (CARDS[id]?.rarity !== 'common' || n >= 10) continue;
    const take = Math.min(10 - n, Math.max(1, Math.floor(k / 2)));
    out[id] = take;
    n += take;
  }
  return out;
}

// ---------- the map ----------

/** One act: its stage, its packs (early floors, later floors, elites) and its boss. */
export interface Act { id: string; name: string; stage: string; early: string[][]; late: string[][]; elites: string[][]; boss: string }

export const ACTS: Act[] = [
  {
    id: 'forest', name: 'THE FOREST', stage: 'elderwood', boss: 'oakheart',
    early: [['stumpkin'], ['wolf'], ['stumpkin', 'webspinner'], ['wolf', 'wolf'], ['stumpkin', 'stumpkin']],
    late: [['stumpkin', 'webspinner', 'wolf'], ['barkguard', 'wisp'], ['barkguard', 'stumpkin', 'wisp'], ['wolf', 'wolf', 'webspinner'], ['webspinner', 'stumpkin', 'wisp']],
    elites: [['alpha'], ['thornmother']],
  },
  {
    id: 'crypt', name: 'THE CRYPT', stage: 'crypt', boss: 'boneking',
    early: [['skelarcher', 'rattler'], ['rattler', 'rattler'], ['ghoul', 'skelarcher'], ['ghoul', 'rattler'], ['skelarcher', 'skelarcher']],
    late: [['ghoul', 'banshee', 'rattler'], ['gravebell', 'ghoul', 'skelarcher'], ['banshee', 'skelarcher', 'skelarcher'], ['gravebell', 'rattler', 'rattler'], ['banshee', 'ghoul', 'ghoul']],
    elites: [['deathknight'], ['colossus']],
  },
  {
    id: 'volcano', name: 'THE VOLCANO', stage: 'emberforge', boss: 'emberwyrm',
    early: [['salamander', 'imp'], ['imp', 'imp'], ['salamander', 'emberbat'], ['golem'], ['emberbat', 'emberbat']],
    late: [['golem', 'imp', 'shaman'], ['salamander', 'salamander', 'shaman'], ['emberbat', 'emberbat', 'imp'], ['golem', 'emberbat', 'imp'], ['shaman', 'salamander', 'imp']],
    elites: [['drakerider'], ['titan']],
  },
];
export const actOf = (run: ExpeditionRun): Act => ACTS[run.act] ?? ACTS[0];
/** The Forest's packs (kept for the screens and the balance check). */
export const EARLY = ACTS[0].early, LATE = ACTS[0].late, ELITES = ACTS[0].elites;
const pick = <T>(list: T[], rand: () => number): T => list[Math.floor(rand() * list.length)];

/**
 * Seven floors, three lanes, the boss above. Each node leads to the one straight above and sometimes a
 * neighbor; every node can be reached. Floor 1 is all fights, the floor under the boss all rest stops.
 */
export function makeMap(seed: number, act = 0): MapNode[] {
  const A = ACTS[act] ?? ACTS[0];
  const rand = seeded((seed + act * 7919) ^ 0x5eed);
  const nodes: MapNode[] = [];
  const grid: MapNode[][] = [];
  let elites = 0, shop = false;
  for (let fl = 0; fl < FLOORS; fl++) {
    grid[fl] = [];
    for (let lane = 0; lane < 3; lane++) {
      let kind: NodeKind = 'fight';
      if (fl === FLOORS - 1) kind = 'rest';
      else if (fl >= 2) {
        const r = rand();
        if (!shop && fl <= 4 && r < 0.2) { kind = 'shop'; shop = true; }
        else if (elites < 2 && fl >= 2 && r > 0.72) { kind = 'elite'; elites++; }
        else if (fl === 3 && r < 0.38) kind = 'rest';
      }
      const pack = kind === 'fight' ? pick(fl < 3 ? A.early : A.late, rand).slice() : kind === 'elite' ? pick(A.elites, rand).slice() : [];
      const n: MapNode = { id: nodes.length, floor: fl, lane, kind, next: [], pack };
      nodes.push(n);
      grid[fl].push(n);
    }
  }
  // make sure the act has its shop and at least one elite
  if (!shop) { const n = grid[3][Math.floor(rand() * 3)]; n.kind = 'shop'; n.pack = []; }
  if (!nodes.some(n => n.kind === 'elite')) { const n = grid[4][Math.floor(rand() * 3)]; n.kind = 'elite'; n.pack = pick(A.elites, rand).slice(); }
  const boss: MapNode = { id: nodes.length, floor: BOSS_FLOOR, lane: 1, kind: 'boss', next: [], pack: [A.boss] };
  nodes.push(boss);
  for (let fl = 0; fl < FLOORS - 1; fl++) {
    for (const n of grid[fl]) {
      n.next.push(grid[fl + 1][n.lane].id);
      const side = n.lane === 0 ? 1 : n.lane === 2 ? -1 : rand() < 0.5 ? -1 : 1;
      if (rand() < 0.5) n.next.push(grid[fl + 1][n.lane + side].id);
    }
  }
  for (const n of grid[FLOORS - 1]) n.next.push(boss.id);
  return nodes;
}

/** The nodes you may step to next. */
export function choices(run: ExpeditionRun): MapNode[] {
  if (run.at < 0) return run.map.filter(n => n.floor === 0);
  return run.map[run.at].next.map(id => run.map[id]);
}

export function newRun(cls: ClassId, skin: string, seed = randomSeed()): ExpeditionRun {
  const maxHp = TUNING.hp[cls];
  return {
    cls, skin, seed, act: 0, map: makeMap(seed, 0), at: -1, path: [],
    hp: maxHp, maxHp, gold: 50, deck: expeditionStarter(cls), relics: [], removeCost: PRICE.remove,
    stats: { fights: 0, elites: 0, kills: 0, dealt: 0, taken: 0, secs: 0, floors: 0 },
    roll: seeded(seed ^ 0xa11),
    over: '',
  };
}

/** After an act's boss: the next act's map, and a full heal. False after the last act (the run is won). */
export function nextAct(run: ExpeditionRun): boolean {
  if (run.act >= ACTS.length - 1) return false;
  run.act++;
  run.map = makeMap(run.seed, run.act);
  run.at = -1;
  run.path = [];
  run.hp = run.maxHp;
  return true;
}

/** Floors in the whole run, and floors cleared so far (for the run-over stats). */
export const RUN_FLOORS = ACTS.length * (BOSS_FLOOR + 1);

// ---------- rewards ----------

/** Can one more copy of `card` go into the run's deck? */
export function canTake(run: ExpeditionRun, card: CardDef): boolean {
  const have = run.deck[card.id] ?? 0;
  if (deckSize(run.deck) >= DECK_SIZE || have >= MAX_COPIES[card.rarity]) return false;
  if (card.rarity === 'legendary' && countRarity(run.deck, 'legendary') >= MAX_LEGENDARIES) return false;
  return card.rarity !== 'mythic';
}

/** Spell choices after a win: common/uncommon odds by node, Legendaries from the boss. No repeats. */
export function spellChoices(run: ExpeditionRun, kind: NodeKind, n = has(run, 'clover') ? 4 : 3): string[] {
  const pool = Object.values(CARDS).filter(c => c.cls === run.cls && canTake(run, c));
  const out: string[] = [];
  for (let tries = 0; out.length < n && tries < 80; tries++) {
    const r = run.roll();
    const rarity = kind === 'boss' ? 'legendary' : kind === 'elite' ? (r < 0.5 ? 'common' : r < 0.9 ? 'uncommon' : 'legendary') : r < 0.7 ? 'common' : 'uncommon';
    const of = pool.filter(c => c.rarity === rarity && !out.includes(c.id));
    const from = of.length ? of : pool.filter(c => !out.includes(c.id) && c.rarity !== 'legendary');
    if (!from.length) break;
    out.push(pick(from, run.roll).id);
  }
  return out;
}

export function goldFor(run: ExpeditionRun, kind: NodeKind): number {
  const base = kind === 'boss' ? 100 : kind === 'elite' ? 40 : 15 + Math.floor(run.roll() * 11);
  return base + (has(run, 'tally') ? 5 : 0);
}

/** A relic you don't have yet (null when you have them all). */
export function rollRelic(run: ExpeditionRun, not: string[] = []): string | null {
  const left = RELICS.filter(r => !run.relics.includes(r.id) && !not.includes(r.id));
  return left.length ? pick(left, run.roll).id : null;
}

export function addRelic(run: ExpeditionRun, id: string): void {
  if (run.relics.includes(id)) return;
  run.relics.push(id);
  if (id === 'heartwood') {
    const more = Math.round(run.maxHp * 0.1);
    run.maxHp += more;
    run.hp += more;
  }
}

export function addSpell(run: ExpeditionRun, id: string): void { run.deck[id] = (run.deck[id] ?? 0) + 1; }
export function removeSpell(run: ExpeditionRun, id: string): void {
  if (!run.deck[id]) return;
  run.deck[id]--;
  if (!run.deck[id]) delete run.deck[id];
}
export const deckList = (run: ExpeditionRun): string[] => toList(run.deck);
export const heal = (run: ExpeditionRun, share: number): number => {
  const before = run.hp;
  run.hp = Math.min(run.maxHp, run.hp + Math.round(run.maxHp * share));
  return run.hp - before;
};

export interface ShopItem { kind: 'spell' | 'relic' | 'remove'; id: string; price: number; sold: boolean }

/** Three spells (two commons, an uncommon or Legendary), two relics, and a spell removal. */
export function stock(run: ExpeditionRun): ShopItem[] {
  const pool = Object.values(CARDS).filter(c => c.cls === run.cls && canTake(run, c));
  const items: ShopItem[] = [];
  const add = (rarity: CardDef['rarity']): void => {
    const of = pool.filter(c => c.rarity === rarity && !items.some(i => i.id === c.id));
    if (of.length) { const c = pick(of, run.roll); items.push({ kind: 'spell', id: c.id, price: PRICE[rarity as 'common'] ?? 40, sold: false }); }
  };
  add('common'); add('common'); add(run.roll() < 0.35 ? 'legendary' : 'uncommon');
  const r1 = rollRelic(run), r2 = rollRelic(run, r1 ? [r1] : []);
  for (const r of [r1, r2]) if (r) items.push({ kind: 'relic', id: r, price: PRICE.relic, sold: false });
  items.push({ kind: 'remove', id: 'remove', price: run.removeCost, sold: false });
  return items;
}

// ---------- fights ----------

/**
 * A fight for the run: your fighter with the run's deck and HP against a pack. Relics that act in battle
 * are applied here. The right-hand fighter the Battle builds is replaced by the pack.
 */
export function makeFight(run: ExpeditionRun, pack: string[], seed = randomSeed(), tier = 1): Battle {
  const b = new Battle({ cls: run.cls, deck: deckList(run), name: 'YOU', skin: run.skin }, { cls: run.cls === 'warrior' ? 'mage' : 'warrior', deck: [], name: 'PACK' }, seed);
  setupPack(b, pack, tier);
  const me = b.f[0];
  me.maxHp = run.maxHp;
  me.hp = Math.max(1, run.hp);
  if (has(run, 'whetstone')) me.power = 1.1;
  if (has(run, 'ironbark')) b.addShield(me, 'barrier', 400, 30);
  if (has(run, 'drum')) me.res = Math.min(Math.max(me.resMax, 5), me.res + 2);
  return b;
}
