// Cartridge-style NES fighters, extracted from the round-3 sprite page (art/sprite-styles-round3.html).
import type { Ctx } from '../engine/gfx';

export type ClassId = 'warrior' | 'mage';

interface SpriteDef { pal: string[]; rows: string[]; ax: number }

const DEFS: Record<ClassId, SpriteDef> = {
  warrior: {
    pal: ['#000000', '#fce0a8', '#ac7c00', '#fcfcfc', '#7c7c7c', '#bcbcbc', '#e45c10', '#d82800', '#f87858', '#f8b800', '#881400', '#503000'],
    rows: ['....aa.......a...', '...abca.....aba..', '.a.aba......aba..', 'adaabcaaaaaaabca.', 'adeaabcdffffbca..', '.adeaaffffffaa...', '..adeaffffbaba...', '...adaffffbgga...', '...addffeeeedaaa.', '..affffeeeeddfffa', '..affeehhhhdijhfa', '...aeehffhhjjjjea', '...akhhfekkfhjkea', '..akkkkkkkjfhjea.', '..akkhhhhhkkeja..', '..akllfeaafeaea..', '...aaaklaaklla...', '......aa..aaa....'],
    ax: 9,
  },
  mage: {
    pal: ['#000000', '#6888fc', '#0058f8', '#ac7c00', '#00e8d8', '#008888', '#f8b800', '#0000a8', '#fce0a8', '#e45c10', '#fcfcfc', '#bcbcbc'],
    rows: ['...aa........', '..abba...aaa.', '...acca.adeea', '....accaadefa', '....acghaddda', '...achhhaada.', '.aabgggggcda.', 'acccccchhhha.', '.aaaiiiajada.', '....aikkkada.', '...abckklada.', '...accclcada.', '...acccchhia.', '..aggggggaja.', '..accccghada.', '..acchhghada.', '.achhhhddhda.', 'agggggggggda.', '.aaaaaaaaada.', '..........a..'],
    ax: 6,
  },
};

// Alternate palettes for mirror matches (the CPU's copy). Keys are palette indices to replace.
const ALT: Record<ClassId, Record<number, string>> = {
  warrior: { 7: '#00a800', 10: '#005800', 8: '#58d854' },
  mage: { 1: '#f878f8', 2: '#d800cc', 7: '#940084' },
};

export type Tint = 'none' | 'flash' | 'ice' | 'stun' | 'ghost';

export interface Sprite { w: number; h: number; ax: number; img: Record<Tint, HTMLCanvasElement> }

const cache = new Map<string, Sprite>();

function bake(def: SpriteDef, pal: string[], tint: Tint): HTMLCanvasElement {
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

export function getSprite(cls: ClassId, alt: boolean): Sprite {
  const key = cls + (alt ? ':alt' : '');
  let s = cache.get(key);
  if (!s) {
    const def = DEFS[cls];
    const pal = def.pal.slice();
    if (alt) for (const [i, col] of Object.entries(ALT[cls])) pal[+i] = col;
    const tints: Tint[] = ['none', 'flash', 'ice', 'stun', 'ghost'];
    const img = {} as Record<Tint, HTMLCanvasElement>;
    for (const t of tints) img[t] = bake(def, pal, t);
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
export function teamColor(cls: ClassId, alt: boolean): string {
  if (cls === 'warrior') return alt ? '#00a800' : '#d82800';
  return alt ? '#d800cc' : '#0058f8';
}
