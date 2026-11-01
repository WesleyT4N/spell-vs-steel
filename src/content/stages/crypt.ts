// The Sunken Crypt: Expedition act 2. Not in the stage select (see index.ts): it only hosts the Crypt's fights.
import { P, rng } from '../../engine/gfx';
import { stamp, mod, disc, halo, blocks, inkTorch, BW, XL, XR, YT, YB } from '../../art/ink';
import { inkedStage } from './inked';

const STONE = ['#14141c', '#22222e', '#30303e', '#40404e', '#56566a'];
const BONE = ['#7c7468', '#bcb4a0', '#e8e0c8'];

/** A round-topped arch opening: true inside it. */
const inArch = (x: number, y: number, cx: number, top: number, hw: number, bottom: number): boolean =>
  y < bottom && Math.abs(x - cx) <= hw && (y >= top + hw || (x - cx) ** 2 + (y - top - hw) ** 2 <= hw * hw);

export default inkedStage({
  id: 'crypt', music: 'stage_archive', name: 'Sunken Crypt', tag: 'Bones under the old abbey', panelSeed: 313,
  panel: { face: '#4c4c5c', hi: '#7c7c90', lo: '#2c2c3a', lip: '#1c1c26', lipLo: '#000000' },
  tex(c, x, y, w, h, r){
    // cracks and the odd bone chip in the flagstones
    const cx = x + 2 + Math.floor(r() * (w - 6)), cy = y + 1 + Math.floor(r() * (h - 3));
    P(c, '#22222e', cx, cy, 3, 1); P(c, '#22222e', cx + 2, cy + 1, 2, 1);
    if (r() < 0.4) P(c, BONE[1], x + Math.floor(r() * w), y + Math.floor(r() * h), 2, 1);
  },
  back(c){
    const r = rng(31);
    // vault walls of big dark blocks
    blocks(c, XL, YT, BW, 176, 18, 8, STONE.slice(0, 4), r, 0.1);
    P(c, 'rgba(0,0,8,0.4)', XL, YT, BW, 40);
    // three deep arches with darkness behind and skull niches between
    for (const ax of [-30, 60, 180, 270]) stamp(c, '#06060a', c => {
      for (let y = -30; y < 92; y++) for (let x = ax - 26; x <= ax + 26; x++) {
        if (inArch(x, y, ax, -20, 22, 92)) P(c, y > 70 ? '#0c0c12' : '#08080c', x, y);
        else if (inArch(x, y, ax, -24, 26, 92)) P(c, x < ax ? STONE[4] : STONE[3], x, y);
      }
    });
    // rows of skulls in the walls between the arches (an ossuary)
    for (const sx of [10, 110, 220]) stamp(c, '#06060a', c => {
      for (let row = 0; row < 4; row++) for (let i = 0; i < 4; i++) {
        const x = sx + i * 9 + (row % 2) * 4, y = 4 + row * 14;
        disc(c, BONE[1], x + 3, y + 3, 3); P(c, BONE[2], x + 1, y + 1, 2, 1);
        P(c, '#06060a', x + 1, y + 3, 2, 2); P(c, '#06060a', x + 4, y + 3, 2, 2); P(c, BONE[0], x + 2, y + 6, 3, 1);
      }
    });
    // stone floor of the vault
    for (let y = 92; y < YB; y++) for (let x = XL; x < XR; x++) {
      const tile = mod(Math.floor(x / 16) + Math.floor((y - 92) / 8), 2), top = (y - 92) % 8 === 0;
      P(c, tile ? (top ? STONE[3] : STONE[2]) : (top ? STONE[2] : STONE[1]), x, y);
    }
    P(c, 'rgba(0,0,0,0.5)', XL, 92, BW, 3);
  },
  front(c){
    // two stone sarcophagi at the back of the hall
    for (const sx of [86, 136]) stamp(c, '#06060a', c => {
      P(c, STONE[3], sx, 76, 22, 14); P(c, STONE[4], sx, 76, 22, 2); P(c, STONE[2], sx, 86, 22, 4);
      P(c, STONE[4], sx - 1, 74, 24, 2); P(c, BONE[0], sx + 9, 79, 4, 1); P(c, BONE[0], sx + 10, 78, 2, 3);
    });
  },
  over(c, t){
    // candles and torches, and green soul-lights drifting up
    [[60, 40], [180, 40], [-30, 44], [270, 44]].forEach(([x, y], i) => inkTorch(c, x, y, t, i, '#06060a'));
    halo(c, 120, 74, 30, '120,255,160', 0.06 + 0.02 * Math.sin(t * 0.2));
    const r = rng(37);
    for (let i = 0; i < 14; i++) {
      const ph = r() * 100, cx = XL + 20 + r() * (BW - 40), sp = 0.25 + r() * 0.3;
      const y = 92 - ((ph + t * sp) % 130), x = cx + Math.sin((y + ph) * 0.1) * 5;
      halo(c, x, y, 4, '120,255,160', 0.25);
      P(c, '#58d854', x - 1, y, 2, 2); P(c, '#d8fcd0', x, y, 1, 1);
    }
  },
});
