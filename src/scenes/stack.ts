// The scene stack. Screens open on top of the one they came from (pushScene) and BACK closes them
// (popScene), which shows the screen underneath exactly as it was left: cursor, picks, scroll. The title
// sits at the bottom. setScene starts over with a single screen; replaceScene swaps the top one (next round,
// rematch, a fight taking the stage select's place). No DOM here, so tests/scene-stack.ts runs in node.
import type { Ctx } from '../engine/gfx';
import type { PadMode } from '../engine/touch';

export interface Scene {
  update(dt: number): void;
  /** `c` is the 240×160 world; `ui` is the 480×320 sharp layer drawn on top of it. */
  draw(c: Ctx, tick: number, ui: Ctx): void;
  /** Called once, when the scene first opens. */
  enter?(): void;
  /** Called when the screen opened on top of this one closes and this one shows again. */
  resume?(): void;
  /** Which touch controls this screen shows on phones (a BACK button when left out). */
  pad?(): PadMode;
}

const stack: Scene[] = [];
let home: () => Scene = () => { throw new Error('setHome was never called'); };
/** What popping the last screen, or goHome, opens (the title screen). */
export function setHome(make: () => Scene): void { home = make; }

let onSwitch = (): void => {};
/** Run on every screen change, before the new screen's enter/resume (scene.ts clears hit zones). */
export function onSceneSwitch(fn: () => void): void { onSwitch = fn; }

function show(s: Scene, opened: boolean): void {
  onSwitch();
  if (opened) s.enter?.(); else s.resume?.();
}
/** Start over with `s` as the only screen. */
export function setScene(s: Scene): void { stack.length = 0; stack.push(s); show(s, true); }
/** Open `s` on top of the current screen; popScene comes back. */
export function pushScene(s: Scene): void { stack.push(s); show(s, true); }
/** Swap the current screen for `s`, keeping what is underneath. */
export function replaceScene(s: Scene): void { stack.pop(); pushScene(s); }
/** Close the current screen and show the one underneath (the title when there is none). */
export function popScene(): void {
  stack.pop();
  const under = stack[stack.length - 1];
  if (under) show(under, false); else goHome();
}
/** Close screens until one matching `want` is on top; when none is open, go home and open `orElse()` on it. */
export function popTo(want: (s: Scene) => boolean, orElse: () => Scene): void {
  let i = stack.length - 1;
  while (i >= 0 && !want(stack[i])) i--;
  if (i < 0) { goHome(); pushScene(orElse()); return; }
  stack.length = i + 1;
  show(stack[i], false);
}
/** Back to a fresh title screen, closing everything. */
export function goHome(): void { setScene(home()); }
export const getScene = (): Scene | null => stack[stack.length - 1] ?? null;
/** How many screens are open (for tests). */
export const sceneDepth = (): number => stack.length;
