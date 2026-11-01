// Low-poly model kit for the 3D build: flat-shaded primitives with a little vertex jitter, ported from the
// art exploration page (Chibi A · Veteran). Every model is built from these few calls.
import * as T from 'three';

export type Vec3 = [number, number, number];
export interface AddOpts { rough?: number; side?: 1; glow?: 1; outline?: false; ow?: number; keep?: 1; alpha?: number }

const mats = new Map<string, T.Material>();
/** A shared flat-shaded material (or an unlit one for glowing bits). */
export function mat(c: number, o: AddOpts = {}): T.Material {
  const key = `${c}|${o.glow ? 1 : 0}|${o.side ? 1 : 0}|${o.alpha ?? 1}`;
  let m = mats.get(key);
  if (m) return m;
  m = o.glow ? new T.MeshBasicMaterial({ color: c }) : new T.MeshPhongMaterial({ color: c, flatShading: true, shininess: 0, specular: 0x000000 });
  if (o.side) m.side = T.DoubleSide;
  if (o.alpha !== undefined && o.alpha < 1) { m.transparent = true; m.opacity = o.alpha; m.depthWrite = false; }
  mats.set(key, m);
  return m;
}

/** Nudge the vertices a touch so the facets read hand-made. Deterministic per geometry. */
function rough(g: T.BufferGeometry, amt: number): T.BufferGeometry {
  if (!amt) return g;
  const ng = g.index ? g.toNonIndexed() : g;
  const p = ng.attributes.position as T.BufferAttribute, seen = new Map<string, Vec3>();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    let j = seen.get(key);
    if (!j) { const h = Math.sin(seen.size * 12.9898) * 43758.5453; j = [(h % 1) * amt, ((h * 7) % 1) * amt, ((h * 13) % 1) * amt]; seen.set(key, j); }
    p.setXYZ(i, p.getX(i) + j[0], p.getY(i) + j[1], p.getZ(i) + j[2]);
  }
  ng.computeVertexNormals();
  return ng;
}

export function add(parent: T.Object3D, geo: T.BufferGeometry, color: number, pos: Vec3 = [0, 0, 0], rot: Vec3 = [0, 0, 0], scl: Vec3 = [1, 1, 1], o: AddOpts = {}): T.Mesh {
  const m = new T.Mesh(rough(geo, o.rough ?? 0), mat(color, o));
  m.position.set(...pos); m.rotation.set(...rot); m.scale.set(...scl);
  parent.add(m);
  return m;
}

const SEG = 7;
export const G = {
  sphere: (r: number, ws = SEG, hs?: number) => new T.SphereGeometry(r, ws, hs ?? Math.max(4, Math.round(ws * 0.7))),
  cyl: (rt: number, rb: number, h: number, rs = SEG) => new T.CylinderGeometry(rt, rb, h, rs, 1),
  cone: (r: number, h: number, rs = SEG) => new T.ConeGeometry(r, h, rs, 1),
  box: (x: number, y: number, z: number) => new T.BoxGeometry(x, y, z),
  torus: (r: number, t: number, arc = Math.PI * 2) => new T.TorusGeometry(r, t, 4, 8, arc),
  ico: (r: number, d = 1) => new T.IcosahedronGeometry(r, d),
  cap: (r: number, top: number, rs = SEG) => new T.SphereGeometry(r, rs, Math.max(4, Math.round(rs * 0.5)), 0, Math.PI * 2, 0, top),
  part: (r: number, ws: number, hs: number, p0: number, pl: number, t0: number, tl: number) => new T.SphereGeometry(r, ws, hs, p0, pl, t0, tl),
};

/** A limb: a tapered cylinder from point a to point b. */
export function limb(parent: T.Object3D, a: Vec3, b: Vec3, r1: number, r2: number, color: number, o: AddOpts = {}): T.Mesh {
  const A = new T.Vector3(...a), B = new T.Vector3(...b);
  const m = add(parent, G.cyl(r2, r1, A.distanceTo(B), 5), color, [0, 0, 0], [0, 0, 0], [1, 1, 1], o);
  m.position.copy(A).lerp(B, 0.5);
  m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  return m;
}

export interface BodyOpts {
  skin: number; torso: number; boots: number; eye?: number; pants?: number; glove?: number; sleeve?: number;
  robe?: boolean; armR?: number; mouth?: boolean; noEyes?: boolean; closed?: boolean;
}
/** The rig every chibi is posed through: arms swing from the shoulders, the head turns and nods. */
export interface Rig { root: T.Group; body: T.Group; head: T.Group; arms: Record<1 | -1, T.Group>; legs: T.Object3D[]; hover: number }

/** The shared chibi body: big faceted head, stubby legs (or a robe), two arms. */
export function body(c: BodyOpts): Rig {
  const root = new T.Group(), bd = new T.Group(); root.add(bd);
  const legs: T.Object3D[] = [];
  if (!c.robe) {
    for (const s of [-1, 1]) {
      const lg = new T.Group(); lg.position.set(s * 0.15, 0.62, 0); bd.add(lg); legs.push(lg);
      limb(lg, [-s * 0.01, 0, 0], [s * 0.02, -0.42, 0.02], 0.1, 0.085, c.pants ?? c.torso);
      add(lg, G.box(0.2, 0.22, 0.3), c.boots, [s * 0.02, -0.5, 0.05]);
    }
    add(bd, G.cyl(0.27, 0.31, 0.5, 6), c.torso, [0, 0.9, 0], [0, 0, 0], [1, 1, 0.82], { rough: 0.015 });
  } else {
    add(bd, G.cone(0.52, 1.25, 6), c.torso, [0, 0.66, 0], [0, 0, 0], [1, 1, 0.85], { rough: 0.02 });
    for (const s of [-1, 1]) add(bd, G.box(0.18, 0.12, 0.26), c.boots, [s * 0.15, 0.06, 0.12]);
  }
  add(bd, G.cyl(0.08, 0.09, 0.2, 6), c.skin, [0, 1.2, 0]);
  const head = new T.Group(); head.position.set(0, 1.62, 0); bd.add(head);
  add(head, G.ico(0.52, 1), c.skin, [0, 0, 0], [0, 0, 0], [1, 0.96, 0.94]);
  if (!c.noEyes) {
    for (const s of [-1, 1]) {
      add(head, G.box(0.08, 0.13, 0.04), 0x1a1018, [s * 0.18, -0.03, 0.47], [0, 0, 0], [1, 1, 1], { glow: 1 });
      add(head, G.box(0.03, 0.03, 0.02), 0xffffff, [s * 0.18 - 0.015, 0.01, 0.495], [0, 0, 0], [1, 1, 1], { glow: 1 });
    }
    if (c.mouth !== false) add(head, G.box(0.08, 0.018, 0.02), 0x6a2a30, [0.02, -0.24, 0.42], [0, 0, 0.1], [1, 1, 1], { glow: 1 });
  }
  const arms = {} as Record<1 | -1, T.Group>;
  for (const s of [-1, 1] as const) {
    const g = new T.Group(); g.position.set(s * 0.3, 1.08, 0); bd.add(g);
    limb(g, [0, 0, 0], [s * 0.1, -0.36, 0.06], c.armR ?? 0.08, (c.armR ?? 0.08) * 0.85, c.sleeve ?? c.torso);
    add(g, G.sphere(0.075, 5), c.glove ?? c.skin, [s * 0.1, -0.4, 0.07]);
    arms[s] = g;
  }
  return { root, body: bd, head, arms, legs, hover: 0 };
}

// ---------- shared pieces ----------
export function spikyHair(head: T.Object3D, col: number, o: { n?: number; len?: number; capTop?: number; capTilt?: number } = {}): void {
  add(head, G.cap(0.57, Math.PI * (o.capTop ?? 0.55)), col, [0, 0.02, -0.03], [-(o.capTilt ?? 0.35), 0, 0], [1, 1, 1], { rough: 0.02 });
  const n = o.n ?? 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    if (Math.cos(a) > 0.6) continue; // keep the face clear
    const up = 0.3 + 0.5 * Math.abs(Math.sin(i * 1.7));
    const dir = new T.Vector3(Math.sin(a) * 0.9, up, -Math.abs(Math.cos(a)) * 0.6 - 0.25).normalize();
    const m = add(head, G.cone(0.13, o.len ?? 0.5, 4), col);
    m.position.copy(dir.clone().multiplyScalar(0.5));
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir);
  }
  for (const [x, rz, l] of [[-0.3, 0.25, 0.32], [-0.12, 0.08, 0.36], [0.07, -0.1, 0.34], [0.26, -0.3, 0.3]]) {
    add(head, G.cone(0.1, l, 4), col, [x, 0.3 - l * 0.3, 0.38], [Math.PI - 0.35, 0, rz], [1, 1, 0.55]);
  }
}
export function sword(parent: T.Object3D, o: { blade?: number; guard?: number } = {}): T.Group {
  const g = new T.Group(); parent.add(g);
  add(g, G.box(0.09, 0.95, 0.025), o.blade ?? 0xdfe8f2, [0, 0.62, 0]);
  add(g, G.cone(0.045, 0.12, 4), o.blade ?? 0xdfe8f2, [0, 1.15, 0], [0, Math.PI / 4, 0], [1, 1, 0.3]);
  add(g, G.box(0.32, 0.06, 0.07), o.guard ?? 0xe0b448, [0, 0.13, 0]);
  add(g, G.cyl(0.03, 0.03, 0.18, 6), 0x6b3a2a, [0, 0.02, 0]);
  add(g, G.sphere(0.05, 5), o.guard ?? 0xe0b448, [0, -0.09, 0]);
  return g;
}
export function staff(parent: T.Object3D, len: number, wood: number, top?: (g: T.Group, y: number) => void): T.Group {
  const g = new T.Group(); parent.add(g);
  add(g, G.cyl(0.035, 0.035, len, 5), wood, [0, len / 2 - 0.5, 0]);
  top?.(g, len - 0.5);
  return g;
}
export function dagger(parent: T.Object3D, flip: number): T.Group {
  const g = new T.Group(); parent.add(g);
  add(g, G.cone(0.05, 0.42, 4), 0xcfd6e0, [0, 0.3 * flip, 0], [flip < 0 ? Math.PI : 0, Math.PI / 4, 0], [1, 1, 0.35]);
  add(g, G.box(0.16, 0.035, 0.05), 0x8a2030, [0, 0.08 * flip, 0]);
  add(g, G.cyl(0.025, 0.025, 0.14, 5), 0x2a1a20, [0, 0, 0]);
  return g;
}
/** A hood closed over the brow (it used to sit too high on the forehead). */
export function hood(head: T.Object3D, col: number, rim = col): void {
  add(head, G.part(0.62, 7, 3, 0, Math.PI * 2, 0, Math.PI * 0.4), col, [0, 0.02, 0.01], [0.22, 0, 0], [1, 1, 1.04], { side: 1, rough: 0.02 });
  add(head, G.part(0.62, 7, 4, Math.PI * 0.7, Math.PI * 1.6, Math.PI * 0.36, Math.PI * 0.64), col, [0, 0.02, -0.02], [0, 0, 0], [1, 1, 1], { side: 1, rough: 0.02 });
  add(head, G.torus(0.42, 0.06, Math.PI), rim, [0, 0.03, 0.4], [0.35, 0, 0], [1, 0.62, 1], { rough: 0.01 });
}
export function bowOn(arm: T.Object3D, col: number, size = 0.6): T.Group {
  const bw = new T.Group(); arm.add(bw); bw.position.set(0.18, -0.4, 0.12); bw.rotation.set(0, -0.9, 0);
  add(bw, G.torus(size, 0.035, Math.PI * 0.9), col, [0, 0, 0], [0, 0, -Math.PI * 0.45], [1, 0.55, 1]);
  add(bw, G.cyl(0.006, 0.006, size * 1.97, 3), 0xf0e8d8, [0.02 * size / 0.6, 0, 0], [0, 0, 0], [1, 1, 1], { glow: 1 });
  return bw;
}
