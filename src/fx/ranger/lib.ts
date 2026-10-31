// Ranger-only drawing recipes (see docs/FX.md): arrows, feathers, leaves, the pet sprites (copied 1:1 from
// battleView so a shot effect can carry the creature it replaces), reticles and trap jaws. Everything draws in an
// effect's local space: x forward, y down from the feet (or from the shot's center for shots), 1 unit = 1 px.
import { hex, Rng, Particles, P } from '../../vendor/pixelfx/index.js';
import type { Painter } from '../../game/pfx';

/** Colors as numbers, keyed like the hand-drawn art uses them. */
export const K = {
  ink: hex('#000000'), coal: hex('#3c3c3c'), iron: hex('#7c7c7c'), steel: hex('#bcbcbc'), white: hex('#fcfcfc'),
  wood: hex('#ac7c00'), bark: hex('#503000'), straw: hex('#f8d878'), gold: hex('#f8b800'),
  leaf0: hex('#006800'), leaf1: hex('#00b800'), leaf2: hex('#58d854'), leaf3: hex('#b8f818'),
  red0: hex('#a81000'), red1: hex('#f83800'), red2: hex('#fca044'),
  ice0: hex('#0058f8'), ice1: hex('#3cbcfc'), ice2: hex('#a4e4fc'),
  tox0: hex('#005800'), tox1: hex('#00a800'), tox2: hex('#58d854'), tox3: hex('#b8f818'),
  sand: hex('#f0d0b0'), cream: hex('#fce0a8'),
};

/** Flight speeds in px/s (TUNING.ranger arrowSpeed and aimedSpeed are 12 and 15 panels/s, a panel is 38 px). */
export const ARROW_PX = 12 * 38, AIMED_PX = 15 * 38;

export interface ArrowLook { shaft: number; head: number; fletch: number; len?: number; thick?: boolean }
/**
 * A horizontal arrow with its point at (x, y), pointing +x: a steel head, a wooden shaft and fletching at the tail.
 * Ink comes from meta.ink, so draw solid pixels only.
 */
export function arrow(p: Painter, x: number, y: number, a: ArrowLook): void {
  const len = a.len ?? 11, X = Math.round(x), Y = Math.round(y);
  p.rect(X - len, Y, len - 2, a.thick ? 2 : 1, a.shaft);
  // the head: a 3 px arrowhead
  p.rect(X - 2, Y - 1, 2, a.thick ? 4 : 3, a.head); p.px(X, Y, K.white);
  if (a.thick) p.px(X, Y + 1, K.white);
  // fletching: two little vanes at the tail
  p.rect(X - len, Y - 1, 3, 1, a.fletch); p.rect(X - len, Y + (a.thick ? 2 : 1), 3, 1, a.fletch);
}

/** A feather: a 3 px vane with a dark quill, tilted by `tip` (-1, 0, 1). */
export function feather(p: Painter, x: number, y: number, tip: number, c: number, q: number): void {
  const X = Math.round(x), Y = Math.round(y);
  p.px(X - 1, Y - tip, c); p.px(X, Y, c); p.px(X + 1, Y + tip, q);
}
/** A leaf: 2 px of green with a bright vein pixel. */
export function leaf(p: Painter, x: number, y: number, spin: number, c: number, v: number): void {
  const X = Math.round(x), Y = Math.round(y), s = ((Math.floor(spin) % 4) + 4) % 4;
  if (s === 0) { p.px(X, Y, c); p.px(X + 1, Y, v); }
  else if (s === 1) { p.px(X, Y, c); p.px(X + 1, Y - 1, v); }
  else if (s === 2) { p.px(X, Y, c); p.px(X, Y - 1, v); }
  else { p.px(X, Y, v); p.px(X + 1, Y + 1, c); }
}

/** A drifting bit (leaf, feather, flake) in local space: a deterministic flight from its spawn. */
export interface Bit { x: number; y: number; vx: number; vy: number; g: number; drag: number; life: number; t: number; spin: number; c: number; v: number }
export function bits(R: Rng, n: number, at: (i: number) => Partial<Bit> & { x: number; y: number }): Bit[] {
  return Array.from({ length: n }, (_, i) => ({ vx: 0, vy: 0, g: 40, drag: 2, life: 0.6, t: 0, spin: R.range(0, 4), c: K.leaf1, v: K.leaf3, ...at(i) }));
}
export function stepBits(list: Bit[], dt: number): void {
  for (const b of list) {
    if (b.t >= b.life) continue;
    b.t += dt; b.vx -= b.vx * b.drag * dt; b.vy += b.g * dt - b.vy * b.drag * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.spin += dt * 14;
  }
}
export function drawLeaves(p: Painter, list: Bit[]): void {
  for (const b of list) if (b.t < b.life && b.t > 0) leaf(p, b.x, b.y, b.spin, b.c, b.v);
}
export function drawFeathers(p: Painter, list: Bit[]): void {
  for (const b of list) if (b.t < b.life && b.t > 0) feather(p, b.x, b.y, (Math.floor(b.spin) % 3) - 1, b.c, b.v);
}

/** Sparks for steel hits: white to gray, the hand-drawn arrows' look. */
export const STEEL_SPARKS = ['#fcfcfc', '#f8d878', '#bcbcbc', '#7c7c7c'];
/** Spray n splinters (wood and steel) out of (x, y) around direction ang. */
export function splinters(ps: Particles, R: Rng, x: number, y: number, n: number, ang: number, spread = 0.9): void {
  for (let i = 0; i < n; i++) {
    const a = ang + R.range(-spread, spread), sp = R.range(40, 90);
    ps.spawn(P.GRIT, x, y, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.15, 0.3), i % 2 ? K.wood : K.steel, 1);
  }
}

/** A four-point glint (no glow): arms of length n, white core. */
export function glint(p: Painter, x: number, y: number, n: number, c: number, tip = c): void {
  const X = Math.round(x), Y = Math.round(y), m = Math.round(n);
  for (let d = 1; d <= m; d++) { const cc = d > m * 0.6 ? tip : c; p.px(X + d, Y, cc); p.px(X - d, Y, cc); p.px(X, Y + d, cc); p.px(X, Y - d, cc); }
  p.px(X, Y, K.white);
}

/** A reticle: four corner brackets at radius r round (x, y), and a center dot. */
export function reticle(p: Painter, x: number, y: number, r: number, c: number, dot = true): void {
  const X = Math.round(x), Y = Math.round(y), R = Math.round(r);
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const cx = X + sx * R, cy = Y + sy * R;
    p.rect(Math.min(cx, cx - sx * 2), cy, 3, 1, c); p.rect(cx, Math.min(cy, cy - sy * 2), 1, 3, c);
  }
  if (dot) p.px(X, Y, c);
}

/** A ring drawn as single pixels (sound, a lasso, a rune): radius rx, ry, every `gap`th pixel left out. */
export function pixRing(p: Painter, x: number, y: number, rx: number, ry: number, c: number, gap = 0, a = 1): void {
  const n = Math.max(8, Math.round((rx + ry) * 3));
  for (let i = 0; i < n; i++) {
    if (gap && i % gap === 0) continue;
    const an = (i / n) * Math.PI * 2;
    p.dot(x + Math.cos(an) * rx, y + Math.sin(an) * ry, c, a);
  }
}

/** Trap jaws on the floor: teeth top and bottom, `open` 0 shut to 1 wide, the plate under them. */
export function jaws(p: Painter, open: number, c: number, plate: number): void {
  const g = Math.round(4 * open);
  for (let i = 0; i < 5; i++) { p.rect(-8 + i * 4, -3 - g, 2, 2, c); p.rect(-6 + i * 4, -1 + g - 1, 2, 2, c); }
  p.rect(-9, 0, 19, 1, plate);
}

/** n diagonal rakes torn top to bottom as k goes 0..1, then pulled out from the top as `gone` goes 0..1 (no
 *  dithered fade: at this size a fading claw reads as mush). */
export function rakes(p: Painter, n: number, k: number, gone: number, hot: number, body: number, x0 = -8, y0 = -20, len = 10, gap = 5): void {
  const L = Math.round(len * k), G = Math.round(len * gone);
  for (let i = 0; i < n; i++) for (let j = G; j < L; j++) p.px(x0 + i * gap + Math.round(j * 0.6), y0 + j + (i % 2), j > L - 3 ? hot : body);
}
/** A plunging arrow, point down at (x, y), leaning `lean` px per 8 rows (the direction it came from). */
export function plunge(p: Painter, x: number, y: number, lean: number, a = 1, len = 9): void {
  const X = Math.round(x), Y = Math.round(y);
  for (let j = 1; j < len; j++) p.dot(X - Math.round((lean * j) / 8), Y - j, K.wood, a);
  p.dot(X, Y, K.white, a); p.dot(X - 1, Y - 1, K.steel, a); p.dot(X + 1, Y - 1, K.steel, a);
  const tx = X - Math.round((lean * len) / 8), ty = Y - len;
  p.dot(tx - 1, ty, K.white, a); p.dot(tx + 1, ty, K.white, a); p.dot(tx, ty - 1, K.white, a);
}

// ---------- the pets, copied from battleView so a shot effect can carry its creature ----------
export const WOLF = [
  '..................k..k..',
  '..................kbbk..',
  '.................bbbbbb.',
  '.................bbebbbbn',
  'hh..............bbbbbwww',
  'hhh.hhhhhhhhhhhbbbbbww..',
  '.hbbbbbbbbbbbbbbbbbbw...',
  '..bbbbbbbbbbbbbbbbbb....',
  '..b.bbbbbbbbbbbbbbbb....',
  '.....wwwwbbbbbbwwwbb....',
];
export const WOLF_LEGS = [
  ['.....bb.bb.....bb.bb....', '....bb...bb...bb...bb...', '...bb.....bb.bb.....bb..', '...kk.....kk.kk.....kk..'],
  ['.....bbbb......bbbb.....', '.....bbbb......bbbb.....', '.....b..b......b..b.....', '.....kk.kk.....kk.kk....'],
];
export const WOLF_COL: Record<string, string> = { b: '#7c7c7c', h: '#bcbcbc', w: '#fcfcfc', e: '#f8b800', n: '#000000', k: '#3c3c3c' };
export const HAWK_UP = [
  'b................b..',
  'bb..............bb..',
  '.bbh...........hbb..',
  '..bbhh.......hhbb...',
  '...bbbbh...hbbbb.ww.',
  '....bbbbbbbbbbbbwwwe',
  '.....bbbbbbbbbbbbw.e',
  '..kkbbbbbbbbbb......',
  '...k...k.k..........',
];
export const HAWK_DOWN = [
  '....................',
  '................ww..',
  '...............wwwe.',
  '..kkbbbbbbbbbbbbbw.e',
  '...kbbbbbbbbbbbbb...',
  '....hbbbbbbbbbbbh...',
  '...hbbb.k.k...bbbh..',
  '..hbb..........bbh..',
  '.hb..............bh.',
];
export const HAWK_COL: Record<string, string> = { b: '#ac7c00', h: '#f8d878', w: '#fcfcfc', e: '#f8b800', k: '#503000' };

/** Pixel rows with a black outline (3x3 under every pixel, like battleView's drawPix), centered on x with the last
 *  row on y, facing +x. The painter mirrors it for the right-hand side. */
export function drawPix(p: Painter, rows: string[], pal: Record<string, string>, x: number, y: number): void {
  const w = Math.max(...rows.map(r => r.length)), x0 = Math.round(x) - (w >> 1), y0 = Math.round(y) - rows.length + 1;
  rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') p.rect(x0 + i - 1, y0 + j - 1, 3, 3, K.ink); }));
  rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') p.px(x0 + i, y0 + j, hex(pal[ch])); }));
}
