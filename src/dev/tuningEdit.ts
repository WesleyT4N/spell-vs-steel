// Live editing of TUNING and CARD_POWER for the dev tools. Edits last until the page reloads.
import { TUNING } from '../game/tuning';
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

/** Everything that differs from the shipped numbers. */
export function overrides(): { tuning: Record<string, number>; cardPower: Record<string, number> } {
  const tuning: Record<string, number> = {};
  for (const p of tuningPaths()) if (getTuning(p) !== DEFAULTS[p]) tuning[p] = getTuning(p);
  return { tuning, cardPower: { ...CARD_POWER } };
}

export const isModified = (): boolean => {
  const o = overrides();
  return Object.keys(o.tuning).length > 0 || Object.keys(o.cardPower).length > 0;
};

export function resetAll(): void {
  for (const p of tuningPaths()) if (getTuning(p) !== DEFAULTS[p]) setTuningRaw(p, DEFAULTS[p]);
  for (const id of Object.keys(CARD_POWER)) delete CARD_POWER[id];
  changed();
}

/** Apply a JSON blob made by overrides() (pasted back in). Returns how many values it set. */
export function applyOverrides(o: { tuning?: Record<string, number>; cardPower?: Record<string, number> }): number {
  let n = 0;
  for (const [p, v] of Object.entries(o.tuning ?? {})) if (p in DEFAULTS && typeof v === 'number') { setTuningRaw(p, v); n++; }
  for (const [id, v] of Object.entries(o.cardPower ?? {})) if (typeof v === 'number') { CARD_POWER[id] = v; n++; }
  changed();
  return n;
}

function setTuningRaw(path: string, v: number): void {
  const keys = path.split('.');
  const last = keys.pop()!;
  (keys.reduce<unknown>((o, k) => (o as Tree)[k], TUNING) as Tree)[last] = v;
}

const listeners = new Set<() => void>();
export const onTuningChange = (fn: () => void): (() => void) => { listeners.add(fn); return () => listeners.delete(fn); };
function changed(): void { for (const fn of listeners) fn(); }
