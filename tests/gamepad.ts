// Gamepad input: a fake pad (standard mapping) is polled the way the main loop does, and its presses must come
// out as the same actions a keyboard makes: menus, single-player, both players in local Versus, and rebinding.
// Run: npx tsx tests/gamepad.ts
import { pollInput, endFrame, isDown, wasPressed, heldDir, localDown, localPressed, localDir, k, localKey, captureNextKey, setPadButton, resetPads } from '../src/engine/input';

interface FakePad { index: number; connected: boolean; mapping: string; buttons: Array<{ pressed: boolean; value: number }>; axes: number[] }
const pads: Array<FakePad | null> = [null, null, null, null];
Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => pads }, configurable: true });

const pad = (index: number): FakePad => (pads[index] = {
  index, connected: true, mapping: 'standard',
  buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0],
});
const hold = (p: FakePad, i: number, on: boolean): void => { p.buttons[i] = { pressed: on, value: on ? 1 : 0 }; };
/** One fixed step: poll, let the test look, then end the frame. */
const step = (look: () => void = () => {}): void => { pollInput(); look(); endFrame(); };

let failed = 0;
const check = (what: string, ok: boolean): void => { if (!ok) { failed++; console.error(`FAIL ${what}`); } else console.log(`ok   ${what}`); };

const A = 0, B = 1, RB = 5, START = 9, UP = 12, RIGHT = 15;
const p1 = pad(0);

// buttons: A attacks and confirms, B casts and backs out, edges last one step
hold(p1, A, true);
step(() => check('A presses attack + confirm', wasPressed('attack') && wasPressed('confirm') && isDown('attack')));
step(() => check('a held button is down but not pressed again', isDown('attack') && !wasPressed('attack')));
hold(p1, A, false);
step(() => check('letting go releases it', !isDown('attack')));
hold(p1, B, true); step(() => check('B presses cast + back', wasPressed('cast') && wasPressed('back'))); hold(p1, B, false); step();
hold(p1, START, true); step(() => check('START pauses', wasPressed('pause'))); hold(p1, START, false); step();
hold(p1, RB, true); step(() => check('RB opens the Draw screen and tabs right', wasPressed('custom') && wasPressed('rb'))); hold(p1, RB, false); step();

// the d-pad and the stick both move, and the latest held direction wins
hold(p1, UP, true); step(() => check('d-pad up moves up', heldDir() === 'up'));
p1.axes[0] = 0.9; step(() => check('stick right while d-pad up held: latest wins', heldDir() === 'right'));
p1.axes[0] = 0.4; step(() => check('stick stays right above the release threshold', heldDir() === 'right'));
p1.axes[0] = 0.2; step(() => check('stick back to centre releases', heldDir() === 'up'));
hold(p1, UP, false); step(() => check('nothing held', heldDir() === null));
p1.axes[0] = 0.45; step(() => check('a half-tilted stick below the press threshold does nothing', heldDir() === null));
p1.axes[0] = 0;

// hints name pad buttons after a pad press
check('hints name pad buttons when playing on a pad', k('attack') === 'A' && k('custom') === 'RB');

// local Versus: pad 1 is player 1, pad 2 is player 2
const p2 = pad(1);
step();
hold(p2, A, true); hold(p2, RIGHT, true);
step(() => check('pad 2 attacks as player 2 only', localPressed(1, 'attack') && localDown(1, 'attack') && !localDown(0, 'attack')));
step(() => check('pad 2 d-pad moves player 2', localDir(1) === 'right' && localDir(0) === null));
hold(p2, A, false); hold(p2, RIGHT, false);
hold(p1, A, true); step(() => check('pad 1 attacks as player 1', localPressed(0, 'attack') && !localDown(1, 'attack'))); hold(p1, A, false); step();
check('player 2 hints name pad buttons', localKey(1, 'attack') === 'A');

// unplugging a pad lets go of what it held
hold(p2, B, true); step();
pads[1] = null;
step(() => check('a pad that disconnects releases its buttons', !localDown(1, 'cast')));

// rebinding: the capture gets pad codes, and a new binding swaps with the action that had the button
let got = '';
captureNextKey(code => { got = code; });
hold(p1, 3, true); step(() => check('rebinding captures the pressed pad button', got === 'Gp1Y' && !wasPressed('reset')));
hold(p1, 3, false); step();
setPadButton(0, 'attack', 'X');
hold(p1, 2, true); step(() => check('a rebound button attacks', wasPressed('attack'))); hold(p1, 2, false); step();
hold(p1, A, true); step(() => check('A still confirms menus after attack moves off it', wasPressed('confirm') && !wasPressed('attack'))); hold(p1, A, false); step();
setPadButton(0, 'attack', 'B');
hold(p1, B, true); step(() => check('taking cast\'s button swaps cast onto the old one', wasPressed('attack') && !wasPressed('cast'))); hold(p1, B, false); step();
hold(p1, 2, true); step(() => check('cast moved to X', wasPressed('cast'))); hold(p1, 2, false); step();
resetPads(0);

if (failed) { console.error(`${failed} gamepad check(s) failed`); process.exit(1); }
console.log('gamepad: all checks passed');
