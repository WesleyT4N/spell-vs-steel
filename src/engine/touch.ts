// Phone and tablet play: an on-screen pad for the fight (d-pad, attack, cast, Draw, pause), a back
// button for menus, a text box for typing room codes, and tap-friendly wording for the hints.
// Menus themselves take taps on the canvas (see the finger handling in input.ts).
import { virtualKey, releaseVirtual, getKey, keyName, type Bindable } from './input';
import { view } from './gfx';

/** What the current screen needs: nothing, a back button, or the fight pad (`fight-ready` lights DRAW). */
export type PadMode = 'none' | 'back' | 'fight' | 'fight-ready';

// ?touch=1 shows the pad on any device, ?touch=0 never; otherwise it follows the last input used
const forced = new URLSearchParams(location.search).get('touch');
let active = forced !== null ? forced === '1' : matchMedia('(pointer: coarse)').matches;
/** True while the game is being played by touch. */
export const touchActive = (): boolean => active;

let changed: () => void = () => {};
/** Called when touch play turns on or off (the screen layout changes). */
export function onTouchChange(cb: () => void): void { changed = cb; }
function setActive(on: boolean): void {
  if (forced !== null || on === active) return;
  active = on;
  if (!on) releaseVirtual();
  changed();
}
window.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') setActive(true); }, true);
window.addEventListener('keydown', e => {
  if (e.isTrusted && !(e.target instanceof Element && e.target.closest('input, select, textarea'))) setActive(false);
}, true);

const CSS = `
html.svs-touch, html.svs-touch body { touch-action: none; overscroll-behavior: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
body.svs-portrait { align-items: flex-start; }
.svs-pad { position: fixed; inset: 0; pointer-events: none; z-index: 10; font: bold 14px ui-monospace, Menlo, Consolas, monospace; color: #fcfcfc; }
.svs-pad [hidden] { display: none !important; }
.svs-pad > * { position: absolute; pointer-events: auto; touch-action: none; box-sizing: border-box; }
.svs-pad .over { opacity: 0.55; }
.svs-dpad > div { position: absolute; background: #3c3c3c; border: 3px solid #fcfcfc; box-sizing: border-box; }
.svs-dpad > .on { background: #f8b800; }
.svs-dpad > .mid { border: 0; background: #3c3c3c; }
.svs-btn { border-radius: 50%; border: 3px solid #fcfcfc; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1; }
.svs-btn small { font-size: 10px; margin-top: 3px; letter-spacing: 1px; }
.svs-btn.on { filter: brightness(1.6); transform: scale(0.94); }
.svs-pill { border-radius: 14px; border: 3px solid #7c7c7c; background: #000; display: flex; align-items: center; justify-content: center; font-size: 12px; letter-spacing: 1px; }
.svs-pill.ready { border-color: #f8b800; color: #f8b800; }
.svs-pill.on { background: #0000a8; }
.svs-pill.big { font-size: 18px; letter-spacing: 2px; border-radius: 22px; }
.svs-code { opacity: 0.01; font-size: 16px; border: 0; padding: 0; color: transparent; background: transparent; caret-color: transparent; }
`;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  e.className = cls;
  parent?.appendChild(e);
  return e;
};

const style = document.createElement('style');
style.textContent = CSS;
document.head.appendChild(style);
const root = el('div', 'svs-pad');
root.hidden = true;
document.body.appendChild(root);

const buzz = (): void => { try { navigator.vibrate?.(8); } catch { /* not allowed */ } };

/** A button that holds a Pad code down while a finger is on it. */
function holdButton(e: HTMLElement, code: string): void {
  let id = -1;
  e.addEventListener('pointerdown', ev => {
    ev.preventDefault();
    if (id >= 0) return;
    id = ev.pointerId;
    e.setPointerCapture(id);
    e.classList.add('on');
    virtualKey(code, true);
    buzz();
  });
  const up = (ev: PointerEvent): void => {
    if (ev.pointerId !== id) return;
    id = -1;
    e.classList.remove('on');
    virtualKey(code, false);
  };
  e.addEventListener('pointerup', up);
  e.addEventListener('pointercancel', up);
  e.addEventListener('lostpointercapture', up);
}

// ---------- d-pad: one finger, slide to change direction ----------
type Dir = 'up' | 'down' | 'left' | 'right';
const DIRS: Dir[] = ['up', 'down', 'left', 'right'];
const PAD_CODE: Record<Dir, string> = { up: 'PadUp', down: 'PadDown', left: 'PadLeft', right: 'PadRight' };
const dpad = el('div', 'svs-dpad', root);
const arms = Object.fromEntries(DIRS.map(d => [d, el('div', d, dpad)])) as Record<Dir, HTMLDivElement>;
el('div', 'mid', dpad);
let padId = -1;
let padDir: Dir | null = null;
function setDir(d: Dir | null): void {
  if (d === padDir) return;
  if (padDir) { virtualKey(PAD_CODE[padDir], false); arms[padDir].classList.remove('on'); }
  padDir = d;
  if (d) { virtualKey(PAD_CODE[d], true); arms[d].classList.add('on'); buzz(); }
}
function dirAt(ev: PointerEvent): Dir | null {
  const r = dpad.getBoundingClientRect();
  const dx = ev.clientX - (r.left + r.width / 2), dy = ev.clientY - (r.top + r.height / 2);
  // a small dead zone in the middle keeps the current direction
  if (Math.hypot(dx, dy) < r.width * 0.12) return padDir;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
}
dpad.addEventListener('pointerdown', ev => {
  ev.preventDefault();
  if (padId >= 0) return;
  padId = ev.pointerId;
  dpad.setPointerCapture(padId);
  setDir(dirAt(ev));
});
dpad.addEventListener('pointermove', ev => { if (ev.pointerId === padId) setDir(dirAt(ev)); });
const padUp = (ev: PointerEvent): void => { if (ev.pointerId === padId) { padId = -1; setDir(null); } };
dpad.addEventListener('pointerup', padUp);
dpad.addEventListener('pointercancel', padUp);
dpad.addEventListener('lostpointercapture', padUp);

// ---------- buttons ----------
function roundButton(code: string, bg: string): { e: HTMLDivElement; key: HTMLSpanElement } {
  const e = el('div', 'svs-btn', root);
  e.style.background = bg;
  const key = el('span', '', e);
  holdButton(e, code);
  return { e, key };
}
const attack = roundButton('PadAttack', '#a80020');
el('small', '', attack.e).textContent = 'ATTACK';
const cast = roundButton('PadCast', '#0058f8');
el('small', '', cast.e).textContent = 'CAST';
const pill = (code: string, label: string): HTMLDivElement => {
  const e = el('div', 'svs-pill', root);
  e.textContent = label;
  holdButton(e, code);
  return e;
};
const draw = pill('PadDraw', 'DRAW');
draw.classList.add('big');
const pause = pill('PadPause', 'PAUSE');
const back = pill('PadBack', '◀ BACK');

// ---------- room code box ----------
const code = el('input', 'svs-code', root);
code.type = 'text';
code.autocomplete = 'off';
code.spellcheck = false;
code.setAttribute('autocapitalize', 'characters');
code.setAttribute('autocorrect', 'off');
let codeHandlers: { change: (v: string) => void; enter: () => void; filter: (v: string) => string } | null = null;
code.addEventListener('input', () => {
  if (!codeHandlers) return;
  const v = codeHandlers.filter(code.value);
  code.value = v;
  codeHandlers.change(v);
});
code.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); codeHandlers?.enter(); } });
let codeRect: [number, number, number, number] | null = null;
let codeAsked = false;

/**
 * Ask for the room code text box this frame, over the UI rectangle where the code is drawn.
 * Tapping it brings up the phone keyboard. `filter` cleans what was typed and returns the code.
 */
export function touchCodeBox(x: number, y: number, w: number, h: number, value: string,
  filter: (v: string) => string, change: (v: string) => void, enter: () => void): void {
  if (!active) return;
  codeAsked = true;
  codeHandlers = { filter, change, enter };
  if (code.value !== value) code.value = value;
  const moved = !codeRect || codeRect[0] !== x || codeRect[1] !== y;
  codeRect = [x, y, w, h];
  if (moved) layout();
}

// ---------- layout ----------
let canvasEl: HTMLCanvasElement | null = null;
let mode: PadMode = 'none';

const place = (e: HTMLElement, x: number, y: number, w: number, h: number, canvas: DOMRect): void => {
  e.style.left = `${Math.round(x)}px`; e.style.top = `${Math.round(y)}px`;
  e.style.width = `${Math.round(w)}px`; e.style.height = `${Math.round(h)}px`;
  const over = x < canvas.right && x + w > canvas.left && y < canvas.bottom && y + h > canvas.top;
  e.classList.toggle('over', over);
};


// the notch and home bar: phones report them as CSS env() values, read back through a hidden probe
const safeProbe = el('div', '');
safeProbe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)';
document.body.appendChild(safeProbe);
/** Screen space under the notch (top) and the home bar (bottom), in CSS pixels. 0 on most screens. */
export function safeInsets(): { top: number; bottom: number } {
  const st = getComputedStyle(safeProbe);
  return { top: parseFloat(st.paddingTop) || 0, bottom: parseFloat(st.paddingBottom) || 0 };
}

/** Visible screen size. Phones can grow the layout viewport past the screen when anything overflows, so trust the visual one. */
export function viewport(): [number, number] {
  const v = window.visualViewport;
  return [Math.min(window.innerWidth, v?.width ?? Infinity), Math.min(window.innerHeight, v?.height ?? Infinity)];
}

/** Position the pad around the canvas. Call after the canvas is resized. */
export function layout(canvas = canvasEl): void {
  canvasEl = canvas;
  document.documentElement.classList.toggle('svs-touch', active);
  if (!canvas) return;
  const screen = canvas.getBoundingClientRect();
  // the game itself, centered on a screen that may show extra stage around it; buttons keep off it
  const k = screen.width / view.w;
  const r = new DOMRect(screen.left + view.ox * k, screen.top + view.oy * k, screen.width - 2 * view.ox * k, screen.height - 2 * view.oy * k);
  const [vw, vh] = viewport();
  let size: number, cy: number, dx: number, ax: number;
  if (vh > vw) {
    // portrait: the screen sits on top, the pad underneath like a handheld
    const below = vh - screen.bottom;
    size = Math.min(180, vw * 0.42, below * 0.62);
    cy = screen.bottom + below * 0.5;
    dx = 14 + size / 2;
    ax = vw - 14 - size / 2;
    place(pause, vw / 2 - 36, screen.bottom + 14, 72, 28, r);
    place(back, 12, screen.bottom + 10, 92, 32, r);
    place(draw, ax - size * 0.5, cy - size / 2 - 60, size, 46, r);
  } else {
    // landscape: thumbs on either side of the screen
    size = Math.min(160, vh * 0.38);
    cy = Math.min(vh - size / 2 - 14, r.top + r.height * 0.64);
    const side = (vw - r.width) / 2;
    dx = Math.max(10 + size / 2, side / 2);
    ax = vw - dx;
    place(pause, vw - 82, 8, 74, 28, r);
    place(back, 8, 8, 92, 32, r);
    // DRAW over the buttons, kept off the screen when the side has room
    const w = Math.max(size * 0.8, Math.min(size, side - 12));
    place(draw, ax - w / 2, cy - size / 2 - 54, w, 42, r);
  }
  place(dpad, dx - size / 2, cy - size / 2, size, size, r);
  const arm = size / 3;
  arms.up.style.cssText = `left:${arm}px;top:0;width:${arm}px;height:${arm + 3}px;border-bottom:0`;
  arms.down.style.cssText = `left:${arm}px;top:${2 * arm - 3}px;width:${arm}px;height:${arm + 3}px;border-top:0`;
  arms.left.style.cssText = `left:0;top:${arm}px;width:${arm + 3}px;height:${arm}px;border-right:0`;
  arms.right.style.cssText = `left:${2 * arm - 3}px;top:${arm}px;width:${arm + 3}px;height:${arm}px;border-left:0`;
  (dpad.lastElementChild as HTMLElement).style.cssText = `left:${arm}px;top:${arm}px;width:${arm}px;height:${arm}px`;
  // attack sits up and right of cast, like A and B on a handheld
  const d = size * 0.48;
  place(attack.e, ax + size / 2 - d, cy - size / 2, d, d, r);
  place(cast.e, ax - size / 2, cy + size / 2 - d, d, d, r);
  for (const b of [attack, cast]) {
    b.key.style.fontSize = `${Math.round(d * 0.32)}px`;
    (b.e.lastElementChild as HTMLElement).style.fontSize = `${Math.min(10, Math.round(d * 0.11))}px`;
  }
  if (codeRect) {
    const u = k / 2; // CSS pixels per UI pixel
    const [x, y, w, h] = codeRect;
    code.style.cssText = `left:${r.left + x * u}px;top:${r.top + y * u}px;width:${w * u}px;height:${h * u}px`;
  }
}

const label = (a: Bindable): string => keyName(getKey(a));

/** Show what the current screen needs. Call once per frame, after the scene has drawn. */
export function syncPad(want: PadMode): void {
  if (!active) want = 'none';
  root.hidden = !active;
  if (want !== mode) {
    // a button held through a screen change would stay stuck down
    releaseVirtual();
    setDir(null);
    mode = want;
  }
  const fight = mode === 'fight' || mode === 'fight-ready';
  dpad.hidden = attack.e.hidden = cast.e.hidden = draw.hidden = pause.hidden = !fight;
  back.hidden = mode !== 'back';
  draw.classList.toggle('ready', mode === 'fight-ready');
  if (fight) {
    // keys show their keyboard names, so hints like "TAP J" still match
    const a = label('attack'), c = label('cast');
    if (attack.key.textContent !== a) attack.key.textContent = a;
    if (cast.key.textContent !== c) cast.key.textContent = c;
  }
  code.hidden = !codeAsked;
  if (!codeAsked && codeRect) { codeRect = null; code.blur(); codeHandlers = null; }
  codeAsked = false;
}

// Mouse wording to touch wording, most specific first.
const TOUCH_WORDS: Array<[RegExp, string]> = [
  [/RIGHT-CLICK UNDOES A PICK\./g, 'TAP A PICKED CARD AGAIN TO UNDO IT.'],
  [/RIGHT-CLICK: UNDO/g, 'TAP AGAIN: UNDO'],
  [/RIGHT-CLICK: REMOVE/g, 'TAP -: REMOVE'],
  [/ \/ RIGHT-CLICK/g, ''],
  [/CLICK: PICK/g, 'HOLD: READ   TAP: PICK'],
  [/ {2,}KEYS: .*$/g, ''],
  [/HOVER A CARD \(OR USE [^)]*\)/g, 'TOUCH AND HOLD A CARD'],
  [/HOVER A CARD/g, 'TOUCH A CARD'],
  [/HOVER TO READ/g, 'HOLD TO READ'],
  [/WHEEL: SCROLL/g, 'DRAG: SCROLL'],
  [/CLICK/g, 'TAP'],
];
/** Rewrite a mouse hint ("CLICK", "RIGHT-CLICK", "HOVER") for touch play. Unchanged with a mouse. */
export function touchText(s: string): string {
  if (!active) return s;
  for (const [re, to] of TOUCH_WORDS) s = s.replace(re, to);
  return s;
}
