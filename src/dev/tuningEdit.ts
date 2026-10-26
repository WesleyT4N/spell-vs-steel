// Live editing of TUNING, CARD_POWER and card costs for the dev tools. Edits last until the page reloads.
import { TUNING } from '../game/tuning';
import { CARDS, type CardDef } from '../game/cards';
import { CARD_POWER } from './instrument';

type Tree = Record<string, unknown>;

/** Every numeric knob in TUNING as a dotted path, in file order. */
export function tuningPaths(): string[] {
  const out: string[] = [];
  const walk = (o: Tree, pre: string): void => {
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'number') out.push(pre + k);
      else if (v && typeof v === 'object') walk(v as Tree, `${pre}${k}.`);
    }
  };
  walk(TUNING as unknown as Tree, '');
  return out;
}

export function getTuning(path: string): number {
  return path.split('.').reduce<unknown>((o, k) => (o as Tree)[k], TUNING) as number;
}

export function setTuning(path: string, v: number): void {
  setTuningRaw(path, v);
  changed();
}

const DEFAULTS: Record<string, number> = Object.fromEntries(tuningPaths().map(p => [p, getTuning(p)]));
export const defaultTuning = (path: string): number => DEFAULTS[path];

export function setPower(id: string, v: number): void {
  if (v === 1) delete CARD_POWER[id]; else CARD_POWER[id] = v;
  changed();
}

/** Shipped costs, so a cost edit can be undone. */
const COSTS: Record<string, CardDef['cost']> = Object.fromEntries(Object.values(CARDS).map(c => [c.id, c.cost]));
export const defaultCost = (id: string): CardDef['cost'] => COSTS[id];

export function setCost(id: string, v: CardDef['cost']): void {
  if (!CARDS[id]) return;
  CARDS[id].cost = v;
  changed();
}

export interface Overrides { tuning: Record<string, number>; cardPower: Record<string, number>; cardCost?: Record<string, number> }

/** Everything that differs from the shipped numbers. */
export function overrides(): Overrides {
  const tuning: Record<string, number> = {};
  for (const p of tuningPaths()) if (getTuning(p) !== DEFAULTS[p]) tuning[p] = getTuning(p);
  const cardCost: Record<string, number> = {};
  for (const c of Object.values(CARDS)) if (c.cost !== COSTS[c.id] && typeof c.cost === 'number') cardCost[c.id] = c.cost;
  return { tuning, cardPower: { ...CARD_POWER }, cardCost };
}

export const overrideCount = (o: Overrides = overrides()): number =>
  Object.keys(o.tuning).length + Object.keys(o.cardPower).length + Object.keys(o.cardCost ?? {}).length;

export const isModified = (): boolean => overrideCount() > 0;

function resetRaw(): void {
  for (const p of tuningPaths()) if (getTuning(p) !== DEFAULTS[p]) setTuningRaw(p, DEFAULTS[p]);
  for (const id of Object.keys(CARD_POWER)) delete CARD_POWER[id];
  for (const c of Object.values(CARDS)) c.cost = COSTS[c.id];
}

export function resetAll(): void {
  resetRaw();
  changed();
}

/** Apply a blob made by overrides() on top of the current numbers. Returns how many values it set. */
export function applyOverrides(o: Partial<Overrides>): number {
  let n = 0;
  for (const [p, v] of Object.entries(o.tuning ?? {})) if (p in DEFAULTS && typeof v === 'number') { setTuningRaw(p, v); n++; }
  for (const [id, v] of Object.entries(o.cardPower ?? {})) if (typeof v === 'number') { CARD_POWER[id] = v; n++; }
  for (const [id, v] of Object.entries(o.cardCost ?? {})) if (CARDS[id] && typeof v === 'number') { CARDS[id].cost = v; n++; }
  changed();
  return n;
}

/** Back to the shipped numbers, then apply `o` (a script run replaces earlier edits instead of stacking). */
export function replaceOverrides(o: Partial<Overrides>): number {
  resetRaw();
  return applyOverrides(o);
}

function setTuningRaw(path: string, v: number): void {
  const keys = path.split('.');
  const last = keys.pop()!;
  (keys.reduce<unknown>((o, k) => (o as Tree)[k], TUNING) as Tree)[last] = v;
}

const listeners = new Set<() => void>();
export const onTuningChange = (fn: () => void): (() => void) => { listeners.add(fn); return () => listeners.delete(fn); };
function changed(): void { for (const fn of listeners) fn(); }
