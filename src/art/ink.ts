// The "Inked" stage toolkit: scenery drawn like the 24px fighters. Every piece gets a 1px outline in a dark
// ink of its own material, shading is flat 3-5 tone bands (no dithering, no noise), and gradients step in hard bands.
import { P, W, H, clamp, mix, type Ctx } from '../engine/gfx';

/** Paint into a transparent layer, then trace a 1px outline around everything opaque. */
export function inked(ink: string | null, fn: (c: Ctx) => void, w = W, h = H): HTMLCanvasElement {
  const o = document.createElement('canvas');
  o.width = w; o.height = h;
  const c = o.getContext('2d')!;
  fn(c);
  if (!ink) return o;
  c.setTransform(1, 0, 0, 1, 0, 0);
  const d = c.getImageData(0, 0, w, h).data;
  const on = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
  c.fillStyle = ink;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!on(x, y) && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1))) c.fillRect(x, y, 1, 1);
  return o;
}
// Stages are painted larger than the 240x160 world: MX extra columns each side covers the widest screen
// (21:9) and MY extra rows above and below covers the tallest (a phone in portrait). Stage code draws in
// world coordinates; anything from XL..XR and YT..YB may be seen.
export const MX = 68, MY = 80, BW = W + 2 * MX, BH = H + 2 * MY;
export const XL = -MX, XR = W + MX, YT = -MY, YB = H + MY;

/** An offscreen canvas covering the whole oversized stage, with world (0,0) at (MX, MY). */
export function wide(fn: (c: Ctx) => void): HTMLCanvasElement {
  const o = document.createElement('canvas');
  o.width = BW; o.height = BH;
  const c = o.getContext('2d')!;
  c.translate(MX, MY);
  fn(c);
  return o;
}
/** Blit a `wide` canvas back in world coordinates. */
export const put = (c: Ctx, o: HTMLCanvasElement): void => c.drawImage(o, XL, YT);

/** Draw an outlined piece straight onto `c`, anywhere on the oversized stage. */
export function stamp(c: Ctx, ink: string | null, fn: (c: Ctx) => void): void {
  put(c, inked(ink, c => { c.translate(MX, MY); fn(c); }, BW, BH));
}

/** The step of a dark-to-light ramp nearest to `v` (0..1). */
export const tone = (ramp: string[], v: number): string => ramp[Math.round(clamp(v) * (ramp.length - 1))];

/** A gradient in hard horizontal bands, top color first. */
export function bands(c: Ctx, x: number, y: number, w: number, h: number, cols: string[]): void {
  const n = cols.length;
  for (let i = 0; i < n; i++) {
    const a = Math.round((i * h) / n), b = Math.round(((i + 1) * h) / n);
    P(c, cols[i], x, y + a, w, b - a);
  }
}

/**
 * A sky in hard bands from y = 0 down to `bottom`, spanning the whole oversized stage. Above the world's top
 * edge the bands keep going, each step deeper toward `deep`, so tall screens get more sky.
 */
export function sky(c: Ctx, bottom: number, cols: string[], deep = '#000000'): void {
  bands(c, XL, 0, BW, bottom, cols);
  const bh = Math.max(3, Math.round(bottom / cols.length));
  for (let i = 1, y = -bh; y + bh > YT; i++, y -= bh) P(c, mix(cols[0], deep, Math.min(0.6, i * 0.09)), XL, y, BW, bh);
}
/** x mod n, always 0..n-1 (stage x runs negative into the left margin). */
export const mod = (x: number, n: number): number => ((x % n) + n) % n;

export function disc(c: Ctx, col: string, cx: number, cy: number, r: number): void {
  for (let y = -r; y <= r; y++) {
    const hw = Math.round(Math.sqrt(Math.max(0, r * r - y * y)));
    P(c, col, cx - hw, cy + y, hw * 2 + 1, 1);
  }
}

/** Cel-shaded ellipse, light from the upper left; ramp runs dark to light. */
export function ball(c: Ctx, cx: number, cy: number, rx: number, ry: number, ramp: string[], lx = -0.5, ly = -0.6): void {
  const lz = Math.sqrt(Math.max(0, 1 - lx * lx - ly * ly));
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, d = nx * nx + ny * ny;
    if (d > 1) continue;
    P(c, tone(ramp, clamp(nx * lx + ny * ly + Math.sqrt(1 - d) * lz) * 0.95), x, y);
  }
}

/** A soft light without gradients: two stepped, see-through rings. */
export function halo(c: Ctx, x: number, y: number, r: number, rgb: string, a: number): void {
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.fillStyle = `rgba(${rgb},${a * 0.5})`;
  for (let dy = -r; dy <= r; dy++) { const hw = Math.round(Math.sqrt(r * r - dy * dy)); c.fillRect(Math.round(x - hw), Math.round(y + dy), hw * 2 + 1, 1); }
  const r2 = Math.round(r * 0.55);
  c.fillStyle = `rgba(${rgb},${a * 0.6})`;
  for (let dy = -r2; dy <= r2; dy++) { const hw = Math.round(Math.sqrt(r2 * r2 - dy * dy)); c.fillRect(Math.round(x - hw), Math.round(y + dy), hw * 2 + 1, 1); }
  c.restore();
}

/**
 * Flat stone blocks. `ramp` is [mortar, shade, base, light]: each block gets a lit top and left edge,
 * a quarter of them use the shade tone, and `chip` marks a few with a crack.
 */
export function blocks(c: Ctx, x0: number, y0: number, w: number, h: number, bw: number, bh: number, ramp: string[], r: () => number, chip = 0.12): void {
  const [mortar, sh, base, hi] = ramp;
  c.save();
  c.beginPath(); c.rect(x0, y0, w, h); c.clip();
  for (let row = 0, y = y0; y < y0 + h; row++, y += bh) {
    const off = row % 2 ? Math.floor(bw / 2) : 0;
    for (let x = x0 - off; x < x0 + w; x += bw) {
      const dim = r() < 0.25;
      P(c, dim ? sh : base, x, y, bw, bh);
      P(c, dim ? base : hi, x, y, bw - 1, 1); P(c, dim ? base : hi, x, y, 1, bh - 1);
      P(c, mortar, x + bw - 1, y, 1, bh); P(c, mortar, x, y + bh - 1, bw, 1);
      if (r() < chip) P(c, mortar, x + 2 + Math.floor(r() * (bw - 5)), y + 1 + Math.floor(r() * Math.max(1, bh - 3)), 2, 1);
    }
  }
  c.restore();
}

/** A hanging banner with a rod, a gold stripe and an emblem, swaying a little. */
export function inkBanner(c: Ctx, x: number, y: number, w: number, h: number, cloth: string[], gold: string[], ink: string, t: number): void {
  P(c, ink, x - 2, y - 2, w + 4, 1); P(c, gold[1], x - 1, y - 1, w + 2, 1);
  for (let i = 0; i < h; i++) {
    const off = Math.round(Math.sin(t * 0.5 + i * 0.35 + x) * 0.6);
    const tail = i >= h - 3 ? h - i : 0;
    for (let j = -1; j <= w; j++) {
      if (tail && j >= tail - 1 && j < w - tail + 1) continue;
      P(c, j === -1 || j === w ? ink : j < 3 ? cloth[2] : j > w - 3 ? cloth[0] : cloth[1], x + off + j, y + i);
    }
    if (i === 3) P(c, gold[2], x + off, y + i, w, 1);
    if (i >= 7 && i <= 10) { P(c, gold[1], x + off + 3, y + i, w - 6, 1); if (i === 8 || i === 9) P(c, gold[2], x + off + 4, y + i, w - 8, 1); }
  }
}

/** A wall torch: iron bracket and a three-tone flame that flickers. */
export function inkTorch(c: Ctx, x: number, y: number, t: number, i: number, ink: string): void {
  const f = (t + i) % 3, up = f === 1 ? 1 : 0;
  halo(c, x + 1, y - 1, 9, '255,150,50', 0.22);
  P(c, ink, x - 1, y + 2, 4, 9); P(c, '#6c5a4a', x, y + 4, 2, 6); P(c, '#9c8a70', x, y + 3, 2, 1);
  P(c, ink, x - 2, y - 5 + up, 6, 8);
  P(c, '#c83818', x - 1, y - 4 + up, 4, 6); P(c, '#f88820', x, y - 4 + (f % 2), 2, 6); P(c, '#fcd860', x, y - 1, 2, 3);
}

/** A puffy cloud, already outlined, on its own small canvas. */
export function inkCloud(s: number, flat: boolean, lo: string, mid: string, hi: string, ink: string): HTMLCanvasElement {
  return inked(ink, c => {
    const puffs = [[10, 9, 4], [17, 6, 6], [26, 5, 7], [34, 8, 4]];
    for (const [x, y, r] of puffs) disc(c, mid, x, y, Math.round(r * s));
    for (const [x, y, r] of puffs) disc(c, hi, x - 1, y - 1, Math.max(1, Math.round(r * s) - 2));
    P(c, lo, 6, 11, 32, 2);
    if (flat) P(c, lo, 8, 10, 26, 1);
  }, 44, 16);
}

/** A cone roof in three bands (lit left, mid, shade right) with scallop rows. */
export function cone(c: Ctx, cx: number, top: number, h: number, hw: number, ramp: string[]): void {
  for (let j = 0; j < h; j++) {
    const w = Math.round(((j + 1) / h) * hw);
    for (let dx = -w; dx <= w; dx++) {
      const u = dx / Math.max(1, w);
      let v = u < -0.35 ? 3 : u < 0.3 ? 2 : 1;
      if (j % 4 === 3) v -= 1;
      P(c, ramp[clamp(v, 0, ramp.length - 1)], cx + dx, top + j);
    }
  }
}

/** A pine tree silhouette in three tones, snow on the tips when `snow` is set. */
export function inkPine(c: Ctx, x: number, base: number, h: number, ramp: string[], snow: string | null): void {
  P(c, ramp[0], x, base - 2, 1, 3);
  const tiers = Math.max(2, Math.floor(h / 4));
  for (let i = 0; i < tiers; i++) {
    const ty = base - h + i * Math.floor((h - 2) / tiers);
    for (let j = 0; j < 5; j++) {
      const hw = Math.round((j + 1) * (1 + i * 0.6) * 0.55);
      for (let dx = -hw; dx <= hw; dx++) P(c, dx > 0 ? ramp[2] : ramp[1], x + dx, ty + j);
      if (snow && j === 0) P(c, snow, x, ty);
      if (snow && j === 4) { P(c, snow, x - hw, ty + j); P(c, snow, x + hw - 1, ty + j, 2, 1); }
    }
  }
}

/** A leafy clump: a few cel-shaded balls, lit from the upper left. */
export function clump(c: Ctx, cx: number, cy: number, r: number, ramp: string[], rr: () => number, n: number): void {
  for (let i = 0; i < n; i++) {
    const a = rr() * 6.28, d = Math.sqrt(rr()) * r, R = 3 + rr() * 4;
    ball(c, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7, R, R * 0.8, ramp, -0.45, -0.7);
  }
}

