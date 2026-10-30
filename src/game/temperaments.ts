// The three CPU temperaments. Each class's styles (content/classes/<id>/cpu.ts) start from one and add their flavor.
// Kept apart from playstyles.ts so class modules can use them without a load-order cycle.

/** The standard CPU's knobs. */
export const BASE = { dodge: 1, evade: 0, attack: 1, range: 0 as const, patience: 1, eager: 0, bigMin: 4, prefer: { damage: 0, defense: 0, control: 0, setup: 0 } };
export const AGGRO = { ...BASE, kind: 'aggro' as const, dodge: 0.6, attack: 1.4, range: 1 as const, patience: 0.4, eager: 0.25, bigMin: 0, prefer: { damage: 2, defense: -2, control: 0, setup: -1 } };
export const CONSERVATIVE = { ...BASE, kind: 'conservative' as const, attack: 0.8, patience: 2.5, eager: 0, bigMin: 3, prefer: { damage: 1, defense: 0, control: 1, setup: 0 } };
export const DEFENSIVE = { ...BASE, kind: 'defensive' as const, dodge: 1.3, evade: 0.35, attack: 0.7, range: -1 as const, patience: 1.5, bigMin: 0, prefer: { damage: -1, defense: 3, control: 1, setup: 0 } };
