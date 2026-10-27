// Hit feel: a directional screen kick and a short hit-stop freeze on solid hits.
// Render-only. The battle keeps running underneath a freeze (the screen just holds the impact frame), so nothing here
// touches the rules and online play (rollback included) stays in sync.
import type { Ctx } from '../engine/gfx';
import type { Battle } from './battle';

/** Seconds the picture holds on an impact, by hit tier (light, solid, big, KO). */
const STOP = [0, 0.06, 0.1, 0.22];
/** Screen kick in pixels, by hit tier. */
const KICK = [0, 2, 3, 4];
/** After a freeze, hits this soon after don't freeze again (a flurry would stutter). */
const STOP_GAP = 0.12;

interface Feel { seen: Map<string, number>; stopFrom: number; stopUntil: number; snap: HTMLCanvasElement | null; kick: number; kickT: number; kickDir: number }
const feels = new WeakMap<Battle, Feel>();
const feelOf = (b: Battle): Feel => {
  let f = feels.get(b);
  if (!f) { f = { seen: new Map(), stopFrom: -9, stopUntil: -9, snap: null, kick: 0, kickT: -9, kickDir: 1 }; feels.set(b, f); }
  return f;
};

/** Is the picture held on an impact right now? While it is, draw `holdFrame` instead of the battle. */
export function frozen(b: Battle): boolean {
  const f = feels.get(b);
  return !!f && !!f.snap && b.time >= f.stopFrom && b.time < f.stopUntil && b.phase !== 'custom';
}

/** Draw the held impact frame, shuddering a pixel side to side like a struck sprite. */
export function holdFrame(c: Ctx, b: Battle): void {
  const f = feelOf(b);
  const n = Math.floor((b.time - f.stopFrom) * 60);
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.drawImage(f.snap!, n % 2 ? f.kickDir : -f.kickDir, 0);
  c.restore();
}

/** The screen offset for this frame: a damped kick in the direction the last hit travelled. */
export function kickOffset(b: Battle): { x: number; y: number } {
  const f = feels.get(b);
  if (!f || f.kick <= 0) return { x: 0, y: 0 };
  const t = b.time - f.kickT;
  if (t < 0 || t > 0.24) return { x: 0, y: 0 };
  const a = f.kick * (1 - t / 0.24);
  // push, rebound, settle: a sign flip every ~2 frames
  const w = Math.floor(t * 30) % 2 ? -0.5 : 1;
  return { x: Math.round(a * w * f.kickDir), y: Math.round(a * 0.5 * (Math.floor(t * 30) % 2 ? 1 : -1)) };
}

/**
 * Look for new impacts (call once per frame, after the battle is drawn). A solid one starts a kick, and with `stop`
 * also freezes the picture on the frame just drawn.
 */
export function noteImpacts(c: Ctx, b: Battle, stop: boolean): void {
  const f = feelOf(b);
  let best = -1, dir = 1;
  for (const e of b.fx) {
    if (e.kind !== 'impact') continue;
    // keyed by when and where the hit landed, not by object: a rollback resimulates the same hit as a new fx
    const at = b.time - e.t, key = `${at.toFixed(3)}|${e.side}|${e.col}|${e.row}`;
    if (f.seen.has(key)) continue;
    f.seen.set(key, at);
    const tier = Number(e.data?.tier ?? 0);
    if (tier > best) { best = tier; dir = e.side === 0 ? 1 : -1; }
  }
  for (const [key, at] of f.seen) if (b.time - at > 1 || at - b.time > 1) f.seen.delete(key);
  if (best <= 0) return;
  if (KICK[best] >= f.kick || b.time - f.kickT > 0.12) { f.kick = KICK[best]; f.kickT = b.time; f.kickDir = dir; }
  if (!stop || b.time < f.stopUntil + STOP_GAP && best < 3) return;
  const cv = c.canvas as HTMLCanvasElement;
  if (typeof document === 'undefined' || !cv.width) return;
  const snap = (f.snap ??= document.createElement('canvas'));
  if (snap.width !== cv.width || snap.height !== cv.height) { snap.width = cv.width; snap.height = cv.height; }
  const sc = snap.getContext('2d')!;
  sc.imageSmoothingEnabled = false;
  sc.clearRect(0, 0, snap.width, snap.height);
  sc.drawImage(cv, 0, 0);
  f.stopFrom = b.time;
  f.stopUntil = b.time + STOP[best];
}
