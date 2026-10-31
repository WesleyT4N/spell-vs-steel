// Elderwood Ruins.
import { P, rng, clamp, hash } from '../../engine/gfx';
import { stamp, sky, mod, bands, halo, clump, BW, XL, XR, YT, YB } from '../../art/ink';
import { inkedStage, poly, IVY, IVY_INK } from './inked';

export default inkedStage({
  id: 'elderwood', music: 'stage_elderwood', name: 'Elderwood Ruins', tag: 'An overgrown temple at dusk', panelSeed: 909,
  panel: { face: '#b08a3c', hi: '#e8c878', lo: '#6a5020', lip: '#4a3818', lipLo: '#000000' },
  tex(c, x, y, w, h, r){
    const corner = Math.floor(r() * 4), mx = corner % 2 ? x + w - 5 : x, my = corner > 1 ? y + h - 2 : y;
    P(c, '#2c6a3a', mx, my, 5, 2); P(c, '#4c9a4e', mx + (corner % 2 ? 1 : 0), my + (corner > 1 ? 0 : 0), 4, 1);
    P(c, '#2c6a3a', mx + (corner % 2 ? 3 : 0), my + (corner > 1 ? -1 : 2), 2, 1);
    for (let i = 0; i < 3; i++) P(c, '#e8c878', x + Math.floor(r() * w), y + Math.floor(r() * h));
  },
  back(c){
    const r = rng(55);
    sky(c, 80, ['#142436', '#1a3444', '#24504e', '#3c6c58', '#7a9a64', '#c8bc72', '#f0d688'], '#04080c');
    halo(c, 132, 66, 34, '255,220,140', 0.3);
    stamp(c, '#1e3434', c => {
      for (let x = XL - 6; x < XR + 6; x += 9) clump(c, x, 58 + Math.sin(x * 0.07) * 4, 7, ['#2e4a48', '#3a5a54', '#4a6c5e', '#6a8a6a'], r, 4);
      P(c, '#2e4a48', XL, 64, BW, 28);
    });
    stamp(c, '#0a1a14', c => {
      for (let x = XL - 6; x < XR + 6; x += 11) clump(c, x, 70 + Math.sin(x * 0.05 + 2) * 3, 8, ['#16302a', '#1e3e30', '#2a5038', '#3c6840'], r, 5);
      P(c, '#16302a', XL, 76, BW, 16);
    });
  },
  front(c){
    const r = rng(56), STN = ['#464c40', '#5e6656', '#7a826e', '#9aa28a', '#bcc4a8'], SINK = '#1e2218';
    c.save(); c.globalCompositeOperation = 'lighter';
    [[96, 10], [124, 7], [150, 12]].forEach(([x, w]) => poly(c, [[x - 10, -26], [x + w - 10, -26], [x + w + 36, 92], [x + 18, 92]], 'rgba(255,230,150,0.07)'));
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
    for (const [tx, tw, side] of [[-64, 18, 1], [-36, 16, -1], [0, 22, 1], [218, 22, -1], [260, 16, 1], [286, 18, -1]]) stamp(c, '#0a0604', c => {
      for (let y = YT; y < 92; y++) {
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
      // the canopy carries on above and to the sides, thinning toward a gap over the temple
      for (let x = XL - 4; x < 0; x += 9) for (let y = 14; y > YT - 10; y -= 12) clump(c, x, y + mod(x, 5), 9, LEAF, r, 5);
      for (let x = 244; x < XR + 4; x += 9) for (let y = 14; y > YT - 10; y -= 12) clump(c, x, y + mod(x, 5), 9, LEAF, r, 5);
      for (let x = -4; x < 248; x += 10) for (let y = -12; y > YT - 10; y -= 12) if (Math.abs(x - 120) > 30 + (y + 12) * 0.6) clump(c, x, y + mod(x, 7), 9, LEAF, r, 5);
    });
    bands(c, XL, 90, BW, 70, ['#16301a', '#1e3c1e', '#284a24', '#32582a', '#3c662e']);
    P(c, '#3c662e', XL, 160, BW, YB - 160);
    P(c, '#0a1a0e', XL, 90, BW, 1);
    for (let i = 0; i < 160; i++) { const x = XL + Math.floor(r() * BW), y = 93 + Math.floor(r() * (YB - 94)); P(c, '#4c7a34', x, y - 2, 1, 3); P(c, '#6a9a44', x + 1, y - 1, 1, 2); P(c, '#16301a', x - 1, y, 1, 1); }
    for (let i = 0; i < 40; i++) P(c, ['#f0f0e0', '#f0a8c8', '#f8e070'][i % 3], XL + Math.floor(r() * BW), 92 + Math.floor(r() * (YB - 92)));
  },
  over(c, t){
    const r = rng(57);
    for (let i = 0; i < 16; i++) {
      const x0 = 24 + r() * 192, y0 = 20 + r() * 66;
      const x = x0 + Math.sin(t * 0.13 + i) * 6, y = y0 + Math.cos(t * 0.11 + i * 2) * 4;
      if ((t + i * 3) % 12 >= 7) continue;
      halo(c, x, y, 3, '200,255,100', 0.5); P(c, '#f0ffa0', x, y);
    }
    c.save(); c.globalCompositeOperation = 'lighter';
    const glow = 0.03 + 0.03 * Math.sin(t * 0.08);
    [[96, 10], [124, 7], [150, 12]].forEach(([x, w], i) => poly(c, [[x - 10, -26], [x + w - 10, -26], [x + w + 36, 92], [x + 18, 92]], `rgba(255,230,150,${(glow * (1 + 0.5 * Math.sin(t * 0.05 + i * 2))).toFixed(3)})`));
    c.restore();
    [[40, 70, '#f0a8c8'], [190, 66, '#f8e070'], [150, 84, '#a8d8f8'], [-30, 60, '#f0f0e0'], [270, 70, '#f0a8c8']].forEach(([bx, by, col], i) => {
      const x = Math.round((bx as number) + Math.sin(t * 0.07 + i * 3) * 18), y = Math.round((by as number) + Math.sin(t * 0.17 + i) * 6), up = (t + i) % 2;
      P(c, '#1e2218', x, y, 1, 2);
      if (up) { P(c, col as string, x - 2, y - 2, 2, 2); P(c, col as string, x + 1, y - 2, 2, 2); }
      else { P(c, col as string, x - 1, y, 1, 2); P(c, col as string, x + 1, y, 1, 2); }
    });
    for (let i = 0; i < 6; i++) {
      const ph = r() * 100, sx = 30 + r() * 180;
      const y = (ph + t * 0.5) % 92, x = sx + Math.sin((y + ph) * 0.1) * 8;
      P(c, i % 2 ? '#c8a040' : '#6a9a44', x, y, 2, 1); P(c, i % 2 ? '#8a6a20' : '#447a3c', x + (Math.floor(y / 4) % 2), y + 1);
    }
  }
});
