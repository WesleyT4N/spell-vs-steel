// Draws a Battle: arena, panels, fighters, spell effects and the HUD.
import { k } from '../engine/input';
import { Colosseum, drawPanel, panelFoot, panelCenter, X0, Y0, PW, FACE, LIP, type PanelState } from '../art/arena';
import { getSprite, drawFighterSprite, teamColor, type Tint } from '../art/sprites';
import { P, UW, UH, blob, frame, glow, type Ctx } from '../engine/gfx';
import { drawText, drawTextOutlined, drawTextCentered, textWidth, wrap } from '../engine/font';
import { drawCardIcon } from '../scenes/cardView';
import { CARDS, ELEMENT_COLOR } from './cards';
import { TUNING } from './tuning';
import { heavyChargeOf } from './battle';
import type { Battle, Fighter, Fx, Pet, Projectile, Side, StatusKey, Trap, Wall } from './battle';
import { CLASS_INFO } from './classes';

const FIRE = ['#f83800', '#fca044', '#f8b800', '#fce0a8'];
const ICE = ['#0058f8', '#3cbcfc', '#a4e4fc', '#fcfcfc'];
const ARC = ['#940084', '#d800cc', '#f878f8', '#fcfcfc'];
const HOLY = ['#ac7c00', '#f8b800', '#f8d878', '#fcfcfc'];
const TOX = ['#005800', '#58d854', '#b8f818', '#fcfcfc'];
const SHADOW = ['#4428bc', '#6844fc', '#9878f8', '#fcfcfc'];
const STEEL = ['#3c3c3c', '#7c7c7c', '#bcbcbc', '#fcfcfc'];

/** Whose hidden things (traps, a stealthed fighter) are visible: one side's, or everything in the dev sandbox. */
export type Viewer = Side | 'all';

let arena: Colosseum | null = null;
export const getArena = (): Colosseum => (arena ??= new Colosseum());

export function drawBattle(c: Ctx, b: Battle, tick: number, me: Viewer = 0): void {
  const a = getArena();
  c.save();
  if (b.shake > 0) c.translate(Math.round((Math.random() - 0.5) * 4 * Math.min(1, b.shake * 4)), Math.round((Math.random() - 0.5) * 3 * Math.min(1, b.shake * 4)));
  a.draw(c, tick, b.cheer);

  // panels
  for (let r = 0; r < 3; r++) for (let col = 0; col < 6; col++) {
    const p = b.panels[col][r];
    if (p.hole > 0) { drawHole(c, col, r, p.owner); continue; }
    const state: PanelState = p.burn > 0 ? 'burning' : p.cracked ? 'cracked' : 'clean';
    const mark = b.marks.find(m => m.col === col && m.row === r);
    let hl = mark && Math.floor(b.time * 10) % 2 ? mark.color : undefined;
    // an armed Frost Nova blinks the enemy panels it covers
    if (!hl && Math.floor(b.time * 5) % 2 === 0) {
      for (const f of b.f) {
        if (f.st.frostNova > 0 && !f.frostNovaUsed && p.owner !== f.side && Math.abs(col - f.col) <= TUNING.frostNovaRange) hl = '#a4e4fc';
      }
    }
    drawPanel(c, col, r, state, tick, p.owner, hl);
  }
  // Frost Nova / Glacial zones get a frosty tint on the trigger columns
  for (const f of b.f) {
    if (f.st.frostNova > 0 && !f.frostNovaUsed) {
      for (let col = 0; col < 6; col++) for (let r = 0; r < 3; r++) {
        const inRange = b.panels[col][r].owner !== f.side && Math.abs(col - f.col) <= TUNING.frostNovaRange;
        if (inRange && (col + r + tick) % 4 === 0) { const pc = panelCenter(col, r); P(c, '#a4e4fc', pc.x - 1, pc.y - 1, 2, 2); }
      }
    }
  }

  // toxic, blessed and holy-fire panels
  for (let col = 0; col < 6; col++) for (let r = 0; r < 3; r++) drawPanelEffects(c, b, col, r, tick);
  for (const t of b.traps) if (me === 'all' || t.side === me) drawTrap(c, t, tick);

  // entities, back row first
  for (let r = 0; r < 3; r++) {
    for (const w of b.walls) if (w.row === r) drawWall(c, w, b.time);
    for (const f of b.f) if (f.row === r) drawFighter(c, b, f, tick, me);
  }
  for (const p of b.pets) drawPet(c, b, p, tick);
  for (const pr of b.projectiles) drawProjectile(c, b, pr);
  for (const e of b.fx) drawFx(c, b, e);
  c.restore();
}

function drawPanelEffects(c: Ctx, b: Battle, col: number, row: number, tick: number): void {
  const p = b.panels[col][row];
  if (p.hole > 0) return;
  const pc = panelCenter(col, row);
  if (p.toxic > 0) {
    // bubbles rising out of a green haze
    c.globalAlpha = 0.35; P(c, TOX[1], pc.x - PW / 2 + 3, pc.y - 4, PW - 6, 8); c.globalAlpha = 1;
    for (let i = 0; i < 4; i++) {
      const t = (b.time * 0.9 + i / 4 + col * 0.13) % 1;
      P(c, t > 0.7 ? TOX[3] : TOX[2], pc.x - 12 + i * 7, pc.y + 2 - Math.floor(t * 12), 2, 2);
    }
  }
  if (p.bless > 0) {
    for (let i = 0; i < 5; i++) {
      const t = (b.time * 0.7 + i / 5 + row * 0.2) % 1;
      if ((i + tick) % 3) P(c, t < 0.5 ? HOLY[3] : HOLY[2], pc.x - 13 + i * 6, pc.y + 3 - Math.floor(t * 10), 1, 2);
    }
    P(c, HOLY[2], pc.x - PW / 2 + 3, pc.y + 4, PW - 6, 1);
  }
  if (p.smite > 0) {
    for (let i = 0; i < 6; i++) {
      const h = 3 + ((i * 5 + tick) % 6);
      P(c, HOLY[(i + tick) % 3 + 1], pc.x - 14 + i * 5, pc.y + 4 - h, 3, h);
    }
  }
}

/** A hidden trap, drawn only for its owner: a faint snare outline that brightens once armed. */
function drawTrap(c: Ctx, t: Trap, tick: number): void {
  const pc = panelCenter(t.col, t.row);
  const col = t.kind === 'freeze' ? '#3cbcfc' : t.kind === 'mine' ? '#58d854' : '#f87800';
  const armed = t.arm <= 0;
  c.globalAlpha = armed ? 0.85 : 0.4;
  P(c, '#000000', pc.x - 6, pc.y - 2, 12, 5);
  P(c, col, pc.x - 5, pc.y - 1, 10, 3);
  for (let i = 0; i < 4; i++) P(c, armed && (tick + i) % 4 === 0 ? '#fcfcfc' : '#bcbcbc', pc.x - 7 + i * 4, pc.y - 3 + (i % 2) * 6, 2, 1);
  c.globalAlpha = 1;
}

/** Companions: wolves pace in their row by the Ranger's back column, hawks circle overhead, the bear stands on its panel. */
function drawPet(c: Ctx, b: Battle, p: Pet, tick: number): void {
  const owner = b.f[p.side];
  const d = p.side === 0 ? 1 : -1;
  if (p.kind === 'hawk') {
    const ang = b.time * 3;
    const o = fighterPos(b, owner);
    const x = o.x + Math.cos(ang) * 10, y = o.y - 30 + Math.sin(ang) * 3;
    const flap = tick % 4 < 2 ? 0 : 2;
    P(c, '#000000', x - 4, y - 1 - flap, 9, 3); P(c, '#ac7c00', x - 3, y - flap, 7, 1); P(c, '#fcfcfc', x + d * 2, y - 1, 2, 2);
    return;
  }
  if (p.kind === 'bear') return; // drawn as its wall
  const row = p.row ?? owner.row;
  const f = panelFoot(p.row === null ? owner.col : p.col, row);
  const x = Math.round(f.x - d * (p.row === null ? 10 : 2) + Math.sin(b.time * 4 + row) * 2), y = Math.round(f.y);
  drawWolf(c, x, y, d, tick % 8 < 4);
}

// a small grey wolf facing right: a = outline, b = fur, c = eye; the second rows are the running frame
const WOLF = ['......a.a..', '.....abab..', 'a...abbbbca', 'babbbbbbbaa', '.abbbbbbba.'];
const WOLF_LEGS = ['.a.a...a.a.', '..a.a.a.a..'];
function drawWolf(c: Ctx, x: number, y: number, d: number, step: boolean): void {
  const rows = [...WOLF, WOLF_LEGS[step ? 1 : 0]];
  rows.forEach((r, j) => [...r].forEach((ch, i) => {
    if (ch === '.') return;
    const px = d > 0 ? x - 5 + i : x + 5 - i;
    P(c, ch === 'a' ? '#000000' : ch === 'c' ? '#fcfcfc' : j === 3 ? '#bcbcbc' : '#7c7c7c', px, y - 6 + j, 1, 1);
  }));
}

function drawHole(c: Ctx, col: number, row: number, owner: 0 | 1): void {
  const x = X0 + col * PW, y = Y0 + row * (FACE + LIP);
  P(c, '#000000', x, y - 1, PW, FACE + LIP + 1);
  P(c, owner === 0 ? '#881400' : '#0058f8', x + 1, y, PW - 2, 1);
  P(c, '#1a1218', x + 3, y + 2, PW - 6, FACE - 2);
}

function drawWall(c: Ctx, w: Wall, time: number): void {
  const f = panelFoot(w.col, w.row);
  const cx = Math.round(f.x), base = Math.round(f.y + 1);
  const pct = Math.max(0, w.hp / w.maxHp);
  let top: number;
  if (w.kind === 'stone') top = drawTowerShield(c, w, cx, base, pct);
  else if (w.kind === 'ice') top = drawIceShards(c, w, cx, base, pct, time);
  else if (w.kind === 'holy') top = drawLightWall(c, cx, base, time);
  else if (w.kind === 'bear') top = drawBear(c, w, cx, base, time);
  else top = drawGlacialPillar(c, w, cx, base, time);
  if (!w.invuln) {
    P(c, '#000000', cx - 9, top - 5, 18, 3);
    P(c, pct > 0.5 ? '#58d854' : pct > 0.25 ? '#f8b800' : '#f83800', cx - 8, top - 4, Math.ceil(16 * pct), 1);
  }
}

/** Shield Wall: a planted steel tower shield with rivets and a stripe in the owner's color. Dents as it takes damage. */
function drawTowerShield(c: Ctx, w: Wall, cx: number, base: number, pct: number): number {
  const h = 18, top = base - h, x = cx - 8;
  const stripe = w.side === 0 ? '#d82800' : '#0058f8';
  P(c, '#000000', x - 1, top - 1, 18, h + 1);
  P(c, '#000000', x, base, 16, 1);
  for (let r = 0; r < h; r++) {
    const inset = r > h - 5 ? (r - (h - 5)) : 0;   // tapered foot
    P(c, '#7c7c7c', x + inset, top + r, 16 - inset * 2, 1);
    P(c, '#bcbcbc', x + 1 + inset, top + r, 12 - inset * 2, 1);
  }
  P(c, '#fcfcfc', x + 1, top, 14, 1);
  P(c, '#fcfcfc', x + 1, top + 1, 1, h - 6);
  P(c, stripe, x + 6, top + 1, 4, h - 4);
  P(c, mixDark(stripe), x + 9, top + 1, 1, h - 4);
  for (const [rx, ry] of [[2, 2], [13, 2], [2, 11], [13, 11]]) { P(c, '#3c3c3c', x + rx, top + ry, 1, 1); P(c, '#fcfcfc', x + rx, top + ry - 1, 1, 1); }
  // dents and cracks appear as it loses HP
  if (pct < 0.7) { P(c, '#3c3c3c', x + 3, top + 6, 2, 1); P(c, '#3c3c3c', x + 4, top + 7, 1, 2); }
  if (pct < 0.4) { P(c, '#000000', x + 11, top + 4, 1, 3); P(c, '#000000', x + 12, top + 7, 1, 3); P(c, '#000000', x + 10, top + 10, 1, 2); }
  return top;
}
const mixDark = (col: string): string => (col === '#d82800' ? '#881400' : '#0000a8');

/** Ice Wall: a cluster of jagged frost crystals with a shimmer that sweeps up them. Cracks as it weakens. */
/** Holy Wall: a shimmering pane of gold light. */
function drawLightWall(c: Ctx, cx: number, base: number, time: number): number {
  const top = base - 26;
  c.globalAlpha = 0.55;
  P(c, HOLY[1], cx - 5, top, 10, 26);
  c.globalAlpha = 1;
  P(c, HOLY[2], cx - 4, top + 1, 2, 24);
  P(c, HOLY[3], cx - 1, top + 2, 1, 22);
  for (let i = 0; i < 4; i++) {
    const t = (time * 1.2 + i / 4) % 1;
    P(c, HOLY[3], cx - 4 + ((i * 3) % 8), base - Math.floor(t * 26), 1, 1);
  }
  return top;
}

/** Spirit Bear: a big pale-blue bear, facing the enemy. */
function drawBear(c: Ctx, w: Wall, cx: number, base: number, time: number): number {
  const d = w.side === 0 ? 1 : -1;
  const bob = Math.floor(time * 2) % 2;
  const top = base - 17 + bob;
  const body = '#6888fc', hi = '#a4e4fc', dark = '#0000a8';
  P(c, '#000000', cx - 9, top + 4, 18, 13 - bob);
  P(c, body, cx - 8, top + 5, 16, 11 - bob);
  P(c, hi, cx - 8, top + 5, 16, 2);
  // head toward the enemy
  P(c, '#000000', cx + d * 5 - 4, top - 1, 9, 9);
  P(c, body, cx + d * 5 - 3, top, 7, 7);
  P(c, hi, cx + d * 5 - 3, top, 7, 1);
  P(c, '#000000', cx + d * 5 - 3, top - 2, 2, 2); P(c, '#000000', cx + d * 5 + 2, top - 2, 2, 2);
  P(c, '#fcfcfc', cx + d * 7, top + 2, 1, 1);
  P(c, dark, cx + d * 8, top + 4, 2, 2);
  for (const lx of [-7, -3, 2, 6]) P(c, dark, cx + lx, base - 2, 2, 2);
  glow(c, cx, top + 8, 14, '104,136,252', 0.2 + 0.1 * Math.sin(time * 4));
  return top - 2;
}

function drawIceShards(c: Ctx, w: Wall, cx: number, base: number, pct: number, time: number): number {
  const shards: Array<[number, number, number]> = [[-6, 4, 11], [0, 5, 17], [6, 4, 13]]; // x offset, half width, height
  const sweep = (time * 1.6 + w.col * 0.3) % 1.6;
  for (const [ox, hw, h] of shards) {
    for (let r = 0; r < h; r++) {
      const half = Math.max(0, Math.round(hw * Math.min(1, (r + 1) / (h * 0.45))));
      const y = base - h + r;
      P(c, '#000000', cx + ox - half - 1, y, half * 2 + 2, 1);
      if (half <= 0) continue;
      P(c, '#3cbcfc', cx + ox - half, y, half * 2, 1);
      P(c, '#a4e4fc', cx + ox - half, y, Math.max(1, half - 1), 1);
      if (Math.abs(r / h - (1 - sweep)) < 0.08) P(c, '#fcfcfc', cx + ox - half, y, half * 2, 1);
    }
    P(c, '#fcfcfc', cx + ox, base - h, 1, 2);
  }
  P(c, '#0078f8', cx - 10, base, 20, 1);
  if (pct < 0.6) { P(c, '#fcfcfc', cx - 1, base - 12, 1, 4); P(c, '#fcfcfc', cx, base - 8, 1, 3); P(c, '#fcfcfc', cx + 1, base - 5, 1, 2); }
  if (pct < 0.3) { P(c, '#fcfcfc', cx - 7, base - 8, 1, 3); P(c, '#fcfcfc', cx + 6, base - 9, 1, 4); }
  return base - 17;
}

/** Glacial Fortress: a tall deep-blue pillar capped with snow, a rune pulsing in its core and frost mist at its foot. */
function drawGlacialPillar(c: Ctx, w: Wall, cx: number, base: number, time: number): number {
  const h = 26, top = base - h, x = cx - 9;
  P(c, '#000000', x - 1, top - 1, 20, h + 2);
  P(c, '#0058f8', x, top, 18, h);
  P(c, '#0078f8', x + 2, top, 12, h);
  P(c, '#3cbcfc', x + 3, top + 2, 4, h - 4);
  P(c, '#a4e4fc', x + 4, top + 3, 1, h - 8);
  // snow cap with drips
  P(c, '#fcfcfc', x - 1, top - 2, 20, 3);
  for (const [dx, dl] of [[2, 3], [7, 2], [13, 4], [16, 2]]) P(c, '#fcfcfc', x + dx, top + 1, 1, dl);
  // pulsing rune
  const pulse = 0.5 + 0.5 * Math.sin(time * 4 + w.row);
  const rune = pulse > 0.5 ? '#fcfcfc' : '#a4e4fc';
  P(c, rune, cx - 1, top + 9, 2, 8); P(c, rune, cx - 3, top + 11, 6, 1); P(c, rune, cx - 3, top + 14, 6, 1);
  glow(c, cx, top + 13, 8, '164,228,252', 0.25 + 0.25 * pulse);
  // frost mist drifting at the base
  for (let i = 0; i < 6; i++) {
    const t = (time * 0.8 + i / 6 + w.row * 0.17) % 1;
    P(c, t < 0.6 ? '#fcfcfc' : '#a4e4fc', x - 3 + ((i * 5 + Math.floor(t * 8)) % 24), base - Math.floor(t * 4), 2, 1);
  }
  return top;
}

function fighterPos(_b: Battle, f: Fighter): { x: number; y: number } {
  const p = panelFoot(f.col, f.row);
  return { x: p.x + f.dx, y: p.y + f.dy };
}

function drawFighter(c: Ctx, b: Battle, f: Fighter, tick: number, me: Viewer): void {
  const s = getSprite(f.cls, f.skin, f.alt);
  // Stealth: the owner sees a see-through sprite, the opponent only a faint shimmer
  if (f.st.stealth > 0 && !f.dead) {
    const { x, y } = fighterPos(b, f);
    if (me === 'all' || me === f.side) { c.globalAlpha = 0.4; drawFighterSprite(c, s, x, y + 2, f.side === 1, 'ghost'); c.globalAlpha = 1; }
    else if (tick % 6 < 2) for (let i = 0; i < 3; i++) P(c, '#7c7c7c', x - 4 + i * 4, y - 8 - ((tick + i * 3) % 10), 1, 2);
    return;
  }
  const { x, y } = fighterPos(b, f);
  const flip = f.side === 1;
  // heavy: a short wind-back, then a deep lunge into the swing
  const lean = f.pose === 'attack' ? 2 : f.pose === 'heavy' ? (f.poseT > 0.26 ? -2 : 4) : f.pose === 'hurt' ? -2 : 0;
  const fx = x + lean * b.dir(f);
  // shadow
  P(c, '#000000', x - 5, y, 10, 1); P(c, '#000000', x - 4, y + 1, 8, 1);
  if (f.dead) {
    if (b.phase === 'ko' && Math.floor(b.koT * 8) % 2 === 0) drawFighterSprite(c, s, fx, y + 2, flip, 'ghost');
    return;
  }
  // charge aura: sparks spiral in toward the fighter, then a bright ring pulses once the heavy is ready
  const charge = f.charging && f.charge > 0.15 ? Math.min(1, f.charge / heavyChargeOf(f)) : 0;
  const ready = charge >= 1;
  if (charge > 0) {
    const cy = y - 9;
    glow(c, fx, cy, 10 + charge * 10, ready ? '248,184,0' : '60,188,252', 0.25 + charge * 0.35);
    if (!ready) {
      for (let i = 0; i < 10; i++) {
        const ph = (b.time * 2.2 + i / 10) % 1;          // each spark falls inward over its cycle
        const r = 22 - ph * 16, ang = (i / 10) * Math.PI * 2 + b.time * 5;
        const col = ph > 0.7 ? '#fcfcfc' : charge > 0.6 ? '#a4e4fc' : '#3cbcfc';
        P(c, col, fx + Math.cos(ang) * r, cy + Math.sin(ang) * r * 0.75, 2, 2);
      }
    } else {
      const r = 11 + (tick % 2);
      for (let i = 0; i < 16; i++) {
        const ang = (i / 16) * Math.PI * 2 + b.time * 3;
        P(c, tick % 2 ? '#f8b800' : '#fcfcfc', fx + Math.cos(ang) * r, cy + Math.sin(ang) * r * 0.75, 2, 1);
      }
    }
    // ground glow under the feet grows with the charge
    const gw = Math.round(6 + charge * 10);
    P(c, ready ? (tick % 2 ? '#f8b800' : '#fcfcfc') : '#3cbcfc', x - gw / 2, y + 1, gw, 1);
  }
  let tint: Tint = 'none';
  if (f.flash > 0 || (ready && tick % 4 === 0)) tint = 'flash';
  else if (f.st.frozen > 0) tint = 'ice';
  else if ((f.st.stunned > 0 || f.st.sleep > 0) && tick % 2) tint = 'stun';
  const bob = f.pose === 'idle' && Math.floor(b.time * 2.5) % 2 ? 1 : 0;
  const castLift = f.pose === 'cast' ? 1 : 0;
  drawFighterSprite(c, s, fx, y + 2 - bob - castLift, flip, tint);

  // transform glows
  if (f.st.avatar > 0 || f.st.ascendance > 0) {
    const col = f.st.avatar > 0 ? '#f8b800' : '#f878f8';
    for (let i = 0; i < 4; i++) P(c, col, fx - 8 + ((tick * 3 + i * 5) % 16), y - 4 - ((tick * 2 + i * 7) % 20), 1, 2);
  }
  if (f.st.iceBlock > 0) {
    P(c, '#3cbcfc', fx - 10, y - s.h - 2, 20, s.h + 3);
    P(c, '#a4e4fc', fx - 9, y - s.h - 1, 6, s.h + 1);
    P(c, '#fcfcfc', fx - 8, y - s.h, 2, 4);
    c.globalAlpha = 0.6; drawFighterSprite(c, s, fx, y + 2, flip, 'ice'); c.globalAlpha = 1;
  }
  // shields
  for (const sh of f.shields) {
    if (sh.hp <= 0) continue;
    if (sh.kind === 'guard') {
      const gx = fx + b.dir(f) * 9;
      P(c, '#000000', gx - 3, y - 15, 7, 11); P(c, '#fcfcfc', gx - 2, y - 14, 5, 9); P(c, '#bcbcbc', gx - 1, y - 12, 3, 5);
    } else {
      const col = sh.kind === 'barrier' ? '#f878f8' : sh.kind === 'unbreakable' ? '#f8b800' : sh.kind === 'holy' ? '#f8d878' : '#bcbcbc';
      const rx = 11, ry = 13;
      for (let i = 0; i < 28; i++) {
        if ((i + tick) % 3 === 0) continue;
        const ang = (i / 28) * Math.PI * 2;
        P(c, col, fx + Math.cos(ang) * rx, y - 10 + Math.sin(ang) * ry, 1, 1);
      }
    }
  }
  if (f.st.reflect > 0 && tick % 2) { P(c, '#fcfcfc', fx + b.dir(f) * 10, y - 18, 1, 14); }
  if (f.st.counterspell > 0) drawText(c, '×', fx - 2, y - s.h - 12, tick % 2 ? '#f878f8' : '#d800cc');
  if (f.st.frostNova > 0 && !f.frostNovaUsed && tick % 4 < 2) P(c, '#a4e4fc', fx - 1, y - s.h - 6, 3, 3);
  if (f.st.roared > 0) drawText(c, '↓', fx + 6, y - s.h - 4, '#bcbcbc');
  if (f.poison > 0) for (let i = 0; i < f.poison; i++) { const t = (b.time * 1.5 + i / f.poison) % 1; P(c, t > 0.7 ? TOX[3] : TOX[2], fx - 5 + i * 4, y - 6 - Math.floor(t * 16), 2, 2); }
  if (f.st.silenced > 0) { P(c, '#000000', fx - 10, y - s.h - 5, 7, 4); P(c, '#9878f8', fx - 9, y - s.h - 4, 5, 2); }
  if (f.st.sleep > 0) drawText(c, 'Z', fx + 5 + (tick % 8 < 4 ? 0 : 1), y - s.h - 6 - (tick % 8), '#fcfcfc');
  if (f.st.rooted > 0 || f.st.nest > 0) { P(c, '#503000', fx - 6, y - 1, 12, 2); P(c, '#58d854', fx - 5, y - 3, 2, 2); P(c, '#58d854', fx + 3, y - 3, 2, 2); }
  if (f.st.channel > 0 || f.st.avatarLight > 0 || f.st.ascension > 0) for (let i = 0; i < 4; i++) P(c, HOLY[2 + (i % 2)], fx - 8 + ((tick * 3 + i * 5) % 16), y - 4 - ((tick * 2 + i * 7) % 20), 1, 2);
  if (f.st.untargetable > 0 && tick % 2) { c.globalAlpha = 0.5; drawFighterSprite(c, s, fx, y + 2, flip, 'ghost'); c.globalAlpha = 1; }
  if (f.st.deathMark > 0 && tick % 8 < 5) drawText(c, '×', fx - 2, y - s.h - 16, '#9878f8');
  if (f.st.hunted > 0 && tick % 8 < 5) { P(c, '#f83800', fx - 1, y - s.h - 14, 3, 1); P(c, '#f83800', fx, y - s.h - 15, 1, 3); }

  // queued spells as stacked chips above the head (BN style)
  const n = Math.min(5, f.queue.length);
  for (let i = n - 1; i >= 0; i--) {
    const card = CARDS[f.queue[i]];
    const cx = fx - 4 + i * 1, cy = y - s.h - 9 - i * 2;
    const ok = i > 0 || b.canAfford(f, card);
    P(c, '#000000', cx - 1, cy - 1, 10, 9);
    P(c, ok ? ELEMENT_COLOR[card.element] : '#7c7c7c', cx, cy, 8, 7);
    if (i === 0) drawText(c, card.cost === 'all' ? 'A' : String(card.cost), cx + 1, cy, '#000000');
  }
}

function drawProjectile(c: Ctx, b: Battle, p: Projectile): void {
  if (p.homing) {
    const t = b.f[p.homing.target];
    const s = panelFoot(p.homing.sx, p.homing.sy), e = fighterPos(b, t);
    const q = p.homing.p;
    const x = s.x + (e.x - s.x) * q, y = s.y - 10 + (e.y - 10 - (s.y - 10)) * q - Math.sin(q * Math.PI) * 18;
    if (p.kind === 'hawk') {
      const dd = e.x - s.x > 0 ? 1 : -1, flap = Math.floor(q * 12) % 2 ? 2 : 0;
      P(c, '#000000', x - 5, y - 2 - flap, 11, 4); P(c, '#ac7c00', x - 4, y - 1 - flap, 9, 2);
      P(c, '#000000', x - 2, y - 1, 6, 4); P(c, '#503000', x - 1, y, 4, 2); P(c, '#fcfcfc', x + dd * 3, y - 1, 2, 2); P(c, '#f8b800', x + dd * 5, y, 1, 1);
      return;
    }
    P(c, '#000000', x - 2, y - 2, 5, 5);
    P(c, ARC[2], x - 1, y - 1, 3, 3);
    P(c, ARC[3], x, y, 1, 1);
    P(c, ARC[1], x - (e.x - s.x > 0 ? 3 : -3), y, 2, 1);
    return;
  }
  const base = panelFoot(0, p.row);
  const x = X0 + p.x * PW + PW / 2, y = base.y - 9;
  const dir = Math.sign(p.speed);
  if (p.kind === 'fireball') {
    for (let i = 1; i <= 4; i++) P(c, FIRE[Math.min(3, i - 1)], x - dir * i * 3, y - 1 + (i % 2), 3, 2);
    blob(c, '#000000', x, y, 5); blob(c, FIRE[0], x, y, 4); blob(c, FIRE[1], x, y, 3); blob(c, FIRE[2], x + dir, y - 1, 1);
  } else if (p.kind === 'hook') {
    const owner = b.f[p.side];
    const ox = panelFoot(owner.col, owner.row).x;
    for (let xx = ox; dir > 0 ? xx < x : xx > x; xx += dir * 3) P(c, '#7c7c7c', xx, y + ((xx >> 1) % 2), 2, 1);
    P(c, '#000000', x - 3, y - 3, 7, 7); P(c, '#bcbcbc', x - 2, y - 2, 5, 5); P(c, '#fcfcfc', x - 1 + dir, y - 1, 2, 2);
  } else if (p.kind === 'arrow' || p.kind === 'sting') {
    P(c, '#000000', x - dir * 8, y - 1, 12, 3);
    P(c, '#ac7c00', x - dir * 7, y, 10, 1);
    P(c, p.kind === 'sting' ? TOX[2] : '#fcfcfc', x + dir * 2, y - 1, 2, 3);
    P(c, '#fcfcfc', x - dir * 8, y - 1, 2, 1); P(c, '#fcfcfc', x - dir * 8, y + 1, 2, 1);
  } else if (p.kind === 'net') {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2 === 0) P(c, '#bcbcbc', x - 4 + i * 2, y - 5 + j * 3, 1, 1);
    P(c, '#7c7c7c', x - 5, y - 6, 1, 11); P(c, '#7c7c7c', x + 4, y - 6, 1, 11);
  } else if (p.kind === 'wolf') {
    drawWolf(c, Math.round(x), Math.round(y + 9), dir, Math.floor(b.time * 12) % 2 === 0);
  } else if (p.kind === 'hammer') {
    const spin = Math.floor(b.time * 16) % 4;
    blob(c, '#000000', x, y, 5);
    P(c, HOLY[1], x - 3, y - 3, 7, 7); P(c, HOLY[3], x - 2, y - 2, 2, 2);
    P(c, '#503000', x + (spin % 2 ? 0 : spin === 0 ? 4 : -5), y + (spin % 2 ? (spin === 1 ? 4 : -5) : 0), 2, 2);
    glow(c, x, y, 10, '248,216,120', 0.35);
  } else if (p.kind === 'gust') {
    for (let i = 0; i < 3; i++) { P(c, '#fcfcfc', x - dir * i * 4, y - 4 + i * 3, 6, 1); P(c, '#f878f8', x - dir * i * 4 - dir * 2, y - 3 + i * 3, 3, 1); }
  } else {
    blob(c, '#fcfcfc', x, y, 3);
  }
}

function cellPx(col: number, row: number): { x: number; y: number } { return panelFoot(col, row); }

/** Color ramps for the quick row shots (basic attacks and arrows). */
const DART: Record<string, string[]> = { knife: STEEL, knifeHeavy: TOX, arrow: ['#503000', '#ac7c00', '#bcbcbc', '#fcfcfc'], aimed: STEEL, holySpark: HOLY };

function drawFx(c: Ctx, _b: Battle, e: Fx): void {
  const p = e.t / e.dur;
  const { x, y } = cellPx(e.col, e.row);
  const d = e.side === 0 ? 1 : -1;
  switch (e.kind) {
    case 'cleave': {
      // light: a quick crescent swipe across the panel ahead, bright edge leading a fading trail
      const cx = x + d * 4, cy = y - 10, r = 12;
      const sweep = Math.min(1, p * 1.8);
      for (let i = 0; i < 18; i++) {
        const k = i / 17;
        if (k > sweep) break;
        const ang = -1.3 + k * 2.4;
        const age = sweep - k;                       // 0 at the leading edge
        const px = cx + d * Math.cos(ang) * r, py = cy + Math.sin(ang) * r * 0.85;
        const col = age < 0.12 ? '#fcfcfc' : age < 0.35 ? '#bcbcbc' : '#7c7c7c';
        if (age < 0.6 * (1 - p) + 0.15) P(c, col, px - 1, py - 1, age < 0.12 ? 3 : 2, 2);
      }
      if (p > 0.45 && p < 0.8) for (let i = 0; i < 3; i++) P(c, '#fcfcfc', cx + d * (r + 2 + i * 2), cy - 3 + i * 3, 2, 1);
      break;
    }
    case 'cleaveHeavy': {
      // heavy: a big overhead chop that lands on both panels ahead with a gold flash, dust and a crack
      const cx = x + d * (PW * 0.5), cy = y - 12, r = 18;
      const swing = Math.min(1, p * 2.2);
      if (p < 0.6) {
        for (let i = 0; i < 24; i++) {
          const k = i / 23;
          if (k > swing) break;
          const ang = -2.2 + k * 2.9;                  // from over the shoulder down to the floor
          const age = swing - k;
          const px = cx + d * Math.cos(ang) * r * 0.9, py = cy + Math.sin(ang) * r;
          const col = age < 0.1 ? '#fcfcfc' : age < 0.3 ? '#f8b800' : '#fca044';
          if (age < 0.45) P(c, col, px - 1, py - 1, age < 0.1 ? 4 : 3, 3);
        }
      }
      if (p >= 0.4) {
        const q = (p - 0.4) / 0.6;
        for (const col of [e.col, e.col + d]) {
          const pc = cellPx(col, e.row);
          if (q < 0.35) glow(c, pc.x, pc.y - 4, 14, '248,184,0', 0.6 * (1 - q / 0.35));
          for (let i = 0; i < 5; i++) {                // dust puffs drift outward
            const dx = (i - 2) * (4 + q * 8), dy = -2 - q * 6 * (1 - Math.abs(i - 2) / 3);
            P(c, q < 0.5 ? '#fce0a8' : '#bcbcbc', pc.x + dx - 1, pc.y + dy, 3, 2);
          }
          P(c, '#000000', pc.x - 6, pc.y - 1, 12, 1);  // crack in the panel
          P(c, '#000000', pc.x - 2, pc.y, 4, 1);
        }
      }
      break;
    }
    case 'bolt': case 'boltHeavy': case 'knife': case 'knifeHeavy': case 'arrow': case 'aimed': case 'holySpark': {
      const heavy = e.kind === 'boltHeavy';
      const to = Number(e.data?.to ?? e.col);
      const x0 = x + d * 8, x1 = cellPx(to, e.row).x, by = y - 10;
      const ramp = heavy ? ARC : DART[e.kind] ?? ['#0058f8', '#3cbcfc', '#a4e4fc', '#fcfcfc'];
      if (e.kind === 'aimed') {
        // a heavy arrow: a long white streak with a shock ring where it lands
        const q = Math.min(1, p * 2.5), head = x0 + (x1 - x0) * q;
        P(c, '#000000', Math.min(x0, head), by - 2, Math.abs(head - x0), 4);
        P(c, ramp[2], Math.min(x0, head), by - 1, Math.abs(head - x0), 2);
        P(c, ramp[3], Math.min(x0, head), by - 1, Math.abs(head - x0), 1);
        if (q >= 1) { const rr = 3 + p * 10; for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; P(c, ramp[3], x1 + Math.cos(a) * rr, by + Math.sin(a) * rr * 0.7, 2, 1); } }
        break;
      }
      // staff-tip flash
      if (p < 0.4) { glow(c, x0, by, heavy ? 12 : 7, heavy ? '248,120,248' : '60,188,252', 0.7 * (1 - p / 0.4)); blob(c, ramp[3], x0, by, heavy ? 3 : 2); }
      if (!heavy) {
        // a dart: bright head racing down the row with a sparkling tail
        const head = x0 + (x1 - x0) * Math.min(1, p * 2.2);
        const tail = x0 + (x1 - x0) * Math.max(0, p * 2.2 - 0.5);
        const xa = Math.min(head, tail), xb = Math.max(head, tail);
        P(c, ramp[1], xa, by - 1, xb - xa, 3);
        P(c, ramp[3], xa, by, xb - xa, 1);
        for (let i = 0; i < 4; i++) P(c, ramp[2], tail + (head - tail) * (i / 4), by + ((i * 7 + Math.floor(p * 20)) % 5) - 2, 1, 1);
        blob(c, ramp[3], head, by, 2);
        if (p * 2.2 >= 1) for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; P(c, ramp[2], x1 + Math.cos(a) * (3 + p * 6), by + Math.sin(a) * (3 + p * 6), 1, 1); }
      } else {
        // a thick, wobbling arcane beam with a burst where it lands
        const w = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
        const xa = Math.min(x0, x1), xb = Math.max(x0, x1);
        for (let xx = xa; xx < xb; xx += 2) {
          const wob = Math.round(Math.sin(xx * 0.5 + p * 30) * 1.5);
          const hh = Math.max(1, Math.round(4 * w));
          P(c, ramp[1], xx, by - hh + wob, 2, hh * 2 + 1);
          P(c, ramp[2], xx, by - Math.ceil(hh / 2) + wob, 2, Math.ceil(hh / 2) * 2 + 1);
        }
        P(c, ramp[3], xa, by, xb - xa, 1);
        glow(c, x1, by, 14, '248,120,248', 0.5 * w);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + p * 4, rr = 4 + p * 12;
          P(c, i % 2 ? ramp[3] : ramp[2], x1 + Math.cos(a) * rr, by + Math.sin(a) * rr * 0.8, 2, 2);
        }
      }
      break;
    }
    case 'thrust': {
      const len = Number(e.data?.len ?? 3) * PW * Math.min(1, p * 3);
      P(c, '#000000', x + (d > 0 ? 6 : -6 - len), y - 11, len, 4);
      P(c, '#fcfcfc', x + (d > 0 ? 6 : -6 - len), y - 10, len, 2);
      break;
    }
    case 'smash': case 'quake': case 'shockwave': case 'wide': {
      const cols = e.kind === 'smash' ? ['#fcfcfc', '#f8b800'] : ['#bcbcbc', '#7c7c7c'];
      const rows = e.kind === 'shockwave' || e.kind === 'wide' ? [0, 1, 2] : [e.row];
      for (const r of rows) {
        const pc = cellPx(e.col, r);
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2;
          const rr = 4 + p * 14;
          P(c, cols[i % 2], pc.x + Math.cos(ang) * rr, pc.y - 4 + Math.sin(ang) * rr * 0.4 - (1 - p) * 4, 2, 2);
        }
        if (e.kind === 'wide') P(c, '#fcfcfc', pc.x - d * 12 + d * p * 20, pc.y - 14, 2, 14);
      }
      break;
    }
    case 'explode': case 'pillar': {
      const r = e.kind === 'pillar' ? 4 : 3 + p * 9;
      if (e.kind === 'pillar') {
        for (let yy = 0; yy < 50 * (1 - p * 0.5); yy += 2) P(c, FIRE[(yy >> 2) % 3], x - 6 + ((yy * 7) % 5), y - yy, 12 - ((yy * 3) % 4), 2);
      }
      blob(c, FIRE[0], x, y - 6, Math.round(r));
      blob(c, FIRE[1], x, y - 6, Math.round(r * 0.7));
      blob(c, FIRE[2], x, y - 6, Math.round(r * 0.35));
      break;
    }
    case 'meteorFall': {
      const mx = x + 40 * (1 - p) * d * -1, my = y - 120 * (1 - p);
      blob(c, '#000000', mx, my, 7); blob(c, FIRE[0], mx, my, 6); blob(c, FIRE[1], mx, my, 4); blob(c, FIRE[3], mx - 1, my - 1, 1);
      for (let i = 1; i < 6; i++) P(c, FIRE[i % 3], mx + d * i * 3, my - i * 6, 3, 3);
      break;
    }
    case 'shard': {
      const sy = y - 40 * (1 - Math.min(1, p * 2));
      P(c, '#0058f8', x - 2, sy - 10, 5, 10); P(c, '#a4e4fc', x - 1, sy - 10, 3, 9); P(c, '#fcfcfc', x, sy - 2, 1, 2);
      if (p > 0.5) for (let i = 0; i < 6; i++) P(c, ICE[i % 4], x + Math.cos(i) * 10 * p, y - 3 + Math.sin(i) * 4 * p, 2, 1);
      break;
    }
    case 'arcaneHit': {
      const r = 2 + p * 12;
      for (let i = 0; i < 12; i++) { const ang = (i / 12) * Math.PI * 2 + p * 3; P(c, ARC[i % 3 + 1], x + Math.cos(ang) * r, y - 10 + Math.sin(ang) * r, 2, 2); }
      blob(c, ARC[3], x, y - 10, Math.round(4 * (1 - p)));
      break;
    }
    case 'blink': {
      for (let i = 0; i < 10; i++) P(c, ARC[2 + (i % 2)], x - 8 + ((i * 7) % 16), y - 2 - p * 20 - ((i * 5) % 14), 1, 2);
      break;
    }
    case 'nova': case 'novaZone': {
      const r = 4 + p * 22;
      for (let i = 0; i < 16; i++) { const ang = (i / 16) * Math.PI * 2; P(c, ICE[1 + (i % 3)], x + Math.cos(ang) * r, y - 6 + Math.sin(ang) * r * 0.5, 2, 1); }
      break;
    }
    case 'guard': case 'shieldHit': case 'spark': {
      for (let i = 0; i < 6; i++) P(c, '#fcfcfc', x + d * 8 + Math.cos(i) * p * 8, y - 10 + Math.sin(i * 2) * p * 8, 1, 1);
      break;
    }
    case 'shout': case 'transform': {
      const col = e.kind === 'transform' ? '#f8b800' : '#fcfcfc';
      for (let k = 0; k < 2; k++) {
        const r = 6 + (p + k * 0.3) * 18;
        for (let i = 0; i < 14; i++) { const ang = (i / 14) * Math.PI * 2; if (i % 2) P(c, col, x + Math.cos(ang) * r, y - 10 + Math.sin(ang) * r * 0.7, 1, 1); }
      }
      break;
    }
    case 'counter': {
      drawTextCentered(c, '×', x, y - 30 - p * 6, '#f878f8', 2);
      break;
    }
    case 'banner': {
      for (let r = 0; r < 3; r++) {
        const pc = cellPx(e.col, r);
        P(c, '#503000', pc.x, pc.y - 18, 1, 16);
        P(c, e.side === 0 ? '#d82800' : '#0058f8', pc.x + 1, pc.y - 18, 6, 5);
      }
      break;
    }
    case 'holyPillar': {
      const w = Math.round(10 * (1 - p * 0.6));
      for (let yy = 0; yy < 60; yy += 2) P(c, HOLY[1 + ((yy >> 2) + Math.floor(p * 10)) % 3], x - w / 2, y - yy - 4, w, 2);
      P(c, HOLY[3], x - 1, y - 60, 2, 56);
      glow(c, x, y - 6, 16, '248,216,120', 0.6 * (1 - p));
      break;
    }
    case 'holyNova': {
      const r = 4 + p * 30;
      for (let i = 0; i < 20; i++) { const ang = (i / 20) * Math.PI * 2; P(c, HOLY[1 + (i % 3)], x + Math.cos(ang) * r, y - 8 + Math.sin(ang) * r * 0.55, 2, 2); }
      glow(c, x, y - 8, 18, '248,216,120', 0.5 * (1 - p));
      break;
    }
    case 'healBurst': {
      for (let i = 0; i < 6; i++) {
        const px = x - 10 + ((i * 7) % 20), py = y - 4 - p * 22 - ((i * 5) % 8);
        P(c, '#58d854', px - 1, py, 3, 1); P(c, '#58d854', px, py - 1, 1, 3);
      }
      break;
    }
    case 'stab': {
      // a quick shadow slash: two crossing dark streaks over the panel
      const k = Math.min(1, p * 3), cx = x, cy = y - 10;
      for (let i = 0; i < 7; i++) {
        if (i / 6 > k) break;
        P(c, SHADOW[2 + (i % 2)], cx - 9 + i * 3, cy - 8 + i * 3, 2, 2);
        P(c, SHADOW[1], cx + 9 - i * 3, cy - 8 + i * 3, 2, 1);
      }
      break;
    }
    case 'smoke': {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2, r = 3 + p * 10;
        P(c, i % 2 ? '#7c7c7c' : '#3c3c3c', x + Math.cos(a) * r, y - 8 + Math.sin(a) * r * 0.6 - p * 4, 3, 2);
      }
      break;
    }
    case 'toxicPuff': {
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + p, r = 2 + p * 11;
        P(c, TOX[1 + (i % 3)], x + Math.cos(a) * r, y - 6 + Math.sin(a) * r * 0.6 - p * 6, 2, 2);
      }
      break;
    }
    case 'lob': {
      // a vial arcing to its target panel
      const to = Number(e.data?.to ?? e.col), x1 = cellPx(to, e.row).x;
      const vx = x + (x1 - x) * p, vy = y - 12 - Math.sin(p * Math.PI) * 26;
      P(c, '#000000', vx - 2, vy - 3, 5, 6); P(c, String(e.data?.color ?? TOX[2]), vx - 1, vy - 1, 3, 3); P(c, '#fcfcfc', vx - 1, vy - 3, 3, 1);
      break;
    }
    case 'trapPop': {
      const col = e.data?.kind === 'freeze' ? ICE : e.data?.kind === 'mine' ? TOX : FIRE;
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; P(c, col[1 + (i % 3)], x + Math.cos(a) * p * 14, y - 4 + Math.sin(a) * p * 6 - p * 6, 2, 2); }
      P(c, '#bcbcbc', x - 6, y - 1, 12, 1);
      break;
    }
    case 'hawkDive': case 'bite': case 'claw': {
      // three slash marks raking across the target
      const n = e.kind === 'claw' ? 4 : 3, k = Math.min(1, p * 3);
      for (let i = 0; i < n; i++) for (let j = 0; j < 6; j++) if (j / 5 <= k) P(c, j > 3 ? '#fcfcfc' : '#bcbcbc', x - 6 + i * 4 + j, y - 16 + j * 2, 1, 2);
      break;
    }
    case 'flare': {
      if (p < 0.5) glow(c, x, y - 6, 14, '248,184,0', 0.5 * (1 - p * 2));
      P(c, '#fce0a8', x - 1, y - 4 - p * 10, 2, 2);
      break;
    }
    case 'arrowRain': {
      const yy = y - 30 * (1 - Math.min(1, p * 2));
      for (let i = 0; i < 3; i++) { P(c, '#ac7c00', x - 6 + i * 5, yy - 10 - i * 2, 1, 7); P(c, '#fcfcfc', x - 6 + i * 5, yy - 3 - i * 2, 1, 2); }
      break;
    }
    case 'laser': {
      // Kill Shot lock-on: a red line from the bow to the enemy, blinking faster as it fires
      const t = _b.f[1 - e.side], tp = fighterPos(_b, t);
      if (Math.floor(e.t * (8 + p * 20)) % 2 === 0) {
        const steps = 24;
        for (let i = 0; i <= steps; i++) P(c, '#f83800', x + (tp.x - x) * (i / steps), y - 12 + (tp.y - 12 - (y - 12)) * (i / steps), 1, 1);
        P(c, '#f83800', tp.x - 4, tp.y - 12, 9, 1); P(c, '#f83800', tp.x, tp.y - 16, 1, 9);
      }
      break;
    }
    case 'castName': break; // drawn on the UI layer by drawCastCallout
  }
}

// ---------- HUD (sharp UI layer, 480×320) ----------
const UI = 2; // world-to-UI scale

/** Everything drawn over the fight at UI resolution: HP, resources, the Draw gauge, statuses, damage numbers, cast callouts. */
export function drawBattleUi(ui: Ctx, b: Battle, tick: number, me: Side = 0): void {
  for (const t of b.texts) {
    const pc = panelFoot(t.x, t.y);
    const big = /^\d+$/.test(t.text);
    drawTextCentered(ui, t.text, pc.x * UI, (pc.y - 34) * UI - t.t * 28, t.color, big ? 2 : 1);
  }
  for (const f of b.f) drawFighterHud(ui, b, f, tick);
  for (const f of b.f) drawChargeBar(ui, b, f, tick);
  // Draw gauge
  const gx = UW / 2 - 70, gw = 140;
  frame(ui, gx, 8, gw, 12, '#000000', '#fcfcfc');
  const full = b.gauge >= 1;
  P(ui, full ? (tick % 4 < 2 ? '#f8b800' : '#fcfcfc') : '#3cbcfc', gx + 1, 9, Math.round((gw - 2) * b.gauge), 10);
  if (!full) P(ui, '#a4e4fc', gx + 1, 9, Math.round((gw - 2) * b.gauge), 2);
  drawTextCentered(ui, full ? `${k('custom')}: DRAW` : 'DRAW', UW / 2, 24, full ? '#f8b800' : '#bcbcbc');
  for (const e of b.fx) if (e.kind === 'castName') drawCastCallout(ui, e);
  drawNextSpell(ui, b, b.f[me]);
}

function drawFighterHud(ui: Ctx, b: Battle, f: Fighter, tick: number): void {
  const right = f.side === 1, w = 132;
  const x = right ? UW - w - 8 : 8;
  // HP box with a bar
  frame(ui, x, 6, w, 30, '#000000', teamColor(f.cls, f.skin, f.alt));
  drawText(ui, f.name, x + 6, 10, '#fcfcfc');
  drawText(ui, CLASS_INFO[f.cls].name, x + 6, 20, '#7c7c7c');
  const hp = String(Math.max(0, Math.ceil(f.hp)));
  const low = f.hp / f.maxHp < 0.3;
  drawText(ui, hp, x + w - 6 - textWidth(hp, 2), 9, low && tick % 4 < 2 ? '#f83800' : '#fcfcfc', 2);
  const ratio = Math.max(0, f.hp / f.maxHp);
  P(ui, '#3c3c3c', x + 2, 31, w - 4, 3);
  P(ui, low ? '#f83800' : ratio < 0.6 ? '#f8b800' : '#58d854', right ? x + 2 + Math.round((w - 4) * (1 - ratio)) : x + 2, 31, Math.round((w - 4) * ratio), 3);
  drawResource(ui, f, right ? x + w - 92 : x, 42, tick);
  drawStatuses(ui, b, f, right ? x + w : x, 58, right);
}

function drawResource(ui: Ctx, f: Fighter, x: number, y: number, tick: number): void {
  const pip = (i: number, base: string, fill: string | null, hi: string): void => {
    const px = x + 36 + i * 11;
    P(ui, '#000000', px - 1, y - 1, 10, 11);
    P(ui, base, px, y, 8, 9);
    if (fill) { P(ui, fill, px, y, 8, 9); P(ui, hi, px, y, 8, 2); }
  };
  if (f.cls === 'warrior') {
    drawTextOutlined(ui, 'RAGE', x, y + 1, '#f87858');
    for (let i = 0; i < 5; i++) {
      const v = f.res - i;
      if (v >= 1) pip(i, '#503000', f.st.avatar > 0 ? '#f8b800' : '#d82800', '#f87858');
      else { pip(i, '#503000', null, ''); if (v >= 0.5) P(ui, '#881400', x + 36 + i * 11, y + 4, 8, 5); }
    }
  } else if (f.cls !== 'mage') {
    // Energy (Rogue, Ranger) and Cleric Mana: five pips, no max to grow
    const info = CLASS_INFO[f.cls];
    drawTextOutlined(ui, info.res === 'ENERGY' ? 'NRG' : 'MANA', x, y + 1, info.resColor);
    for (let i = 0; i < 5; i++) pip(i, info.pipBase, i < f.res ? info.pip : null, '#fcfcfc');
    // the Ranger's stand-still timer fills the next pip
    if (f.cls === 'ranger' && f.res < 5) P(ui, info.pip, x + 36 + Math.floor(f.res) * 11, y + 8, Math.round(8 * f.stillT / TUNING.ranger.stillSeconds), 1);
  } else {
    drawTextOutlined(ui, 'MANA', x, y + 1, '#a4e4fc');
    const max = Math.max(5, Math.ceil(f.res));
    for (let i = 0; i < max; i++) {
      const cap = i < f.resMax;
      pip(i, cap ? '#0000a8' : '#3c3c3c', i < f.res ? (i >= f.resMax ? '#f878f8' : '#3cbcfc') : null, '#fcfcfc');
    }
    if (f.powerLeft > 0 && tick % 4 < 3) drawTextOutlined(ui, '-1', x + 38 + max * 11, y + 1, '#f878f8');
  }
}

// Active effects as small timed tags under the resource bar.
const STATUS_TAGS: Partial<Record<StatusKey, [string, string]>> = {
  frozen: ['FROZEN', '#a4e4fc'], stunned: ['STUNNED', '#f8b800'], iceBlock: ['ICE BLOCK', '#a4e4fc'],
  roared: ['WEAKENED', '#bcbcbc'], berserk: ['BERSERK', '#f83800'], avatar: ['AVATAR', '#f8b800'],
  ascendance: ['ASCENDANCE', '#f878f8'], lastStand: ['LAST STAND', '#f87858'], reflect: ['REFLECT', '#fcfcfc'],
  counterspell: ['COUNTER', '#f878f8'], mortal: ['MORTAL WOUND', '#f83800'], evoLock: ['EVO LOCK', '#7c7c7c'],
  frostNova: ['NOVA ARMED', '#3cbcfc'], glacial: ['GLACIAL', '#3cbcfc'],
  stealth: ['STEALTH', '#9878f8'], silenced: ['SILENCED', '#9878f8'], rooted: ['ROOTED', '#58d854'], sleep: ['ASLEEP', '#9878f8'],
  untargetable: ['UNTARGETABLE', '#bcbcbc'], evasion: ['EVASION', '#fcfcfc'], spellImmune: ['CLOAK', '#9878f8'], deadlyPoison: ['DEADLY POISON', '#b8f818'],
  deathMark: ['DEATH MARK', '#9878f8'], hunted: ['HUNTED', '#f83800'], revealed: ['REVEALED', '#f8b800'], shadowDance: ['SHADOW DANCE', '#9878f8'],
  nightsEmbrace: ["NIGHT'S EMBRACE", '#9878f8'], pandemic: ['PANDEMIC', '#b8f818'], nest: ['NEST', '#58d854'], deadeye: ['DEADEYE', '#fcfcfc'],
  tripwire: ['TRIPWIRE', '#58d854'], painSup: ['PAIN SUPP', '#f8d878'], guardian: ['GUARDIAN', '#f8d878'], ascension: ['ASCENSION', '#f8d878'],
  avatarLight: ['AVATAR', '#f8d878'], purified: ['PURIFIED', '#f8d878'], mending: ['MENDING', '#58d854'], channel: ['HYMN', '#f8d878'],
};
const SHIELD_TAG: Record<string, string> = { guard: 'GUARD', ironSkin: 'IRON SKIN', barrier: 'BARRIER', unbreakable: 'UNBREAKABLE', holy: 'SHIELD' };

function drawStatuses(ui: Ctx, b: Battle, f: Fighter, edge: number, y: number, right: boolean): void {
  const tags: Array<[string, string]> = [];
  for (const [key, [label, col]] of Object.entries(STATUS_TAGS) as Array<[StatusKey, [string, string]]>) {
    const t = f.st[key];
    if (t <= 0 || (key === 'frostNova' && f.frostNovaUsed)) continue;
    tags.push([`${label} ${t.toFixed(1)}`, col]);
  }
  for (const s of f.shields) if (s.hp > 0 || s.kind === 'guard') tags.push([`${SHIELD_TAG[s.kind] ?? s.kind.toUpperCase()}${s.kind === 'guard' ? '' : ` ${Math.ceil(s.hp)}`}`, '#a4e4fc']);
  if (f.shout > 0) tags.push(['SHOUT', '#f8b800']);
  if (f.rallyLeft > 0) tags.push([`RALLY ×${f.rallyLeft}`, '#f8b800']);
  if (f.powerLeft > 0) tags.push([`POWER ×${f.powerLeft}`, '#f878f8']);
  if (f.poison > 0) tags.push([`POISON ×${f.poison} ${Math.max(0, f.poisonT).toFixed(1)}`, '#b8f818']);
  if (f.st.evasion > 0 && f.dodges > 0) tags.push([`DODGE ×${f.dodges}`, '#fcfcfc']);
  const p = b.panels[f.col][f.row];
  if (p.burn > 0) tags.push(['ON FIRE', '#fca044']);
  let cx = edge, cy = y;
  for (const [s, col] of tags.slice(0, 8)) {
    const tw = textWidth(s) + 8;
    if (right ? cx - tw < edge - 200 : cx + tw > edge + 200) { cx = edge; cy += 13; }
    const tx = right ? cx - tw : cx;
    frame(ui, tx, cy, tw, 11, '#000000', col);
    drawText(ui, s, tx + 4, cy + 2, col);
    cx = right ? tx - 3 : tx + tw + 3;
  }
}

/** The card a fighter just cast, slid in under their HUD so both sides can read it. */
function drawCastCallout(ui: Ctx, e: Fx): void {
  const card = CARDS[String(e.data?.id)];
  if (!card || e.t > 2) return;
  const w = 188, h = 58, right = e.side === 1;
  const slide = Math.min(1, e.t / 0.12), fade = e.t > 1.7 ? (2 - e.t) / 0.3 : 1;
  const x = right ? UW - 8 - w + Math.round((1 - slide) * (w + 8)) : 8 - Math.round((1 - slide) * (w + 8)), y = 86;
  ui.save();
  ui.globalAlpha = Math.max(0, fade);
  frame(ui, x, y, w, h, '#000000', ELEMENT_COLOR[card.element]);
  drawCardIcon(ui, card, x + 6, y + 6, 32);
  const tx = x + 44;
  drawText(ui, card.name.toUpperCase(), tx, y + 6, '#fcfcfc');
  const info = CLASS_INFO[card.cls];
  const meta = `${card.cost === 'all' ? 'ALL' : card.cost} ${info.res}${card.dmg !== '-' ? `  DMG ${card.dmg.toUpperCase()}` : ''}`;
  drawText(ui, meta, tx, y + 17, info.resColor);
  wrap(card.short.toUpperCase(), Math.floor((w - 50) / 6)).slice(0, 3).forEach((l, i) => drawText(ui, l, tx, y + 29 + i * 9, '#bcbcbc'));
  if (e.data?.countered) {
    ui.fillStyle = 'rgba(0,0,0,0.55)'; ui.fillRect(x, y, w, h);
    drawTextCentered(ui, 'COUNTERED', x + w / 2, y + h / 2 - 7, '#f878f8', 2);
  }
  ui.restore();
}

/** What the cast key will do next, bottom left. */
function drawNextSpell(ui: Ctx, b: Battle, f: Fighter): void {
  if (b.phase !== 'fight' || !f.queue.length) return;
  const card = CARDS[f.queue[0]], ok = b.canAfford(f, card);
  const more = f.queue.length - 1;
  const s = `${k('cast')}: ${card.name.toUpperCase()}`;
  const tw = textWidth(s) + (more ? textWidth(`  +${more}`) : 0);
  frame(ui, 8, UH - 22, tw + 28, 16, '#000000', ok ? ELEMENT_COLOR[card.element] : '#7c7c7c');
  P(ui, ok ? ELEMENT_COLOR[card.element] : '#3c3c3c', 12, UH - 18, 8, 8);
  drawText(ui, s, 24, UH - 18, ok ? '#fcfcfc' : '#7c7c7c');
  if (more) drawText(ui, `+${more}`, 24 + textWidth(s) + 12, UH - 18, '#7c7c7c');
  if (!ok) drawText(ui, f.st.silenced > 0 ? 'SILENCED' : `NEED ${CLASS_INFO[card.cls].res}`, tw + 44, UH - 18, '#f83800');
}

/** A charge meter under a fighter's feet while a heavy winds up; flashes READY when full. */
function drawChargeBar(ui: Ctx, b: Battle, f: Fighter, tick: number): void {
  if (f.dead || !f.charging || f.charge <= 0.15) return;
  const p = Math.min(1, f.charge / heavyChargeOf(f));
  const { x, y } = fighterPos(b, f);
  const bx = x * UI - 16, by = (y + 4) * UI;
  frame(ui, bx, by, 32, 6, '#000000', '#000000');
  P(ui, p >= 1 ? (tick % 2 ? '#f8b800' : '#fcfcfc') : '#3cbcfc', bx + 1, by + 1, Math.round(30 * p), 4);
  if (p >= 1) drawTextCentered(ui, 'HEAVY!', x * UI, by + 8, tick % 2 ? '#f8b800' : '#fcfcfc', 1);
}
