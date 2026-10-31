// Plays pixelfx-style effects (src/fx/) for battle fx. Render-only: an effect is a pure function of its fx's age,
// seeded from when and where it started, so a rollback that resimulates the same hit draws the same picture.
// Each effect draws inside its box: 24 px tall above the panel's feet, 24 px wide, and `panels` panels long along
// the attacker's facing (shots and multi-panel swings carry their box down the row). See docs/FX.md.
import { createFrame, clearFrame, createFx, composite, hash, hex } from '../vendor/pixelfx/index.js';
import { panelFoot, PW } from '../art/arena';
import type { Ctx } from '../engine/gfx';
import type { Battle, Fx } from './battle';

/** The painter pixelfx hands an effect (see src/vendor/pixelfx/painter.js). Loosely typed: the vendored core is JS. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Painter = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Opts = Record<string, any> & { seed: number; flip: boolean };

export interface PfxMeta {
  name: string;
  desc: string;
  /** Seconds the effect runs; the battle fx's own duration is stretched onto it. */
  duration: number;
  /** How many panels the box spans along the attacker's facing (1 = the anchor panel only). */
  panels?: number;
  /**
   * Trace a 1px outline in this color around the effect's solid shapes, like the inked fighters and stages
   * (single stray pixels such as sparks stay unoutlined). Usually the darkest step of the element's ramp.
   */
  ink?: string;
  options?: Record<string, unknown>;
}
export interface PfxModule {
  meta: PfxMeta;
  /** A pure effect: the frame at time t. */
  draw?(p: Painter, t: number, o: Opts): void;
  /** A simulated effect: stepped forward in time from its start. */
  create?(o: Opts): { update(dt: number, o?: Opts): void; draw(p: Painter, t?: number, o?: Opts): void };
}

/** Box bounds in local space (x forward from the anchor panel's center, y down from its feet). */
export const BOX = { half: 12, top: -24, bottom: 3 };
export const boxOf = (m: PfxMeta): { x0: number; x1: number; y0: number; y1: number } =>
  ({ x0: -BOX.half, x1: BOX.half + ((m.panels ?? 1) - 1) * PW, y0: BOX.top, y1: BOX.bottom });

const registry = new Map<string, PfxModule>();
/** Play `mod` for battle fx of this kind. */
export function registerPfx(kind: string, mod: PfxModule): void { registry.set(kind, mod); }
/** Go back to the hand-drawn version for this kind. */
export function unregisterPfx(kind: string): void { registry.delete(kind); }
export const pfxFor = (kind: string): PfxModule | undefined => registry.get(kind);

interface Live { inst: ReturnType<typeof createFx>; tt: number; seen: number }
const lives = new WeakMap<Battle, Map<string, Live>>();
let frameNo = 0;
let canvas: HTMLCanvasElement | null = null;

/** Draw fx `e` with its registered effect. False when none is registered, so the caller draws its own. */
export function drawPfx(c: Ctx, b: Battle, e: Fx): boolean {
  const mod = registry.get(e.kind);
  if (!mod) return false;
  const { meta } = mod, flip = e.side === 1;
  // keyed by when and where the fx started, not by object: a rollback resimulates the same hit as a new fx
  const key = `${e.kind}|${(b.time - e.t).toFixed(3)}|${e.side}|${e.col}|${e.row}`;
  let map = lives.get(b);
  if (!map) lives.set(b, map = new Map());
  const tt = Math.min(1, e.t / e.dur) * meta.duration;
  const box = boxOf(meta), foot = panelFoot(e.col, e.row);
  let live = map.get(key);
  if (!live || tt < live.tt) {
    // the painter puts the effect's origin at the panel's feet (world pixels), mirrored for the right-hand side
    const inst = createFx(mod, { x: Math.round(foot.x), y: Math.round(foot.y), flip, seed: hash(...[...key].map(ch => ch.charCodeAt(0))) % 100000 });
    map.set(key, live = { inst, tt: 0, seen: frameNo });
  }
  if (tt > live.tt) { live.inst.update(tt - live.tt); live.tt = tt; }
  live.seen = frameNo;

  const w = box.x1 - box.x0, h = box.y1 - box.y0;
  const ox = Math.round(flip ? foot.x - box.x1 : foot.x + box.x0), oy = Math.round(foot.y + box.y0);
  const frame = createFrame(w, h, ox, oy);
  clearFrame(frame);
  live.inst.draw(frame, 'all');
  if (meta.ink) inkOutline(frame.color, w, h, hex(meta.ink));
  const img = new ImageData(w, h);
  composite(frame, img.data, null);
  canvas ??= document.createElement('canvas');
  if (canvas.width < w) canvas.width = w;
  if (canvas.height < h) canvas.height = h;
  const cc = canvas.getContext('2d')!;
  cc.clearRect(0, 0, w, h);
  cc.putImageData(img, 0, 0);
  c.drawImage(canvas, 0, 0, w, h, ox, oy, w, h);
  return true;
}

/** Forget effects that weren't drawn this frame (call once per frame, after the battle is drawn). */
export function endPfxFrame(b: Battle): void {
  const map = lives.get(b);
  if (map) for (const [k, l] of map) if (l.seen !== frameNo) map.delete(k);
  frameNo++;
}

/** Outline the solid shapes in a color buffer: every empty pixel beside a pixel that has a solid neighbor of its own. */
export function inkOutline(C: Uint32Array, w: number, h: number, ink: number): void {
  const on = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && C[y * w + x] >>> 24 > 0;
  // a pixel with no solid neighbor (a spark, a mote) is left alone, so it stays a light 1px speck
  const solid = (x: number, y: number): boolean => on(x, y) && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1) || on(x - 1, y - 1) || on(x + 1, y - 1) || on(x - 1, y + 1) || on(x + 1, y + 1));
  const mark: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (on(x, y)) continue;
    if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) mark.push(y * w + x);
  }
  for (const i of mark) C[i] = ink;
}
