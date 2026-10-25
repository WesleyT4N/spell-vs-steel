// Per-class labels and resource colors, shared by the HUD, cards and menus.
import type { ClassId } from '../art/sprites';

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

export const CLASS_IDS: ClassId[] = ['warrior', 'mage', 'rogue', 'ranger', 'cleric'];
/** Classes shown in menus, the deck builder and the dev tools. The Cleric stays hidden until its kit is finalized. */
export const PLAYABLE: ClassId[] = ['warrior', 'mage', 'rogue', 'ranger'];

export const CLASS_INFO: Record<ClassId, ClassInfo> = {
  warrior: { name: 'WARRIOR', res: 'RAGE', resColor: '#f87858', gem: '#d82800', pipBase: '#503000', pip: '#d82800', refill: 'PAY ON CAST' },
  mage: { name: 'MAGE', res: 'MANA', resColor: '#a4e4fc', gem: '#0058f8', pipBase: '#0000a8', pip: '#3cbcfc', refill: 'REFILLS' },
  rogue: { name: 'ROGUE', res: 'ENERGY', resColor: '#f8d878', gem: '#ac7c00', pipBase: '#503000', pip: '#f8b800', refill: 'REFILLS' },
  ranger: { name: 'RANGER', res: 'ENERGY', resColor: '#f8d878', gem: '#ac7c00', pipBase: '#503000', pip: '#f8b800', refill: 'STAND STILL' },
  cleric: { name: 'CLERIC', res: 'MANA', resColor: '#a4e4fc', gem: '#0058f8', pipBase: '#0000a8', pip: '#3cbcfc', refill: '+3 PER DRAW' },
};
