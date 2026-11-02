// Arcane Missiles drawn like Magic Missile: each dart of the volley leaves the Mage on its own curve (one loops high,
// one dips low, one climbs steep and dives), then bends in and homes onto the target. Render only: a dart's place is a
// pure function of its shot's homing progress and lane, so the hit still lands at the same moment it always did, and
// a rollback resim draws the same picture.
import type { Projectile } from '../../game/battle';
import { shotPfxFor } from '../../game/pfx';
import { drawSheetPart, sheetFrame, type Sheet } from '../sheet';

type Pt = { x: number; y: number };

/**
 * Each lane's two bezier handles in world px: `a` off the caster (x forward), `b` off the target (x back toward the
 * caster). Lanes fan the volley out so three darts read as three, then all converge on the target.
 */
const LANES: Array<{ a: [number, number]; b: [number, number] }> = [
  { a: [2, -34], b: [-36, -18] },  // up and over
  { a: [10, 24], b: [-30, 14] },   // dips low, swoops in from under
  { a: [12, -16], b: [-10, -40] }, // climbs steep, then dives from high
];

/** Where a dart is at progress `q` (0 at the caster, 1 on the target). */
export function dartAt(s: Pt, e: Pt, lane: number, q: number): Pt {
  const d = e.x >= s.x ? 1 : -1, L = LANES[((lane % LANES.length) + LANES.length) % LANES.length];
  const p1 = { x: s.x + L.a[0] * d, y: s.y + L.a[1] }, p2 = { x: e.x + L.b[0] * d, y: e.y + L.b[1] };
  const u = Math.max(0, Math.min(1, q)), v = 1 - u;
  const a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, w = u * u * u;
  return { x: a * s.x + b * p1.x + c * p2.x + w * e.x, y: a * s.y + b * p1.y + c * p2.y + w * e.y };
}

/** The trail's colors, newest to oldest (the arcane ramp, white-hot to deep magenta). */
const TRAIL = ['#fcfcfc', '#f8b8f8', '#f878f8', '#d800cc', '#940084'];
/** How much of its flight a dart's trail spans, and the step between trail dots. */
const SPAN = 0.32, STEP = 0.01;

/** Draw Arcane Missiles shot `p` flying from `s` to `e` (world px, shot-center height). */
export function drawDart(c: CanvasRenderingContext2D, p: Projectile, s: Pt, e: Pt): void {
  const h = p.homing!, lane = h.lane ?? 0, q = h.p;
  const head = dartAt(s, e, lane, q);
  const pts: Array<Pt & { k: number }> = [];
  for (let t = Math.max(0, q - SPAN); t < q; t += STEP) pts.push({ ...dartAt(s, e, lane, t), k: (q - t) / SPAN });
  // ink under the thick part so the trail reads on the light panels, then the trail itself, oldest first
  const size = (k: number): number => (k < 0.2 ? 3 : k < 0.55 ? 2 : 1);
  c.fillStyle = '#000000';
  for (const d of pts) if (size(d.k) > 1) { const z = size(d.k) + 2; c.fillRect(Math.round(d.x) - (z >> 1), Math.round(d.y) - (z >> 1), z, z); }
  for (const d of pts) {
    const z = size(d.k);
    c.fillStyle = TRAIL[Math.min(TRAIL.length - 1, Math.floor(d.k * TRAIL.length) + 1)];
    c.fillRect(Math.round(d.x) - (z >> 1), Math.round(d.y) - (z >> 1), z, z);
  }
  // a few motes shed off the trail, twinkling with the flight
  const age = q * h.dur, tick = Math.floor(age * 30);
  for (let i = 0; i < pts.length; i += 5) {
    if ((i + tick + lane) % 3) continue;
    const d = pts[i], j = ((i * 7 + lane * 3 + tick) % 5) - 2;
    c.fillStyle = (i + tick) % 2 ? '#fcfcfc' : '#f8b8f8';
    c.fillRect(Math.round(d.x) + j, Math.round(d.y) - j, 1, 1);
  }
  // the head: the HD missile's orb, without its baked-in straight tail, facing the way the dart is moving
  const ahead = dartAt(s, e, lane, Math.min(1, q + 0.02)), dx = ahead.x - head.x || (e.x - s.x);
  const sheet = (shotPfxFor('missile') as { sheet?: Sheet } | undefined)?.sheet;
  if (sheet) drawSheetPart(c, sheet, sheetFrame({ ...sheet, loop: true }, age), head.x, head.y, dx < 0, sheet.ax - 8, sheet.fw);
  else { c.fillStyle = '#fcfcfc'; c.fillRect(Math.round(head.x) - 1, Math.round(head.y) - 1, 3, 3); }
}
