// The class registry. A class module is one folder under content/classes/: its rules (how its resource
// starts, fills and caps, and what its light and heavy attacks do), its ready-made decks, how the CPU plays
// it, and its tutorial lessons. Its spells live beside them in cards.ts. Registration order is the roster
// order, so built-ins register in a fixed order, mods after.
//
// Nothing here holds state: anything rules change lives on the Fighter or the Battle, so rollback snapshots
// and replays see it.
import type { Battle, Fighter } from '../../game/battle';
import type { DeckCounts, DeckPreset } from '../../game/deck';
import type { Playstyle } from '../../game/playstyles';
import { Registry } from '../registry';

export interface ClassModule {
  id: string;
  /** Name, resource and its colors, for the HUD, cards and menus. */
  info: ClassInfo;
  rules: ClassRules;
  decks: ClassDecks;
  cpu: ClassCpu;
  lessons: ClassLessons;
}

/** Per-class labels and resource colors, shared by the HUD, cards and menus. */
export interface ClassInfo {
  name: string;
  /** Resource name as shown on cards and the HUD. */
  res: 'RAGE' | 'MANA' | 'ENERGY';
  /** Text color for the resource. */
  resColor: string;
  /** Cost gem color. */
  gem: string;
  /** Empty and filled pip colors. */
  pipBase: string;
  pip: string;
  /** How the resource comes back, shown on the Draw screen. */
  refill: string;
}

/** What the battle engine asks a class. */
export interface ClassRules {
  /** Resource at the start of a match, and its starting max (read when the fighter is made). */
  startRes(): number;
  startResMax(): number;
  /** What the resource can grow to (`cap`) and holds right now (`max`), for Draw-screen cost planning. */
  pool(f: Fighter): { cap: number; max: number };
  /** The light attack (tap) or heavy attack (charged): sets f.lock and does the hit. */
  basic(b: Battle, f: Fighter, kind: 'light' | 'heavy'): void;
  /** Each Draw screen, before the hand is dealt. b.turn is already the new turn. */
  onDraw?(b: Battle, f: Fighter): void;
  /** Every fight frame while the fighter is alive. */
  tick?(b: Battle, f: Fighter, dt: number): void;
  /** After the fighter takes `amt` damage. */
  onHurt?(b: Battle, f: Fighter, amt: number): void;
  /** Rage-like gain from hits and walls; classes without it leave this out and the gain does nothing. */
  gainRage?(b: Battle, f: Fighter, amt: number, fromCard: boolean): void;
  /** Resource from a card or effect. Left out: up to f.resMax, with a pip sound. */
  gainRes?(b: Battle, f: Fighter, amt: number): void;
}

/** The ready-made decks offered on the character select. */
export interface ClassDecks {
  starterName: string;
  starter: DeckCounts;
  /** One deck per Mythic, after the starter. */
  mythic: DeckPreset[];
}

/** How the CPU plays the class. */
export interface ClassCpu {
  /** Three playstyles, one per temperament (aggro first: Easy plays it). */
  styles: Playstyle[];
  /** Hard's style id against each player class. */
  counter: Partial<Record<string, string>>;
  /** Would the light / heavy attack hit `foe` from here? `dist` counts columns toward the foe; `seen` is false while it is stealthed. */
  reach(b: Battle, f: Fighter, foe: Fighter, dist: number, aligned: boolean, seen: boolean): { light: boolean; heavy: boolean };
  /** Damage and resource come from steady taps, so Hard doesn't charge extra heavies. */
  taps?: boolean;
  /** Wind up the heavy when it reaches and the light doesn't. */
  windup?: boolean;
  /** Chance per second to hold the panel instead of repositioning (0: move as usual). */
  stay?(b: Battle, f: Fighter, aligned: boolean, seen: boolean): number;
}

/** One page of tutorial text. */
export interface LessonPage { title: string; body: string[] }

/** What changes per class: how the basics reach, how the resource works, and the spells shown off. */
export interface ClassLessons {
  /** The dummy's home column: in reach of the class's light attack from the player's front column. */
  dummyCol: number;
  /** Hand dealt on the tutorial's Draw screen: cheap spells that show off cost, order and aiming. */
  hand: string[];
  tryText: string;
  light: string[];
  lightTip: string;
  /** Heavy lesson: how this class gets its resource. */
  resLine: string;
  heavyTip: string;
  /** Point at the resource meter during the heavy lesson (it fills from fighting). */
  pointRes: boolean;
  dodgeLine?: string;
  spend: LessonPage;
  castLine: string;
  /** Goal tip when the next spell can't be paid for. */
  short: string;
  /** The resource only comes back at the next Draw: a full queue can strand the player. */
  refillsAtDraw: boolean;
  ccLine: string;
}

export const CLASSES = new Registry<ClassModule>('class');
export const registerClass = (m: ClassModule): ClassModule => CLASSES.register(m);

/** The module for class `id`. */
export function classModule(id: string): ClassModule {
  const m = CLASSES.get(id);
  if (!m) throw new Error(`unknown class '${id}'`);
  return m;
}
/** The battle rules for class `id`. */
export const classRules = (id: string): ClassRules => classModule(id).rules;
