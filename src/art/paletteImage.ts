// Palette sprites (fighters, monsters) are PNG files under assets/ with their palette in a JSON file beside them.
// Skins and hit tints recolor by palette index (index 0 is always the outline), so the game reads each image back
// into rows of palette letters, the form the sprite baker works in: '.' is clear, then a-z, A-Z, 0-9 for indices
// 0..61. Every pixel must be a palette color; one that isn't takes the nearest palette color.
import { assetData, assetImage } from '../engine/assets';

/** Palette letters by index: 'a' (the outline) to 'z', then 'A' to 'Z', then '0' to '9'. */
export const LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

const rgb = (c: string): [number, number, number] => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)) as [number, number, number];

/** The palette letter of a color, or undefined if the color isn't in the palette. */
export const letterOf = (pal: string[], color: string): string | undefined => {
  const i = pal.findIndex(c => c.toLowerCase() === color.toLowerCase());
  return i >= 0 ? LETTERS[i] : undefined;
};

/** Rows of palette letters from RGBA pixels (alpha under 128 is clear); `letters[i]` stands for `pal[i]`. */
export function rowsFromPixels(px: Uint8ClampedArray | Uint8Array, w: number, h: number, pal: string[], letters = LETTERS): string[] {
  const cols = pal.map(rgb), exact = new Map<number, string>();
  cols.forEach(([r, g, b], i) => exact.set((r << 16) | (g << 8) | b, letters[i]));
  const nearest = (r: number, g: number, b: number): string => {
    let best = 0, bd = Infinity;
    cols.forEach(([pr, pg, pb], i) => { const d = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2; if (d < bd) { bd = d; best = i; } });
    return letters[best];
  };
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    let row = '';
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (px[i + 3] < 128) { row += '.'; continue; }
      row += exact.get((px[i] << 16) | (px[i + 1] << 8) | px[i + 2]) ?? nearest(px[i], px[i + 1], px[i + 2]);
    }
    rows.push(row);
  }
  return rows;
}

/** One w x h cell of a decoded image, at (x, y), as palette rows. */
export function rowsFromImage(img: HTMLImageElement, pal: string[], x = 0, y = 0, w = img.naturalWidth, h = img.naturalHeight, letters = LETTERS): string[] {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d', { willReadFrequently: true })!;
  c.drawImage(img, x, y, w, h, 0, 0, w, h);
  return rowsFromPixels(c.getImageData(0, 0, w, h).data, w, h, pal, letters);
}

/** assets/sprites/<name>.json: a small hand-drawn sprite (pets, props) and the letter each of its colors goes by. */
interface SmallFile { frameWidth: number; colors: Record<string, string> }
/** A small sprite's frames as letter rows, with its letter -> color map. */
export interface SmallSprite { frames: string[][]; colors: Record<string, string> }
const small = new Map<string, SmallSprite>();
/** A small sprite from assets/sprites/<name>.png (its frames side by side). Empty until the images have loaded. */
export function smallSprite(name: string): SmallSprite {
  let s = small.get(name);
  if (s) return s;
  const f = assetData<SmallFile>(`sprites/${name}.json`), img = assetImage(`sprites/${name}.png`);
  if (!f || !img) return { frames: [[]], colors: {} };
  const letters = Object.keys(f.colors).join(''), pal = Object.values(f.colors), h = img.naturalHeight;
  const frames = Array.from({ length: Math.floor(img.naturalWidth / f.frameWidth) }, (_, i) => rowsFromImage(img, pal, i * f.frameWidth, 0, f.frameWidth, h, letters));
  small.set(name, s = { frames, colors: f.colors });
  return s;
}
