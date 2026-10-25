// Cartridge-style NES fighters, extracted from the round-3 sprite page (art/sprite-styles-round3.html).
// Rogue, Ranger and Cleric are the Classic set (art/classic-sprites.ts); their skins recolor the tint letters b/c/d.
import type { Ctx } from '../engine/gfx';

export type ClassId = 'warrior' | 'mage' | 'rogue' | 'ranger' | 'cleric';

interface SpriteDef { pal: string[]; rows: string[]; ax: number }

const DEFS: Record<ClassId, SpriteDef> = {
  warrior: {
    // m (face) starts as the horn color b; skins recolor them separately
    pal: ['#000000', '#fce0a8', '#ac7c00', '#fcfcfc', '#7c7c7c', '#bcbcbc', '#e45c10', '#d82800', '#f87858', '#f8b800', '#881400', '#503000', '#fce0a8'],
    rows: ['....aa.......a...', '...abca.....aba..', '.a.aba......aba..', 'adaabcaaaaaaabca.', 'adeaabcdffffbca..', '.adeaaffffffaa...', '..adeaffffmaba...', '...adaffffmgga...', '...addffeeeedaaa.', '..affffeeeeddfffa', '..affeehhhhdijhfa', '...aeehffhhjjjjea', '...akhhfekkfhjkea', '..akkkkkkkjfhjea.', '..akkhhhhhkkeja..', '..akllfeaafeaea..', '...aaaklaaklla...', '......aa..aaa....'],
    ax: 9,
  },
  mage: {
    // m is a spare slot for skin detail pixels (stars, leaves)
    pal: ['#000000', '#6888fc', '#0058f8', '#ac7c00', '#00e8d8', '#008888', '#f8b800', '#0000a8', '#fce0a8', '#e45c10', '#fcfcfc', '#bcbcbc', '#fcfcfc'],
    rows: ['...aa........', '..abba...aaa.', '...acca.adeea', '....accaadefa', '....acghaddda', '...achhhaada.', '.aabgggggcda.', 'acccccchhhha.', '.aaaiiiajada.', '....aikkkada.', '...abckklada.', '...accclcada.', '...acccchhia.', '..aggggggaja.', '..accccghada.', '..acchhghada.', '.achhhhddhda.', 'agggggggggda.', '.aaaaaaaaada.', '..........a..'],
    ax: 6,
  },
  rogue: {
    pal: ['#000000', '#9878f8', '#6844fc', '#4428bc', '#fce0a8', '#3c3c3c', '#7c7c7c', '#bcbcbc', '#fcfcfc', '#503000', '#58d854'],
    rows: ['.....aaa.........', '....abbca........', '...abbccca.......', '...abccccca......', '..abccaaaaca.....', '..abcagggfa......', '..abcagfiffa.....', '..abccacddda.....', '.abcccddddda...a.', '.abccddffffda.aia', 'abccdffffffdaahia', 'abcdafggffaeahaa.', 'abdaffjjjjjaeaa..', '.aa.affgaffaa....', '..ahaffa.affa....', '..aiaffa..affa...', '...aaaa...aaaa...'],
    ax: 8,
  },
  ranger: {
    pal: ['#000000', '#b8f818', '#00a800', '#005800', '#fce0a8', '#ac7c00', '#503000', '#fcfcfc', '#d82800', '#bcbcbc', '#000000', '#e4a060'],
    rows: ['........ia..........', '.h....aaaia.aa......', 'ahaa.abbbcda.hfa....', 'ahgaabbcccdda.h.fa..', 'agfabcccccddah..fa..', '.afaaaeeelaa.h..fa..', '.afa.aeekea..h...fa.', '.afa.adeela..h...fa.', '.agaaccdddcaah...fa.', 'aaccbccccdcccccaaea.', 'acbbccccddaaaaaaaea.', 'acbcccgggga..h...fa.', '.adbccfjfda..h..fa..', '.adccdgggga..h..fa..', '..adddcdddca.h.fa...', '...adda.adda.hfa....', '...afga..afga.aa....', '..afggga.afgga......', '..aaaaa..aaaaa......'],
    ax: 8,
  },
  cleric: {
    pal: ['#000000', '#fcfcfc', '#bcbcbc', '#7c7c7c', '#fce0a8', '#f8b800', '#ac7c00', '#f8d878', '#fcfcfc', '#bcbcbc', '#000000', '#e4a060'],
    rows: ['....aaaaaa.......', '...ahhhhhfa..aaa.', '....aaaaaa..ajija', '....abbbca..ajjja', '...abbbbcca.ajija', '..acbfeeelfa.aga.', '..acbfeekefa.aga.', '..acbfeeelfa.aga.', '..acbbfeeffa..ga.', '.acbbbbffbbbccea.', 'acbcbbfgfbbcaaga.', 'acdcbbbffbcca.ga.', 'acdcbbfffbcca..a.', '.acdcbbfbbbcca...', '.acdcbbfbbbbcca..', 'acdccbbfbbbccda..', 'affffffffffffgga.', '.aaaaaaaaaaaaaa..'],
    ax: 8,
  },
};

/** A skin recolors palette letters and may repaint a few inner pixels; the outline never changes. */
export interface Skin { id: string; name: string; set: Record<string, string>; px?: Array<[number, number, string]> }

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
  cleric: [
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
export const defaultSkin = (cls: ClassId): string => SKINS[cls][0].id;

/** Mirror matches: when both pick the same class and color, the second player takes the next color. */
export function mirrorSkin(cls: ClassId, mine: string, theirs: string): string {
  const list = SKINS[cls], a = skinOf(cls, mine).id, b = skinOf(cls, theirs).id;
  return a === b ? list[(list.findIndex(s => s.id === b) + 1) % list.length].id : b;
}

/** Palette and pixel rows for a class in a skin (plus the mirror-match ALT recolor). */
function skinned(cls: ClassId, skinId: string, alt: boolean): { pal: string[]; rows: string[] } {
  const def = DEFS[cls], skin = skinOf(cls, skinId);
  const pal = def.pal.slice();
  for (const [ch, col] of Object.entries(skin.set)) pal[ch.charCodeAt(0) - 97] = col;
  if (alt) for (const [i, col] of Object.entries(ALT[cls])) pal[+i] = col;
  const rows = def.rows.map(r => r.split(''));
  for (const [x, y, ch] of skin.px ?? []) if (rows[y][x] !== '.' && rows[y][x] !== 'a') rows[y][x] = ch;
  return { pal, rows: rows.map(r => r.join('')) };
}

// Alternate palettes for mirror matches (the CPU's copy). Keys are palette indices to replace.
const ALT: Record<ClassId, Record<number, string>> = {
  warrior: { 7: '#00a800', 10: '#005800', 8: '#58d854' },
  mage: { 1: '#f878f8', 2: '#d800cc', 7: '#940084' },
  rogue: {}, ranger: {}, cleric: {},
};

export type Tint = 'none' | 'flash' | 'ice' | 'stun' | 'ghost';

export interface Sprite { w: number; h: number; ax: number; img: Record<Tint, HTMLCanvasElement> }

const cache = new Map<string, Sprite>();

function bake(def: { rows: string[] }, pal: string[], tint: Tint): HTMLCanvasElement {
  const w = def.rows[0].length, h = def.rows.length;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d')!;
  def.rows.forEach((row, j) => {
    for (let i = 0; i < w; i++) {
      const ch = row[i];
      if (ch === '.') continue;
      const idx = ch.charCodeAt(0) - 97;
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
    const def = DEFS[cls];
    const { pal, rows } = skinned(cls, skin, alt);
    const tints: Tint[] = ['none', 'flash', 'ice', 'stun', 'ghost'];
    const img = {} as Record<Tint, HTMLCanvasElement>;
    for (const t of tints) img[t] = bake({ rows }, pal, t);
    s = { w: def.rows[0].length, h: def.rows.length, ax: def.ax, img };
    cache.set(key, s);
  }
  return s;
}

/** Draw with feet at (footX, footY). `flip` mirrors so the sprite faces left. */
export function drawFighterSprite(c: Ctx, s: Sprite, footX: number, footY: number, flip: boolean, tint: Tint = 'none', scale = 1): void {
  const ax = flip ? s.w - 1 - s.ax : s.ax;
  const img = s.img[tint];
  const x = Math.round(footX - ax * scale), y = Math.round(footY - s.h * scale);
  if (!flip) { c.drawImage(img, x, y, s.w * scale, s.h * scale); return; }
  c.save();
  c.translate(x + s.w * scale, y);
  c.scale(-1, 1);
  c.drawImage(img, 0, 0, s.w * scale, s.h * scale);
  c.restore();
}

/** The main team color of a fighter, for HUD accents. */
export function teamColor(cls: ClassId, skin: string, alt: boolean): string {
  // the tabard (Warrior h), robe (Mage c) or the mid tint tone (c) of the Classic set
  return skinned(cls, skin, alt).pal[cls === 'warrior' ? 7 : 2];
}
