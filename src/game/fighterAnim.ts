// Character animations for the battle view: idle, steps, getting hit, casting and the KO, each with a
// look per class. Drawing only: everything is read off the Battle each frame and kept in a WeakMap here,
// so the lockstep simulation never sees it.
import { panelFoot } from '../art/arena';
import { spriteRows, type ClassId, type Pose, type Sprite } from '../art/sprites';
import type { FrameId } from '../art/fighterFrames';
import { P, glow, type Ctx } from '../engine/gfx';
import { TUNING } from './tuning';
import type { Battle, Fighter, Fx } from './battle';
import { ARC, ELEMENT_RAMP, HOLY, SHADOW, STEEL, spawnPart } from './fxView';

const LEAF = ['#b8f818', '#58d854', '#00a800', '#005800'];
const BARK = ['#ac7c00', '#503000'];
const DUST = ['#fce0a8', '#bcbcbc', '#7c7c7c'];
const RAGE = ['#fcfcfc', '#f8b800', '#f83800', '#a81000'];
const SMOKE = ['#bcbcbc', '#7c7c7c', '#3c3c3c'];

/** How long each animation runs, in seconds. Steps finish inside TUNING.moveCooldown so the sprite is home before the next one. */
const STEP = { warrior: 0.08, mage: 0.1, rogue: 0.12, ranger: 0.09, cleric: 0.09 } satisfies Record<ClassId, number>;
const HIT = 0.28;
const CAST = 0.45;

interface State {
  col: number; row: number; hp: number; flash: number; dead: boolean;
  /** Steps: when, from where (world px), and whether it was a knockback. */
  mvT: number; fromX: number; fromY: number; knock: boolean; landed: boolean;
  hitT: number; hitBig: boolean; hitDone: boolean;
  castT: number; castEl: string; castDone: boolean;
  deadT: number; deadStage: number; cutDone: number;
}

const states = new WeakMap<Fighter, State>();
const seenCast = new WeakSet<Fx>();

/** What the battle view needs to draw a fighter this frame. */
export interface Look {
  /** Offset from the panel foot (steps, recoil, hops). */
  ox: number; oy: number;
  /** Which drawn frame of the class's sheet (art/fighterFrames.ts). */
  frame: FrameId;
  /** Dissolves and fades on top of the frame. */
  pose: Pose;
  alpha: number;
  hide: boolean;
  /** Whiteout, for the Cleric's ascension. */
  white: boolean;
}

const ease = (p: number): number => 1 - (1 - p) * (1 - p);
const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

function stateOf(b: Battle, f: Fighter): State {
  let s = states.get(f);
  if (!s) {
    s = { col: f.col, row: f.row, hp: f.hp, flash: f.flash, dead: f.dead, mvT: -99, fromX: 0, fromY: 0, knock: false, landed: true,
      hitT: -99, hitBig: false, hitDone: true, castT: -99, castEl: 'arcane', castDone: true, deadT: f.dead ? b.time - 9 : -99, deadStage: 9, cutDone: 99 };
    states.set(f, s);
  }
  return s;
}

/** Read the battle for new steps, hits, casts and the KO. Call once per frame per fighter before drawing it. */
export function observe(b: Battle, f: Fighter): State {
  const s = stateOf(b, f), t = b.time;
  // the battle rewound or restarted (training resets, replays): forget what was playing
  if (t < s.mvT || t < s.hitT || t < s.castT || (t < s.deadT)) { states.delete(f); return stateOf(b, f); }
  const hit = f.flash > s.flash + 0.01 || f.hp < s.hp - 0.5;
  if (hit && !f.dead) {
    s.hitT = t; s.hitBig = s.hp - f.hp >= TUNING.flinchThreshold; s.hitDone = false;
  }
  if (f.col !== s.col || f.row !== s.row) {
    const steps = Math.abs(f.col - s.col) + Math.abs(f.row - s.row);
    const from = panelFoot(s.col, s.row);
    // one panel is a step (or a knockback when it came with a hit); anything else is a blink and snaps
    if (steps === 1) { s.mvT = t; s.fromX = from.x; s.fromY = from.y; s.knock = f.pose === 'hurt' || hit; s.landed = false; }
    else s.mvT = -99;
    s.col = f.col; s.row = f.row;
  }
  for (const e of b.fx) {
    if (e.kind !== 'cast' || e.side !== f.side || seenCast.has(e)) continue;
    seenCast.add(e);
    s.castT = t - e.t; s.castEl = String(e.data?.el ?? 'arcane'); s.castDone = false;
  }
  if (f.dead && !s.dead) { s.deadT = t; s.deadStage = 0; s.cutDone = -1; }
  if (!f.dead && s.dead) s.deadT = -99;
  s.hp = f.hp; s.flash = f.flash; s.dead = f.dead;
  return s;
}

/** The fighter's frame and offset this frame. `held`: frozen, stunned or asleep (no recoil, no idle). */
export function lookOf(b: Battle, f: Fighter, s: State, held: boolean): Look {
  const t = b.time, d = b.dir(f), cls = f.cls;
  const L: Look = { ox: 0, oy: 0, frame: 'idle0', pose: {}, alpha: 1, hide: false, white: false };
  if (f.dead) return deathLook(b, f, s, L);
  if (held) return L;

  // idle: each class breathes at its own pace
  const rate = cls === 'rogue' ? 3.6 : cls === 'warrior' ? 1.6 : cls === 'cleric' ? 1.4 : cls === 'mage' ? 1.3 : 2.5;
  L.frame = Math.floor(t * rate) % 2 ? 'idle1' : 'idle0';
  if (cls === 'mage') L.oy = -1 - Math.round(Math.sin(t * 2.6));   // hovers on his magic

  // steps
  const mp = (t - s.mvT) / (s.knock ? 0.1 : STEP[cls]);
  if (mp >= 0 && mp < 1) {
    const here = panelFoot(f.col, f.row);
    const bx = s.fromX - here.x, by = s.fromY - here.y;   // where we came from, relative to here
    if (s.knock) { L.ox += bx * (1 - ease(mp)); L.oy += by * (1 - ease(mp)); L.frame = 'hit'; }
    else if (cls === 'warrior') {
      // a short, heavy hop that lands in a crouch
      L.ox += bx * (1 - mp); L.oy += by * (1 - mp) - Math.round(Math.sin(mp * Math.PI) * 2);
      L.frame = mp < 0.7 ? 'hop' : 'land';
    } else if (cls === 'ranger') {
      // a light, springy leap
      L.ox += bx * (1 - ease(mp)); L.oy += by * (1 - ease(mp)) - Math.round(Math.sin(mp * Math.PI) * 5);
      L.frame = mp < 0.75 ? 'hop' : 'land';
    } else if (cls === 'cleric') {
      // glides over the floor, robe trailing
      L.ox += bx * (1 - ease(mp)); L.oy += by * (1 - ease(mp)) - 1;
      L.frame = 'hop';
    } else if (cls === 'mage') {
      // blinks: already there, fading in line by line
      L.pose.scan = mp < 0.5 ? Math.floor(t * 60) % 2 : undefined;
      L.frame = 'hop';
    } else {
      // Rogue dashes: already there in a low crouch, afterimages trail behind (drawUnder)
      L.frame = 'land';
    }
  } else if (mp >= 1 && mp < 1.5 && !s.knock && (cls === 'warrior' || cls === 'ranger')) {
    L.frame = 'land';   // the landing settles
  }

  // basic attacks: a held charge shows the wind-up; a heavy winds up, then swings
  if (f.charging && f.charge > 0.15) L.frame = 'windup';
  if (f.pose === 'attack') L.frame = f.poseT > 0.14 ? 'windup' : 'slash';
  if (f.pose === 'heavy') L.frame = f.poseT > 0.26 ? 'windup' : 'slash';

  // casting
  const cp = (t - s.castT) / CAST;
  if (cp >= 0 && cp < 0.75) {
    L.frame = cp < 0.3 ? 'cast0' : 'cast1';
    if (cls === 'mage') L.oy -= Math.round(Math.sin(Math.min(1, cp * 1.4) * Math.PI) * 3);   // lifts off the floor on the spell
  }

  // getting hit: recoil away from the blow
  const hp = (t - s.hitT) / HIT;
  if (hp >= 0 && hp < 1) {
    const k = hp < 0.12 ? hp / 0.12 : 1 - ease((hp - 0.12) / 0.88), big = s.hitBig ? 1.5 : 1;
    const back = cls === 'warrior' ? 1 : cls === 'mage' ? 3 : 2;
    L.ox -= Math.round(back * big * k) * d;
    if (hp < 0.6) L.frame = 'hit';
  }
  return L;
}

// ---------- the KO ----------
// The KO phase runs 2.2s. Warrior and Ranger stay down; Mage, Rogue and Cleric leave the field.
function deathLook(b: Battle, f: Fighter, s: State, L: Look): Look {
  const t = b.time - s.deadT, d = b.dir(f);
  switch (f.cls) {
    case 'warrior':
      // reels back, crashes to a knee, sags, pitches forward onto his hands, then flat on his face (one bounce)
      L.ox = -3 * d;
      if (t < 0.15) { L.ox = -Math.round(ease(t / 0.15) * 2) * d; L.frame = 'hit'; }
      else if (t < 0.32) L.frame = 'stagger';
      else if (t < 0.62) { L.frame = 'kneel'; L.oy = t < 0.36 ? 1 : 0; }
      else if (t < 0.72) L.frame = 'slump';
      else if (t < 0.82) L.frame = 'fall1';
      else L.frame = t >= 0.86 && t < 0.92 ? 'fall2' : 'down';
      break;
    case 'ranger':
      // blown off his feet: hops back, sits down hard, tips onto his back (one bounce)
      L.ox = -4 * d;
      if (t < 0.2) { const p = t / 0.2; L.ox = -Math.round(ease(p) * 3) * d; L.oy = -Math.round(Math.sin(p * Math.PI) * 4); L.frame = 'hit'; }
      else if (t < 0.3) L.frame = 'stagger';
      else if (t < 0.42) { L.frame = 'fall1'; L.oy = t < 0.34 ? 1 : 0; }
      else if (t < 0.5) L.frame = 'fall2';
      else L.frame = 'down';
      if (t >= 0.54 && t < 0.6) L.oy = -1;
      break;
    case 'mage':
      // reels, sinks to his knees, then unravels into arcane motes from the hat down
      if (t < 0.3) { L.frame = 'hit'; L.oy = -Math.round(Math.sin((t / 0.3) * Math.PI) * 3); }
      else { const p = clamp01((t - 0.45) / 0.9); L.frame = 'kneel'; L.pose.cut = 4 + Math.floor(p * 22); L.hide = p >= 1; }
      break;
    case 'rogue':
      // doubles over, then vanishes in a burst of smoke, leaving her dagger behind
      if (t < 0.2) L.frame = 'hit';
      else if (t < 0.4) L.frame = 'kneel';
      else if (t < 0.5) { L.frame = 'kneel'; L.alpha = 0.4; }
      else L.hide = true;
      break;
    case 'cleric':
      // kneels, light falls on him, and he rises into it
      L.frame = 'kneel';
      if (t >= 0.35 && t < 0.55) L.white = Math.floor(t * 20) % 2 === 0;
      else if (t >= 0.55) { const p = clamp01((t - 0.55) / 0.9); L.frame = 'cast1'; L.white = true; L.oy = -Math.round(ease(p) * 26); L.alpha = 1 - p; L.pose.scan = p > 0.3 ? Math.floor(t * 30) % 2 : undefined; L.hide = p >= 1; }
      break;
  }
  return L;
}

// ---------- effects around the fighter ----------

/** Behind the fighter: cast glyphs on the floor, step trails, the Cleric's light. x, y: the panel foot. */
export function drawUnder(c: Ctx, b: Battle, f: Fighter, s: State, sp: Sprite, x: number, y: number, flip: boolean, drawGhost: (gx: number, gy: number, frame: FrameId) => void): void {
  const t = b.time;
  if (f.dead) {
    const k = t - s.deadT;
    if (f.cls === 'cleric' && k > 0.3 && k < 2.1) {
      // a column of light falls onto the panel, then thins away
      const a = k < 0.5 ? (k - 0.3) / 0.2 : k > 1.6 ? (2.1 - k) / 0.5 : 1;
      c.globalAlpha = 0.45 * a; P(c, HOLY[2], x - 7, 0, 14, y + 1); c.globalAlpha = 0.7 * a; P(c, HOLY[3], x - 3, 0, 6, y + 1); c.globalAlpha = 1;
      glow(c, x, y - 4, 16, '248,216,120', 0.4 * a);
    }
    if (f.cls === 'mage' && k > 0.45 && k < 2.2) {
      // the rune circle he leaves behind, turning and fading out
      const a = k < 0.7 ? (k - 0.45) / 0.25 : k > 1.7 ? (2.2 - k) / 0.5 : 1, rx = 4 + 8 * Math.min(1, (k - 0.45) / 0.25);
      for (let i = 0; i < 36; i++) {
        if ((i + Math.floor(t * 30)) % 4 >= Math.ceil(4 * a)) continue;
        const ang = (i / 36) * Math.PI * 2 + t * 2;
        P(c, i % 6 === 0 ? ARC[3] : ARC[2], x + Math.cos(ang) * rx, y + Math.sin(ang) * rx * 0.3, 1, 1);
      }
      glow(c, x, y - 2, 14, '248,120,248', 0.3 * a);
    }
    if (f.cls === 'rogue' && k > 0.45) {
      // the dropped dagger, glinting now and then
      P(c, '#000000', x - 6, y - 2, 12, 3); P(c, '#bcbcbc', x - 5, y - 1, 7, 1); P(c, '#503000', x + 2, y - 1, 3, 1);
      if (Math.floor(t * 2) % 4 === 0) P(c, '#fcfcfc', x - 3, y - 1, 1, 1);
    }
    return;
  }
  // Rogue afterimages along the dash
  const mp = (t - s.mvT) / STEP.rogue;
  if (f.cls === 'rogue' && !s.knock && mp >= 0 && mp < 1) {
    const here = panelFoot(f.col, f.row);
    for (const k of [0.33, 0.66]) {
      if (mp > k) continue;
      c.globalAlpha = 0.5 * (1 - mp / k);
      drawGhost(Math.round(here.x + (s.fromX - here.x) * k), Math.round(here.y + (s.fromY - here.y) * k), 'land');
    }
    c.globalAlpha = 1;
  }
  const cp = (t - s.castT) / CAST;
  if (cp >= 0 && cp < 1) drawCastGlyph(c, f.cls, ELEMENT_RAMP[s.castEl] ?? ARC, cp, x, y, b.dir(f), t);
  void sp; void flip;
}

/** The floor glyph that marks a cast: one shape per class, in the spell's element colors. */
function drawCastGlyph(c: Ctx, cls: ClassId, ramp: string[], p: number, x: number, y: number, d: number, t: number): void {
  const fade = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
  const on = (i: number): boolean => fade >= 1 || (i + Math.floor(t * 30)) % 3 < 3 * fade;
  const ell = (rx: number, ry: number, col: string, n: number, skip = 0, rot = 0): void => {
    for (let i = 0; i < n; i++) {
      if ((skip && i % skip === 0) || !on(i)) continue;
      const a = (i / n) * Math.PI * 2 + rot;
      P(c, col, x + Math.cos(a) * rx, y + Math.sin(a) * ry, 1, 1);
    }
  };
  const grow = Math.min(1, p / 0.25);
  switch (cls) {
    case 'mage': {
      // a turning rune circle: two rings and six rune ticks
      const rx = 3 + 9 * grow, ry = 1 + 3 * grow;
      ell(rx, ry, ramp[2], 40);
      ell(rx * 0.6, ry * 0.6, ramp[1], 24, 4);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + t * 3;
        if (on(i)) P(c, ramp[3], x + Math.cos(a) * rx * 0.8, y + Math.sin(a) * ry * 0.8 - 1, 1, 2);
      }
      break;
    }
    case 'warrior': {
      // a shockwave cracks out from his feet, with flames of rage licking up
      const rx = 4 + 10 * ease(Math.min(1, p / 0.6)), ry = rx / 3.5;
      ell(rx, ry, ramp[1], 32, 5);
      ell(rx - 2, ry - 0.5, ramp[2], 24, 3);
      if (p < 0.6) for (let i = 0; i < 4; i++) {
        const fx = x - 7 + i * 5, h = 2 + ((i * 3 + Math.floor(t * 24)) % 4);
        P(c, RAGE[1 + ((i + Math.floor(t * 20)) % 2)], fx, y - h, 1, h);
      }
      break;
    }
    case 'rogue': {
      // a swirl of smoke at her feet
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + t * 9, r = 5 + 6 * grow;
        if (on(i)) P(c, i % 2 ? ramp[1] : SHADOW[1], x + Math.cos(a) * r, y + Math.sin(a) * r * 0.3 - 1, 2, 1);
      }
      break;
    }
    case 'ranger': {
      // a ring of leaves and a sight line ahead
      ell(4 + 7 * grow, 1 + 2 * grow, ramp[1], 20, 2, t * 4);
      for (let i = 0; i < 3; i++) if (on(i)) P(c, ramp[2], x + d * (12 + i * 5 + Math.round(p * 8)) - (d < 0 ? 2 : 0), y - 10, 3, 1);
      break;
    }
    case 'cleric': {
      // a glowing cross on the floor
      const r = Math.round(3 + 7 * grow);
      P(c, ramp[1], x - r, y, r * 2 + 1, 1);
      P(c, ramp[1], x, y - Math.round(r / 3), 1, Math.round(r / 3) * 2 + 1);
      if (fade >= 1) P(c, ramp[3], x - 1, y, 3, 1);
      break;
    }
  }
}

/** In front of the fighter: one-shot particles (dust, sparks, motes) and the Cleric's halo. fx, y: where the sprite stands. */
export function drawOver(c: Ctx, b: Battle, f: Fighter, s: State, sp: Sprite, L: Look, fx: number, y: number, flip: boolean): void {
  const t = b.time, d = b.dir(f), cls = f.cls;
  if (f.dead) { deathFx(c, b, f, s, sp, L, fx, y, flip); return; }

  // landing a step
  const mp = (t - s.mvT) / (s.knock ? 0.1 : STEP[cls]);
  if (!s.landed && mp >= 0) {
    if (cls === 'mage' && !s.knock) {
      // sparkles where he left and where he lands
      // he folds up into sparks where he stood and unfolds out of them where he lands
      for (let i = 0; i < 10; i++) spawnPart(s.fromX + rnd(-6, 6), s.fromY - rnd(2, 22), { vx: rnd(-6, 6), vy: rnd(-40, -10), drag: 0.95, life: rnd(0.2, 0.4), ramp: [ARC[3], ARC[2], ARC[1]] });
      for (let i = 0; i < 10; i++) { const a = rnd(0, Math.PI * 2); spawnPart(fx + Math.cos(a) * 12, y - 10 + Math.sin(a) * 10, { vx: -Math.cos(a) * 60, vy: -Math.sin(a) * 50, drag: 0.85, life: 0.18, ramp: [ARC[3], ARC[2]] }); }
      s.landed = true;
    } else if (cls === 'rogue' && !s.knock) {
      for (let i = 0; i < 3; i++) spawnPart(s.fromX + rnd(-5, 5), s.fromY - rnd(0, 4), { vx: rnd(-8, 8), vy: rnd(-8, -2), life: rnd(0.25, 0.4), ramp: SMOKE, size: 2, shrink: 0.5 });
      s.landed = true;
    } else if (cls === 'ranger' && !s.knock && mp < 0.2) {
      // kicks up a couple of leaves on takeoff
      for (let i = 0; i < 2; i++) spawnPart(s.fromX + rnd(-4, 4), s.fromY - 1, { vx: rnd(-10, 10), vy: rnd(-16, -8), g: 30, life: rnd(0.35, 0.5), ramp: LEAF });
      s.landed = true;
    } else if (mp >= 1) {
      // feet hit the floor: a dust puff each side (big for the Warrior's stomp and for knockbacks)
      const n = cls === 'warrior' || s.knock ? 3 : cls === 'cleric' ? 0 : 1;
      for (let i = 0; i < n; i++) for (const side of [-1, 1]) spawnPart(fx + side * rnd(3, 6), y, { vx: side * rnd(10, 22), vy: rnd(-8, -2), drag: 0.9, life: rnd(0.2, 0.35), ramp: DUST, size: 2, shrink: 0.5, dither: true });
      if (cls === 'cleric' && !s.knock) for (let i = 0; i < 3; i++) spawnPart(fx + rnd(-6, 6), y - rnd(0, 3), { vy: rnd(-10, -4), life: rnd(0.3, 0.5), ramp: [HOLY[3], HOLY[2], HOLY[1]] });
      s.landed = true;
    }
  }

  // the burst of a hit, once
  if (!s.hitDone) {
    s.hitDone = true;
    const n = s.hitBig ? 6 : 3, hx = fx + d * 3, hy = y - 12;
    for (let i = 0; i < n; i++) {
      if (cls === 'warrior') spawnPart(hx + d * 4, hy + rnd(-4, 4), { vx: d * rnd(20, 60), vy: rnd(-50, -10), g: 160, life: rnd(0.15, 0.3), ramp: [STEEL[3], '#f8d878', STEEL[2]] });   // armor sparks
      else if (cls === 'mage') spawnPart(hx, hy + rnd(-6, 2), { vx: rnd(-20, 20), vy: rnd(-30, -10), drag: 0.92, life: rnd(0.3, 0.5), ramp: [ARC[3], ARC[2], ARC[1], ARC[0]] });
      else if (cls === 'rogue') spawnPart(hx, hy + rnd(-4, 4), { vx: -d * rnd(10, 30), vy: rnd(-12, 4), drag: 0.9, life: rnd(0.25, 0.4), ramp: [SHADOW[2], SHADOW[1], SHADOW[0]], size: 2, shrink: 0.5 });
      else if (cls === 'ranger') spawnPart(hx, hy + rnd(-6, 2), { vx: -d * rnd(10, 30), vy: rnd(-25, -10), g: 45, drag: 0.95, life: rnd(0.45, 0.7), ramp: i % 2 ? LEAF : BARK });   // leaves and twigs
      else spawnPart(hx, hy + rnd(-6, 2), { vx: rnd(-15, 15), vy: rnd(-25, -8), drag: 0.93, life: rnd(0.3, 0.5), ramp: [HOLY[3], HOLY[2], HOLY[1]] });
    }
  }

  // casting
  const cp = (t - s.castT) / CAST;
  if (cp >= 0 && cp < 1) {
    const ramp = ELEMENT_RAMP[s.castEl] ?? ARC, top = y - sp.h + spriteRows(sp).findIndex(r => r.length > 0);
    if (cls === 'cleric' && cp < 0.8) {
      // a halo over his head while he prays
      const col = cp < 0.1 || Math.floor(t * 20) % 4 ? ramp[2] : ramp[3];
      P(c, col, fx - 4, top - 3, 9, 1); P(c, col, fx - 5, top - 2, 1, 1); P(c, col, fx + 5, top - 2, 1, 1); P(c, col, fx - 4, top - 1, 9, 1);
    }
    if (cls === 'mage' && cp < 0.65) {
      const ox = fx + d * 8, oy = top - 1;
      if (Math.random() < 0.8) { const a = t * 14 + rnd(0, 1); spawnPart(ox + Math.cos(a) * 4, oy + Math.sin(a) * 3, { vx: -Math.sin(a) * 12, vy: Math.cos(a) * 9 - 6, life: rnd(0.15, 0.3), ramp: [ramp[3], ramp[2]] }); }
      if (Math.random() < 0.5) { const a = rnd(0, Math.PI * 2); spawnPart(fx + Math.cos(a) * 11, y + Math.sin(a) * 3, { vy: rnd(-26, -12), life: rnd(0.3, 0.5), ramp: [ramp[2], ramp[1]] }); }
    }
    if (!s.castDone) {
      s.castDone = true;
      if (cls === 'warrior') for (let i = 0; i < 6; i++) spawnPart(fx + rnd(-8, 8), y - rnd(0, 4), { vy: rnd(-40, -20), g: 30, life: rnd(0.25, 0.4), ramp: RAGE });
      else if (cls === 'mage') for (let i = 0; i < 10; i++) spawnPart(fx + rnd(-11, 11), y - 1, { vy: rnd(-34, -14), drag: 0.97, life: rnd(0.35, 0.6), ramp: [ramp[3], ramp[2], ramp[1]] });
      else if (cls === 'rogue') for (let i = 0; i < 4; i++) spawnPart(fx + rnd(-6, 6), y - rnd(0, 6), { vx: rnd(-14, 14), vy: rnd(-10, -2), drag: 0.9, life: rnd(0.3, 0.45), ramp: SMOKE, size: 2, shrink: 0.5, dither: true });
      else if (cls === 'ranger') for (let i = 0; i < 4; i++) spawnPart(fx + rnd(-8, 8), y - rnd(0, 2), { vx: rnd(-10, 10), vy: rnd(-22, -12), g: 35, life: rnd(0.4, 0.6), ramp: LEAF });
      else for (let i = 0; i < 6; i++) spawnPart(fx + rnd(-6, 6), top - 14 - rnd(0, 10), { vy: rnd(20, 40), life: rnd(0.25, 0.4), ramp: [ramp[3], ramp[2]] });   // light falls on him
    }
  }
}

function deathFx(c: Ctx, b: Battle, f: Fighter, s: State, sp: Sprite, L: Look, fx: number, y: number, flip: boolean): void {
  const t = b.time - s.deadT, d = b.dir(f);
  const at = (stage: number, when: number): boolean => { if (s.deadStage < stage && t >= when) { s.deadStage = stage; return true; } return false; };
  switch (f.cls) {
    case 'warrior':
      if (at(1, 0.32)) for (let i = 0; i < 4; i++) spawnPart(fx + rnd(-6, 6), y, { vx: rnd(-18, 18), vy: rnd(-8, -2), drag: 0.9, life: rnd(0.2, 0.35), ramp: DUST, size: 2, shrink: 0.5, dither: true });   // the knee hits the floor
      if (at(2, 0.82)) {
        // the thud: dust along his length and the sword clattering
        for (let i = 0; i < 12; i++) spawnPart(fx + d * rnd(-4, 16), y - rnd(0, 2), { vx: rnd(-30, 30), vy: rnd(-16, -4), drag: 0.9, life: rnd(0.3, 0.55), ramp: DUST, size: 2, shrink: 0.5, dither: true });
        for (let i = 0; i < 6; i++) spawnPart(fx - d * 8, y - 2, { vx: rnd(-30, 30), vy: rnd(-60, -25), g: 170, life: rnd(0.2, 0.4), ramp: [STEEL[3], '#f8d878', STEEL[2]] });
      }
      if (at(3, 0.92)) for (let i = 0; i < 3; i++) spawnPart(fx + d * rnd(0, 12), y, { vx: rnd(-12, 12), vy: rnd(-6, -2), drag: 0.9, life: 0.3, ramp: DUST, size: 1, dither: true });   // settling after the bounce
      break;
    case 'ranger':
      if (at(1, 0.3)) for (let i = 0; i < 5; i++) spawnPart(fx + rnd(-8, 4) * d, y, { vx: rnd(-18, 18), vy: rnd(-8, -2), drag: 0.9, life: rnd(0.2, 0.35), ramp: DUST, size: 2, shrink: 0.5, dither: true });   // sits down hard
      if (at(2, 0.5)) {
        for (let i = 0; i < 10; i++) spawnPart(fx - d * rnd(-4, 14), y - rnd(0, 2), { vx: rnd(-25, 25), vy: rnd(-14, -4), drag: 0.9, life: rnd(0.3, 0.5), ramp: DUST, size: 2, shrink: 0.5, dither: true });
        for (let i = 0; i < 7; i++) spawnPart(fx - d * rnd(0, 12), y - rnd(6, 16), { vx: rnd(-14, 14), vy: rnd(-24, -8), g: 25, drag: 0.96, life: rnd(0.9, 1.3), ramp: LEAF });
      }
      if (at(3, 0.6)) for (let i = 0; i < 3; i++) spawnPart(fx - d * rnd(0, 10), y, { vx: rnd(-12, 12), vy: rnd(-6, -2), drag: 0.9, life: 0.3, ramp: DUST, size: 1, dither: true });
      break;
    case 'mage': {
      // the killing blow scatters his ward in a ring of sparks
      if (at(1, 0)) for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; spawnPart(fx, y - 12, { vx: Math.cos(a) * rnd(35, 55), vy: Math.sin(a) * rnd(25, 40), drag: 0.9, life: rnd(0.3, 0.5), ramp: [ARC[3], ARC[2], ARC[1]] }); }
      // magic crackles off him while he sinks
      if (t < 0.5 && Math.random() < 0.7) spawnPart(fx + rnd(-8, 8), y - rnd(4, 20), { vx: rnd(-20, 20), vy: rnd(-20, 5), g: 40, life: rnd(0.12, 0.25), ramp: [ARC[3], ARC[2]] });
      // every row the dissolve passes breaks into motes in its own colors, swirling up
      const cut = L.pose.cut ?? (L.hide ? 99 : -1), rows = spriteRows(sp), ax = sp.ax * sp.res, top = Math.round(y) - rows.length;
      for (let r = Math.max(0, s.cutDone + 1); r < Math.min(rows.length, cut); r++) {
        for (const [px, col] of rows[r]) {
          const xx = Math.round(fx) + (flip ? ax - px : px - ax), side = xx < fx ? -1 : 1;
          spawnPart(xx, top + r, { vx: side * rnd(2, 14), vy: rnd(-34, -12), drag: 0.96, life: rnd(0.6, 1.1), ramp: [col, col, ARC[2], ARC[1], ARC[0]], size: Math.random() < 0.2 ? 2 : 1, shrink: 1 });
        }
      }
      s.cutDone = Math.max(s.cutDone, Math.min(rows.length - 1, cut - 1));
      // twinkling stars climb out of the rune circle he leaves behind
      if (t > 0.5 && t < 2 && Math.random() < 0.5) spawnPart(fx + rnd(-11, 11), y - rnd(0, 2), { vy: rnd(-30, -16), drag: 0.98, life: rnd(0.5, 0.9), ramp: [ARC[3], ARC[2], ARC[1]] });
      break;
    }
    case 'rogue':
      if (at(1, 0.42)) for (let i = 0; i < 16; i++) spawnPart(fx + rnd(-8, 8), y - rnd(0, 18), { vx: rnd(-20, 20), vy: rnd(-16, -2), drag: 0.92, life: rnd(0.5, 0.9), ramp: SMOKE, size: 3, shrink: 0.4, dither: true });
      break;
    case 'cleric':
      if (t > 0.55 && t < 1.45 && Math.random() < 0.6) spawnPart(fx + rnd(-6, 6), y + L.oy - rnd(0, 20), { vy: rnd(-24, -10), life: rnd(0.4, 0.7), ramp: [HOLY[3], HOLY[2], HOLY[1]] });
      break;
  }
  void c;
}
