// The 48px PixelLab fighters (2 sprite pixels per world pixel), by class.
import type { PlSet } from './types';
import warrior from './warrior';
import mage from './mage';
import rogue from './rogue';
import ranger from './ranger';
import priest from './priest';

export type { PlSet } from './types';
/** Sprite pixels per world pixel for the PixelLab fighters. */
export const PL_RES = 2;
export const PL: Record<string, PlSet> = { warrior, mage, rogue, ranger, priest };
