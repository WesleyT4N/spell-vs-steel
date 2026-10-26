// 5x7 bitmap font. Each glyph is 7 rows of 5 bits ('#' = ink). Advance is 6px, line height 8px.
const G: Record<string, string> = {
  A: '.###.|#...#|#...#|#####|#...#|#...#|#...#',
  B: '####.|#...#|#...#|####.|#...#|#...#|####.',
  C: '.###.|#...#|#....|#....|#....|#...#|.###.',
  D: '####.|#...#|#...#|#...#|#...#|#...#|####.',
  E: '#####|#....|#....|####.|#....|#....|#####',
  F: '#####|#....|#....|####.|#....|#....|#....',
  G: '.###.|#...#|#....|#.###|#...#|#...#|.####',
  H: '#...#|#...#|#...#|#####|#...#|#...#|#...#',
  I: '.###.|..#..|..#..|..#..|..#..|..#..|.###.',
  J: '..###|...#.|...#.|...#.|...#.|#..#.|.##..',
  K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#',
  L: '#....|#....|#....|#....|#....|#....|#####',
  M: '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#',
  N: '#...#|#...#|##..#|#.#.#|#..##|#...#|#...#',
  O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.',
  P: '####.|#...#|#...#|####.|#....|#....|#....',
  Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#',
  R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
  S: '.####|#....|#....|.###.|....#|....#|####.',
  T: '#####|..#..|..#..|..#..|..#..|..#..|..#..',
  U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.',
  V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..',
  W: '#...#|#...#|#...#|#.#.#|#.#.#|#.#.#|.#.#.',
  X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
  Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..',
  Z: '#####|....#|...#.|..#..|.#...|#....|#####',
  '0': '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.',
  '1': '..#..|.##..|..#..|..#..|..#..|..#..|.###.',
  '2': '.###.|#...#|....#|...#.|..#..|.#...|#####',
  '3': '####.|....#|....#|.###.|....#|....#|####.',
  '4': '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.',
  '5': '#####|#....|####.|....#|....#|#...#|.###.',
  '6': '.###.|#....|#....|####.|#...#|#...#|.###.',
  '7': '#####|....#|...#.|..#..|.#...|.#...|.#...',
  '8': '.###.|#...#|#...#|.###.|#...#|#...#|.###.',
  '9': '.###.|#...#|#...#|.####|....#|....#|.###.',
  '.': '.....|.....|.....|.....|.....|.##..|.##..',
  ',': '.....|.....|.....|.....|.##..|..#..|.#...',
  ':': '.....|.##..|.##..|.....|.##..|.##..|.....',
  '!': '..#..|..#..|..#..|..#..|..#..|.....|..#..',
  '?': '.###.|#...#|....#|...#.|..#..|.....|..#..',
  '-': '.....|.....|.....|.###.|.....|.....|.....',
  '+': '.....|..#..|..#..|#####|..#..|..#..|.....',
  '/': '....#|....#|...#.|..#..|.#...|#....|#....',
  '%': '##..#|##..#|...#.|..#..|.#...|#..##|#..##',
  "'": '..#..|..#..|.#...|.....|.....|.....|.....',
  '(': '...#.|..#..|.#...|.#...|.#...|..#..|...#.',
  ')': '.#...|..#..|...#.|...#.|...#.|..#..|.#...',
  '<': '...#.|..#..|.#...|#....|.#...|..#..|...#.',
  '>': '.#...|..#..|...#.|....#|...#.|..#..|.#...',
  '=': '.....|.....|#####|.....|#####|.....|.....',
  '×': '.....|.....|#...#|.#.#.|..#..|.#.#.|#...#',
  '*': '.....|#.#.#|.###.|#####|.###.|#.#.#|.....',
  '#': '.#.#.|.#.#.|#####|.#.#.|#####|.#.#.|.#.#.',
  // arrows used in menus and control hints
  '↑': '..#..|.###.|#.#.#|..#..|..#..|..#..|..#..',
  '↓': '..#..|..#..|..#..|..#..|#.#.#|.###.|..#..',
  '→': '..#..|...#.|....#|#####|....#|...#.|..#..',
  '←': '..#..|.#...|#....|#####|#....|.#...|..#..',
  '●': '.....|.###.|#####|#####|#####|.###.|.....',
  '○': '.....|.###.|#...#|#...#|#...#|.###.|.....',
  ' ': '.....|.....|.....|.....|.....|.....|.....',
};

const BITS: Record<string, number[][]> = {};
for (const [ch, s] of Object.entries(G)) BITS[ch] = s.split('|').map(r => [...r].map(c => (c === '#' ? 1 : 0)));

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
    const g = BITS[ch] ?? BITS['?'], pad = outline ? 1 : 0;
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
      if (fast) c.drawImage(tile(BITS[ch] ? ch : '?', color, scale, null), cx, cy);
      else fillGlyph(c, BITS[ch] ?? BITS['?'], cx, cy, scale);
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
    if (ch !== ' ') c.drawImage(tile(BITS[ch] ? ch : '?', color, scale, outline), cx - 1, cy - 1);
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
