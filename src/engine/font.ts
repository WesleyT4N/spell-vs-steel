// 5x7 bitmap font: assets/ui/font.png holds every glyph side by side (5x7 cells, any opaque pixel is ink) in the
// order assets/ui/font.json lists them. Advance is 6px, line height 8px.
import font from '../../assets/ui/font.json';
import { assetImage } from './assets';

const CHARS = [...font.chars];
let bits: Record<string, number[][]> | null = null;
/** Each glyph as 7 rows of 5 bits, read from the font image the first time text is drawn. */
function glyphs(): Record<string, number[][]> {
  if (bits) return bits;
  const img = assetImage('ui/font.png');
  if (!img) return {};
  const cv = document.createElement('canvas');
  cv.width = img.naturalWidth; cv.height = img.naturalHeight;
  const c = cv.getContext('2d', { willReadFrequently: true })!;
  c.drawImage(img, 0, 0);
  const d = c.getImageData(0, 0, cv.width, cv.height).data, gw = font.glyphWidth, gh = font.glyphHeight;
  bits = {};
  CHARS.forEach((ch, i) => {
    bits![ch] = Array.from({ length: gh }, (_, y) => Array.from({ length: gw }, (_, x) => (d[(y * cv.width + i * gw + x) * 4 + 3] >= 128 ? 1 : 0)));
  });
  return bits;
}

/** The font can draw this character (lowercase counts as uppercase). */
export const hasGlyph = (ch: string): boolean => CHARS.includes(ch.toUpperCase());

export const CHAR_W = 6;
export const LINE_H = 8;

export function textWidth(s: string, scale = 1): number {
  return s.length ? (s.length * CHAR_W - 1) * scale : 0;
}

// Each glyph is painted once per color (and outline) into a small tile, then stamped with drawImage:
// one call per letter instead of up to 35 fillRects, and 9x that for outlined text. Same pixels.
const OUTLINE: Array<[number, number]> = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]];
const tiles = new Map<string, HTMLCanvasElement>();
function fillGlyph(c: CanvasRenderingContext2D, g: number[][], x: number, y: number, scale: number): void {
  for (let r = 0; r < 7; r++) for (let k = 0; k < 5; k++) if (g[r][k]) c.fillRect(x + k * scale, y + r * scale, scale, scale);
}
function tile(ch: string, color: string, scale: number, outline: string | null): HTMLCanvasElement {
  const key = `${ch}|${color}|${scale}|${outline ?? ''}`;
  let t = tiles.get(key);
  if (!t) {
    const g = glyphs()[ch] ?? glyphs()['?'], pad = outline ? 1 : 0;
    t = document.createElement('canvas');
    t.width = 5 * scale + 2 * pad; t.height = 7 * scale + 2 * pad;
    const c = t.getContext('2d')!;
    if (outline) { c.fillStyle = outline; for (const [dx, dy] of OUTLINE) fillGlyph(c, g, pad + dx, pad + dy, scale); }
    c.fillStyle = color;
    fillGlyph(c, g, pad, pad, scale);
    tiles.set(key, t);
  }
  return t;
}
/** Tiles match the fillRect path exactly only at whole-pixel scales, drawn opaque with normal blending
 *  (a see-through stamp rounds its blend a hair differently from a see-through fill). */
const tileable = (c: CanvasRenderingContext2D, scale: number): boolean =>
  Number.isInteger(scale) && scale > 0 && c.globalAlpha === 1 && c.globalCompositeOperation === 'source-over';

/** Draw text in the bitmap font. Lowercase renders as uppercase. */
export function drawText(c: CanvasRenderingContext2D, s: string, x: number, y: number, color: string, scale = 1): void {
  c.fillStyle = color;
  let cx = Math.round(x);
  const cy = Math.round(y), fast = tileable(c, scale);
  for (const raw of s) {
    const ch = raw.toUpperCase();
    if (ch !== ' ') {
      if (fast) c.drawImage(tile(glyphs()[ch] ? ch : '?', color, scale, null), cx, cy);
      else fillGlyph(c, glyphs()[ch] ?? glyphs()['?'], cx, cy, scale);
    }
    cx += CHAR_W * scale;
  }
}

/** Text with a 1px black outline, the default for anything drawn over the arena. */
export function drawTextOutlined(c: CanvasRenderingContext2D, s: string, x: number, y: number, color: string, scale = 1, outline = '#000000'): void {
  if (!tileable(c, scale)) {
    for (const [dx, dy] of OUTLINE) drawText(c, s, x + dx, y + dy, outline, scale);
    drawText(c, s, x, y, color, scale);
    return;
  }
  c.fillStyle = color;
  let cx = Math.round(x);
  const cy = Math.round(y);
  for (const raw of s) {
    const ch = raw.toUpperCase();
    // neighbours' outlines only reach the blank column between letters, so letter-at-a-time matches all-outlines-first
    if (ch !== ' ') c.drawImage(tile(glyphs()[ch] ? ch : '?', color, scale, outline), cx - 1, cy - 1);
    cx += CHAR_W * scale;
  }
}

export function drawTextCentered(c: CanvasRenderingContext2D, s: string, cx: number, y: number, color: string, scale = 1, outlined = true): void {
  const x = Math.round(cx - textWidth(s, scale) / 2);
  if (outlined) drawTextOutlined(c, s, x, y, color, scale);
  else drawText(c, s, x, y, color, scale);
}

/** Greedy word wrap to a max number of characters per line. */
export function wrap(s: string, maxChars: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of s.split(/\s+/)) {
    if (!word) continue;
    if (!line) line = word;
    else if (line.length + 1 + word.length <= maxChars) line += ' ' + word;
    else { out.push(line); line = word; }
  }
  if (line) out.push(line);
  return out;
}
