// Low-poly stage dioramas behind the 6×3 grid. Grid space: x = column (0..6), z = row (0..3, front is +z),
// y = up. The camera looks down at 30°, so everything behind the grid (z < 0) and above it fills the top of the screen.
import * as T from 'three';
import { add, G } from './kit';

export interface Set3 { group: T.Group; sky: number; ground: number; tick?(t: number): void }

/** Deterministic little random for prop placement. */
function rnd(seed: number): () => number { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function ground(g: T.Group, col: number, edge?: number): void {
  add(g, G.box(30, 0.4, 24), col, [3, -0.42, 2]);
  if (edge !== undefined) add(g, G.box(6.6, 0.3, 3.4), edge, [3, -0.3, 1.4]);
}
function pillar(g: T.Object3D, x: number, z: number, h: number, col: number, cap = col): void {
  add(g, G.cyl(0.28, 0.32, h, 6), col, [x, h / 2, z], [0, 0, 0], [1, 1, 1], { rough: 0.02 });
  add(g, G.box(0.8, 0.22, 0.8), cap, [x, h + 0.1, z]);
  add(g, G.box(0.8, 0.22, 0.8), cap, [x, 0.1, z]);
}
function pine(g: T.Object3D, x: number, z: number, s: number, col: number, snow?: number): void {
  add(g, G.cyl(0.08 * s, 0.1 * s, 0.5 * s, 5), 0x5a3a20, [x, 0.25 * s, z]);
  for (let i = 0; i < 3; i++) add(g, G.cone((0.7 - i * 0.18) * s, 0.8 * s, 6), i === 2 && snow ? snow : col, [x, (0.75 + i * 0.45) * s, z], [0, i, 0], [1, 1, 1], { rough: 0.03 });
}
function leafTree(g: T.Object3D, x: number, z: number, s: number, leaf: number, r: () => number): void {
  add(g, G.cyl(0.12 * s, 0.18 * s, 1.4 * s, 5), 0x5a3a20, [x, 0.7 * s, z]);
  for (let i = 0; i < 3; i++) add(g, G.ico((0.55 + r() * 0.3) * s, 0), leaf, [x + (r() - 0.5) * 0.7 * s, (1.6 + r() * 0.6) * s, z + (r() - 0.5) * 0.5], [r() * 3, r() * 3, 0], [1, 1, 1], { rough: 0.04 });
}
function glowBit(g: T.Object3D, x: number, y: number, z: number, col: number, r = 0.08): T.Mesh {
  add(g, G.sphere(r * 3, 6), col, [x, y, z], [0, 0, 0], [1, 1, 1], { glow: 1, alpha: 0.25 });
  return add(g, G.ico(r, 0), col, [x, y, z], [0, 0, 0], [1, 1, 1], { glow: 1 });
}

const SETS: Record<string, () => Set3> = {
  colosseum: () => {
    const g = new T.Group(), r = rnd(7);
    ground(g, 0xd8b878, 0xc8a060);
    // the arena wall: a ring of arches around the back, crowd above
    for (let i = -7; i <= 13; i++) {
      const x = i * 1.0, z = -2.6 - Math.pow((x - 3) / 7, 2) * 1.2;
      add(g, G.box(1.0, 1.6, 0.6), 0xc8a878, [x, 0.8, z], [0, 0, 0], [1, 1, 1], { rough: 0.02 });
      add(g, G.box(0.5, 0.9, 0.1), 0x5a4030, [x, 0.6, z + 0.3]);
      add(g, G.box(1.0, 0.25, 0.7), 0xe8d0a0, [x, 1.65, z]);
      for (let k = 0; k < 3; k++) {
        const zz = z - 0.6 - k * 0.6, y = 2.0 + k * 0.5;
        add(g, G.box(1.0, 0.5, 0.6), 0xb89868, [x, y - 0.25, zz]);
        if (r() < 0.8) add(g, G.box(0.28, 0.42, 0.24), [0xc83030, 0x3060c8, 0xe8c040, 0x40a040, 0xe8e0d0][Math.floor(r() * 5)], [x + (r() - 0.5) * 0.5, y + 0.2, zz]);
      }
    }
    for (const x of [-1.5, 7.5]) { add(g, G.box(0.08, 2.4, 0.08), 0x5a4030, [x, 3.2, -3.4]); add(g, G.box(0.9, 1.3, 0.04), 0xc8303a, [x + 0.45, 3.6, -3.4]); }
    return { group: g, sky: 0x8ac8f0, ground: 0xd8b878 };
  },
  courtyard: () => {
    const g = new T.Group();
    ground(g, 0x8a8a94, 0x76727e);
    for (let i = -6; i <= 12; i++) {
      add(g, G.box(1.0, 3.0, 0.8), i % 2 ? 0x9a96a4 : 0x8e8a98, [i, 1.5, -2.8], [0, 0, 0], [1, 1, 1], { rough: 0.02 });
      if (i % 2 === 0) add(g, G.box(0.5, 0.5, 0.8), 0x9a96a4, [i, 3.25, -2.8]);
    }
    for (const x of [-3, 3, 9]) { add(g, G.cyl(1.0, 1.1, 4.5, 8), 0xa8a4b0, [x, 2.25, -3.4], [0, 0, 0], [1, 1, 1], { rough: 0.02 }); add(g, G.cone(1.3, 1.4, 8), 0x3a4a8a, [x, 5.2, -3.4]); add(g, G.box(0.3, 0.5, 0.05), 0x2a2030, [x, 3.2, -2.35]); }
    for (const x of [0.2, 5.8]) { add(g, G.box(0.06, 2.2, 0.06), 0x5a4030, [x, 1.9, -2.3]); add(g, G.box(0.8, 1.4, 0.04), 0x3d5bb8, [x + 0.4, 2.3, -2.3]); add(g, G.box(0.16, 0.6, 0.05), 0xf0d060, [x + 0.4, 2.3, -2.27]); }
    pine(g, -4.5, -1.5, 1.2, 0x2e6a3a); pine(g, 10.5, -1.5, 1.2, 0x2e6a3a);
    return { group: g, sky: 0x9ad0f8, ground: 0x8a8a94 };
  },
  archive: () => {
    const g = new T.Group(), r = rnd(11);
    ground(g, 0x3a2a4a, 0x2a1a38);
    for (let i = -6; i <= 12; i++) {
      add(g, G.box(1.0, 3.6, 0.6), 0x5a3420, [i, 1.8, -2.8]);
      for (let s = 0; s < 4; s++) {
        add(g, G.box(0.94, 0.06, 0.5), 0x3a2010, [i, 0.5 + s * 0.85, -2.6]);
        let x = i - 0.42;
        while (x < i + 0.4) { const w = 0.06 + r() * 0.06, h = 0.45 + r() * 0.25; add(g, G.box(w, h, 0.36), [0x8a2a2a, 0x2a4a8a, 0x2a6a3a, 0x8a6a2a, 0x5a2a7a][Math.floor(r() * 5)], [x + w / 2, 0.53 + s * 0.85 + h / 2, -2.55]); x += w + 0.01; }
      }
    }
    for (const x of [-2, 2.5, 8]) { add(g, G.cyl(0.1, 0.12, 1.2, 5), 0x8a6a30, [x, 0.6, -1.6]); add(g, G.cyl(0.06, 0.06, 0.3, 5), 0xf0e8d0, [x, 1.35, -1.6]); glowBit(g, x, 1.6, -1.6, 0xf8b800, 0.06); }
    for (let i = 0; i < 12; i++) glowBit(g, -4 + r() * 14, 2 + r() * 2.5, -1.8 - r(), 0xb070f8, 0.04);
    return { group: g, sky: 0x1c1030, ground: 0x3a2a4a };
  },
  crypt: () => {
    const g = new T.Group(), r = rnd(5);
    ground(g, 0x2c2c38, 0x1c1c26);
    add(g, G.box(22, 4, 0.6), 0x3a3a48, [3, 2, -3.4], [0, 0, 0], [1, 1, 1], { rough: 0.05 });
    for (const x of [-3.5, -0.5, 6.5, 9.5]) pillar(g, x, -2.4, 3.2, 0x5a5a6c, 0x4a4a5a);
    for (let i = 0; i < 9; i++) {
      const x = -5 + i * 1.6 + r() * 0.5;
      if (x > -0.5 && x < 6.5) continue;
      add(g, G.box(0.6, 0.9, 0.18), 0x6a6a7a, [x, 0.45, -1.4 - r() * 0.6], [0, (r() - 0.5) * 0.4, (r() - 0.5) * 0.2], [1, 1, 1], { rough: 0.03 });
    }
    for (let i = 0; i < 6; i++) add(g, G.box(0.35, 0.06, 0.06), 0xe8e0d0, [-1 + r() * 8, 0.04, -0.6 - r() * 0.8], [0, r() * 3, 0]);
    for (let i = 0; i < 6; i++) glowBit(g, -4 + r() * 14, 1.2 + r() * 2.5, -2, 0x3cbcfc, 0.06);
    return { group: g, sky: 0x0c0c18, ground: 0x2c2c38 };
  },
  elderwood: () => {
    const g = new T.Group(), r = rnd(3);
    ground(g, 0x4a7a2a, 0x3a5a1a);
    for (let i = 0; i < 9; i++) leafTree(g, -6 + i * 2.1 + r() * 0.6, -3.2 - r() * 1.2, 1.3 + r() * 0.5, [0x2e6a2a, 0x3e7a2a, 0x2a5a30][i % 3], r);
    for (const x of [-1.2, 7.2]) { pillar(g, x, -1.8, 2.2 + r(), 0xb8a888, 0xa89878); add(g, G.ico(0.3, 0), 0x3e8a2a, [x + 0.2, 2.6, -1.6], [0, 0, 0], [1.6, 0.6, 1.2]); }
    add(g, G.box(0.9, 0.5, 0.6), 0xa89878, [-2.5, 0.25, -0.8], [0, 0.4, 0.2]);
    for (let i = 0; i < 10; i++) glowBit(g, -3 + r() * 12, 0.6 + r() * 2, -1 - r() * 1.5, 0xf8e070, 0.035);
    return { group: g, sky: 0xe89a5a, ground: 0x4a7a2a };
  },
  emberforge: () => {
    const g = new T.Group(), r = rnd(9);
    ground(g, 0x3a2a24, 0x2a201c);
    add(g, G.box(30, 0.05, 2.5), 0xf86a10, [3, -0.15, -2.2], [0, 0, 0], [1, 1, 1], { glow: 1 });
    for (let i = 0; i < 10; i++) { const s = 0.9 + r() * 0.7; add(g, G.ico(s, 0), 0x2a1e1a, [-6 + i * 2 + r(), s * 0.9, -4 - r() * 1.5], [r() * 3, r() * 3, 0], [1, 1.6, 1], { rough: 0.05 }); }
    for (const x of [-1.2, 7.2]) pillar(g, x, -1.2, 2.8, 0x5a4a44, 0x3a2e28);
    add(g, G.box(0.9, 0.4, 0.5), 0x3a3a44, [-3, 0.7, -0.9]); add(g, G.box(0.5, 0.5, 0.4), 0x2a2a34, [-3, 0.25, -0.9]);
    for (let i = 0; i < 8; i++) glowBit(g, -4 + r() * 14, 0.5 + r() * 3, -2 - r(), 0xf8b800, 0.04);
    return { group: g, sky: 0x2a0c08, ground: 0x3a2a24 };
  },
  frostpeak: () => {
    const g = new T.Group(), r = rnd(13);
    ground(g, 0xdce8f4, 0xb8c8dc);
    for (let i = 0; i < 7; i++) { const x = -6 + i * 3 + r(), h = 4 + r() * 3; add(g, G.cone(2.4 + r(), h, 5), 0x5a6a8a, [x, h / 2, -6 - r() * 2], [0, r() * 3, 0], [1, 1, 1], { rough: 0.05 }); add(g, G.cone(1.0, h * 0.35, 5), 0xf0f6ff, [x, h * 0.86, -6 - r() * 2 + 0.2]); }
    for (let i = 0; i < 8; i++) { const x = -5 + i * 2 + r(); if (x > -0.5 && x < 6.5 && i % 2) continue; pine(g, x, -1.8 - r() * 1.2, 1 + r() * 0.5, 0x2a4a3a, 0xf0f6ff); }
    for (let i = 0; i < 3; i++) add(g, G.box(44, 0.35, 0.05), [0x3af0a0, 0x58c8f8, 0xb070f8][i], [3, 6.2 + i * 0.55, -16], [0, 0, (i - 1) * 0.03], [1, 1, 1], { glow: 1, alpha: 0.3 });
    return { group: g, sky: 0x1a2048, ground: 0xdce8f4 };
  },
};

/** A stage's 3D set (falls back to the Colosseum for stages without one). */
export function buildSet(id: string): Set3 {
  return (SETS[id] ?? SETS.colosseum)();
}
