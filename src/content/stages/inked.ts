// Shared pieces for the Inked stages (see src/art/ink.ts): the StageDef shape, the class that paints one, and
// helpers more than one stage uses. A stage module is a StageDef wrapped by inkedStage().
import { clamp, vnoise, type Ctx } from '../../engine/gfx';
import type { PanelLook, Stage } from '../../art/arena';
import { wide, put, BW, XL, XR } from '../../art/ink';
import type { StageModule } from './registry';

/** A stage as drafted: static layers painted once, animated bits drawn every frame. */
export interface StageDef {
  id: string;
  name: string;
  tag: string;
  panelSeed: number;
  panel: PanelLook;
  tex(c: Ctx, x: number, y: number, w: number, h: number, r: () => number): void;
  /** Sky and far scenery, painted once. */
  back?(c: Ctx): void;
  /** Animated, between the sky and the near scenery. */
  behind?(c: Ctx, t: number): void;
  /** Near scenery, painted once. */
  front?(c: Ctx): void;
  /** Animated, over the scenery (still under the panels). */
  over?(c: Ctx, t: number): void;
}

export class DraftStage implements Stage {
  id: string; name: string; tag: string; panel: PanelLook; panelSeed: number;
  tex: StageDef['tex'];
  private back: HTMLCanvasElement | null;
  private front: HTMLCanvasElement | null;
  constructor(private d: StageDef) {
    this.id = d.id; this.name = d.name; this.tag = d.tag; this.panel = d.panel; this.panelSeed = d.panelSeed; this.tex = d.tex;
    this.back = d.back ? wide(c => d.back!(c)) : null;
    this.front = d.front ? wide(c => d.front!(c)) : null;
  }
  draw(c: Ctx, t: number): void {
    if (this.back) put(c, this.back);
    this.d.behind?.(c, t);
    if (this.front) put(c, this.front);
    this.d.over?.(c, t);
  }
}

/** A stage module from a StageDef: built (and its static layers painted) the first time it is shown. */
export const inkedStage = (d: StageDef): StageModule => ({ id: d.id, create: () => new DraftStage(d) });

export function poly(c: Ctx, pts: number[][], fill: string): void {
  c.fillStyle = fill; c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath(); c.fill();
}
/** A ridge line made of straight-sided peaks, roughened a little so it reads as rock. */
export function terrain(peaks: number[][], k: number, rough: number, seed: number): (x: number) => number {
  const out: number[] = [];
  for (let x = XL - 1; x <= XR + 1; x++) {
    let t = Infinity;
    for (const [px, py] of peaks) t = Math.min(t, py + Math.abs(x - px) * k);
    out[x - XL + 1] = t + (vnoise(x * 2 + 400, 0, 9, seed) - 0.5) * rough;
  }
  return x => out[clamp(Math.round(x) - XL + 1, 0, BW + 2)];
}

export const IVY = ['#2e5a22', '#4a8030', '#78b040'], IVY_INK = '#14280e';
