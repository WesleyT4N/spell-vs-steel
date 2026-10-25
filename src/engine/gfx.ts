// Low-level pixel helpers shared by the arena, sprites, effects and UI.

export const W = 240;
export const H = 160;
/** The sharp UI layer: twice the world resolution, drawn over the scaled-up world. */
export const UW = W * 2;
export const UH = H * 2;

export const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

export type Ctx = CanvasRenderingContext2D;

export function P(c: Ctx, col: string, x: number, y: number, w = 1, h = 1): void {
  c.fillStyle = col;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function rng(seed: number): () => number {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v: number, a = 0, b = 1): number => Math.max(a, Math.min(b, v));
export const dith = (x: number, y: number): number => BAYER[y & 3][x & 3] / 16;

export function hx(c: string): number[] {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}
export function mix(a: string, b: string, t: number): string {
  const A = hx(a), B = hx(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

/** Pick a color from a dark-to-light ramp with ordered dithering between steps. */
export function shade(ramp: string[], v: number, x: number, y: number): string {
  v = clamp(v);
  const f = v * (ramp.length - 1), i = Math.floor(f);
  return i < ramp.length - 1 && dith(x, y) < f - i ? ramp[i + 1] : ramp[i];
}

export function vgrad(c: Ctx, x0: number, y0: number, w: number, h: number, cols: string[]): void {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) P(c, shade(cols, (y - y0) / Math.max(1, h - 1), x, y), x, y);
}

export function hash(i: number, j: number, s: number): number {
  let n = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 982451653);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function vnoise(x: number, y: number, sc: number, s: number): number {
  const X = x / sc, Y = y / sc, xi = Math.floor(X), yi = Math.floor(Y), xf = X - xi, yf = Y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c2 = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return (a + (b - a) * u) * (1 - v) + (c2 + (d - c2) * u) * v;
}

/** Lit ellipse, light from the upper left; ramp runs dark to light. */
export function sphere(c: Ctx, cx: number, cy: number, rx: number, ry: number, ramp: string[], lx = -0.5, ly = -0.6): void {
  const lz = Math.sqrt(Math.max(0, 1 - lx * lx - ly * ly));
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, d = nx * nx + ny * ny;
    if (d > 1) continue;
    const nz = Math.sqrt(1 - d);
    P(c, shade(ramp, clamp(nx * lx + ny * ly + nz * lz) * 0.9 + 0.1, x, y), x, y);
  }
}

export function glow(c: Ctx, x: number, y: number, rad: number, rgb: string, a: number): void {
  const g = c.createRadialGradient(x, y, 0, x, y, rad);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.fillStyle = g;
  c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  c.restore();
}

export function blob(c: Ctx, col: string, cx: number, cy: number, r: number): void {
  for (let dy = -r; dy <= r; dy++) {
    const hw = Math.floor(Math.sqrt(r * r - dy * dy));
    P(c, col, cx - hw, cy + dy, hw * 2 + 1, 1);
  }
}

/** Box with a 1px black border and a 1px highlight, the standard UI frame. */
export function frame(c: Ctx, x: number, y: number, w: number, h: number, fill = '#000000', edge = '#fcfcfc'): void {
  P(c, '#000000', x - 1, y - 1, w + 2, h + 2);
  P(c, edge, x, y, w, h);
  P(c, fill, x + 1, y + 1, w - 2, h - 2);
}

export function layer(fn: (c: Ctx) => void): HTMLCanvasElement {
  const o = document.createElement('canvas');
  o.width = W; o.height = H;
  fn(o.getContext('2d')!);
  return o;
}
