// Gamepads (the browser Gamepad API, "standard" mapping). Pads are polled once per fixed step and turned into
// digital button codes, so the fight only ever sees the same on/off presses a keyboard makes: lockstep and
// rollback stay deterministic, and the analog stick never reaches the sim.
//
// Up to two pads are kept. Each takes the first free slot when it connects and keeps it until it disconnects,
// so pad 1 is player 1 and pad 2 is player 2 in local Versus. A pressed button comes out as `Gp<slot><Button>`,
// e.g. "Gp1A" or "Gp2Start".

/** Button names, by index in the standard mapping. */
export const PAD_BUTTONS = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'L3', 'R3', 'Up', 'Down', 'Left', 'Right', 'Home'] as const;
export type PadButton = (typeof PAD_BUTTONS)[number];
export const PAD_SLOTS = 2;

// the left stick counts as the d-pad past half tilt, and lets go under a third (so a resting stick never jitters)
const STICK_ON = 0.5, STICK_OFF = 0.35;
// analog triggers count as pressed past halfway
const TRIGGER = 0.5;

/** The pad code for a button on a slot (0 or 1). */
export const padCode = (slot: number, b: PadButton): string => `Gp${slot + 1}${b}`;
/** Splits a pad code into its slot and button, or null for any other code. */
export function parsePad(code: string): { slot: number; button: PadButton } | null {
  const m = /^Gp([12])(\w+)$/.exec(code);
  return m && (PAD_BUTTONS as readonly string[]).includes(m[2]) ? { slot: Number(m[1]) - 1, button: m[2] as PadButton } : null;
}

/** On-screen name of a pad button. */
export function padName(b: string): string {
  const map: Partial<Record<PadButton, string>> = { Back: 'SELECT', Up: 'D-↑', Down: 'D-↓', Left: 'D-←', Right: 'D-→' };
  return map[b as PadButton] ?? b.toUpperCase();
}

/** Gamepad index → slot. */
const slots = new Map<number, number>();
/** What each slot held last poll. */
const held: Array<Set<PadButton>> = Array.from({ length: PAD_SLOTS }, () => new Set());

const readPads = (): Array<Gamepad | null> => {
  try { return typeof navigator !== 'undefined' && navigator.getGamepads ? [...navigator.getGamepads()] : []; } catch { return []; }
};

/** How many pads are connected and holding a slot. */
export const padCount = (): number => slots.size;

/**
 * Read every pad and report each button that went down or up since the last poll. A pad that went away
 * releases everything it held.
 */
export function pollPads(emit: (code: string, isDown: boolean) => void): void {
  const pads = readPads();
  const seen = new Set<number>();
  for (const p of pads) {
    if (!p || !p.connected) continue;
    seen.add(p.index);
    let slot = slots.get(p.index);
    if (slot === undefined) {
      const used = new Set(slots.values());
      slot = [...Array(PAD_SLOTS).keys()].find(s => !used.has(s));
      if (slot === undefined) continue; // a third pad is ignored
      slots.set(p.index, slot);
    }
    diff(slot, read(p, held[slot]), emit);
  }
  for (const [index, slot] of [...slots]) {
    if (seen.has(index)) continue;
    slots.delete(index);
    diff(slot, new Set(), emit);
  }
}

function diff(slot: number, now: Set<PadButton>, emit: (code: string, isDown: boolean) => void): void {
  const was = held[slot];
  for (const b of was) if (!now.has(b)) emit(padCode(slot, b), false);
  for (const b of now) if (!was.has(b)) emit(padCode(slot, b), true);
  held[slot] = now;
}

/** The buttons a pad holds now; `prev` gives the stick its hysteresis. */
function read(p: Gamepad, prev: Set<PadButton>): Set<PadButton> {
  const out = new Set<PadButton>();
  p.buttons.forEach((btn, i) => {
    const name = PAD_BUTTONS[i];
    if (!name) return;
    const analog = name === 'LT' || name === 'RT';
    if (btn.pressed || (analog && btn.value > TRIGGER)) out.add(name);
  });
  const [x = 0, y = 0] = p.axes;
  const axis = (v: number, b: PadButton): void => { if (v > (prev.has(b) ? STICK_OFF : STICK_ON)) out.add(b); };
  axis(-y, 'Up'); axis(y, 'Down'); axis(-x, 'Left'); axis(x, 'Right');
  return out;
}

/** Forget every pad's held buttons (the window lost focus); they press again on the next poll if still held. */
export function clearPads(): void { for (const h of held) h.clear(); }
