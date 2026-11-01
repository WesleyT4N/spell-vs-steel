// Expedition monster sprites, baked once per tint the same way the fighters are (art/sprites.ts).
import type { Sprite, Tint } from './sprites';
import { MOB_ART, MOB_RES } from './mobArt';

/** Palette index of a pixel letter: a-z are 0-25, A-Z 26-51, 0-9 52-61. */
const letterIndex = (ch: string): number => {
  const k = ch.charCodeAt(0);
  return k >= 97 ? k - 97 : k >= 65 ? k - 39 : k + 4;
};

const cache = new Map<string, Sprite>();

function bake(rows: string[], pal: string[], tint: Tint): HTMLCanvasElement {
  const w = rows[0].length, h = rows.length;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d')!;
  rows.forEach((row, j) => {
    for (let i = 0; i < w; i++) {
      const ch = row[i];
      if (ch === '.') continue;
      const idx = letterIndex(ch);
      let col = pal[idx] ?? '#ff00ff';
      if (tint === 'flash') col = idx === 0 ? '#000000' : '#fcfcfc';
      if (tint === 'ice') col = idx === 0 ? '#0058f8' : ['#fcfcfc', '#a4e4fc', '#3cbcfc'][(i + j + idx) % 3];
      if (tint === 'stun') col = idx === 0 ? '#000000' : idx % 2 ? '#f8b800' : col;
      if (tint === 'ghost') col = idx === 0 ? '#3c3c3c' : '#7c7c7c';
      c.fillStyle = col;
      c.fillRect(i, j, 1, 1);
    }
  });
  return cv;
}

/** A monster's sprite (falls back to the Stumpkin for an unknown id). */
export function getMobSprite(kind: string): Sprite {
  let s = cache.get(kind);
  if (!s) {
    const art = MOB_ART[kind] ?? MOB_ART.stumpkin;
    const img = {} as Record<Tint, HTMLCanvasElement>;
    for (const t of ['none', 'flash', 'ice', 'stun', 'ghost'] as Tint[]) img[t] = bake(art.rows, art.pal, t);
    s = { w: art.rows[0].length / MOB_RES, h: art.rows.length / MOB_RES, ax: art.ax / MOB_RES, res: MOB_RES, img };
    cache.set(kind, s);
  }
  return s;
}
