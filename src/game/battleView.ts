// Draws a Battle: arena, panels, fighters, spell effects and the HUD.
import { k } from '../engine/input';
import { drawPanel, drawHole, drawStage, panelFoot, panelCenter, X0, Y0, PW, FACE, LIP, type PanelState, type PanelTint } from '../art/arena';
import { getStage } from '../content/stages';
import type { Stage } from '../art/arena';
import { getSprite, getFrame, drawFighterSprite, drawFighterPosed, type Tint } from '../art/sprites';
import { getMobSprite } from '../art/mobSprites';
import type { FrameId } from '../art/fighterFrames';
import { P, UW, UH, blob, frame, glow, mix, type Ctx } from '../engine/gfx';
import { drawText, drawTextOutlined, drawTextCentered, textWidth, wrap } from '../engine/font';
import { drawCardIcon, costSign, costDeltaText, RES_INK } from '../scenes/cardView';
import { drawModValue, drawDelta, pctText } from '../scenes/modValue';
import { win, bar, pip as skinPip, toInk, PAPER, PAPER2, INK, INK2, TRIM, WAX_HI, RED_INK } from '../scenes/skin';
import { COMBO_HOLD } from './combo';
import { CARDS, ELEMENT_COLOR } from './cards';
import { TUNING } from './tuning';
import { heavyChargeOf, BIG_HIT } from './battle';
import type { Battle, BlessKind, Fighter, Fx, Warn, Pet, Projectile, Side, StatusKey, Trap, Wall } from './battle';
import { CLASS_INFO } from './classes';
import { drawOver, drawUnder, lookOf, observe } from './fighterAnim';

import { kickOffset, noteImpacts } from './hitFeel';
import { endPfxFrame, drawShotPfx } from './pfx';
import '../fx';
import { isHome, setHome, team } from './teamColors';
import { smallSprite } from '../art/paletteImage';
import { FIRE, HOLY, ICE, SHADOW, STEEL, TOX, drawBurn, drawFrozen, drawFx, drawParticles, useParticles } from './fxView';

/** Whose hidden things (traps, a stealthed fighter) are visible: one side's, or everything in the dev sandbox. */
export type Viewer = Side | 'all';

let arena: Stage | null = null;
/** The current stage: the one picked for the latest match, which the menus show behind them too. */
export const getArena = (): Stage => (arena ??= getStage('colosseum'));
/** Switch the stage that fights (and menus) are drawn on. */
export function useStage(id: string): void { arena = getStage(id); }

/** `hitStop` shudders the picture while the fight stands still in a hit pause. Off for card previews. */
export function drawBattle(c: Ctx, b: Battle, tick: number, me: Viewer = 0, hitStop = false): void {
  setHome(me === 'all' ? 0 : me);
  const a = getArena();
  useParticles(b);
  c.save();
  const kick = kickOffset(b, hitStop);
  if (b.shake > 0) c.translate(Math.round((Math.random() - 0.5) * 4 * Math.min(1, b.shake * 4)), Math.round((Math.random() - 0.5) * 3 * Math.min(1, b.shake * 4)));
  if (kick.x || kick.y) c.translate(kick.x, kick.y);
  drawStage(c, a, tick, b.cheer);

  // panels (with the rows flying shots are about to cross lit up)
  const shots = shotPaths(b);
  for (let r = 0; r < 3; r++) for (let col = 0; col < 6; col++) {
    const p = b.panels[col][r];
    const holeAge = since(b, 'hole', col, r, p.hole > 0), crackAge = since(b, 'crack', col, r, p.cracked && p.hole <= 0);
    // a broken panel blinks back in over its last 0.8s, like BN
    if (p.hole > 0 && !(p.hole < 0.8 && Math.floor(p.hole * 10) % 2 === 0)) { drawHole(c, col, r, isHome(p.owner), a, holeAge); continue; }
    const state: PanelState = p.hole > 0 ? 'clean' : p.burn > 0 ? 'burning' : p.cracked ? 'cracked' : 'clean';
    const tint: PanelTint | undefined = p.hole > 0 ? undefined : p.burn > 0 ? 'fire' : p.toxic > 0 ? 'poison' : p.curse > 0 ? 'shadow' : p.bless > 0 ? 'holy' : undefined;
    const mark = b.marks.find(m => m.col === col && m.row === r);
    let hl = mark && Math.floor(b.time * 10) % 2 ? mark.color : undefined;
    const warn = warnFlash(b, col, r) ?? shotFlash(b, shots, col, r) ?? hitFlash(b, col, r);
    if (warn) hl = warn;
    // an armed Frost Nova blinks the enemy panels it covers
    if (!hl && Math.floor(b.time * 5) % 2 === 0) {
      for (const f of b.f) {
        if (f.st.frostNova > 0 && !f.frostNovaUsed && p.owner !== f.side && Math.abs(col - f.col) <= TUNING.frostNovaRange) hl = '#a4e4fc';
      }
    }
    drawPanel(c, col, r, state, tick, isHome(p.owner), hl, a, { crackAge, tint, time: b.time });
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
  // warned panels keep a lit rim over flames and toxic clouds, so the danger zone never disappears between flashes
  for (const w of b.warns) if (w.kind === 'flash') drawWarnEdge(c, w.col, w.row, w.side);
  for (const [key, at] of shots) drawWarnEdge(c, key % 6, Math.floor(key / 6), at.side);
  for (const e of b.fx) if (e.kind === 'hitPanel') drawWarnEdge(c, e.col, e.row, e.side);
  for (const w of b.warns) if (w.kind === 'shadow') drawLobShadow(c, w);
  for (const t of b.traps) if (me === 'all' || t.side === me) drawTrap(c, t, tick);

  // entities, back row first
  for (let r = 0; r < 3; r++) {
    for (const w of b.walls) if (w.row === r) drawWall(c, w, b.time);
    for (const f of b.everyone()) if (f.row === r) { if (f.mob) drawMob(c, b, f, tick); else drawFighter(c, b, f, tick, me); }
  }
  for (const p of b.pets) drawPet(c, b, p, tick);
  for (const pr of b.projectiles) drawProjectile(c, b, pr);
  for (const w of b.warns) if (w.kind === 'reticle') drawReticle(c, w, b.time);
  for (const e of b.fx) drawFx(c, b, e);
  drawParticles(c, b);
  c.restore();
  noteImpacts(b);
  endPfxFrame(b);
}

/** When each panel's crack and hole appeared, in battle time: view-only, for the crack-in and crumble animations. */
const panelT = new WeakMap<Battle, Record<'crack' | 'hole', number[]>>();
/** Seconds since a panel's crack or hole appeared (0 the frame it is first drawn). */
function since(b: Battle, kind: 'crack' | 'hole', col: number, row: number, on: boolean): number {
  let m = panelT.get(b);
  if (!m) panelT.set(b, m = { crack: [], hole: [] });
  const i = col * 3 + row, t0 = m[kind][i];
  if (!on) { m[kind][i] = NaN; return 9; }
  // a rewound battle (training reset) starts the clock again
  if (t0 === undefined || Number.isNaN(t0) || t0 > b.time) { m[kind][i] = b.time; return 0; }
  return b.time - t0;
}


/**
 * The standard BN-style warning flash for a panel an area spell is about to hit, or undefined.
 * It blinks steadily, speeds up over the last half and goes solid just before impact, so how close the hit is reads at a glance.
 * It flashes in the caster's team color (yours blue, the opponent's red), and a rim stays lit between flashes.
 */
function warnFlash(b: Battle, col: number, row: number): string | undefined {
  let w: Battle['warns'][number] | undefined;
  for (const x of b.warns) if (x.kind === 'flash' && x.col === col && x.row === row && (!w || x.t < w.t)) w = x;
  if (!w) return undefined;
  const left = w.t, gone = w.dur - w.t;
  const fill = team(w.side).flash;
  if (left < 0.1) return fill;
  const period = left / w.dur > 0.5 ? 0.12 : 0.06;
  return Math.floor(gone / period) % 2 === 0 ? fill : undefined;
}

/**
 * The panels a flying shot covers, keyed col + row * 6, with the seconds until it gets there (9 once it has passed) and the shooter's side.
 * Straight shots light their whole row until they are gone, homing shots the panel of the fighter they chase (view only).
 */
function shotPaths(b: Battle): Map<number, { t: number; side: Side }> {
  const out = new Map<number, { t: number; side: Side }>();
  const mark = (col: number, row: number, t: number, side: Side): void => {
    const k = col + row * 6, cur = out.get(k);
    if (!cur || t < cur.t) out.set(k, { t, side });
  };
  for (const p of b.projectiles) {
    if (p.dead) continue;
    if (p.homing) { const t = b.f[p.homing.target]; mark(t.col, t.row, (1 - p.homing.p) * p.homing.dur, p.side); continue; }
    if (!p.speed) continue;
    // the whole row stays lit until the shot is gone, solid on the panels it is about to cross
    for (let col = 0; col < 6; col++) mark(col, p.row, (col - p.x) / p.speed >= 0 ? (col - p.x) / p.speed : 9, p.side);
  }
  return out;
}

/** A shot-path panel's flash in the shooter's team color: the area warning's quick blink, going solid just before the shot arrives. */
function shotFlash(b: Battle, shots: Map<number, { t: number; side: Side }>, col: number, row: number): string | undefined {
  const at = shots.get(col + row * 6);
  if (!at) return undefined;
  const fill = team(at.side).flash;
  if (at.t < 0.1) return fill;
  return Math.floor(b.time / 0.06) % 2 === 0 ? fill : undefined;
}

/** A panel an instant attack just hit, in the attacker's team color: solid for a moment, then a couple of quick blinks. */
function hitFlash(b: Battle, col: number, row: number): string | undefined {
  const e = b.fx.find(x => x.kind === 'hitPanel' && x.col === col && x.row === row);
  if (!e) return undefined;
  return e.t < 0.08 || Math.floor(e.t / 0.05) % 2 === 0 ? team(e.side).flash : undefined;
}

function drawWarnEdge(c: Ctx, col: number, row: number, side: Side): void {
  const x = X0 + col * PW + 2, y = Y0 + row * (FACE + LIP) + 1, w = PW - 4, h = FACE - 2, rim = team(side).edge;
  P(c, rim, x, y, w, 2); P(c, rim, x, y + h - 2, w, 2);
  P(c, rim, x, y, 2, h); P(c, rim, x + w - 2, y, 2, h);
}

/** BN lock-on crosshair: corner brackets close in on the target panel as the shot nears, around a blinking center cross. */
function drawReticle(c: Ctx, w: Warn, time: number): void {
  const p = 1 - w.t / w.dur;
  const at = panelCenter(w.col, w.row);
  const cx = Math.round(at.x), cy = Math.round(at.y);
  const rx = Math.round(18 - 8 * p), ry = Math.round(12 - 5 * p), arm = 4, RETICLE = team(w.side).edge;
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = cx + sx * rx, y = cy + sy * ry;
    P(c, '#000000', Math.min(x, x - sx * arm) - 1, y - 1, arm + 3, 3);
    P(c, '#000000', x - 1, Math.min(y, y - sy * arm) - 1, 3, arm + 3);
    P(c, RETICLE, Math.min(x, x - sx * arm), y, arm + 1, 1);
    P(c, RETICLE, x, Math.min(y, y - sy * arm), 1, arm + 1);
  }
  if (w.t < 0.15 || Math.floor(time * 12) % 2 === 0) {
    P(c, RETICLE, cx - 3, cy, 7, 1);
    P(c, RETICLE, cx, cy - 3, 1, 7);
  }
}

/** BN bomb shadow: a dark oval on the landing panel that grows as the lob comes down, edged in the thrower's color. */
function drawLobShadow(c: Ctx, w: Warn): void {
  const p = 1 - w.t / w.dur;
  const pc = panelCenter(w.col, w.row);
  const hw = Math.round(4 + (PW / 2 - 8) * p), hh = Math.max(1, Math.round(1 + (FACE / 2 - 4) * p));
  c.save();
  c.globalAlpha = 0.25 + 0.3 * p;
  for (let dy = -hh; dy <= hh; dy++) {
    const half = Math.round(hw * Math.sqrt(1 - (dy / (hh + 0.5)) ** 2));
    P(c, '#000000', Math.round(pc.x) - half, Math.round(pc.y) + dy, half * 2, 1);
  }
  c.globalAlpha = 0.5 + 0.4 * p;
  const rim = team(w.side).edge;
  for (let dy = -hh; dy <= hh; dy++) {
    const half = Math.round(hw * Math.sqrt(1 - (dy / (hh + 0.5)) ** 2));
    if (Math.abs(dy) === hh) P(c, rim, Math.round(pc.x) - half, Math.round(pc.y) + dy, half * 2, 1);
    else { P(c, rim, Math.round(pc.x) - half - 1, Math.round(pc.y) + dy, 1, 1); P(c, rim, Math.round(pc.x) + half, Math.round(pc.y) + dy, 1, 1); }
  }
  c.restore();
}

function drawPanelEffects(c: Ctx, b: Battle, col: number, row: number, tick: number): void {
  const p = b.panels[col][row];
  if (p.hole > 0) return;
  const pc = panelCenter(col, row);
  if (p.burn > 0) drawBurn(c, b, col, row);
  if (p.toxic > 0) {
    // bubbles rising off the sludge (the green face comes from drawPanel)
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
    // the sparkle color says which blessing: gold heals, blue Mana, white shield, orange damage, all four cycle
    const pal = BLESS_PAL[p.blessKind];
    for (let i = 0; i < 5; i++) {
      const t = (b.time * 0.7 + i / 5 + row * 0.2) % 1;
      const ring = p.blessKind === 'all' ? BLESS_PAL[ALL_KINDS[(i + Math.floor(b.time * 2)) % 4]] : pal;
      if ((i + tick) % 3) P(c, t < 0.5 ? ring[1] : ring[0], pc.x - 13 + i * 6, pc.y + 3 - Math.floor(t * 10), 1, 2);
    }
    P(c, pal[0], pc.x - PW / 2 + 3, pc.y + 4, PW - 6, 1);
  }
  if (p.curse > 0) {
    // shadow motes sinking into the cursed face (the purple face comes from drawPanel)
    for (let i = 0; i < 4; i++) {
      const t = (b.time * 0.8 + i / 4 + col * 0.17) % 1;
      P(c, t > 0.6 ? SHADOW[1] : SHADOW[2], pc.x - 11 + i * 7, pc.y - 10 + Math.floor(t * 12), 2, 2);
    }
    P(c, SHADOW[1], pc.x - PW / 2 + 3, pc.y + 4, PW - 6, 1);
  }
}

const BLESS_PAL: Record<BlessKind, [string, string]> = {
  heal: [HOLY[2], HOLY[3]], mana: [ICE[1], ICE[2]], shield: [STEEL[2], STEEL[3]], power: [FIRE[1], FIRE[2]], all: [HOLY[2], HOLY[3]],
};
const ALL_KINDS: BlessKind[] = ['heal', 'mana', 'shield', 'power'];

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
  let x = Math.round(f.x - d * (p.row === null ? 16 : 2) + Math.sin(b.time * 4 + row) * 2), y = Math.round(f.y);
  // a bite: the wolf itself darts down the row to the enemy and trots back (its cooldown restarts on every bite)
  const since = p.period - p.cd, OUT = 0.12, BACK = 0.22;
  if (since >= 0 && since < OUT + BACK) {
    const foe = fighterPos(b, b.foe(owner)), reach = foe.x - d * 12 - x;
    const k = since < OUT ? since / OUT : 1 - (since - OUT) / BACK;
    x = Math.round(x + reach * k);
    y = Math.round(y - Math.sin(Math.min(1, since / OUT) * Math.PI) * 4);
  }
  drawWolf(c, x, y, d, tick % 8 < 4);
}

// the wolf, hawk and bear are small sprites in assets/sprites/ (facing right; wolf and hawk have two frames)

/** Pixel rows with a black outline, centered on x with the last row on y; d < 0 mirrors it. */
function drawPix(c: Ctx, rows: string[], pal: Record<string, string>, x: number, y: number, d: number): void {
  const w = Math.max(...rows.map(r => r.length)), x0 = x - (w >> 1), y0 = y - rows.length + 1;
  const px = (i: number): number => (d > 0 ? x0 + i : x0 + w - 1 - i);
  rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') P(c, '#000000', px(i) - 1, y0 + j - 1, 3, 3); }));
  rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') P(c, pal[ch], px(i), y0 + j, 1, 1); }));
}

function drawWolf(c: Ctx, x: number, y: number, d: number, step: boolean): void {
  const s = smallSprite('wolf');
  drawPix(c, s.frames[step ? 1 : 0] ?? [], s.colors, x, y, d);
}

function drawHawk(c: Ctx, x: number, y: number, d: number, up: boolean): void {
  const s = smallSprite('hawk');
  drawPix(c, s.frames[up ? 0 : 1] ?? [], s.colors, x, y + 4, d);
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
  const { mark: stripe, dark } = team(w.side);
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
  P(c, dark, x + 9, top + 1, 1, h - 4);
  for (const [rx, ry] of [[2, 2], [13, 2], [2, 11], [13, 11]]) { P(c, '#3c3c3c', x + rx, top + ry, 1, 1); P(c, '#fcfcfc', x + rx, top + ry - 1, 1, 1); }
  // dents and cracks appear as it loses HP
  if (pct < 0.7) { P(c, '#3c3c3c', x + 3, top + 6, 2, 1); P(c, '#3c3c3c', x + 4, top + 7, 1, 2); }
  if (pct < 0.4) { P(c, '#000000', x + 11, top + 4, 1, 3); P(c, '#000000', x + 12, top + 7, 1, 3); P(c, '#000000', x + 10, top + 10, 1, 2); }
  return top;
}

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
  const { frames: [BEAR], colors: BEAR_COL } = smallSprite('bear');
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

/** An Expedition monster: its sprite with the hit, freeze and stun tints, a wind-up hop, and a fade when it falls. */
function drawMob(c: Ctx, b: Battle, f: Fighter, tick: number): void {
  const m = f.mob!, s = getMobSprite(m.kind);
  const { x, y } = fighterPos(b, f);
  if (f.dead) {
    // a K.O.'d monster blinks out over half a second
    if (m.deadT > 0.5 || tick % 2) return;
    c.globalAlpha = 1 - m.deadT * 1.6;
    drawFighterSprite(c, s, x, y + 2, true, 'flash');
    c.globalAlpha = 1;
    return;
  }
  const float = m.kind === 'wisp' ? Math.round(Math.sin(b.time * 3 + f.row) * 1.5) - 3 : 0;
  const wind = f.pose === 'cast' ? (tick % 4 < 2 ? -2 : -1) : 0;
  const lunge = f.pose === 'attack' ? -2 : 0;
  P(c, '#000000', x - 6, y, 12, 1); P(c, '#000000', x - 5, y + 1, 10, 1);
  const tint: Tint = f.flash > 0 ? 'flash' : f.st.frozen > 0 || f.st.iceBlock > 0 ? 'ice' : f.st.stunned > 0 && tick % 4 < 2 ? 'stun' : 'none';
  drawFighterSprite(c, s, x + lunge, y + 2 + float + wind, true, tint);
  if (f.st.frozen > 0) drawFrozen(c, b, f, s, x, y, true);
  // shields (Bark Skin) as a pale ring
  if (f.shields.some(sh => sh.hp > 0) && tick % 6 < 4) {
    P(c, '#a4e4fc', x - 9, y - s.h + 4, 1, s.h - 6); P(c, '#a4e4fc', x + 8, y - s.h + 4, 1, s.h - 6);
  }
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
  const held = f.st.frozen > 0 || f.st.iceBlock > 0 || f.st.stunned > 0 || f.st.sleep > 0;
  const as = observe(b, f), look = lookOf(b, f, as, held);
  // heavy: a short wind-back, then a deep lunge into the swing (the frames draw the swing itself)
  const lean = f.pose === 'attack' ? 1 : f.pose === 'heavy' ? (f.poseT > 0.26 ? -1 : 2) : 0;
  const fx = Math.round(x + lean * b.dir(f) + look.ox), fy = Math.round(y + look.oy);
  const fs = getFrame(f.cls, f.skin, f.alt, look.frame);
  const ghost = (gx: number, gy: number, fr: FrameId): void => drawFighterPosed(c, getFrame(f.cls, f.skin, f.alt, fr), gx, gy + 2, flip, 'ghost');
  drawUnder(c, b, f, as, fs, x, y, flip, ghost);
  // shadow (stays on the floor while the fighter hops; gone once they've left the field)
  if (!(f.dead && look.hide)) { P(c, '#000000', fx - 5, y, 10, 1); P(c, '#000000', fx - 4, y + 1, 8, 1); }
  if (f.dead) {
    if (!look.hide) {
      c.globalAlpha = look.alpha;
      drawFighterPosed(c, fs, fx, fy + 2, flip, look.white ? 'flash' : 'none', look.pose);
      c.globalAlpha = 1;
    }
    drawOver(c, b, f, as, fs, look, fx, fy, flip);
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
  drawFighterPosed(c, fs, fx, fy + 2, flip, tint, look.pose);
  drawOver(c, b, f, as, fs, look, fx, fy, flip);

  // transform glows
  if (f.st.avatar > 0 || f.st.ascendance > 0) {
    const col = f.st.avatar > 0 ? '#f8b800' : '#f878f8';
    for (let i = 0; i < 4; i++) P(c, col, fx - 8 + ((tick * 3 + i * 5) % 16), y - 4 - ((tick * 2 + i * 7) % 20), 1, 2);
  }
  drawFrozen(c, b, f, fs, fx, y, flip);
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
  if (f.st.halo > 0) for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + b.time * 3;
    P(c, HOLY[2 + (i % 2)], fx + Math.cos(ang) * 10, y - 22 + Math.sin(ang) * 3, 2, 1);
  }
  if (f.dots.length) for (let i = 0; i < f.dots.length * 2; i++) { const t = (b.time * 1.2 + i / (f.dots.length * 2)) % 1; P(c, t > 0.7 ? SHADOW[1] : SHADOW[2], fx - 6 + i * 4, y - 8 - Math.floor(t * 14), 2, 2); }
  if (f.st.channel > 0) for (let i = 0; i < 4; i++) P(c, HOLY[2 + (i % 2)], fx - 8 + ((tick * 3 + i * 5) % 16), y - 4 - ((tick * 2 + i * 7) % 20), 1, 2);
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
    if (i === 0) drawText(c, card.cost === 'all' && !costSign(card, b.costOf(f, card)) ? 'A' : String(b.costOf(f, card)), cx + 1, cy, '#000000');
    // global cooldown: a shade over the top chip that drains away as it recharges
    if (i === 0 && f.castCd > 0) {
      const sh = Math.ceil(7 * f.castCd / TUNING.castCooldown);
      c.globalAlpha = 0.65; P(c, '#000000', cx, cy, 8, sh); c.globalAlpha = 1;
    }
  }
}

function drawProjectile(c: Ctx, b: Battle, p: Projectile): void {
  if (p.body) return; // a monster's dash: its own sprite is the one running down the row
  if (p.homing) {
    const t = b.f[p.homing.target];
    const s = panelFoot(p.homing.sx, p.homing.sy), e = fighterPos(b, t);
    const q = p.homing.p;
    const x = s.x + (e.x - s.x) * q, y = s.y - 10 + (e.y - 10 - (s.y - 10)) * q - Math.sin(q * Math.PI) * 18;
    drawShotPfx(c, b, p, x, y, e.x - s.x > 0 ? 1 : -1);
    return; // every homing shot (Arcane Missiles, the Hawk, a marked Arrow) is drawn by its pixelfx shot
  }
  const base = panelFoot(0, p.row);
  const x = X0 + p.x * PW + PW / 2, y = base.y - 9;
  const dir = Math.sign(p.speed);
  if (drawShotPfx(c, b, p, x, y, dir)) return;
  if (p.kind === 'hammer') {
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

/** Key labels for a shared screen (two players, or CPU vs CPU): each side's cast key (null: no key) and the Draw key. */
export interface SharedKeys { cast: [string | null, string | null]; draw: string | null }

/**
 * Everything drawn over the fight at UI resolution: HP, resources, the Draw gauge, statuses, damage numbers, cast callouts.
 * `shared` shows both sides' next spells instead of just `me`'s.
 */
export function drawBattleUi(ui: Ctx, b: Battle, tick: number, me: Side = 0, shared?: SharedKeys): void {
  for (const t of b.texts) {
    const pc = panelFoot(t.x, t.y);
    const big = /^\d+$/.test(t.text);
    if (!big) { drawTextCentered(ui, t.text, pc.x * UI, (pc.y - 34) * UI - t.t * 28, t.color, 1); continue; }
    // damage numbers pop in a size up and white-hot, then settle into the element color as they float off
    const n = Number(t.text), pop = t.t < 0.07;
    const scale = (n >= BIG_HIT ? 3 : 2) + (pop ? 1 : 0);
    const k = Math.min(1, t.t / 0.35), rise = 22 * (1 - (1 - k) * (1 - k)) + Math.max(0, t.t - 0.35) * 12;
    drawTextCentered(ui, t.text, pc.x * UI, (pc.y - 34) * UI - rise - (pop ? 4 : 0), pop ? '#fcfcfc' : t.color, scale);
  }
  for (const f of b.f) { if (f.mob) drawPackHud(ui, b, tick); else drawFighterHud(ui, b, f, tick); }
  for (const f of b.f) if (!f.mob) drawChargeBar(ui, b, f, tick);
  for (const f of b.f) drawCombo(ui, b, f);
  // BN-style HP under every monster
  for (const m of b.mobs) {
    if (m.dead) continue;
    const pc = panelFoot(m.col, m.row), hp = String(Math.max(0, Math.ceil(m.hp)));
    drawTextOutlined(ui, hp, Math.round(pc.x * UI - textWidth(hp) / 2), (pc.y + 2) * UI, m === b.f[1] ? '#fcfcfc' : '#bcbcbc');
  }
  // Draw gauge
  const gx = UW / 2 - 70, gw = 140;
  const full = b.gauge >= 1;
  bar(ui, gx, 8, gw, 12, b.gauge, full ? (tick % 4 < 2 ? '#f8b800' : '#fce0a8') : '#3cbcfc');
  const drawKey = shared ? shared.draw : k('custom');
  drawTextCentered(ui, full && drawKey ? `${drawKey}: DRAW` : 'DRAW', UW / 2, 24, full ? '#f8b800' : '#bcbcbc');
  for (const e of b.fx) if (e.kind === 'castName') drawCastCallout(ui, e);
  if (shared) for (const f of b.f) drawNextSpell(ui, b, f, shared.cast[f.side], f.side === 1);
  else drawNextSpell(ui, b, b.f[me], k('cast'), me === 1);
}

/** The monster side's nameplate: every monster in the pack with its own HP bar, the targeted one marked. */
function drawPackHud(ui: Ctx, b: Battle, tick: number): void {
  const w = 132, x = UW - w - 8, rowH = 11, h = 14 + b.mobs.length * rowH;
  win(ui, x, 4, w, h, { accent: team(1).mark, burn: 3 });
  b.mobs.forEach((m, i) => {
    const y = 9 + i * rowH, aimed = m === b.f[1] && !m.dead;
    drawText(ui, (aimed && tick % 8 < 6 ? '>' : ' ') + m.name, x + 5, y, m.dead ? INK2 : INK);
    const ratio = Math.max(0, m.hp / m.maxHp);
    bar(ui, x + w - 46, y + 1, 40, 5, ratio, m.dead ? '#7c7c7c' : ratio < 0.3 ? '#f83800' : ratio < 0.6 ? '#f8b800' : '#58d854', true);
  });
  const f = b.f[1];
  if (!f.dead) drawStatuses(ui, b, f, x + w, 8 + h, true);
}

function drawFighterHud(ui: Ctx, b: Battle, f: Fighter, tick: number): void {
  const right = f.side === 1, w = 132;
  const x = right ? UW - w - 8 : 8;
  // a parchment nameplate with a ribbon in the team color (yours blue, theirs red), and an HP bar
  win(ui, x, 4, w, 34, { accent: team(f.side).mark, burn: 3 });
  drawText(ui, f.name, x + 7, 11, INK);
  drawText(ui, CLASS_INFO[f.cls].name, x + 7, 20, INK2);
  const hp = String(Math.max(0, Math.ceil(f.hp)));
  const low = f.hp / f.maxHp < 0.3;
  drawText(ui, hp, x + w - 7 - textWidth(hp, 2), 10, low && tick % 4 < 2 ? WAX_HI : INK, 2);
  const ratio = Math.max(0, f.hp / f.maxHp);
  bar(ui, x + 5, 29, w - 10, 5, ratio, low ? '#f83800' : ratio < 0.6 ? '#f8b800' : '#58d854', right);
  drawResource(ui, f, right ? x + w - 92 : x, 42, tick);
  drawStatuses(ui, b, f, right ? x + w : x, 58, right);
}

/** The true combo counter on the attacker's side: a parchment tag with the hit count and combo damage. */
function drawCombo(ui: Ctx, b: Battle, f: Fighter): void {
  const c = b.combo.shown(f.side);
  if (!c) return;
  const right = f.side === 1, w = 92, h = 34;
  // a finished combo slides back out toward the edge
  const out = c.live ? 0 : Math.max(0, (c.ago - (COMBO_HOLD - 0.25)) / 0.25);
  const x = Math.round(right ? UW - w - 8 + out * (w + 10) : 8 - out * (w + 10)), y = 96;
  win(ui, x, y, w, h, { accent: team(f.side).mark, burn: 3 });
  const hits = `${c.hits} HITS`;
  drawText(ui, hits, x + Math.round((w - textWidth(hits, 2)) / 2), y + 9, c.live ? RED_INK : INK2, 2);
  const dmg = `${Math.round(c.dmg)} DMG`;
  drawText(ui, dmg, x + Math.round((w - textWidth(dmg)) / 2), y + 24, c.live ? INK : INK2);
}

function drawResource(ui: Ctx, f: Fighter, x: number, y: number, tick: number): void {
  // round wax pips; `base` tints the empty socket
  const pip = (i: number, base: string, fill: string | null, _hi: string): void => skinPip(ui, x + 36 + i * 11, y, fill, mix(base, '#d8a060', 0.6));
  if (f.cls === 'warrior') {
    drawTextOutlined(ui, 'RAGE', x, y + 1, '#f87858');
    for (let i = 0; i < 5; i++) {
      const v = f.res - i;
      if (v >= 1) pip(i, '#503000', f.st.avatar > 0 ? '#f8b800' : '#d82800', '#f87858');
      else { pip(i, '#503000', null, ''); if (v >= 0.5) P(ui, '#a81000', x + 37 + i * 11, y + 4, 7, 4); }
    }
  } else if (f.cls !== 'mage') {
    // Energy (Rogue, Ranger) and Priest Mana: five pips, no max to grow
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
  tripwire: ['TRIPWIRE', '#58d854'], channel: ['HYMN', '#f8d878'], weakened: ['WEAKENED', '#9878f8'], powerInfusion: ['POWER INFUSION', '#f8d878'],
  halo: ['HALO', '#f8d878'], shadowform: ['SHADOWFORM', '#9878f8'],
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
  if (f.empowered > 0) tags.push([`EMPOWER +${Math.round((f.empowered - 1) * 100)}%`, '#f878f8']);
  const p = b.panels[f.col][f.row];
  if (p.burn > 0) tags.push(['ON FIRE', '#fca044']);
  let cx = edge, cy = y;
  for (const [s, col] of tags.slice(0, 8)) {
    const tw = textWidth(s) + 10;
    if (right ? cx - tw < edge - 200 : cx + tw > edge + 200) { cx = edge; cy += 13; }
    const tx = right ? cx - tw : cx;
    // a parchment tag with a colored tab
    P(ui, '#000000', tx - 1, cy - 1, tw + 2, 13);
    P(ui, PAPER, tx, cy, tw, 11); P(ui, PAPER2, tx, cy + 10, tw, 1);
    P(ui, col, tx, cy, 3, 11);
    drawText(ui, s, tx + 6, cy + 2, toInk(col));
    cx = right ? tx - 3 : tx + tw + 3;
  }
}

/** The card a fighter just cast, slid in under their HUD so both sides can read it. */
function drawCastCallout(ui: Ctx, e: Fx): void {
  const card = CARDS[String(e.data?.id)];
  if (!card || e.t > 2) return;
  const w = 188, h = 62, right = e.side === 1;
  const slide = Math.min(1, e.t / 0.12), fade = e.t > 1.7 ? (2 - e.t) / 0.3 : 1;
  const x = right ? UW - 8 - w + Math.round((1 - slide) * (w + 8)) : 8 - Math.round((1 - slide) * (w + 8)), y = 86;
  ui.save();
  ui.globalAlpha = Math.max(0, fade);
  win(ui, x, y, w, h, { accent: ELEMENT_COLOR[card.element], burn: 4 });
  drawCardIcon(ui, card, x + 7, y + 11, 40);
  const tx = x + 52;
  drawText(ui, card.name.toUpperCase(), tx, y + 9, INK);
  const info = CLASS_INFO[card.cls];
  const meta = `${card.cost === 'all' ? 'ALL' : card.cost} ${info.res}${card.dmg !== '-' ? `  DMG ${card.dmg.toUpperCase()}` : ''}`;
  drawText(ui, meta, tx, y + 19, RES_INK[info.res]);
  wrap(card.short.toUpperCase(), Math.floor((w - 58) / 6)).slice(0, 3).forEach((l, i) => drawText(ui, l, tx, y + 30 + i * 9, INK2));
  if (e.data?.countered) {
    ui.fillStyle = 'rgba(40,20,0,0.6)'; ui.fillRect(x, y, w, h);
    drawTextCentered(ui, 'COUNTERED', x + w / 2, y + h / 2 - 7, '#f878f8', 2);
  }
  ui.restore();
}

/** What the cast key will do next, bottom left. */
/** The plate naming `f`'s next spell, bottom left (bottom right for the right side on a shared screen). */
function drawNextSpell(ui: Ctx, b: Battle, f: Fighter, key: string | null = k('cast'), right = false): void {
  if (b.phase !== 'fight' || !f.queue.length) return;
  const card = CARDS[f.queue[0]], ok = b.canAfford(f, card);
  const more = f.queue.length - 1;
  const s = `${key ?? 'NEXT'}: ${card.name.toUpperCase()}`;
  // a cost something has changed (Arcane Power, Power Infusion, a transform) shows in the modifier look
  const cost = b.costOf(f, card), sign = costSign(card, cost), delta = sign ? costDeltaText(card, cost) : '';
  const modW = sign ? 8 + textWidth(String(cost)) + 4 + textWidth(delta) + 4 : 0;
  // Arcane Blast's empower waiting on a damaging spell: its +25% tag
  const emp = card.damaging && f.empowered > 0 ? pctText(f.empowered) : '', empW = emp ? 8 + textWidth(emp) + 4 : 0;
  const tw = textWidth(s) + modW + empW + (more ? textWidth(`  +${more}`) : 0);
  const x = right ? UW - 16 - (tw + 28) : 0;
  win(ui, x + 8, UH - 23, tw + 28, 18, { burn: 3 });
  P(ui, '#000000', x + 11, UH - 19, 10, 10);
  P(ui, ok ? ELEMENT_COLOR[card.element] : '#7c7c7c', x + 12, UH - 18, 8, 8);
  drawText(ui, s, x + 25, UH - 18, ok ? INK : TRIM);
  if (sign) drawModValue(ui, String(cost), delta, sign, x + 25 + textWidth(s) + 8, UH - 18, INK);
  if (emp) drawDelta(ui, emp, 1, x + 25 + textWidth(s) + modW + 8, UH - 18);
  if (more) drawText(ui, `+${more}`, x + 25 + textWidth(s) + modW + empW + 12, UH - 18, INK2);
  if (!ok) {
    const need = f.st.silenced > 0 ? 'SILENCED' : `NEED ${CLASS_INFO[card.cls].res}`;
    drawTextOutlined(ui, need, right ? x - textWidth(need) : tw + 44, UH - 18, '#f83800');
  }
  // global cooldown: a bar along the bottom of the plate fills back up between casts
  if (f.castCd > 0) {
    const p = 1 - f.castCd / TUNING.castCooldown;
    ui.globalAlpha = 0.45; P(ui, '#503000', x + 10, UH - 21, tw + 24, 14); ui.globalAlpha = 1;
    P(ui, '#d8a060', x + 10, UH - 9, tw + 24, 2);
    P(ui, '#a81000', x + 10, UH - 9, Math.round((tw + 24) * p), 2);
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
