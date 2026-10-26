// Low-level pixel helpers shared by the arena, sprites, effects and UI.

export const W = 240;
export const H = 160;
/** The sharp UI layer: twice the world resolution, drawn over the scaled-up world. */
export const UW = W * 2;
export const UH = H * 2;

/**
 * The visible screen in world pixels. Screens wider or taller than 3:2 show more than W×H: the game
 * keeps drawing in W×H coordinates, centered at (ox, oy), and full-screen backgrounds reach into the margins.
 */
export const view = { w: W, h: H, ox: 0, oy: 0 };
/** Narrowest and widest screen shapes; past these the window letterboxes. */
export const MIN_ASPECT = 4 / 3, MAX_ASPECT = 7 / 3;
/** Phones in portrait may go taller, filling the top half of the screen. */
export const PORTRAIT_MIN_ASPECT = 3 / 4;
/** Phones in portrait on screens with a tall layout use the whole screen, down to this shape (taller letterboxes). */
export const TALL_MIN_ASPECT = 9 / 22;
/** The view size (world pixels) for a window shape. */
export function viewSize(aspect: number, min = MIN_ASPECT): { w: number; h: number } {
  const a = Math.min(MAX_ASPECT, Math.max(min, aspect));
  // margins stay whole world pixels on both sides, so the content never lands between pixels
  const w = a >= W / H ? W + 2 * Math.round((H * a - W) / 2) : W;
  const h = a >= W / H ? H : H + 2 * Math.round((W / a - H) / 2);
  return { w, h };
}
/** Size the view for a window shape. Returns true when it changed. */
export function setView(aspect: number, min = MIN_ASPECT): boolean {
  const { w, h } = viewSize(aspect, min);
  if (w === view.w && h === view.h) return false;
  Object.assign(view, { w, h, ox: (w - W) / 2, oy: (h - H) / 2 });
  return true;
}
/**
 * `spread.tall` is set while a screen with its own full-height phone layout (Scene.tall) fills the whole screen.
 * Phone portrait leaves spare height above and below the 480×320 UI area, and menus spread their layout into it:
 * `vy` moves a UI-layer y away from the middle by `k` (up to 1.5×), and `vspan` is a box's height once both its
 * edges move. Only positions and box heights change; sprites and text keep their size. `k` is 1 everywhere else.
 */
export const spread = { portrait: false, k: 1, tall: false, halfH: H };
/**
 * Split screens (Scene.split) in the full-height layout draw the game in the top part, exactly as the half-screen
 * layout would (`halfH` world pixels tall), and their phone controls below it. This is how far up that top part
 * sits from where the full-height view would center the game, in world pixels.
 */
export const splitLift = (): number => view.oy - (spread.halfH - H) / 2;
export const vy = (y: number): number => Math.round(UH / 2 + (y - UH / 2) * spread.k);
export const vspan = (y: number, h: number): number => vy(y + h) - vy(y);
/** The whole visible screen as [x, y, w, h] in layer coordinates (`s` = 2 for the UI layer). */
export const screenRect = (s = 1): [number, number, number, number] => [-view.ox * s, -view.oy * s, view.w * s, view.h * s];
/** Fill the whole visible screen, margins included. */
export function fillScreen(c: Ctx, color: string, s = 1): void {
  const [x, y, w, h] = screenRect(s);
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}

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

export function layer(fn: (c: Ctx) => void, w = W, h = H): HTMLCanvasElement {
  const o = document.createElement('canvas');
  o.width = w; o.height = h;
  fn(o.getContext('2d')!);
  return o;
}
