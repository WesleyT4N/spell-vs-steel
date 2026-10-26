// The stages besides the Grand Colosseum, ported from the arena drafts (art/arenas.html).
// Every stage keeps the same grid and red/blue panel edges; only the scenery and panel faces change.
import { P, W, H, rng, clamp, shade, vgrad, vnoise, hash, sphere, glow, mix, layer, type Ctx } from '../engine/gfx';
import { Colosseum, banner, cloud, stoneTex, torch, type PanelLook, type Stage } from './arena';

const STONE: PanelLook = { face: '#bcbcbc', hi: '#fcfcfc', lo: '#7c7c7c', lip: '#7c7c7c', lipLo: '#000000' };

// ---------- backdrop toolkit (the parts the Colosseum doesn't need) ----------
const fbm = (x: number, y: number, s: number): number => (vnoise(x, y, 16, s) + vnoise(x, y, 8, s + 1) * 0.5 + vnoise(x, y, 4, s + 2) * 0.25) / 1.75;
function tint(c: Ctx, x: number, y: number, w: number, h: number, rgba: string): void { c.fillStyle = rgba; c.fillRect(x, y, w, h); }
function poly(c: Ctx, pts: number[][], fill: string): void {
  c.fillStyle = fill; c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath(); c.fill();
}
/** A ridge line made of straight-sided peaks, roughened with noise. */
function terrain(peaks: number[][], k: number, rough: number, seed: number): (x: number) => number {
  const out: number[] = [];
  for (let x = -1; x <= W + 1; x++) {
    let t = Infinity;
    for (const [px, py] of peaks) t = Math.min(t, py + Math.abs(x - px) * k);
    out[x + 1] = t + (fbm(x * 2, 0, seed) - 0.5) * rough;
  }
  return x => out[clamp(Math.round(x) + 1, 0, W + 2)];
}
/** A shaded mountain range, lit from the right (setting sun). */
function range(c: Ctx, prof: (x: number) => number, bottom: number, rock: string[], snow: string[] | null, snowline: number, seed: number): void {
  for (let x = 0; x < W; x++) {
    const top = Math.round(prof(x)), s = prof(x + 1) - prof(x - 1);
    for (let y = Math.max(0, top); y < bottom; y++) {
      const v = (s > 0 ? 0.7 : 0.32) + clamp(s * 0.15, -0.2, 0.2) + (vnoise(x * 1.5, y * 0.4, 5, seed) - 0.5) * 0.35 - ((y - top) / (bottom - top + 1)) * 0.25;
      const isSnow = snow && y < snowline + (vnoise(x, y, 4, seed + 5) - 0.5) * 10 - (s > 0 ? 0 : 3);
      P(c, shade(isSnow ? snow : rock, v + (y === top ? 0.25 : 0), x, y), x, y);
    }
  }
}
function pine(c: Ctx, x: number, base: number, h: number, ramp: string[], snow: string): void {
  P(c, ramp[0], x, base - 2, 1, 3);
  const tiers = Math.max(2, Math.floor(h / 4));
  for (let i = 0; i < tiers; i++) {
    const ty = base - h + i * Math.floor((h - 2) / tiers), th = 5;
    for (let j = 0; j < th; j++) {
      const hw = Math.round((j + 1) * (1 + i * 0.6) * 0.55);
      for (let dx = -hw; dx <= hw; dx++) P(c, dx === -hw ? ramp[0] : dx > 0 ? ramp[2] : ramp[1], x + dx, ty + j);
      if (snow && j === 0) P(c, snow, x, ty);
      if (snow && j === th - 1) { P(c, snow, x - hw, ty + j); P(c, snow, x + hw - 1, ty + j, 2, 1); }
    }
  }
}
function foliage(c: Ctx, cx: number, cy: number, r: number, ramp: string[], rr: () => number, n: number): void {
  for (let i = 0; i < n; i++) {
    const a = rr() * 6.28, d = Math.sqrt(rr()) * r;
    const R = 3 + rr() * 4;
    sphere(c, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7, R, R * 0.8, ramp, 0.45, -0.7);
  }
}
function bricks(c: Ctx, x0: number, y0: number, w: number, h: number, bw: number, bh: number, ramp: string[], mortar: string, r: () => number, tintFn?: (x: number, y: number) => number): void {
  const top = ramp[ramp.length - 1];
  for (let row = 0, y = y0; y < y0 + h; row++, y += bh) {
    const off = (row % 2) * Math.floor(bw / 2);
    for (let x = x0 - off; x < x0 + w; x += bw) {
      const v = 0.3 + r() * 0.35;
      for (let yy = y; yy < Math.min(y + bh, y0 + h); yy++) for (let xx = Math.max(x, x0); xx < Math.min(x + bw, x0 + w); xx++) {
        let col: string;
        if (yy === y + bh - 1 || xx === x + bw - 1) col = mortar;
        else if (yy === y) col = top;
        else if (yy === y + bh - 2 || xx === x + bw - 2) col = ramp[0];
        else col = shade(ramp, v + (vnoise(xx, yy, 3, 7) - 0.5) * 0.35 + (tintFn ? tintFn(xx, yy) : 0), xx, yy);
        P(c, col, xx, yy);
      }
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

const DRAFTS: StageDef[] = [
{
  id: 'courtyard', name: 'Castle Courtyard', tag: 'Flagstones inside the keep', panelSeed: 909,
  panel: STONE,
  tex: stoneTex,
  back(c){
    vgrad(c, 0, 0, W, 70, ['#2c58c0', '#3c70d4', '#5a90e4', '#82b2ee', '#b4d4f6', '#dceaf8']);
    glow(c, 40, 12, 26, '255,240,200', .5); sphere(c, 40, 12, 5, 5, ['#f8d878', '#fce8b0', '#fff8e0', '#ffffff']);
    range(c, terrain([[0, 56], [70, 50], [150, 54], [230, 48]], .25, 6, 21), 80, ['#4a7a90', '#5a8c9c', '#6c9ea8', '#86b2b4', '#a2c6c0'], null, 0, 21);
    // distant keep
    const KS = ['#5a6a8a', '#6e7e9c', '#8494b0', '#9eacc4'];
    for (let y = 22; y < 62; y++) for (let x = 108; x < 132; x++) P(c, shade(KS, .3 + (x - 108) / 24 * .5 + (vnoise(x, y, 2, 3) - .5) * .2, x, y), x, y);
    for (let x = 106; x < 134; x += 4) for (let y = 18; y < 22; y++) P(c, shade(KS, .5 + (x - 106) / 28 * .4, x, y), x, y, 3, 1);
    [[100, 34], [136, 30]].forEach(([tx, ty]) => { for (let y = ty; y < 62; y++) for (let x = tx; x < tx + 8; x++) P(c, shade(KS, .25 + (x - tx) / 8 * .6, x, y), x, y); for (let j = 0; j < 10; j++){ const hw = Math.round((j + 1) * .45); for (let dx = -hw; dx <= hw; dx++) P(c, dx > 0 ? '#5a6488' : '#46507a', tx + 4 + dx, ty - 10 + j); } P(c, '#7c2c98', tx + 4, ty - 15, 1, 5); P(c, '#a050c0', tx + 5, ty - 15, 3, 2); });
    for (let y = 28; y < 56; y += 7) { P(c, '#2a3048', 116, y, 2, 3); P(c, '#2a3048', 123, y, 2, 3); }
    tint(c, 0, 20, W, 50, 'rgba(200,225,250,0.18)');
  },
  behind(c, t){ [[20, 8, .9], [130, 4, .7], [210, 14, .6]].forEach(([cx, cy, s], i) => cloud(c, ((cx + t * .18 * (1 + i * .3)) % 300) - 30, cy, s)); },
  front(c){
    const r = rng(62), WALL = ['#46464e', '#5c5c66', '#74747e', '#8c8c96', '#a8a8b0', '#c4c4cc'];
    // curtain wall
    bricks(c, 0, 52, W, 40, 10, 5, WALL, '#36363e', r, (_x, y) => -((y - 52) / 40) * .2);
    for (let x = 0; x < W; x += 8){ for (let y = 46; y < 52; y++) for (let i = 0; i < 5; i++) P(c, y === 46 ? WALL[5] : shade(WALL, i < 1 ? .85 : i > 3 ? .2 : .55, x + i, y), x + i, y); }
    for (let x = 0; x < W; x++){ P(c, WALL[5], x, 52); P(c, WALL[0], x, 53); }
    tint(c, 0, 54, W, 2, 'rgba(0,0,0,0.25)');
    // ivy
    [[30, 54, 26], [74, 56, 18], [160, 54, 30], [200, 58, 16]].forEach(([vx, vy, len], k) => {
      for (let j = 0; j < len; j++){ const x = vx + Math.round(Math.sin(j * .4 + k) * 2); for (let i = -2; i <= 2; i++) if (hash(i, j, vx) > .45) P(c, shade(['#1e3a18', '#2e5a22', '#4a8030', '#78b040'], .3 + hash(j, i, k) * .7, x + i, vy + j), x + i, vy + j); }
    });
    // gatehouse
    for (let y = 36; y < 92; y++) for (let x = 96; x < 144; x++) P(c, shade(WALL, .25 + (x - 96) / 48 * .5 + (vnoise(x, y, 3, 8) - .5) * .25 - (y % 6 === 0 ? .2 : 0), x, y), x, y);
    for (let x = 94; x < 146; x += 7) for (let y = 30; y < 36; y++) for (let i = 0; i < 4; i++) P(c, y === 30 ? WALL[5] : shade(WALL, i < 1 ? .85 : .45, x + i, y), x + i, y);
    P(c, WALL[5], 94, 36, 52, 1); P(c, WALL[1], 94, 37, 52, 1);
    for (let y = 58; y < 92; y++) for (let x = 106; x <= 134; x++){
      const dy = Math.min(0, y - 72), d = Math.hypot(x - 120, dy);
      if (d <= 12) P(c, shade(['#0c0a10', '#18141c', '#262028'], (y - 60) / 32, x, y), x, y);
      else if (d <= 14.5 && y < 73) P(c, (Math.floor(Math.atan2(dy, x - 120) * 5) % 2) ? WALL[5] : WALL[2], x, y);
    }
    for (let x = 110; x < 132; x += 3) for (let y = 61; y < 86; y++) if (Math.hypot(x - 120, Math.min(0, y - 72)) < 12) { P(c, '#3c3c46', x, y); P(c, '#7c7c88', x, y, 1, 1); }
    for (let y = 64; y < 86; y += 4) for (let x = 109; x < 132; x++) if (Math.hypot(x - 120, Math.min(0, y - 72)) < 12) P(c, x % 3 ? '#4a4a56' : '#8c8c98', x, y);
    for (let x = 109; x < 132; x += 3) { P(c, '#8c8c98', x, 86, 1, 2); P(c, '#4a4a56', x, 88, 1, 1); }
    [[108, 44], [128, 44]].forEach(([x, y]) => { P(c, '#16141c', x, y, 3, 7); P(c, WALL[5], x - 1, y - 1, 5, 1); });
    sphere(c, 120, 47, 5, 5, ['#8a6a20', '#c89830', '#f0c850', '#fff0a0']); P(c, '#7c2c98', 118, 45, 5, 4); P(c, '#f8d070', 120, 46, 1, 2);
    // round towers
    const ROOF = ['#1e2438', '#2c3450', '#3c4868', '#4e5c80', '#6474a0'];
    [[6, 30], [204, 30]].forEach(([tx, tw]) => {
      for (let y = 26; y < 92; y++) for (let x = tx; x < tx + tw; x++){
        const u = (x - tx) / (tw - 1) * 2 - 1, lit = clamp(-u * .6 + Math.sqrt(1 - u * u) * .6);
        const row = Math.floor((y - 26) / 5), off = row % 2 ? 3 : 0, mortar = (y - 26) % 5 === 4 || ((x - tx + off) % 6 === 5 && Math.abs(u) < .85);
        P(c, mortar ? '#36363e' : shade(WALL, lit * .9 + (vnoise(x, y, 2, 5) - .5) * .2, x, y), x, y);
      }
      for (let i = 0; i < 5; i++){ const bx = tx + 1 + i * 6; for (let y = 21; y < 26; y++) for (let x = bx; x < bx + 4; x++){ const u = (x - tx) / (tw - 1) * 2 - 1; P(c, y === 21 ? WALL[5] : shade(WALL, clamp(-u * .6 + .5), x, y), x, y); } }
      for (let x = tx - 1; x <= tx + tw; x++){ P(c, WALL[5], x, 26); P(c, WALL[0], x, 27); }
      [[tx + 13, 40], [tx + 13, 62]].forEach(([wx, wy]) => { P(c, '#16141c', wx, wy, 3, 8); P(c, '#16141c', wx + 1, wy - 1, 1, 1); P(c, WALL[5], wx - 1, wy + 8, 5, 1); });
      const cx = tx + tw / 2;
      for (let j = 0; j < 22; j++){
        const hw = (j + 1) / 22 * (tw / 2 + 3);
        for (let dx = -Math.ceil(hw); dx <= Math.ceil(hw); dx++){
          if (Math.abs(dx) > hw) continue;
          const u = dx / hw, tile = (j % 3 === 2) ? -.25 : 0, scal = ((dx + (Math.floor(j / 3) % 2) * 2) % 4 === 0) ? -.15 : 0;
          P(c, shade(ROOF, clamp(-u * .55 + .45 + tile + scal), cx + dx, -1 + j), cx + dx, -1 + j);
        }
      }
      P(c, '#3a2410', cx, -6, 1, 6); P(c, '#a050c0', cx + 1, -6, 5, 2); P(c, '#7c2c98', cx + 1, -4, 3, 1);
    });
    // flagstones
    for (let y = 90; y < H; y++) for (let x = 0; x < W; x++){
      const row = Math.floor((y - 90) / 7), off = (row * 9) % 16, cellX = Math.floor((x + off) / 16), seam = (y - 90) % 7 === 6 || (x + off) % 16 === 15;
      const v = .35 + hash(cellX, row, 4) * .35 + (vnoise(x, y, 3, 9) - .5) * .2;
      P(c, seam ? '#4a4a52' : shade(['#6e6c70', '#8a888a', '#a4a2a0', '#bcbab4'], (y - 90) % 7 === 0 ? v + .3 : v, x, y), x, y);
    }
    for (let i = 0; i < 30; i++){ const x = r() * W, y = 91 + r() * 69; P(c, '#5a8a3a', x, y, 2, 1); P(c, '#7aa84c', x, y - 1); }
    tint(c, 0, 90, W, 4, 'rgba(20,20,40,0.3)');
  },
  over(c, t){
    banner(c, 58, 56, 9, 20, ['#3a1048', '#5a1a70', '#7c2c98', '#a050c0'], '#f8d070', t);
    banner(c, 174, 56, 9, 20, ['#3a1048', '#5a1a70', '#7c2c98', '#a050c0'], '#f8d070', t);
    torch(c, 100, 64, t, 0); torch(c, 139, 64, t, 1);
    const r = rng(63);
    for (let i = 0; i < 3; i++){
      const ph = r() * 300, y0 = 14 + r() * 20, x = ((ph + (t * (1.4 + i * .3))) % 300) - 30, flap = Math.floor(t / 2 + i) % 2;
      P(c, '#2a2a34', x, y0, 1, 1); P(c, '#2a2a34', x - 2, y0 - flap, 2, 1); P(c, '#2a2a34', x + 1, y0 - flap, 2, 1);
    }
  }
},
{
  id: 'archive', name: 'Arcane Archive', tag: 'A candlelit library tower', panelSeed: 707,
  panel: { face: '#4428bc', hi: '#6844fc', lo: '#0000bc', lip: '#0000bc', lipLo: '#000000' },
  tex(c, x, y, w, h, r){
    const g = [[1,0,1,0,1, 0,1,1,1,0, 1,0,1,0,1], [0,1,1,1,0, 1,0,1,0,1, 0,1,1,1,0], [1,1,0,1,1, 0,1,1,1,0, 0,0,1,0,0]][Math.floor(r() * 3)];
    const gx = x + Math.floor(w / 2) - 2, gy = y + Math.floor(h / 2) - 1;
    g.forEach((v, i) => v && P(c, '#9878f8', gx + (i % 5), gy + Math.floor(i / 5)));
  },
  back(c){
    const r = rng(22);
    bricks(c, 0, 0, W, 92, 16, 6, ['#120c20', '#1a1230', '#22183c', '#2c2048', '#3a2c5c'], '#0a0614', r, x => -Math.abs(x - 120) / 120 * .3);
    for (let y = 0; y < 76; y++) for (let x = 96; x <= 144; x++){
      if (inWin(x, y)) P(c, shade(['#0a1030', '#121c48', '#1c2c66', '#2a4080', '#3a5494'], y / 72, x, y), x, y);
      else if (inWin(x - 3, y) || inWin(x + 3, y) || inWin(x, y + 3) || inWin(x, y - 3)) P(c, shade(['#2a2048', '#3c3060', '#544680', '#6e60a0'], x < 120 ? .85 : .3, x, y), x, y);
    }
    for (let i = 0; i < 26; i++){ const x = 101 + r() * 38, y = 4 + r() * 60; if (inWin(x, y)) P(c, r() < .3 ? '#ffffff' : '#a8b8f0', x, y); }
    sphere(c, 128, 28, 6, 6, ['#8a8470', '#c8c0a0', '#f0e8c8', '#fffaf0'], -.7, -.3);
    P(c, '#b0a888', 126, 26, 2, 1); P(c, '#b0a888', 129, 30, 2, 2); P(c, '#c8c0a0', 125, 31, 1, 1);
    for (let y = 8; y < 72; y++) if (inWin(120, y)) { P(c, '#4a3e70', 120, y); P(c, '#6e60a0', 119, y); }
    for (let x = 100; x <= 140; x++) if (inWin(x, 44)) { P(c, '#6e60a0', x, 43); P(c, '#4a3e70', x, 44); }
    for (let a = 0; a < 6.28; a += .04){ P(c, '#6e60a0', 120 + Math.cos(a) * 7, 20 + Math.sin(a) * 7); P(c, '#3a2e5a', 120 + Math.cos(a) * 6, 21 + Math.sin(a) * 6); }
    P(c, '#3a2c5c', 94, 72, 52, 2); P(c, '#6e60a0', 94, 72, 52, 1); P(c, '#1a1230', 94, 74, 52, 1);
    const W8 = ['#1e0e06', '#2e160a', '#43220f', '#5a3018', '#784424', '#98603a'];
    [[2, 44], [48, 44], [148, 44], [194, 44]].forEach(([sx, sw]) => {
      for (let y = 4; y < 92; y++) for (let x = sx; x < sx + sw; x++){
        const edge = x < sx + 3 || x >= sx + sw - 3 || y < 8;
        if (edge){ const v = x < sx + 3 ? .75 - (x - sx) * .15 : x >= sx + sw - 3 ? .2 : .55 + (y === 4 ? .4 : 0); P(c, shade(W8, v + (vnoise(x, y * 4, 3, 2) - .5) * .2, x, y), x, y); }
        else P(c, shade(['#0a0402', '#140804', '#1e0e06'], .3 + (vnoise(x, y, 6, 3)) * .5, x, y), x, y);
      }
      P(c, W8[5], sx - 1, 3, sw + 2, 1); P(c, W8[3], sx - 1, 4, sw + 2, 1);
      for (let y = 20; y <= 90; y += 14){
        let x = sx + 4;
        while (x < sx + sw - 5){
          const roll = r(), bw = 2 + Math.floor(r() * 3), bh = 8 + Math.floor(r() * 4);
          if (roll < .06){ x += 2; continue; }
          if (roll < .12){ sphere(c, x + 2, y - 3, 2.5, 3, r() < .5 ? ['#0a3a20', '#1a8040', '#60e080', '#e0fff0'] : ['#3a0a30', '#80207a', '#e060d0', '#ffe0fa']); P(c, '#c8b8a0', x + 1, y - 7, 2, 1); x += 6; continue; }
          if (roll < .17){ for (let i = 0; i < 3; i++) P(c, shade(['#a89870', '#d8c8a0', '#f4ead0'], .5 + i * .2, x, y), x, y - 2 - i * 2, 6, 2); x += 7; continue; }
          const base = ['#6a1a2a', '#1a3a6a', '#6a5a1a', '#1a5a2a', '#4a1a6a', '#7a3a1a', '#2a4a4a'][Math.floor(r() * 7)];
          const lean = roll > .93;
          for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++){
            const xx = x + i + (lean ? Math.floor(j / 4) - 2 : 0), yy = y - bh + j;
            let col = i === 0 ? mix(base, '#ffffff', .2) : i === bw - 1 ? mix(base, '#000000', .45) : base;
            if (j === 0) col = mix(base, '#000000', .3);
            if ((j === 2 || j === bh - 3) && r() < .9 && bw > 2) col = i === 0 ? '#f0d070' : '#b08830';
            P(c, col, xx, yy);
          }
          x += bw + (r() < .25 ? 1 : 0);
        }
        P(c, W8[5], sx + 3, y, sw - 6, 1); P(c, W8[3], sx + 3, y + 1, sw - 6, 1); P(c, W8[0], sx + 3, y + 2, sw - 6, 1);
      }
    });
    for (let y = 92; y < H; y++) for (let x = 0; x < W; x++){
      const tile = (Math.floor(x / 12) + Math.floor((y - 92) / 6)) % 2;
      P(c, shade(tile ? ['#1a1428', '#241c36', '#30264a'] : ['#100c1c', '#18122a', '#221a38'], .4 + (vnoise(x, y, 4, 8) - .5) * .5, x, y), x, y);
    }
    tint(c, 0, 92, W, 3, 'rgba(0,0,0,0.4)');
    P(c, '#5a4010', 117, 80, 6, 10); P(c, '#a07020', 117, 80, 2, 10); P(c, '#3a2808', 112, 88, 16, 3); P(c, '#e8b840', 112, 88, 16, 1);
  },
  front(c){
    c.save(); c.globalCompositeOperation = 'lighter';
    poly(c, [[100, 30], [140, 30], [124, 98], [70, 98]], 'rgba(90,110,220,0.10)');
    poly(c, [[106, 46], [134, 46], [112, 98], [80, 98]], 'rgba(120,140,255,0.07)');
    c.restore();
  },
  over(c, t){
    [[105, 12], [136, 52], [112, 60], [131, 14], [108, 38]].forEach(([x, y], i) => { if ((t + i * 3) % 9 < 6) P(c, '#ffffff', x, y); });
    const a = t * .08;
    ([[16, 5, '#e8b840'], [11, 3.5, '#c89030'], [6, 2.5, '#f8d878']] as const).forEach(([rx, ry, col], i) => {
      for (let s = 0; s < 6.28; s += .1){ const x = 120 + Math.cos(s) * rx, y = 76 + Math.sin(s) * ry; P(c, Math.sin(s) > 0 ? col : mix(col, '#000000', .4), x, y); }
      const p = a * (1 + i * .6) + i * 2; sphere(c, 120 + Math.cos(p) * rx, 76 + Math.sin(p) * ry, 1.6, 1.6, [['#1a4a8a', '#4a9ae0', '#c0e8ff'], ['#8a2a1a', '#e06a3a', '#ffd0a0'], ['#2a6a2a', '#6ad06a', '#e0ffd0']][i]);
    });
    glow(c, 120, 76, 10, '255,200,80', .35); sphere(c, 120, 76, 3, 3, ['#c87010', '#f8b830', '#fff0a0', '#ffffff']);
    [[24, 30], [66, 22], [176, 24], [214, 32], [92, 56], [150, 52]].forEach(([x, y], i) => {
      const b = Math.round(Math.sin(t * .35 + i * 1.3) * 1.5);
      glow(c, x + 1, y + b - 1, 12, '255,180,80', .3);
      P(c, '#e8e0c8', x, y + b, 2, 6); P(c, '#a89c80', x + 1, y + b + 1, 1, 5); P(c, '#fff8e8', x, y + b, 1, 1); P(c, '#e8e0c8', x - 1, y + b + 2, 1, 2);
      P(c, (t + i) % 2 ? '#ff8a20' : '#ffb030', x, y + b - 3, 2, 3); P(c, '#fff4c0', x, y + b - 2, 1, 2);
    });
    const r = rng(23);
    for (let i = 0; i < 14; i++){
      const ph = r() * 100, cx = 20 + r() * 200, sp = .5 + r() * .6;
      const y = 92 - ((ph + (t * sp)) % 90), x = cx + Math.sin((y + ph) * .12) * 4;
      glow(c, x, y, 4, '80,220,255', .4); P(c, '#c0f8ff', x, y);
    }
  }
},
{
  id: 'frostpeak', name: 'Frostpeak Pass', tag: 'A mountain pass under the aurora', panelSeed: 909,
  panel: { face: '#7c7c7c', hi: '#bcbcbc', lo: '#004058', lip: '#004058', lipLo: '#000000' },
  tex(c, x, y, w, h, r){ for (let i = 0; i < 5; i++) P(c, '#bcbcbc', x + r() * w, y + 1 + r() * (h - 2)); const sx = x + 4 + r() * 20; P(c, '#a4e4fc', sx, y + 3, 4, 1); P(c, '#a4e4fc', sx + 3, y + 4, 3, 1); },
  back(c){
    const r = rng(33);
    vgrad(c, 0, 0, W, 84, ['#080c26', '#121842', '#232660', '#3c3478', '#644a8c', '#9a6496', '#d08494', '#f4aa8c']);
    for (let i = 0; i < 60; i++){ const x = r() * W, y = r() * 40, b = r(); P(c, b > .8 ? '#ffffff' : b > .4 ? '#b8c0f0' : '#6870b0', x, y); if (b > .95){ P(c, '#6870b0', x - 1, y); P(c, '#6870b0', x + 1, y); P(c, '#6870b0', x, y - 1); P(c, '#6870b0', x, y + 1); } }
  },
  behind(c, t){
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let x = 0; x < W; x++){
      const ph = t * .06;
      const y = 14 + Math.sin(x * .035 + ph) * 6 + Math.sin(x * .09 - ph * 1.3) * 3;
      const a = .18 + Math.sin(x * .05 + ph * 2) * .08;
      for (let j = 0; j < 14; j++){ c.fillStyle = `rgba(${j < 3 ? '160,255,200' : '60,220,160'},${(a * (1 - j / 14)).toFixed(3)})`; c.fillRect(x, Math.round(y) + j, 1, 1); }
      if (x % 3 === 0){ c.fillStyle = `rgba(120,140,255,${(a * .5).toFixed(3)})`; c.fillRect(x, Math.round(y) - 6, 1, 6); }
    }
    c.restore();
  },
  front(c){
    const r = rng(34);
    range(c, terrain([[30, 38], [96, 26], [158, 34], [214, 24]], .9, 8, 5), 80, ['#5a5488', '#746ca0', '#9086b8', '#b0a4cc', '#d0c4e0'], ['#a8a4d0', '#c8c4e4', '#e4e0f4', '#fcf8ff'], 46, 5);
    tint(c, 0, 62, W, 20, 'rgba(240,170,160,0.16)');
    range(c, terrain([[0, 52], [64, 44], [132, 54], [190, 46], [250, 56]], .75, 10, 9), 88, ['#1c2048', '#262c5c', '#323a72', '#465088', '#5c68a0'], ['#8a96c8', '#aab6e0', '#ccd6f2', '#f0f4ff'], 58, 9);
    const near = terrain([[-20, 70], [80, 68], [170, 72], [260, 66]], .08, 6, 13);
    for (let x = 0; x < W; x++){ const top = Math.round(near(x)); for (let y = top; y < 92; y++) P(c, y < top + 2 ? '#e8eefc' : y < top + 3 ? '#a8b4d8' : shade(['#0c1230', '#141c40', '#1c2850'], .5 - (y - top) * .03, x, y), x, y); }
    for (let i = 0; i < 26; i++){ const x = Math.floor(r() * W); pine(c, x, Math.round(near(x)) + 3, 9 + Math.floor(r() * 8), ['#060c1a', '#0c1a2c', '#16283c'], '#dce6fa'); }
    vgrad(c, 0, 88, W, 72, ['#7c8cc4', '#9cacd8', '#b8c6ea', '#d4def6', '#eef2fc']);
    for (let y = 92; y < H; y += 5) for (let x = 0; x < W; x++){ const s = Math.sin(x * .07 + y * 1.3); if (s > .6) P(c, '#8c9ccc', x, y); else if (s > .45) P(c, '#a8b8e0', x, y); }
    for (let i = 0; i < 40; i++) P(c, '#ffffff', r() * W, 90 + r() * 70);
  },
  over(c, t){
    const r = rng(35);
    for (let i = 0; i < 60; i++){
      const x0 = r() * 240, y0 = r() * 94, far = r() < .6, sp = far ? .4 + r() * .3 : .9 + r() * .8;
      const y = (y0 + t * sp) % 94;
      const x = (x0 + Math.sin((t + y0) * .1) * (far ? 2 : 4) + 240) % 240;
      if (far) P(c, '#c8d0f0', x, y); else { P(c, '#ffffff', x, y, 2, 2); P(c, '#c8d0f0', x + 1, y + 1); }
    }
  }
},
{
  id: 'emberforge', name: 'Emberforge', tag: 'A dwarven forge in a volcano', panelSeed: 1010,
  panel: { face: '#503000', hi: '#ac7c00', lo: '#000000', lip: '#7c7c7c', lipLo: '#000000' },
  tex(c, x, y, w, h){ [[1, 1], [w - 2, 1], [1, h - 2], [w - 2, h - 2]].forEach(([dx, dy]) => P(c, '#f8b800', x + dx, y + dy)); P(c, '#000000', x + 3, y + Math.floor(h / 2), w - 6, 1); },
  back(c){
    const r = rng(44), ROCK = ['#080404', '#140a08', '#22120c', '#341c12', '#4a2a1a', '#663c22', '#8a5430'];
    const lights = [[38, 50, 70], [202, 50, 70], [120, 74, 46], [120, 92, 90]];
    for (let y = 0; y < 98; y++) for (let x = 0; x < W; x++){
      let L = 0; lights.forEach(([lx, ly, rad]) => { const d = Math.hypot(x - lx, (y - ly) * 1.3); L += clamp(1 - d / rad) ** 1.5; });
      const n = fbm(x * 1.3, y * 1.3, 4), ridge = Math.abs(vnoise(x, y * 2, 7, 6) - .5) < .04 ? -.2 : 0;
      P(c, shade(ROCK, n * .45 + L * .55 + ridge, x, y), x, y);
    }
    for (let i = 0; i < 16; i++){
      const sx = 4 + i * 15 + r() * 6, len = 8 + r() * 14, w = 3 + r() * 3;
      for (let j = 0; j < len; j++){ const hw = w * (1 - j / len); for (let dx = -hw; dx <= hw; dx++) P(c, dx > hw - 1.2 ? '#6a3a20' : dx < 0 ? '#0c0606' : '#1e100a', sx + dx, j); }
    }
    // forge
    for (let y = 8; y < 40; y++) for (let x = 108; x < 132; x++) P(c, shade(['#0c0808', '#1a1210', '#2a201a', '#3a2e26'], .2 + (x - 108) / 24 * .4 + (y - 8) / 32 * .3, x, y), x, y);
    for (let y = 12; y < 40; y += 5) P(c, '#0a0606', 108, y, 24, 1);
    bricks(c, 92, 40, 56, 50, 8, 4, ['#2a1610', '#40221a', '#5a3224', '#784634', '#9a5e44'], '#140a06', r, (x, y) => clamp(1 - Math.hypot(x - 120, y - 76) / 26) * .5);
    for (let y = 62; y < 90; y++) for (let x = 106; x <= 134; x++){ const dy = Math.min(0, y - 74); const d = Math.hypot(x - 120, dy); if (d <= 13 && d > 11) P(c, (Math.floor(Math.atan2(dy, x - 120) * 5) % 2) ? '#c88a5a' : '#7a4a2c', x, y); else if (d <= 11) P(c, '#0a0404', x, y); }
    // anvil + rack
    const ST = ['#16161c', '#2a2a34', '#44444e', '#66667a', '#9494a6', '#d0d0dc'];
    for (let y = 76; y < 90; y++) for (let x = 54; x < 82; x++){
      const inTop = y < 80 && x > 54 && x < 80 && !(y === 76 && x > 74), horn = y < 79 && x <= 58 && x >= 54 - (79 - y), waist = y >= 80 && y < 85 && x > 62 && x < 74, foot = y >= 85 && x > 58 && x < 78;
      if (inTop || horn || waist || foot) P(c, x > 78 || (x > 72 && waist) ? '#ff9040' : shade(ST, y === 76 ? 1 : .6 - (y - 76) / 14 * .5 - (x - 54) / 28 * .2, x, y), x, y);
    }
    for (let y = 58; y < 90; y++) { P(c, shade(['#2e160a', '#5a3018', '#784424'], .6, 162, y), 162, y, 2, 1); P(c, '#5a3018', 188, y, 2, 1); }
    P(c, '#98603a', 160, 58, 32, 2); P(c, '#43220f', 160, 60, 32, 1); P(c, '#98603a', 160, 84, 32, 2);
    [167, 174, 181].forEach((bx, i) => {
      for (let y = 61; y < 82; y++){ P(c, ST[3], bx, y); P(c, ST[5], bx + 1, y); P(c, ST[2], bx + 2, y); }
      P(c, '#ffffff', bx + 1, 70 + i * 3); P(c, '#f8b800', bx - 1, 62, 5, 1); P(c, '#a07020', bx - 1, 63, 5, 1); P(c, '#5a3018', bx + 1, 59, 1, 3);
    });
    // lava river + rock lip
    P(c, '#ff6a10', 0, 86, W, 5);
    for (let y = 91; y < 98; y++) for (let x = 0; x < W; x++) P(c, y === 91 ? '#e8743a' : y === 92 ? '#8a4422' : shade(ROCK, .25 - (y - 92) * .03 + (vnoise(x, y, 3, 2) - .5) * .3, x, y), x, y);
    P(c, '#0c0604', 0, 98, W, 62);
    [36, 200].forEach(lx => glow(c, lx + 4, 50, 34, '255,90,20', .25));
  },
  over(c, t){
    const LAVA = ['#8a1400', '#c83000', '#f05a10', '#ff8a20', '#ffb840', '#ffe890'];
    [36, 200].forEach(lx => {
      for (let y = 10; y < 87; y++) for (let i = 0; i < 9; i++){
        const v = .55 + Math.sin((y - (t * 2.2)) * .45 + i * 1.7) * .25 + (i > 1 && i < 7 ? .2 : -.25);
        P(c, shade(LAVA, v, lx + i, y), lx + i, y);
      }
      for (let i = 0; i < 4; i++){ const ph = (t * .7 + i * 5) % 8; sphere(c, lx + 1 + i * 2.5, 86 - ph * .6, 1.5, 1.5, ['#c83000', '#ff8a20', '#ffe890']); }
      glow(c, lx + 4, 86, 14, '255,160,60', .45);
    });
    for (let x = 0; x < W; x++) for (let y = 86; y < 91; y++){ const v = .55 + Math.sin(x * .25 - (t * .9) + y * 1.4) * .3; P(c, shade(LAVA, v, x, y), x, y); }
    for (let y = 68; y < 90; y++) for (let x = 110; x <= 130; x++){ if (Math.hypot(x - 120, Math.min(0, y - 74)) > 10.5) continue; const n = vnoise(x, y * 1.6 + (t * 3), 3, 5); if (y > 90 - n * 22 - 4) P(c, shade(LAVA, n * 1.1, x, y), x, y); }
    glow(c, 120, 82, 26, '255,120,30', .45);
    [[82, 10], [158, 10]].forEach(([cx]) => { for (let y = 10; y < 46; y += 3){ P(c, '#1a1a20', cx, y, 3, 2); P(c, '#6a6a78', cx, y, 1, 1); P(c, '#ff8040', cx + 2, y, 1, 2); } P(c, '#44444e', cx - 2, 46, 7, 4); P(c, '#9494a6', cx - 2, 46, 7, 1); });
    const r = rng(45);
    for (let i = 0; i < 22; i++){ const sx = r() * 240, sp = .8 + r(), ph = r() * 80; const y = 84 - ((ph + (t * sp)) % 80); const x = sx + Math.sin((t + ph) * .15) * 3; glow(c, x, y, 3, '255,150,40', .5); P(c, y < 30 ? '#c83000' : '#ffd060', x, y); }
  }
},
{
  id: 'elderwood', name: 'Elderwood Ruins', tag: 'An overgrown temple at dusk', panelSeed: 909,
  panel: { face: '#ac7c00', hi: '#f8d878', lo: '#503000', lip: '#503000', lipLo: '#000000' },
  tex(c, x, y, w, h, r){ const corner = Math.floor(r() * 4); const mx = corner % 2 ? x + w - 5 : x, my = corner > 1 ? y + h - 3 : y; P(c, '#00a800', mx, my, 5, 2); P(c, '#00a800', mx + (corner % 2 ? 2 : 0), my + (corner > 1 ? -1 : 2), 3, 1); for (let i = 0; i < 3; i++) P(c, '#f8d878', x + r() * w, y + 1 + r() * (h - 2)); },
  back(c){
    const r = rng(55);
    vgrad(c, 0, 0, W, 80, ['#142436', '#1a3444', '#24504e', '#3c6c58', '#7a9a64', '#c8bc72', '#f0d688']);
    glow(c, 132, 66, 40, '255,220,140', .35);
    for (let x = -6; x < W + 6; x += 9) foliage(c, x, 58 + Math.sin(x * .07) * 4, 7, ['#2e4a48', '#3a5a54', '#4a6c5e', '#6a8a6a'], r, 4);
    P(c, '#2e4a48', 0, 64, W, 28);
    for (let x = -6; x < W + 6; x += 11) foliage(c, x, 70 + Math.sin(x * .05 + 2) * 3, 8, ['#16302a', '#1e3e30', '#2a5038', '#3c6840'], r, 5);
    vgrad(c, 0, 74, W, 18, ['#16302a', '#122822']);
  },
  front(c){
    const r = rng(56), STN = ['#30342c', '#464c40', '#5e6656', '#7a826e', '#9aa28a', '#bcc4a8'];
    c.save(); c.globalCompositeOperation = 'lighter';
    [[96, 10], [124, 7], [150, 12]].forEach(([x, w]) => poly(c, [[x, 0], [x + w, 0], [x + w + 36, 92], [x + 18, 92]], 'rgba(255,230,150,0.07)'));
    c.restore();
    for (let y = 80; y < 92; y++) for (let x = 78; x < 162; x++){ const step = y < 84 ? 0 : y < 88 ? 1 : 2; if (x < 78 + (2 - step) * 4 || x >= 162 - (2 - step) * 4) continue; P(c, (y === 80 || y === 84 || y === 88) ? STN[5] : shade(STN, .45 + (vnoise(x, y, 3, 1) - .5) * .4, x, y), x, y); }
    const column = (cx: number, topY: number, broken: boolean): void => {
      const prof = [.95, .85, .6, .3, .55, .8, .6, .3, .15, .1];
      for (let y = topY; y < 80; y++) for (let i = 0; i < 10; i++){
        if (broken && y < topY + 5 && hash(i, y, 3) < (topY + 5 - y) / 5) continue;
        P(c, shade(STN, prof[i] + (vnoise(cx + i, y, 2, 4) - .5) * .25, cx + i, y), cx + i, y);
      }
      if (!broken){ P(c, STN[5], cx - 2, topY - 3, 14, 1); P(c, STN[3], cx - 2, topY - 2, 14, 2); P(c, STN[1], cx - 1, topY, 12, 1); }
      P(c, STN[5], cx - 2, 77, 14, 1); P(c, STN[2], cx - 2, 78, 14, 2);
    };
    column(92, 40, false); column(138, 54, true);
    for (let y = 33; y < 38; y++) for (let x = 88; x < 124; x++){ if (x > 118 && y < 33 + (x - 118)) continue; P(c, y === 33 ? STN[5] : shade(STN, .6 - (y - 33) * .1, x, y), x, y); }
    for (let x = 89; x < 118; x += 4) P(c, STN[1], x, 35, 2, 1);
    [[97, 40, 4], [140, 56, 3], [95, 66, 5], [142, 70, 4], [100, 34, 6], [84, 81, 8], [150, 82, 6]].forEach(([x, y, w]) => { for (let i = 0; i < w; i++) for (let j = 0; j < 3; j++) if (hash(i, j, x) > .3) P(c, shade(['#1e3a18', '#2e5a22', '#4a8030', '#78b040'], .3 + hash(j, i, y) * .6, x + i, y + j), x + i, y + j); });
    [[96, 38, 16], [108, 38, 22], [118, 38, 12], [143, 56, 14]].forEach(([vx, vy, len]) => { for (let j = 0; j < len; j++){ const x = vx + Math.round(Math.sin(j * .5) * .8); P(c, '#2e5a22', x, vy + j); if (j % 3 === 1) { P(c, '#5a9a38', x + 1, vy + j); P(c, '#78b040', x - 1, vy + j + 1); } } });
    P(c, STN[0], 99, 52, 1, 6); P(c, STN[0], 100, 57, 1, 4); P(c, STN[0], 144, 64, 1, 7);
    const BARK = ['#120a06', '#1e140c', '#2e2014', '#42301e', '#5a442a', '#76603a'];
    [[0, 22, 1], [218, 22, -1]].forEach(([tx, tw, side]) => {
      for (let y = 0; y < 92; y++){
        const flare = y > 74 ? Math.round((y - 74) ** 1.4 * .5) : 0;
        for (let x = tx - (side < 0 ? flare : 0); x < tx + tw + (side > 0 ? flare : 0); x++){
          const u = (x - tx) / tw, lit = side > 0 ? u : 1 - u;
          const streak = vnoise(x * 3, y * .35, 4, 12);
          let v = .2 + lit * .45 + (streak - .5) * .5;
          if ((side > 0 && x === tx + tw + flare - 1) || (side < 0 && x === tx - flare)) v = .95;
          P(c, shade(BARK, v, x, y), x, y);
        }
      }
      glow(c, side > 0 ? tx + tw : tx, 50, 14, '255,200,120', .12);
    });
    const LEAF = ['#0c1e14', '#14301c', '#1e4426', '#2c5c30', '#447a3c', '#68a04c'];
    for (let i = 0; i < 18; i++){ const x = i < 9 ? i * 9 - 4 : 240 - (i - 9) * 9 + 4; foliage(c, x, 4 + (i % 3) * 5, 9, LEAF, r, 5); }
    [[86, 0], [120, -3], [154, 0]].forEach(([x, y]) => foliage(c, x, y, 8, LEAF, r, 4));
    vgrad(c, 0, 90, W, 70, ['#16301a', '#1e3c1e', '#284a24', '#32582a', '#3c662e']);
    for (let i = 0; i < 90; i++){ const x = r() * W, y = 92 + r() * 68; P(c, '#4c7a34', x, y - 2, 1, 3); P(c, '#6a9a44', x + 1, y - 1, 1, 2); P(c, '#2a4a20', x - 1, y, 1, 1); }
    for (let i = 0; i < 18; i++) P(c, ['#f0f0e0', '#f0a8c8', '#f8e070'][i % 3], r() * W, 92 + r() * 68);
  },
  over(c, t){
    const r = rng(57);
    for (let i = 0; i < 16; i++){
      const x0 = 24 + r() * 192, y0 = 20 + r() * 66;
      const x = x0 + (Math.sin(t * .13 + i) * 6), y = y0 + (Math.cos(t * .11 + i * 2) * 4);
      if ((t + i * 3) % 12 >= 7) continue;
      glow(c, x, y, 5, '200,255,100', .45); P(c, '#f0ffa0', x, y);
    }
    for (let i = 0; i < 6; i++){
      const ph = r() * 100, sx = 30 + r() * 180;
      const y = (ph + (t * .5)) % 92, x = sx + Math.sin((y + ph) * .1) * 8;
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
