// A text box for typing free text (lobby chat): an invisible page input laid over a box the scene
// draws itself in the bitmap font. Keys typed into it never reach the game (see input.ts), and on
// phones tapping the box brings up the keyboard.
import { view } from './gfx';

let input: HTMLInputElement | null = null;
let handlers: { change: (v: string) => void; enter: () => void } | null = null;
let shown = false;

function make(): HTMLInputElement {
  const e = document.createElement('input');
  e.type = 'text';
  e.autocomplete = 'off';
  e.spellcheck = false;
  e.setAttribute('autocorrect', 'off');
  e.style.cssText = 'position:fixed;opacity:0.01;font-size:16px;border:0;padding:0;margin:0;color:transparent;background:transparent;caret-color:transparent;z-index:11;display:none';
  e.addEventListener('input', () => handlers?.change(e.value));
  e.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') { ev.preventDefault(); handlers?.enter(); }
    if (ev.key === 'Escape') { ev.preventDefault(); e.blur(); }
  });
  document.body.appendChild(e);
  return e;
}

/**
 * Show the box over UI-layer rect (x, y, w, h) holding `value`. Call every frame it should stay up,
 * then `endTextFields` once per frame hides it when a scene stops asking.
 */
export function textField(x: number, y: number, w: number, h: number, value: string, maxLen: number, change: (v: string) => void, enter: () => void): void {
  input ??= make();
  handlers = { change, enter };
  input.maxLength = maxLen;
  if (input.value !== value) input.value = value;
  const canvas = document.getElementById('game');
  if (canvas) {
    const r = canvas.getBoundingClientRect(), k = r.width / view.w, u = k / 2; // CSS pixels per world / UI pixel
    const left = r.left + view.ox * k + x * u, top = r.top + view.oy * k + y * u;
    input.style.left = `${Math.round(left)}px`; input.style.top = `${Math.round(top)}px`;
    input.style.width = `${Math.round(w * u)}px`; input.style.height = `${Math.round(h * u)}px`;
  }
  input.style.display = 'block';
  shown = true;
}

export const textFieldFocused = (): boolean => !!input && document.activeElement === input;
export function focusTextField(): void { input?.focus(); }
export function blurTextField(): void { input?.blur(); }

/** Call once per frame after drawing: hides the box if nothing asked for it this frame. */
export function endTextFields(): void {
  if (!input) return;
  if (!shown && input.style.display !== 'none') { input.blur(); input.style.display = 'none'; handlers = null; }
  shown = false;
}
