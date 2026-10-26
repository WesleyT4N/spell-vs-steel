// The Parchment UI skin: aged scroll windows, brown ink, red wax and ribbons.
// Every menu, card and HUD plate is built from these parts, so they draw at any size and layout.
import { P, UW, UH, dith, hash, mix, screenRect, view, type Ctx } from '../engine/gfx';
import { drawText, textWidth } from '../engine/font';

/** Paper and ink colors. Text on parchment uses the inks; text over the arena keeps the bright colors. */
export const PAPER = '#fce0a8';
export const PAPER2 = '#f0c880';
export const BURN = '#d8a060';
export const INK = '#503000';
export const INK2 = '#8c6020';
export const RED_INK = '#a81000';
export const BLUE_INK = '#0028a8';
export const GOLD = '#f8b800';
export const WAX = '#a81000';
export const WAX_HI = '#d82800';
export const FRAME = '#503000';
export const TRIM = '#ac7c00';
const BLACK = '#000000';

/** A bright color (element, rarity, team) darkened enough to read as ink on parchment. */
export const ink = (col: string): string => mix(col, BLACK, 0.5);
/** The parchment version of one of the old on-black text colors: white to ink, greys to faded ink, gold to red ink. */
export function toInk(col: string): string {
  if ([INK, INK2, TRIM, BURN, RED_INK, BLUE_INK, '#007800'].includes(col)) return col;
  switch (col.toLowerCase()) {
    case '#fcfcfc': return INK;
    case '#bcbcbc': return INK2;
    case '#7c7c7c': case '#3c3c3c': return TRIM;
    case '#f8b800': return RED_INK;
    case '#f83800': return RED_INK;
    default: return ink(col);
  }
}

// paper textures are baked once per size: the dither and speckles are too many pixels to draw every frame
const paperCache = new Map<string, HTMLCanvasElement>();
function paperTex(w: number, h: number, edge: number): HTMLCanvasElement {
  const key = `${w}x${h}:${edge}`;
  let o = paperCache.get(key);
  if (o) return o;
  o = document.createElement('canvas');
  o.width = Math.max(1, w); o.height = Math.max(1, h);
  const c = o.getContext('2d')!;
  P(c, PAPER, 0, 0, w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = Math.min(x, y, w - 1 - x, h - 1 - y);
    const t = d < edge ? (1 - d / edge) * 0.75 : 0;
    if (dith(x, y) < t) P(c, d < 2 ? BURN : PAPER2, x, y);
    else if (d >= edge && hash(x, y, 7) > 0.994) P(c, PAPER2, x, y);
  }
  paperCache.set(key, o);
  return o;
}

/** Bare parchment, with the edges burned darker. */
export function paper(c: Ctx, x: number, y: number, w: number, h: number, edge = 6): void {
  if (w <= 0 || h <= 0) return;
  c.drawImage(paperTex(Math.round(w), Math.round(h), edge), Math.round(x), Math.round(y));
}

/**
 * A parchment window: brown frame, cut corners, burned edges. `accent` adds a ribbon across the top
 * (team or element color); `edge` recolors the frame (gold for a hovered card, wax red for a picked one).
 */
export function win(c: Ctx, x: number, y: number, w: number, h: number, opts: { accent?: string; edge?: string; burn?: number } = {}): void {
  const edge = opts.edge ?? FRAME;
  P(c, BLACK, x - 1, y - 1, w + 2, h + 2);
  P(c, edge, x, y, w, h);
  paper(c, x + 2, y + 2, w - 4, h - 4, opts.burn ?? 6);
  for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w - 1, y, -1, 1], [x, y + h - 1, 1, -1], [x + w - 1, y + h - 1, -1, -1]]) {
    P(c, edge, cx + dx * 2, cy + dy * 2); P(c, edge, cx + dx * 3, cy + dy * 2); P(c, edge, cx + dx * 2, cy + dy * 3);
    P(c, TRIM, cx + dx * 3, cy + dy * 3);
  }
  if (opts.accent) { P(c, opts.accent, x + 2, y + 2, w - 4, 3); P(c, mix(opts.accent, BLACK, 0.4), x + 2, y + 5, w - 4, 1); }
}

/** Highlight behind the selected row of a list: shaded paper with a red ribbon bookmark on the left. */
export function selRow(c: Ctx, x: number, y: number, w: number, h: number): void {
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) if (dith(x + xx, y + yy) < 0.55) P(c, PAPER2, x + xx, y + yy);
  P(c, WAX, x, y, 14, h); P(c, WAX_HI, x, y, 14, 1);
  for (let i = 0; i < h; i++) { // swallowtail notch on the right end
    const n = Math.max(0, 5 - Math.round(Math.abs(i - (h - 1) / 2)));
    P(c, PAPER2, x + 14 - n, y + i, n, 1);
  }
}

/** A screen title on a scroll with rolled ends. */
export function banner(c: Ctx, text: string, cx: number, y: number, scale = 2): void {
  const tw = textWidth(text, scale), w = tw + 20 * scale, x = Math.round(cx - w / 2), h = 10 + 7 * scale;
  P(c, BLACK, x - 1, y - 1, w + 2, h + 2); P(c, FRAME, x, y, w, h);
  paper(c, x + 1, y + 1, w - 2, h - 2, 3);
  const roll = [INK, TRIM, BURN, PAPER, PAPER, PAPER2, BURN, TRIM, INK2, INK];
  for (const ex of [x - 8, x + w - 2]) {
    P(c, BLACK, ex - 1, y - 4, 12, h + 8);
    roll.forEach((col, i) => P(c, col, ex + i, y - 3, 1, h + 6));
  }
  drawText(c, text, Math.round(cx - tw / 2), y + 5, INK, scale);
}

/** Small plaque button: parchment, or red wax when lit. `edge` recolors the frame (gold on hover). Returns the text color to label it with. */
export function plaque(c: Ctx, x: number, y: number, w: number, h: number, lit: boolean, edge = FRAME): string {
  P(c, BLACK, x - 1, y - 1, w + 2, h + 2);
  P(c, edge, x, y, w, h);
  if (lit) { P(c, WAX, x + 1, y + 1, w - 2, h - 2); P(c, WAX_HI, x + 1, y + 1, w - 2, 1); return PAPER; }
  paper(c, x + 1, y + 1, w - 2, h - 2, 3);
  return INK;
}

/** A gauge in a brown frame. `right` fills from the right edge. */
export function bar(c: Ctx, x: number, y: number, w: number, h: number, frac: number, col: string, right = false): void {
  P(c, BLACK, x - 1, y - 1, w + 2, h + 2);
  P(c, FRAME, x, y, w, h); P(c, INK, x + 1, y + 1, w - 2, h - 2);
  const fw = Math.round((w - 2) * Math.max(0, Math.min(1, frac))), fx = right ? x + w - 1 - fw : x + 1;
  P(c, col, fx, y + 1, fw, h - 2); P(c, mix(col, '#fcfcfc', 0.45), fx, y + 1, fw, 1);
}

/** Filled disc. */
export function disc(c: Ctx, cx: number, cy: number, r: number, col: string): void {
  for (let y = -r; y <= r; y++) {
    const hw = Math.floor(Math.sqrt(r * r + r * 0.6 - y * y));
    P(c, col, cx - hw, cy + y, hw * 2 + 1, 1);
  }
}

/** A wax seal: the cost badge on cards. */
export function seal(c: Ctx, cx: number, cy: number, r: number, col: string): void {
  disc(c, cx, cy, r, mix(col, BLACK, 0.45)); disc(c, cx, cy, r - 2, col);
  P(c, mix(col, '#fcfcfc', 0.4), cx - r + 4, cy - r + 4, 3, 1);
}

/** One round resource pip, 9x9. `fill` null draws an empty socket. */
export function pip(c: Ctx, x: number, y: number, fill: string | null, empty = BURN): void {
  disc(c, x + 4, y + 4, 4, BLACK);
  disc(c, x + 4, y + 4, 3, fill ?? empty);
  if (fill) P(c, mix(fill, '#fcfcfc', 0.5), x + 2, y + 2, 2, 1);
}

/** Control hints along the bottom of the UI layer: an ink-brown strip with parchment text, reaching into the margins. */
export function footer(c: Ctx, text: string): void {
  const [x, , w, h] = screenRect(2);
  P(c, FRAME, x, UH - 14, w, 14 + (h - UH) / 2); P(c, TRIM, x, UH - 14, w, 1);
  drawText(c, text, Math.round(UW / 2 - textWidth(text) / 2), UH - 10, PAPER);
}

/** Warm sepia wash for overlays (pause, results, the Draw screen), instead of a black dim. */
export function sepia(c: Ctx, a = 0.5): void {
  c.fillStyle = `rgba(40,20,0,${a})`;
  c.fillRect(...screenRect(c.canvas.width / view.w));
}

/** The big VS between two fighters: a red wax seal. */
export function vsSeal(c: Ctx, cx: number, cy: number): void {
  disc(c, cx, cy, 21, BLACK); disc(c, cx, cy, 20, mix(WAX, BLACK, 0.4)); disc(c, cx, cy, 17, WAX);
  for (let a = 0; a < 12; a++) { const an = a / 12 * Math.PI * 2; P(c, mix(WAX, BLACK, 0.4), cx + Math.cos(an) * 19 - 1, cy + Math.sin(an) * 19 - 1, 3, 3); }
  P(c, WAX_HI, cx - 10, cy - 13, 6, 2);
  drawText(c, 'VS', cx - 10, cy - 6, mix(WAX, BLACK, 0.5), 2);
  drawText(c, 'VS', cx - 11, cy - 7, PAPER, 2);
}
