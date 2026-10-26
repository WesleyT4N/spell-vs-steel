// Grand Colosseum, ported from art/arenas.html. 16-bit backdrop, 8-bit NES panels.
// The other stages live in stages.ts and share the panel grid drawn here.
import { P, W, H, view, rng, shade, vgrad, vnoise, sphere, glow, mix, layer, type Ctx } from '../engine/gfx';

export const COLS = 6, ROWS = 3, PW = 38, FACE = 15, LIP = 4, X0 = 6, Y0 = 98;
export const LEFT_EDGE = '#f83800', RIGHT_EDGE = '#3cbcfc';

/** Center-bottom (feet) position of a panel. */
export function panelFoot(col: number, row: number): { x: number; y: number } {
  return { x: X0 + col * PW + PW / 2, y: Y0 + row * (FACE + LIP) + FACE - 3 };
}
export function panelCenter(col: number, row: number): { x: number; y: number } {
  return { x: X0 + col * PW + PW / 2, y: Y0 + row * (FACE + LIP) + FACE / 2 };
}

function bricks(c: Ctx, x0: number, y0: number, w: number, h: number, bw: number, bh: number, ramp: string[], mortar: string, r: () => number, tint?: (x: number, y: number) => number): void {
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
        else col = shade(ramp, v + (vnoise(xx, yy, 3, 7) - 0.5) * 0.35 + (tint ? tint(xx, yy) : 0), xx, yy);
        P(c, col, xx, yy);
      }
    }
  }
}

export function cloud(c: Ctx, x: number, y: number, s: number): void {
  const R = ['#8aa2d0', '#b4c8ea', '#dce8f8', '#ffffff'];
  for (const [dx, dy, r] of [[-9, 2, 4], [-3, -1, 6], [5, -3, 7], [13, 0, 5], [19, 2, 3.5]]) sphere(c, x + dx * s, y + dy * s, r * s, r * s * 0.85, R);
  P(c, R[0], x - 12 * s, y + 4 * s, 34 * s, 1);
}

export function banner(c: Ctx, x: number, y: number, w: number, h: number, ramp: string[], trim: string, t: number): void {
  for (let i = 0; i < h; i++) {
    const off = Math.round(Math.sin(t * 0.5 + i * 0.35 + x) * 0.8);
    const tail = i >= h - 3 ? h - i : 0;
    for (let j = 0; j < w; j++) {
      if (tail && j >= tail && j < w - tail) continue;
      const fold = Math.cos((j + t * 0.3) * 1.1) * 0.35 + 0.5 - (i / h) * 0.2;
      P(c, j === 0 || j === w - 1 ? ramp[0] : shade(ramp, fold, x + j, y + i), x + off + j, y + i);
    }
    if (i === h - 5) P(c, trim, x + off + 1, y + i, w - 2, 1);
  }
  P(c, '#3a2410', x - 1, y - 1, w + 2, 1);
  P(c, '#8a6a3a', x - 1, y - 2, w + 2, 1);
}

export function torch(c: Ctx, x: number, y: number, t: number, i: number): void {
  P(c, '#2a2a30', x, y + 4, 2, 6); P(c, '#5a5a66', x - 1, y + 3, 4, 2); P(c, '#8a8a96', x - 1, y + 3, 4, 1);
  const f = (t + i) % 3;
  glow(c, x + 1, y, 16, '255,140,40', 0.35);
  P(c, '#c83000', x - 1, y - 3 + (f === 1 ? 1 : 0), 4, 6); P(c, '#ff7a10', x, y - 4 + (f % 2), 2, 6); P(c, '#ffd060', x, y - 1, 2, 3); P(c, '#fff4c0', x, y, 1, 2);
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

// Stages are painted for a 3:2 screen. Wider or taller screens get the sides and floor mirrored outward
// and the sky stretched upward, so the scenery carries on into the margins without seams.
let flat: Ctx | null = null, wide: Ctx | null = null;
const buffer = (w: number, h: number, old: Ctx | null): Ctx => {
  if (old && old.canvas.width === w && old.canvas.height === h) return old;
  const o = document.createElement('canvas');
  o.width = w; o.height = h;
  const x = o.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  return x;
};
// The sky above a stage on tall screens: its top edge's average color, deepening upward. Cached per stage and size.
const skies = new Map<string, HTMLCanvasElement>();
function skyCap(st: Stage, f: HTMLCanvasElement, w: number, h: number): HTMLCanvasElement {
  const key = `${st.id}:${w}x${h}`;
  let sky = skies.get(key);
  if (!sky) {
    const px = f.getContext('2d')!.getImageData(0, 0, W, 1).data;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < px.length; i += 4) { r += px[i]; g += px[i + 1]; b += px[i + 2]; }
    const hex = (v: number): string => Math.round(v / W).toString(16).padStart(2, '0');
    const top = `#${hex(r)}${hex(g)}${hex(b)}`;
    sky = layer(c => vgrad(c, 0, 0, w, h, [mix(top, '#000000', 0.45), mix(top, '#000000', 0.3), mix(top, '#000000', 0.15), top]), w, h);
    skies.set(key, sky);
  }
  return sky;
}

/** Draw a stage's backdrop over the whole visible screen. */
export function drawStage(c: Ctx, st: Stage, t: number, cheer = 0): void {
  const { w, h, ox, oy } = view;
  if (!ox && !oy) { st.draw(c, t, cheer); return; }
  flat = buffer(W, H, flat);
  flat.clearRect(0, 0, W, H);
  st.draw(flat, t, cheer);
  wide = buffer(w, h, wide);
  const f = flat.canvas, x = wide;
  x.drawImage(f, ox, oy);
  if (ox) {
    x.save(); x.translate(2 * ox, 0); x.scale(-1, 1); x.drawImage(f, 0, 0, ox, H, ox, oy, ox, H); x.restore();
    x.save(); x.translate(2 * (ox + W), 0); x.scale(-1, 1); x.drawImage(f, W - ox, 0, ox, H, ox + W - ox, oy, ox, H); x.restore();
  }
  if (oy) {
    const g = x.canvas;
    // above: more sky, since mirrored walls hanging upside down look wrong
    x.drawImage(skyCap(st, f, w, oy), 0, 0);
    x.save(); x.translate(0, 2 * (oy + H)); x.scale(1, -1); x.drawImage(g, 0, oy + H - oy, w, oy, 0, oy + H - oy, w, oy); x.restore();
  }
  c.drawImage(x.canvas, -ox, -oy);
}

const STONE: PanelLook = { face: '#bcbcbc', hi: '#fcfcfc', lo: '#7c7c7c', lip: '#7c7c7c', lipLo: '#000000' };
/** Grey stone face: one seam and a few pits. */
export function stoneTex(c: Ctx, x: number, y: number, w: number, h: number, r: () => number): void {
  P(c, '#7c7c7c', x + 8 + Math.floor(r() * 18), y + 1, 1, h - 2);
  for (let i = 0; i < 4; i++) P(c, '#7c7c7c', x + r() * w, y + 1 + r() * (h - 2));
}

export class Colosseum implements Stage {
  id = 'colosseum';
  name = 'GRAND COLOSSEUM';
  tag = 'THE CLASSIC PROVING GROUND';
  panel = STONE;
  panelSeed = 1010;
  tex = stoneTex;
  back: HTMLCanvasElement;
  front: HTMLCanvasElement;
  crowd: Fan[] = [];

  constructor() {
    this.back = layer(c => {
      vgrad(c, 0, 0, W, 50, ['#2a50b8', '#3c6cd0', '#5a8ee0', '#86b4ec', '#b8d8f4']);
      glow(c, 204, 9, 26, '255,240,200', 0.55);
      sphere(c, 204, 9, 5, 5, ['#f8d878', '#fce8b0', '#fff8e0', '#ffffff']);
    });
    this.front = layer(c => this.drawFront(c));
  }

  private drawFront(c0: Ctx): void {
    const c = c0;
    const r = rng(12);
    const T = ['#6a4c30', '#8e6e4c', '#b4946c', '#d6ba90', '#eedab4', '#fcf0d4'];
    for (let x = 0; x < W; x++) {
      const o = k(x), am = (x + 3) % 14, n = (vnoise(x, 0, 3, 4) - 0.5) * 0.2;
      for (let y = 0; y < 13 - o; y++) if (x % 28 === 9 && y > 1 - o) P(c, y === 2 - o ? '#5a3a1a' : x % 2 ? '#8a6038' : '#6a4626', x, y);
      for (let y = 13 - o; y < 22 - o; y++) {
        let v = 0.62 + n + (vnoise(x, y, 2, 9) - 0.5) * 0.25;
        if (y === 13 - o) v = 1;
        if (y === 14 - o) v = 0.8;
        if (y === 21 - o) v = 0.05;
        if (am >= 6 && am <= 8 && y >= 15 - o && y <= 18 - o) { P(c, y === 15 - o ? '#2a1a10' : '#3c2818', x, y); continue; }
        P(c, shade(T, v, x, y), x, y);
      }
      for (let y = 22 - o; y < 41 - o; y++) {
        const dx = am - 6.5, archTop = 29 - Math.round(Math.sqrt(Math.max(0, 16 - dx * dx)) * 1.2);
        const yy = y + o;
        let col: string;
        if (am >= 3 && am <= 10 && yy >= archTop) {
          const depth = (yy - archTop) / (40 - archTop);
          col = shade(['#140c08', '#24160e', '#382416', '#4e3420'], 0.1 + depth * 0.6 + (am === 9 ? 0.3 : 0), x, y);
        } else if (am >= 2 && am <= 11 && yy >= archTop - 2) {
          col = am < 6 ? T[5] : T[1];
        } else {
          let v = am === 12 || am === 13 ? 0.78 : am === 0 ? 0.35 : am === 1 ? 0.2 : 0.55;
          v += (vnoise(x, y, 2, 11) - 0.5) * 0.25 + n;
          if (yy === 22) v = 0.95;
          if (yy === 23) v = 0.15;
          col = shade(T, v, x, y);
        }
        P(c, col, x, y);
      }
      P(c, T[5], x, 41 - o); P(c, T[3], x, 42 - o); P(c, T[0], x, 43 - o);
      for (let y = 44 - o; y < 62 - o; y++) {
        const step = (y - (44 - o)) % 4;
        P(c, step === 0 ? T[4] : step === 1 ? T[2] : shade(['#3a2614', '#5a3e24'], 0.5 + (vnoise(x, y, 3, 3) - 0.5), x, y), x, y);
      }
    }
    // imperial box
    for (let y = 42; y < 62; y++) for (let x = 100; x < 140; x++) P(c, shade(['#1a0e08', '#2e1c10'], (y - 42) / 20, x, y), x, y);
    for (let x = 98; x < 142; x++) {
      const stripe = Math.floor((x - 98) / 4) % 2;
      for (let y = 36; y < 42; y++) P(c, shade(stripe ? ['#3a1048', '#5a1a70', '#7c2c98', '#a050c0'] : ['#a89070', '#d8c8a0', '#f0e4c4', '#fcf6e4'], 0.9 - (y - 36) / 7, x, y), x, y);
    }
    for (let x = 98; x < 142; x += 4) {
      const col = Math.floor((x - 98) / 4) % 2 ? '#5a1a70' : '#d8c8a0';
      P(c, col, x, 42, 3, 1); P(c, col, x + 1, 43, 1, 1);
    }
    for (const px of [99, 139]) { P(c, '#f8d070', px, 42, 1, 20); P(c, '#a07020', px + 1, 42, 1, 20); }
    P(c, '#f8d070', 99, 60, 42, 1); P(c, '#a07020', 99, 61, 42, 1);

    // podium wall, drawn flat then bent to follow the bowl
    const pc = document.createElement('canvas');
    pc.width = W; pc.height = H;
    {
      const c = pc.getContext('2d')!;
      for (let x = 0; x < W; x++) { P(c, '#000000', x, 62); P(c, '#f4f0e6', x, 63); P(c, '#d0ccc0', x, 64); P(c, '#8c887c', x, 65); }
      bricks(c, 0, 66, W, 24, 12, 5, ['#6c6c70', '#8c8c90', '#a8a8a8', '#c4c2bc', '#e0ded6'], '#4c4a50', r, (_x, y) => -((y - 66) / 24) * 0.15);
      for (const [gx, gr] of [[120, 12], [52, 8], [188, 8]]) {
        const cy = 90 - gr;
        for (let y = cy - gr - 2; y < 90; y++) for (let x = gx - gr - 2; x <= gx + gr + 2; x++) {
          const dx = x - gx, dy = Math.min(0, y - cy), d = Math.sqrt(dx * dx + dy * dy);
          if (d <= gr) P(c, shade(['#0c080c', '#1a1218', '#2a1e24'], ((y - (cy - gr)) / (gr * 2)) * 0.8, x, y), x, y);
          else if (d <= gr + 2 && y < cy + 1) P(c, Math.floor(Math.atan2(dy, dx) * 4) % 2 ? '#e8e6de' : '#9c9a92', x, y);
        }
        for (let x = gx - gr + 2; x < gx + gr - 1; x += 3) for (let y = cy - gr + 1; y < 90; y++) {
          const dx = x - gx, dy = Math.min(0, y - cy);
          if (dx * dx + dy * dy < gr * gr) P(c, '#3c3c46', x, y);
        }
        for (let y = cy - gr + 4; y < 90; y += 4) for (let x = gx - gr + 1; x < gx + gr; x++) {
          const dx = x - gx, dy = Math.min(0, y - cy);
          if (dx * dx + dy * dy < gr * gr) P(c, x % 3 ? '#4a4a56' : '#7c7c88', x, y);
        }
        P(c, '#f4f2ea', gx - 1, cy - gr - 3, 3, 3); P(c, '#9c9a92', gx + 1, cy - gr - 1, 1, 1);
      }
      for (const nx of [86, 154]) {
        for (let y = 68; y < 86; y++) for (let x = nx - 5; x <= nx + 5; x++) {
          const dy = Math.min(0, y - 73);
          if ((x - nx) ** 2 + dy * dy <= 25) P(c, shade(['#1c1820', '#2e2832'], (x - nx + 5) / 10, x, y), x, y);
        }
        sphere(c, nx, 72, 2, 2, ['#8c8a84', '#c4c2bc', '#f0eee8']);
        for (let y = 75; y < 85; y++) for (let x = nx - 3 + (y > 80 ? 0 : 1); x <= nx + 3 - (y > 80 ? 0 : 1); x++) P(c, shade(['#8c8a84', '#b4b2ac', '#dcdad2', '#f4f2ec'], 0.9 - (x - nx + 3) / 7, x, y), x, y);
        P(c, '#cfcdc6', nx - 4, 85, 9, 1);
      }
    }
    // sand
    vgrad(c, 0, 76, W, 84, ['#9c7848', '#b89060', '#d0aa78', '#e0c08c', '#ecd09e']);
    for (let i = 0; i < 70; i++) { const x = r() * W, y = 92 + r() * 68; P(c, r() < 0.5 ? '#f4dcb0' : '#a88050', x, y, 2 + r() * 5, 1); }
    for (let i = 0; i < 60; i++) P(c, '#8a6840', r() * W, 92 + r() * 68);
    for (let x = 0; x < W; x++) {
      const o = k(x);
      c0.drawImage(pc, x, 62, 1, 28, x, 62 - o, 1, 28);
      c0.fillStyle = 'rgba(60,30,10,0.28)';
      c0.fillRect(x, 90 - o, 1, 4);
    }
    const cols = [['#a87020', '#d8a030'], ['#2c7c38', '#3c9c48'], ['#602c80', '#8040a0'], ['#c8c0b0', '#ece4d4'], ['#7c4c20', '#a06830'], ['#3c8878', '#60b8a0'], ['#a05878', '#c87898']];
    for (let x = 1; x < W - 1; x += 3) {
      const o = k(x);
      for (let y = 45 - o; y < 60 - o; y += 4) {
        if (x > 96 && x < 144) continue;
        if (r() < 0.15) continue;
        this.crowd.push([x + (r() < 0.5 ? 0 : 1), y, cols[Math.floor(r() * cols.length)], r() < 0.5 ? ['#c8885c', '#f0b888'] : ['#7c4c30', '#a8704c'], Math.floor(r() * 16)]);
      }
    }
  }

  draw(c: Ctx, t: number, cheer = 0): void {
    c.drawImage(this.back, 0, 0);
    [[30, 5, 0.8], [150, 2, 0.6], [230, 8, 0.7]].forEach(([cx, cy, s], i) => cloud(c, ((cx + t * 0.2 * (1 + i * 0.3)) % 300) - 30, cy, s));
    c.drawImage(this.front, 0, 0);
    const hopEvery = cheer > 0 ? 4 : 16;
    for (const [x, y, body, skin, ph] of this.crowd) {
      const hop = (t + ph) % hopEvery < 2 ? 1 : 0;
      P(c, skin[1], x, y - hop - 1, 2, 1); P(c, skin[0], x + 1, y - hop - 1, 1, 1);
      P(c, body[1], x, y - hop, 1, 2); P(c, body[0], x + 1, y - hop, 1, 2);
      if (hop) P(c, skin[1], x + 2, y - 3, 1, 1);
    }
    sphere(c, 120, 50, 2, 2, ['#a8704c', '#f0b888']);
    P(c, '#f8d070', 118, 47, 5, 1); P(c, '#6a1a80', 117, 52, 7, 8); P(c, '#a050c0', 117, 52, 3, 8); P(c, '#fcf6e4', 120, 52, 1, 8);
    banner(c, 18, 67 - k(23), 10, 19, ['#3a1048', '#5a1a70', '#7c2c98', '#a050c0'], '#f8d070', t);
    banner(c, 212, 67 - k(217), 10, 19, ['#3a1048', '#5a1a70', '#7c2c98', '#a050c0'], '#f8d070', t);
    torch(c, 70, 72 - k(70), t, 0);
    torch(c, 168, 72 - k(168), t, 1);
    for (let x = 9; x < W; x += 28) {
      const o = k(x), wv = (t + x) % 6 < 3 ? 1 : 0;
      P(c, '#7c2c98', x + 1, 3 - o, 5, 1); P(c, '#a050c0', x + 1, 4 - o, 4 + wv, 1); P(c, '#5a1a70', x + 1, 5 - o, 2 + wv, 1);
    }
  }
}

export type PanelState = 'clean' | 'burning' | 'cracked';

export function drawPanel(c: Ctx, col: number, row: number, state: PanelState, _t: number, owner: 0 | 1, highlight: string | undefined, stage: Stage): void {
  const x = X0 + col * PW, y = Y0 + row * (FACE + LIP);
  const team = owner === 0 ? LEFT_EDGE : RIGHT_EDGE;
  const fx = x + 2, fy = y + 1, fw = PW - 4, fh = FACE - 2;
  const look = stage.panel;
  P(c, '#000000', x, y - 1, PW, FACE + LIP + 1);
  P(c, team, x + 1, y, PW - 2, FACE);
  let face = look.face, hi = look.hi, lo = look.lo;
  if (state === 'burning') { face = '#000000'; hi = '#a81000'; lo = '#000000'; }
  if (highlight) { face = mix(face, highlight, 0.55); }
  P(c, face, fx, fy, fw, fh); P(c, hi, fx, fy, fw, 1); P(c, lo, fx, fy + fh - 1, fw, 1);
  P(c, look.lip, x + 1, y + FACE, PW - 2, LIP); P(c, look.lipLo, x + 1, y + FACE + LIP - 1, PW - 2, 1);
  if (state !== 'burning') stage.tex(c, fx, fy, fw, fh, rng(col * 31 + row * 7 + stage.panelSeed));
  if (state === 'cracked') {
    const cr = rng(col * 13 + row * 5 + 9);
    let cx = fx + 4 + Math.floor(cr() * 6), cy = fy + 1;
    while (cy < fy + fh - 1 && cx < fx + fw - 2) {
      P(c, '#000000', cx, cy); P(c, '#000000', cx + 1, cy);
      cx += 1 + Math.floor(cr() * 3); cy += cr() < 0.7 ? 1 : 0;
      if (cr() < 0.25) P(c, '#000000', cx, cy - 2, 1, 2);
    }
    let bx = fx + fw - 8, by = fy + 2;
    for (let i = 0; i < 6; i++) { P(c, '#000000', bx, by); bx -= 1 + Math.floor(cr() * 2); by += 1; }
  }
  // burning panels get their flames from the effects layer (fxView.drawBurn)
}
