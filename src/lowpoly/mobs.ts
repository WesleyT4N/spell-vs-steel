// Expedition monsters as low-poly models: a handful of body plans (beast, golem, skeleton, ghost...) colored
// from each monster's sprite palette. All face +z like the fighters.
import * as T from 'three';
import { add, G, body, limb, sword, staff, type Rig } from './kit';

type Plan = 'beast' | 'stump' | 'spider' | 'wisp' | 'golem' | 'tree' | 'skeleton' | 'ghost' | 'bell' | 'imp' | 'lizard' | 'bat' | 'rider';
interface MobLook { plan: Plan; main: number; dark: number; light: number; eye: number; size: number; weapon?: 'bow' | 'sword' | 'staff' | 'axe'; crown?: boolean }

const L: Record<string, MobLook> = {
  stumpkin: { plan: 'stump', main: 0xac7c00, dark: 0x503000, light: 0x58d854, eye: 0xfcfcfc, size: 0.9 },
  wolf: { plan: 'beast', main: 0x7c7c7c, dark: 0x3c3c3c, light: 0xbcbcbc, eye: 0xf8b800, size: 1 },
  alpha: { plan: 'beast', main: 0x503000, dark: 0x200800, light: 0x887000, eye: 0xf83800, size: 1.35 },
  webspinner: { plan: 'spider', main: 0x58008a, dark: 0x200030, light: 0xd800cc, eye: 0xf83800, size: 1 },
  wisp: { plan: 'wisp', main: 0x3cbcfc, dark: 0x0058f8, light: 0xa4e4fc, eye: 0xfcfcfc, size: 0.8 },
  barkguard: { plan: 'golem', main: 0x7a4a18, dark: 0x503000, light: 0x00a800, eye: 0xb8f818, size: 1.1 },
  thornmother: { plan: 'tree', main: 0x007800, dark: 0x004000, light: 0xb8f818, eye: 0xf8b800, size: 1.4 },
  oakheart: { plan: 'tree', main: 0x00a800, dark: 0x503000, light: 0x58d854, eye: 0xb8f818, size: 1.6 },
  skelarcher: { plan: 'skeleton', main: 0xe0e0e0, dark: 0x7c7c7c, light: 0xfcfcfc, eye: 0xf83800, size: 1, weapon: 'bow' },
  rattler: { plan: 'skeleton', main: 0xd8d8d8, dark: 0x503000, light: 0xfcfcfc, eye: 0xf8b800, size: 0.95, weapon: 'sword' },
  ghoul: { plan: 'skeleton', main: 0x7c9c5c, dark: 0x3c4c2c, light: 0xa8c888, eye: 0xf83800, size: 1.05 },
  banshee: { plan: 'ghost', main: 0xa4e4fc, dark: 0x0058f8, light: 0xfcfcfc, eye: 0x0058f8, size: 1.1 },
  gravebell: { plan: 'bell', main: 0xac7c00, dark: 0x3c3c3c, light: 0xf8b800, eye: 0xf8b800, size: 1.1 },
  deathknight: { plan: 'skeleton', main: 0x3c3c5c, dark: 0x200030, light: 0x7c7c9c, eye: 0xf83800, size: 1.3, weapon: 'sword' },
  colossus: { plan: 'golem', main: 0xbcbcbc, dark: 0x3c3c3c, light: 0xfcfcfc, eye: 0xf83800, size: 1.6 },
  boneking: { plan: 'skeleton', main: 0xfcfcfc, dark: 0x58008a, light: 0x3cbcfc, eye: 0x3cbcfc, size: 1.6, weapon: 'staff', crown: true },
  imp: { plan: 'imp', main: 0xf83800, dark: 0x881400, light: 0xf8b800, eye: 0xf8b800, size: 0.8 },
  salamander: { plan: 'lizard', main: 0xe45c10, dark: 0x881400, light: 0xf8b800, eye: 0xfcfcfc, size: 1 },
  golem: { plan: 'golem', main: 0x7c7c7c, dark: 0x3c3c3c, light: 0xf83800, eye: 0xf8b800, size: 1.3 },
  emberbat: { plan: 'bat', main: 0x881400, dark: 0x200800, light: 0xf83800, eye: 0xf8b800, size: 0.9 },
  shaman: { plan: 'imp', main: 0x881400, dark: 0x503000, light: 0xf8b800, eye: 0xfcfcfc, size: 1, weapon: 'staff' },
  drakerider: { plan: 'rider', main: 0xd82800, dark: 0x881400, light: 0xf8b800, eye: 0xf8b800, size: 1.3 },
  titan: { plan: 'golem', main: 0x3c3c5c, dark: 0x200030, light: 0xf83800, eye: 0xf8b800, size: 1.8 },
  // pets and summons
  spiritbear: { plan: 'beast', main: 0x6888fc, dark: 0x0000a8, light: 0xa4e4fc, eye: 0xfcfcfc, size: 1.6 },
  hawk: { plan: 'bat', main: 0xac7c00, dark: 0x503000, light: 0xf8d878, eye: 0xf8b800, size: 0.8 },
  emberwyrm: { plan: 'lizard', main: 0xd82800, dark: 0x881400, light: 0xf8b800, eye: 0xfcfcfc, size: 1.8 },
};

/** A bare rig for monsters that have no chibi body (beasts, blobs, bells): arms stand in as small side parts. */
function rigOf(): Rig {
  const root = new T.Group(), bd = new T.Group(); root.add(bd);
  const head = new T.Group(); bd.add(head);
  const arms = { 1: new T.Group(), [-1]: new T.Group() } as Rig['arms'];
  bd.add(arms[1], arms[-1]);
  return { root, body: bd, head, arms, legs: [], hover: 0 };
}
function eyes(parent: T.Object3D, col: number, y: number, z: number, gap = 0.16, s = 1): void {
  for (const k of [-1, 1]) add(parent, G.box(0.09 * s, 0.07 * s, 0.03), col, [k * gap, y, z], [0, 0, 0], [1, 1, 1], { glow: 1 });
}

const PLANS: Record<Plan, (l: MobLook) => Rig> = {
  beast: (l) => {
    const r = rigOf(), b = r.body;
    add(b, G.box(0.5, 0.42, 1.0), l.main, [0, 0.62, -0.05], [0, 0, 0], [1, 1, 1], { rough: 0.03 });
    add(b, G.box(0.46, 0.2, 0.9), l.light, [0, 0.42, -0.05]);
    r.head.position.set(0, 0.95, 0.55);
    add(r.head, G.box(0.46, 0.4, 0.42), l.main, [0, 0, 0], [0, 0, 0], [1, 1, 1], { rough: 0.02 });
    add(r.head, G.box(0.26, 0.2, 0.3), l.light, [0, -0.1, 0.3]);
    add(r.head, G.box(0.08, 0.06, 0.05), 0x000000, [0, -0.02, 0.46]);
    for (const k of [-1, 1]) add(r.head, G.cone(0.1, 0.24, 4), l.dark, [k * 0.15, 0.3, -0.05]);
    eyes(r.head, l.eye, 0.06, 0.22, 0.12);
    for (const [x, z] of [[-0.18, 0.35], [0.18, 0.35], [-0.18, -0.42], [0.18, -0.42]]) { const lg = new T.Group(); lg.position.set(x, 0.45, z); b.add(lg); r.legs.push(lg); add(lg, G.box(0.13, 0.45, 0.14), l.dark, [0, -0.22, 0]); }
    add(b, G.cone(0.1, 0.55, 4), l.main, [0, 0.8, -0.65], [-2.2, 0, 0]);
    return r;
  },
  stump: (l) => {
    const r = rigOf(), b = r.body;
    add(b, G.cyl(0.42, 0.5, 0.9, 7), l.main, [0, 0.5, 0], [0, 0, 0], [1, 1, 1], { rough: 0.04 });
    add(b, G.cyl(0.4, 0.4, 0.04, 7), 0xfcd8a8, [0, 0.96, 0]);
    for (const k of [-1, 1]) add(b, G.cone(0.08, 0.4, 4), l.light, [k * 0.15, 1.1, 0], [0, 0, k * 0.4]);
    add(b, G.box(0.3, 0.08, 0.05), l.dark, [0, 0.45, 0.42]);
    eyes(b, l.eye, 0.68, 0.44, 0.14, 1.3);
    for (const s of [-1, 1] as const) { r.arms[s].position.set(s * 0.45, 0.6, 0); add(r.arms[s], G.cone(0.08, 0.5, 4), l.dark, [s * 0.15, 0, 0], [0, 0, -s * 1.2]); }
    return r;
  },
  spider: (l) => {
    const r = rigOf(), b = r.body;
    add(b, G.ico(0.42, 0), l.main, [0, 0.6, -0.25], [0, 0, 0], [1, 0.8, 1.1]);
    add(b, G.ico(0.26, 0), l.dark, [0, 0.55, 0.25]);
    for (let i = 0; i < 3; i++) eyes(b, l.eye, 0.62 + i * 0.05, 0.47 - i * 0.03, 0.06 + i * 0.05, 0.7);
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
      const z = 0.25 - i * 0.18, lg = new T.Group(); lg.position.set(s * 0.2, 0.55, z); b.add(lg); r.legs.push(lg);
      limb(lg, [0, 0, 0], [s * 0.4, 0.2, 0], 0.04, 0.04, l.dark); limb(lg, [s * 0.4, 0.2, 0], [s * 0.6, -0.55, 0.05 - i * 0.03], 0.04, 0.03, l.dark);
    }
    add(b, G.box(0.3, 0.06, 0.04), l.light, [0, 0.82, -0.05], [0, 0, 0.6]);
    return r;
  },
  wisp: (l) => {
    const r = rigOf(), b = r.body;
    add(b, G.ico(0.32, 0), l.light, [0, 0.9, 0], [0, 0, 0], [1, 1, 1], { glow: 1 });
    add(b, G.ico(0.48, 1), l.main, [0, 0.9, 0], [0, 0, 0], [1, 1, 1], { glow: 1, alpha: 0.35 });
    add(b, G.cone(0.2, 0.5, 5), l.main, [0, 0.45, -0.1], [Math.PI + 0.3, 0, 0], [1, 1, 1], { glow: 1, alpha: 0.5 });
    eyes(b, l.dark, 0.95, 0.3, 0.1);
    r.hover = 0.35;
    return r;
  },
  golem: (l) => {
    const r = body({ skin: l.main, torso: l.main, pants: l.dark, boots: l.dark, sleeve: l.main, glove: l.dark, armR: 0.14, noEyes: true });
    const { body: b, head, arms } = r;
    add(b, G.box(0.8, 0.6, 0.55), l.main, [0, 0.95, 0], [0, 0, 0], [1, 1, 1], { rough: 0.05 });
    for (const s of [-1, 1] as const) { add(b, G.ico(0.26, 0), l.dark, [s * 0.45, 1.2, 0]); add(arms[s], G.box(0.3, 0.3, 0.3), l.dark, [s * 0.1, -0.45, 0.07]); }
    add(b, G.ico(0.11, 0), l.light, [0, 1.0, 0.29], [0, 0, 0], [1, 1, 0.5], { glow: 1 });
    head.children.forEach(m => { m.scale.multiplyScalar(0.7); });
    add(head, G.box(0.5, 0.36, 0.45), l.main, [0, -0.15, 0], [0, 0, 0], [1, 1, 1], { rough: 0.04 });
    eyes(head, l.eye, -0.12, 0.23, 0.11);
    for (const s of [-1, 1]) add(head, G.box(0.08, 0.3, 0.08), l.light, [s * 0.18, 0.1, -0.1], [0, 0, s * 0.3]);
    return r;
  },
  tree: (l) => {
    const r = rigOf(), b = r.body;
    add(b, G.cyl(0.3, 0.45, 1.2, 6), l.dark, [0, 0.6, 0], [0, 0, 0], [1, 1, 1], { rough: 0.05 });
    for (const [x, y, z, s] of [[0, 1.55, 0, 0.6], [-0.4, 1.3, 0.05, 0.45], [0.42, 1.35, -0.05, 0.45], [0.1, 1.9, -0.1, 0.4]]) add(b, G.ico(s, 0), l.main, [x, y, z], [x, y, z], [1, 0.85, 1], { rough: 0.05 });
    for (const [x, y] of [[-0.25, 1.4], [0.3, 1.7], [0.1, 1.2]]) add(b, G.ico(0.06, 0), l.light, [x, y, 0.5], [0, 0, 0], [1, 1, 1], { glow: 1 });
    add(b, G.box(0.36, 0.1, 0.05), 0x200800, [0, 0.55, 0.36]);
    eyes(b, l.eye, 0.85, 0.36, 0.13, 1.2);
    for (const s of [-1, 1] as const) { r.arms[s].position.set(s * 0.32, 0.9, 0); limb(r.arms[s], [0, 0, 0], [s * 0.45, 0.25, 0.1], 0.08, 0.05, l.dark); }
    return r;
  },
  skeleton: (l) => {
    const r = body({ skin: l.main, torso: l.dark, pants: l.dark, boots: l.dark, sleeve: l.main, glove: l.main, armR: 0.05, noEyes: true });
    const { body: b, head, arms } = r;
    for (let i = 0; i < 3; i++) add(b, G.box(0.5 - i * 0.06, 0.05, 0.36), l.main, [0, 1.0 - i * 0.12, 0.03]);
    add(head, G.box(0.2, 0.14, 0.04), 0x000000, [0, -0.22, 0.48]);
    for (const k of [-1, 1]) { add(head, G.box(0.17, 0.17, 0.05), 0x000000, [k * 0.18, 0.0, 0.47]); add(head, G.box(0.06, 0.06, 0.03), l.eye, [k * 0.18, 0.0, 0.5], [0, 0, 0], [1, 1, 1], { glow: 1 }); }
    if (l.crown) { for (let i = 0; i < 5; i++) add(head, G.cone(0.07, 0.25, 4), 0xf8b800, [Math.cos(i * 1.2566) * 0.38, 0.5, Math.sin(i * 1.2566) * 0.38]); add(head, G.torus(0.4, 0.05), 0xf8b800, [0, 0.42, 0], [Math.PI / 2, 0, 0]); add(b, G.cone(0.6, 1.1, 6), l.dark, [0, 0.6, -0.15], [0, 0, 0], [1, 1, 0.6]); }
    if (l.plan === 'skeleton' && l.main === 0x3c3c5c) add(head, G.cap(0.58, Math.PI * 0.55), l.main, [0, 0.03, -0.02], [-0.2, 0, 0]);
    if (l.weapon === 'sword') { const sw = sword(arms[1], { blade: 0xbcbcbc, guard: l.dark }); sw.position.set(0.1, -0.4, 0.07); sw.rotation.set(0.9, 0, -0.2); }
    if (l.weapon === 'staff') { const st = staff(arms[1], 2.0, l.dark, (g, y) => add(g, G.ico(0.14, 0), l.light, [0, y + 0.12, 0], [0, 0, 0], [1, 1, 1], { glow: 1 })); st.position.set(0.1, -0.4, 0.07); }
    if (l.weapon === 'bow') { const bw = new T.Group(); arms[-1].add(bw); bw.position.set(-0.15, -0.4, 0.15); bw.rotation.set(0, 0.9, 0); add(bw, G.torus(0.55, 0.03, Math.PI * 0.9), 0xac7c00, [0, 0, 0], [0, 0, -Math.PI * 0.45], [1, 0.55, 1]); }
    return r;
  },
  ghost: (l) => {
    const r = rigOf(), b = r.body;
    add(b, G.cone(0.5, 1.4, 6), l.main, [0, 0.85, 0], [Math.PI, 0, 0], [1, 1, 0.8], { glow: 1, alpha: 0.6 });
    r.head.position.set(0, 1.55, 0);
    add(r.head, G.ico(0.42, 1), l.light, [0, 0, 0], [0, 0, 0], [1, 1, 1], { alpha: 0.85 });
    add(r.head, G.cap(0.46, Math.PI * 0.6), l.dark, [0, 0.03, -0.04], [-0.4, 0, 0], [1, 1, 1], { side: 1 });
    eyes(r.head, l.eye, 0.0, 0.38, 0.14, 1.3);
    add(r.head, G.box(0.12, 0.2, 0.04), 0x000000, [0, -0.2, 0.36]);
    for (const s of [-1, 1] as const) { r.arms[s].position.set(s * 0.35, 1.2, 0); limb(r.arms[s], [0, 0, 0], [s * 0.35, -0.3, 0.25], 0.07, 0.04, l.light); }
    r.hover = 0.25;
    return r;
  },
  bell: (l) => {
    const r = rigOf(), b = r.body;
    add(b, G.cyl(0.28, 0.6, 1.0, 8), l.main, [0, 0.75, 0], [0, 0, 0], [1, 1, 1], { side: 1 });
    add(b, G.cap(0.3, Math.PI * 0.5), l.main, [0, 1.25, 0]);
    add(b, G.torus(0.6, 0.05), l.light, [0, 0.26, 0], [Math.PI / 2, 0, 0]);
    add(b, G.torus(0.12, 0.04), l.dark, [0, 1.6, 0]);
    add(b, G.ico(0.15, 0), l.dark, [0, 0.2, 0]);
    eyes(b, l.eye, 0.85, 0.47, 0.15, 1.2);
    r.hover = 0.3;
    return r;
  },
  imp: (l) => {
    const r = body({ skin: l.main, torso: l.dark, pants: l.dark, boots: l.dark, glove: l.main, noEyes: true });
    const { head, arms, body: b } = r;
    for (const k of [-1, 1]) { add(head, G.cone(0.09, 0.35, 4), l.light, [k * 0.3, 0.45, 0], [0, 0, -k * 0.4]); add(head, G.cone(0.06, 0.28, 4), l.main, [k * 0.55, 0.05, 0], [0, 0, -k * 1.3]); }
    eyes(head, l.eye, 0.0, 0.47, 0.17, 1.2);
    add(head, G.box(0.22, 0.05, 0.03), 0x200800, [0, -0.22, 0.45]);
    add(b, G.cone(0.05, 0.6, 4), l.main, [0, 0.6, -0.4], [-2.0, 0, 0]);
    for (const s of [-1, 1]) add(b, G.box(0.04, 0.5, 0.35), l.dark, [s * 0.3, 1.1, -0.3], [0.3, s * 0.6, s * 0.5], [1, 1, 1], { side: 1 });
    if (l.weapon === 'staff') { const st = staff(arms[1], 1.6, 0x503000, (g, y) => add(g, G.ico(0.13, 0), 0xf83800, [0, y + 0.12, 0], [0, 0, 0], [1, 1, 1], { glow: 1 })); st.position.set(0.1, -0.4, 0.07); add(head, G.cap(0.6, Math.PI * 0.45), 0x881400, [0, 0.05, -0.02], [-0.2, 0, 0], [1, 1, 1], { side: 1 }); }
    return r;
  },
  lizard: (l) => {
    const r = rigOf(), b = r.body;
    add(b, G.box(0.55, 0.4, 1.1), l.main, [0, 0.5, -0.1], [0, 0, 0], [1, 1, 1], { rough: 0.03 });
    add(b, G.box(0.5, 0.12, 1.0), l.light, [0, 0.3, -0.1]);
    for (let i = 0; i < 4; i++) add(b, G.cone(0.08, 0.2, 4), l.dark, [0, 0.78, 0.3 - i * 0.25]);
    add(b, G.cone(0.18, 0.9, 5), l.main, [0, 0.45, -1.0], [-1.7, 0, 0]);
    r.head.position.set(0, 0.75, 0.6);
    add(r.head, G.box(0.42, 0.32, 0.55), l.main, [0, 0, 0.1]);
    add(r.head, G.box(0.38, 0.1, 0.4), l.dark, [0, -0.16, 0.2]);
    eyes(r.head, l.eye, 0.1, 0.38, 0.14);
    for (const [x, z] of [[-0.3, 0.3], [0.3, 0.3], [-0.3, -0.45], [0.3, -0.45]]) { const lg = new T.Group(); lg.position.set(x, 0.4, z); b.add(lg); r.legs.push(lg); add(lg, G.box(0.14, 0.38, 0.16), l.dark, [0, -0.2, 0]); }
    if (l.size > 1.5) for (const s of [-1, 1]) add(b, G.box(0.05, 0.7, 0.9), l.dark, [s * 0.55, 1.0, -0.1], [0.2, 0, s * 0.9], [1, 1, 1], { side: 1 });
    return r;
  },
  bat: (l) => {
    const r = rigOf(), b = r.body;
    add(b, G.ico(0.3, 0), l.main, [0, 0.9, 0]);
    for (const k of [-1, 1]) add(b, G.cone(0.08, 0.25, 4), l.main, [k * 0.15, 1.2, 0]);
    eyes(b, l.eye, 0.95, 0.27, 0.1);
    for (const s of [-1, 1] as const) { r.arms[s].position.set(s * 0.25, 0.95, 0); add(r.arms[s], G.box(0.7, 0.04, 0.4), l.dark, [s * 0.35, 0, 0], [0, 0, s * 0.3], [1, 1, 1], { side: 1 }); add(r.arms[s], G.box(0.3, 0.05, 0.3), l.light, [s * 0.6, 0.05, 0.05], [0, 0, s * 0.3]); }
    r.hover = 0.4;
    return r;
  },
  rider: (l) => {
    const r = PLANS.lizard({ ...l, size: 1 });
    const kn = body({ skin: 0xfcd8a8, torso: 0x3c3c5c, pants: 0x3c3c5c, boots: 0x2a2a3a, glove: 0x3c3c5c });
    kn.root.scale.setScalar(0.6); kn.root.position.set(0, 0.62, -0.15); r.body.add(kn.root);
    add(kn.head, G.cap(0.58, Math.PI * 0.55), 0xbcbcbc, [0, 0.03, -0.02], [-0.2, 0, 0]);
    const sp = new T.Group(); kn.arms[1].add(sp); sp.position.set(0.1, -0.4, 0.1); sp.rotation.set(1.3, 0, 0);
    add(sp, G.cyl(0.03, 0.03, 2.0, 4), 0xac7c00, [0, 0.6, 0]); add(sp, G.cone(0.07, 0.3, 4), 0xbcbcbc, [0, 1.7, 0]);
    return r;
  },
};

/** A fresh model of a monster kind, scaled to its size. */
export function buildMob(kind: string): Rig {
  const l = L[kind] ?? L.stumpkin;
  const r = PLANS[l.plan](l);
  r.root.scale.setScalar(l.size);
  return r;
}
