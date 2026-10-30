// The one engine surface that built-in content (class spells, later rules and stages) imports from. Keeping it
// narrow is what lets a class live in its own folder; data-only mods never import code at all.
export type { Battle, BlessKind, CastCtx, Fighter, HitOpts, HitResult, Pet, Side, Trap } from '../game/battle';
export { basicShot, panOf } from '../game/shots';
export type { ClassRules } from './classes/registry';
export type { CardDef, Element, Rarity } from '../game/cards';
export { TUNING } from '../game/tuning';
export { shuffle } from '../game/rng';
export { sameRow, ahead, cellsAhead, allEnemyPanels, lowHp, lunge, targeted } from '../game/cardUtil';
export { effect, spellStep, type EffectRec, type ShotHit } from './effects';
