// Frostpeak Pass.
import { P, rng, hash, type Ctx } from '../../engine/gfx';
import { stamp, sky, mod, bands, inkPine, BW, XL, XR, YT, YB } from '../../art/ink';
import { inkedStage, terrain } from './inked';

/** A mountain range in flat tones, lit from the right: rock and snow, each with a lit and a shaded face. */
function range(c: Ctx, prof: (x: number) => number, bottom: number, rock: string[], snow: string[], snowline: number, ink: string): void {
  for (let x = XL; x < XR; x++) {
    const top = Math.round(prof(x)), lit = prof(x + 1) - prof(x - 1) > 0;
    const line = snowline + Math.round(Math.sin(x * 0.21) * 3 + Math.sin(x * 0.57) * 2) - (lit ? 0 : 3);
    for (let y = Math.max(0, top); y < bottom; y++) {
      const isSnow = y < line;
      P(c, y === top ? ink : isSnow ? snow[lit ? 1 : 0] : rock[lit ? 1 : 0], x, y);
    }
  }
}

export default inkedStage({
  id: 'frostpeak', music: 'stage_frostpeak', name: 'Frostpeak Pass', tag: 'A mountain pass under the aurora', panelSeed: 909,
  panel: { face: '#8a96b4', hi: '#c8d4ec', lo: '#4a5478', lip: '#2e3658', lipLo: '#000000' },
  tex(c, x, y, w, h, r){
    for (let i = 0; i < 3; i++) P(c, '#c8d4ec', x + Math.floor(r() * w), y + Math.floor(r() * h));
    const sx = x + 3 + Math.floor(r() * (w - 10));
    P(c, '#e8f4ff', sx, y + 2, 4, 1); P(c, '#e8f4ff', sx + 3, y + 3, 3, 1);
  },
  back(c){
    const r = rng(33);
    sky(c, 84, ['#080c26', '#121842', '#232660', '#3c3478', '#644a8c', '#9a6496', '#d08494', '#f4aa8c'], '#000008');
    for (let i = 0; i < 150; i++) {
      const x = XL + Math.floor(r() * BW), y = YT + Math.floor(r() * (40 - YT)), b = r();
      P(c, b > 0.8 ? '#ffffff' : b > 0.4 ? '#b8c0f0' : '#6870b0', x, y);
      if (b > 0.95) { P(c, '#6870b0', x - 1, y); P(c, '#6870b0', x + 1, y); P(c, '#6870b0', x, y - 1); P(c, '#6870b0', x, y + 1); }
    }
  },
  behind(c, t){
    // the aurora: a flat ribbon in three steps
    c.save(); c.globalCompositeOperation = 'lighter';
    const ph = t * 0.06;
    for (let x = XL; x < XR; x++) {
      const y = Math.round(14 + Math.sin(x * 0.035 + ph) * 6 + Math.sin(x * 0.09 - ph * 1.3) * 3);
      const a = Math.sin(x * 0.05 + ph * 2) > 0 ? 1 : 0.7;
      c.fillStyle = `rgba(150,255,200,${0.3 * a})`; c.fillRect(x, y, 1, 2);
      c.fillStyle = `rgba(60,220,160,${0.2 * a})`; c.fillRect(x, y + 2, 1, 5);
      c.fillStyle = `rgba(60,200,180,${0.1 * a})`; c.fillRect(x, y + 7, 1, 6);
      if (mod(x, 3) === 0) { c.fillStyle = `rgba(120,140,255,${0.12 * a})`; c.fillRect(x, y - 6, 1, 6); }
    }
    c.restore();
  },
  front(c){
    const r = rng(34);
    range(c, terrain([[-50, 30], [30, 38], [96, 26], [158, 34], [214, 24], [290, 34]], 0.9, 8, 5), 80, ['#6c64a0', '#9a90c0'], ['#bcb8dc', '#f0ecfa'], 46, '#4a4278');
    P(c, 'rgba(240,170,160,0.16)', XL, 66, BW, 14);
    range(c, terrain([[-56, 48], [0, 52], [64, 44], [132, 54], [190, 46], [250, 56], [304, 46]], 0.75, 10, 9), 88, ['#262c5c', '#3a4480'], ['#8a96c8', '#d0daf4'], 58, '#10143a');
    const near = terrain([[-20, 70], [80, 68], [170, 72], [260, 66]], 0.08, 6, 13);
    for (let x = XL; x < XR; x++) {
      const top = Math.round(near(x));
      P(c, '#0e1430', x, top - 1); P(c, '#e8eefc', x, top, 1, 2); P(c, '#a8b4d8', x, top + 2); P(c, '#141c40', x, top + 3, 1, 92 - top);
    }
    stamp(c, '#03060e', c => { for (let i = 0; i < 40; i++) { const x = XL + Math.floor(r() * BW); inkPine(c, x, Math.round(near(x)) + 3, 9 + Math.floor(r() * 8), ['#060c1a', '#0e1c30', '#1a2e44'], '#dce6fa'); } });
    bands(c, XL, 88, BW, 72, ['#8496cc', '#a0b0dc', '#b8c6ea', '#d0daf4', '#e8eefc']);
    P(c, '#e8eefc', XL, 160, BW, YB - 160);
    for (let y = 94; y < YB; y += 6) for (let x = XL; x < XR; x++) { const s = Math.sin(x * 0.07 + y * 1.3); if (s > 0.7) P(c, '#7888c0', x, y); else if (s > 0.55) P(c, '#ffffff', x, y - 1); }
    for (let i = 0; i < 70; i++) P(c, '#ffffff', XL + Math.floor(r() * BW), 92 + Math.floor(r() * (YB - 92)));
  },
  over(c, t){
    const r = rng(35);
    for (let i = 0; i < 130; i++) {
      const x0 = r() * BW, y0 = r() * (94 - YT), far = r() < 0.6, sp = far ? 0.4 + r() * 0.3 : 0.9 + r() * 0.8;
      const y = YT + (y0 + t * sp) % (94 - YT);
      const x = XL + mod(x0 + Math.sin((t + y0) * 0.1) * (far ? 2 : 4), BW);
      if (far) P(c, '#c8d0f0', x, y); else { P(c, '#ffffff', x, y, 2, 2); P(c, '#8a96c8', x + 1, y + 2, 1, 1); }
    }
    const n = Math.floor(t / 60), age = t % 60;
    if (age < 10) {
      const sx = XL + hash(n, 1, 7) * BW * 0.7, sy = YT + 10 + hash(n, 2, 7) * 60;
      for (let k = 0; k < 10; k++) { const d = age * 5 - k; if (d >= 0) P(c, k < 2 ? '#ffffff' : k < 5 ? '#c8d8ff' : '#6a7ab8', sx + d * 2, sy + d, 2, 1); }
    }
    for (let g = 0; g < 3; g++) {
      const gy = [84, 90, 20][g], x = XL - 60 + mod(t * 5 + g * 150, BW + 120);
      for (let k = 0; k < 7; k++) P(c, k % 2 ? '#ffffff' : '#c8d4f0', x - k * 6 + Math.round(Math.sin(k + t * 0.3) * 1), gy + (k % 3) - 1, 4, 1);
    }
  }
});
