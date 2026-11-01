// The fighters: 48px PixelLab art (assets/fighters/, see art/pl) baked once per skin and hit tint.
import type { Ctx } from '../engine/gfx';
import type { FrameId, FrameSet } from './fighterFrames';
import { PL, PL_RES } from './pl';

export type { ClassId } from '../content/classes/registry';
import type { ClassId } from '../content/classes/registry';

/** A skin recolors palette letters and may repaint a few inner pixels; the outline never changes. */
export interface Skin {
  id: string; name: string; set: Record<string, string>; px?: Array<[number, number, string]>;
  /** A skin with its own drawn art (a skin mod, see docs/MODDING.md) instead of a recolor. */
  art?: SkinArt;
}

/** Drawn art for a skin: its own palette, every animation frame, and optionally a portrait. Plain data. */
export interface SkinArt {
  /** Palette by letter index ('a' is index 0, the outline). */
  pal: string[];
  /** Palette letter of the main cloth color (HUD ribbons, swatches). */
  team: string;
  /** Column of the feet in the frames, in sprite pixels. */
  ax: number;
  /** Sprite pixels per world pixel (2 for the 48px HD fighters). */
  res: number;
  /** Animation frames, the same ids and size as the class's own; idle0 is required, missing ones fall back to it. */
  frames: Partial<Record<FrameId, string[]>>;
  /** Character select bust, the same size as the class's own portrait. */
  portrait?: string[];
}

// Fighting-game style colors from the approved skins page (art/skins-data.ts). The first is the default.
export const SKINS: Record<ClassId, Skin[]> = {
  warrior: [
    { id: 'red', name: 'Red', set: { f: '#f87858', e: '#881400', i: '#f87858', h: '#d82800', k: '#881400', j: '#f8b800' } },
    { id: 'blue', name: 'Blue', set: { f: '#6888fc', e: '#0000a8', i: '#6888fc', h: '#0058f8', k: '#0000a8', j: '#f8b800' } },
    { id: 'green', name: 'Green', set: { f: '#58d854', e: '#005800', i: '#58d854', h: '#00a800', k: '#005800', j: '#f8b800' } },
    { id: 'yellow', name: 'Yellow', set: { f: '#f8d878', e: '#ac7c00', i: '#f8d878', h: '#f8b800', k: '#ac7c00', j: '#d82800' } },
    { id: 'purple', name: 'Purple', set: { f: '#9878f8', e: '#4428bc', i: '#9878f8', h: '#6844fc', k: '#4428bc', j: '#f8b800' } },
    { id: 'pink', name: 'Pink', set: { f: '#f8b8f8', e: '#d800cc', i: '#f8b8f8', h: '#f878f8', k: '#d800cc', j: '#fcfcfc' } },
    { id: 'black', name: 'Black', set: { f: '#7c7c7c', e: '#3c3c3c', i: '#7c7c7c', h: '#3c3c3c', k: '#000000', j: '#d82800' } },
    { id: 'white', name: 'White', set: { f: '#fcfcfc', e: '#bcbcbc', i: '#fcfcfc', h: '#fcfcfc', k: '#bcbcbc', j: '#f8b800' } },
  ],
  mage: [
    { id: 'blue', name: 'Blue', set: {} },
    { id: 'red', name: 'Red', set: { b: '#f87858', c: '#d82800', h: '#881400', g: '#f8b800' } },
    { id: 'green', name: 'Green', set: { b: '#58d854', c: '#00a800', h: '#005800', g: '#f8b800' } },
    { id: 'yellow', name: 'Yellow', set: { b: '#f8d878', c: '#f8b800', h: '#ac7c00', g: '#d82800' } },
    { id: 'purple', name: 'Purple', set: { b: '#9878f8', c: '#6844fc', h: '#4428bc', g: '#f8b800' } },
    { id: 'pink', name: 'Pink', set: { b: '#f8b8f8', c: '#f878f8', h: '#d800cc', g: '#fcfcfc' } },
    { id: 'black', name: 'Black', set: { b: '#7c7c7c', c: '#3c3c3c', h: '#000000', g: '#d82800' } },
    { id: 'white', name: 'White', set: { b: '#fcfcfc', c: '#fcfcfc', h: '#bcbcbc', g: '#f8b800', k: '#bcbcbc', l: '#7c7c7c' } },
  ],
  rogue: [
    { id: 'purple', name: 'Purple', set: {} },
    { id: 'red', name: 'Red', set: { b: '#f87858', c: '#d82800', d: '#881400' } },
    { id: 'blue', name: 'Blue', set: { b: '#6888fc', c: '#0058f8', d: '#0000a8' } },
    { id: 'green', name: 'Green', set: { b: '#58d854', c: '#00a800', d: '#005800' } },
    { id: 'yellow', name: 'Yellow', set: { b: '#f8d878', c: '#f8b800', d: '#ac7c00' } },
    { id: 'pink', name: 'Pink', set: { b: '#f8b8f8', c: '#f878f8', d: '#d800cc' } },
    { id: 'black', name: 'Black', set: { b: '#7c7c7c', c: '#3c3c3c', d: '#1c1c1c' } },
    { id: 'white', name: 'White', set: { b: '#fcfcfc', c: '#bcbcbc', d: '#7c7c7c' } },
  ],
  ranger: [
    { id: 'green', name: 'Green', set: {} },
    { id: 'red', name: 'Red', set: { b: '#f87858', c: '#d82800', d: '#881400' } },
    { id: 'blue', name: 'Blue', set: { b: '#6888fc', c: '#0058f8', d: '#0000a8' } },
    { id: 'yellow', name: 'Yellow', set: { b: '#f8d878', c: '#f8b800', d: '#ac7c00' } },
    { id: 'purple', name: 'Purple', set: { b: '#9878f8', c: '#6844fc', d: '#4428bc' } },
    { id: 'pink', name: 'Pink', set: { b: '#f8b8f8', c: '#f878f8', d: '#d800cc' } },
    { id: 'black', name: 'Black', set: { b: '#7c7c7c', c: '#3c3c3c', d: '#1c1c1c' } },
    { id: 'white', name: 'White', set: { b: '#fcfcfc', c: '#bcbcbc', d: '#7c7c7c' } },
  ],
  priest: [
    { id: 'white', name: 'White', set: {} },
    { id: 'red', name: 'Red', set: { b: '#f87858', c: '#d82800', d: '#881400' } },
    { id: 'blue', name: 'Blue', set: { b: '#6888fc', c: '#0058f8', d: '#0000a8' } },
    { id: 'green', name: 'Green', set: { b: '#58d854', c: '#00a800', d: '#005800' } },
    { id: 'yellow', name: 'Yellow', set: { b: '#f8d878', c: '#f8b800', d: '#ac7c00' } },
    { id: 'purple', name: 'Purple', set: { b: '#9878f8', c: '#6844fc', d: '#4428bc' } },
    { id: 'pink', name: 'Pink', set: { b: '#f8b8f8', c: '#f878f8', d: '#d800cc' } },
    { id: 'black', name: 'Black', set: { b: '#7c7c7c', c: '#3c3c3c', d: '#1c1c1c' } },
  ],
};

export const skinOf = (cls: ClassId, id: string): Skin => SKINS[cls].find(s => s.id === id) ?? SKINS[cls][0];

/** Add a skin with drawn art to a class (skin mods). Built-ins keep their order; mod skins go after them. */
export function addSkin(cls: ClassId, skin: Skin): boolean {
  const list = SKINS[cls];
  if (!list || list.some(s => s.id === skin.id)) return false;
  list.push(skin);
  return true;
}

/** Take a mod skin off a class again (a mod switched off or deleted). Built-in skins stay. */
export function removeSkin(cls: ClassId, id: string): boolean {
  const list = SKINS[cls], i = list ? list.findIndex(s => s.id === id && s.art) : -1;
  if (i < 0) return false;
  list.splice(i, 1);
  // drop everything drawn from it, so a skin of the same id added later is drawn fresh
  for (const m of [cache, frameCache, portraitCache] as Array<Map<string, unknown>>) {
    for (const k of [...m.keys()]) if (k === `${cls}:${id}` || k.startsWith(`${cls}:${id}:`)) m.delete(k);
  }
  return true;
}

/** The idle frame trimmed to its opaque columns and rows, as the still sprite of an art skin. */
function artStill(art: SkinArt): { rows: string[]; ax: number } {
  const f = art.frames.idle0!;
  let x0 = f[0].length, x1 = -1, y0 = f.length;
  f.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] !== '.') { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); } });
  return { rows: f.slice(y0).map(r => r.slice(x0, x1 + 1)), ax: art.ax - x0 };
}
export const defaultSkin = (cls: ClassId): string => SKINS[cls][0].id;

/**
 * Mirror matches: when both pick the same class and color, the second player takes the next color. A mod skin is a
 * look someone chose on purpose, so both sides may wear it (the grid colors still tell them apart).
 */
export function mirrorSkin(cls: ClassId, mine: string, theirs: string): string {
  const b = skinOf(cls, theirs);
  if (b.art || skinOf(cls, mine).id !== b.id) return b.id;
  const colors = SKINS[cls].filter(s => !s.art);
  return colors[(colors.findIndex(s => s.id === b.id) + 1) % colors.length].id;
}

/** Palette and still-sprite pixel rows for a class in a skin. */
function skinned(cls: ClassId, skinId: string): { pal: string[]; rows: string[] } {
  const art = skinOf(cls, skinId).art;
  if (art) return { pal: art.pal, rows: artStill(art).rows };
  return { pal: plPalette(cls, skinId), rows: PL[cls].frames.idle0! };
}

// ---------- PixelLab fighter skins ----------
// The PixelLab art has its own palette, so a skin is a hue shift of the main cloth/armor color family: the
// skin's color (the same skin on the 24px set, at its team letter) against that set's default sets the shift.
const hex = (c: string): [number, number, number] => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)) as [number, number, number];
function hsl(c: string): [number, number, number] {
  const [r, g, b] = hex(c).map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function css([h, s, l]: [number, number, number]): string {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [r, g, b].map(v => Math.round(Math.min(1, Math.max(0, v + m)) * 255).toString(16).padStart(2, '0')).join('');
}
const plPals = new Map<string, string[]>();
const hueGap = (a: number, b: number): number => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
/** The color each built-in skin name stands for, as the PixelLab skin target (the NES mid step). */
const SKIN_HUE: Record<string, string> = {
  red: '#d82800', blue: '#0058f8', green: '#00a800', yellow: '#f8b800',
  purple: '#6844fc', pink: '#f878f8', black: '#3c3c3c', white: '#fcfcfc',
};
function plPalette(cls: ClassId, skinId: string): string[] {
  const pl = PL[cls], skin = skinOf(cls, skinId).id, key = `${cls}:${skin}`;
  let pal = plPals.get(key);
  if (pal) return pal;
  pal = pl.pal.slice();
  const [th, ts, tl] = hsl(pl.pal[letterIndex(pl.team)]);
  // a skin recolors the art's team color family to its named color; the art keeps its own colors when it already
  // wears that hue, and the default skin also keeps them when it is black or white
  let to: string | undefined = SKIN_HUE[skin];
  // a black or white default (the Priest's robe) is worn as the robe: color skins also tint its light grays
  const def = SKIN_HUE[defaultSkin(cls)], robe = !!def && hsl(def)[1] < 0.16 && !!to && skin !== defaultSkin(cls);
  if (to && !robe) {
    const [h1, s1] = hsl(to);
    if (s1 >= 0.16 ? hueGap(h1, th) < 24 : skin === defaultSkin(cls)) to = undefined;
  }
  if (to && ts >= 0.16) {
    // recolor the art's team color family (colors within 32 degrees of it) so its team color lands on the target
    const [h1, s1, l1] = hsl(to), gray = s1 < 0.16;
    pal = pal.map((c, i) => {
      const [ch, cs, cl] = hsl(c);
      if (robe && i && cs < 0.16 && cl > 0.55) return gray ? css([0, 0, cl * 0.42]) : css([h1, 0.45, cl * 0.92]);
      if (i === 0 || cs < 0.16 || hueGap(ch, th) >= 32) return c;
      const l = Math.min(0.95, Math.max(0.04, cl + (l1 - tl) * 0.8));
      return gray ? css([ch, cs * 0.12, l]) : css([(ch + h1 - th + 360) % 360, Math.min(1, cs * s1 / ts), l]);
    });
  }
  plPals.set(key, pal);
  return pal;
}

export type Tint = 'none' | 'flash' | 'ice' | 'stun' | 'ghost';

/** w, h and ax are in world pixels; `res` is sprite pixels per world pixel. */
export interface Sprite { w: number; h: number; ax: number; res: number; img: Record<Tint, HTMLCanvasElement> }

const cache = new Map<string, Sprite>();

/** Palette index of a pixel letter: a-z are 0-25, A-Z 26-51, 0-9 52-61 (the 24px art only uses a-z). */
const letterIndex = (ch: string): number => {
  const k = ch.charCodeAt(0);
  return k >= 97 ? k - 97 : k >= 65 ? k - 39 : k + 4;
};

function bake(def: { rows: string[] }, pal: string[], tint: Tint): HTMLCanvasElement {
  const w = def.rows[0].length, h = def.rows.length;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d')!;
  def.rows.forEach((row, j) => {
    for (let i = 0; i < w; i++) {
      const ch = row[i];
      if (ch === '.') continue;
      const idx = letterIndex(ch);
      let col = pal[idx];
      if (tint === 'flash') col = idx === 0 ? '#000000' : '#fcfcfc';
      if (tint === 'ice') col = idx === 0 ? '#0058f8' : ['#fcfcfc', '#a4e4fc', '#3cbcfc'][(i + j + idx) % 3];
      if (tint === 'stun') col = idx === 0 ? '#000000' : idx % 2 ? '#f8b800' : pal[idx];
      if (tint === 'ghost') col = idx === 0 ? '#3c3c3c' : '#7c7c7c';
      c.fillStyle = col;
      c.fillRect(i, j, 1, 1);
    }
  });
  return cv;
}

export function getSprite(cls: ClassId, skin: string, alt: boolean): Sprite {
  const key = `${cls}:${skin}${alt ? ':alt' : ''}`;
  let s = cache.get(key);
  if (!s) {
    const { pal, rows } = skinned(cls, skin);
    const tints: Tint[] = ['none', 'flash', 'ice', 'stun', 'ghost'];
    const img = {} as Record<Tint, HTMLCanvasElement>;
    for (const t of tints) img[t] = bake({ rows }, pal, t);
    const art = skinOf(cls, skin).art;
    const ax = art ? artStill(art).ax : PL[cls].ax;
    const res = art ? art.res : PL_RES;
    s = { w: rows[0].length / res, h: rows.length / res, ax: ax / res, res, img };
    cache.set(key, s);
  }
  return s;
}

const frameCache = new Map<string, Sprite>();
/** One animation frame of a fighter in a skin. Falls back to the idle frame. */
export function getFrame(cls: ClassId, skin: string, alt: boolean, frame: FrameId): Sprite {
  const art = skinOf(cls, skin).art;
  const set: FrameSet = art ?? PL[cls], id = set.frames[frame] ? frame : 'idle0';
  const key = `${cls}:${skin}${alt ? ':alt' : ''}:${id}`;
  let s = frameCache.get(key);
  if (!s) {
    const pal = art ? art.pal : plPalette(cls, skin), rows = set.frames[id]!;
    const img = {} as Record<Tint, HTMLCanvasElement>;
    for (const t of ['none', 'flash', 'ice', 'stun', 'ghost'] as Tint[]) img[t] = bake({ rows }, pal, t);
    const res = art ? art.res : PL_RES;
    s = { w: rows[0].length / res, h: rows.length / res, ax: set.ax / res, res, img };
    frameCache.set(key, s);
  }
  return s;
}

const portraitCache = new Map<string, HTMLCanvasElement>();
/** A class's character select portrait in a skin, one canvas pixel per portrait pixel. */
export function getPortrait(cls: ClassId, skin: string): HTMLCanvasElement {
  const key = `${cls}:${skinOf(cls, skin).id}`;
  let img = portraitCache.get(key);
  if (!img) {
    const art = skinOf(cls, skin).art;
    // an art skin without its own portrait shows the class's default one
    img = art && !art.portrait ? getPortrait(cls, defaultSkin(cls))
      : bake({ rows: art?.portrait ?? PL[cls].portrait }, skinned(cls, skin).pal, 'none');
    portraitCache.set(key, img);
  }
  return img;
}

/** Draw with feet at (footX, footY). `flip` mirrors so the sprite faces left. */
export function drawFighterSprite(c: Ctx, s: Sprite, footX: number, footY: number, flip: boolean, tint: Tint = 'none', scale = 1): void {
  const img = s.img[tint], px = scale / s.res; // size of one sprite pixel where we draw
  const ax = flip ? img.width - 1 - s.ax * s.res : s.ax * s.res;
  const snap = (v: number): number => Math.round(v / px) * px;
  const x = snap(footX - ax * px), y = snap(footY - img.height * px), w = img.width * px, h = img.height * px;
  if (!flip) { c.drawImage(img, x, y, w, h); return; }
  c.save();
  c.translate(x + w, y);
  c.scale(-1, 1);
  c.drawImage(img, 0, 0, w, h);
  c.restore();
}

/** A pose for drawFighterPosed. Pixel art stays crisp: rows are resampled or shifted whole, never blended. */
export interface Pose {
  /** Vertical scale, feet planted (0.8 = crouch, 1.1 = stretch). */
  sy?: number;
  /** Pixels the top row shifts toward the facing direction (negative leans back); lower rows shift less. */
  lean?: number;
  /** Rows hidden from the top (a dissolve eating down the body). */
  cut?: number;
  /** Interlace: draw only every other row, offset by `scan` (0 or 1). */
  scan?: number;
}

const flipped = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
function mirrored(img: HTMLCanvasElement): HTMLCanvasElement {
  let m = flipped.get(img);
  if (!m) {
    m = document.createElement('canvas'); m.width = img.width; m.height = img.height;
    const c = m.getContext('2d')!;
    c.translate(img.width, 0); c.scale(-1, 1); c.drawImage(img, 0, 0);
    flipped.set(img, m);
  }
  return m;
}

/** drawFighterSprite with a pose: squash and stretch, lean, dissolve. */
export function drawFighterPosed(c: Ctx, s: Sprite, footX: number, footY: number, flip: boolean, tint: Tint = 'none', pose: Pose = {}): void {
  const src = flip ? mirrored(s.img[tint]) : s.img[tint];
  const w = src.width, h = src.height, px = 1 / s.res;
  const ax = (flip ? w - 1 - s.ax * s.res : s.ax * s.res) * px;
  const fx = Math.round(footX), fy = Math.round(footY), d = flip ? -1 : 1;
  const sy = pose.sy ?? 1, lean = pose.lean ?? 0, cut = pose.cut ?? 0;
  const dh = Math.max(1, Math.round(h * sy));
  for (let r = 0; r < dh; r++) {
    const row = Math.min(h - 1, Math.floor((r * h) / dh));
    if (row < cut) continue;
    if (pose.scan !== undefined && (r & 1) !== pose.scan) continue;
    const t = dh > 1 ? (dh - 1 - r) / (dh - 1) : 0;
    const off = Math.round(lean * t) * d;
    c.drawImage(src, 0, row, w, 1, fx - ax + off * px, fy - (dh - r) * px, w * px, px);
  }
}

const pixCache = new WeakMap<Sprite, Array<Array<[number, string]>>>();
/** The opaque pixels of each row of a sprite (x from its left edge, css color), for dissolves. */
export function spriteRows(s: Sprite): Array<Array<[number, string]>> {
  let rows = pixCache.get(s);
  if (!rows) {
    const img = s.img.none, d = img.getContext('2d')!.getImageData(0, 0, img.width, img.height).data;
    rows = [];
    for (let y = 0; y < img.height; y++) {
      const row: Array<[number, string]> = [];
      for (let x = 0; x < img.width; x++) {
        const i = (y * img.width + x) * 4;
        if (d[i + 3] > 0) row.push([x, `rgb(${d[i]},${d[i + 1]},${d[i + 2]})`]);
      }
      rows.push(row);
    }
    pixCache.set(s, rows);
  }
  return rows;
}

/** The main team color of a fighter, for HUD accents. */
export function teamColor(cls: ClassId, skin: string, _alt: boolean): string {
  const art = skinOf(cls, skin).art;
  if (art) return art.pal[letterIndex(art.team)];
  return plPalette(cls, skin)[letterIndex(PL[cls].team)];
}
