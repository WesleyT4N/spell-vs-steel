// Hit feel: a directional screen kick on solid hits, and a one-pixel shudder while the fight stands still in a hit pause.
// Render-only. The hit pause itself is part of the battle (Battle.hitStop), so online play (rollback included) stays in sync.
import type { Battle } from './battle';

/** Screen kick in pixels, by hit tier (light, solid, big, KO). */
const KICK = [0, 3, 4.5, 6];

interface Feel { seen: Map<string, number>; kick: number; kickT: number; kickDir: number }
const feels = new WeakMap<Battle, Feel>();
const feelOf = (b: Battle): Feel => {
  let f = feels.get(b);
  if (!f) { f = { seen: new Map(), kick: 0, kickT: -9, kickDir: 1 }; feels.set(b, f); }
  return f;
};

/** The screen offset for this frame: a damped kick in the direction the last hit travelled, and the hit-pause shudder. */
export function kickOffset(b: Battle, shudder: boolean): { x: number; y: number } {
  const f = feels.get(b);
  if (!f) return { x: 0, y: 0 };
  // during a hit pause the struck frame shakes a pixel side to side
  if (shudder && b.hitStop > 0) return { x: (Math.floor(b.stopT * 60) % 2 ? 1 : -1) * f.kickDir, y: 0 };
  if (f.kick <= 0) return { x: 0, y: 0 };
  const t = b.time - f.kickT;
  if (t < 0 || t > 0.24) return { x: 0, y: 0 };
  const a = f.kick * (1 - t / 0.24);
  // push, rebound, settle: a sign flip every ~2 frames
  const w = Math.floor(t * 30) % 2 ? -0.5 : 1;
  return { x: Math.round(a * w * f.kickDir), y: Math.round(a * 0.5 * (Math.floor(t * 30) % 2 ? 1 : -1)) };
}

/** Look for new impacts (call once per frame, after the battle is drawn). A solid one starts a kick. */
export function noteImpacts(b: Battle): void {
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
  if (best < 0) return;
  // a light hit doesn't kick, but it still sets the shudder's direction
  if (best === 0) { if (b.time - f.kickT > 0.24) f.kickDir = dir; return; }
  if (KICK[best] >= f.kick || b.time - f.kickT > 0.12) { f.kick = KICK[best]; f.kickT = b.time; f.kickDir = dir; }
}
