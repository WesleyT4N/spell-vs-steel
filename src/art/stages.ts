// The stages besides the Grand Colosseum, drawn "Inked" like the fighters (see ink.ts).
// Every stage keeps the same grid and red/blue panel rims; only the scenery and panel faces change.
import { P, W, H, rng, clamp, vnoise, hash, mix, layer, type Ctx } from '../engine/gfx';
import { Colosseum, stoneTex, PURPLE, GOLD, type PanelLook, type Stage } from './arena';
import { stamp, tone, bands, disc, ball, halo, blocks, inkBanner, inkTorch, inkCloud, cone, inkPine, clump } from './ink';

function poly(c: Ctx, pts: number[][], fill: string): void {
  c.fillStyle = fill; c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath(); c.fill();
}
/** A ridge line made of straight-sided peaks, roughened a little so it reads as rock. */
function terrain(peaks: number[][], k: number, rough: number, seed: number): (x: number) => number {
  const out: number[] = [];
  for (let x = -1; x <= W + 1; x++) {
    let t = Infinity;
    for (const [px, py] of peaks) t = Math.min(t, py + Math.abs(x - px) * k);
    out[x + 1] = t + (vnoise(x * 2, 0, 9, seed) - 0.5) * rough;
  }
  return x => out[clamp(Math.round(x) + 1, 0, W + 2)];
}
/** A mountain range in flat tones, lit from the right: rock and snow, each with a lit and a shaded face. */
function range(c: Ctx, prof: (x: number) => number, bottom: number, rock: string[], snow: string[], snowline: number, ink: string): void {
  for (let x = 0; x < W; x++) {
    const top = Math.round(prof(x)), lit = prof(x + 1) - prof(x - 1) > 0;
    const line = snowline + Math.round(Math.sin(x * 0.21) * 3 + Math.sin(x * 0.57) * 2) - (lit ? 0 : 3);
    for (let y = Math.max(0, top); y < bottom; y++) {
      const isSnow = y < line;
      P(c, y === top ? ink : isSnow ? snow[lit ? 1 : 0] : rock[lit ? 1 : 0], x, y);
    }
  }
}

/** A stage as drafted: static layers painted once, animated bits drawn every frame. */
interface StageDef {
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

class DraftStage implements Stage {
  id: string; name: string; tag: string; panel: PanelLook; panelSeed: number;
  tex: StageDef['tex'];
  private back: HTMLCanvasElement | null;
  private front: HTMLCanvasElement | null;
  constructor(private d: StageDef) {
    this.id = d.id; this.name = d.name; this.tag = d.tag; this.panel = d.panel; this.panelSeed = d.panelSeed; this.tex = d.tex;
    this.back = d.back ? layer(c => d.back!(c)) : null;
    this.front = d.front ? layer(c => d.front!(c)) : null;
  }
  draw(c: Ctx, t: number): void {
    if (this.back) c.drawImage(this.back, 0, 0);
    this.d.behind?.(c, t);
    if (this.front) c.drawImage(this.front, 0, 0);
    this.d.over?.(c, t);
  }
}

/** The Arcane Archive's moonlit gothic window. */
function inWin(x: number, y: number): boolean {
  if (Math.abs(x - 120) > 20) return false;
  if (y >= 30) return y < 72;
  return (x - 132) ** 2 + (y - 30) ** 2 <= 900 && (x - 108) ** 2 + (y - 30) ** 2 <= 900;
}

// shared colors
const SKY = ['#2c58c0', '#3c70d4', '#5a90e4', '#82b2ee', '#b4d4f6', '#dceaf8'];
const GREY = ['#46424e', '#625e6c', '#86828e', '#aaa6b0', '#cfccd4'], GREY_INK = '#221e2a';
const IVY = ['#2e5a22', '#4a8030', '#78b040'], IVY_INK = '#14280e';
const cloudsDay = [0.9, 0.7, 0.6].map((s, i) => () => inkCloud(s, i === 1, '#8aa0d4', '#c8d8f4', '#ffffff', '#4a5ca8'));
let dayClouds: HTMLCanvasElement[] | null = null;

/** Clusters of leaves hanging down a wall. */
function ivy(c: Ctx, vx: number, vy: number, len: number, k: number): void {
  for (let j = 0; j < len; j++) {
    const x = vx + Math.round(Math.sin(j * 0.4 + k) * 2);
    for (let i = -2; i <= 2; i++) if (hash(i, j, vx) > 0.45) P(c, IVY[hash(j, i, k) > 0.66 ? 2 : hash(j, i, k) > 0.3 ? 1 : 0], x + i, vy + j);
  }
}
/** A dark arched opening with an iron portcullis. */
function gate(c: Ctx, gx: number, base: number, gr: number, ringLit: string, ringDark: string, ink: string): void {
  const cy = base - gr;
  for (let y = cy - gr - 4; y < base; y++) for (let x = gx - gr - 4; x <= gx + gr + 4; x++) {
    const dx = x - gx, dy = Math.min(0, y - cy), d = Math.hypot(dx, dy);
    if (d <= gr) P(c, (dx % 3 === 0 || (y - cy + gr) % 4 === 3) ? '#4a4a58' : '#141018', x, y);
    else if (d <= gr + 2.5) P(c, Math.floor(Math.atan2(dy, dx) * 4) % 2 ? ringLit : ringDark, x, y);
    else if (d <= gr + 3.5 && y < cy + 1) P(c, ink, x, y);
  }
}
/** Merlons along a wall top. */
function merlons(c: Ctx, x0: number, x1: number, y: number, h: number, step: number, w: number, ramp: string[]): void {
  for (let x = x0; x < x1; x += step) { P(c, ramp[2], x, y, w, h); P(c, ramp[3], x, y, w - 1, 1); P(c, ramp[3], x, y, 1, h); P(c, ramp[1], x + w - 1, y + 1, 1, h - 1); }
}

const DRAFTS: StageDef[] = [
{
  id: 'courtyard', name: 'Castle Courtyard', tag: 'Flagstones inside the keep', panelSeed: 909,
  panel: { face: '#b8b4bc', hi: '#e8e4ea', lo: '#76727e', lip: '#56525e', lipLo: '#000000' },
  tex: stoneTex,
  back(c){
    bands(c, 0, 0, W, 72, SKY);
    disc(c, '#f8c050', 66, 12, 6); disc(c, '#fce49c', 66, 12, 5); disc(c, '#fffbe8', 65, 11, 3);
    const hills = terrain([[0, 56], [70, 50], [150, 54], [230, 48]], 0.25, 6, 21);
    for (let x = 0; x < W; x++) { const top = Math.round(hills(x)); P(c, '#4e7c94', x, top, 1, 1); P(c, hills(x + 1) > hills(x - 1) ? '#82aab6' : '#6a96a8', x, top + 1, 1, 80 - top); }
    // the distant keep
    const KS = ['#4e5c7c', '#6a7896', '#8a98b2', '#a6b2c8'];
    stamp(c, '#38425e', c => {
      P(c, KS[2], 108, 22, 12, 40); P(c, KS[1], 120, 22, 12, 40);
      for (let x = 106; x < 134; x += 4) P(c, x < 120 ? KS[3] : KS[2], x, 18, 3, 4);
      for (const [tx, ty] of [[100, 34], [136, 30]]) {
        P(c, KS[2], tx, ty, 4, 62 - ty); P(c, KS[1], tx + 4, ty, 4, 62 - ty);
        cone(c, tx + 4, ty - 10, 10, 5, ['#2c3050', '#3a4068', '#4c5480', '#5e6898']);
      }
      for (let y = 28; y < 56; y += 7) { P(c, '#2a3048', 116, y, 2, 3); P(c, '#2a3048', 123, y, 2, 3); }
    });
    for (const [tx, ty] of [[100, 34], [136, 30]]) { P(c, '#5a3a1a', tx + 4, ty - 15, 1, 5); P(c, PURPLE[2], tx + 5, ty - 15, 3, 2); }
  },
  behind(c, t){
    dayClouds ??= cloudsDay.map(f => f());
    [[20, 4], [130, 0], [210, 10]].forEach(([cx, cy], i) => c.drawImage(dayClouds![i], Math.round(((cx + t * 0.18 * (1 + i * 0.3)) % 300) - 44), cy));
  },
  front(c){
    const r = rng(62);
    // curtain wall
    stamp(c, GREY_INK, c => {
      blocks(c, 0, 52, W, 40, 10, 5, [GREY[0], GREY[1], GREY[2], GREY[3]], r);
      merlons(c, 0, W, 46, 6, 8, 5, GREY);
      P(c, GREY[4], 0, 52, W, 1);
    });
    P(c, 'rgba(20,16,30,0.3)', 0, 53, W, 2);
    stamp(c, IVY_INK, c => [[30, 54, 26], [74, 56, 18], [160, 54, 30], [200, 58, 16]].forEach(([vx, vy, len], k) => ivy(c, vx, vy, len, k)));
    // gatehouse
    stamp(c, GREY_INK, c => {
      blocks(c, 96, 37, 48, 55, 8, 6, [GREY[0], GREY[1], GREY[2], GREY[3]], r);
      P(c, 'rgba(20,16,30,0.18)', 120, 37, 24, 55);
      merlons(c, 94, 146, 30, 6, 7, 4, GREY);
      P(c, GREY[4], 94, 36, 52, 1); P(c, GREY[1], 94, 37, 52, 1);
      gate(c, 120, 92, 12, GREY[4], GREY[2], GREY_INK);
      for (const x of [108, 129]) { P(c, '#141018', x, 44, 3, 7); P(c, GREY[4], x - 1, 43, 5, 1); }
      disc(c, GOLD[0], 120, 47, 5); disc(c, GOLD[1], 120, 47, 4); disc(c, GOLD[2], 119, 46, 2);
      P(c, PURPLE[1], 118, 45, 5, 4); P(c, GOLD[2], 120, 46, 1, 2);
    });
    // round towers
    for (const tx of [6, 204]) {
      const tw = 30, cx = tx + tw / 2;
      stamp(c, GREY_INK, c => {
        for (let y = 26; y < 92; y++) for (let x = tx; x < tx + tw; x++) {
          const u = (x - tx) / (tw - 1) * 2 - 1, row = Math.floor((y - 26) / 5), off = row % 2 ? 3 : 0;
          const mortar = (y - 26) % 5 === 4 || ((x - tx + off) % 6 === 5 && Math.abs(u) < 0.8);
          P(c, mortar ? GREY[0] : u < -0.45 ? GREY[3] : u < 0.4 ? GREY[2] : GREY[1], x, y);
        }
        for (let i = 0; i < 5; i++) { const bx = tx + 1 + i * 6, u = (bx + 2 - tx) / (tw - 1) * 2 - 1; P(c, u < -0.45 ? GREY[3] : u < 0.4 ? GREY[2] : GREY[1], bx, 21, 4, 5); P(c, GREY[4], bx, 21, 4, 1); }
        P(c, GREY[4], tx - 1, 26, tw + 2, 1); P(c, GREY[0], tx - 1, 27, tw + 2, 1);
        for (const wy of [40, 62]) { P(c, '#141018', tx + 13, wy, 3, 8); P(c, '#141018', tx + 14, wy - 1, 1, 1); P(c, GREY[4], tx + 12, wy + 8, 5, 1); }
      });
      stamp(c, '#141a2c', c => cone(c, cx, -1, 22, tw / 2 + 3, ['#1e2438', '#2c3450', '#3c4868', '#4e5c80']));
      P(c, '#3a2410', cx, -6, 1, 6); P(c, PURPLE[3], cx + 1, -6, 5, 2); P(c, PURPLE[2], cx + 1, -4, 3, 1);
    }
    // flagstones
    const FL = ['#4a4652', '#7e7a84', '#94909a', '#aeaab2'];
    for (let y = 90; y < H; y++) for (let x = 0; x < W; x++) {
      const row = Math.floor((y - 90) / 7), off = (row * 9) % 16, cellX = Math.floor((x + off) / 16);
      const seam = (y - 90) % 7 === 6 || (x + off) % 16 === 15;
      P(c, seam ? FL[0] : (y - 90) % 7 === 0 || (x + off) % 16 === 0 ? FL[3] : hash(cellX, row, 4) < 0.35 ? FL[1] : FL[2], x, y);
    }
    for (let i = 0; i < 26; i++) { const x = Math.floor(r() * W), y = 92 + Math.floor(r() * 66); P(c, IVY[0], x, y, 3, 1); P(c, IVY[1], x + 1, y - 1, 1, 1); }
    P(c, 'rgba(20,16,30,0.3)', 0, 90, W, 3);
  },
  over(c, t){
    inkBanner(c, 58, 56, 9, 20, PURPLE, GOLD, GREY_INK, t);
    inkBanner(c, 174, 56, 9, 20, PURPLE, GOLD, GREY_INK, t);
    inkTorch(c, 100, 64, t, 0, GREY_INK); inkTorch(c, 139, 64, t, 1, GREY_INK);
    const r = rng(63);
    for (let i = 0; i < 3; i++) {
      const ph = r() * 300, y0 = 14 + r() * 20, x = ((ph + t * (1.4 + i * 0.3)) % 300) - 30, flap = Math.floor(t / 2 + i) % 2;
      P(c, '#2a2a34', x, y0, 1, 1); P(c, '#2a2a34', x - 2, y0 - flap, 2, 1); P(c, '#2a2a34', x + 1, y0 - flap, 2, 1);
    }
  }
},
{
  id: 'archive', name: 'Arcane Archive', tag: 'A candlelit library tower', panelSeed: 707,
  panel: { face: '#4a34a8', hi: '#7a5ce0', lo: '#2a1a78', lip: '#1c1258', lipLo: '#000000' },
  tex(c, x, y, w, h, r){
    const g = [[1,0,1,0,1, 0,1,1,1,0, 1,0,1,0,1], [0,1,1,1,0, 1,0,1,0,1, 0,1,1,1,0], [1,1,0,1,1, 0,1,1,1,0, 0,0,1,0,0]][Math.floor(r() * 3)];
    const gx = x + Math.floor(w / 2) - 2, gy = y + Math.floor(h / 2) - 1;
    g.forEach((v, i) => v && P(c, '#a088f0', gx + (i % 5), gy + Math.floor(i / 5)));
  },
  back(c){
    const r = rng(22);
    blocks(c, 0, 0, W, 92, 16, 6, ['#0a0614', '#181028', '#20163a', '#2c2048'], r, 0.08);
    // the window: frame, night sky in bands, moon, tracery
    const NIGHT = ['#0a1030', '#121c48', '#1c2c66', '#2a4080', '#3a5494'];
    for (let y = 0; y < 76; y++) for (let x = 94; x <= 146; x++) {
      if (inWin(x, y)) P(c, NIGHT[Math.min(4, Math.floor((y / 72) * 5))], x, y);
      else if (inWin(x - 3, y) || inWin(x + 3, y) || inWin(x, y + 3) || inWin(x, y - 3)) P(c, x < 120 ? '#6e60a0' : '#3c3060', x, y);
      else if (inWin(x - 4, y) || inWin(x + 4, y) || inWin(x, y + 4) || inWin(x, y - 4)) P(c, '#0a0614', x, y);
    }
    for (let i = 0; i < 26; i++) { const x = 101 + r() * 38, y = 4 + r() * 60; if (inWin(x, y)) P(c, r() < 0.3 ? '#ffffff' : '#a8b8f0', x, y); }
    ball(c, 128, 28, 6, 6, ['#a8a088', '#d8d0b0', '#f0e8c8', '#fffaf0'], -0.7, -0.3);
    P(c, '#b0a888', 126, 26, 2, 1); P(c, '#b0a888', 129, 30, 2, 2); P(c, '#c8c0a0', 125, 31, 1, 1);
    for (let y = 8; y < 72; y++) if (inWin(120, y)) { P(c, '#3c3060', 120, y); P(c, '#6e60a0', 119, y); }
    for (let x = 100; x <= 140; x++) if (inWin(x, 44)) { P(c, '#6e60a0', x, 43); P(c, '#3c3060', x, 44); }
    for (let a = 0; a < 6.28; a += 0.04) { P(c, '#6e60a0', 120 + Math.cos(a) * 7, 20 + Math.sin(a) * 7); P(c, '#3c3060', 120 + Math.cos(a) * 6, 21 + Math.sin(a) * 6); }
    P(c, '#0a0614', 93, 71, 54, 1); P(c, '#6e60a0', 94, 72, 52, 1); P(c, '#3c3060', 94, 73, 52, 1); P(c, '#0a0614', 94, 74, 52, 1);
    // bookshelves
    const WD = ['#2e160a', '#43220f', '#5a3018', '#784424', '#98603a'];
    for (const [sx, sw] of [[2, 44], [48, 44], [148, 44], [194, 44]]) stamp(c, '#0a0402', c => {
      P(c, '#140804', sx, 8, sw, 84);
      P(c, WD[3], sx, 4, 3, 88); P(c, WD[2], sx + sw - 3, 4, 3, 88); P(c, WD[4], sx, 4, 1, 88);
      P(c, WD[4], sx - 1, 3, sw + 2, 1); P(c, WD[3], sx - 1, 4, sw + 2, 3); P(c, WD[1], sx - 1, 7, sw + 2, 1);
      for (let y = 20; y <= 90; y += 14) {
        let x = sx + 4;
        P(c, '#0a0402', sx + 3, y - 12, sw - 6, 1);
        while (x < sx + sw - 5) {
          const roll = r(), bw = 2 + Math.floor(r() * 3), bh = 8 + Math.floor(r() * 4);
          if (roll < 0.06) { x += 2; continue; }
          if (roll < 0.12) {
            const pot = r() < 0.5 ? ['#0a3a20', '#1a8040', '#60e080', '#e0fff0'] : ['#3a0a30', '#80207a', '#e060d0', '#ffe0fa'];
            disc(c, '#0a0402', x + 2, y - 3, 3); ball(c, x + 2, y - 3, 2.5, 2.5, pot); P(c, '#c8b8a0', x + 1, y - 7, 2, 1); x += 6; continue;
          }
          if (roll < 0.17) { for (let i = 0; i < 3; i++) { P(c, '#0a0402', x - 1, y - 3 - i * 2, 8, 2); P(c, ['#a89870', '#d8c8a0', '#f4ead0'][i], x, y - 2 - i * 2, 6, 1); } x += 7; continue; }
          const base = ['#7a2030', '#20447a', '#7a6a20', '#206a30', '#5a207a', '#8a4420', '#2a5a5a'][Math.floor(r() * 7)];
          const lean = roll > 0.93;
          for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
            const xx = x + i + (lean ? Math.floor(j / 4) - 2 : 0), yy = y - bh + j;
            let col = i === 0 ? mix(base, '#ffffff', 0.25) : i === bw - 1 ? mix(base, '#000000', 0.45) : base;
            if (j === 0) col = mix(base, '#000000', 0.35);
            if ((j === 2 || j === bh - 3) && bw > 2) col = i === 0 ? '#f0d070' : '#b08830';
            P(c, col, xx, yy);
          }
          x += bw + (r() < 0.25 ? 1 : 0);
        }
        P(c, WD[4], sx + 3, y, sw - 6, 1); P(c, WD[3], sx + 3, y + 1, sw - 6, 1); P(c, WD[0], sx + 3, y + 2, sw - 6, 1);
      }
    });
    // checkered floor
    for (let y = 92; y < H; y++) for (let x = 0; x < W; x++) {
      const tile = (Math.floor(x / 12) + Math.floor((y - 92) / 6)) % 2, top = (y - 92) % 6 === 0;
      P(c, tile ? (top ? '#3a2e56' : '#2a2040') : (top ? '#241c36' : '#16102a'), x, y);
    }
    P(c, 'rgba(0,0,0,0.45)', 0, 92, W, 3);
    // the orrery stand
    stamp(c, '#140c02', c => { P(c, '#5a4010', 117, 80, 6, 10); P(c, '#a07020', 117, 80, 2, 10); P(c, '#3a2808', 112, 88, 16, 3); P(c, '#e8b840', 112, 88, 16, 1); });
    // moonlight on the floor, flat
    c.save(); c.globalCompositeOperation = 'lighter';
    poly(c, [[100, 92], [140, 92], [128, 160], [76, 160]], 'rgba(90,110,220,0.08)');
    c.restore();
  },
  over(c, t){
    [[105, 12], [136, 52], [112, 60], [131, 14], [108, 38]].forEach(([x, y], i) => { if ((t + i * 3) % 9 < 6) P(c, '#ffffff', x, y); });
    const a = t * 0.08;
    ([[16, 5, '#e8b840'], [11, 3.5, '#c89030'], [6, 2.5, '#f8d878']] as const).forEach(([rx, ry, col], i) => {
      for (let s = 0; s < 6.28; s += 0.1) { const x = 120 + Math.cos(s) * rx, y = 76 + Math.sin(s) * ry; P(c, Math.sin(s) > 0 ? col : mix(col, '#000000', 0.4), x, y); }
      const p = a * (1 + i * 0.6) + i * 2, px = 120 + Math.cos(p) * rx, py = 76 + Math.sin(p) * ry;
      disc(c, '#000000', Math.round(px), Math.round(py), 2);
      ball(c, px, py, 1.6, 1.6, [['#1a4a8a', '#4a9ae0', '#c0e8ff'], ['#8a2a1a', '#e06a3a', '#ffd0a0'], ['#2a6a2a', '#6ad06a', '#e0ffd0']][i]);
    });
    halo(c, 120, 76, 9, '255,200,80', 0.3);
    disc(c, '#5a2a00', 120, 76, 4); ball(c, 120, 76, 3, 3, ['#c87010', '#f8b830', '#fff0a0', '#ffffff']);
    [[24, 30], [66, 22], [176, 24], [214, 32], [92, 56], [150, 52]].forEach(([x, y], i) => {
      const b = Math.round(Math.sin(t * 0.35 + i * 1.3) * 1.5);
      halo(c, x + 1, y + b - 1, 9, '255,180,80', 0.25);
      P(c, '#2a1a10', x - 1, y + b - 1, 4, 8);
      P(c, '#e8e0c8', x, y + b, 2, 6); P(c, '#a89c80', x + 1, y + b + 1, 1, 5); P(c, '#fff8e8', x, y + b, 1, 1);
      P(c, (t + i) % 2 ? '#ff8a20' : '#ffb030', x, y + b - 3, 2, 3); P(c, '#fff4c0', x, y + b - 2, 1, 2);
    });
    const r = rng(23);
    for (let i = 0; i < 14; i++) {
      const ph = r() * 100, cx = 20 + r() * 200, sp = 0.5 + r() * 0.6;
      const y = 92 - ((ph + t * sp) % 90), x = cx + Math.sin((y + ph) * 0.12) * 4;
      P(c, '#3cb8e0', x - 1, y, 3, 1); P(c, '#3cb8e0', x, y - 1, 1, 3); P(c, '#e0fcff', x, y);
    }
  }
},
{
  id: 'frostpeak', name: 'Frostpeak Pass', tag: 'A mountain pass under the aurora', panelSeed: 909,
  panel: { face: '#8a96b4', hi: '#c8d4ec', lo: '#4a5478', lip: '#2e3658', lipLo: '#000000' },
  tex(c, x, y, w, h, r){
    for (let i = 0; i < 3; i++) P(c, '#c8d4ec', x + Math.floor(r() * w), y + Math.floor(r() * h));
    const sx = x + 3 + Math.floor(r() * (w - 10));
    P(c, '#e8f4ff', sx, y + 2, 4, 1); P(c, '#e8f4ff', sx + 3, y + 3, 3, 1);
  },
  back(c){
    const r = rng(33);
    bands(c, 0, 0, W, 84, ['#080c26', '#121842', '#232660', '#3c3478', '#644a8c', '#9a6496', '#d08494', '#f4aa8c']);
    for (let i = 0; i < 60; i++) {
      const x = Math.floor(r() * W), y = Math.floor(r() * 40), b = r();
      P(c, b > 0.8 ? '#ffffff' : b > 0.4 ? '#b8c0f0' : '#6870b0', x, y);
      if (b > 0.95) { P(c, '#6870b0', x - 1, y); P(c, '#6870b0', x + 1, y); P(c, '#6870b0', x, y - 1); P(c, '#6870b0', x, y + 1); }
    }
  },
  behind(c, t){
    // the aurora: a flat ribbon in three steps
    c.save(); c.globalCompositeOperation = 'lighter';
    const ph = t * 0.06;
    for (let x = 0; x < W; x++) {
      const y = Math.round(14 + Math.sin(x * 0.035 + ph) * 6 + Math.sin(x * 0.09 - ph * 1.3) * 3);
      const a = Math.sin(x * 0.05 + ph * 2) > 0 ? 1 : 0.7;
      c.fillStyle = `rgba(150,255,200,${0.3 * a})`; c.fillRect(x, y, 1, 2);
      c.fillStyle = `rgba(60,220,160,${0.2 * a})`; c.fillRect(x, y + 2, 1, 5);
      c.fillStyle = `rgba(60,200,180,${0.1 * a})`; c.fillRect(x, y + 7, 1, 6);
      if (x % 3 === 0) { c.fillStyle = `rgba(120,140,255,${0.12 * a})`; c.fillRect(x, y - 6, 1, 6); }
    }
    c.restore();
  },
  front(c){
    const r = rng(34);
    range(c, terrain([[30, 38], [96, 26], [158, 34], [214, 24]], 0.9, 8, 5), 80, ['#6c64a0', '#9a90c0'], ['#bcb8dc', '#f0ecfa'], 46, '#4a4278');
    P(c, 'rgba(240,170,160,0.16)', 0, 66, W, 14);
    range(c, terrain([[0, 52], [64, 44], [132, 54], [190, 46], [250, 56]], 0.75, 10, 9), 88, ['#262c5c', '#3a4480'], ['#8a96c8', '#d0daf4'], 58, '#10143a');
    const near = terrain([[-20, 70], [80, 68], [170, 72], [260, 66]], 0.08, 6, 13);
    for (let x = 0; x < W; x++) {
      const top = Math.round(near(x));
      P(c, '#0e1430', x, top - 1); P(c, '#e8eefc', x, top, 1, 2); P(c, '#a8b4d8', x, top + 2); P(c, '#141c40', x, top + 3, 1, 92 - top);
    }
    stamp(c, '#03060e', c => { for (let i = 0; i < 26; i++) { const x = Math.floor(r() * W); inkPine(c, x, Math.round(near(x)) + 3, 9 + Math.floor(r() * 8), ['#060c1a', '#0e1c30', '#1a2e44'], '#dce6fa'); } });
    bands(c, 0, 88, W, 72, ['#8496cc', '#a0b0dc', '#b8c6ea', '#d0daf4', '#e8eefc']);
    for (let y = 94; y < H; y += 6) for (let x = 0; x < W; x++) { const s = Math.sin(x * 0.07 + y * 1.3); if (s > 0.7) P(c, '#7888c0', x, y); else if (s > 0.55) P(c, '#ffffff', x, y - 1); }
    for (let i = 0; i < 30; i++) P(c, '#ffffff', Math.floor(r() * W), 92 + Math.floor(r() * 68));
  },
  over(c, t){
    const r = rng(35);
    for (let i = 0; i < 60; i++) {
      const x0 = r() * 240, y0 = r() * 94, far = r() < 0.6, sp = far ? 0.4 + r() * 0.3 : 0.9 + r() * 0.8;
      const y = (y0 + t * sp) % 94;
      const x = (x0 + Math.sin((t + y0) * 0.1) * (far ? 2 : 4) + 240) % 240;
      if (far) P(c, '#c8d0f0', x, y); else { P(c, '#ffffff', x, y, 2, 2); P(c, '#8a96c8', x + 1, y + 2, 1, 1); }
    }
  }
},
{
  id: 'emberforge', name: 'Emberforge', tag: 'A dwarven forge in a volcano', panelSeed: 1010,
  panel: { face: '#5a4a44', hi: '#8a7a6a', lo: '#2a201c', lip: '#3a2e28', lipLo: '#000000' },
  tex(c, x, y, w, h){
    [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]].forEach(([dx, dy]) => P(c, '#d8a030', x + dx, y + dy));
    P(c, '#2a201c', x + 3, y + Math.floor(h / 2), w - 6, 1); P(c, '#8a7a6a', x + 3, y + Math.floor(h / 2) + 1, w - 6, 1);
  },
  back(c){
    const r = rng(44), ROCK = ['#140a08', '#22120c', '#341c12', '#4a2a1a', '#663c22', '#8a5430'], INK = '#080404';
    // the cave wall: big flat boulders, each lit by the nearest fire, outlined in ink
    const lights = [[38, 50, 70], [202, 50, 70], [120, 74, 46], [120, 92, 90]];
    const G = 14, seeds: number[][] = [];
    for (let gy = -1; gy <= 98 / G + 1; gy++) for (let gx = -1; gx <= W / G + 1; gx++) seeds.push([gx * G + r() * G, gy * G + r() * G * 0.8]);
    const cell = (x: number, y: number): number => {
      let best = 0, bd = Infinity;
      for (let i = 0; i < seeds.length; i++) { const dx = seeds[i][0] - x, dy = (seeds[i][1] - y) * 1.4, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = i; } }
      return best;
    };
    const ids: number[] = [];
    for (let y = 0; y < 98; y++) for (let x = 0; x < W; x++) ids[y * W + x] = cell(x, y);
    const lit = seeds.map(([sx, sy]) => { let L = 0; for (const [lx, ly, rad] of lights) L += clamp(1 - Math.hypot(sx - lx, (sy - ly) * 1.3) / rad) ** 1.3; return clamp(0.12 + L * 0.7); });
    for (let y = 0; y < 98; y++) for (let x = 0; x < W; x++) {
      const id = ids[y * W + x];
      const edge = (x < W - 1 && ids[y * W + x + 1] !== id) || (y < 97 && ids[(y + 1) * W + x] !== id);
      const rim = (x > 0 && ids[y * W + x - 1] !== id) || (y > 0 && ids[(y - 1) * W + x] !== id);
      P(c, edge ? INK : tone(ROCK, lit[id] + (rim ? 0.2 : 0)), x, y);
    }
    // stalactites
    stamp(c, INK, c => {
      for (let i = 0; i < 16; i++) {
        const sx = Math.round(4 + i * 15 + r() * 6), len = 8 + r() * 14, w = 3 + r() * 3;
        for (let j = 0; j < len; j++) { const hw = Math.round(w * (1 - j / len)); for (let dx = -hw; dx <= hw; dx++) P(c, dx >= hw - 1 ? '#6a3a20' : dx < 0 ? '#1a0e0a' : '#2e1a10', sx + dx, j); }
      }
    });
    // the forge: chimney, brick furnace and its mouth
    stamp(c, INK, c => {
      P(c, '#2a201a', 108, 8, 12, 32); P(c, '#1a1210', 120, 8, 12, 32);
      for (let y = 12; y < 40; y += 5) P(c, '#0a0606', 108, y, 24, 1);
      blocks(c, 92, 40, 56, 50, 8, 4, ['#1e0e08', '#5a3224', '#784634', '#9a5e44'], r, 0.1);
      for (let y = 60; y < 90; y++) for (let x = 104; x <= 136; x++) {
        const dy = Math.min(0, y - 74), d = Math.hypot(x - 120, dy);
        if (d <= 11) P(c, '#0a0404', x, y);
        else if (d <= 13.5) P(c, Math.floor(Math.atan2(dy, x - 120) * 5) % 2 ? '#c88a5a' : '#7a4a2c', x, y);
        else if (d <= 14.5 && y < 75) P(c, INK, x, y);
      }
    });
    // anvil and weapon rack
    const ST = ['#2a2a34', '#44444e', '#66667a', '#9494a6', '#d0d0dc'];
    stamp(c, INK, c => {
      P(c, ST[4], 55, 76, 20, 1); P(c, ST[3], 55, 77, 25, 3); P(c, ST[2], 55, 79, 25, 1);
      for (let i = 0; i < 4; i++) P(c, ST[3], 54 - i, 77 + (i > 2 ? 1 : 0), 1, 2 - (i > 1 ? 1 : 0));
      P(c, ST[2], 63, 80, 11, 5); P(c, ST[1], 70, 80, 4, 5);
      P(c, ST[2], 59, 85, 19, 4); P(c, ST[1], 72, 85, 6, 4); P(c, ST[3], 59, 85, 19, 1);
      P(c, '#ff9040', 78, 77, 2, 2);
    });
    stamp(c, INK, c => {
      P(c, '#5a3018', 162, 58, 2, 32); P(c, '#5a3018', 188, 58, 2, 32);
      P(c, '#98603a', 160, 58, 32, 2); P(c, '#43220f', 160, 60, 32, 1); P(c, '#98603a', 160, 84, 32, 2);
      [167, 174, 181].forEach((bx, i) => {
        P(c, ST[2], bx, 61, 1, 21); P(c, ST[4], bx + 1, 61, 1, 21); P(c, ST[1], bx + 2, 61, 1, 21);
        P(c, '#ffffff', bx + 1, 70 + i * 3); P(c, GOLD[1], bx - 1, 62, 5, 1); P(c, GOLD[0], bx - 1, 63, 5, 1); P(c, '#5a3018', bx + 1, 59, 1, 3);
      });
    });
    // the rock lip above the floor
    for (let x = 0; x < W; x++) { P(c, '#e8743a', x, 91); P(c, '#8a4422', x, 92); P(c, '#341c12', x, 93, 1, 4); P(c, INK, x, 97); }
    P(c, '#0c0604', 0, 98, W, H - 98);
  },
  over(c, t){
    const LAVA = ['#8a1400', '#c83000', '#f05a10', '#ff8a20', '#ffb840', '#ffe890'];
    for (const lx of [36, 200]) {
      halo(c, lx + 4, 50, 26, '255,90,20', 0.18);
      P(c, '#3a0800', lx - 1, 10, 1, 77); P(c, '#3a0800', lx + 9, 10, 1, 77);
      for (let y = 10; y < 87; y++) for (let i = 0; i < 9; i++) {
        const v = 0.55 + Math.sin((y - t * 2.2) * 0.45 + i * 1.7) * 0.25 + (i > 1 && i < 7 ? 0.2 : -0.25);
        P(c, tone(LAVA, v), lx + i, y);
      }
      for (let i = 0; i < 4; i++) { const ph = (t * 0.7 + i * 5) % 8; ball(c, lx + 1 + i * 2.5, 86 - ph * 0.6, 1.5, 1.5, ['#c83000', '#ff8a20', '#ffe890']); }
    }
    for (let x = 0; x < W; x++) for (let y = 86; y < 91; y++) P(c, tone(LAVA, 0.55 + Math.sin(x * 0.25 - t * 0.9 + y * 1.4) * 0.3), x, y);
    for (let x = 0; x < W; x++) P(c, '#3a0800', x, 85);
    // fire in the forge mouth: flat tongues
    for (let x = 110; x <= 130; x++) {
      const hgt = 8 + Math.round((Math.sin(x * 0.9 + t * 1.3) + Math.sin(x * 0.37 - t * 0.8)) * 3);
      for (let y = 89; y > 89 - hgt; y--) {
        if (Math.hypot(x - 120, Math.min(0, y - 74)) > 10.5) continue;
        const k = (89 - y) / hgt;
        P(c, k < 0.35 ? LAVA[5] : k < 0.7 ? LAVA[3] : LAVA[1], x, y);
      }
    }
    halo(c, 120, 82, 22, '255,120,30', 0.3);
    for (const cx of [82, 158]) {
      for (let y = 10; y < 46; y += 3) { P(c, '#08080c', cx - 1, y - 1, 5, 4); P(c, '#44444e', cx, y, 3, 2); P(c, '#9494a6', cx, y, 1, 1); P(c, '#ff8040', cx + 2, y, 1, 2); }
      P(c, '#08080c', cx - 3, 45, 9, 6); P(c, '#44444e', cx - 2, 46, 7, 4); P(c, '#9494a6', cx - 2, 46, 7, 1);
    }
    const r = rng(45);
    for (let i = 0; i < 22; i++) {
      const sx = r() * 240, sp = 0.8 + r(), ph = r() * 80;
      const y = 84 - ((ph + t * sp) % 80), x = sx + Math.sin((t + ph) * 0.15) * 3;
      P(c, y < 30 ? '#c83000' : '#ffd060', x, y); if (y > 50) P(c, '#ff8a20', x, y + 1);
    }
  }
},
{
  id: 'elderwood', name: 'Elderwood Ruins', tag: 'An overgrown temple at dusk', panelSeed: 909,
  panel: { face: '#b08a3c', hi: '#e8c878', lo: '#6a5020', lip: '#4a3818', lipLo: '#000000' },
  tex(c, x, y, w, h, r){
    const corner = Math.floor(r() * 4), mx = corner % 2 ? x + w - 5 : x, my = corner > 1 ? y + h - 2 : y;
    P(c, '#2c6a3a', mx, my, 5, 2); P(c, '#4c9a4e', mx + (corner % 2 ? 1 : 0), my + (corner > 1 ? 0 : 0), 4, 1);
    P(c, '#2c6a3a', mx + (corner % 2 ? 3 : 0), my + (corner > 1 ? -1 : 2), 2, 1);
    for (let i = 0; i < 3; i++) P(c, '#e8c878', x + Math.floor(r() * w), y + Math.floor(r() * h));
  },
  back(c){
    const r = rng(55);
    bands(c, 0, 0, W, 80, ['#142436', '#1a3444', '#24504e', '#3c6c58', '#7a9a64', '#c8bc72', '#f0d688']);
    halo(c, 132, 66, 34, '255,220,140', 0.3);
    stamp(c, '#1e3434', c => {
      for (let x = -6; x < W + 6; x += 9) clump(c, x, 58 + Math.sin(x * 0.07) * 4, 7, ['#2e4a48', '#3a5a54', '#4a6c5e', '#6a8a6a'], r, 4);
      P(c, '#2e4a48', 0, 64, W, 28);
    });
    stamp(c, '#0a1a14', c => {
      for (let x = -6; x < W + 6; x += 11) clump(c, x, 70 + Math.sin(x * 0.05 + 2) * 3, 8, ['#16302a', '#1e3e30', '#2a5038', '#3c6840'], r, 5);
      P(c, '#16302a', 0, 76, W, 16);
    });
  },
  front(c){
    const r = rng(56), STN = ['#464c40', '#5e6656', '#7a826e', '#9aa28a', '#bcc4a8'], SINK = '#1e2218';
    c.save(); c.globalCompositeOperation = 'lighter';
    [[96, 10], [124, 7], [150, 12]].forEach(([x, w]) => poly(c, [[x, 0], [x + w, 0], [x + w + 36, 92], [x + 18, 92]], 'rgba(255,230,150,0.07)'));
    c.restore();
    // temple steps, columns and lintel
    stamp(c, SINK, c => {
      for (let s = 0; s < 3; s++) { const y = 80 + s * 4, x0 = 78 + (2 - s) * 4, x1 = 162 - (2 - s) * 4; P(c, STN[4], x0, y, x1 - x0, 1); P(c, STN[2], x0, y + 1, x1 - x0, 2); P(c, STN[1], x0, y + 3, x1 - x0, 1); }
    });
    const column = (cx: number, topY: number, broken: boolean): void => stamp(c, SINK, c => {
      const prof = [3, 4, 4, 3, 2, 2, 2, 1, 1, 0];
      for (let y = topY; y < 80; y++) for (let i = 0; i < 10; i++) {
        if (broken && y < topY + 5 && hash(i, y, 3) < (topY + 5 - y) / 5) continue;
        P(c, STN[(i === 3 || i === 6) && y % 9 !== 0 ? Math.max(0, prof[i] - 1) : prof[i]], cx + i, y);
      }
      if (!broken) { P(c, STN[4], cx - 2, topY - 3, 14, 1); P(c, STN[3], cx - 2, topY - 2, 14, 2); P(c, STN[1], cx - 1, topY, 12, 1); }
      P(c, STN[4], cx - 2, 77, 14, 1); P(c, STN[2], cx - 2, 78, 14, 2);
    });
    column(92, 40, false); column(138, 54, true);
    stamp(c, SINK, c => {
      for (let y = 33; y < 38; y++) for (let x = 88; x < 124; x++) { if (x > 118 && y < 33 + (x - 118)) continue; P(c, y === 33 ? STN[4] : y < 36 ? STN[3] : STN[2], x, y); }
      for (let x = 89; x < 118; x += 4) P(c, STN[1], x, 35, 2, 1);
    });
    P(c, SINK, 99, 52, 1, 6); P(c, SINK, 100, 57, 1, 4); P(c, SINK, 144, 64, 1, 7);
    stamp(c, IVY_INK, c => {
      [[97, 40, 4], [140, 56, 3], [95, 66, 5], [142, 70, 4], [100, 34, 6], [84, 81, 8], [150, 82, 6]].forEach(([x, y, w]) => { for (let i = 0; i < w; i++) for (let j = 0; j < 3; j++) if (hash(i, j, x) > 0.3) P(c, IVY[hash(j, i, y) > 0.6 ? 2 : hash(j, i, y) > 0.25 ? 1 : 0], x + i, y + j); });
      [[96, 38, 16], [108, 38, 22], [118, 38, 12], [143, 56, 14]].forEach(([vx, vy, len]) => { for (let j = 0; j < len; j++) { const x = vx + Math.round(Math.sin(j * 0.5) * 0.8); P(c, IVY[0], x, vy + j); if (j % 3 === 1) { P(c, IVY[1], x + 1, vy + j); P(c, IVY[2], x - 1, vy + j + 1); } } });
    });
    // the great trees framing the ruins
    const BARK = ['#1e140c', '#2e2014', '#42301e', '#5a442a', '#76603a'];
    for (const [tx, tw, side] of [[0, 22, 1], [218, 22, -1]]) stamp(c, '#0a0604', c => {
      for (let y = 0; y < 92; y++) {
        const flare = y > 74 ? Math.round((y - 74) ** 1.4 * 0.5) : 0;
        for (let x = tx - (side < 0 ? flare : 0); x < tx + tw + (side > 0 ? flare : 0); x++) {
          const u = (x - tx) / tw, lit = side > 0 ? u : 1 - u;
          const streak = hash(x, Math.floor(y / 7), 12) < 0.25 ? -1 : 0;
          let v = (lit > 0.8 ? 3 : lit > 0.45 ? 2 : 1) + streak;
          if ((side > 0 && x === tx + tw + flare - 1) || (side < 0 && x === tx - flare)) v = 4;
          P(c, BARK[clamp(v, 0, 4)], x, y);
        }
      }
    });
    const LEAF = ['#14301c', '#1e4426', '#2c5c30', '#447a3c', '#68a04c'];
    stamp(c, '#050e08', c => {
      for (let i = 0; i < 18; i++) { const x = i < 9 ? i * 9 - 4 : 240 - (i - 9) * 9 + 4; clump(c, x, 4 + (i % 3) * 5, 9, LEAF, r, 5); }
      [[86, 0], [120, -3], [154, 0]].forEach(([x, y]) => clump(c, x, y, 8, LEAF, r, 4));
    });
    bands(c, 0, 90, W, 70, ['#16301a', '#1e3c1e', '#284a24', '#32582a', '#3c662e']);
    P(c, '#0a1a0e', 0, 90, W, 1);
    for (let i = 0; i < 70; i++) { const x = Math.floor(r() * W), y = 93 + Math.floor(r() * 66); P(c, '#4c7a34', x, y - 2, 1, 3); P(c, '#6a9a44', x + 1, y - 1, 1, 2); P(c, '#16301a', x - 1, y, 1, 1); }
    for (let i = 0; i < 18; i++) P(c, ['#f0f0e0', '#f0a8c8', '#f8e070'][i % 3], Math.floor(r() * W), 92 + Math.floor(r() * 68));
  },
  over(c, t){
    const r = rng(57);
    for (let i = 0; i < 16; i++) {
      const x0 = 24 + r() * 192, y0 = 20 + r() * 66;
      const x = x0 + Math.sin(t * 0.13 + i) * 6, y = y0 + Math.cos(t * 0.11 + i * 2) * 4;
      if ((t + i * 3) % 12 >= 7) continue;
      halo(c, x, y, 3, '200,255,100', 0.5); P(c, '#f0ffa0', x, y);
    }
    for (let i = 0; i < 6; i++) {
      const ph = r() * 100, sx = 30 + r() * 180;
      const y = (ph + t * 0.5) % 92, x = sx + Math.sin((y + ph) * 0.1) * 8;
      P(c, i % 2 ? '#c8a040' : '#6a9a44', x, y, 2, 1); P(c, i % 2 ? '#8a6a20' : '#447a3c', x + (Math.floor(y / 4) % 2), y + 1);
    }
  }
}
];

export const STAGE_IDS = ['colosseum', ...DRAFTS.map(d => d.id)];
const built = new Map<string, Stage>();
/** The stage with this id, built on first use (falls back to the Colosseum). */
export function getStage(id: string): Stage {
  let s = built.get(id);
  if (!s) {
    const d = DRAFTS.find(x => x.id === id);
    s = d ? new DraftStage(d) : new Colosseum();
    built.set(s.id, s);
  }
  return s;
}
