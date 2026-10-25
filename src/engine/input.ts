// Keyboard input with per-frame "pressed" edges and rebindable keys (saved in the browser).
import { unlockAudio } from './audio';

export type Action = 'up' | 'down' | 'left' | 'right' | 'attack' | 'cast' | 'custom' | 'confirm' | 'back' | 'pause' | 'mute' | 'lb' | 'rb';

/** Actions the player can rebind, in the order the controls screen lists them. */
export const BINDABLE = ['up', 'down', 'left', 'right', 'attack', 'cast', 'custom', 'pause'] as const;
export type Bindable = (typeof BINDABLE)[number];

export const DEFAULT_KEYS: Record<Bindable, string> = {
  up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD',
  attack: 'KeyJ', cast: 'KeyK', custom: 'Space', pause: 'Enter',
};

// Keys that always work regardless of bindings. Menus confirm with the attack key and go back with the cast key.
const FIXED: Record<string, Action[]> = {
  ArrowUp: ['up'], ArrowDown: ['down'], ArrowLeft: ['left'], ArrowRight: ['right'],
  Enter: ['confirm'], Escape: ['back', 'pause'], Backspace: ['back'],
  KeyM: ['mute'], KeyQ: ['lb'], KeyE: ['rb'],
};

const STORE = 'svs:keys';
let keys: Record<Bindable, string> = { ...DEFAULT_KEYS };
try {
  const raw = localStorage.getItem(STORE);
  if (raw) keys = { ...DEFAULT_KEYS, ...(JSON.parse(raw) as Partial<Record<Bindable, string>>) };
} catch { /* storage blocked */ }

let BINDINGS: Record<string, Action[]> = {};
function rebuild(): void {
  BINDINGS = {};
  for (const [code, acts] of Object.entries(FIXED)) BINDINGS[code] = [...acts];
  const add = (code: string, a: Action): void => { (BINDINGS[code] ??= []).includes(a) || BINDINGS[code].push(a); };
  for (const a of BINDABLE) add(keys[a], a);
  add(keys.attack, 'confirm');
  add(keys.cast, 'back');
}
rebuild();

export const getKey = (a: Bindable): string => keys[a];

/** Bind `code` to `a`. If another action used that key, the two swap keys. */
export function setKey(a: Bindable, code: string): void {
  const other = BINDABLE.find(b => b !== a && keys[b] === code);
  if (other) keys[other] = keys[a];
  keys[a] = code;
  save();
}
export function resetKeys(): void { keys = { ...DEFAULT_KEYS }; save(); }
function save(): void {
  rebuild();
  try { localStorage.setItem(STORE, JSON.stringify(keys)); } catch { /* storage blocked */ }
}

/** Short on-screen name for a key code. */
export function keyName(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'NUM' + code.slice(6).toUpperCase();
  const map: Record<string, string> = {
    Space: 'SPACE', Enter: 'ENTER', Escape: 'ESC', Backspace: 'BKSP', Tab: 'TAB',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    ShiftLeft: 'LSHIFT', ShiftRight: 'RSHIFT', ControlLeft: 'LCTRL', ControlRight: 'RCTRL', AltLeft: 'LALT', AltRight: 'RALT',
    Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', BracketLeft: '(', BracketRight: ')', Minus: '-', Equal: '=',
  };
  return map[code] ?? code.toUpperCase().slice(0, 6);
}
/** Name of the key bound to an action, for hints. */
export const k = (a: Bindable): string => keyName(keys[a]);

// Keys the rebinding screen refuses (they are reserved for menus and muting).
export const RESERVED = new Set(['Escape', 'KeyM', 'KeyQ', 'KeyE', 'Backspace']);

const down = new Set<Action>();
const pressed = new Set<Action>();
const released = new Set<Action>();
const heldCodes = new Set<string>();
/** Order in which directions were pressed, so the latest held direction wins. */
const dirOrder: Action[] = [];
let capture: ((code: string) => void) | null = null;

/** The next key press goes to `cb` instead of the game (used by the rebinding screen). */
export function captureNextKey(cb: (code: string) => void): void { capture = cb; }

function onKey(e: KeyboardEvent, isDown: boolean): void {
  unlockAudio();
  if (capture && isDown) {
    e.preventDefault();
    const cb = capture;
    capture = null;
    cb(e.code);
    return;
  }
  const acts = BINDINGS[e.code];
  if (!acts) return;
  e.preventDefault();
  if (isDown && e.repeat) return;
  if (isDown) heldCodes.add(e.code); else heldCodes.delete(e.code);
  for (const a of acts) {
    if (isDown) {
      if (!down.has(a)) pressed.add(a);
      down.add(a);
      if (a === 'up' || a === 'down' || a === 'left' || a === 'right') {
        const i = dirOrder.indexOf(a);
        if (i >= 0) dirOrder.splice(i, 1);
        dirOrder.push(a);
      }
    } else {
      // another held key may still map to the same action (e.g. D and the right arrow)
      const still = [...heldCodes].some(code => BINDINGS[code]?.includes(a));
      if (!still) {
        down.delete(a);
        released.add(a);
        const i = dirOrder.indexOf(a);
        if (i >= 0) dirOrder.splice(i, 1);
      }
    }
  }
}

// ---------- mouse ----------
/** Pointer state in canvas pixels, with per-frame click edges. */
export const mouse = { x: -1, y: -1, moved: false, click: false, rclick: false, wheel: 0, down: false };

/** True while the pointer is inside the rectangle. */
export const hover = (x: number, y: number, w: number, h: number): boolean =>
  mouse.x >= x && mouse.x < x + w && mouse.y >= y && mouse.y < y + h;

function initMouse(canvas: HTMLCanvasElement): void {
  const at = (e: MouseEvent): void => {
    const r = canvas.getBoundingClientRect();
    mouse.x = Math.floor((e.clientX - r.left) * canvas.width / r.width);
    mouse.y = Math.floor((e.clientY - r.top) * canvas.height / r.height);
  };
  canvas.addEventListener('mousemove', e => { at(e); mouse.moved = true; });
  canvas.addEventListener('mousedown', e => {
    at(e);
    if (e.button === 0) { mouse.click = true; mouse.down = true; }
    if (e.button === 2) mouse.rclick = true;
  });
  window.addEventListener('mouseup', e => { if (e.button === 0) mouse.down = false; });
  canvas.addEventListener('mouseleave', () => { mouse.x = mouse.y = -1; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => { e.preventDefault(); mouse.wheel += Math.sign(e.deltaY); }, { passive: false });
}

export function initInput(canvas?: HTMLCanvasElement): void {
  if (canvas) initMouse(canvas);
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
export function endFrame(): void {
  pressed.clear(); released.clear();
  mouse.click = mouse.rclick = mouse.moved = false; mouse.wheel = 0;
}

/** Menu navigation with key repeat. Returns a direction on press and then every `rate` seconds while held. */
const repeatT: Partial<Record<Action, number>> = {};
export function navPressed(a: 'up' | 'down' | 'left' | 'right', dt: number, delay = 0.32, rate = 0.08): boolean {
  if (pressed.has(a)) { repeatT[a] = delay; return true; }
  if (!down.has(a)) { repeatT[a] = 0; return false; }
  repeatT[a] = (repeatT[a] ?? 0) - dt;
  if ((repeatT[a] ?? 0) <= 0) { repeatT[a] = rate; return true; }
  return false;
}
