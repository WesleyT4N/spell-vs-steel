// Baked sprite-sheet effects: PixelLab VFX exports (assets/fx/, tools/pixellab/build_fx.py) drawn at the fighters' pixel density
// (2 sheet pixels per world pixel, see HD in engine/gfx). Render-only like every effect: the frame is a pure
// function of the fx's age, so a rollback resim draws the same picture.
import type { PfxModule } from '../game/pfx';
import { assetImage, loadImages } from '../engine/assets';

export interface Sheet {
  /** The frames as a horizontal strip: a PNG under assets/ ("fx/mage/orb.png"). */
  src: string;
  /** One frame's size in sheet pixels. */
  fw: number; fh: number;
  /** Frames in the strip and how fast they play. */
  n: number; fps: number;
  /** Where the effect's origin (a hit's panel feet, a shot's center) sits in a frame, in sheet pixels. */
  ax: number; ay: number;
  /** Shots loop while they fly; hits play once and end empty. */
  loop?: boolean;
}

export type SheetModule = PfxModule & { sheet: Sheet };

/** An effect's metadata file (assets/fx/<class>/<name>.json): the sheet's frame data plus how it is shown. */
export type SheetFile = Omit<Sheet, 'src'> & { name: string; desc: string; panels: number; rows: number };

/**
 * A sheet effect module. `panels` spans the box along the attacker's facing like any effect; `rows` 3 plays the sheet
 * on every row of the anchor's column (column-wide spells anchor on the middle row).
 */
export function sheetFx(name: string, desc: string, sheet: Sheet, panels = 1, rows = 1): SheetModule {
  return { meta: { name, desc, duration: sheet.n / sheet.fps, panels, rows }, sheet };
}

/** Resolves once every sheet has decoded (tools and tests wait on it before drawing). */
export const sheetsReady = (): Promise<unknown> => loadImages();

/** Sheet pixels per world pixel. */
export const SHEET_RES = 2;


/** The frame playing `age` seconds in, or -1 once a one-shot has ended. */
export function sheetFrame(s: Sheet, age: number): number {
  const f = Math.floor(age * s.fps + 1e-6);
  if (s.loop) return ((f % s.n) + s.n) % s.n;
  return f < s.n ? Math.max(0, f) : -1;
}

/** Draw frame `f` of `s` with its origin at world (x, y), mirrored for a left-facing attacker. */
export function drawSheet(c: CanvasRenderingContext2D, s: Sheet, f: number, x: number, y: number, flip: boolean): void {
  const img = assetImage(s.src);
  if (!img || f < 0) return;
  const k = SHEET_RES, w = s.fw / k, h = s.fh / k;
  c.save();
  c.imageSmoothingEnabled = false;
  c.translate(Math.round(x * k) / k, Math.round(y * k) / k);
  if (flip) c.scale(-1, 1);
  c.drawImage(img, f * s.fw, 0, s.fw, s.fh, -s.ax / k, -s.ay / k, w, h);
  c.restore();
}

/** A sheet effect that picks its sheet from the fx's data (e.g. a hit's element and size); none = hand-drawn. */
export type PickModule = PfxModule & { pick(data: Record<string, number | string>): Sheet | undefined };
export function pickFx(name: string, desc: string, pick: PickModule['pick']): PickModule {
  return { meta: { name, desc, duration: 1 }, pick };
}

/** Like drawSheet, but only sheet columns [sx0, sx1) of the frame (e.g. a shot's head without its baked-in tail). */
export function drawSheetPart(c: CanvasRenderingContext2D, s: Sheet, f: number, x: number, y: number, flip: boolean, sx0: number, sx1: number): void {
  const img = assetImage(s.src);
  if (!img || f < 0) return;
  const k = SHEET_RES;
  c.save();
  c.imageSmoothingEnabled = false;
  c.translate(Math.round(x * k) / k, Math.round(y * k) / k);
  if (flip) c.scale(-1, 1);
  c.drawImage(img, f * s.fw + sx0, 0, sx1 - sx0, s.fh, (sx0 - s.ax) / k, -s.ay / k, (sx1 - sx0) / k, s.fh / k);
  c.restore();
}
