// Scene switching, mouse hit zones and small UI widgets shared by the menus.
import type { Ctx } from '../engine/gfx';
import { P, UW, UH, frame, screenRect, view } from '../engine/gfx';
import { drawText, drawTextCentered, textWidth } from '../engine/font';
import { mouse } from '../engine/input';
import { touchActive, touchText, type PadMode } from '../engine/touch';

export interface Scene {
  update(dt: number): void;
  /** `c` is the 240×160 world; `ui` is the 480×320 sharp layer drawn on top of it. */
  draw(c: Ctx, tick: number, ui: Ctx): void;
  enter?(): void;
  /** Which touch controls this screen shows on phones (a BACK button when left out). */
  pad?(): PadMode;
}

let current: Scene | null = null;
export function setScene(s: Scene): void {
  current = s;
  fresh = true;
  zones = []; nextZones = [];
  s.enter?.();
}
export const getScene = (): Scene | null => current;

// ---------- nothing preselected on phones ----------
// With keys a highlighted row is the cursor, so a menu opens with one. By touch it reads as a choice
// already made, so phones show no selection until a finger lands on one.
let fresh = true;
/** False until the first touch on this menu when playing by touch; always true otherwise. */
export const showSel = (): boolean => !touchActive() || !fresh;
/** A new menu opened inside the same screen (pause, results, Draw): hide the selection again on phones. */
export function resetSel(): void { fresh = true; }
/** Called by the main loop before each update: a finger landing on something selectable shows the selection. */
export function noteTouch(): void { if (mouse.touched && hotZone()) fresh = false; }

// ---------- mouse zones ----------
// Scenes register clickable rectangles (UI coordinates) while drawing; the next update reads them.
interface Zone { id: string; x: number; y: number; w: number; h: number }
let zones: Zone[] = [];
let nextZones: Zone[] = [];
export function zone(id: string, x: number, y: number, w: number, h: number): void { nextZones.push({ id, x, y, w, h }); }
/** Swap in the zones drawn this frame. Called by the main loop after drawing. */
export function commitZones(): void { zones = nextZones; nextZones = []; }
/** Id of the topmost zone under the pointer, or null. */
export function hotZone(): string | null {
  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i];
    if (mouse.x >= z.x && mouse.x < z.x + z.w && mouse.y >= z.y && mouse.y < z.y + z.h) return z.id;
  }
  return null;
}
/** Index of the hovered zone named `prefix:n`, or -1. */
export function hot(prefix: string): number {
  const id = hotZone();
  return id && id.startsWith(prefix + ':') ? Number(id.slice(prefix.length + 1)) : -1;
}
/** True when the hovered zone is exactly `id`. */
export const isHot = (id: string): boolean => hotZone() === id;

/** Shared mouse handling for a vertical list: hovering moves the selection, returns the clicked index or -1. */
export function listMouse(prefix: string, sel: number, onHover: (i: number) => void): number {
  const h = hot(prefix);
  if (h < 0) return -1;
  if (mouse.moved && h !== sel) onHover(h);
  return mouse.click ? h : -1;
}

/** Darken the whole layer (for overlays). */
export function dim(c: Ctx, a = 0.6): void {
  c.fillStyle = `rgba(0,0,0,${a})`;
  c.fillRect(...screenRect(c.canvas.width / view.w));
}

/** A vertical menu on the UI layer; each row is a clickable `menu:i` zone. */
export function drawMenu(c: Ctx, items: string[], sel: number, cx: number, y: number, tick: number, opts: { gap?: number; width?: number; disabled?: boolean[]; scale?: number } = {}): void {
  const s = opts.scale ?? 1;
  const gap = opts.gap ?? 20;
  const w = opts.width ?? Math.max(...items.map(t => textWidth(t, s))) + 48;
  const x = Math.round(cx - w / 2);
  frame(c, x, y - 6, w, items.length * gap + 6, '#000000', '#fcfcfc');
  items.forEach((t, i) => {
    const yy = y + i * gap;
    const on = i === sel && showSel();
    const dis = opts.disabled?.[i];
    zone(`menu:${i}`, x + 2, yy - 4, w - 4, gap - 1);
    if (on) P(c, '#0000a8', x + 2, yy - 4, w - 4, gap - 2);
    drawTextCentered(c, t, cx, yy + Math.round((gap - 10 - 7 * s) / 2), dis ? '#7c7c7c' : on ? '#fcfcfc' : '#bcbcbc', s, false);
    if (on && tick % 8 < 6) drawText(c, '→', x + 8, yy + Math.round((gap - 10 - 7 * s) / 2), '#f8b800', s);
  });
}

/** Footer line of control hints on the UI layer. */
export function hint(c: Ctx, s: string): void {
  const [x, , w, h] = screenRect(2);
  P(c, '#000000', x, UH - 14, w, 14 + (h - UH) / 2);
  drawTextCentered(c, touchText(s), UW / 2, UH - 11, '#bcbcbc', 1, false);
}

/** A small clickable button; returns nothing, registers the zone `id`. */
export function button(c: Ctx, id: string, label: string, x: number, y: number, w: number, h: number, on: boolean, color = '#fcfcfc'): void {
  zone(id, x, y, w, h);
  const lit = on || isHot(id);
  frame(c, x, y, w, h, lit ? '#0000a8' : '#000000', lit ? '#fcfcfc' : '#7c7c7c');
  drawTextCentered(c, label, x + w / 2, y + Math.round((h - 7) / 2), color, 1, false);
}
