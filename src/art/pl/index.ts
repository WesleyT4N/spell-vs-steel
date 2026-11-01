// The 48px PixelLab fighters (2 sprite pixels per world pixel), by class: assets/fighters/<class>.json says how the
// <class>.png strip is laid out; the pixels are read back into palette rows the first time they are drawn.
import type { FighterFile, PlSet } from './types';
import { assetImage } from '../../engine/assets';
import { letterOf, rowsFromImage } from '../paletteImage';
import warrior from '../../../assets/fighters/warrior.json';
import mage from '../../../assets/fighters/mage.json';
import rogue from '../../../assets/fighters/rogue.json';
import ranger from '../../../assets/fighters/ranger.json';
import priest from '../../../assets/fighters/priest.json';

export type { PlSet, FighterFile } from './types';
/** Sprite pixels per world pixel for the PixelLab fighters. */
export const PL_RES = 2;
/** Portrait size in sprite pixels. */
const PORTRAIT_W = 40, PORTRAIT_H = 32;

function fighter(cls: string, f: FighterFile): PlSet {
  let frames: PlSet['frames'] | null = null, portrait: string[] | null = null;
  return {
    ax: f.ax, team: letterOf(f.palette, f.team) ?? 'a', pal: f.palette,
    w: f.frameWidth, h: f.frameHeight, portraitW: PORTRAIT_W, portraitH: PORTRAIT_H,
    get frames() {
      if (frames) return frames;
      const img = assetImage(`fighters/${cls}.png`);
      if (!img) return {};
      const out: PlSet['frames'] = {};
      f.frames.forEach((id, i) => { out[id] = rowsFromImage(img, f.palette, i * f.frameWidth, 0, f.frameWidth, f.frameHeight); });
      return (frames = out);
    },
    get portrait() {
      if (portrait) return portrait;
      const img = assetImage(`fighters/${cls}-portrait.png`);
      return img ? (portrait = rowsFromImage(img, f.palette)) : [];
    },
  };
}

/** Each class's assets/fighters/<class>.json. */
export const PL_FILES: Record<string, FighterFile> = { warrior, mage, rogue, ranger, priest } as Record<string, FighterFile>;
export const PL: Record<string, PlSet> = Object.fromEntries(Object.entries(PL_FILES).map(([cls, f]) => [cls, fighter(cls, f)]));
