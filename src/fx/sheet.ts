// Baked sprite-sheet effects: PixelLab VFX exports (tools/pixellab/build_fx.py) drawn at the fighters' pixel density
// (2 sheet pixels per world pixel, see HD in engine/gfx). Render-only like every effect: the frame is a pure
// function of the fx's age, so a rollback resim draws the same picture.
import type { PfxModule } from '../game/pfx';

export interface Sheet {
  /** The frames as a horizontal strip PNG data URL. */
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

/** A sheet effect module. `panels` spans the box along the attacker's facing like any effect. */
export function sheetFx(name: string, desc: string, sheet: Sheet, panels = 1): SheetModule {
  image(sheet.src);   // start decoding now, so the first hit doesn't miss its frames
  return { meta: { name, desc, duration: sheet.n / sheet.fps, panels }, sheet };
}

/** Resolves once every sheet made so far has decoded (tools and tests wait on it before drawing). */
export const sheetsReady = (): Promise<unknown> => Promise.all([...imgs.values()].map(i => i.decode().catch(() => {})));

/** Sheet pixels per world pixel. */
export const SHEET_RES = 2;

const imgs = new Map<string, HTMLImageElement>();
function image(src: string): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  let img = imgs.get(src);
  if (!img) { img = new Image(); img.src = src; imgs.set(src, img); }
  return img.complete && img.naturalWidth ? img : null;
}

/** The frame playing `age` seconds in, or -1 once a one-shot has ended. */
export function sheetFrame(s: Sheet, age: number): number {
  const f = Math.floor(age * s.fps + 1e-6);
  if (s.loop) return ((f % s.n) + s.n) % s.n;
  return f < s.n ? Math.max(0, f) : -1;
}

/** Draw frame `f` of `s` with its origin at world (x, y), mirrored for a left-facing attacker. */
export function drawSheet(c: CanvasRenderingContext2D, s: Sheet, f: number, x: number, y: number, flip: boolean): void {
  const img = image(s.src);
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
