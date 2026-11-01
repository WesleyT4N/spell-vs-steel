// The low-poly 3D battle renderer (the `lowpoly` build only). It draws the stage set, the panels, every fighter,
// monster, wall and pet as three.js models, then stamps the picture into the world layer. Everything else
// (spell effects, shots, status marks, the HUD) still draws in 2D on top: the camera is an orthographic view
// tilted 30° down whose projection puts every panel and foot exactly where the 2D layout has them, so those
// overlays line up without knowing the picture underneath is 3D.
//
// Render-only: reads the Battle, never writes it (rollback and replays are unaffected).
import * as T from 'three';
import { HD, view, type Ctx } from '../engine/gfx';
import type { Stage } from '../art/arena';
import type { Battle, Fighter, Pet, Wall } from '../game/battle';
import type { Look } from '../game/fighterAnim';
import { YOU, FOE } from '../game/teamColors';
import { add, G, mat, type Rig } from './kit';
import { buildFighter } from './fighters';
import { buildMob } from './mobs';
import { buildSet, type Set3 } from './stages';

// ---- the projection that matches the 2D layout (art/arena.ts: X0 6, PW 38, Y0 98, FACE 15, LIP 4) ----
const PX = 38;                       // screen pixels per grid unit
const TILT = Math.PI / 6;            // 30° down: a row 1 unit deep is 19 px tall, like FACE + LIP
/** Screen (world-layer) position of a grid point: x = 6 + 38·gx, y = 98 + 19·gz − 32.9·gy. */
const FOOT_Z = 12 / 19;              // panelFoot sits 12 px below the panel's top edge
const SCALE = 0.46;                   // chibi models are ~2.3 units tall; this makes them ~30 px like the 48px sprites

const hex = (s: string): number => parseInt(s.replace('#', ''), 16);
const mixN = (a: number, b: number, k: number): number => {
  const ch = (v: number, s: number): number => (v >> s) & 255;
  const m = (s: number): number => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * k);
  return (m(16) << 16) | (m(8) << 8) | m(0);
};

interface PanelView { hole: boolean; state: 'clean' | 'cracked' | 'burning'; tint?: string; mine: boolean; hl?: string }
interface Ent { holder: T.Group; rig: Rig; key: string; seen: number; tint: string; ice?: T.Mesh; shadow: T.Mesh; decoy?: { holder: T.Group; rig: Rig } }

let renderer: T.WebGLRenderer | null = null;
let failed = false;
let scene: T.Scene, cam: T.OrthographicCamera, world: T.Group, setG: Set3 | null = null, setId = '';
/** The stage set renders first, through a lower perspective camera so its walls, trees and sky have depth;
 *  the grid and everyone on it then render over it through the 2D-matching orthographic camera. */
let back: T.Scene, backCam: T.PerspectiveCamera;
const panelMesh: { rim: T.Mesh; face: T.Mesh; pit: T.Mesh; fm: T.MeshPhongMaterial; rm: T.MeshPhongMaterial }[][] = [];
const ents = new Map<object, Ent>();
let frame = 0;
const pending: PanelView[][] = [];

const TINTS: Record<string, number> = { fire: 0x7a2a10, poison: 0x2c6a30, holy: 0xd8b45c, shadow: 0x2a1848 };

function init(): boolean {
  if (renderer || failed) return !failed;
  try {
    const canvas = document.createElement('canvas');
    renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
  } catch { failed = true; return false; }
  // match the look of the art page (three r128): plain sRGB colors, legacy light intensities
  T.ColorManagement.enabled = false;
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  (renderer as unknown as { useLegacyLights: boolean }).useLegacyLights = true;
  renderer.autoClear = false;
  const light = (sc: T.Scene): void => {
    sc.add(new T.HemisphereLight(0xfff8ee, 0x5a4a6a, 0.72));
    const sun = new T.DirectionalLight(0xfff0dd, 0.6); sun.position.set(-2, 5, 4); sc.add(sun);
  };
  scene = new T.Scene(); light(scene);
  back = new T.Scene(); light(back);
  backCam = new T.PerspectiveCamera(30, 1.5, 0.1, 300);
  world = new T.Group(); scene.add(world);
  cam = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  // panels: a team-colored rim box with the stage's face inset on top, and a dark pit for broken ones
  for (let c = 0; c < 6; c++) {
    panelMesh[c] = []; pending[c] = [];
    for (let r = 0; r < 3; r++) {
      const rm = new T.MeshPhongMaterial({ flatShading: true, shininess: 0, specular: 0 });
      const fm = new T.MeshPhongMaterial({ flatShading: true, shininess: 0, specular: 0 });
      const rim = new T.Mesh(G.box(0.96, 0.12, 0.79), rm); rim.position.set(c + 0.5, -0.06, r + 0.395); world.add(rim);
      const face = new T.Mesh(G.box(0.8, 0.02, 0.62), fm); face.position.set(c + 0.5, 0.005, r + 0.395); world.add(face);
      const pit = new T.Mesh(G.box(0.96, 0.05, 0.79), mat(0x0a0608)); pit.position.set(c + 0.5, -0.35, r + 0.395); world.add(pit);
      panelMesh[c][r] = { rim, face, pit, fm, rm };
    }
  }
  return true;
}

/** Queue one panel's look for this frame (battleView works out the state exactly as for the 2D panels). */
export function panel3d(col: number, row: number, v: PanelView): void { if (pending[col]) pending[col][row] = v; }

function applyPanels(st: Stage): void {
  const look = st.panel;
  for (let c = 0; c < 6; c++) for (let r = 0; r < 3; r++) {
    const v = pending[c][r], m = panelMesh[c][r];
    if (!v) continue;
    m.rim.visible = m.face.visible = !v.hole; m.pit.visible = v.hole;
    const team = v.mine ? YOU : FOE, rim = hex(team.rim[0]);
    let face = v.tint ? TINTS[v.tint] ?? hex(look.face) : mixN(hex(look.face), rim, 0.3);
    if (v.state === 'cracked') face = mixN(face, hex(look.lo), 0.45);
    if (v.hl) face = mixN(face, hex(v.hl), 0.6);
    m.fm.color.setHex(face);
    m.rm.color.setHex(v.hl ? mixN(rim, hex(v.hl), 0.4) : rim);
    m.face.position.y = v.state === 'cracked' ? -0.012 : 0.005;
  }
}

// ---- tints: whole-model material swaps (hit flash, ice, stun, see-through stealth) ----
const tintMats: Record<string, T.Material> = {};
function tintMat(kind: string): T.Material {
  if (tintMats[kind]) return tintMats[kind];
  let m: T.Material;
  if (kind === 'flash') m = new T.MeshBasicMaterial({ color: 0xffffff });
  else if (kind === 'ice') m = new T.MeshPhongMaterial({ color: 0xa4e4fc, flatShading: true, shininess: 0 });
  else if (kind === 'stun') m = new T.MeshPhongMaterial({ color: 0xf8e070, flatShading: true, shininess: 0 });
  else { m = new T.MeshBasicMaterial({ color: kind === 'ghostMine' ? 0x8ab0d8 : 0x6a7a98, transparent: true, opacity: kind === 'ghostMine' ? 0.45 : 0.18, depthWrite: false }); }
  return (tintMats[kind] = m);
}
function setTint(e: { rig: Rig; tint?: string }, kind: string, alpha = 1): void {
  const key = kind + (alpha < 1 ? `@${alpha.toFixed(2)}` : '');
  if (e.tint === key) return;
  e.tint = key;
  e.rig.root.traverse(o => {
    const m = o as T.Mesh;
    if (!m.isMesh) return;
    m.userData.m0 ??= m.material;
    if (kind === 'none' && alpha >= 1) { m.material = m.userData.m0; return; }
    if (kind === 'none') {
      const base = m.userData.m0 as T.Material;
      const fade = base.clone(); fade.transparent = true; fade.opacity = alpha * ((base as T.MeshBasicMaterial).opacity ?? 1); fade.depthWrite = false;
      m.material = fade; return;
    }
    m.material = tintMat(kind);
  });
}

// ---- poses: the 2D animation frames (fighterAnim.ts) mapped onto the rig ----
function resetPose(r: Rig): void {
  r.body.position.set(0, 0, 0); r.body.rotation.set(0, 0, 0); r.body.scale.set(1, 1, 1);
  r.head.rotation.set(0, 0, 0);
  for (const s of [1, -1] as const) r.arms[s].rotation.set(0, 0, 0);
  for (const l of r.legs) l.rotation.set(0, 0, 0);
}
function pose(r: Rig, f: Fighter, look: Look, t: number): void {
  resetPose(r);
  const b = r.body, A = r.arms, fr = look.frame;
  const breathe = Math.sin(t * 3.2 + f.side * 2);
  if (fr.startsWith('idle')) { b.scale.y = 1 + breathe * 0.015; A[1].rotation.x = -0.05 + breathe * 0.04; A[-1].rotation.x = 0.05 - breathe * 0.04; r.head.rotation.x = breathe * 0.03; }
  if (fr === 'hop') { for (const l of r.legs) l.rotation.x = -0.6; A[1].rotation.z = 0.4; A[-1].rotation.z = -0.4; }
  if (fr === 'land') { b.scale.set(1.06, 0.92, 1.06); }
  if (fr === 'windup') { b.rotation.x = -0.18; A[1].rotation.x = 1.4; }
  if (fr === 'slash') { b.rotation.x = 0.25; A[1].rotation.x = -1.5; A[-1].rotation.x = 0.4; }
  if (fr === 'cast0' || fr === 'cast1') { const k = fr === 'cast1' ? 1 : 0.7; A[1].rotation.x = -1.9 * k; A[-1].rotation.x = -1.6 * k; r.head.rotation.x = -0.15; b.rotation.x = -0.08; }
  if (fr === 'hit') { b.rotation.x = -0.32; r.head.rotation.x = -0.3; A[1].rotation.z = 0.5; A[-1].rotation.z = -0.5; }
  if (fr === 'stagger') { b.rotation.x = -0.25; b.rotation.z = 0.2; r.head.rotation.x = 0.2; }
  if (fr === 'kneel') { b.position.y = -0.35; b.rotation.x = 0.35; for (const l of r.legs) l.rotation.x = -1.1; A[1].rotation.x = -0.2; }
  if (fr === 'slump') { b.position.y = -0.3; b.rotation.x = 0.55; r.head.rotation.x = 0.4; A[1].rotation.x = 0.5; A[-1].rotation.x = 0.5; }
  if (fr === 'fall1') { b.rotation.x = -0.7; b.position.y = -0.1; }
  if (fr === 'fall2') { b.rotation.x = -1.25; b.position.set(0, 0.0, -0.4); }
  if (fr === 'down') { b.rotation.x = -1.5; b.position.set(0, 0.15, -0.55); A[1].rotation.z = 0.9; A[-1].rotation.z = -0.9; }
  // the sim's own pose drives the swing even where the drawn frame is still idle
  if (fr.startsWith('idle') && (f.pose === 'attack' || f.pose === 'heavy')) { b.rotation.x = 0.2; A[1].rotation.x = -1.4 + Math.min(1, f.poseT * 6) * 1.2; }
  if (fr.startsWith('idle') && f.pose === 'cast') { A[1].rotation.x = -1.7; A[-1].rotation.x = -1.4; }
}

function entOf(key: object, id: string, build: () => Rig): Ent {
  let e = ents.get(key);
  if (e && e.key !== id) { world.remove(e.holder); if (e.decoy) world.remove(e.decoy.holder); ents.delete(key); e = undefined; }
  if (!e) {
    const holder = new T.Group(), rig = build();
    holder.add(rig.root); holder.scale.setScalar(SCALE);
    const shadow = add(holder, new T.CircleGeometry(0.55, 10), 0x000000, [0, 0.03, 0], [-Math.PI / 2, 0, 0], [1, 0.75, 1], { glow: 1, alpha: 0.35 });
    world.add(holder);
    e = { holder, rig, key: id, seen: frame, tint: '', shadow };
    ents.set(key, e);
  }
  e.seen = frame;
  e.holder.visible = true;
  return e;
}
/** Grid position of a fighter's feet, from its panel and the 2D pixel offsets (steps, knockback, hops). */
function place(h: T.Object3D, col: number, row: number, ox: number, oy: number): void {
  h.position.set(col + 0.5 + ox / PX, 0, row + FOOT_Z + oy / 19);
}
function iceBlock(e: Ent, on: boolean): void {
  if (on && !e.ice) e.ice = add(e.holder, G.box(1.5, 2.6, 1.3), 0xa4e4fc, [0, 1.2, 0], [0, 0.4, 0], [1, 1, 1], { alpha: 0.45, rough: 0.05 });
  if (e.ice) e.ice.visible = on;
}

function syncFighter(b: Battle, f: Fighter, me: Side3, look: Look, t: number): void {
  const e = entOf(f, `f:${f.cls}`, () => buildFighter(f.cls));
  const d = b.dir(f);
  place(e.holder, f.col, f.row, f.dx + look.ox, f.dy + look.oy);
  e.holder.rotation.y = d * 0.8;
  e.holder.visible = !(f.dead && look.hide);
  e.rig.root.position.y = f.cls === 'mage' && !f.dead ? 0.12 + Math.sin(t * 2.6) * 0.06 : 0;
  pose(e.rig, f, look, t);
  e.shadow.visible = !f.dead;
  const tick = Math.floor(t * 30);
  if (f.st.stealth > 0 && !f.dead) setTint(e, me === 'all' || me === f.side ? 'ghostMine' : 'ghost');
  else if (f.flash > 0 || look.white) setTint(e, 'flash');
  else if ((f.st.stunned > 0 || f.st.sleep > 0) && tick % 4 < 2) setTint(e, 'stun');
  else setTint(e, 'none', f.dead ? look.alpha : 1);
  iceBlock(e, !f.dead && (f.st.frozen > 0 || f.st.iceBlock > 0));
  // Shadow Clone: a second copy of the Rogue standing on the decoy panel
  if (f.st.decoy > 0 && !f.dead) {
    if (!e.decoy) { const holder = new T.Group(), rig = buildFighter(f.cls); holder.add(rig.root); holder.scale.setScalar(SCALE); world.add(holder); e.decoy = { holder, rig }; }
    e.decoy.holder.visible = true;
    place(e.decoy.holder, f.decoyCol, f.decoyRow, 0, 0); e.decoy.holder.rotation.y = d * 0.8;
    setTint(e.decoy as { rig: Rig; tint?: string }, 'none', me === 'all' || me === f.side ? 0.6 : 1);
  } else if (e.decoy) e.decoy.holder.visible = false;
}

function syncMob(b: Battle, f: Fighter, t: number): void {
  const m = f.mob!;
  const e = entOf(f, `m:${m.kind}`, () => buildMob(m.kind));
  const lunge = f.pose === 'attack' ? -2 : 0, wind = f.pose === 'cast' ? -1.5 : 0;
  place(e.holder, f.col, f.row, f.dx + lunge, f.dy);
  e.holder.rotation.y = b.dir(f) * 0.8;
  e.rig.root.position.y = (e.rig.hover ? e.rig.hover + Math.sin(t * 3 + f.row) * 0.1 : 0) - wind * 0.06;
  resetPose(e.rig);
  e.rig.body.rotation.x = f.pose === 'attack' ? 0.3 : f.pose === 'cast' ? -0.2 : 0;
  for (const [i, l] of e.rig.legs.entries()) l.rotation.x = Math.sin(t * 6 + i * 1.7) * 0.25;
  for (const s of [1, -1] as const) e.rig.arms[s].rotation.z = e.rig.hover ? Math.sin(t * 14) * 0.5 * s : 0;
  if (f.dead) { e.holder.visible = !(m.deadT > 0.5) && Math.floor(t * 30) % 2 === 0; e.rig.body.rotation.x = -1.2; setTint(e, 'flash'); }
  else if (f.flash > 0) setTint(e, 'flash');
  else if (f.st.stunned > 0 && Math.floor(t * 30) % 4 < 2) setTint(e, 'stun');
  else setTint(e, 'none');
  iceBlock(e, !f.dead && (f.st.frozen > 0 || f.st.iceBlock > 0));
}

const WALL_LOOK: Record<Wall['kind'], () => Rig> = {
  stone: () => { const r = blank(); add(r.body, G.box(0.9, 1.5, 0.18), 0xa8b0c0, [0, 0.75, 0]); add(r.body, G.box(0.18, 1.3, 0.04), 0x3d5bb8, [0, 0.8, 0.1]); for (const [x, y] of [[-0.35, 1.35], [0.35, 1.35], [-0.35, 0.2], [0.35, 0.2]]) add(r.body, G.ico(0.05, 0), 0x5a5a6a, [x, y, 0.1]); return r; },
  ice: () => { const r = blank(); for (const [x, h, z] of [[-0.25, 1.2, 0], [0.15, 1.6, -0.1], [0.3, 0.9, 0.15], [-0.05, 0.8, 0.2]]) add(r.body, G.cone(0.2, h, 4), 0xa4e4fc, [x, h / 2, z], [0, x * 3, x * 0.4], [1, 1, 1], { alpha: 0.85 }); return r; },
  glacial: () => { const r = blank(); add(r.body, G.cyl(0.3, 0.45, 2.2, 6), 0x7ac8f8, [0, 1.1, 0], [0, 0, 0], [1, 1, 1], { alpha: 0.8, rough: 0.05 }); add(r.body, G.cone(0.3, 0.5, 6), 0xd8f4fc, [0, 2.45, 0]); return r; },
  holy: () => { const r = blank(); add(r.body, G.box(0.9, 1.9, 0.12), 0xffe680, [0, 0.95, 0], [0, 0, 0], [1, 1, 1], { glow: 1, alpha: 0.45 }); add(r.body, G.box(0.1, 1.2, 0.14), 0xfff8d0, [0, 1.0, 0], [0, 0, 0], [1, 1, 1], { glow: 1 }); add(r.body, G.box(0.6, 0.1, 0.14), 0xfff8d0, [0, 1.3, 0], [0, 0, 0], [1, 1, 1], { glow: 1 }); return r; },
  bear: () => buildMob('spiritbear'),
};
function blank(): Rig { const root = new T.Group(), body = new T.Group(); root.add(body); return { root, body, head: new T.Group(), arms: { 1: new T.Group(), [-1]: new T.Group() } as Rig['arms'], legs: [], hover: 0 }; }

function syncWall(b: Battle, w: Wall, t: number): void {
  const e = entOf(w, `w:${w.kind}`, WALL_LOOK[w.kind]);
  place(e.holder, w.col, w.row, 0, 1);
  e.holder.rotation.y = w.kind === 'bear' ? b.dir(w.side) * 1.1 : b.dir(w.side) * 0.35;
  if (w.kind === 'holy') e.rig.root.position.y = Math.sin(t * 3) * 0.05;
  setTint(e, 'none');
}
function syncPet(b: Battle, p: Pet, t: number): void {
  if (p.kind === 'bear') return; // drawn as its wall
  const owner = b.f[p.side], d = b.dir(p.side);
  if (p.kind === 'hawk') {
    const e = entOf(p, 'p:hawk', () => buildMob('hawk'));
    const ang = t * 3;
    e.holder.position.set(owner.col + 0.5 + Math.cos(ang) * 12 / PX, 38 / (PX * Math.cos(TILT)) - Math.sin(ang) * 0.05, owner.row + FOOT_Z);
    e.holder.rotation.y = Math.sin(ang) > 0 ? -1.4 : 1.4;
    for (const s of [1, -1] as const) e.rig.arms[s].rotation.z = Math.sin(t * 18) * 0.6 * s;
    e.shadow.visible = false;
    setTint(e, 'none');
    return;
  }
  const e = entOf(p, 'p:wolf', () => buildMob('wolf'));
  const row = p.row ?? owner.row, col = p.row === null ? owner.col : p.col;
  place(e.holder, col, row, -d * (p.row === null ? 16 : 2) + Math.sin(t * 4 + row) * 2, 0);
  e.holder.scale.setScalar(SCALE * 0.75);
  e.holder.rotation.y = d * 1.3;
  for (const [i, l] of e.rig.legs.entries()) l.rotation.x = Math.sin(t * 10 + i * 1.7) * 0.4;
  setTint(e, 'none');
}

type Side3 = 0 | 1 | 'all';

/**
 * Draw the 3D picture of the battle into the world layer, covering the whole visible screen. Returns false
 * when WebGL is unavailable (the caller then draws the 2D picture instead).
 */
export function drawBattle3D(c: Ctx, b: Battle, st: Stage, me: Side3, looks: Map<Fighter, Look>): boolean {
  if (!init() || !renderer) return false;
  frame++;
  const t = b.time;
  if (setId !== st.id) {
    if (setG) back.remove(setG.group);
    setG = buildSet(st.id); setId = st.id; back.add(setG.group);
    back.background = new T.Color(setG.sky);
  }
  applyPanels(st);
  for (const f of b.everyone()) {
    if (f.mob) syncMob(b, f, t);
    else { const look = looks.get(f); if (look) syncFighter(b, f, me, look, t); }
  }
  for (const w of b.walls) syncWall(b, w, t);
  for (const p of b.pets) syncPet(b, p, t);
  // bodies not in this battle hide; ones gone for a while are dropped (card previews draw other battles in between)
  for (const [k, e] of ents) {
    if (e.seen === frame) continue;
    e.holder.visible = false; if (e.decoy) e.decoy.holder.visible = false;
    if (frame - e.seen > 120) { world.remove(e.holder); if (e.decoy) world.remove(e.decoy.holder); ents.delete(k); }
  }

  // camera: the screen centre of the 240×160 layout is grid (3, 0, −0.947); 38 px per unit on both screen axes
  const w = view.w, h = view.h;
  const tx = (120 - 6) / PX, tz = (80 - 98) / 19;
  cam.left = -w / 2 / PX; cam.right = w / 2 / PX; cam.top = h / 2 / PX; cam.bottom = -h / 2 / PX;
  cam.position.set(tx, Math.sin(TILT) * 60, tz + Math.cos(TILT) * 60);
  cam.lookAt(tx, 0, tz);
  cam.updateProjectionMatrix();
  const cw = Math.round(w * HD), ch = Math.round(h * HD);
  const canvas = renderer.domElement;
  if (canvas.width !== cw || canvas.height !== ch) renderer.setSize(cw, ch, false);
  // the set: framed so the grid area sits low on the screen and the horizon shows above the back wall
  backCam.aspect = w / h;
  backCam.fov = 2 * Math.atan((h / 2 / PX) / 13) * 180 / Math.PI * 1.6;
  backCam.position.set(tx, 4.2, 17);
  backCam.lookAt(tx, 1.6, -3);
  backCam.updateProjectionMatrix();
  renderer.clear();
  renderer.render(back, backCam);
  renderer.clearDepth();
  renderer.render(scene, cam);
  c.drawImage(canvas, -view.ox, -view.oy, w, h);
  return true;
}
