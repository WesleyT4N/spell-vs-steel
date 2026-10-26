// Grand Colosseum and the panel grid every stage shares. Stages are drawn "Inked" like the 24px fighters:
// outlined pieces, flat cel shading, no dithering (toolkit in ink.ts). The other stages live in stages.ts.
import { P, view, rng, mix, type Ctx } from '../engine/gfx';
import { inked, wide, put, sky, mod, disc, blocks, inkBanner, inkTorch, inkCloud, bird, MX, MY, LIFT, BW, BH, XL, XR, YT, YB } from './ink';

export const COLS = 6, ROWS = 3, PW = 38, FACE = 15, LIP = 4, X0 = 6, Y0 = 98;
/** Panel rims per side, [light, dark], from the fighters' red and blue. */
export const TEAM_RIM: [string, string][] = [['#dd3443', '#8d1a30'], ['#486cdb', '#212f84']];
export const LEFT_EDGE = TEAM_RIM[0][0], RIGHT_EDGE = TEAM_RIM[1][0];

/** Center-bottom (feet) position of a panel. */
export function panelFoot(col: number, row: number): { x: number; y: number } {
  return { x: X0 + col * PW + PW / 2, y: Y0 + row * (FACE + LIP) + FACE - 3 };
}
export function panelCenter(col: number, row: number): { x: number; y: number } {
  return { x: X0 + col * PW + PW / 2, y: Y0 + row * (FACE + LIP) + FACE / 2 };
}

// bowl curve: center highest, edges dip down
const k = (x: number): number => -Math.round(6 * ((x - 120) / 120) ** 2);

type Fan = [number, number, string[], string[], number];

/** Colors of a clean panel face and its front lip. */
export interface PanelLook { face: string; hi: string; lo: string; lip: string; lipLo: string }

/** A battle stage: an animated backdrop plus the look of its panels. Stages are scenery only and play the same. */
export interface Stage {
  id: string;
  name: string;
  /** One-line flavor shown on the stage select. */
  tag: string;
  panel: PanelLook;
  /** Seed for the per-panel texture marks. */
  panelSeed: number;
  /** Marks on a clean panel face (`r` is seeded per panel). */
  tex(c: Ctx, x: number, y: number, w: number, h: number, r: () => number): void;
  /** Draw the full backdrop. `t` is an animation tick (about 8 per second); `cheer` livens up any crowd. */
  draw(c: Ctx, t: number, cheer?: number): void;
}

// Stages are painted larger than the world (see MX/MY in ink.ts), so a wider or taller screen just shows
// more of the arena. Each frame the stage draws into one oversized buffer and the visible part is copied out.
let big: Ctx | null = null;

/** Draw a stage's backdrop over the whole visible screen. */
export function drawStage(c: Ctx, st: Stage, t: number, cheer = 0): void {
  const { w, h, ox, oy } = view;
  if (!big) {
    const o = document.createElement('canvas');
    o.width = BW; o.height = BH;
    big = o.getContext('2d')!;
    big.imageSmoothingEnabled = false;
    big.translate(MX, MY);
  }
  big.clearRect(XL, YT, BW, BH);
  st.draw(big, t, cheer);
  const sx = Math.max(0, MX - ox), sy = Math.max(0, MY - oy), cw = Math.min(w, BW - sx), ch = Math.min(h, BH - LIFT - sy);
  c.drawImage(big.canvas, sx, sy + LIFT, cw, ch, sx - MX, sy - MY, cw, ch);
  // full-height phone screens are taller than the painted stage: its top row of sky and bottom row of floor
  // carry on to the screen edges
  const top = sy - MY, gapT = top + oy;
  if (gapT > 0) c.drawImage(big.canvas, sx, sy + LIFT, cw, 1, sx - MX, -oy, cw, gapT);
  const bot = top + ch, gapB = h - oy - bot;
  if (gapB > 0) c.drawImage(big.canvas, sx, sy + LIFT + ch - 1, cw, 1, sx - MX, bot, cw, gapB);
}

const STONE: PanelLook = { face: '#bdb7cc', hi: '#eee9e7', lo: '#7e7890', lip: '#5c566c', lipLo: '#000000' };
/** Pale stone face: one seam with a lit edge and two chips. */
export function stoneTex(c: Ctx, x: number, y: number, w: number, h: number, r: () => number): void {
  const sx = x + 9 + Math.floor(r() * 14);
  P(c, '#8a849c', sx, y, 1, h); P(c, '#eee9e7', sx + 1, y, 1, h);
  P(c, '#8a849c', x + 2 + Math.floor(r() * 4), y + 2 + Math.floor(r() * 6), 2, 1);
  P(c, '#8a849c', x + w - 7 + Math.floor(r() * 3), y + 3 + Math.floor(r() * 5), 2, 1);
}

// Grand Colosseum palette
const SKY = ['#3050b8', '#3c64c8', '#5480d8', '#709ce4', '#94b8ec', '#b8d4f2'];
const SAND_ST = ['#8a5a44', '#b07c5c', '#cfa47a', '#e8cc9c', '#fbecc4'], SAND_INK = '#4a2a26';
const GREY = ['#4c4660', '#6e6882', '#9690a8', '#bdb7cc', '#e6e2ec'], GREY_INK = '#241c30';
const DARK = ['#1c1020', '#34202c', '#4c3440'];
export const PURPLE = ['#3a1848', '#5e2a74', '#8a44a0', '#b070c4'], GOLD = ['#8a5a10', '#d8a030', '#f8d878'];
const SAND = ['#8e6440', '#b88c5c', '#d8b480', '#ecd2a0'];
const CROWD = [['#8d1a30', '#dd3443'], ['#212f84', '#486cdb'], ['#2c6a3a', '#4c9a4e'], ['#7a5a10', '#d8a030'], ['#5e2a74', '#8a44a0'], ['#8a8296', '#d8d2dc']];
const SKIN = [['#a4704c', '#edbe8a'], ['#6a3c2a', '#a47e73']];

export class Colosseum implements Stage {
  id = 'colosseum';
  name = 'GRAND COLOSSEUM';
  tag = 'THE CLASSIC PROVING GROUND';
  panel = STONE;
  panelSeed = 1010;
  tex = stoneTex;
  back: HTMLCanvasElement;
  front: HTMLCanvasElement;
  clouds: HTMLCanvasElement[];
  crowd: Fan[] = [];

  constructor() {
    this.back = wide(c => {
      sky(c, 50, SKY, '#101848');
      disc(c, '#f8c050', 204, 8, 6); disc(c, '#fce49c', 204, 8, 5); disc(c, '#fffbe8', 203, 7, 3);
    });
    this.clouds = [0.9, 0.7, 0.8].map((s, i) => inkCloud(s, i === 1, '#8aa0d4', '#c8d8f4', '#ffffff', '#4a5ca8'));
    this.front = wide(c => this.drawFront(c));
  }

  private drawFront(c0: Ctx): void {
    const r = rng(12), S = SAND_ST, D = DARK, WL = GREY;
    // the stands and the podium wall, drawn flat (x shifted by MX), then bent to follow the bowl
    const flat = document.createElement('canvas');
    flat.width = BW; flat.height = 96;
    {
      const c = flat.getContext('2d')!;
      c.drawImage(inked(SAND_INK, c => {
        c.translate(MX, 0);
        for (let x = XL; x < XR; x++) {
          if (mod(x, 28) === 9) P(c, S[0], x, 0, 1, 9); // flag poles
          // attic: cornice and a wall with small windows
          P(c, S[4], x, 9); P(c, S[3], x, 10); P(c, S[1], x, 11);
          const am = mod(x + 3, 14);
          P(c, S[2], x, 12, 1, 8);
          if (am >= 6 && am <= 7) P(c, D[0], x, 14, 1, 4);
          if (am === 5) P(c, S[3], x, 14, 1, 4);
          P(c, S[1], x, 20); P(c, SAND_INK, x, 21);
          // arcade
          const dx = am - 6.5;
          for (let y = 22; y < 41; y++) {
            const archTop = 30 - Math.round(Math.sqrt(Math.max(0, 16 - dx * dx)) * 1.2);
            let col: string;
            if (am >= 3 && am <= 10 && y >= archTop) col = y === archTop || am === 3 ? D[0] : D[1];
            else if (am >= 2 && am <= 11 && y >= archTop - 1) col = S[4];
            else col = am === 12 ? S[3] : am === 1 ? S[1] : S[2];
            P(c, y === 22 ? S[4] : col, x, y);
          }
          P(c, S[4], x, 41); P(c, S[2], x, 42); P(c, SAND_INK, x, 43);
          // seating steps
          for (let y = 44; y < 62; y++) { const st = (y - 44) % 4; P(c, st === 0 ? S[3] : st === 1 ? S[1] : D[1], x, y); }
        }
        // imperial box with a striped awning
        P(c, D[0], 100, 42, 40, 20);
        for (let x = 98; x < 142; x++) {
          const i = (x - 98) % 4, R = Math.floor((x - 98) / 4) % 2 ? PURPLE : [S[1], S[3], S[4], S[4]];
          P(c, R[3], x, 35); P(c, R[2], x, 36, 1, 4); P(c, R[1], x, 40);
          if (i !== 3) P(c, R[1], x, 41);
          if (i === 1 || i === 2) P(c, R[1], x, 42);
        }
        for (const px of [99, 139]) { P(c, GOLD[2], px, 42, 1, 20); P(c, GOLD[0], px + 1, 42, 1, 20); }
        P(c, GOLD[2], 99, 60, 42, 1); P(c, GOLD[0], 99, 61, 42, 1);
      }, BW, 64), 0, 0);
      c.drawImage(inked(GREY_INK, c => {
        c.translate(MX, 0);
        P(c, WL[4], XL, 1, BW, 1); P(c, WL[3], XL, 2, BW, 1); P(c, WL[1], XL, 3, BW, 1); P(c, GREY_INK, XL, 4, BW, 1);
        blocks(c, -72, 5, BW + 4, 24, 12, 6, [WL[0], WL[1], WL[2], WL[3]], r);
        // gates with portcullises
        for (const [gx, gr] of [[120, 12], [52, 8], [188, 8], [-16, 8], [256, 8]]) {
          const cy = 29 - gr;
          for (let y = cy - gr - 4; y < 29; y++) for (let x = gx - gr - 4; x <= gx + gr + 4; x++) {
            const ddx = x - gx, dy = Math.min(0, y - cy), d = Math.sqrt(ddx * ddx + dy * dy);
            if (d <= gr) P(c, (ddx % 3 === 0 || (y - cy + gr) % 4 === 3) ? D[2] : D[0], x, y);
            else if (d <= gr + 2.2) P(c, Math.floor(Math.atan2(dy, ddx) * 3) % 2 ? WL[4] : WL[2], x, y);
            else if (d <= gr + 3.2 && y < cy + 1) P(c, GREY_INK, x, y);
          }
          P(c, WL[4], gx - 1, cy - gr - 3, 3, 3); P(c, GREY_INK, gx - 2, cy - gr - 4, 5, 1);
        }
        // niches with stone guardians
        for (const nx of [86, 154]) {
          for (let y = 7; y < 25; y++) for (let x = nx - 5; x <= nx + 5; x++) { const dy = Math.min(0, y - 12); if ((x - nx) ** 2 + dy * dy <= 25) P(c, x < nx ? D[0] : D[1], x, y); }
          P(c, WL[4], nx - 1, 9, 3, 3); P(c, WL[3], nx + 1, 10, 1, 2);
          P(c, WL[4], nx - 3, 13, 6, 2); P(c, WL[3], nx + 2, 13, 2, 2);
          P(c, WL[4], nx - 2, 15, 3, 9); P(c, WL[3], nx + 1, 15, 2, 9); P(c, WL[2], nx - 2, 19, 5, 1);
          P(c, WL[3], nx - 4, 8, 1, 16); P(c, WL[4], nx - 4, 7, 1, 1);
          P(c, WL[3], nx - 5, 24, 11, 1);
        }
      }, BW, 30), 0, 61);
    }
    // sand, with a few pebbles
    P(c0, SAND[2], XL, 80, BW, YB - 80);
    for (let i = 0; i < 90; i++) { const x = XL + Math.floor(r() * BW), y = 94 + Math.floor(r() * (YB - 96)); P(c0, SAND[3], x, y, 2, 1); P(c0, SAND[1], x, y + 1, 2, 1); }
    for (let x = XL; x < XR; x++) {
      const o = k(x);
      c0.drawImage(flat, x + MX, 0, 1, 91, x, -o, 1, 91);
      P(c0, SAND[1], x, 91 - o, 1, 3); P(c0, SAND[0], x, 91 - o, 1, 1);
    }
    for (let x = XL + 1; x < XR - 1; x += 3) {
      const o = k(x);
      for (let y = 47 - o; y < 62 - o; y += 4) {
        if (x > 96 && x < 144) continue;
        if (r() < 0.15) continue;
        this.crowd.push([x + (r() < 0.5 ? 0 : 1), y, CROWD[Math.floor(r() * CROWD.length)], SKIN[Math.floor(r() * SKIN.length)], Math.floor(r() * 16)]);
      }
    }
  }

  draw(c: Ctx, t: number, cheer = 0): void {
    put(c, this.back);
    [[30, 1], [150, -1], [230, 3], [-40, -24], [300, -14], [100, -46]].forEach(([cx, cy], i) => c.drawImage(this.clouds[i % 3], Math.round(XL - 44 + mod(cx - XL + t * 0.2 * (1 + (i % 3) * 0.3), BW + 88)), cy));
    put(c, this.front);
    const hopEvery = cheer > 0 ? 4 : 16;
    // a stadium wave rolls around the stands every few seconds
    const wave = XL - 30 + mod(t * 6, BW + 160);
    for (const [x, y, body, skin, ph] of this.crowd) {
      const inWave = Math.abs(x - wave) < 8;
      const hop = inWave ? 2 : (t + ph) % hopEvery < 2 ? 1 : 0;
      P(c, skin[1], x, y - hop - 1, 2, 1); P(c, skin[0], x + 1, y - hop - 1, 1, 1);
      P(c, body[1], x, y - hop, 1, 2); P(c, body[0], x + 1, y - hop, 1, 2);
      if (inWave || (hop && cheer > 0)) { P(c, skin[1], x, y - hop - 3, 1, 2); P(c, skin[1], x + 1, y - hop - 3, 1, 1); }
    }
    // pigeons circling over the stands
    for (let i = 0; i < 5; i++) {
      const a = t * 0.05 + i * 1.26, rx = 90 + i * 14;
      bird(c, Math.round(120 + Math.cos(a) * rx), Math.round(-14 - i * 6 + Math.sin(a * 2) * 6), Math.floor(t / 2 + i) % 2 === 0, '#3a3450');
    }
    // dust blowing along the sand
    for (let i = 0; i < 6; i++) {
      const x = XL - 20 + mod(i * 71 + t * (1.2 + i * 0.2), BW + 40), y = 100 + ((i * 37) % 120), f = mod(t + i * 3, 12);
      if (f < 8) { P(c, SAND[3], x, y, 3 - (f >> 2), 1); P(c, SAND[3], x - 2, y + 1, 2, 1); }
    }
    // confetti when the crowd cheers
    if (cheer > 0) for (let i = 0; i < 40; i++) {
      const x = XL + mod(i * 53 + Math.sin(t * 0.3 + i) * 6, BW), y = YT + mod(i * 29 + t * (2 + (i % 3)), 120 - YT);
      P(c, CROWD[i % CROWD.length][1], x, y, 1 + (mod(t + i, 4) >> 1), 1);
    }
    // the emperor
    P(c, SKIN[0][1], 119, 49, 3, 2); P(c, GOLD[2], 118, 47, 5, 1);
    P(c, PURPLE[1], 117, 51, 7, 9); P(c, PURPLE[3], 117, 51, 2, 9); P(c, GOLD[2], 120, 51, 1, 9);
    for (let x = 9 - 28 * 3; x < XR; x += 28) {
      const o = k(x), wv = (t + x) % 6 < 3 ? 1 : 0;
      P(c, PURPLE[3], x + 1, 1 - o, 5, 1); P(c, PURPLE[2], x + 1, 2 - o, 4 + wv, 1); P(c, PURPLE[1], x + 1, 3 - o, 2 + wv, 1);
    }
    for (const bx of [-60, 18, 212, 290]) inkBanner(c, bx, 67 - k(bx + 5), 10, 19, PURPLE, GOLD, GREY_INK, t);
    inkTorch(c, 70, 72 - k(70), t, 0, GREY_INK);
    inkTorch(c, 168, 72 - k(168), t, 1, GREY_INK);
    inkTorch(c, -34, 72 - k(-34), t, 2, GREY_INK);
    inkTorch(c, 274, 72 - k(274), t, 3, GREY_INK);
  }
}

export type PanelState = 'clean' | 'burning' | 'cracked';
/** An element soaking a panel's face: fire (burning), poison (toxic), holy (blessed) or shadow (cursed). */
export type PanelTint = 'fire' | 'poison' | 'holy' | 'shadow';
/** Extra looks for a panel in battle. */
export interface PanelArt {
  /** Seconds since the panel cracked, so the crack can run across it as it appears. */
  crackAge?: number;
  tint?: PanelTint;
  /** Animation clock in seconds, for glowing seams and pulsing glyphs. */
  time?: number;
}

/** Face, light edge, dark edge and the glyph inks [dark, mid, light] of each element tint. */
const TINT: Record<PanelTint, { face: string; hi: string; lo: string; ink: [string, string, string] }> = {
  fire: { face: '#5c1a0c', hi: '#a83810', lo: '#300a04', ink: ['#a81000', '#f87800', '#fce0a8'] },
  poison: { face: '#2c6a30', hi: '#58a848', lo: '#123c18', ink: ['#005800', '#58d854', '#b8f818'] },
  holy: { face: '#d8b45c', hi: '#fcecb0', lo: '#8a6420', ink: ['#ac7c00', '#f8b800', '#fcfcfc'] },
  shadow: { face: '#22143e', hi: '#46327e', lo: '#100826', ink: ['#140a30', '#6844fc', '#9878f8'] },
};

/** A panel: black outline, two-tone team rim, an outlined bevelled face, and a darker front lip. */
export function drawPanel(c: Ctx, col: number, row: number, state: PanelState, _t: number, owner: 0 | 1, highlight: string | undefined, stage: Stage, art: PanelArt = {}): void {
  const x = X0 + col * PW, y = Y0 + row * (FACE + LIP);
  const [tl, td] = TEAM_RIM[owner];
  const fx = x + 2, fy = y + 1, fw = PW - 4, fh = FACE - 2;
  const look = stage.panel;
  const tint = art.tint ?? (state === 'burning' ? 'fire' : undefined), time = art.time ?? 0;
  P(c, '#000000', x, y - 1, PW, FACE + LIP + 1);
  P(c, tl, x + 1, y, PW - 2, FACE); P(c, td, x + 1, y + FACE - 1, PW - 2, 1); P(c, td, x + PW - 2, y, 1, FACE);
  let face = look.face, hi = look.hi, lo = look.lo;
  if (tint) ({ face, hi, lo } = TINT[tint]);
  // a cracked face sits a little lower and darker
  if (state === 'cracked') { face = mix(face, lo, 0.2); hi = mix(hi, face, 0.4); }
  if (highlight) { face = mix(face, highlight, 0.55); hi = mix(hi, highlight, 0.4); lo = mix(lo, highlight, 0.4); }
  P(c, '#000000', fx, fy, fw, fh);
  P(c, face, fx + 1, fy + 1, fw - 2, fh - 2);
  P(c, hi, fx + 1, fy + 1, fw - 2, 1); P(c, hi, fx + 1, fy + 1, 1, fh - 2);
  P(c, lo, fx + 1, fy + fh - 2, fw - 2, 1); P(c, lo, fx + fw - 2, fy + 2, 1, fh - 3);
  P(c, look.lip, x + 1, y + FACE, PW - 2, LIP); P(c, td, x + 1, y + FACE, PW - 2, 1); P(c, look.lipLo, x + 1, y + FACE + LIP - 1, PW - 2, 1);
  // texture marks sit inside the bevel; an element-soaked face shows its glyph instead
  if (tint) panelGlyph(c, tint, fx, fy, fw, fh, col, row, time);
  else stage.tex(c, fx + 2, fy + 2, fw - 4, fh - 4, rng(col * 31 + row * 7 + stage.panelSeed));
  if (state === 'cracked') drawCrack(c, col, row, fx, fy, fw, fh, mix(lo, '#000000', 0.75), hi, look.lip, art.crackAge ?? 9);
  // burning panels get their flames from the effects layer (fxView.drawBurn)
}

/** The crack across a panel face, the same for a given panel every time: a jagged split with a lit lower edge, a branch and a chipped corner. */
function crackPath(col: number, row: number, fx: number, fy: number, fw: number, fh: number): Array<[number, number]> {
  const r = rng(col * 13 + row * 5 + 9);
  const pts: Array<[number, number]> = [];
  // the main split runs top to bottom, wandering sideways
  let cx = fx + 10 + Math.floor(r() * (fw - 20)), cy = fy + 1;
  const lean = r() < 0.5 ? -1 : 1;
  while (cy < fy + fh - 1) {
    pts.push([cx, cy]);
    const step = r();
    if (step < 0.45) cx += lean; else if (step < 0.6) cx -= lean; else if (step < 0.8) { cx += lean; pts.push([cx, cy]); cx += lean; }
    cy++;
  }
  // a branch peels off the middle toward the far side
  const mid = pts[Math.floor(pts.length / 2)];
  let bx = mid[0], by = mid[1];
  for (let i = 0; i < 6 + Math.floor(r() * 4); i++) { bx -= lean; if (r() < 0.35) by += r() < 0.5 ? 1 : -1; by = Math.max(fy + 2, Math.min(fy + fh - 3, by)); pts.push([bx, by]); }
  // and a shorter split climbs in from the opposite bottom corner
  let ox = lean > 0 ? fx + 3 + Math.floor(r() * 4) : fx + fw - 4 - Math.floor(r() * 4), oy = fy + fh - 2;
  for (let i = 0; i < 7; i++) { pts.push([ox, oy]); ox += lean; if (i % 2 === 0) oy--; }
  return pts;
}

function drawCrack(c: Ctx, col: number, row: number, fx: number, fy: number, fw: number, fh: number, ink: string, lit: string, chip: string, age: number): void {
  const pts = crackPath(col, row, fx, fy, fw, fh);
  // it runs across the face in the first 0.15s, flashing white at the tip
  const n = age >= 0.15 ? pts.length : Math.ceil(pts.length * age / 0.15);
  for (let i = 0; i < n; i++) { const [px, py] = pts[i]; if (py < fy + fh - 2) P(c, lit, px + 1, py + 1); }
  for (let i = 0; i < n; i++) P(c, i >= n - 3 && age < 0.2 ? '#fcfcfc' : ink, pts[i][0], pts[i][1]);
  // a chip knocked out of the top edge where the split starts, showing the stone below
  if (age >= 0.15) { const [sx] = pts[0]; P(c, chip, sx - 1, fy + 1, 3, 1); P(c, ink, sx - 2, fy + 1, 1, 1); P(c, ink, sx + 2, fy + 1, 1, 1); }
}

/** The mark an element leaves on a soaked panel face. */
function panelGlyph(c: Ctx, tint: PanelTint, fx: number, fy: number, fw: number, fh: number, col: number, row: number, time: number): void {
  const [dk, md, lt] = TINT[tint].ink;
  const cx = fx + (fw >> 1), cy = fy + (fh >> 1);
  const pulse = Math.floor(time * 4 + col + row) % 4;
  if (tint === 'fire') {
    // scorched seams glowing like coals
    const r = rng(col * 7 + row * 11 + 3);
    for (let i = 0; i < 3; i++) {
      let sx = fx + 4 + Math.floor(r() * (fw - 10)), sy = fy + 2 + Math.floor(r() * 3);
      const glow = (Math.floor(time * 6) + i) % 3 === 0 ? lt : md;
      for (let k = 0; k < 5; k++) { P(c, dk, sx, sy + 1); P(c, glow, sx, sy); sx += r() < 0.5 ? 1 : 2; sy += r() < 0.4 ? 1 : 0; if (sy > fy + fh - 4) break; }
    }
  } else if (tint === 'poison') {
    // two sludge puddles, each with an outline and a wet highlight
    for (const [px, py, w] of [[fx + 5 + ((col * 5) % 6), fy + 3, 9], [fx + fw - 15 + ((row * 3) % 4), fy + fh - 6, 8]] as const) {
      P(c, dk, px, py, w, 3); P(c, dk, px + 1, py - 1, w - 2, 5);
      P(c, md, px + 1, py, w - 2, 3);
      P(c, lt, px + 2, py, 2, 1);
      if (pulse === (col + row) % 4) P(c, lt, px + w - 3, py + 1, 1, 1);
    }
  } else if (tint === 'holy') {
    // a gold sigil ring, squashed into the panel's perspective, with a glint running around it
    const ring: Array<[number, number]> = [[-6, 0], [-5, -1], [-3, -2], [-1, -3], [1, -3], [3, -2], [5, -1], [6, 0], [5, 1], [3, 2], [1, 3], [-1, 3], [-3, 2], [-5, 1]];
    ring.forEach(([dx, dy], i) => P(c, (i + Math.floor(time * 8)) % ring.length < 2 ? lt : md, cx + dx, cy + dy, 2, 1));
    P(c, dk, cx, cy - 1, 2, 3); P(c, dk, cx - 2, cy, 6, 1);
  } else {
    // a shadow eye: an outlined almond with a pupil that pulses
    for (let dx = -6; dx <= 7; dx++) {
      const h = Math.max(0, 2 - Math.floor(Math.abs(dx - 0.5) / 3));
      P(c, dk, cx + dx, cy - h - 1, 1, 1); P(c, dk, cx + dx, cy + h + 1, 1, 1);
      if (h > 0) P(c, md, cx + dx, cy - h, 1, h * 2 + 1);
    }
    P(c, pulse < 2 ? lt : '#fcfcfc', cx, cy - 1, 2, 3);
  }
}

/**
 * A broken panel: the team rim stays, the face is gone and the pit shows its stone walls, with jagged shards left
 * at the edges and rubble at the bottom. `age` is seconds since it broke (the face crumbles in for the first 0.35s).
 */
export function drawHole(c: Ctx, col: number, row: number, owner: 0 | 1, stage: Stage, age = 9): void {
  const x = X0 + col * PW, y = Y0 + row * (FACE + LIP);
  const [tl, td] = TEAM_RIM[owner];
  const look = stage.panel;
  const fx = x + 2, fy = y + 1, fw = PW - 4, fh = FACE - 2;
  const wall = look.lip, wallDk = mix(look.lip, '#000000', 0.45), pit = '#0a0610';
  P(c, '#000000', x, y - 1, PW, FACE + LIP + 1);
  P(c, tl, x + 1, y, PW - 2, FACE); P(c, td, x + 1, y + FACE - 1, PW - 2, 1); P(c, td, x + PW - 2, y, 1, FACE);
  P(c, '#000000', fx, fy, fw, fh);
  // the far wall of the pit, lit at the top and ragged where it drops into darkness
  const r = rng(col * 17 + row * 3 + 5);
  P(c, pit, fx + 1, fy + 1, fw - 2, fh - 2);
  P(c, look.lo, fx + 1, fy + 1, fw - 2, 1);
  for (let sx = fx + 1; sx < fx + fw - 1; sx++) { const d = 2 + (r() < 0.35 ? 1 : 0); P(c, wall, sx, fy + 2, 1, d); P(c, wallDk, sx, fy + 2 + d, 1, 1); }
  P(c, wallDk, fx + 1, fy + 2, 1, fh - 3); P(c, wallDk, fx + fw - 2, fy + 2, 1, fh - 3);
  // rubble lying at the bottom
  for (let i = 0; i < 2; i++) { const rx = fx + 7 + Math.floor(r() * (fw - 16)), ry = fy + 7 + i; P(c, look.lo, rx, ry, 3, 1); P(c, wallDk, rx + 1, ry - 1, 1, 1); }
  // the front lip still stands
  P(c, look.lip, x + 1, y + FACE, PW - 2, LIP); P(c, td, x + 1, y + FACE, PW - 2, 1); P(c, look.lipLo, x + 1, y + FACE + LIP - 1, PW - 2, 1);
  if (age < 0.35) crumble(c, col, row, fx, fy, fw, fh, look, age);
}

/** The broken face falling into the pit as chunks, with a white crack-flash on the first frames. */
function crumble(c: Ctx, col: number, row: number, fx: number, fy: number, fw: number, fh: number, look: PanelLook, age: number): void {
  const r = rng(col * 29 + row * 13 + 1);
  const k = age / 0.35;
  for (let i = 0; i < 7; i++) {
    const w = 4 + Math.floor(r() * 4), h = 2 + Math.floor(r() * 2);
    const sx = fx + 2 + Math.floor(((i + 0.5) / 7) * (fw - 8)) + Math.floor(r() * 3) - 1, sy = fy + 1 + Math.floor(r() * (fh - 5));
    // each chunk drops and shrinks as it falls away
    const dy = Math.round((40 + r() * 30) * age * age + 6 * age), sw = Math.max(1, Math.round(w * (1 - k * 0.7)));
    const yy = Math.min(fy + fh - 2, sy + dy);
    if (yy >= fy + fh - 2) continue;
    P(c, '#000000', sx - 1, yy - 1, sw + 2, h + 2);
    P(c, k < 0.5 ? look.face : look.lo, sx, yy, sw, h); P(c, look.hi, sx, yy, sw, 1);
  }
  if (age < 0.08) { P(c, '#fcfcfc', fx + 1, fy + 1, fw - 2, 1); P(c, '#fcfcfc', fx + 1, fy + fh - 2, fw - 2, 1); }
  // dust puffing up out of the pit
  for (let i = 0; i < 4; i++) {
    const px = fx + 4 + i * Math.floor((fw - 8) / 3), py = fy + 2 - Math.round(k * 5) - (i % 2);
    if (k < 0.7) P(c, look.hi, px, py, k < 0.35 ? 2 : 1, 1);
  }
}
