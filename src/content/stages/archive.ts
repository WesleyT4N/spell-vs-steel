// Arcane Archive.
import { P, rng, mix } from '../../engine/gfx';
import { stamp, mod, disc, ball, halo, blocks, BW, XL, XR, YT, YB } from '../../art/ink';
import { inkedStage, poly } from './inked';

/** The Arcane Archive's moonlit gothic window. */
function inWin(x: number, y: number): boolean {
  if (Math.abs(x - 120) > 20) return false;
  if (y >= 30) return y < 72;
  return (x - 132) ** 2 + (y - 30) ** 2 <= 900 && (x - 108) ** 2 + (y - 30) ** 2 <= 900;
}

export default inkedStage({
  id: 'archive', music: 'stage_archive', name: 'Arcane Archive', tag: 'A candlelit library tower', panelSeed: 707,
  panel: { face: '#4a34a8', hi: '#7a5ce0', lo: '#2a1a78', lip: '#1c1258', lipLo: '#000000' },
  tex(c, x, y, w, h, r){
    const g = [[1,0,1,0,1, 0,1,1,1,0, 1,0,1,0,1], [0,1,1,1,0, 1,0,1,0,1, 0,1,1,1,0], [1,1,0,1,1, 0,1,1,1,0, 0,0,1,0,0]][Math.floor(r() * 3)];
    const gx = x + Math.floor(w / 2) - 2, gy = y + Math.floor(h / 2) - 1;
    g.forEach((v, i) => v && P(c, '#a088f0', gx + (i % 5), gy + Math.floor(i / 5)));
  },
  back(c){
    const r = rng(22);
    blocks(c, -80, -84, 400, 176, 16, 6, ['#0a0614', '#181028', '#20163a', '#2c2048'], r, 0.08);
    P(c, 'rgba(0,0,10,0.35)', XL, YT, BW, 30 - YT);
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
    for (const [sx, sw] of [[-90, 44], [-44, 44], [2, 44], [48, 44], [148, 44], [194, 44], [240, 44], [286, 44]]) stamp(c, '#0a0402', c => {
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
    // the ceiling: a carved beam on corbels over the shelves
    stamp(c, '#0a0402', c => {
      P(c, WD[4], XL, -14, BW, 1); P(c, WD[3], XL, -13, BW, 3); P(c, WD[1], XL, -10, BW, 2);
      for (let x = -66; x < XR; x += 46) { P(c, WD[3], x, -8, 6, 3); P(c, WD[2], x + 1, -5, 4, 2); P(c, WD[4], x, -8, 6, 1); }
      for (let x = -40; x < XR; x += 46) { P(c, '#5a4a30', x + 2, -40, 1, 26); P(c, '#8a6a20', x, -40, 5, 1); }
    });
    // checkered floor
    for (let y = 92; y < YB; y++) for (let x = XL; x < XR; x++) {
      const tile = mod(Math.floor(x / 12) + Math.floor((y - 92) / 6), 2), top = (y - 92) % 6 === 0;
      P(c, tile ? (top ? '#3a2e56' : '#2a2040') : (top ? '#241c36' : '#16102a'), x, y);
    }
    P(c, 'rgba(0,0,0,0.45)', XL, 92, BW, 3);
    // the orrery stand
    stamp(c, '#140c02', c => { P(c, '#5a4010', 117, 80, 6, 10); P(c, '#a07020', 117, 80, 2, 10); P(c, '#3a2808', 112, 88, 16, 3); P(c, '#e8b840', 112, 88, 16, 1); });
    // moonlight on the floor, flat
    c.save(); c.globalCompositeOperation = 'lighter';
    poly(c, [[100, 92], [140, 92], [124, YB], [60, YB]], 'rgba(90,110,220,0.08)');
    c.restore();
  },
  over(c, t){
    for (const [cy, sp, w] of [[20, 0.25, 14], [34, 0.4, 10], [52, 0.18, 18]]) {
      const cx = 80 + mod(t * sp + cy * 3, 80);
      for (let x = Math.floor(cx - w / 2); x < cx + w / 2; x++) for (let y = cy - 2; y < cy + 2; y++) {
        const e = Math.abs(x - cx) / (w / 2) + Math.abs(y - cy + 0.5) / 2;
        if (e < 1.2 && inWin(x, y) && x !== 120 && y !== 44) P(c, y < cy ? '#5a6aa8' : '#3a4a84', x, y);
      }
    }
    const BOOK = [['#8a2a1a', '#c84a2a'], ['#1a4a6a', '#3a7ab0'], ['#2a5a2a', '#4a9a4a'], ['#5a2a74', '#8a44a0']];
    [[44, 30, 0], [196, 26, 1], [-26, 44, 2], [264, 40, 3]].forEach(([bx, by, i]) => {
      const x = Math.round(bx + Math.sin(t * 0.05 + i * 2) * 10), y = Math.round(by + Math.sin(t * 0.09 + i) * 4), open = Math.floor(t / 3 + i) % 2;
      halo(c, x + 3, y + 2, 6, '120,180,255', 0.18);
      P(c, '#0a0614', x - 1, y - 1 - open, 9, 5 + open);
      P(c, BOOK[i][0], x, y, 3, 3); P(c, BOOK[i][0], x + 4, y, 3, 3); P(c, BOOK[i][1], x, y, 3, 1); P(c, BOOK[i][1], x + 4, y, 3, 1);
      P(c, '#f0e8d0', x + 1, y - 1 - open, 2, 1 + open); P(c, '#f0e8d0', x + 4, y - 1 - open, 2, 1 + open); P(c, '#c8b8a0', x + 3, y - 1, 1, 4);
    });
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
    [[24, 30], [66, 22], [176, 24], [214, 32], [92, 56], [150, 52], [-22, 26], [262, 28], [-60, 40], [300, 40]].forEach(([x, y], i) => {
      const b = Math.round(Math.sin(t * 0.35 + i * 1.3) * 1.5);
      halo(c, x + 1, y + b - 1, 9, '255,180,80', 0.25);
      P(c, '#2a1a10', x - 1, y + b - 1, 4, 8);
      P(c, '#e8e0c8', x, y + b, 2, 6); P(c, '#a89c80', x + 1, y + b + 1, 1, 5); P(c, '#fff8e8', x, y + b, 1, 1);
      P(c, (t + i) % 2 ? '#ff8a20' : '#ffb030', x, y + b - 3, 2, 3); P(c, '#fff4c0', x, y + b - 2, 1, 2);
    });
    const r = rng(23);
    for (let i = 0; i < 22; i++) {
      const ph = r() * 100, cx = XL + 10 + r() * (BW - 20), sp = 0.5 + r() * 0.6;
      const y = 92 - ((ph + t * sp) % 150), x = cx + Math.sin((y + ph) * 0.12) * 4;
      P(c, '#3cb8e0', x - 1, y, 3, 1); P(c, '#3cb8e0', x, y - 1, 1, 3); P(c, '#e0fcff', x, y);
    }
  }
});
