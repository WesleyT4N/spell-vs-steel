// PixelLab art for the fight's call-outs and the cast queue (render only): the READY / FIGHT! / K.O. lettering,
// damage numbers in the Retro font, and the queue chips recolored to each spell's element.
// Files: assets/ui/splash/*.png, assets/ui/fonts/retro.*, assets/ui/queue-chip.png (tools/pixellab/build_combat_ui.py).
import { assetImage } from '../engine/assets';
import { drawArtTextCentered, type ArtTextStyle } from '../engine/artFont';
import { mix, type Ctx } from '../engine/gfx';

export type SplashWord = 'ready' | 'fight' | 'ko' | 'double-ko';

/** Draw a lettering splash centered on (cx, cy), `scale` UI px per art px. False when the art isn't loaded. */
export function drawSplash(ui: Ctx, word: SplashWord, cx: number, cy: number, scale = 1.5): boolean {
  const img = assetImage(`ui/splash/${word}.png`);
  if (!img) return false;
  const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
  const snap = (v: number): number => Math.round(v / scale) * scale;
  ui.drawImage(img, snap(cx - w / 2), snap(cy - h / 2), w, h);
  return true;
}

/** A damage number's look: white-hot on its first frames, then a white top fading into the element color. */
export function damageStyle(color: string, hot: boolean, big: boolean): ArtTextStyle {
  const fill = hot ? ['#fcfcfc'] : ['#fcfcfc', mix(color, '#fcfcfc', 0.45), color];
  return { fill, outline: '#000000', ow: 1, shadow: big ? '#000000' : undefined };
}

/** Draw a damage number centered on cx with its top at y. False when the font isn't loaded. */
export function drawDamageNumber(ui: Ctx, text: string, cx: number, y: number, color: string, hot: boolean, big: boolean, scale: number): boolean {
  return drawArtTextCentered(ui, 'retro', text, cx, y, damageStyle(color, hot, big), scale);
}

// queue chips: the grey card's five steps (black outline, dark, mid, light, highlight) mapped onto one color
const chips = new Map<string, HTMLCanvasElement>();
function chipIn(color: string): HTMLCanvasElement | null {
  let cv = chips.get(color);
  if (cv) return cv;
  const img = assetImage('ui/queue-chip.png');
  if (!img || typeof document === 'undefined') return null;
  cv = document.createElement('canvas');
  cv.width = img.naturalWidth; cv.height = img.naturalHeight;
  const c = cv.getContext('2d', { willReadFrequently: true })!;
  c.drawImage(img, 0, 0);
  const id = c.getImageData(0, 0, cv.width, cv.height), d = id.data;
  const ramp = [mix(color, '#000000', 0.55), mix(color, '#000000', 0.25), color, mix(color, '#fcfcfc', 0.5)].map(h => {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  });
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) { d[i + 3] = 0; continue; }
    const step = Math.round(d[i] / 64); // 0 outline, 1..4 the ramp
    const rgb = step === 0 ? [0, 0, 0] : ramp[Math.min(4, step) - 1];
    d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255;
  }
  c.putImageData(id, 0, 0);
  chips.set(color, cv);
  return cv;
}

/** Size of a queue chip in world px (the art is drawn at 2 art px per world px). */
export function chipSize(): { w: number; h: number } | null {
  const img = assetImage('ui/queue-chip.png');
  return img ? { w: img.naturalWidth / 2, h: img.naturalHeight / 2 } : null;
}

/** Draw a queue chip with its top-left at (x, y) in world px, in `color`. False when the art isn't loaded. */
export function drawChip(c: Ctx, x: number, y: number, color: string): boolean {
  const cv = chipIn(color);
  if (!cv) return false;
  c.drawImage(cv, Math.round(x * 2) / 2, Math.round(y * 2) / 2, cv.width / 2, cv.height / 2);
  return true;
}
