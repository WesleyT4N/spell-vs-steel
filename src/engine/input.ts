// Keyboard and gamepad input with per-frame "pressed" edges and rebindable keys and buttons (saved in the browser).
import { getSave, setSave } from './save';
import { unlockAudio } from './audio';
import { view } from './gfx';
import { pollPads, clearPads, padCode, parsePad, padName, PAD_BUTTONS, PAD_SLOTS, type PadButton } from './gamepad';

export type Action = 'up' | 'down' | 'left' | 'right' | 'attack' | 'cast' | 'custom' | 'confirm' | 'back' | 'pause' | 'mute' | 'lb' | 'rb' | 'reset';

/** Actions the player can rebind, in the order the controls screen lists them. */
export const BINDABLE = ['up', 'down', 'left', 'right', 'attack', 'cast', 'custom', 'pause'] as const;
export type Bindable = (typeof BINDABLE)[number];

export const DEFAULT_KEYS: Record<Bindable, string> = {
  up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD',
  attack: 'KeyJ', cast: 'KeyK', custom: 'Space', pause: 'Enter',
};

/** Actions each player has in two-player local Versus. */
type Dir4 = 'up' | 'down' | 'left' | 'right';
export type LocalAct = 'up' | 'down' | 'left' | 'right' | 'attack' | 'cast' | 'custom';
export const LOCAL_ACTS = ['up', 'down', 'left', 'right', 'attack', 'cast', 'custom'] as const;

// Keys that always work regardless of bindings. Menus confirm with the attack key and go back with the cast key.
const FIXED: Record<string, Action[]> = {
  ArrowUp: ['up'], ArrowDown: ['down'], ArrowLeft: ['left'], ArrowRight: ['right'],
  Enter: ['confirm'], Escape: ['back', 'pause'], Backspace: ['back'],
  KeyM: ['mute'], KeyQ: ['lb'], KeyE: ['rb'], KeyR: ['reset'],
  // the on-screen touch pad (src/engine/touch.ts) presses these made-up codes
  PadUp: ['up'], PadDown: ['down'], PadLeft: ['left'], PadRight: ['right'],
  PadAttack: ['attack', 'confirm'], PadCast: ['cast', 'back'], PadDraw: ['custom'], PadPause: ['pause'], PadBack: ['back'],
};

/** The saved bindings for `acts` that are real key codes. */
function pick<A extends string>(saved: Record<string, string>, acts: readonly A[]): Partial<Record<A, string>> {
  return Object.fromEntries(acts.filter(a => typeof saved[a] === 'string').map(a => [a, saved[a]])) as Partial<Record<A, string>>;
}
let keys: Record<Bindable, string> = { ...DEFAULT_KEYS, ...pick(getSave('keys'), BINDABLE) };

// ---------- gamepad buttons ----------
// Player 1's buttons work on every pad outside two-player Versus; there pad 1 plays player 1 and pad 2 player 2.
export const DEFAULT_PAD: Record<Bindable, PadButton> = {
  up: 'Up', down: 'Down', left: 'Left', right: 'Right', attack: 'A', cast: 'B', custom: 'RB', pause: 'Start',
};
export const DEFAULT_P2_PAD: Record<LocalAct, PadButton> = {
  up: 'Up', down: 'Down', left: 'Left', right: 'Right', attack: 'A', cast: 'B', custom: 'RB',
};
/** Buttons that always work on every pad, like the arrows and Esc on the keyboard (the stick presses Up/Down/Left/Right). */
const PAD_FIXED: Partial<Record<PadButton, Action[]>> = {
  Up: ['up'], Down: ['down'], Left: ['left'], Right: ['right'],
  A: ['confirm'], B: ['back'], Back: ['back'], Start: ['pause'], LB: ['lb'], RB: ['rb'], Y: ['reset'],
};
/** Buttons the rebinding screen refuses: SELECT always backs out, and START is only for pausing. */
export const padReserved = (b: PadButton, a: Bindable | LocalAct): boolean => b === 'Back' || b === 'Home' || (b === 'Start' && a !== 'pause');
let pads: { p1: Record<Bindable, PadButton>; p2: Record<LocalAct, PadButton> } = { p1: { ...DEFAULT_PAD }, p2: { ...DEFAULT_P2_PAD } };
{
  const saved = (getSave('pads') ?? {}) as { p1?: Record<string, unknown>; p2?: Record<string, unknown> };
  // only real button names for real actions survive a hand-edited save
  const pickPad = <A extends string>(m: Record<string, unknown> | undefined, acts: readonly A[]): Partial<Record<A, PadButton>> =>
    Object.fromEntries(acts.filter(a => (PAD_BUTTONS as readonly unknown[]).includes(m?.[a])).map(a => [a, m![a]])) as Partial<Record<A, PadButton>>;
  pads = { p1: { ...DEFAULT_PAD, ...pickPad(saved.p1, BINDABLE) }, p2: { ...DEFAULT_P2_PAD, ...pickPad(saved.p2, LOCAL_ACTS) } };
}

export const getPadButton = (a: Bindable): PadButton => pads.p1[a];
export const getP2PadButton = (a: LocalAct): PadButton => pads.p2[a];
/** Bind pad button `b` to player `p`'s action `a`; an action already on that button takes `a`'s old one. */
export function setPadButton(p: 0 | 1, a: Bindable | LocalAct, b: PadButton): void {
  const map = (p === 0 ? pads.p1 : pads.p2) as Record<string, PadButton>;
  const other = Object.keys(map).find(o => o !== a && map[o] === b);
  if (other) map[other] = map[a];
  map[a] = b;
  savePads();
}
export function resetPads(p: 0 | 1): void {
  if (p === 0) pads.p1 = { ...DEFAULT_PAD }; else pads.p2 = { ...DEFAULT_P2_PAD };
  savePads();
}
function savePads(): void {
  rebuild();
  rebuildLocal();
  setSave('pads', { p1: { ...pads.p1 }, p2: { ...pads.p2 } });
}

let BINDINGS: Record<string, Action[]> = {};
function rebuild(): void {
  BINDINGS = {};
  for (const [code, acts] of Object.entries(FIXED)) BINDINGS[code] = [...acts];
  const add = (code: string, a: Action): void => { (BINDINGS[code] ??= []).includes(a) || BINDINGS[code].push(a); };
  for (const a of BINDABLE) add(keys[a], a);
  add(keys.attack, 'confirm');
  add(keys.cast, 'back');
  for (let s = 0; s < PAD_SLOTS; s++) {
    for (const [b, acts] of Object.entries(PAD_FIXED)) for (const a of acts) add(padCode(s, b as PadButton), a);
    for (const a of BINDABLE) add(padCode(s, pads.p1[a]), a);
    add(padCode(s, pads.p1.attack), 'confirm');
    add(padCode(s, pads.p1.cast), 'back');
  }
}

rebuild();

export const getKey = (a: Bindable): string => keys[a];

/** Bind `code` to `a`. If another action (or player 2) used that key, the two swap keys. */
export function setKey(a: Bindable, code: string): void {
  const other = BINDABLE.find(b => b !== a && keys[b] === code);
  if (other) keys[other] = keys[a];
  // a key player 2 uses goes to them in exchange
  const p2 = LOCAL_ACTS.find(b => p2Keys[b] === code);
  if (p2) { p2Keys[p2] = keys[a]; saveP2(); }
  keys[a] = code;
  save();
}
export function resetKeys(): void { keys = { ...DEFAULT_KEYS }; save(); }
function save(): void {
  rebuild();
  rebuildLocal();
  setSave('keys', { ...keys });
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
/** Whether the last button pressed was on a pad, so hints name pad buttons instead of keys. */
let onPad = false;
/** Name of the key (or pad button, when playing on a pad) bound to an action, for hints. */
export const k = (a: Bindable): string => (onPad ? padName(pads.p1[a]) : keyName(keys[a]));

// Keys the rebinding screen refuses (they are reserved for menus and muting).
export const RESERVED = new Set(['Escape', 'KeyM', 'KeyQ', 'KeyE', 'KeyR', 'Backspace']);

// ---------- local versus: two players on one keyboard ----------
/**
 * When two players share a keyboard, player 1 plays on the usual bindings (without the arrow keys, which
 * are player 2's) and player 2 on their own, rebindable on the controls screen: by default the arrows
 * with . / and right Shift just above them. Pause stays on Enter/Esc for both.
 */
export const DEFAULT_P2_KEYS: Record<LocalAct, string> = {
  up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', attack: 'Period', cast: 'Slash', custom: 'ShiftRight',
};
/** Fixed extras on top of the bindings: the touch pad plays as player 1, the numpad as player 2. */
const LOCAL_EXTRA: [Record<LocalAct, string>, Record<LocalAct, string>] = [
  { up: 'PadUp', down: 'PadDown', left: 'PadLeft', right: 'PadRight', attack: 'PadAttack', cast: 'PadCast', custom: 'PadDraw' },
  { up: 'Numpad8', down: 'Numpad5', left: 'Numpad4', right: 'Numpad6', attack: 'Numpad1', cast: 'Numpad2', custom: 'Numpad3' },
];
let p2Keys: Record<LocalAct, string> = { ...DEFAULT_P2_KEYS, ...pick(getSave('p2keys'), LOCAL_ACTS) };
let LOCAL_KEYS: [Record<LocalAct, string[]>, Record<LocalAct, string[]>] = [{} as Record<LocalAct, string[]>, {} as Record<LocalAct, string[]>];
let LOCAL_CODES = new Set<string>();
function rebuildLocal(): void {
  const mine = [keys, p2Keys] as const;
  const pad = [pads.p1, pads.p2] as const;
  const dirs: readonly LocalAct[] = ['up', 'down', 'left', 'right'];
  const DIR_BUTTON: Record<Dir4, PadButton> = { up: 'Up', down: 'Down', left: 'Left', right: 'Right' };
  LOCAL_KEYS = [0, 1].map(p => Object.fromEntries(LOCAL_ACTS.map(a => {
    const codes = [mine[p][a], LOCAL_EXTRA[p][a], padCode(p, pad[p][a])];
    // the d-pad and stick always move, whatever the move buttons are bound to
    if (dirs.includes(a)) codes.push(padCode(p, DIR_BUTTON[a as Dir4]));
    return [a, codes];
  }))) as typeof LOCAL_KEYS;
  LOCAL_CODES = new Set(LOCAL_KEYS.flatMap(l => Object.values(l).flat()));
}
rebuildLocal();

export const getP2Key = (a: LocalAct): string => p2Keys[a];
/** Bind `code` to player 2's action `a`. If one of player 1's actions used it, the two players swap keys. */
export function setP2Key(a: LocalAct, code: string): void {
  const mine = LOCAL_ACTS.find(b => b !== a && p2Keys[b] === code);
  if (mine) p2Keys[mine] = p2Keys[a];
  const theirs = BINDABLE.find(b => keys[b] === code);
  if (theirs) { keys[theirs] = p2Keys[a]; save(); }
  p2Keys[a] = code;
  saveP2();
}
export function resetP2Keys(): void { p2Keys = { ...DEFAULT_P2_KEYS }; saveP2(); }
function saveP2(): void {
  rebuildLocal();
  setSave('p2keys', { ...p2Keys });
}
const rawHeld = new Set<string>();
const rawPressed = new Set<string>();
/** Held local-versus codes in the order they went down, so each player's latest direction wins. */
const rawOrder: string[] = [];
/** Whether each local player last pressed a pad button rather than a key (for their hints). */
const localOnPad = [false, false];
function pressRaw(code: string, isDown: boolean): void {
  if (isDown) {
    const pad = parsePad(code);
    for (const p of [0, 1] as const) if (pad ? pad.slot === p : Object.values(LOCAL_KEYS[p]).some(l => l.includes(code))) localOnPad[p] = !!pad;
  }
  const i = rawOrder.indexOf(code);
  if (i >= 0) rawOrder.splice(i, 1);
  if (isDown) { if (!rawHeld.has(code)) rawPressed.add(code); rawHeld.add(code); rawOrder.push(code); }
  else rawHeld.delete(code);
}
export const localDown = (p: 0 | 1, a: LocalAct): boolean => LOCAL_KEYS[p][a].some(c => rawHeld.has(c));
export const localPressed = (p: 0 | 1, a: LocalAct): boolean => LOCAL_KEYS[p][a].some(c => rawPressed.has(c));
/** The player has clicked or pressed a key on the page (set by main), so keys arrive and audio can play. */
export const page = { engaged: false };
/** Any key went down this frame (skipping an intro). */
export const anyPressed = (): boolean => rawPressed.size > 0;
/** Player `p`'s most recently pressed direction that is still held. */
export function localDir(p: 0 | 1): 'up' | 'down' | 'left' | 'right' | null {
  const l = LOCAL_KEYS[p];
  for (let i = rawOrder.length - 1; i >= 0; i--) {
    for (const d of ['up', 'down', 'left', 'right'] as const) if (l[d].includes(rawOrder[i])) return d;
  }
  return null;
}
/** Like navPressed, for one local player's keys. */
const localRepeat: Record<string, number> = {};
export function localNav(p: 0 | 1, a: 'up' | 'down' | 'left' | 'right', dt: number, delay = 0.32, rate = 0.08): boolean {
  const id = `${p}${a}`;
  if (localPressed(p, a)) { localRepeat[id] = delay; return true; }
  if (!localDown(p, a)) { localRepeat[id] = 0; return false; }
  localRepeat[id] -= dt;
  if (localRepeat[id] <= 0) { localRepeat[id] = rate; return true; }
  return false;
}
/** On-screen name of local player `p`'s key for an action. */
export const localKey = (p: 0 | 1, a: LocalAct): string =>
  localOnPad[p] ? padName((p === 0 ? pads.p1 : pads.p2)[a]) : keyName(p === 0 ? keys[a] : p2Keys[a]);

const down = new Set<Action>();
const pressed = new Set<Action>();
const released = new Set<Action>();
const heldCodes = new Set<string>();
/** Order in which directions were pressed, so the latest held direction wins. */
const dirOrder: Action[] = [];
let capture: ((code: string) => void) | null = null;

/** The next key or pad button press goes to `cb` instead of the game (used by the rebinding screen); pad buttons arrive as pad codes. null cancels. */
export function captureNextKey(cb: ((code: string) => void) | null): void { capture = cb; }

function onKey(e: KeyboardEvent, isDown: boolean): void {
  // typing into a dev tools field is not game input
  if (e.target instanceof Element && e.target.closest('input, select, textarea')) return;
  unlockAudio();
  if (isDown) onPad = false;
  if (capture && isDown) {
    e.preventDefault();
    const cb = capture;
    capture = null;
    cb(e.code);
    return;
  }
  if (!BINDINGS[e.code] && !LOCAL_CODES.has(e.code)) return;
  e.preventDefault();
  if (isDown && e.repeat) return;
  press(e.code, isDown);
}

/** Press or release a key code (a real key, or one of the touch pad's Pad codes). */
function press(code: string, isDown: boolean): void {
  if (LOCAL_CODES.has(code)) pressRaw(code, isDown);
  const acts = BINDINGS[code];
  if (!acts) return;
  if (isDown) heldCodes.add(code); else heldCodes.delete(code);
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

/** Touch pad buttons: press or release one of the Pad codes. */
export function virtualKey(code: string, isDown: boolean): void {
  if (isDown === heldCodes.has(code)) return;
  unlockAudio();
  press(code, isDown);
}
/** Let go of every touch pad button (the pad was hidden or changed layout). */
export function releaseVirtual(): void {
  for (const code of [...heldCodes]) if (code.startsWith('Pad')) press(code, false);
}

// ---------- mouse ----------
/** Pointer state in canvas pixels, with per-frame click edges. */
export const mouse = { x: -1, y: -1, moved: false, click: false, rclick: false, wheel: 0, down: false, touched: false };

/** True while the pointer is inside the rectangle. */
export const hover = (x: number, y: number, w: number, h: number): boolean =>
  mouse.x >= x && mouse.x < x + w && mouse.y >= y && mouse.y < y + h;

// A finger acts like the mouse: touching hovers (so holding a card reads it), a quick tap clicks,
// a long hold only reads, and dragging up or down scrolls like the wheel.
const LONG_PRESS = 0.4, DRAG = 8, WHEEL_STEP = 14;
let finger: { id: number; x0: number; y0: number; t0: number; wy: number; drag: boolean } | null = null;

function initMouse(canvas: HTMLCanvasElement): void {
  const at = (e: MouseEvent): void => {
    const r = canvas.getBoundingClientRect();
    // map to UI-layer pixels; the 480×320 game sits centered on a screen that may show more around it
    mouse.x = Math.floor((e.clientX - r.left) * view.w * 2 / r.width) - view.ox * 2;
    mouse.y = Math.floor((e.clientY - r.top) * view.h * 2 / r.height) - view.oy * 2;
  };
  canvas.addEventListener('mousemove', e => { at(e); mouse.moved = true; });
  canvas.addEventListener('mousedown', e => {
    at(e);
    if (e.button === 0) { mouse.click = true; mouse.down = true; }
    if (e.button === 2) mouse.rclick = true;
  });
  // fingers and pens; cancelling the pointerdown also stops the browser's emulated mouse events
  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' || finger) return; // a second finger on the screen is ignored
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    at(e);
    finger = { id: e.pointerId, x0: mouse.x, y0: mouse.y, t0: performance.now(), wy: mouse.y, drag: false };
    mouse.moved = true; mouse.down = true; mouse.touched = true;
  });
  canvas.addEventListener('pointermove', e => {
    if (!finger || e.pointerId !== finger.id) return;
    at(e);
    mouse.moved = true;
    if (Math.hypot(mouse.x - finger.x0, mouse.y - finger.y0) > DRAG) finger.drag = true;
    // finger up scrolls the list down, like the wheel
    while (mouse.y <= finger.wy - WHEEL_STEP) { mouse.wheel++; finger.wy -= WHEEL_STEP; }
    while (mouse.y >= finger.wy + WHEEL_STEP) { mouse.wheel--; finger.wy += WHEEL_STEP; }
  });
  const lift = (e: PointerEvent, cancel: boolean): void => {
    if (!finger || e.pointerId !== finger.id) return;
    if (!cancel && !finger.drag && performance.now() - finger.t0 < LONG_PRESS * 1000) mouse.click = true;
    mouse.down = false;
    finger = null;
  };
  canvas.addEventListener('pointerup', e => lift(e, false));
  canvas.addEventListener('pointercancel', e => lift(e, true));
  window.addEventListener('mouseup', e => { if (e.button === 0) mouse.down = false; });
  canvas.addEventListener('mouseleave', () => { mouse.x = mouse.y = -1; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => { e.preventDefault(); mouse.wheel += Math.sign(e.deltaY); }, { passive: false });
}

export function initInput(canvas?: HTMLCanvasElement): void {
  if (canvas) initMouse(canvas);
  window.addEventListener('keydown', e => onKey(e, true));
  window.addEventListener('keyup', e => onKey(e, false));
  window.addEventListener('blur', releaseAll);
  // iOS only lets sound start from the end of a touch
  for (const ev of ['pointerdown', 'pointerup', 'touchend']) window.addEventListener(ev, () => unlockAudio());
}

/** Let go of everything (the window lost focus or the game went to the background, so key-ups would be lost). */
export function releaseAll(): void {
  down.clear(); heldCodes.clear(); dirOrder.length = 0; rawHeld.clear(); rawOrder.length = 0;
  clearPads();
}

/** Read the gamepads. The main loop calls this before each fixed step, so pad presses land on step boundaries like keys. */
export function pollInput(): void {
  pollPads((code, isDown) => {
    if (isDown) { onPad = true; page.engaged = true; }
    if (capture && isDown) {
      const cb = capture;
      capture = null;
      cb(code);
      return;
    }
    press(code, isDown);
  });
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
  pressed.clear(); released.clear(); rawPressed.clear();
  mouse.click = mouse.rclick = mouse.moved = mouse.touched = false; mouse.wheel = 0;
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
