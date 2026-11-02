// A list or grid that scrolls under a finger with momentum, and under the mouse wheel.
import { mouse, gesture } from '../engine/input';

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
