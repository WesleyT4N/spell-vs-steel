// Display fonts for combat text: glyph masks drawn by PixelLab (assets/ui/fonts/<name>.png + .json, see
// tools/pixellab/build_combat_ui.py), colored here with a banded top-to-bottom fill, an outline and a drop shadow.
// Glyph widths are read off the masks, so the fonts are proportional. A styled string is rendered once into a
// small canvas at the font's own pixel size and kept; `scale` is UI pixels per font pixel and should be a
// multiple of 1/HD (0.5) so every font pixel lands on whole backing pixels.
import { assetData, assetImage } from './assets';

export type ArtFontName = 'retro' | 'gold';

export interface ArtTextStyle {
  /** Fill colors from the top of the letters to the bottom, in equal bands. */
  fill: string[];
  outline?: string;
  /** Outline thickness in font pixels (default 1). */
  ow?: number;
  /** Drop shadow color, one font pixel right and down behind the outline. */
  shadow?: string;
}

interface Glyph { mask: Uint8Array; x0: number; w: number }
interface FontData { size: number; glyphs: Map<string, Glyph>; top: number; bottom: number; space: number }
interface FontMeta { glyph: number; columns: number; chars: string }

const fonts = new Map<ArtFontName, FontData | null>();

function load(name: ArtFontName): FontData | null {
  if (fonts.has(name)) return fonts.get(name)!;
  const img = assetImage(`ui/fonts/${name}.png`), meta = assetData<FontMeta>(`ui/fonts/${name}.json`);
  if (!img || !meta || typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = img.naturalWidth; cv.height = img.naturalHeight;
  const c = cv.getContext('2d', { willReadFrequently: true })!;
  c.drawImage(img, 0, 0);
  const d = c.getImageData(0, 0, cv.width, cv.height).data, g = meta.glyph;
  const glyphs = new Map<string, Glyph>();
  let top = g, bottom = 0;
  [...meta.chars].forEach((ch, i) => {
    const ox = (i % meta.columns) * g, oy = Math.floor(i / meta.columns) * g;
    const mask = new Uint8Array(g * g);
    let x0 = g, x1 = -1;
    for (let y = 0; y < g; y++) for (let x = 0; x < g; x++) {
      if (d[((oy + y) * cv.width + ox + x) * 4 + 3] < 128) continue;
      mask[y * g + x] = 1; x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      // capitals and digits set the band the fill gradient spans
      if (/[A-Z0-9]/.test(ch)) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
    }
    if (x1 >= 0) glyphs.set(ch, { mask, x0, w: x1 - x0 + 1 });
  });
  const f: FontData = { size: g, glyphs, top, bottom, space: Math.max(2, Math.round(g / 3)) };
  fonts.set(name, f);
  return f;
}

const glyphOf = (f: FontData, ch: string): Glyph | undefined => f.glyphs.get(ch) ?? f.glyphs.get(ch.toUpperCase()) ?? f.glyphs.get('?');

/** The fonts are there to draw with (false in Node and until assets load). */
export const artFontReady = (name: ArtFontName): boolean => load(name) !== null;

/** Width of the letters alone, in font pixels (gap of one pixel between letters). */
function inkWidth(f: FontData, s: string): number {
  let w = 0, n = 0;
  for (const ch of s) { w += ch === ' ' ? f.space : (glyphOf(f, ch)?.w ?? 0); n++; }
  return n ? w + n - 1 : 0;
}

function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const cache = new Map<string, HTMLCanvasElement>();

/** The styled string as a canvas at font size, with `pad` font pixels around the letters for outline and shadow. */
function render(name: ArtFontName, s: string, st: ArtTextStyle): { cv: HTMLCanvasElement; pad: number } | null {
  const f = load(name);
  if (!f) return null;
  const ow = st.outline ? (st.ow ?? 1) : 0, pad = ow + (st.shadow ? 1 : 0);
  const key = `${name}|${s}|${st.fill.join(',')}|${st.outline ?? ''}|${ow}|${st.shadow ?? ''}`;
  let cv = cache.get(key);
  if (!cv) {
    const g = f.size, W = inkWidth(f, s) + pad * 2, H = g + pad * 2;
    const ink = new Uint8Array(W * H);
    let x = pad;
    for (const ch of s) {
      if (ch === ' ') { x += f.space + 1; continue; }
      const gl = glyphOf(f, ch);
      if (!gl) continue;
      for (let y = 0; y < g; y++) for (let k = 0; k < gl.w; k++) if (gl.mask[y * g + gl.x0 + k]) ink[(y + pad) * W + x + k] = 1;
      x += gl.w + 1;
    }
    cv = document.createElement('canvas');
    cv.width = Math.max(1, W); cv.height = H;
    const c = cv.getContext('2d')!, img = c.createImageData(cv.width, H), d = img.data;
    const put = (i: number, rgb: [number, number, number]): void => { d[i * 4] = rgb[0]; d[i * 4 + 1] = rgb[1]; d[i * 4 + 2] = rgb[2]; d[i * 4 + 3] = 255; };
    const near = (px: number, py: number, r: number): boolean => {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const qx = px + dx, qy = py + dy;
        if (qx >= 0 && qy >= 0 && qx < W && qy < H && ink[qy * W + qx]) return true;
      }
      return false;
    };
    const ring = new Uint8Array(W * H);
    if (ow) for (let y = 0; y < H; y++) for (let x2 = 0; x2 < W; x2++) if (!ink[y * W + x2] && near(x2, y, ow)) ring[y * W + x2] = 1;
    if (st.shadow) {
      const sh = hex(st.shadow);
      for (let y = 1; y < H; y++) for (let x2 = 1; x2 < W; x2++) {
        const from = (y - 1) * W + x2 - 1;
        if (ink[from] || ring[from]) put(y * W + x2, sh);
      }
    }
    if (st.outline) { const oc = hex(st.outline); for (let i = 0; i < W * H; i++) if (ring[i]) put(i, oc); }
    const bands = st.fill.map(hex), span = Math.max(1, f.bottom - f.top + 1);
    for (let y = 0; y < H; y++) {
      const t = Math.min(0.999, Math.max(0, (y - pad - f.top) / span));
      const col = bands[Math.floor(t * bands.length)];
      for (let x2 = 0; x2 < W; x2++) if (ink[y * W + x2]) put(y * W + x2, col);
    }
    c.putImageData(img, 0, 0);
    if (cache.size > 400) cache.clear();
    cache.set(key, cv);
  }
  return { cv, pad };
}

/** Width in UI pixels of `s` at `scale` (letters only, outline and shadow left out). */
export function artTextWidth(name: ArtFontName, s: string, scale = 1): number {
  const f = load(name);
  return f ? inkWidth(f, s) * scale : 0;
}

/** Height in UI pixels of the capitals at `scale`. */
export function artCapHeight(name: ArtFontName, scale = 1): number {
  const f = load(name);
  return f ? (f.bottom - f.top + 1) * scale : 0;
}

/**
 * Draw `s` with its letters' top-left at (x, y) (y is the top of the capitals). Returns false when the font
 * isn't loaded, so callers can fall back to the 5x7 font.
 */
export function drawArtText(c: CanvasRenderingContext2D, name: ArtFontName, s: string, x: number, y: number, st: ArtTextStyle, scale = 1): boolean {
  const r = render(name, s, st), f = load(name);
  if (!r || !f) return false;
  const k = scale;
  c.drawImage(r.cv, x - r.pad * k, y - (r.pad + f.top) * k, r.cv.width * k, r.cv.height * k);
  return true;
}

/** drawArtText centered on cx. Positions snap to whole font pixels at `scale`. */
export function drawArtTextCentered(c: CanvasRenderingContext2D, name: ArtFontName, s: string, cx: number, y: number, st: ArtTextStyle, scale = 1): boolean {
  const snap = (v: number): number => Math.round(v / scale) * scale;
  return drawArtText(c, name, s, snap(cx - artTextWidth(name, s, scale) / 2), snap(y), st, scale);
}
