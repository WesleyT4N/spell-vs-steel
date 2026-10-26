// The shared touch kit: big Parchment controls for screens with a full-height phone layout (Scene.tall).
// Everything here draws on the 480-wide UI layer and registers zones like the rest of the menus, so mouse,
// keys and fingers all keep working. Sizes are in UI pixels; on a 390pt-wide phone one UI pixel is about
// 0.8pt, so TAP (58) is the 48pt minimum tap target.
import { P, UW, screenRect, view, mix, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered, textWidth } from '../engine/font';
import { mouse, gesture } from '../engine/input';
import { safeInsets } from '../engine/touch';
import { zone, isHot, showSel } from './scene';
import { paper, PAPER, PAPER2, BURN, INK, INK2, TRIM, FRAME, WAX, WAX_HI, GOLD } from './skin';

const BLACK = '#000000';
/** Smallest height for anything a finger presses. */
export const TAP = 58;
/** Gap between neighbouring controls. */
export const GAP = 10;
/** Side margin of a full-height layout. */
export const PAD = 16;
/** Height of the action bar along the bottom (BACK on the left, the main action on the right). */
export const BAR_H = 84;

/** The whole phone screen on the UI layer, less the notch and home bar: where a tall layout may draw. */
export function tallArea(): { x: number; y: number; w: number; h: number } {
  const [x, y, w, h] = screenRect(2);
  const cv = document.getElementById('game');
  const css = cv?.getBoundingClientRect().height || 1;
  const k = (view.h * 2) / css; // UI pixels per CSS pixel
  const { top, bottom } = safeInsets();
  const t = Math.round(top * k), b = Math.round(bottom * k);
  return { x, y: y + t, w, h: h - t - b };
}

/** True while a finger (or the mouse button) is down on zone `id`: the pressed look. */
const pressing = (id: string): boolean => mouse.down && isHot(id);

/**
 * A big plaque button. `primary` is red wax (the screen's main action); `on` marks a chosen option.
 * Text is 2x, 3x on tall buttons; `sub` adds a small caption line above the label (e.g. "DECK" over "BRAWLER").
 */
export function bigButton(c: Ctx, id: string, label: string, x: number, y: number, w: number, h: number,
  opts: { primary?: boolean; on?: boolean; disabled?: boolean; scale?: number; sub?: string } = {}): void {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  if (!opts.disabled) zone(id, x, y, w, h);
  const down = !opts.disabled && pressing(id);
  const lit = !!opts.on || (showSel() && isHot(id) && !opts.disabled);
  const wax = opts.primary && !opts.disabled;
  const sink = down ? 2 : 0;
  P(c, BLACK, x - 1, y - 1, w + 2, h + 2);
  P(c, lit && !wax ? GOLD : FRAME, x, y, w, h);
  P(c, lit && !wax ? GOLD : FRAME, x + 1, y + 1, w - 2, h - 2);
  // the face, with a darker lip along the bottom that it presses down into
  const fx = x + 2, fy = y + 2 + sink, fw = w - 4, fh = h - 4 - sink;
  if (wax) {
    P(c, mix(WAX, BLACK, 0.35), fx, y + 2, fw, h - 4);
    P(c, down ? mix(WAX, BLACK, 0.15) : WAX, fx, fy, fw, fh - 4 + sink);
    P(c, WAX_HI, fx, fy, fw, 1);
  } else {
    P(c, BURN, fx, y + 2, fw, h - 4);
    paper(c, fx, fy, fw, fh - 4 + sink, 3);
  }
  const ink = opts.disabled ? TRIM : wax ? PAPER : INK;
  const s = opts.scale ?? (h >= 72 && textWidth(label, 3) < w - 24 ? 3 : textWidth(label, 2) < w - 12 ? 2 : 1);
  const th = 7 * s, subH = opts.sub ? 10 : 0;
  const ty = fy + Math.round((fh - 4 + sink - th - subH) / 2) + subH;
  if (opts.sub) drawTextCentered(c, opts.sub, x + w / 2, ty - 10, opts.disabled ? TRIM : wax ? PAPER2 : INK2, 1, false);
  drawTextCentered(c, label, x + w / 2, ty, ink, s, false);
}

/** The wooden bar along the bottom of a tall layout. Returns the y where it starts (content ends above it). */
export function actionBar(c: Ctx, opts: { back?: string | false; primary?: { id: string; label: string; disabled?: boolean }; mid?: { id: string; label: string; on?: boolean } } = {}): number {
  const a = tallArea();
  const [, sy, , sh] = screenRect(2);
  const top = a.y + a.h - BAR_H;
  // the wood runs down under the home bar too
  P(c, FRAME, a.x, top, a.w, sy + sh - top);
  P(c, TRIM, a.x, top, a.w, 2);
  P(c, mix(FRAME, BLACK, 0.3), a.x, top + 2, a.w, 2);
  const y = top + Math.round((BAR_H - TAP) / 2) + 1, x0 = a.x + PAD, x1 = a.x + a.w - PAD;
  let left = x0, right = x1;
  if (opts.back !== false) {
    const w = 132;
    bigButton(c, 'bar:back', opts.back ?? '← BACK', left, y, w, TAP);
    left += w + GAP;
  }
  if (opts.primary) {
    const w = Math.max(150, textWidth(opts.primary.label, 2) + 40);
    bigButton(c, 'bar:primary', opts.primary.label, right - w, y, w, TAP, { primary: true, disabled: opts.primary.disabled });
    right -= w + GAP;
  }
  if (opts.mid && right - left > 60) bigButton(c, 'bar:mid', opts.mid.label, left, y, right - left, TAP, { on: opts.mid.on });
  return top;
}

/** True on the frame BACK in the action bar is tapped. */
export const barTapped = (which: 'back' | 'primary' | 'mid'): boolean => mouse.click && isHot(`bar:${which}`);

/** A row of tabs; each is zone `prefix:i`. */
export function tabs(c: Ctx, prefix: string, labels: string[], sel: number, x: number, y: number, w: number, h = 48): void {
  const n = labels.length, gap = 4, tw = (w - gap * (n - 1)) / n;
  labels.forEach((l, i) => bigButton(c, `${prefix}:${i}`, l, x + i * (tw + gap), y, tw, h, { primary: i === sel, scale: textWidth(l, 2) < tw - 10 ? 2 : 1 }));
}

/**
 * A sideways swipe that started inside the rectangle: +1 for the next page (finger moved left), -1 for the
 * previous one, 0 for none. Swipes from the left screen edge are BACK and don't count.
 */
export function swipeIn(x: number, y: number, w: number, h: number): -1 | 0 | 1 {
  const s = gesture.swipe;
  if (s !== 'left' && s !== 'right') return 0;
  if (gesture.sx < x || gesture.sx >= x + w || gesture.sy < y || gesture.sy >= y + h) return 0;
  if (s === 'right' && gesture.sx < -view.ox * 2 + 22) return 0;
  return s === 'left' ? 1 : -1;
}

/** A vertical flick that started inside the rectangle (used to queue and unqueue cards). */
export function flickIn(x: number, y: number, w: number, h: number): 'up' | 'down' | null {
  const s = gesture.swipe;
  if (s !== 'up' && s !== 'down') return null;
  return gesture.sx >= x && gesture.sx < x + w && gesture.sy >= y && gesture.sy < y + h ? s : null;
}

/** Page dots under a carousel. */
export function dots(c: Ctx, n: number, i: number, cx: number, y: number): void {
  const step = 18, x0 = Math.round(cx - ((n - 1) * step) / 2);
  for (let k = 0; k < n; k++) {
    P(c, BLACK, x0 + k * step - 6, y - 1, 12, 12);
    P(c, FRAME, x0 + k * step - 5, y, 10, 10);
    P(c, k === i ? WAX : BURN, x0 + k * step - 3, y + 2, 6, 6);
  }
}

/** A list or grid that scrolls under a finger with momentum (and the mouse wheel). */
export class Scroller {
  pos = 0;
  /** How far it can scroll, set each frame by the screen. */
  max = 0;
  private grabbed = false;
  /** Call once per update with the visible rectangle. `wheelStep` is how far one wheel notch moves. */
  update(x: number, y: number, w: number, h: number, wheelStep = 40): void {
    const inside = mouse.x >= x && mouse.x < x + w && mouse.y >= y && mouse.y < y + h;
    if (mouse.touched) this.grabbed = inside;
    if (inside && mouse.wheel && !gesture.held) this.pos += mouse.wheel * wheelStep;
    if (this.grabbed && gesture.dy) this.pos -= gesture.dy;
    if (!gesture.held && !gesture.fling) this.grabbed = false;
    this.pos = Math.max(0, Math.min(this.max, this.pos));
  }
  /** Scroll so a span [top, top + h] (content coordinates) is in view. */
  reveal(top: number, h: number, view: number): void {
    if (top < this.pos) this.pos = top;
    if (top + h > this.pos + view) this.pos = top + h - view;
    this.pos = Math.max(0, Math.min(this.max, this.pos));
  }
}

/** A Parchment panel framed for a tall layout (a window with a thicker frame). */
export function panel(c: Ctx, x: number, y: number, w: number, h: number): void {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  P(c, BLACK, x - 1, y - 1, w + 2, h + 2);
  P(c, FRAME, x, y, w, h);
  paper(c, x + 3, y + 3, w - 6, h - 6, 8);
  P(c, TRIM, x + 3, y + 3, w - 6, 1);
}

/** A heading on a panel, in red ink, 2x. */
export function heading(c: Ctx, text: string, x: number, y: number, color = '#a81000'): void {
  drawText(c, text, x, y, color, 2);
}

/** A slide-up sheet from the bottom edge for reading a held card. `draw` fills it; returns nothing. */
export function sheet(c: Ctx, h: number, draw: (x: number, y: number, w: number, h: number) => void): void {
  const a = tallArea();
  const [, sy, , sh] = screenRect(2);
  const y = a.y + a.h - h;
  c.fillStyle = 'rgba(40,20,0,0.45)';
  c.fillRect(a.x, sy, a.w, y - sy);
  P(c, BLACK, a.x, y - 1, a.w, sy + sh - y + 1);
  P(c, FRAME, a.x, y, a.w, sy + sh - y);
  paper(c, a.x + 3, y + 3, a.w - 6, sy + sh - y - 3, 8);
  P(c, INK2, Math.round(UW / 2 - 24), y + 8, 48, 4);
  draw(a.x + PAD, y + 20, a.w - PAD * 2, h - 24);
}
