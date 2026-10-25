// Keyboard input with per-frame "pressed" edges.
import { unlockAudio } from './audio';

export type Action = 'up' | 'down' | 'left' | 'right' | 'attack' | 'cast' | 'custom' | 'confirm' | 'back' | 'pause' | 'mute' | 'lb' | 'rb';

const BINDINGS: Record<string, Action[]> = {
  ArrowUp: ['up'], KeyW: ['up'],
  ArrowDown: ['down'], KeyS: ['down'],
  ArrowLeft: ['left'], KeyA: ['left'],
  ArrowRight: ['right'], KeyD: ['right'],
  KeyZ: ['attack', 'confirm'], KeyJ: ['attack', 'confirm'],
  KeyX: ['cast', 'back'], KeyK: ['cast', 'back'],
  Space: ['custom'], KeyL: ['custom'],
  Enter: ['confirm', 'pause'],
  Escape: ['back', 'pause'], Backspace: ['back'], KeyP: ['pause'],
  KeyM: ['mute'],
  KeyQ: ['lb'], KeyE: ['rb'],
};

const down = new Set<Action>();
const pressed = new Set<Action>();
const released = new Set<Action>();
/** Order in which directions were pressed, so the latest held direction wins. */
const dirOrder: Action[] = [];

function onKey(e: KeyboardEvent, isDown: boolean): void {
  const acts = BINDINGS[e.code];
  if (!acts) return;
  e.preventDefault();
  unlockAudio();
  if (isDown && e.repeat) return;
  for (const a of acts) {
    if (isDown) {
      if (!down.has(a)) pressed.add(a);
      down.add(a);
      if (a === 'up' || a === 'down' || a === 'left' || a === 'right') { dirOrder.splice(dirOrder.indexOf(a) >>> 0, 1); dirOrder.push(a); }
    } else {
      // another key may still hold the same action (e.g. Z and J)
      const still = Object.entries(BINDINGS).some(([code, list]) => code !== e.code && list.includes(a) && heldCodes.has(code));
      if (!still) { down.delete(a); released.add(a); const i = dirOrder.indexOf(a); if (i >= 0) dirOrder.splice(i, 1); }
    }
  }
  if (isDown) heldCodes.add(e.code); else heldCodes.delete(e.code);
}
const heldCodes = new Set<string>();

export function initInput(): void {
  window.addEventListener('keydown', e => onKey(e, true));
  window.addEventListener('keyup', e => onKey(e, false));
  window.addEventListener('blur', () => { down.clear(); heldCodes.clear(); dirOrder.length = 0; });
  window.addEventListener('pointerdown', () => unlockAudio());
}

export const isDown = (a: Action): boolean => down.has(a);
export const wasPressed = (a: Action): boolean => pressed.has(a);
export const wasReleased = (a: Action): boolean => released.has(a);
/** Most recently pressed direction that is still held. */
export function heldDir(): 'up' | 'down' | 'left' | 'right' | null {
  for (let i = dirOrder.length - 1; i >= 0; i--) if (down.has(dirOrder[i])) return dirOrder[i] as 'up' | 'down' | 'left' | 'right';
  return null;
}
/** Call once at the end of every frame. */
export function endFrame(): void { pressed.clear(); released.clear(); }

/** Menu navigation with key repeat. Returns a direction on press and then every `rate` seconds while held. */
const repeatT: Partial<Record<Action, number>> = {};
export function navPressed(a: 'up' | 'down' | 'left' | 'right', dt: number, delay = 0.32, rate = 0.08): boolean {
  if (pressed.has(a)) { repeatT[a] = delay; return true; }
  if (!down.has(a)) { repeatT[a] = 0; return false; }
  repeatT[a] = (repeatT[a] ?? 0) - dt;
  if ((repeatT[a] ?? 0) <= 0) { repeatT[a] = rate; return true; }
  return false;
}
