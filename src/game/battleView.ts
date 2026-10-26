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

import { ARC, HOLY, TOX, drawBurn, drawFrozen, drawFx, drawParticles, drawShot } from './fxView';

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
  drawParticles(c, b);
  c.restore();
}

function drawPanelEffects(c: Ctx, b: Battle, col: number, row: number, tick: number): void {
  const p = b.panels[col][row];
  if (p.hole > 0) return;
  const pc = panelCenter(col, row);
  if (p.burn > 0) drawBurn(c, b, col, row);
  if (p.toxic > 0) {
    // bubbles rising out of a green haze
    c.globalAlpha = 0.35; P(c, TOX[1], pc.x - PW / 2 + 3, pc.y - 4, PW - 6, 8); c.globalAlpha = 1;
    for (let i = 0; i < 4; i++) {
      const t = (b.time * 0.9 + i / 4 + col * 0.13) % 1;
      P(c, t > 0.7 ? TOX[3] : TOX[2], pc.x - 12 + i * 7, pc.y + 2 - Math.floor(t * 12), 2, 2);
    }
  }
  if (p.smoke > 0) {
    // Smokescreen: drifting grey puffs over the panel
    c.globalAlpha = 0.45; P(c, '#3c3c3c', pc.x - PW / 2 + 2, pc.y - 12, PW - 4, 14); c.globalAlpha = 1;
    for (let i = 0; i < 5; i++) {
      const t = (b.time * 0.4 + i / 5 + row * 0.3) % 1;
      P(c, i % 2 ? '#7c7c7c' : '#bcbcbc', pc.x - 14 + ((i * 7 + Math.floor(t * 8)) % 28), pc.y - 4 - Math.floor(t * 10), 3, 2);
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
  const col = t.kind === 'freeze' ? '#3cbcfc' : t.kind === 'mine' || t.kind === 'wire' ? '#58d854' : '#f87800';
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
    const x = Math.round(o.x + Math.cos(ang) * 12), y = Math.round(o.y - 38 + Math.sin(ang) * 3);
    const flap = tick % 4 < 2 ? 0 : 2;
    drawHawk(c, x, y, d, flap > 0);
    return;
  }
  if (p.kind === 'bear') return; // drawn as its wall
  const row = p.row ?? owner.row;
  const f = panelFoot(p.row === null ? owner.col : p.col, row);
  const x = Math.round(f.x - d * (p.row === null ? 16 : 2) + Math.sin(b.time * 4 + row) * 2), y = Math.round(f.y);
  drawWolf(c, x, y, d, tick % 8 < 4);
}

// a grey wolf facing right: b = fur, h = light fur, w = white muzzle and belly, e = eye, n = nose, k = paws
const WOLF = [
  '..................k..k..',
  '..................kbbk..',
  '.................bbbbbb.',
  '.................bbebbbbn',
  'hh..............bbbbbwww',
  'hhh.hhhhhhhhhhhbbbbbww..',
  '.hbbbbbbbbbbbbbbbbbbw...',
  '..bbbbbbbbbbbbbbbbbb....',
  '..b.bbbbbbbbbbbbbbbb....',
  '.....wwwwbbbbbbwwwbb....',
];
const WOLF_LEGS = [
  ['.....bb.bb.....bb.bb....', '....bb...bb...bb...bb...', '...bb.....bb.bb.....bb..', '...kk.....kk.kk.....kk..'],
  ['.....bbbb......bbbb.....', '.....bbbb......bbbb.....', '.....b..b......b..b.....', '.....kk.kk.....kk.kk....'],
];
const WOLF_COL: Record<string, string> = { b: '#7c7c7c', h: '#bcbcbc', w: '#fcfcfc', e: '#f8b800', n: '#000000', k: '#3c3c3c' };

/** Pixel rows with a black outline, centered on x with the last row on y; d < 0 mirrors it. */
function drawPix(c: Ctx, rows: string[], pal: Record<string, string>, x: number, y: number, d: number): void {
  const w = Math.max(...rows.map(r => r.length)), x0 = x - (w >> 1), y0 = y - rows.length + 1;
  const px = (i: number): number => (d > 0 ? x0 + i : x0 + w - 1 - i);
  rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') P(c, '#000000', px(i) - 1, y0 + j - 1, 3, 3); }));
  rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') P(c, pal[ch], px(i), y0 + j, 1, 1); }));
}

function drawWolf(c: Ctx, x: number, y: number, d: number, step: boolean): void {
  drawPix(c, [...WOLF, ...WOLF_LEGS[step ? 1 : 0]], WOLF_COL, x, y, d);
}

// a hawk facing right: b = feathers, h = light wing edge, w = white head, e = beak, k = tail and talons
const HAWK_UP = [
  'b................b..',
  'bb..............bb..',
  '.bbh...........hbb..',
  '..bbhh.......hhbb...',
  '...bbbbh...hbbbb.ww.',
  '....bbbbbbbbbbbbwwwe',
  '.....bbbbbbbbbbbbw.e',
  '..kkbbbbbbbbbb......',
  '...k...k.k..........',
];
const HAWK_DOWN = [
  '....................',
  '................ww..',
  '...............wwwe.',
  '..kkbbbbbbbbbbbbbw.e',
  '...kbbbbbbbbbbbbb...',
  '....hbbbbbbbbbbbh...',
  '...hbbb.k.k...bbbh..',
  '..hbb..........bbh..',
  '.hb..............bh.',
];
const HAWK_COL: Record<string, string> = { b: '#ac7c00', h: '#f8d878', w: '#fcfcfc', e: '#f8b800', k: '#503000' };
function drawHawk(c: Ctx, x: number, y: number, d: number, up: boolean): void {
  drawPix(c, up ? HAWK_UP : HAWK_DOWN, HAWK_COL, x, y + 4, d);
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
// Spirit Bear facing right: b = fur, h = glow highlight, k = dark, e = eye, n = nose
const BEAR = [
  '................bb..bb....',
  '...........hhhh.bbbbbb....',
  '........hhhbbbbhbbbbbbb...',
  '......hhbbbbbbbbbbbebbbb..',
  '....hhbbbbbbbbbbbbbbbbbbbn',
  '...hbbbbbbbbbbbbbbbbbbbbbk',
  '..hbbbbbbbbbbbbbbbbbbkkkk.',
  '..bbbbbbbbbbbbbbbbbbb.....',
  '..bbbbbbbbbbbbbbbbbbb.....',
  '..bbbbbbbbbbbbbbbbbbb.....',
  '..bbbbkbbbbbbbbbbkbbb.....',
  '..bbbb.bbbb..bbbb.bbbb....',
  '..bbbb.bbbb..bbbb.bbbb....',
  '..kkkk.kkkk..kkkk.kkkk....',
];
const BEAR_COL: Record<string, string> = { b: '#6888fc', h: '#a4e4fc', k: '#0000a8', e: '#fcfcfc', n: '#000000' };

function drawBear(c: Ctx, w: Wall, cx: number, base: number, time: number): number {
  const d = w.side === 0 ? 1 : -1;
  const bob = Math.floor(time * 2) % 2;
  const top = base - BEAR.length - 1 + bob;
  const px = (i: number): number => (d > 0 ? cx - 13 + i : cx + 12 - i);
  // the legs stay planted; the body breathes
  const py = (j: number): number => (j >= 11 ? base - BEAR.length - 1 + j : top + j);
  BEAR.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') P(c, '#000000', px(i) - 1, py(j) - 1, 3, 3); }));
  BEAR.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') P(c, BEAR_COL[ch], px(i), py(j), 1, 1); }));
  glow(c, cx, top + 7, 18, '104,136,252', 0.2 + 0.1 * Math.sin(time * 4));
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
  // Shadow Clone: the decoy looks like the Rogue
  if (f.st.decoy > 0 && !f.dead) {
    const dp = fighterPos(b, { ...f, col: f.decoyCol, row: f.decoyRow, dx: 0, dy: 0 });
    c.globalAlpha = me === 'all' || me === f.side ? 0.6 : 1; drawFighterSprite(c, s, dp.x, dp.y + 2, f.side === 1, 'none'); c.globalAlpha = 1;
  }
  // Stealth: a transparent shimmer with an outline (the owner sees it a little clearer)
  if (f.st.stealth > 0 && !f.dead) {
    const { x, y } = fighterPos(b, f);
    const mine = me === 'all' || me === f.side;
    c.globalAlpha = mine ? 0.45 : 0.16 + (tick % 6 < 3 ? 0.08 : 0);
    drawFighterSprite(c, s, x, y + 2, f.side === 1, 'ghost');
    c.globalAlpha = 1;
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
  else if ((f.st.stunned > 0 || f.st.sleep > 0) && tick % 2) tint = 'stun';
  const bob = f.pose === 'idle' && Math.floor(b.time * 2.5) % 2 ? 1 : 0;
  const castLift = f.pose === 'cast' ? 1 : 0;
  drawFighterSprite(c, s, fx, y + 2 - bob - castLift, flip, tint);

  // transform glows
  if (f.st.avatar > 0 || f.st.ascendance > 0) {
    const col = f.st.avatar > 0 ? '#f8b800' : '#f878f8';
    for (let i = 0; i < 4; i++) P(c, col, fx - 8 + ((tick * 3 + i * 5) % 16), y - 4 - ((tick * 2 + i * 7) % 20), 1, 2);
  }
  drawFrozen(c, b, f, s, fx, y, flip);
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
  if (f.st.rooted > 0 || f.st.deadeye > 0) { P(c, '#503000', fx - 6, y - 1, 12, 2); P(c, '#58d854', fx - 5, y - 3, 2, 2); P(c, '#58d854', fx + 3, y - 3, 2, 2); }
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
    // global cooldown: a shade over the top chip that drains away as it recharges
    if (i === 0 && f.castCd > 0) {
      const sh = Math.ceil(7 * f.castCd / TUNING.castCooldown);
      c.globalAlpha = 0.65; P(c, '#000000', cx, cy, 8, sh); c.globalAlpha = 1;
    }
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
      const hx = Math.round(x), hy = Math.round(y);
      drawHawk(c, hx, hy, dd, flap > 0);
      return;
    }
    if (p.kind === 'arrow') {
      // a homing Arrow (Hunter's Mark)
      const dd = e.x - s.x > 0 ? 1 : -1;
      P(c, '#000000', x - dd * 6, y - 1, 9, 3); P(c, '#ac7c00', x - dd * 5, y, 7, 1); P(c, '#fcfcfc', x + dd * 2, y - 1, 2, 3);
      return;
    }
    const back = e.x - s.x > 0 ? -1 : 1;
    glow(c, x, y, 7, '248,120,248', 0.5);
    P(c, '#000000', x - 2, y - 2, 5, 5);
    P(c, ARC[2], x - 1, y - 1, 3, 3);
    P(c, ARC[3], x, y, 1, 1);
    for (let i = 1; i <= 3; i++) P(c, ARC[3 - Math.min(2, i)], x + back * (i * 2 + 1), y + ((i + Math.floor(b.time * 20)) % 3) - 1, 1, 1);
    return;
  }
  const base = panelFoot(0, p.row);
  const x = X0 + p.x * PW + PW / 2, y = base.y - 9;
  const dir = Math.sign(p.speed);
  if (drawShot(c, b, p, x, y, dir)) return;
  if (p.kind === 'hook') {
    const owner = b.f[p.side];
    const ox = panelFoot(owner.col, owner.row).x;
    for (let xx = ox; dir > 0 ? xx < x : xx > x; xx += dir * 3) P(c, '#7c7c7c', xx, y + ((xx >> 1) % 2), 2, 1);
    P(c, '#000000', x - 3, y - 3, 7, 7); P(c, '#bcbcbc', x - 2, y - 2, 5, 5); P(c, '#fcfcfc', x - 1 + dir, y - 1, 2, 2);
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
  } else {
    blob(c, '#fcfcfc', x, y, 3);
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
  nightsEmbrace: ["NIGHT'S EMBRACE", '#9878f8'], pandemic: ['PANDEMIC', '#b8f818'], focus: ['FOCUS', '#58d854'], lightFoot: ['LIGHT FOOTED', '#58d854'], rapidFire: ['RAPID FIRE', '#fcfcfc'], deadeye: ['DEADEYE', '#fcfcfc'],
  tripwire: ['TRIPWIRE', '#58d854'], painSup: ['PAIN SUPP', '#f8d878'], guardian: ['GUARDIAN', '#f8d878'], ascension: ['ASCENSION', '#f8d878'],
  avatarLight: ['AVATAR', '#f8d878'], purified: ['PURIFIED', '#f8d878'], mending: ['MENDING', '#58d854'], channel: ['HYMN', '#f8d878'],
  vanishStun: ['STUN READY', '#f8b800'], backstab: ['BACKSTAB', '#9878f8'], riposte: ['RIPOSTE', '#fcfcfc'], adrenaline: ['ADRENALINE', '#f8d878'], decoy: ['DECOY', '#bcbcbc'],
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
  if (f.coldBlood) tags.push(['COLD BLOOD', '#9878f8']);
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
  // global cooldown: a bar along the bottom of the box fills back up between casts
  if (f.castCd > 0) {
    const p = 1 - f.castCd / TUNING.castCooldown;
    ui.globalAlpha = 0.55; P(ui, '#000000', 9, UH - 21, tw + 26, 14); ui.globalAlpha = 1;
    P(ui, '#3c3c3c', 10, UH - 10, tw + 24, 2);
    P(ui, '#fcfcfc', 10, UH - 10, Math.round((tw + 24) * p), 2);
  }
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
