// The five fighters as low-poly chibis: the "Veteran" takes on the original sprite sheet (same palette and gear,
// more armor), the set Wes picked on the art exploration page.
import * as T from 'three';
import { add, G, body, spikyHair, sword, staff, dagger, hood, bowOn, type Rig } from './kit';

const W = { blue: 0x3d5bb8, steel: 0xa8bde0, red: 0xc8303a, gold: 0xf0d060, hair: 0x7a4a2c, pants: 0x34406a };
const M = { robe: 0x5a3cb0, gold: 0xe0b448, beard: 0xf0ecf8, wood: 0x8a5a34, orb: 0x6ac8ff };
const R = { cloth: 0x3a3a44, dark: 0x2a2a32, mask: 0xa82838, boots: 0x1e1e26 };
const N = { green: 0x2e7a3a, tunic: 0x3e9a4a, leather: 0x7a4a28, hair: 0x9a6a3a, wood: 0x8a5a34 };
const P = { white: 0xf4f4fa, blue: 0x3a6ad0, gold: 0xe0b448, hair: 0xf2cc62 };

function orbStaff(arm: T.Object3D, len = 2.0): T.Group {
  const st = staff(arm, len, M.wood, (g, y) => {
    add(g, G.torus(0.13, 0.03), M.wood, [0, y + 0.12, 0]);
    add(g, G.ico(0.12, 0), M.orb, [0, y + 0.13, 0], [0, 0, 0], [1, 1, 1], { glow: 1 });
    add(g, G.sphere(0.2, 8), M.orb, [0, y + 0.13, 0], [0, 0, 0], [1, 1, 1], { glow: 1, alpha: 0.25 });
  });
  st.position.set(0.1, -0.4, 0.07); st.rotation.set(0.1, 0, -0.08); return st;
}
function book(arm: T.Object3D, col: number, trim: number): void {
  const b = new T.Group(); arm.add(b); b.position.set(-0.12, -0.45, 0.2); b.rotation.set(-0.5, 0.3, 0);
  add(b, G.box(0.34, 0.06, 0.26), col); add(b, G.box(0.3, 0.07, 0.22), 0xf6eed8, [0.02, 0, 0]); add(b, G.box(0.06, 0.075, 0.1), trim);
}
function quiver(parent: T.Object3D, x: number): void {
  const q = add(parent, G.cyl(0.1, 0.09, 0.55, 5), N.leather, [x, 1.05, -0.3], [0, 0, 0.5]);
  for (const k of [0, 1, 2]) add(q, G.cone(0.04, 0.12, 4), [0xffffff, 0xe86a3a, 0xffffff][k], [-0.04 + k * 0.04, 0.35, 0]);
}
function crossStaff(arm: T.Object3D): void {
  const st = staff(arm, 2.0, 0xd8a838, (g, y) => {
    add(g, G.box(0.08, 0.42, 0.06), 0xf0c440, [0, y + 0.18, 0]); add(g, G.box(0.32, 0.08, 0.06), 0xf0c440, [0, y + 0.24, 0]);
    add(g, G.sphere(0.28, 8), 0xffe680, [0, y + 0.2, 0], [0, 0, 0], [1, 1, 1], { glow: 1, alpha: 0.22 });
  });
  st.position.set(0.1, -0.4, 0.07); st.rotation.set(0.1, 0, -0.08);
}
function maskOver(head: T.Object3D): void {
  add(head, G.part(0.535, 7, 4, -Math.PI * 0.05, Math.PI * 1.1, Math.PI * 0.56, Math.PI * 0.42), R.mask, [0, 0, 0.01], [0, 0, 0], [1, 0.96, 0.96], { side: 1 });
}

const BUILD: Record<string, () => Rig> = {
  warrior: () => {
    const rig = body({ skin: 0xffe1cc, torso: W.blue, pants: W.pants, boots: 0x4a5fa8, glove: 0x4a5fa8 });
    const { body: bd, head, arms } = rig;
    add(bd, G.box(0.46, 0.4, 0.14), W.steel, [0, 0.95, 0.2], [-0.08, 0, 0]);
    add(bd, G.box(0.08, 0.3, 0.02), W.gold, [0, 0.97, 0.28], [-0.08, 0, 0]);
    add(bd, G.box(0.6, 1.0, 0.04), W.red, [0, 0.6, -0.3], [0.12, 0, 0], [1, 1, 1], { side: 1, rough: 0.04 });
    add(bd, G.torus(0.2, 0.07), W.red, [0, 1.15, 0], [Math.PI / 2, 0, 0]);
    for (const s of [-1, 1]) add(bd, G.ico(0.17, 0), W.steel, [s * 0.36, 1.14, 0], [0, 0, 0], [1.1, 0.75, 1]);
    for (const lg of rig.legs) add(lg, G.box(0.22, 0.12, 0.22), W.steel, [0, -0.2, 0.08]);
    add(bd, G.box(0.62, 0.08, 0.5), 0x5a3424, [0, 0.67, 0]);
    add(head, G.cap(0.6, Math.PI * 0.5), W.steel, [0, 0.03, -0.03], [-0.15, 0, 0], [1, 1, 1.06]);
    add(head, G.cone(0.5, 0.35, 7), W.steel, [0, -0.08, -0.38], [-2.2, 0, 0], [1, 1, 0.6]);
    add(head, G.box(0.06, 0.32, 0.5), W.blue, [0, 0.55, -0.05]);
    add(head, G.cone(0.1, 0.7, 5), W.red, [0, 0.7, -0.4], [-1.9, 0, 0], [1, 1, 0.6], { rough: 0.03 });
    for (const s of [-1, 1]) add(head, G.cone(0.08, 0.3, 4), W.hair, [s * 0.28, 0.06, 0.4], [Math.PI - 0.3, 0, s * -0.2], [1, 1, 0.55]);
    const sw = sword(arms[1]); sw.position.set(0.1, -0.4, 0.07); sw.rotation.set(0.9, 0, -0.2);
    const sh = new T.Group(); arms[-1].add(sh); sh.position.set(-0.17, -0.3, 0.12); sh.rotation.set(0, -0.5, 0);
    const r = 0.3;
    add(sh, G.box(r * 1.6, r * 1.1, 0.07), W.blue, [0, r * 0.35, 0]);
    add(sh, G.cone(r * 1.13, r * 1.3, 4), W.blue, [0, -r * 0.85, 0], [Math.PI, Math.PI / 4, 0], [1, 1, 0.08]);
    add(sh, G.box(0.06, r * 1.15, 0.03), W.gold, [0, 0, 0.05]); add(sh, G.box(r * 0.8, 0.06, 0.03), W.gold, [0, r * 0.15, 0.05]);
    return rig;
  },
  mage: () => {
    const rig = body({ skin: 0xffe1cc, torso: M.robe, boots: 0x3a2850, robe: true, armR: 0.1, mouth: false });
    const { body: bd, head, arms } = rig;
    add(bd, G.box(0.14, 1.05, 0.05), M.gold, [0, 0.62, 0.4], [-0.38, 0, 0]);
    add(bd, G.cone(0.68, 0.55, 6), M.robe, [0, 1.12, -0.05], [0, 0, 0], [1, 1, 0.9], { rough: 0.02 });
    add(bd, G.torus(0.33, 0.04), M.gold, [0, 0.82, 0], [Math.PI / 2, 0, 0], [1, 0.85, 1]);
    add(head, G.cone(0.34, 1.25, 5), M.beard, [0, -0.72, 0.32], [Math.PI + 0.3, 0, 0], [1, 1, 0.5], { rough: 0.03 });
    add(head, G.cap(0.56, Math.PI * 0.6), M.beard, [0, 0, -0.04], [-0.5, 0, 0]);
    for (const s of [-1, 1]) { add(head, G.box(0.2, 0.06, 0.06), M.beard, [s * 0.18, 0.12, 0.47], [0, 0, -s * 0.25]); add(head, G.cone(0.07, 0.3, 4), M.beard, [s * 0.18, -0.26, 0.48], [Math.PI, 0, -s * 0.6], [1, 1, 0.5]); }
    add(head, G.cyl(0.95, 0.95, 0.05, 8), M.robe, [0, 0.3, 0], [0.12, 0, 0]);
    add(head, G.cyl(0.47, 0.48, 0.08, 7), M.gold, [0, 0.36, 0], [0.12, 0, 0]);
    add(head, G.cone(0.48, 1.3, 7), M.robe, [0, 0.95, -0.1], [-0.15, 0, 0.12], [1, 1, 1], { rough: 0.03 });
    add(head, G.cone(0.16, 0.55, 4), M.robe, [-0.2, 1.6, -0.3], [-0.6, 0, 1.4]);
    add(head, G.box(0.1, 0.1, 0.02), M.gold, [0.1, 0.62, 0.36], [-0.2, 0, 0.6]);
    orbStaff(arms[1], 2.1);
    book(arms[-1], M.robe, M.gold);
    return rig;
  },
  rogue: () => {
    const rig = body({ skin: 0xffe1cc, torso: R.cloth, pants: 0x2a2a34, boots: R.boots, glove: R.boots, mouth: false });
    const { body: bd, head, arms } = rig;
    hood(head, R.cloth, 0x2e2e36); maskOver(head);
    add(bd, G.cone(0.42, 0.75, 5), R.dark, [0, 0.82, -0.12], [0, 0, 0], [1, 1, 0.7], { rough: 0.02 });
    add(bd, G.torus(0.22, 0.08), R.mask, [0, 1.15, 0], [Math.PI / 2, 0, 0]);
    add(bd, G.box(0.16, 0.9, 0.03), R.mask, [-0.18, 0.85, -0.42], [0.5, 0, 0.25], [1, 1, 1], { side: 1, rough: 0.03 });
    add(bd, G.ico(0.16, 0), 0x5a3a30, [0.35, 1.12, 0], [0, 0, 0], [1.1, 0.75, 1]);
    add(bd, G.box(0.62, 0.07, 0.5), 0x5a3a30, [0, 0.67, 0]);
    for (const x of [-0.22, 0.05, 0.22]) add(bd, G.box(0.12, 0.13, 0.08), 0x6a4a38, [x, 0.6, 0.24]);
    for (const s of [-1, 1] as const) { const d = dagger(arms[s], -s); d.position.set(s * 0.1, -0.4, 0.07); d.rotation.set(-0.3, 0, s * 0.4); }
    return rig;
  },
  ranger: () => {
    const rig = body({ skin: 0xffe1cc, torso: N.tunic, pants: 0x5a7a3a, boots: N.leather, glove: N.leather });
    const { body: bd, head, arms } = rig;
    add(bd, G.box(0.08, 0.62, 0.04), N.leather, [0, 0.94, 0.26], [0, 0, -0.7]);
    add(bd, G.cone(0.6, 1.2, 6), N.green, [0, 0.62, -0.18], [0, 0, 0], [1, 1, 0.55], { rough: 0.03 });
    quiver(bd, 0.12);
    spikyHair(head, N.hair, { n: 7, len: 0.32, capTop: 0.58 });
    add(head, G.cap(0.62, Math.PI * 0.46), N.green, [0, 0.06, -0.04], [-0.2, 0, 0], [1, 1.1, 1.15], { rough: 0.02 });
    add(head, G.cone(0.28, 0.75, 4), N.green, [0, 0.5, -0.4], [-1.4, 0, 0], [1, 1, 0.6]);
    add(head, G.box(0.04, 0.7, 0.14), 0xffffff, [-0.44, 0.55, -0.18], [-0.5, 0, 0.6], [1, 1, 1], { rough: 0.02 });
    add(head, G.box(0.04, 0.4, 0.1), 0xe86a3a, [-0.4, 0.5, -0.1], [-0.4, 0, 0.5]);
    for (const s of [-1, 1] as const) add(arms[s], G.cyl(0.1, 0.1, 0.16, 6), N.leather, [s * 0.08, -0.3, 0.05]);
    const bw = bowOn(arms[-1], N.wood, 0.7); bw.position.set(-0.18, -0.4, 0.15); bw.rotation.set(0, 0.9, 0);
    add(bw, G.cyl(0.012, 0.012, 0.9, 4), 0xc8a070, [0.35, 0, 0], [0, 0, Math.PI / 2]);
    add(bw, G.cone(0.03, 0.08, 4), 0xcfd6e0, [-0.12, 0, 0], [0, 0, Math.PI / 2]);
    return rig;
  },
  priest: () => {
    const rig = body({ skin: 0xfff0e6, torso: P.white, boots: 0xc8b070, robe: true, armR: 0.1 });
    const { body: bd, head, arms } = rig;
    add(bd, G.box(0.2, 1.05, 0.05), P.blue, [0, 0.62, 0.4], [-0.38, 0, 0]);
    add(bd, G.torus(0.33, 0.04), P.gold, [0, 0.82, 0], [Math.PI / 2, 0, 0], [1, 0.85, 1]);
    add(bd, G.cone(0.58, 0.5, 7), P.gold, [0, 1.14, 0], [0, 0, 0], [1, 1, 0.85]);
    add(head, G.cap(0.56, Math.PI * 0.6), P.hair, [0, 0, -0.04], [-0.5, 0, 0]);
    add(bd, G.box(0.7, 0.75, 0.2), P.hair, [0, 1.25, -0.25], [0.1, 0, 0], [1, 1, 1], { rough: 0.02 });
    for (const b of [[-0.3, 0.25, 0.3], [-0.1, 0.08, 0.33], [0.1, -0.1, 0.32], [0.3, -0.25, 0.3]]) add(head, G.cone(0.1, b[2], 4), P.hair, [b[0], 0.2, 0.39], [Math.PI - 0.35, 0, b[1]], [1, 1, 0.55]);
    add(head, G.box(0.66, 0.5, 0.5), P.white, [0, 0.62, -0.02], [-0.1, 0, 0]);
    add(head, G.cone(0.47, 0.42, 4), P.white, [0, 1.07, -0.06], [-0.1, Math.PI / 4, 0], [1, 1, 0.75]);
    add(head, G.box(0.68, 0.07, 0.52), P.gold, [0, 0.4, 0], [-0.1, 0, 0]);
    add(head, G.box(0.08, 0.42, 0.03), P.gold, [0, 0.72, 0.25], [-0.1, 0, 0]);
    add(head, G.box(0.26, 0.08, 0.03), P.gold, [0, 0.8, 0.25], [-0.1, 0, 0]);
    add(head, G.box(0.86, 0.06, 0.4), P.blue, [0, 0.28, -0.02]);
    crossStaff(arms[1]);
    book(arms[-1], P.blue, P.gold);
    return rig;
  },
};

/** A fresh low-poly model of a class (unknown classes fall back to the Warrior's body in grey). */
export function buildFighter(cls: string): Rig {
  return (BUILD[cls] ?? BUILD.warrior)();
}
