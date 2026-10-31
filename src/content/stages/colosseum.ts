// The Grand Colosseum: the classic proving ground, and the stage used when an id is unknown.
import { P, rng, type Ctx } from '../../engine/gfx';
import { inked, wide, put, sky, mod, disc, blocks, inkBanner, inkTorch, inkCloud, bird, MX, BW, XL, XR, YT, YB } from '../../art/ink';
import { stoneTex, PURPLE, GOLD, type PanelLook, type Stage } from '../../art/arena';
import type { StageModule } from './registry';

// bowl curve: center highest, edges dip down
const k = (x: number): number => -Math.round(6 * ((x - 120) / 120) ** 2);

type Fan = [number, number, string[], string[], number];

// Grand Colosseum palette
const STONE: PanelLook = { face: '#bdb7cc', hi: '#eee9e7', lo: '#7e7890', lip: '#5c566c', lipLo: '#000000' };
const SKY = ['#3050b8', '#3c64c8', '#5480d8', '#709ce4', '#94b8ec', '#b8d4f2'];
const SAND_ST = ['#8a5a44', '#b07c5c', '#cfa47a', '#e8cc9c', '#fbecc4'], SAND_INK = '#4a2a26';
const GREY = ['#4c4660', '#6e6882', '#9690a8', '#bdb7cc', '#e6e2ec'], GREY_INK = '#241c30';
const DARK = ['#1c1020', '#34202c', '#4c3440'];
const SAND = ['#8e6440', '#b88c5c', '#d8b480', '#ecd2a0'];
const CROWD = [['#8d1a30', '#dd3443'], ['#212f84', '#486cdb'], ['#2c6a3a', '#4c9a4e'], ['#7a5a10', '#d8a030'], ['#5e2a74', '#8a44a0'], ['#8a8296', '#d8d2dc']];
const SKIN = [['#a4704c', '#edbe8a'], ['#6a3c2a', '#a47e73']];

class Colosseum implements Stage {
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

export default { id: 'colosseum', music: 'stage_colosseum', create: () => new Colosseum() } satisfies StageModule;
