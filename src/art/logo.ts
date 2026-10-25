// "SPELL VS STEEL" logo: bitmap-font letters recolored with vertical ramps and a heavy outline.
import { drawText, textWidth } from '../engine/font';
import type { Ctx } from '../engine/gfx';

let cached: HTMLCanvasElement | null = null;

function word(s: string, scale: number, ramp: string[]): HTMLCanvasElement {
  const w = textWidth(s, scale) + 4, h = 7 * scale + 4;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d', { willReadFrequently: true })!;
  // outline: black, drawn at every offset within 2px
  for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) if (Math.abs(dx) + Math.abs(dy) <= 3) drawText(c, s, 2 + dx, 2 + dy, '#000000', scale);
  drawText(c, s, 2, 2, '#ffffff', scale);
  const img = c.getImageData(0, 0, w, h);
  const src = new Uint8ClampedArray(img.data);
  for (let y = 0; y < h; y++) {
    const band = ramp[Math.min(ramp.length - 1, Math.floor(((y - 2) / (7 * scale)) * ramp.length))] ?? ramp[0];
    const r = parseInt(band.slice(1, 3), 16), g = parseInt(band.slice(3, 5), 16), b = parseInt(band.slice(5, 7), 16);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (src[i] === 255 && src[i + 3] > 0) {
        // 1px highlight on the top edge of each stroke
        const above = y > 0 ? src[((y - 1) * w + x) * 4] : 0;
        const hl = above !== 255;
        img.data[i] = hl ? 255 : r; img.data[i + 1] = hl ? 255 : g; img.data[i + 2] = hl ? 255 : b;
      }
    }
  }
  c.putImageData(img, 0, 0);
  return cv;
}

export function buildLogo(): HTMLCanvasElement {
  if (cached) return cached;
  const spell = word('SPELL', 4, ['#a4e4fc', '#3cbcfc', '#0058f8', '#0000a8']);
  const steel = word('STEEL', 4, ['#fcfcfc', '#bcbcbc', '#7c7c7c', '#d82800']);
  const vs = word('VS', 2, ['#f8b800', '#f8b800', '#e45c10']);
  // stacked: SPELL up-left, VS in the middle, STEEL down-right
  const off = 14;
  const w = spell.width + off;
  const h = spell.height + steel.height + 4;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d')!;
  c.drawImage(spell, 0, 0);
  c.drawImage(steel, off, spell.height + 4);
  c.drawImage(vs, Math.round(w / 2 - vs.width / 2) - 2, spell.height - Math.round(vs.height / 2) + 2);
  cached = cv;
  return cv;
}

export function drawLogo(c: Ctx, cx: number, y: number): void {
  const l = buildLogo();
  c.drawImage(l, Math.round(cx - l.width / 2), y);
}
