// PixelLab stage backdrops: one painted panorama per stage (792x336 at 2 image pixels per world pixel), drawn
// behind the panel grid in place of the stage's Inked scenery. The stage keeps its panels, name and music.
import type { Stage } from '../../art/arena';
import { XL, XR, YT, YB } from '../../art/ink';
import { W, type Ctx } from '../../engine/gfx';
import { assetImage } from '../../engine/assets';

/** Image pixels per world pixel. */
const K = 2;

export interface Backdrop {
  /** The panorama's file under assets/ (stages/<id>.png, from tools/pixellab/build_stages.py). */
  src: string;
  /** World y of the panorama's top row; pick it so the far wall's foot sits above the top panel row (y 98). */
  top: number;
  /** Shown while the image decodes. */
  fill: string;
}

/** Image rows in the band that repeats past the top and bottom edges. */
const BAND = 24;
/** Draw image rows sy..sy+BAND at (x, y), flipped upside down when `flip`. */
function flipBand(c: Ctx, img: HTMLImageElement, sy: number, x: number, y: number, w: number, h: number, flip: boolean): void {
  if (!flip) { c.drawImage(img, 0, sy, img.naturalWidth, BAND, x, y, w, h); return; }
  c.save(); c.translate(0, y + h); c.scale(1, -1);
  c.drawImage(img, 0, sy, img.naturalWidth, BAND, x, 0, w, h);
  c.restore();
}

/** `st` with its scenery swapped for a painted backdrop. Rows past the image's top and bottom edges repeat them. */
export function withBackdrop(st: Stage, b: Backdrop): Stage {
  if (typeof Image === 'undefined') return st;   // headless (sims and tests) never draws
  const draw = (c: Ctx): void => {
    const img = assetImage(b.src);
    if (!img) { c.fillStyle = b.fill; c.fillRect(XL, YT, XR - XL, YB - YT); return; }
    const w = img.naturalWidth / K, h = img.naturalHeight / K, x = Math.round((W - w) / 2), y = b.top;
    c.drawImage(img, x, y, w, h);
    // past the edges the outer band repeats, mirrored each time so it never seams (floor below, sky above)
    const band = BAND / K;
    for (let i = 0, by = y + h; by < YB; i++, by += band) flipBand(c, img, img.naturalHeight - BAND, x, by, w, band, i % 2 === 0);
    for (let i = 0, by = y - band; by + band > YT; i++, by -= band) flipBand(c, img, 0, x, by, w, band, i % 2 === 0);
  };
  // stages may be class instances: keep their methods, override only the scenery
  return Object.assign(Object.create(st) as Stage, { draw });
}
