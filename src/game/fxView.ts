// Spell and attack effects: pixel art with a light particle layer. Every effect keeps to a 24x24 footprint
// (the fighter sprite size): impacts stand on their panel, shots and beams carry their box down the row.
import { P, blob, glow, type Ctx } from '../engine/gfx';
import { panelFoot, PW, X0 } from '../art/arena';
import { drawFighterSprite, type Sprite } from '../art/sprites';
import { drawTextCentered } from '../engine/font';
import type { Battle, Fighter, Fx, Projectile } from './battle';

export const FIRE = ['#f83800', '#fca044', '#f8b800', '#fce0a8'];
export const ICE = ['#0058f8', '#3cbcfc', '#a4e4fc', '#fcfcfc'];
export const ARC = ['#940084', '#d800cc', '#f878f8', '#fcfcfc'];
export const HOLY = ['#ac7c00', '#f8b800', '#f8d878', '#fcfcfc'];
export const TOX = ['#005800', '#58d854', '#b8f818', '#fcfcfc'];
export const SHADOW = ['#4428bc', '#6844fc', '#9878f8', '#fcfcfc'];
export const STEEL = ['#3c3c3c', '#7c7c7c', '#bcbcbc', '#fcfcfc'];
/** Hot to cold: white core, yellow, orange, red, ember. */
const HEAT = ['#fcfcfc', '#fce0a8', '#f8d878', '#f8b800', '#fca044', '#f87800', '#f83800', '#a81000', '#581000'];
const SMOKE = ['#7c7c7c', '#5c5c5c', '#3c3c3c'];
const SNOW = ['#fcfcfc', '#a4e4fc', '#3cbcfc'];
const ICED = '#002c8c';

// ---------- particles ----------
interface Box { x0: number; x1: number; y0: number; y1: number }
interface Part { x: number; y: number; vx: number; vy: number; g: number; drag: number; age: number; life: number; ramp: string[]; size: number; shrink: number; dither: boolean; box?: Box }
// each Battle keeps its own particles, so a card preview drawn beside a fight doesn't disturb it
interface Layer { parts: Part[]; lastTime: number }
const layers = new WeakMap<Battle, Layer>();
let cur: Layer = { parts: [], lastTime: -1 };
/** Point the particle layer at `b`'s particles. Called before drawing a battle's effects. */
export function useParticles(b: Battle): void {
  let l = layers.get(b);
  if (!l) { l = { parts: [], lastTime: -1 }; layers.set(b, l); }
  cur = l;
}
const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
/** A 24x24 box around a point, or standing on a panel foot. */
const boxC = (x: number, y: number): Box => ({ x0: x - 12, x1: x + 12, y0: y - 12, y1: y + 12 });
const boxF = (x: number, y: number): Box => ({ x0: x - 12, x1: x + 12, y0: y - 24, y1: y + 1 });

function part(x: number, y: number, o: Partial<Part>): Part {
  const p: Part = { x, y, vx: 0, vy: 0, g: 0, drag: 1, age: 0, life: 0.5, ramp: SNOW, size: 1, shrink: 0.6, dither: false, ...o };
  cur.parts.push(p);
  return p;
}
const emit = (n: number, f: (i: number) => void): void => { for (let i = 0; i < n; i++) f(i); };
const ember = (x: number, y: number, box: Box, o: Partial<Part> = {}): Part => part(x, y, { vx: rnd(-12, 12), vy: rnd(-30, -8), g: 18, life: rnd(0.35, 0.8), ramp: HEAT.slice(1), box, ...o });
const smoke = (x: number, y: number, box: Box, o: Partial<Part> = {}): Part => part(x, y, { vx: rnd(-5, 5), vy: rnd(-14, -6), life: rnd(0.6, 1.1), ramp: SMOKE, size: rnd(2, 4), shrink: -0.3, dither: true, box, ...o });
const spark = (x: number, y: number, ramp: string[], box: Box, speed = 50, o: Partial<Part> = {}): Part => {
  const a = Math.random() * Math.PI * 2, s = rnd(0.4, 1) * speed;
  return part(x, y, { vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.3, g: 120, life: rnd(0.2, 0.45), ramp, size: rnd(1, 2), box, ...o });
};
const mote = (x: number, y: number, ramp: string[], box: Box, o: Partial<Part> = {}): Part => part(x, y, { vx: rnd(-4, 4), vy: rnd(-22, -10), drag: 0.98, life: rnd(0.4, 0.8), ramp, box, ...o });

/** Advance and draw the particle layer. Called once per frame after the effects. */
export function drawParticles(c: Ctx, b: Battle): void {
  useParticles(b);
  let dt = cur.lastTime < 0 ? 0 : b.time - cur.lastTime;
  if (dt < 0 || dt > 0.25) { dt = 0; if (b.time - cur.lastTime < 0) cur.parts = []; }
  dt = Math.min(dt, 0.05);
  cur.lastTime = b.time;
  for (const p of cur.parts) {
    p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt;
    if (p.drag !== 1) { p.vx *= p.drag; p.vy *= p.drag; }
  }
  cur.parts = cur.parts.filter(p => p.age < p.life && (!p.box || (p.x >= p.box.x0 && p.x < p.box.x1 && p.y >= p.box.y0 && p.y < p.box.y1)));
  for (const p of cur.parts) {
    const k = p.age / p.life, col = p.ramp[Math.min(p.ramp.length - 1, Math.floor(k * p.ramp.length))];
    const s = Math.max(1, Math.round(p.size * (1 - k * p.shrink)));
    if (p.dither && ((Math.round(p.x) + Math.round(p.y)) & 1)) continue;
    P(c, col, p.x - (s >> 1), p.y - (s >> 1), s, s);
  }
}

// one-shot spawns per effect (an effect is drawn every frame; its particles spawn once)
const fired = new WeakMap<object, Set<string>>();
function once(e: object, key: string, cond = true): boolean {
  if (!cond) return false;
  let s = fired.get(e);
  if (!s) { s = new Set(); fired.set(e, s); }
  if (s.has(key)) return false;
  s.add(key);
  return true;
}

// ---------- drawing helpers ----------
/** Dithered disc: checkerboard pixels only, for glows and soft edges. */
function dblob(c: Ctx, col: string, cx: number, cy: number, r: number, phase = 0): void {
  cx = Math.round(cx); cy = Math.round(cy); c.fillStyle = col;
  for (let y = -r; y <= r; y++) {
    const w = Math.round(Math.sqrt(Math.max(0, r * r - y * y)));
    for (let x = -w; x <= w; x++) if (((x + y + phase) & 1) === 0) c.fillRect(cx + x, cy + y, 1, 1);
  }
}
function ring(c: Ctx, col: string, cx: number, cy: number, rx: number, ry: number, skip = 0): void {
  const n = Math.max(12, Math.round((rx + ry) * 2.2));
  for (let i = 0; i < n; i++) { if (skip && i % skip === 0) continue; const a = (i / n) * Math.PI * 2; P(c, col, cx + Math.cos(a) * rx, cy + Math.sin(a) * ry); }
}
/** An ice crystal standing on the floor, lit from the left. */
function crystal(c: Ctx, x: number, base: number, h: number, hw: number, glint = -1): void {
  x = Math.round(x); base = Math.round(base);
  for (let r = 0; r < h; r++) {
    const half = Math.max(0, Math.round(hw * Math.min(1, ((r + 1) / h) * 2.2))), y = base - h + r;
    P(c, '#000000', x - half - 1, y, half * 2 + 3, 1);
    if (!half) { P(c, '#fcfcfc', x, y, 1, 1); continue; }
    P(c, ICED, x - half, y, half * 2 + 1, 1); P(c, ICE[0], x, y, half + 1, 1); P(c, ICE[1], x - half + 1, y, half, 1); P(c, ICE[2], x - half + 1, y, Math.max(1, half >> 1), 1);
    if (glint >= 0 && Math.abs(r - glint) < 1) P(c, '#fcfcfc', x - half + 1, y, half * 2, 1);
  }
  if (h > 2) P(c, '#fcfcfc', x - 1, base - h + 2, 1, Math.max(1, h >> 2));
}
/** A fire explosion standing on a panel: shock ring, layered fireball, then embers and smoke. */
function explosion(c: Ctx, e: Fx, x: number, y: number, p: number, scale = 1): void {
  const box = boxF(x, y);
  if (once(e, 'boom')) {
    emit(Math.round(14 * scale), () => ember(x, y - 12, box, { vx: rnd(-45, 45), vy: rnd(-55, -10), g: 160, life: rnd(0.4, 0.9), size: rnd(1, 2) }));
    emit(Math.round(6 * scale), () => smoke(x + rnd(-7, 7), y - 12 - rnd(0, 6), box, { vy: rnd(-10, -4), life: rnd(0.8, 1.4), size: rnd(2, 4) }));
  }
  ring(c, p < 0.5 ? '#fce0a8' : '#f87800', x, y - 2, Math.min(11, 5 + p * 7 * scale), Math.min(2, 1 + p * 2));
  if (p < 0.75) {
    const r = Math.min(10, Math.round((3 + p * 6) * scale)), cy = y - 12;
    dblob(c, '#a81000', x, cy, Math.min(11, r + 2), Math.floor(p * 20));
    blob(c, FIRE[0], x, cy, r); blob(c, '#f87800', x, cy - 1, Math.round(r * 0.75));
    blob(c, FIRE[2], x, cy - 1, Math.round(r * 0.5)); blob(c, p < 0.3 ? '#fcfcfc' : FIRE[3], x, cy - 2, Math.round(r * 0.25));
  }
  if (p < 0.2) glow(c, x, y - 12, 12, '252,160,68', 0.6 * (1 - p / 0.2));
}
/** Dust kicked off a panel by an impact. */
function dust(e: Fx, x: number, y: number, n = 8, key = 'dust'): void {
  if (!once(e, key)) return;
  const box = boxF(x, y);
  emit(n, () => part(x + rnd(-4, 4), y - 2, { vx: rnd(-40, 40), vy: rnd(-25, -5), g: 60, drag: 0.94, life: rnd(0.35, 0.6), ramp: ['#fce0a8', '#bcbcbc', '#7c7c7c'], size: rnd(1, 3), shrink: -0.2, dither: true, box }));
}
function rocks(e: Fx, x: number, y: number, n = 6, key = 'rocks'): void {
  if (!once(e, key)) return;
  const box = boxF(x, y);
  emit(n, () => part(x + rnd(-6, 6), y - 3, { vx: rnd(-35, 35), vy: rnd(-70, -35), g: 260, life: rnd(0.35, 0.6), ramp: ['#bcbcbc', '#7c7c7c', '#3c3c3c'], size: rnd(1, 2.5), shrink: 0, box }));
}
function crack(c: Ctx, x: number, y: number): void {
  P(c, '#000000', x - 7, y - 1, 5, 1); P(c, '#000000', x - 3, y, 6, 1); P(c, '#000000', x + 3, y - 1, 5, 1);
  P(c, '#000000', x - 1, y - 3, 1, 3); P(c, '#000000', x + 5, y + 1, 2, 1);
}
/** Frost: crystals and a snow burst around a point on the floor. */
function snowBurst(e: Fx, x: number, y: number, n = 12, key = 'snow'): void {
  if (!once(e, key)) return;
  const box = boxF(x, y);
  emit(n, () => part(x + rnd(-8, 8), y - rnd(0, 18), { vx: rnd(-30, 30), vy: rnd(-30, 10), drag: 0.95, life: rnd(0.4, 0.8), ramp: SNOW, box }));
}
function shatterShards(x: number, y: number): void {
  const box = boxF(x, y);
  emit(16, () => part(x + rnd(-9, 9), y - rnd(2, 21), { vx: rnd(-50, 50), vy: rnd(-60, 0), g: 200, life: rnd(0.3, 0.6), ramp: ['#fcfcfc', '#a4e4fc', '#3cbcfc', '#0058f8'], size: rnd(1, 2.5), box }));
  emit(5, () => part(x + rnd(-8, 8), y - rnd(2, 18), { vx: rnd(-6, 6), vy: rnd(-5, -1), life: rnd(0.6, 1), ramp: ['#a4e4fc', '#3cbcfc', '#0058f8'], size: rnd(2, 3), shrink: -0.2, dither: true, box }));
}
/** Holy light: a column of light standing on a panel, 24 tall. */
function lightColumn(c: Ctx, x: number, y: number, p: number, w0 = 10): void {
  const w = Math.max(2, Math.round(w0 * (1 - p * 0.6))), h = Math.round(24 * Math.min(1, p * 5));
  for (let yy = 0; yy < h; yy += 2) P(c, HOLY[1 + ((yy >> 2) + Math.floor(p * 12)) % 3], x - w / 2, y - yy - 2, w, 2);
  P(c, HOLY[3], x - 1, y - h, 2, h - 2);
  if (p < 0.25) blob(c, '#fcfcfc', x, y - 4, 3);
  glow(c, x, y - 8, 11, '248,216,120', 0.6 * (1 - p));
}
/** A rising green cross. */
function cross(c: Ctx, x: number, y: number, col: string, s = 1): void {
  P(c, '#000000', x - 1 - s, y - 1, 3 + 2 * s, 3); P(c, '#000000', x - 1, y - 1 - s, 3, 3 + 2 * s);
  P(c, col, x - s, y, 1 + 2 * s, 1); P(c, col, x, y - s, 1, 1 + 2 * s);
}

// ---------- effects ----------
const ELEMENT_RAMP: Record<string, string[]> = { steel: STEEL, fire: FIRE, frost: ICE, arcane: ARC, shadow: SHADOW, poison: TOX, nature: ['#005800', '#58d854', '#b8f818', '#fcfcfc'], holy: HOLY };
const DART: Record<string, string[]> = { knife: STEEL, knifeHeavy: STEEL, arrow: ['#503000', '#ac7c00', '#bcbcbc', '#fcfcfc'], aimed: STEEL, holySpark: HOLY };
const cellPx = (col: number, row: number): { x: number; y: number } => panelFoot(col, row);

export function drawFx(c: Ctx, b: Battle, e: Fx): void {
  const p = Math.min(1, e.t / e.dur);
  const { x, y } = cellPx(e.col, e.row);
  const d = e.side === 0 ? 1 : -1;
  const ph = Math.floor(b.time * 24);
  switch (e.kind) {
    case 'cleave': {
      // a crescent swipe across the panel ahead: bright leading edge, steel smear, sparks off the tip
      const cx = x + d * 2, cy = y - 11, r = 11, sweep = Math.min(1, p * 1.8);
      for (let i = 0; i < 22; i++) {
        const k = i / 21; if (k > sweep) break;
        const ang = -1.35 + k * 2.5, age = sweep - k;
        const px = cx + d * Math.cos(ang) * r, py = cy + Math.sin(ang) * r * 0.9;
        if (age > 0.6 * (1 - p) + 0.15) continue;
        P(c, age < 0.12 ? '#fcfcfc' : age < 0.3 ? '#bcbcbc' : '#7c7c7c', px - 1, py - 1, age < 0.12 ? 3 : 2, 2);
        if (age < 0.3) P(c, '#7c7c7c', px - d * 2, py, 1, 1);
      }
      if (once(e, 'sp', p > 0.45)) emit(5, () => spark(cx + d * r, cy, STEEL.slice(1).reverse(), boxC(cx + d * r * 0.5, cy), 45));
      break;
    }
    case 'cleaveHeavy': {
      // a big overhead chop: gold arc over the panel, flash, dust, cracks where it lands
      const cx = x + d * (PW * 0.5), cy = y - 12, r = 11, swing = Math.min(1, p * 2.2);
      if (p < 0.6) for (let i = 0; i < 26; i++) {
        const k = i / 25; if (k > swing) break;
        const ang = -2.2 + k * 2.9, age = swing - k;
        const px = cx + d * Math.cos(ang) * r, py = cy + Math.sin(ang) * r;
        if (age < 0.45) P(c, age < 0.1 ? '#fcfcfc' : age < 0.3 ? '#f8b800' : '#fca044', px - 1, py - 1, age < 0.1 ? 4 : 3, 3);
      }
      if (p >= 0.4) {
        const q = (p - 0.4) / 0.6;
        for (const col of [e.col, e.col + d]) {
          const pc = cellPx(col, e.row);
          if (q < 0.35) glow(c, pc.x, pc.y - 4, 12, '248,184,0', 0.6 * (1 - q / 0.35));
          dust(e, pc.x, pc.y, 8, 'd' + col); rocks(e, pc.x, pc.y, 4, 'r' + col);
          crack(c, pc.x, pc.y);
        }
      }
      break;
    }
    case 'dagger': {
      // the blade shoots out over the panels ahead and snaps back, with a glint at the tip
      const reach = Number(e.data?.reach ?? 2);
      const len = reach * PW * (p < 0.5 ? p * 2 : 1 - (p - 0.5) * 1.2);
      const x0 = x + d * 6, by = y - 10, tip = x0 + d * len;
      P(c, '#000000', Math.min(x0, tip), by - 2, Math.abs(tip - x0), 3);
      P(c, '#7c7c7c', Math.min(x0, tip), by - 1, Math.abs(tip - x0), 1);
      P(c, '#bcbcbc', Math.min(x0, tip) + 2, by - 1, Math.max(0, Math.abs(tip - x0) - 4), 1);
      P(c, '#000000', tip - (d > 0 ? 4 : -1), by - 3, 4, 5); P(c, '#fcfcfc', tip - (d > 0 ? 3 : 0), by - 2, 3, 3);
      if (p > 0.35 && p < 0.65) { glow(c, tip, by, 6, '252,252,252', 0.6); P(c, '#fcfcfc', tip - 3, by - 1, 7, 1); P(c, '#fcfcfc', tip, by - 4, 1, 7); }
      if (once(e, 'sp', p > 0.45)) emit(4, () => spark(tip, by, STEEL.slice(1).reverse(), boxC(tip, by), 40));
      break;
    }
    case 'bolt': case 'boltHeavy': case 'knife': case 'knifeHeavy': case 'arrow': case 'aimed': case 'holySpark': {
      const heavy = e.kind === 'boltHeavy';
      const to = Number(e.data?.to ?? e.col);
      const x0 = x + d * 8, x1 = cellPx(to, e.row).x, by = y - 10;
      const ramp = heavy ? ARC : DART[e.kind] ?? ICE;
      if (e.kind === 'aimed') {
        // a heavy arrow: a long streak, a crack of air at the bow and a shock ring where it lands
        const q = Math.min(1, p * 2.5), head = x0 + (x1 - x0) * q;
        P(c, '#000000', Math.min(x0, head), by - 2, Math.abs(head - x0), 4);
        P(c, ramp[2], Math.min(x0, head), by - 1, Math.abs(head - x0), 2);
        P(c, ramp[3], Math.min(x0, head), by - 1, Math.abs(head - x0), 1);
        if (p < 0.2) { ring(c, '#fcfcfc', x0, by, 3 + p * 15, 2 + p * 8); }
        if (q >= 1) {
          ring(c, ramp[3], x1, by, Math.min(11, 3 + p * 9), Math.min(8, 2 + p * 6));
          if (once(e, 'hit')) emit(8, () => spark(x1, by, STEEL.slice(1).reverse(), boxC(x1, by), 60));
        }
        break;
      }
      if (e.kind === 'knifeHeavy' || e.kind === 'knife') {
        // a spinning knife flying down the row
        const q = Math.min(1, p * 1.6), kx = x0 + (x1 - x0) * q, spin = Math.floor(b.time * 30) % 4;
        if (q < 1) {
          const dx = [3, 2, 0, -2][spin], dy = [0, -2, -3, -2][spin];
          P(c, '#000000', kx - Math.abs(dx) - 1, by - 3, Math.abs(dx) * 2 + 3, 6);
          P(c, '#bcbcbc', kx - dx, by - dy, 1, 1); P(c, '#fcfcfc', kx + dx, by + dy, 1, 1); P(c, '#503000', kx - dx, by - dy, 2, 2); P(c, '#fcfcfc', kx, by, 1, 1);
          for (let i = 1; i < 4; i++) P(c, '#7c7c7c', kx - d * i * 3, by + (i & 1), 2, 1);
        } else if (once(e, 'hit')) emit(6, () => spark(x1, by, STEEL.slice(1).reverse(), boxC(x1, by), 50));
        break;
      }
      // cast flash at the hand
      if (p < 0.4) { glow(c, x0, by, heavy ? 11 : 7, heavy ? '248,120,248' : e.kind === 'holySpark' ? '248,216,120' : '60,188,252', 0.7 * (1 - p / 0.4)); blob(c, ramp[3], x0, by, heavy ? 3 : 2); }
      if (!heavy) {
        // a dart racing down the row with a sparkling tail, popping where it lands
        const head = x0 + (x1 - x0) * Math.min(1, p * 2.2), tail = x0 + (x1 - x0) * Math.max(0, p * 2.2 - 0.5);
        const xa = Math.min(head, tail), xb = Math.max(head, tail);
        if (p * 2.2 < 1.5) {
          P(c, '#000000', xa, by - 2, xb - xa, 5);
          P(c, ramp[1], xa, by - 1, xb - xa, 3); P(c, ramp[3], xa, by, xb - xa, 1);
          for (let i = 0; i < 4; i++) P(c, ramp[2], tail + (head - tail) * (i / 4), by + ((i * 7 + ph) % 5) - 2, 1, 1);
          blob(c, '#000000', head, by, 3); blob(c, ramp[2], head, by, 2); P(c, ramp[3], head - 1, by - 1, 2, 2);
        }
        if (once(e, 'hit', p * 2.2 >= 1)) emit(8, () => spark(x1, by, [ramp[3], ramp[2], ramp[1]], boxC(x1, by), 55, { g: 30 }));
        if (p * 2.2 >= 1 && p < 0.75) ring(c, ramp[2], x1, by, 2 + (p - 0.45) * 18, 1 + (p - 0.45) * 12, 2);
      } else {
        // a thick, wobbling arcane beam with sparkles crawling along it and a burst where it lands
        const w = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3, xa = Math.min(x0, x1), xb = Math.max(x0, x1);
        for (let xx = xa; xx < xb; xx += 2) {
          const wob = Math.round(Math.sin(xx * 0.5 + p * 30) * 1.5), hh = Math.max(1, Math.round(4 * w));
          P(c, '#000000', xx, by - hh - 1 + wob, 2, hh * 2 + 3);
          P(c, ramp[1], xx, by - hh + wob, 2, hh * 2 + 1);
          P(c, ramp[2], xx, by - Math.ceil(hh / 2) + wob, 2, Math.ceil(hh / 2) * 2 + 1);
        }
        P(c, ramp[3], xa, by, xb - xa, 1);
        for (let i = 0; i < 6; i++) P(c, '#fcfcfc', xa + ((i * 37 + ph * 5) % Math.max(1, xb - xa)), by - 3 + ((i * 5 + ph) % 7), 1, 1);
        glow(c, x1, by, 11, '248,120,248', 0.5 * w);
        ring(c, ramp[3], x1, by, Math.min(11, 3 + p * 9), Math.min(10, 3 + p * 8), 2);
        if (once(e, 'hit')) emit(10, () => spark(x1, by, [ARC[3], ARC[2], ARC[1]], boxC(x1, by), 60, { g: 20 }));
      }
      break;
    }
    case 'thrust': {
      // a long lunge: the spear streaks out with speed lines and a glint at the point
      const len = Number(e.data?.len ?? 3) * PW * Math.min(1, p * 3), x0 = x + d * 6, tip = x0 + d * len;
      P(c, '#000000', Math.min(x0, tip), y - 12, len, 5);
      P(c, '#7c7c7c', Math.min(x0, tip), y - 11, len, 3); P(c, '#fcfcfc', Math.min(x0, tip), y - 10, len, 1);
      for (let i = 0; i < 3; i++) P(c, '#bcbcbc', tip - d * (8 + i * 10 + (ph % 4)), y - 15 + i * 6, 6, 1);
      if (p > 0.3 && p < 0.7) { P(c, '#fcfcfc', tip - 3, y - 10, 7, 1); P(c, '#fcfcfc', tip, y - 13, 1, 7); }
      if (once(e, 'sp', p > 0.33)) emit(5, () => spark(tip, y - 10, STEEL.slice(1).reverse(), boxC(tip, y - 10), 45));
      break;
    }
    case 'smash': case 'quake': case 'shockwave': case 'wide': {
      const rows = e.kind === 'shockwave' || e.kind === 'wide' ? [0, 1, 2] : [e.row];
      for (const r of rows) {
        const pc = cellPx(e.col, r);
        if (e.kind === 'wide') {
          // a sweeping blade across the whole column
          const sx = pc.x - d * 10 + d * p * 20;
          P(c, '#000000', sx - 2, pc.y - 18, 5, 17); P(c, '#bcbcbc', sx - 1, pc.y - 17, 3, 15); P(c, '#fcfcfc', sx, pc.y - 17, 1, 15);
          for (let i = 1; i < 4; i++) P(c, '#7c7c7c', sx - d * i * 3, pc.y - 16 + i, 1, 13 - i * 2);
          dust(e, pc.x, pc.y, 5, 'd' + r);
          continue;
        }
        const big = e.kind !== 'smash';
        if (p < 0.25) glow(c, pc.x, pc.y - 4, 11, e.kind === 'smash' ? '248,184,0' : '252,224,168', 0.6 * (1 - p / 0.25));
        ring(c, p < 0.4 ? '#fcfcfc' : e.kind === 'smash' ? '#f8b800' : '#bcbcbc', pc.x, pc.y - 2, Math.min(11, 3 + p * 10), Math.min(3, 1 + p * 3));
        if (p < 0.3) { P(c, '#fcfcfc', pc.x - 5, pc.y - 8, 11, 1); P(c, '#fcfcfc', pc.x, pc.y - 13, 1, 11); }
        dust(e, pc.x, pc.y, big ? 10 : 7, 'd' + r);
        if (big) rocks(e, pc.x, pc.y, 6, 'r' + r);
        crack(c, pc.x, pc.y);
      }
      break;
    }
    case 'explode': explosion(c, e, x, y, p, e.dur >= 0.45 ? 1.4 : 1); break;
    case 'pillar': {
      // the panel glows, then a pillar of flame as tall as a fighter erupts and leaves embers rising
      if (p < 0.15) { const k = p / 0.15; dblob(c, FIRE[0], x, y - 6, Math.round(2 + k * 4), ph); break; }
      const q = (p - 0.15) / 0.85, hgt = Math.round(24 * Math.min(1, q * 4)), wid = Math.round(7 * (1 - q * 0.5)), t = b.time;
      for (let yy = 0; yy < hgt; yy++) {
        const wob = Math.round(Math.sin(yy * 0.5 + t * 30) * 2), w = wid + ((yy * 7 + Math.floor(t * 40)) % 3), k = yy / Math.max(1, hgt);
        P(c, '#a81000', x - w - 1 + wob, y - yy, (w + 1) * 2, 1);
        P(c, HEAT[Math.min(8, 5 + Math.floor(k * 3))], x - w + wob, y - yy, w * 2, 1);
        P(c, HEAT[Math.min(8, 1 + Math.floor(k * 5))], x - (w >> 1) + wob, y - yy, w, 1);
      }
      if (q < 0.25) blob(c, '#fcfcfc', x, y - 4, 4);
      if (Math.random() < 0.7) ember(x + rnd(-wid, wid), y - rnd(0, hgt), boxF(x, y), { vx: rnd(-30, 30), vy: rnd(-60, -20), g: 30 });
      break;
    }
    case 'meteorFall': {
      // a burning rock streaks in from above with a growing shadow on its target
      const k = Math.min(1, p), mx = x - d * 60 * (1 - k), my = y - 12 - 110 * (1 - k) ** 1.2, fl = ph % 2;
      const sr = Math.round(3 + k * 8);
      for (let i = -sr; i <= sr; i++) if ((i + fl) & 1) P(c, '#000000', x + i, y - 2, 1, 1);
      if (Math.random() < 0.9) ember(mx + rnd(-3, 3), my + rnd(-3, 3), boxC(mx, my), { vx: d * -rnd(10, 40), vy: rnd(-40, -10), g: 10, life: rnd(0.2, 0.4), ramp: HEAT.slice(2) });
      if (Math.random() < 0.5) smoke(mx - d * 5, my - 4, boxC(mx, my), { vx: d * -rnd(15, 30), vy: rnd(-20, -10), size: 3, life: 0.5 });
      dblob(c, '#f87800', mx, my, 11, fl); blob(c, '#000000', mx, my, 7);
      blob(c, '#581000', mx, my, 6); blob(c, '#a81000', mx + d, my + 1, 5); blob(c, FIRE[0], mx + d, my + 1, 4);
      blob(c, FIRE[2], mx + 2 * d, my + 2, 2); P(c, '#fcfcfc', mx + 3 * d, my + 3, 2, 1);
      P(c, '#3c3c3c', mx - d, my - 2, 2, 2); P(c, '#3c3c3c', mx - 3 * d, my + 1, 1, 2);
      break;
    }
    case 'shard': {
      // an icicle drops onto the panel (its frost shadow growing) and shatters into shards and mist
      const fall = Math.min(1, p * 2), ix = x + 6 * (1 - fall), iy = y - 2 - 22 * (1 - fall) ** 1.5;
      if (fall < 1) {
        const r = Math.round(2 + fall * 8);
        for (let k = -r; k <= r; k++) if ((k + ph) & 1) P(c, ICE[0], x + k, y - 3, 1, 1);
        P(c, '#000000', ix - 2, iy - 9, 5, 10); P(c, ICE[0], ix - 1, iy - 8, 3, 8); P(c, ICE[2], ix - 1, iy - 8, 1, 7); P(c, '#fcfcfc', ix, iy - 1, 1, 2);
        if (Math.random() < 0.6) part(ix + rnd(-1, 1), iy - 6, { vx: rnd(2, 8), vy: rnd(-8, 0), life: 0.25, ramp: SNOW, box: boxF(x, y) });
      } else {
        if (once(e, 'hit')) {
          const box = boxF(x, y);
          emit(12, () => part(x + rnd(-2, 2), y - 3, { vx: rnd(-45, 45), vy: rnd(-55, -10), g: 220, life: rnd(0.25, 0.5), ramp: SNOW, size: rnd(1, 2), box }));
          emit(4, () => part(x + rnd(-6, 6), y - 2, { vx: rnd(-6, 6), vy: rnd(-5, -1), life: rnd(0.6, 1), ramp: ['#a4e4fc', '#3cbcfc', '#0058f8'], size: rnd(2, 3), shrink: -0.2, dither: true, box }));
        }
        for (let k = 0; k < 7; k++) P(c, k & 1 ? ICE[2] : '#fcfcfc', x - 8 + ((k * 5) % 17), y - 4 + ((k * 3) % 4), 2, 1);
      }
      break;
    }
    case 'arcaneHit': {
      // a rune circle snaps around the target, then bursts outward in sparks
      const cy = y - 11, r = Math.min(11, 4 + p * 9);
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2 + p * 4; P(c, ARC[1 + (i % 3)], x + Math.cos(a) * r, cy + Math.sin(a) * r, i % 4 ? 1 : 2, i % 4 ? 1 : 2); }
      for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 - p * 6, rr = r * 0.6; P(c, ARC[3], x + Math.cos(a) * rr, cy + Math.sin(a) * rr, 1, 1); }
      blob(c, ARC[2], x, cy, Math.max(0, Math.round(5 * (1 - p)))); blob(c, ARC[3], x, cy, Math.max(0, Math.round(3 * (1 - p))));
      glow(c, x, cy, 11, '248,120,248', 0.55 * (1 - p));
      if (once(e, 'hit')) emit(12, () => spark(x, cy, [ARC[3], ARC[2], ARC[1]], boxF(x, y), 60, { g: 20 }));
      break;
    }
    case 'blink': {
      // the body unravels into a column of arcane motes
      if (once(e, 'm')) emit(14, () => mote(x + rnd(-8, 8), y - rnd(0, 20), [ARC[3], ARC[2], ARC[1]], boxF(x, y), { vy: rnd(-40, -15) }));
      if (p < 0.35) { const h = Math.round(24 * (1 - p / 0.35)); P(c, ARC[2], x - 1, y - h, 2, h); P(c, ARC[3], x, y - h, 1, h); glow(c, x, y - 10, 11, '248,120,248', 0.5); }
      break;
    }
    case 'nova': case 'novaZone': {
      // an icy burst: a frost ring with crystals spiking out of the floor and a puff of snow
      const r = Math.min(11, 4 + p * 8);
      ring(c, p < 0.5 ? '#fcfcfc' : ICE[1], x, y - 2, r, 1 + p * 2);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.3, rr = 3 + p * 7; crystal(c, x + Math.cos(a) * rr, y - 1 + Math.sin(a) * rr * 0.25, Math.round(6 * (1 - p)) + 1, 1); }
      if (p < 0.3) glow(c, x, y - 6, 11, '164,228,252', 0.5);
      snowBurst(e, x, y, 14);
      break;
    }
    case 'guard': case 'shieldHit': case 'spark': {
      // steel on steel: a white star flash and a spray of sparks
      const sx = e.kind === 'spark' ? x : x + d * 8, sy = y - 11;
      if (p < 0.35) { const s = Math.round(5 * (1 - p / 0.35)) + 1; P(c, '#fcfcfc', sx - s, sy, s * 2 + 1, 1); P(c, '#fcfcfc', sx, sy - s, 1, s * 2 + 1); P(c, '#f8d878', sx - 1, sy - 1, 3, 3); glow(c, sx, sy, 8, '252,252,252', 0.5); }
      if (once(e, 'sp')) emit(8, () => spark(sx, sy, ['#fcfcfc', '#f8d878', '#f8b800', '#ac7c00'], boxC(sx, sy), 70));
      break;
    }
    case 'shout': {
      // a battle cry: shock rings rolling off the fighter with wind streaks and dust
      for (let k = 0; k < 2; k++) {
        const q = Math.min(1, p + k * 0.25), r = 5 + q * 7;
        ring(c, k ? '#bcbcbc' : '#fcfcfc', x, y - 11, r, r * 0.9, 2);
      }
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.5, r0 = 6 + p * 5; P(c, '#fcfcfc', x + Math.cos(a) * r0, y - 11 + Math.sin(a) * r0 * 0.9, 2, 1); }
      dust(e, x, y, 8);
      break;
    }
    case 'transform': {
      // power surges up the fighter: a rising column of gold light, sparks, and a flash at the peak
      const col = '248,184,0', h = Math.round(24 * Math.min(1, p * 2));
      for (let i = 0; i < 5; i++) { const t = (p * 2 + i / 5) % 1; P(c, i % 2 ? HOLY[3] : HOLY[2], x - 10 + i * 5, y - Math.floor(t * 24), 1, 3); }
      P(c, HOLY[1], x - 11, y - 1, 23, 1);
      if (p < 0.6) { c.globalAlpha = 0.3; P(c, HOLY[2], x - 9, y - h, 19, h); c.globalAlpha = 1; }
      if (p > 0.45 && p < 0.7) glow(c, x, y - 12, 12, col, 0.7);
      if (once(e, 'fl', p > 0.5)) emit(14, () => spark(x, y - 12, [HOLY[3], HOLY[2], HOLY[1]], boxF(x, y), 60, { g: 30 }));
      break;
    }
    case 'counter': {
      // a spell torn apart: a purple X with splintering shards
      drawTextCentered(c, '×', x, y - 30 - p * 4, '#f878f8', 2);
      if (once(e, 'sh')) emit(10, () => spark(x, y - 24, [ARC[3], ARC[2], ARC[1]], boxC(x, y - 24), 60));
      break;
    }
    case 'banner': {
      for (let r = 0; r < 3; r++) {
        const pc = cellPx(e.col, r), wave = Math.floor(b.time * 6 + r) % 3;
        P(c, '#000000', pc.x - 1, pc.y - 19, 3, 18); P(c, '#503000', pc.x, pc.y - 18, 1, 16); P(c, '#f8b800', pc.x, pc.y - 19, 1, 1);
        const team = e.side === 0 ? '#d82800' : '#0058f8';
        for (let i = 0; i < 7; i++) { const off = Math.round(Math.sin((i + wave) * 1.1)); P(c, '#000000', pc.x + 1 + i, pc.y - 19 + off, 1, 7); P(c, team, pc.x + 1 + i, pc.y - 18 + off, 1, 5); }
        P(c, '#fcfcfc', pc.x + 3, pc.y - 16 + Math.round(Math.sin((2 + wave) * 1.1)), 2, 1);
      }
      break;
    }
    case 'holyPillar': {
      lightColumn(c, x, y, p);
      if (once(e, 'm')) emit(10, () => mote(x + rnd(-8, 8), y - rnd(0, 6), [HOLY[3], HOLY[2], HOLY[1]], boxF(x, y)));
      break;
    }
    case 'holyNova': {
      // a burst of light: a golden ring, rays and motes
      const r = Math.min(11, 4 + p * 9);
      ring(c, p < 0.4 ? '#fcfcfc' : HOLY[2], x, y - 10, r, r * 0.8);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + p, r0 = r * 0.5; P(c, HOLY[3], x + Math.cos(a) * r0, y - 10 + Math.sin(a) * r0 * 0.8, 1, 2); }
      glow(c, x, y - 10, 12, '248,216,120', 0.6 * (1 - p));
      if (once(e, 'm')) emit(14, () => mote(x + rnd(-9, 9), y - rnd(0, 18), [HOLY[3], HOLY[2], HOLY[1]], boxF(x, y)));
      break;
    }
    case 'shadowHit': {
      // a shadow bolt landing: dark motes collapsing inward
      const r = 14 * (1 - p);
      for (let i = 0; i < 10; i++) { const ang = (i / 10) * Math.PI * 2; P(c, SHADOW[1 + (i % 3)], x + Math.cos(ang) * r, y - 10 + Math.sin(ang) * r * 0.7, 2, 2); }
      glow(c, x, y - 10, 12, '152,120,248', 0.5 * (1 - p));
      break;
    }
    case 'healBurst': {
      // green crosses and light motes rising around the fighter
      for (let i = 0; i < 5; i++) {
        const t = (p + i * 0.17) % 1, cx = x - 9 + ((i * 7) % 19), cy = y - 2 - t * 20;
        cross(c, cx, cy, t < 0.6 ? '#58d854' : '#b8f818', t < 0.3 ? 2 : 1);
      }
      glow(c, x, y - 10, 11, '88,216,84', 0.45 * (1 - p));
      if (once(e, 'm')) emit(10, () => mote(x + rnd(-9, 9), y - rnd(0, 12), ['#fcfcfc', '#b8f818', '#58d854'], boxF(x, y)));
      break;
    }
    case 'stab': {
      // a shadow X slash with a dark smear and purple sparks
      const k = Math.min(1, p * 3), cx = x, cy = y - 11;
      for (let i = 0; i < 8; i++) {
        if (i / 7 > k) break;
        P(c, '#000000', cx - 9 + i * 2.5 - 1, cy - 9 + i * 2.5 - 1, 4, 4);
        P(c, SHADOW[2 + (i % 2)], cx - 9 + i * 2.5, cy - 9 + i * 2.5, 2, 2);
        if (p > 0.15) { P(c, '#000000', cx + 9 - i * 2.5 - 1, cy - 9 + i * 2.5 - 1, 4, 3); P(c, SHADOW[1 + (i % 2)], cx + 9 - i * 2.5, cy - 9 + i * 2.5, 2, 1); }
      }
      if (once(e, 'sp', p > 0.2)) emit(7, () => spark(cx, cy, [SHADOW[3], SHADOW[2], SHADOW[1], SHADOW[0]], boxC(cx, cy), 55));
      break;
    }
    case 'smoke': {
      if (once(e, 's')) emit(16, () => smoke(x + rnd(-8, 8), y - rnd(0, 14), boxF(x, y), { vx: rnd(-14, 14), vy: rnd(-12, -2), size: rnd(3, 5), life: rnd(0.4, 0.8), ramp: ['#bcbcbc', '#7c7c7c', '#3c3c3c'] }));
      if (p < 0.3) { c.globalAlpha = 0.6; dblob(c, '#7c7c7c', x, y - 10, 10, ph); c.globalAlpha = 1; }
      break;
    }
    case 'toxicPuff': {
      // a sickly green cloud with bubbles popping out of it
      if (once(e, 's')) emit(14, () => smoke(x + rnd(-8, 8), y - rnd(0, 12), boxF(x, y), { vx: rnd(-12, 12), vy: rnd(-10, -2), size: rnd(3, 5), life: rnd(0.4, 0.8), ramp: [TOX[2], TOX[1], TOX[0]] }));
      if (Math.random() < 0.4) part(x + rnd(-8, 8), y - rnd(2, 10), { vy: rnd(-20, -8), life: 0.4, ramp: [TOX[3], TOX[2]], box: boxF(x, y) });
      if (p < 0.4) { c.globalAlpha = 0.5; dblob(c, TOX[1], x, y - 8, 9, ph); c.globalAlpha = 1; }
      break;
    }
    case 'lob': {
      // a vial spinning on its arc, dripping as it goes
      const to = Number(e.data?.to ?? e.col), x1 = cellPx(to, e.row).x;
      const vx = x + (x1 - x) * p, vy = y - 12 - Math.sin(p * Math.PI) * 26, spin = Math.floor(b.time * 16) % 2;
      const liquid = String(e.data?.color ?? TOX[2]);
      P(c, '#000000', vx - 3, vy - 4, 7, 8); P(c, '#a4e4fc', vx - 2, vy - 3, 5, 6); P(c, liquid, vx - 2, vy - 1 + spin, 5, 3); P(c, '#fcfcfc', vx - 1, vy - 3, 1, 2);
      P(c, '#503000', vx - 1, vy - 5 + spin, 3, 2);
      if (Math.random() < 0.4) part(vx, vy + 3, { vy: 10, g: 120, life: 0.3, ramp: [liquid, TOX[1]], box: boxC(vx, vy) });
      break;
    }
    case 'trapPop': {
      // jaws snap shut, then the trap's payload bursts
      const k = String(e.data?.kind ?? 'explode'), col = k === 'freeze' ? ICE : k === 'mine' ? TOX : FIRE;
      const shut = Math.min(1, p * 5), gap = Math.round(5 * (1 - shut));
      for (let i = 0; i < 5; i++) { P(c, '#bcbcbc', x - 8 + i * 4, y - 3 - gap, 2, 2); P(c, '#bcbcbc', x - 6 + i * 4, y - 1 + gap, 2, 2); }
      P(c, '#000000', x - 9, y, 19, 1); P(c, '#7c7c7c', x - 9, y - 1, 19, 1);
      if (k === 'freeze') { crystal(c, x - 5, y, Math.round(10 * Math.min(1, p * 3)), 2); crystal(c, x + 5, y, Math.round(12 * Math.min(1, p * 3)), 2); snowBurst(e, x, y, 12); }
      else if (k === 'mine') { dust(e, x, y, 10); if (once(e, 'v')) emit(10, () => part(x + rnd(-4, 4), y - 4, { vx: rnd(-30, 30), vy: rnd(-50, -15), g: 140, life: 0.5, ramp: [TOX[2], TOX[1], TOX[0]], size: rnd(1, 2), box: boxF(x, y) })); }
      else if (once(e, 'v')) emit(10, () => spark(x, y - 4, col, boxF(x, y), 50));
      break;
    }
    case 'hawkDive': case 'bite': case 'claw': {
      // raking slashes across the target (feathers for the hawk, a snap of jaws for the wolf)
      const n = e.kind === 'claw' ? 4 : 3, k = Math.min(1, p * 3);
      for (let i = 0; i < n; i++) for (let j = 0; j < 7; j++) if (j / 6 <= k) {
        P(c, '#000000', x - 7 + i * 4 + j - 1, y - 18 + j * 2 - 1, 3, 3);
        P(c, j > 4 ? '#fcfcfc' : '#bcbcbc', x - 7 + i * 4 + j, y - 18 + j * 2, 1, 2);
      }
      if (e.kind === 'bite' && p < 0.4) { const g = Math.round(6 * (1 - p / 0.4)); for (let i = 0; i < 4; i++) { P(c, '#fcfcfc', x - 6 + i * 4, y - 14 - g, 2, 3); P(c, '#fcfcfc', x - 4 + i * 4, y - 6 + g, 2, 3); } }
      if (e.kind === 'hawkDive' && once(e, 'f')) emit(6, () => part(x + rnd(-6, 6), y - rnd(8, 18), { vx: rnd(-20, 20), vy: rnd(-10, 10), g: 25, drag: 0.92, life: rnd(0.5, 0.9), ramp: ['#f8d878', '#ac7c00', '#503000'], size: 2, shrink: 0.3, box: boxF(x, y) }));
      if (once(e, 'sp', p > 0.2)) emit(5, () => spark(x, y - 12, ['#fcfcfc', '#bcbcbc'], boxF(x, y), 40));
      break;
    }
    case 'flare': {
      // a bright burst that purges the panel
      if (p < 0.5) { glow(c, x, y - 6, 11, '248,184,0', 0.6 * (1 - p * 2)); ring(c, HOLY[3], x, y - 4, 3 + p * 16, 2 + p * 6); }
      if (once(e, 'sp')) emit(10, () => spark(x, y - 6, [HOLY[3], FIRE[3], FIRE[2]], boxF(x, y), 55, { g: 40 }));
      break;
    }
    case 'arrowRain': {
      // three arrows plunge into the panel, kicking up dust
      const fall = Math.min(1, p * 2);
      for (let i = 0; i < 3; i++) {
        const ax = x - 7 + i * 7, ay = y - 2 - 22 * (1 - fall) - i * 2;
        P(c, '#000000', ax - 1, ay - 11, 3, 12); P(c, '#ac7c00', ax, ay - 10, 1, 8); P(c, '#fcfcfc', ax, ay - 2, 1, 2); P(c, '#fcfcfc', ax - 1, ay - 11, 3, 1);
        if (fall < 1) P(c, '#7c7c7c', ax, ay - 16, 1, 4);
      }
      if (fall >= 1) dust(e, x, y, 8);
      break;
    }
    case 'laser': {
      // Kill Shot lock-on: a red line to the enemy and a closing reticle, blinking faster as it fires
      const t = b.f[1 - e.side], tp = panelFoot(t.col, t.row);
      const tx = tp.x + t.dx, ty = tp.y + t.dy;
      if (Math.floor(e.t * (8 + p * 20)) % 2 === 0) {
        const steps = 24;
        for (let i = 0; i <= steps; i++) P(c, '#f83800', x + (tx - x) * (i / steps), y - 12 + (ty - 12 - (y - 12)) * (i / steps), 1, 1);
      }
      const r = Math.round(10 - p * 6);
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { P(c, '#f83800', tx + sx * r - (sx < 0 ? 0 : 2), ty - 12 + sy * r, 3, 1); P(c, '#f83800', tx + sx * r, ty - 12 + sy * r - (sy < 0 ? 0 : 2), 1, 3); }
      P(c, '#fcfcfc', tx, ty - 12, 1, 1);
      break;
    }
    case 'cast': {
      // every spell: the element gathers at the caster's hand and flares (buff spells get feedback too)
      const ramp = ELEMENT_RAMP[String(e.data?.el ?? 'arcane')] ?? ARC, hx = x + d * 8, hy = y - 14;
      if (p < 0.6) for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + p * 5, r = 10 * (1 - p / 0.6) + 1; P(c, ramp[1 + (i % 3)], hx + Math.cos(a) * r, hy + Math.sin(a) * r, 1, 1); }
      if (p > 0.45 && p < 0.8) { blob(c, ramp[2], hx, hy, 2); P(c, ramp[3], hx - 3, hy, 7, 1); P(c, ramp[3], hx, hy - 3, 1, 7); }
      if (once(e, 'fl', p > 0.5)) emit(6, () => spark(hx, hy, [ramp[3], ramp[2], ramp[1]], boxC(hx, hy), 40, { g: 20 }));
      break;
    }
    case 'castName': break; // drawn on the UI layer by drawCastCallout
  }
}

// ---------- projectiles ----------
export function drawShot(c: Ctx, b: Battle, p: Projectile, x: number, y: number, dir: number): boolean {
  const ph = Math.floor(b.time * 20) % 2;
  if (p.kind === 'fireball') {
    // a flickering ball of fire trailing embers and smoke
    const box = boxC(x, y);
    if (Math.random() < 0.9) ember(x - dir * 4, y + rnd(-3, 3), box, { vx: -dir * rnd(15, 40), vy: rnd(-14, 6), g: -10, life: rnd(0.15, 0.3), ramp: HEAT.slice(2) });
    if (Math.random() < 0.3) smoke(x - dir * 6, y - 2, box, { vx: -dir * rnd(0, 10), vy: rnd(-8, -3), life: 0.4, size: 2 });
    dblob(c, '#f87800', x, y, 8, ph);
    blob(c, '#000000', x, y, 5); blob(c, '#a81000', x - dir, y, 4); blob(c, FIRE[0], x, y, 4);
    blob(c, '#f87800', x + dir, y, 3); blob(c, FIRE[2], x + dir, y - ph, 2); blob(c, FIRE[3], x + 2 * dir, y - 1, 1); P(c, '#fcfcfc', x + 2 * dir, y - 1, 1, 1);
    for (let i = 0; i < 3; i++) P(c, HEAT[4 + i], x - dir * (6 + i * 2) - (dir < 0 ? 2 : 0), y - 2 + ((i + ph) % 3) * 2, 3, 1);
    return true;
  }
  if (p.kind === 'arrow' || p.kind === 'sting') {
    P(c, '#000000', x - dir * 8 - (dir < 0 ? 11 : 0), y - 1, 12, 3);
    P(c, '#ac7c00', x - dir * 7 - (dir < 0 ? 9 : 0), y, 10, 1);
    P(c, p.kind === 'sting' ? TOX[2] : '#fcfcfc', x + dir * 2 - (dir < 0 ? 1 : 0), y - 1, 2, 3);
    P(c, '#fcfcfc', x - dir * 8, y - 1, 2, 1); P(c, '#fcfcfc', x - dir * 8, y + 1, 2, 1);
    P(c, '#7c7c7c', x - dir * 13, y, 3, 1); // air streak
    if (p.kind === 'sting' && Math.random() < 0.4) part(x, y + 1, { vy: 15, g: 80, life: 0.25, ramp: [TOX[2], TOX[1]], box: boxC(x, y) });
    return true;
  }
  if (p.kind === 'gust') {
    for (let i = 0; i < 3; i++) { const o = (Math.floor(b.time * 30) + i * 3) % 6; P(c, '#fcfcfc', x - dir * (i * 4 + o), y - 4 + i * 3, 6, 1); P(c, '#f878f8', x - dir * (i * 4 + o) - dir * 2, y - 3 + i * 3, 3, 1); }
    return true;
  }
  return false;
}

// ---------- statuses on fighters ----------
const prevFrozen = new WeakMap<Fighter, boolean>();
/** Frozen or Ice Block: the fighter sealed in a faceted block of ice that shatters when it ends. */
export function drawFrozen(c: Ctx, b: Battle, f: Fighter, s: Sprite, fx: number, y: number, flip: boolean): void {
  const iced = !f.dead && (f.st.frozen > 0 || f.st.iceBlock > 0);
  const was = prevFrozen.get(f) ?? false;
  prevFrozen.set(f, iced);
  if (was && !iced && !f.dead) shatterShards(fx, y);
  if (!iced) return;
  const x = Math.round(fx), bt = Math.round(y), top = bt - 23, gh = 23;
  c.globalAlpha = 0.45; drawFighterSprite(c, s, fx, y + 2, flip, 'ice'); c.globalAlpha = 1;
  c.globalAlpha = 0.3; P(c, ICE[2], x - 10, top, 21, gh); c.globalAlpha = 0.2; P(c, ICE[1], x + 2, top, 9, gh); c.globalAlpha = 1;
  P(c, '#000000', x - 11, top, 1, gh); P(c, '#000000', x + 11, top, 1, gh); P(c, '#000000', x - 11, top - 1, 23, 1);
  P(c, '#fcfcfc', x - 10, top, 20, 1); P(c, '#fcfcfc', x - 10, top, 1, gh); P(c, ICE[0], x + 10, top, 1, gh); P(c, ICE[0], x - 10, bt - 1, 21, 1);
  for (let i = 0; i < 9; i++) P(c, '#fcfcfc', x - 8 + i, top + 2 + i, 1, 1);
  for (let i = 0; i < 6; i++) P(c, ICE[1], x + 4 - i, top + 10 + i, 1, 1);
  const gl = ((b.time * 0.9) % 1.6) * 30 - 6;
  for (let i = 0; i < 4; i++) { const yy = top + 2 + i * 5, xx = Math.round(x - 10 + gl - i * 2); if (xx > x - 10 && xx < x + 10) P(c, '#fcfcfc', xx, yy, 1, 2); }
  crystal(c, x - 9, bt, 6, 2); crystal(c, x + 9, bt, 7, 2); crystal(c, x - 3, bt + 1, 4, 1);
  if (Math.random() < 0.05) part(x + rnd(-10, 10), bt - 1, { vy: rnd(-4, -1), life: rnd(0.6, 1), ramp: ['#a4e4fc', '#3cbcfc', '#0058f8'], size: rnd(2, 3), shrink: -0.2, dither: true, box: boxF(x, bt) });
}

/** Burning panel: a scorched panel with flame tongues licking up (24 wide) and embers drifting off. */
export function drawBurn(c: Ctx, b: Battle, col: number, row: number): void {
  const f = panelFoot(col, row), x = Math.round(f.x), base = Math.round(f.y) + 1, t = b.time;
  for (let yy = 0; yy < 8; yy++) for (let xx = 0; xx < 22; xx += 2) if (Math.sin(xx * 0.7 + yy + t * 6 + col) > 0.6) P(c, '#a81000', x - 11 + xx + (yy & 1), base - 9 + yy);
  for (let i = 0; i < 5; i++) {
    const fxp = x - 9 + i * 4.5, h = Math.round(5 + ((i * 3 + col + row) % 4) + Math.sin(t * 11 + i * 1.7 + col) * 2);
    for (let k = 0; k < h; k++) {
      const w = k < h * 0.4 ? 3 : k < h * 0.8 ? 2 : 1;
      P(c, HEAT[Math.min(8, 3 + Math.floor((k / h) * 5))], fxp - (w >> 1) + Math.round(Math.sin(t * 9 + k + i)), base - 3 - k, w, 1);
    }
  }
  if (Math.random() < 0.06) ember(x + rnd(-10, 10), base - 6, boxF(x, base), { vy: rnd(-25, -10), g: -5, life: rnd(0.4, 0.8) });
}

export const xOfShot = (p: Projectile): number => X0 + p.x * PW + PW / 2;
