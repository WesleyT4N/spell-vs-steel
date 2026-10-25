// "SPELL VS STEEL" logo, Shield VS version: one-line block wordmark with a blue|red heater shield as the VS,
// and a crossed greatsword and staff reaching past the shield behind it. Drop-in replacement for src/art/logo.ts.
// Idle (one left-to-right sequence, ~7 s loop): a shine sweeps across the name; as it passes the shield a spark runs
// around the gold rim; a gleam runs up the exposed blade and the sword tip flashes a star; then the orb flashes and pulses. Effects are layered so nothing ever draws over the shield.
import type { Ctx } from '../engine/gfx';

const PAD = 4;
const LW = 240, LH = 76;

type Mask = { w: number; h: number; d: Uint8Array; gh: number; vw: number };

const HEAVY: Record<string, string[]> = {
  S: ['.########', '#########', '###......', '###......', '########.', '.########', '......###', '......###', '#########', '########.'],
  P: ['########.', '#########', '###...###', '###...###', '#########', '########.', '###......', '###......', '###......', '###......'],
  E: ['#########', '#########', '###......', '###......', '#######..', '#######..', '###......', '###......', '#########', '#########'],
  L: ['###......', '###......', '###......', '###......', '###......', '###......', '###......', '###......', '#########', '#########'],
  T: ['#########', '#########', '...###...', '...###...', '...###...', '...###...', '...###...', '...###...', '...###...', '...###...'],
};
const VS_BIG: Record<string, string[]> = {
  V: ['##..##', '##..##', '##..##', '##..##', '##..##', '.####.', '.####.', '..##..'],
  S: ['.#####', '##....', '##....', '.####.', '....##', '....##', '....##', '#####.'],
};
const BLUE = ['#a4e4fc', '#3cbcfc', '#0078f8', '#0058f8'];
const STEEL = ['#fcfcfc', '#bcbcbc', '#bcbcbc', '#7c7c7c'];

// geometry, in logo-canvas pixels
const CX = 120, TOP = 14, SW = 40, SH = 50, WY = 29, L = 34, ORB_R = 5;
const CY = TOP + SH / 2 - 2;

function P(c: Ctx, col: string, x: number, y: number, w = 1, h = 1): void { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h); }
function blank(w: number, h: number): Mask { return { w, h, d: new Uint8Array(w * h), gh: 0, vw: 0 }; }
function on(m: Mask, x: number, y: number): boolean { return x >= 0 && y >= 0 && x < m.w && y < m.h && m.d[y * m.w + x] === 1; }
function set(m: Mask, x: number, y: number): void { if (x >= 0 && y >= 0 && x < m.w && y < m.h) m.d[y * m.w + x] = 1; }
function each(m: Mask, fn: (x: number, y: number) => void): void { for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.d[y * m.w + x]) fn(x, y); }

function textMask(font: Record<string, string[]>, str: string, scale: number): Mask {
  const gw = font[str[0]][0].length, gh = font[str[0]].length * scale;
  const w = (str.length * (gw + 1) - 1) * scale;
  const m = blank(w + PAD * 2, gh + PAD * 2); m.gh = gh; m.vw = w;
  [...str].forEach((ch, i) => font[ch].forEach((row, y) => [...row].forEach((v, x) => {
    if (v === '#') for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) set(m, PAD + (i * (gw + 1) + x) * scale + sx, PAD + y * scale + sy);
  })));
  return m;
}
function dilate(m: Mask, r: number): Mask {
  const o = blank(m.w, m.h);
  each(m, (x, y) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + r) set(o, x + dx, y + dy); });
  return o;
}
function paint(c: Ctx, m: Mask, ox: number, oy: number, col: string | ((x: number, y: number) => string)): void {
  each(m, (x, y) => P(c, typeof col === 'string' ? col : col(x, y), ox + x - PAD, oy + y - PAD));
}
/** Outline rings (inner to outer), optional straight-down drop in a team color, ramp face with a white top edge. */
function word(c: Ctx, m: Mask, x: number, y: number, ramp: string[], rings: string[], drop?: { n: number; col: string }): void {
  let body = m;
  const ext = blank(m.w, m.h);
  if (drop){ each(m, (px, py) => { for (let i = 1; i <= drop.n; i++) set(ext, px, py + i); }); body = blank(m.w, m.h); for (let i = 0; i < m.d.length; i++) body.d[i] = m.d[i] | ext.d[i]; }
  for (let k = rings.length; k >= 1; k--) paint(c, dilate(body, k), x, y, rings[k - 1]);
  if (drop) paint(c, ext, x, y, drop.col);
  paint(c, m, x, y, (px, py) => !on(m, px, py - 1) ? '#fcfcfc' : ramp[Math.min(ramp.length - 1, Math.max(0, Math.floor((py - PAD) / m.gh * ramp.length)))]);
}
function line(c: Ctx, x0: number, y0: number, x1: number, y1: number, th: number, col: string): void {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
  for (let i = 0; i <= n; i++){ const t = i / n; P(c, col, Math.round(x0 + (x1 - x0) * t - th / 2), Math.round(y0 + (y1 - y0) * t - th / 2), th, th); }
}
function disc(c: Ctx, cx: number, cy: number, r: number, col: string): void {
  for (let dy = -r; dy <= r; dy++){ const hw = Math.floor(Math.sqrt(r * r - dy * dy + r * 0.6)); P(c, col, cx - hw, cy + dy, hw * 2 + 1, 1); }
}

let back: HTMLCanvasElement | null = null;   // wordmark + crossed weapons
let front: HTMLCanvasElement | null = null;  // shield + VS
let letters: [number, number][] = [];        // wordmark face pixels, for the shine
let rim: [number, number][] = [];            // shield rim pixels in order around the shield
let orb: [number, number] = [0, 0];
let blade: [number, number][] = [];         // exposed blade path, for the gleam (drawn behind the shield)
let tipPt: [number, number] = [0, 0];

const STAR_SIZE = [0, 1, 2, 3, 2, 1, 0];
function star4(c: Ctx, x: number, y: number, r: number, arm: string): void {
  if (r <= 0) return;
  P(c, '#000000', x - r - 1, y - 1, 2 * r + 3, 3); P(c, '#000000', x - 1, y - r - 1, 3, 2 * r + 3);
  P(c, arm, x - r, y, 2 * r + 1, 1); P(c, arm, x, y - r, 1, 2 * r + 1); P(c, '#fcfcfc', x, y);
  if (r > 1){ P(c, '#fcfcfc', x - 1, y, 3, 1); P(c, '#fcfcfc', x, y - 1, 1, 3); }
}

function canvas(): [HTMLCanvasElement, Ctx] { const cv = document.createElement('canvas'); cv.width = LW; cv.height = LH; return [cv, cv.getContext('2d')!]; }

function build(): void {
  if (back) return;
  const [bc, b] = canvas();
  // wordmark
  const sp = textMask(HEAVY, 'SPELL', 2), st = textMask(HEAVY, 'STEEL', 2), spX = 3, stX = LW - 3 - st.vw;
  word(b, sp, spX, WY, BLUE, ['#000000', '#000000'], { n: 2, col: '#0000a8' });
  word(b, st, stX, WY, STEEL, ['#000000', '#000000'], { n: 2, col: '#881400' });
  letters = [];
  each(sp, (px, py) => letters.push([spX + px - PAD, WY + py - PAD]));
  each(st, (px, py) => letters.push([stX + px - PAD, WY + py - PAD]));

  // crossed staff (bottom-right to top-left) and greatsword (bottom-left to top-right)
  const lerp = (a: number[], z: number[], t: number): [number, number] => [a[0] + (z[0] - a[0]) * t, a[1] + (z[1] - a[1]) * t];
  const s0 = [CX - L, CY + L], s1 = [CX + L, CY - L], a0 = [CX + L, CY + L], a1 = [CX - L + ORB_R, CY - L + ORB_R];
  line(b, a0[0], a0[1], a1[0], a1[1], 4, '#000000');
  line(b, a0[0], a0[1], a1[0], a1[1], 2, '#ac7c00'); line(b, a0[0] - 1, a0[1], a1[0] - 1, a1[1], 1, '#503000');
  orb = [Math.round(a1[0]), Math.round(a1[1])];
  disc(b, orb[0], orb[1], ORB_R + 1, '#000000'); disc(b, orb[0], orb[1], ORB_R, '#0058f8');
  disc(b, orb[0] - 1, orb[1] - 1, ORB_R - 2, '#3cbcfc'); P(b, '#fcfcfc', orb[0] - ORB_R + 1, orb[1] - ORB_R + 2, 2, 2);
  const b0 = lerp(s0, s1, 0.22), g = lerp(s0, s1, 0.19), gl = Math.round(L * 0.2);
  const sA = lerp(s0, s1, 0.02), gA = lerp(s0, s1, 0.04), gB = lerp(s0, s1, 0.18), tip = lerp(s0, s1, 0.96);
  line(b, sA[0], sA[1], s1[0], s1[1], 5, '#000000');
  line(b, g[0] - gl, g[1] - gl, g[0] + gl, g[1] + gl, 4, '#000000');
  line(b, gA[0], gA[1], gB[0], gB[1], 2, '#503000');
  line(b, b0[0], b0[1], tip[0], tip[1], 3, '#bcbcbc'); line(b, b0[0], b0[1] - 1, s1[0] - 1, s1[1], 1, '#fcfcfc');
  line(b, g[0] - gl, g[1] - gl, g[0] + gl, g[1] + gl, 2, '#f8b800');
  P(b, '#f8b800', Math.round(s0[0]), Math.round(s0[1]) - 2, 2, 2);
  blade = []; for (let i = 0; i <= 40; i++){ const p = lerp(b0, s1, i / 40); blade.push([Math.round(p[0]), Math.round(p[1])]); }
  tipPt = blade[blade.length - 1];

  // heater shield: black edge, gold rim, blue | red halves split by a black line
  const [fc, f] = canvas();
  const sm = blank(SW + PAD * 2, SH + PAD * 2), k = SH * 0.38;
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++){
    const lx = x - SW / 2 + 0.5;
    if (y < k || Math.abs(lx) <= (SW / 2) * Math.sqrt(Math.max(0, 1 - ((y - k) / (SH - k)) ** 2))) set(sm, x + PAD, y + PAD);
  }
  const inner = blank(sm.w, sm.h);
  each(sm, (x, y) => { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (!on(sm, x + dx, y + dy)) return; set(inner, x, y); });
  const sx = CX - SW / 2;
  paint(f, dilate(sm, 1), sx, TOP, '#000000');
  paint(f, sm, sx, TOP, (px, py) => (py - PAD) < 2 ? '#fce0a8' : (px - PAD) > SW / 2 ? '#ac7c00' : '#f8b800');
  paint(f, inner, sx, TOP, (px) => {
    const u = px - PAD;
    if (Math.abs(u - SW / 2 + 0.5) < 1) return '#000000';
    return u < SW / 2 ? (u < 4 ? '#0078f8' : '#0058f8') : (u > SW - 4 ? '#a81000' : '#d82800');
  });
  word(f, textMask(VS_BIG, 'V', 2), CX - 15, TOP + 9, ['#fcfcfc', '#fcfcfc', '#a4e4fc', '#a4e4fc'], ['#000000']);
  word(f, textMask(VS_BIG, 'S', 2), CX + 3, TOP + 9, ['#fcfcfc', '#fcfcfc', '#fce0a8', '#fce0a8'], ['#000000']);
  rim = [];
  each(sm, (px, py) => { if (!on(inner, px, py)) rim.push([sx + px - PAD, TOP + py - PAD]); });
  const ccy = TOP + SH * 0.45;
  rim.sort((p, q) => Math.atan2(p[1] - ccy, p[0] - CX) - Math.atan2(q[1] - ccy, q[0] - CX));

  back = bc; front = fc;
}

export const LOGO_W = LW;
export const LOGO_H = LH;

/** Draws the logo centered on cx with its top at y. Pass seconds since the scene started to animate the idle. */
export function drawLogo(c: Ctx, cx: number, y: number, seconds = 0): void {
  build();
  const x = Math.round(cx - LW / 2);
  const ph = Math.floor(seconds * 12) % 84; // the idle was tuned at 12 fps: a 7 s loop
  c.drawImage(back!, x, y);
  if (ph >= 36 && ph < 50){ // gleam up the blade, behind the shield
    const g = (ph - 36) / 14 * (blade.length + 6);
    blade.forEach(([bx, by], i) => { if (Math.abs(i - g) < 2) P(c, '#fcfcfc', x + bx, y + by - 1, 2, 2); });
  }
  if (ph >= 56 && ph < 66){ // orb pulse, behind the shield
    const r = ph < 61 ? ph - 56 : 66 - ph;
    disc(c, x + orb[0], y + orb[1], Math.min(ORB_R, 2 + r), r > 2 ? '#3cbcfc' : '#0078f8');
    P(c, '#fcfcfc', x + orb[0] - 2, y + orb[1] - 2, 2, 2);
  }
  c.drawImage(front!, x, y);
  if (ph < 40){ // shine across the letters
    const pos = ph * 7 - 20;
    for (const [lx, ly] of letters){ const d = lx + ly * 0.6 - pos; if (d >= 0 && d < 4) P(c, '#fcfcfc', x + lx, y + ly); }
  }
  if (ph >= 14 && ph < 38){ // spark around the rim with a short trail
    const n = rim.length, head = Math.floor((ph - 14) / 24 * n);
    for (let k = 0; k < 8; k++){ const p = rim[(head - k * 2 + n) % n]; P(c, k < 2 ? '#fcfcfc' : k < 5 ? '#fce0a8' : '#f8b800', x + p[0], y + p[1]); }
  }
  if (ph >= 48 && ph < 55) star4(c, x + tipPt[0] + 1, y + tipPt[1] - 1, STAR_SIZE[ph - 48], '#a4e4fc'); // sword tip
  if (ph >= 57 && ph < 64) star4(c, x + orb[0] - 3, y + orb[1] - 3, STAR_SIZE[ph - 57], '#3cbcfc');    // orb
}
