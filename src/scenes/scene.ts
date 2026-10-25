// Scene switching and small UI widgets shared by the menus.
import type { Ctx } from '../engine/gfx';
import { P, W, H, frame } from '../engine/gfx';
import { drawText, drawTextCentered, textWidth } from '../engine/font';

export interface Scene {
  update(dt: number): void;
  draw(c: Ctx, tick: number): void;
  enter?(): void;
}

let current: Scene | null = null;
export function setScene(s: Scene): void {
  current = s;
  s.enter?.();
}
export const getScene = (): Scene | null => current;

/** Darken the whole screen (for overlays). */
export function dim(c: Ctx, a = 0.6): void {
  c.fillStyle = `rgba(0,0,0,${a})`;
  c.fillRect(0, 0, W, H);
}

/** A vertical menu of options; returns nothing, just draws with a blinking cursor. */
export function drawMenu(c: Ctx, items: string[], sel: number, cx: number, y: number, tick: number, opts: { gap?: number; width?: number; disabled?: boolean[] } = {}): void {
  const gap = opts.gap ?? 12;
  const w = opts.width ?? Math.max(...items.map(s => textWidth(s))) + 20;
  frame(c, Math.round(cx - w / 2), y - 4, w, items.length * gap + 4, '#000000', '#fcfcfc');
  items.forEach((s, i) => {
    const yy = y + i * gap;
    const on = i === sel;
    const dis = opts.disabled?.[i];
    if (on) P(c, '#0000a8', Math.round(cx - w / 2) + 2, yy - 2, w - 4, gap - 1);
    drawTextCentered(c, s, cx, yy, dis ? '#7c7c7c' : on ? '#fcfcfc' : '#bcbcbc', 1, false);
    if (on && tick % 8 < 6) drawText(c, '→', Math.round(cx - w / 2) + 4, yy, '#f8b800');
  });
}

/** Footer line of control hints. */
export function hint(c: Ctx, s: string): void {
  P(c, '#000000', 0, H - 10, W, 10);
  drawTextCentered(c, s, W / 2, H - 9, '#bcbcbc', 1, false);
}
