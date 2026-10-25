// Cartridge-style NES fighters, extracted from the round-3 sprite page (art/sprite-styles-round3.html).
import type { Ctx } from '../engine/gfx';

export type ClassId = 'warrior' | 'mage';

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
};

/** A skin recolors palette letters and may repaint a few inner pixels; the outline never changes. */
export interface Skin { id: string; name: string; set: Record<string, string>; px?: Array<[number, number, string]> }

// From the approved skins page (art/skins.html).
export const SKINS: Record<ClassId, Skin[]> = {
  warrior: [
    { id: 'base', name: 'Crimson Vanguard', set: {} },
    { id: 'gilded', name: 'Gilded Champion', set: { b: '#fcfcfc', c: '#bcbcbc', d: '#fcfcfc', e: '#ac7c00', f: '#f8d878', g: '#f8b800', h: '#fcfcfc', i: '#f8d878', j: '#d82800', k: '#bcbcbc', l: '#881400' } },
    { id: 'obsidian', name: 'Obsidian Warlord', set: { b: '#f0d0b0', c: '#7c7c7c', d: '#d8b8f8', e: '#000000', f: '#4428bc', g: '#e40058', h: '#940084', i: '#d800cc', j: '#d8b8f8', k: '#4428bc', l: '#4428bc', m: '#000000' }, px: [[11, 7, 'g']] },
    { id: 'north', name: 'Northman', set: { b: '#fcfcfc', c: '#bcbcbc', g: '#f83800', h: '#ac7c00', i: '#f0d0b0', j: '#fcfcfc', k: '#503000', l: '#881400' }, px: [[11, 8, 'g'], [12, 8, 'g'], [10, 8, 'g']] },
    { id: 'grave', name: 'Grave Knight', set: { b: '#f0d0b0', c: '#7c7c7c', d: '#b8f8d8', e: '#004058', f: '#7c7c7c', g: '#58f898', h: '#008888', i: '#00e8d8', j: '#58f898', k: '#004058', l: '#004058', m: '#bcbcbc' }, px: [[12, 7, 'm']] },
    { id: 'jade', name: 'Jade Sentinel', set: { b: '#f8b800', c: '#ac7c00', d: '#b8f8b8', e: '#00a844', f: '#58d854', g: '#503000', h: '#f8b800', i: '#f8d878', j: '#00a800', k: '#ac7c00', l: '#005800' } },
  ],
  mage: [
    { id: 'base', name: 'Azure Magus', set: {} },
    { id: 'star', name: 'Starweaver', set: { b: '#9878f8', c: '#6844fc', h: '#4428bc', g: '#f8d878', e: '#fcfcfc', f: '#f8d878', m: '#fcfcfc' }, px: [[6, 3, 'm'], [6, 5, 'm'], [4, 11, 'm'], [4, 15, 'm'], [6, 14, 'm'], [3, 16, 'm']] },
    { id: 'ember', name: 'Ember Sage', set: { b: '#d82800', c: '#a81000', h: '#881400', g: '#503000', d: '#503000', e: '#f8b800', f: '#e45c10', k: '#bcbcbc', l: '#7c7c7c' } },
    { id: 'necro', name: 'Necromancer', set: { b: '#7c7c7c', c: '#3c3c3c', h: '#4428bc', g: '#f0d0b0', d: '#f0d0b0', e: '#58f898', f: '#00a844', i: '#bcbcbc', k: '#7c7c7c', l: '#3c3c3c', j: '#bcbcbc' } },
    { id: 'druid', name: 'Verdant Druid', set: { b: '#58d854', c: '#00a800', h: '#005800', g: '#ac7c00', d: '#ac7c00', e: '#b8f818', f: '#00a800', m: '#f8b800' }, px: [[7, 13, 'm'], [3, 17, 'm'], [6, 17, 'm']] },
    { id: 'sakura', name: 'Sakura Enchantress', set: { b: '#f8b8f8', c: '#f878f8', h: '#d800cc', g: '#fcfcfc', e: '#fcfcfc', f: '#f8a4c0', k: '#fcfcfc', l: '#f8b8f8' } },
  ],
};

export const skinOf = (cls: ClassId, id: string): Skin => SKINS[cls].find(s => s.id === id) ?? SKINS[cls][0];

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
  // the tabard (Warrior h) or robe (Mage c) color
  return skinned(cls, skin, alt).pal[cls === 'warrior' ? 7 : 2];
}
