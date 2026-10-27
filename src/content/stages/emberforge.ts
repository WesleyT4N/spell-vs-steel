// Emberforge.
import { P, rng, clamp, hash, pixels } from '../../engine/gfx';
import { GOLD } from '../../art/arena';
import { stamp, mod, tone, disc, ball, halo, blocks, sparks, BW, XL, XR, YT, YB } from '../../art/ink';
import { inkedStage } from './inked';

export default inkedStage({
  id: 'emberforge', name: 'Emberforge', tag: 'A dwarven forge in a volcano', panelSeed: 1010,
  panel: { face: '#5a4a44', hi: '#8a7a6a', lo: '#2a201c', lip: '#3a2e28', lipLo: '#000000' },
  tex(c, x, y, w, h){
    [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]].forEach(([dx, dy]) => P(c, '#d8a030', x + dx, y + dy));
    P(c, '#2a201c', x + 3, y + Math.floor(h / 2), w - 6, 1); P(c, '#8a7a6a', x + 3, y + Math.floor(h / 2) + 1, w - 6, 1);
  },
  back(c){
    const r = rng(44), ROCK = ['#140a08', '#22120c', '#341c12', '#4a2a1a', '#663c22', '#8a5430'], INK = '#080404';
    // the cave wall: big flat boulders, each lit by the nearest fire, outlined in ink
    const lights = [[38, 50, 70], [202, 50, 70], [120, 74, 46], [120, 92, 90], [-36, 50, 60], [272, 50, 60]];
    const G = 14, seeds: number[][] = [];
    // seeds on a jittered grid; each pixel only checks the 3x3 grid cells around it
    const gx0 = Math.floor(XL / G) - 1, gy0 = Math.floor(YT / G) - 1, gw = Math.ceil(XR / G) + 2 - gx0, gh = Math.ceil(98 / G) + 2 - gy0;
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) seeds.push([(gx + gx0) * G + r() * G, (gy + gy0) * G + r() * G * 0.8]);
    const cell = (x: number, y: number): number => {
      let best = 0, bd = Infinity;
      const cx = Math.floor(x / G) - gx0, cy = Math.floor(y / G) - gy0;
      for (let j = Math.max(0, cy - 2); j <= Math.min(gh - 1, cy + 2); j++) for (let i = Math.max(0, cx - 2); i <= Math.min(gw - 1, cx + 2); i++) {
        const k = j * gw + i, dx = seeds[k][0] - x, dy = (seeds[k][1] - y) * 1.4, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = k; }
      }
      return best;
    };
    const RW = BW, at = (x: number, y: number): number => (y - YT) * RW + (x - XL);
    const ids: number[] = [];
    for (let y = YT; y < 98; y++) for (let x = XL; x < XR; x++) ids[at(x, y)] = cell(x, y);
    const lit = seeds.map(([sx, sy]) => { let L = 0; for (const [lx, ly, rad] of lights) L += clamp(1 - Math.hypot(sx - lx, (sy - ly) * 1.3) / rad) ** 1.3; return clamp(0.12 + L * 0.7); });
    for (let y = YT; y < 98; y++) for (let x = XL; x < XR; x++) {
      const id = ids[at(x, y)];
      const edge = (x < XR - 1 && ids[at(x + 1, y)] !== id) || (y < 97 && ids[at(x, y + 1)] !== id);
      const rim = (x > XL && ids[at(x - 1, y)] !== id) || (y > YT && ids[at(x, y - 1)] !== id);
      P(c, edge ? INK : tone(ROCK, lit[id] + (rim ? 0.2 : 0)), x, y);
    }
    // stalactites
    stamp(c, INK, c => {
      for (let i = -5; i < 21; i++) {
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
    for (let x = XL; x < XR; x++) { P(c, '#e8743a', x, 91); P(c, '#8a4422', x, 92); P(c, '#341c12', x, 93, 1, 4); P(c, INK, x, 97); }
    P(c, '#0c0604', XL, 98, BW, YB - 98);
    // the cave floor: basalt slabs split by glowing cracks, fading into the dark
    stamp(c, INK, c => {
      for (let row = 0, y = 100; y < YB; row++, y += 14) for (let x = XL - 20 + (row % 2) * 17; x < XR; x += 34) {
        const lit = y < 170 ? 1 : 0, w = 28 + Math.floor(r() * 4);
        P(c, ['#1a0e0a', '#22120c'][lit], x, y, w, 11); P(c, ['#22120c', '#341c12'][lit], x, y, w, 1); P(c, ['#22120c', '#341c12'][lit], x, y, 1, 11);
      }
    });
    for (let row = 0, y = 112; y < YB; row++, y += 14) if (row % 3 === 1) for (let x = XL; x < XR; x++) if (hash(x >> 3, row, 9) < 0.18) P(c, '#c83000', x, y, 1, 1);
  },
  over(c, t){
    const LAVA = ['#8a1400', '#c83000', '#f05a10', '#ff8a20', '#ffb840', '#ffe890'];
    for (const lx of [-40, 36, 200, 268]) {
      halo(c, lx + 4, 50, 26, '255,90,20', 0.18);
      P(c, '#3a0800', lx - 1, 10, 1, 77); P(c, '#3a0800', lx + 9, 10, 1, 77);
      const lava = pixels(c);
      // every pixel is painted once, so going down each column (where the color changes least) is the same picture
      for (let i = 0; i < 9; i++) for (let y = 10; y < 87; y++) {
        const v = 0.55 + Math.sin((y - t * 2.2) * 0.45 + i * 1.7) * 0.25 + (i > 1 && i < 7 ? 0.2 : -0.25);
        lava.px(tone(LAVA, v), lx + i, y);
      }
      lava.done();
      for (let i = 0; i < 4; i++) { const ph = (t * 0.7 + i * 5) % 8; ball(c, lx + 1 + i * 2.5, 86 - ph * 0.6, 1.5, 1.5, ['#c83000', '#ff8a20', '#ffe890']); }
    }
    const floor = pixels(c);
    for (let y = 86; y < 91; y++) for (let x = XL; x < XR; x++) floor.px(tone(LAVA, 0.55 + Math.sin(x * 0.25 - t * 0.9 + y * 1.4) * 0.3), x, y);
    floor.done();
    P(c, '#3a0800', XL, 85, BW, 1);
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
    const hit = t % 24;
    if (hit < 7) { sparks(c, 66, 75, hit / 7, Math.floor(t / 24), 14, ['#ffffff', '#ffe890', '#ffb840', '#f05a10', '#8a1400']); if (hit < 2) halo(c, 66, 75, 8, '255,220,120', 0.5); }
    for (let b = 0; b < 6; b++) {
      const n = Math.floor((t + b * 7) / 16), age = (t + b * 7) % 16, x = XL + Math.floor(hash(n, b, 3) * BW);
      if (age < 6) { const rr = age < 4 ? 1 + age * 0.5 : 0; if (rr) ball(c, x, 88 - rr, rr, rr, ['#c83000', '#ff8a20', '#ffe890']); else { P(c, '#ffb840', x - 2, 85, 1, 1); P(c, '#ffb840', x + 2, 84, 1, 1); P(c, '#ffe890', x, 83, 1, 1); } }
    }
    for (let k = 0; k < 6; k++) {
      const age = mod(t * 0.4 + k * 9, 54), y = 6 - age * 1.6, x = 120 + Math.sin(age * 0.12 + k) * (2 + age * 0.15), rad = 3 + age * 0.12;
      disc(c, age < 20 ? '#2a201c' : '#1e1614', Math.round(x), Math.round(y), rad); disc(c, '#3a2e28', Math.round(x - 1), Math.round(y - 1), Math.max(1, rad - 2));
    }
    const r = rng(45);
    for (let i = 0; i < 40; i++) {
      const sx = XL + r() * BW, sp = 0.8 + r(), ph = r() * 160;
      const y = 84 - ((ph + t * sp) % (84 - YT)), x = sx + Math.sin((t + ph) * 0.15) * 3;
      P(c, y < 30 ? '#c83000' : '#ffd060', x, y); if (y > 50) P(c, '#ff8a20', x, y + 1);
    }
  }
});
