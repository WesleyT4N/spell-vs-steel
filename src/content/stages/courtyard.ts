// Castle Courtyard.
import { P, rng, hash, type Ctx } from '../../engine/gfx';
import { stoneTex, PURPLE, GOLD } from '../../art/arena';
import { stamp, sky, mod, disc, blocks, inkBanner, inkTorch, inkCloud, cone, BW, XL, XR, YB } from '../../art/ink';
import { inkedStage, terrain, IVY, IVY_INK } from './inked';

const SKY = ['#2c58c0', '#3c70d4', '#5a90e4', '#82b2ee', '#b4d4f6', '#dceaf8'];
const GREY = ['#46424e', '#625e6c', '#86828e', '#aaa6b0', '#cfccd4'], GREY_INK = '#221e2a';
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

export default inkedStage({
  id: 'courtyard', music: 'stage_courtyard', name: 'Castle Courtyard', tag: 'Flagstones inside the keep', panelSeed: 909,
  panel: { face: '#b8b4bc', hi: '#e8e4ea', lo: '#76727e', lip: '#56525e', lipLo: '#000000' },
  tex: stoneTex,
  back(c){
    sky(c, 72, SKY, '#101848');
    disc(c, '#f8c050', 66, 12, 6); disc(c, '#fce49c', 66, 12, 5); disc(c, '#fffbe8', 65, 11, 3);
    const hills = terrain([[-60, 52], [0, 56], [70, 50], [150, 54], [230, 48], [300, 54]], 0.25, 6, 21);
    for (let x = XL; x < XR; x++) { const top = Math.round(hills(x)); P(c, '#4e7c94', x, top, 1, 1); P(c, hills(x + 1) > hills(x - 1) ? '#82aab6' : '#6a96a8', x, top + 1, 1, 80 - top); }
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
    [[20, 4], [130, 0], [210, 10], [-30, -26], [170, -40], [280, -18], [60, -62]].forEach(([cx, cy], i) => c.drawImage(dayClouds![i % 3], Math.round(XL - 44 + mod(cx - XL + t * 0.18 * (1 + (i % 3) * 0.3), BW + 88)), cy));
  },
  front(c){
    const r = rng(62);
    // curtain wall
    stamp(c, GREY_INK, c => {
      blocks(c, -70, 52, BW + 10, 40, 10, 5, [GREY[0], GREY[1], GREY[2], GREY[3]], r);
      merlons(c, -72, XR, 46, 6, 8, 5, GREY);
      P(c, GREY[4], XL, 52, BW, 1);
    });
    P(c, 'rgba(20,16,30,0.3)', XL, 53, BW, 2);
    stamp(c, IVY_INK, c => [[30, 54, 26], [74, 56, 18], [160, 54, 30], [200, 58, 16], [-14, 56, 22], [254, 55, 24]].forEach(([vx, vy, len], k) => ivy(c, vx, vy, len, k)));
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
    for (const tx of [-62, 6, 204, 272]) {
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
    for (let y = 90; y < YB; y++) for (let x = XL; x < XR; x++) {
      const row = Math.floor((y - 90) / 7), off = (row * 9) % 16, cellX = Math.floor((x + off) / 16);
      const seam = (y - 90) % 7 === 6 || mod(x + off, 16) === 15;
      P(c, seam ? FL[0] : (y - 90) % 7 === 0 || mod(x + off, 16) === 0 ? FL[3] : hash(cellX, row, 4) < 0.35 ? FL[1] : FL[2], x, y);
    }
    for (let i = 0; i < 60; i++) { const x = XL + Math.floor(r() * BW), y = 92 + Math.floor(r() * (YB - 94)); P(c, IVY[0], x, y, 3, 1); P(c, IVY[1], x + 1, y - 1, 1, 1); }
    P(c, 'rgba(20,16,30,0.3)', XL, 90, BW, 3);
  },
  over(c, t){
    inkBanner(c, 58, 56, 9, 20, PURPLE, GOLD, GREY_INK, t);
    inkBanner(c, 174, 56, 9, 20, PURPLE, GOLD, GREY_INK, t);
    inkBanner(c, -6, 58, 9, 20, PURPLE, GOLD, GREY_INK, t);
    inkBanner(c, 238, 58, 9, 20, PURPLE, GOLD, GREY_INK, t);
    inkTorch(c, 100, 64, t, 0, GREY_INK); inkTorch(c, 139, 64, t, 1, GREY_INK);
    // guards pacing the wall walk, only head, shoulders and spear above the merlons
    [[44, 88, 0], [152, 198, 40], [-24, 0, 90], [242, 266, 20]].forEach(([x0, x1, ph]) => {
      const span = x1 - x0, k = mod(t * 0.5 + ph, span * 2), x = Math.round(x0 + (k < span ? k : span * 2 - k)), bob = Math.floor(t / 2) % 2;
      P(c, GREY_INK, x - 2, 39 - bob, 5, 8); P(c, '#9690a8', x - 1, 40 - bob, 3, 2); P(c, '#e8b890', x - 1, 42 - bob, 3, 1);
      P(c, PURPLE[1], x - 1, 43 - bob, 3, 3); P(c, GOLD[1], x, 44 - bob, 1, 1);
      P(c, '#5a3a1a', x + (k < span ? 3 : -3), 34 - bob, 1, 12); P(c, '#e6e2ec', x + (k < span ? 3 : -3), 32 - bob, 1, 2);
    });
    const r = rng(63);
    for (let i = 0; i < 4; i++) {
      const ph = r() * 300, y0 = 14 + r() * 20 - (i === 3 ? 40 : 0), x = XL - 30 + mod(ph + t * (1.4 + i * 0.3), BW + 60), flap = Math.floor(t / 2 + i) % 2;
      P(c, '#2a2a34', x, y0, 1, 1); P(c, '#2a2a34', x - 2, y0 - flap, 2, 1); P(c, '#2a2a34', x + 1, y0 - flap, 2, 1);
    }
  }
});
