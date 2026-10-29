// The standard look for a number something else has changed (a cost Arcane Power lowered, later a damage
// buff), as deckbuilders do it: the value as it is now, inked green when the change helps you and red when
// it hurts, with the change itself (-1, +300) as a small tag beside it. Display only: it reads Battle, never
// writes it.
import { P, type Ctx } from '../engine/gfx';
import { drawText, textWidth } from '../engine/font';
import { RED_INK, PAPER } from './skin';

/** Ink for a change that helps (cheaper, more damage) and one that hurts. */
export const BUFF_INK = '#007800';
export const NERF_INK = RED_INK;
/** Wax for a buffed or nerfed cost seal. */
export const BUFF_WAX = '#00a800';
export const NERF_WAX = '#a81000';

/** +1 when `now` is better than `base`, -1 when worse, 0 when unchanged. Costs are better lower. */
export function modSign(base: number, now: number, lowerIsBetter: boolean): number {
  if (now === base) return 0;
  return (now < base) === lowerIsBetter ? 1 : -1;
}

/** Ink for a value that is `sign` (see modSign), `plain` when unchanged. */
export const modInk = (sign: number, plain: string): string => (sign > 0 ? BUFF_INK : sign < 0 ? NERF_INK : plain);

/** A damage multiplier's change as text: 1.25 -> +25%. */
export const pctText = (mult: number): string => deltaText(Math.round((mult - 1) * 100)) + '%';

/** The change as text: -1, +300. */
export const deltaText = (delta: number): string => (delta > 0 ? `+${delta}` : String(delta));

/** The change (deltaText, or a word like FREE) as a small parchment tag in green or red, its left edge at `x`. Returns the width drawn. */
export function drawDelta(c: Ctx, t: string, sign: number, x: number, y: number): number {
  const w = textWidth(t) + 4;
  P(c, modInk(sign, BUFF_INK), x, y - 2, w, 11);
  P(c, PAPER, x + 1, y - 1, w - 2, 9);
  drawText(c, t, x + 2, y, modInk(sign, BUFF_INK));
  return w;
}

/**
 * A changed number in the standard look, its left edge at `x`: `now` in green or red, then the change as a
 * tag. Unchanged values print plainly in `plain`. Returns the width drawn.
 */
export function drawModValue(c: Ctx, now: string, delta: string, sign: number, x: number, y: number, plain: string, scale = 1): number {
  const w = textWidth(now, scale);
  drawText(c, now, x, y, modInk(sign, plain), scale);
  if (!sign) return w;
  return w + 4 + drawDelta(c, delta, sign, x + w + 4, y + (scale - 1) * 3);
}
