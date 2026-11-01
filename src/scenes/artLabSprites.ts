// The Art Lab's Sprites section: a class's drawn frames, tints, portrait and spell icons at whole-pixel zoom, in any
// skin, drawn straight from the game's sprite code (art/sprites.ts, art/fighterFrames.ts, art/cardIcons.ts).
import { FRAMES, type FrameId } from '../art/fighterFrames';
import { PL } from '../art/pl';
import { getFrame, getPortrait, drawFighterSprite, type ClassId, type Sprite, type Tint } from '../art/sprites';
import { cardIconCanvas, ICON_SIZE } from '../art/cardIcons';
import { cardsFor } from '../game/cards';
import { UW, UH, P, type Ctx } from '../engine/gfx';
import { drawTextCentered } from '../engine/font';

export type SpriteView = 'sheet' | 'tints' | 'portrait' | 'icons' | FrameId;

/** What the Sprites section lists for a class: the whole sheet, each frame on its own, then tints, portrait and icons. */
export function spriteViews(cls: ClassId): Array<[SpriteView, string]> {
  const frames = Object.keys(FRAMES[cls].frames) as FrameId[];
  return [['sheet', 'ALL FRAMES'], ...frames.map(f => [f, `FRAME: ${f.toUpperCase()}`] as [SpriteView, string]), ['tints', 'TINTS'], ['portrait', 'PORTRAIT'], ['icons', 'SPELL ICONS']];
}

export const SPRITE_ABOUT: Record<string, string> = {
  sheet: 'Every drawn frame of the class sheet, in this skin. The 48px PixelLab frames are 64 wide with the feet on the bottom row (2 sprite pixels per world pixel).',
  tints: 'The frame as the game tints it: hit flash, frozen, stunned and the ghost trail.',
  portrait: 'The character select bust portrait.',
  icons: 'Every spell icon of the class, 20×20.',
  frame: 'One frame, big. The grid shows the native pixels.',
};

const BG = '#1c1c1c', CHECK = '#282828', LABEL = '#bcbcbc';

/** A checkerboard behind `w`×`h` at (x, y), so transparent pixels read as transparent. */
function backing(c: Ctx, x: number, y: number, w: number, h: number, cell: number): void {
  P(c, BG, x, y, w, h);
  for (let j = 0; j * cell < h; j++) for (let i = 0; i * cell < w; i++) if ((i + j) % 2) P(c, CHECK, x + i * cell, y + j * cell, Math.min(cell, w - i * cell), Math.min(cell, h - j * cell));
}

/** Native pixel lines over an image drawn at `z`× (and the 24×24 body box for fighter frames). */
function grid(c: Ctx, x: number, y: number, w: number, h: number, z: number, box?: { ax: number }): void {
  if (z >= 4) {
    for (let i = 0; i <= w; i++) P(c, 'rgba(255,255,255,0.08)', x + i * z, y, 1, h * z);
    for (let j = 0; j <= h; j++) P(c, 'rgba(255,255,255,0.08)', x, y + j * z, w * z, 1);
  }
  if (box) {
    const bx = x + (box.ax - 12) * z;
    P(c, '#f8b800', bx, y, 24 * z, 1); P(c, '#f8b800', bx, y + h * z - 1, 24 * z, 1);
    P(c, '#f8b800', bx, y, 1, h * z); P(c, '#f8b800', bx + 24 * z - 1, y, 1, h * z);
  }
}

/** One frame at `z`×, top-left at (x, y), with its checker backing and optional grid. */
function frameAt(c: Ctx, s: Sprite, x: number, y: number, z: number, tint: Tint, showGrid: boolean): void {
  const w = s.img.none.width, h = s.img.none.height;
  backing(c, x, y, w * z, h * z, z * 2);
  // z is screen pixels per sprite pixel (the 48px fighters have 2 sprite pixels per world pixel)
  drawFighterSprite(c, s, x + s.ax * s.res * z, y + h * z, false, tint, z * s.res);
  if (showGrid) grid(c, x, y, w, h, z, s.res === 1 ? { ax: s.ax } : undefined);
}

/** Draw the picked sprite view on the UI layer (480×320 coordinates). */
export function drawSprites(ui: Ctx, cls: ClassId, skin: string, alt: boolean, view: SpriteView, showGrid: boolean): void {
  P(ui, '#000000', -UW, -UH, UW * 3, UH * 3);
  const label = (t: string, x: number, y: number): void => drawTextCentered(ui, t, x, y, LABEL, 1, false);
  if (view === 'sheet') {
    // as big as every frame fits, whole pixels only
    const ids = Object.keys((PL[cls] ?? FRAMES[cls]).frames) as FrameId[], gap = 8, top = 26, foot = 18, lab = 14;
    const one = getFrame(cls, skin, alt, 'idle0').img.none, FW = one.width, FH = one.height;
    let z = 4, cols = 1;
    for (; z > 1; z--) {
      cols = Math.max(1, Math.floor((UW - 8 + gap) / (FW * z + gap)));
      if (Math.ceil(ids.length / cols) * (FH * z + lab) <= UH - top - foot) break;
    }
    cols = Math.max(1, Math.floor((UW - 8 + gap) / (FW * z + gap)));
    const fw = FW * z, x0 = Math.round((UW - (cols * fw + (cols - 1) * gap)) / 2);
    ids.forEach((id, i) => {
      const x = x0 + (i % cols) * (fw + gap), y = top + Math.floor(i / cols) * (FH * z + lab);
      frameAt(ui, getFrame(cls, skin, alt, id), x, y, z, 'none', showGrid);
      label(id.toUpperCase(), x + fw / 2, y + FH * z + 3);
    });
    return;
  }
  if (view === 'tints') {
    const tints: Tint[] = ['none', 'flash', 'ice', 'stun', 'ghost'], z = PL[cls] ? 1 : 2, fw = getFrame(cls, skin, alt, 'idle0').img.none.width * z, gap = 14;
    const x0 = Math.round((UW - (tints.length * fw + (tints.length - 1) * gap)) / 2);
    for (const [r, id] of (['idle0', 'hit'] as FrameId[]).entries()) {
      tints.forEach((t, i) => {
        const x = x0 + i * (fw + gap), y = 40 + r * 110;
        frameAt(ui, getFrame(cls, skin, alt, id), x, y, z, t, showGrid);
        if (!r) label(t.toUpperCase(), x + fw / 2, y - 12);
      });
    }
    return;
  }
  if (view === 'portrait') {
    const img = getPortrait(cls, skin), z = Math.max(1, Math.floor(Math.min((UW - 40) / img.width, (UH - 70) / img.height)));
    const x = Math.round((UW - img.width * z) / 2), y = 30;
    backing(ui, x, y, img.width * z, img.height * z, z * 2);
    ui.drawImage(img, x, y, img.width * z, img.height * z);
    if (showGrid) grid(ui, x, y, img.width, img.height, z);
    label(`${img.width}×${img.height} AT ${z}×`, UW / 2, y + img.height * z + 6);
    return;
  }
  if (view === 'icons') {
    const ids = cardsFor(cls).map(c => c.id), gap = 6;
    let z = 4, cols = 1;
    for (; z > 1; z--) {
      cols = Math.floor((UW - 16 + gap) / (ICON_SIZE * z + gap));
      if (Math.ceil(ids.length / cols) * (ICON_SIZE * z + gap) <= UH - 26 - 18) break;
    }
    const cell = ICON_SIZE * z;
    cols = Math.floor((UW - 16 + gap) / (cell + gap));
    const x0 = Math.round((UW - (cols * cell + (cols - 1) * gap)) / 2);
    ids.forEach((id, i) => {
      const x = x0 + (i % cols) * (cell + gap), y = 26 + Math.floor(i / cols) * (cell + gap);
      backing(ui, x, y, cell, cell, z * 2);
      const img = cardIconCanvas(id);
      if (img) ui.drawImage(img, x, y, cell, cell); else label('NONE', x + cell / 2, y + cell / 2 - 3);
      if (showGrid) grid(ui, x, y, ICON_SIZE, ICON_SIZE, z);
    });
    return;
  }
  // one frame, as big as fits
  const s = getFrame(cls, skin, alt, view), w = s.img.none.width, h = s.img.none.height;
  const z = Math.max(1, Math.floor(Math.min((UW - 40) / w, (UH - 70) / h)));
  const x = Math.round((UW - w * z) / 2), y = Math.round((UH - 30 - h * z) / 2) + 8;
  frameAt(ui, s, x, y, z, 'none', showGrid);
  label(`${view.toUpperCase()}  ${w}×${h} AT ${z}×`, UW / 2, y + h * z + 6);
}
