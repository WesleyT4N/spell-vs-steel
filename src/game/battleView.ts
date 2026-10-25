// Draws a Battle: arena, panels, fighters, spell effects and the HUD.
import { k } from '../engine/input';
import { Colosseum, drawPanel, panelFoot, panelCenter, X0, Y0, PW, FACE, LIP, type PanelState } from '../art/arena';
import { getSprite, drawFighterSprite, teamColor, type Tint } from '../art/sprites';
import { P, UW, UH, blob, frame, glow, type Ctx } from '../engine/gfx';
import { drawText, drawTextOutlined, drawTextCentered, textWidth, wrap } from '../engine/font';
import { drawCardIcon } from '../scenes/cardView';
import { CARDS, ELEMENT_COLOR } from './cards';
import { TUNING } from './tuning';
import type { Battle, Fighter, Fx, Projectile, StatusKey, Wall } from './battle';

const FIRE = ['#f83800', '#fca044', '#f8b800', '#fce0a8'];
const ICE = ['#0058f8', '#3cbcfc', '#a4e4fc', '#fcfcfc'];
const ARC = ['#940084', '#d800cc', '#f878f8', '#fcfcfc'];

let arena: Colosseum | null = null;
export const getArena = (): Colosseum => (arena ??= new Colosseum());

export function drawBattle(c: Ctx, b: Battle, tick: number): void {
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

  // entities, back row first
  for (let r = 0; r < 3; r++) {
    for (const w of b.walls) if (w.row === r) drawWall(c, w, b.time);
    for (const f of b.f) if (f.row === r) drawFighter(c, b, f, tick);
  }
  for (const pr of b.projectiles) drawProjectile(c, b, pr);
  for (const e of b.fx) drawFx(c, b, e);
  c.restore();
}

function drawHole(c: Ctx, col: number, row: number, owner: 0 | 1): void {
  const x = X0 + col * PW, y = Y0 + row * (FACE + LIP);
  P(c, '#000000', x, y - 1, PW, FACE + LIP + 1);
  P(c, owner === 0 ? '#881400' : '#0058f8', x + 1, y, PW - 2, 1);
  P(c, '#1a1218', x + 3, y + 2, PW - 6, FACE - 2);
}

function drawWall(c: Ctx, w: Wall, time: number): void {
  const f = panelFoot(w.col, w.row);
  const x = Math.round(f.x - 9), base = Math.round(f.y + 1);
  const h = w.kind === 'glacial' ? 22 : 15;
  const ramp = w.kind === 'stone' ? ['#000000', '#7c7c7c', '#bcbcbc', '#fcfcfc'] : ICE;
  P(c, '#000000', x - 1, base - h - 1, 20, h + 2);
  P(c, ramp[1], x, base - h, 18, h);
  P(c, ramp[2], x + 1, base - h + 1, 12, h - 3);
  P(c, ramp[3], x + 1, base - h + 1, 4, 2);
  if (w.kind === 'stone') { P(c, '#7c7c7c', x, base - h + 6, 18, 1); P(c, '#7c7c7c', x + 8, base - h, 1, 6); P(c, '#7c7c7c', x + 4, base - h + 6, 1, h - 6); }
  else if (Math.floor(time * 3 + w.col) % 4 === 0) P(c, '#fcfcfc', x + 12, base - h + 4, 1, 3);
  if (!w.invuln) {
    const pct = Math.max(0, w.hp / w.maxHp);
    P(c, '#000000', x, base - h - 4, 18, 3);
    P(c, pct > 0.5 ? '#58d854' : pct > 0.25 ? '#f8b800' : '#f83800', x + 1, base - h - 3, Math.ceil(16 * pct), 1);
  }
}

function fighterPos(_b: Battle, f: Fighter): { x: number; y: number } {
  const p = panelFoot(f.col, f.row);
  return { x: p.x + f.dx, y: p.y + f.dy };
}

function drawFighter(c: Ctx, b: Battle, f: Fighter, tick: number): void {
  const s = getSprite(f.cls, f.skin, f.alt);
  const { x, y } = fighterPos(b, f);
  const flip = f.side === 1;
  const lean = f.pose === 'attack' ? 2 : f.pose === 'hurt' ? -2 : 0;
  const fx = x + lean * b.dir(f);
  // shadow
  P(c, '#000000', x - 5, y, 10, 1); P(c, '#000000', x - 4, y + 1, 8, 1);
  if (f.dead) {
    if (b.phase === 'ko' && Math.floor(b.koT * 8) % 2 === 0) drawFighterSprite(c, s, fx, y + 2, flip, 'ghost');
    return;
  }
  // charge aura: sparks spiral in toward the fighter, then a bright ring pulses once the heavy is ready
  const charge = f.charging && f.charge > 0.15 ? Math.min(1, f.charge / TUNING.heavyCharge) : 0;
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
  else if (f.st.stunned > 0 && tick % 2) tint = 'stun';
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
      const col = sh.kind === 'barrier' ? '#f878f8' : sh.kind === 'unbreakable' ? '#f8b800' : '#bcbcbc';
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
  } else if (p.kind === 'gust') {
    for (let i = 0; i < 3; i++) { P(c, '#fcfcfc', x - dir * i * 4, y - 4 + i * 3, 6, 1); P(c, '#f878f8', x - dir * i * 4 - dir * 2, y - 3 + i * 3, 3, 1); }
  } else {
    blob(c, '#fcfcfc', x, y, 3);
  }
}

function cellPx(col: number, row: number): { x: number; y: number } { return panelFoot(col, row); }

function drawFx(c: Ctx, _b: Battle, e: Fx): void {
  const p = e.t / e.dur;
  const { x, y } = cellPx(e.col, e.row);
  const d = e.side === 0 ? 1 : -1;
  switch (e.kind) {
    case 'cleave': case 'cleaveHeavy': {
      const heavy = e.kind === 'cleaveHeavy';
      const len = heavy ? 2 : 1.6;
      const r = 10 + p * 6;
      for (let i = 0; i < 14; i++) {
        const ang = -1.2 + (i / 13) * 2.4 * Math.min(1, p * 2);
        const px = x + d * (PW * (len - 1) * 0.5 + Math.cos(ang) * r), py = y - 9 + Math.sin(ang) * r * 0.8;
        P(c, i > 10 ? '#fcfcfc' : heavy ? '#f8b800' : '#bcbcbc', px, py, heavy ? 2 : 1, 2);
      }
      break;
    }
    case 'bolt': case 'boltHeavy': {
      const to = Number(e.data?.to ?? e.col);
      const x1 = cellPx(to, e.row).x;
      const h = e.kind === 'boltHeavy' ? 3 : 1;
      const col = e.kind === 'boltHeavy' ? ARC : ['#0058f8', '#3cbcfc', '#a4e4fc', '#fcfcfc'];
      const xa = Math.min(x + d * 8, x1), xb = Math.max(x + d * 8, x1);
      P(c, col[1], xa, y - 10 - h, xb - xa, h * 2 + 1);
      P(c, col[3], xa, y - 10, xb - xa, 1);
      blob(c, col[2], x1, y - 10, 2 + h);
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
    case 'castName': break; // drawn on the UI layer by drawCastCallout
  }
}

// ---------- HUD (sharp UI layer, 480×320) ----------
const UI = 2; // world-to-UI scale

/** Everything drawn over the fight at UI resolution: HP, resources, the Draw gauge, statuses, damage numbers, cast callouts. */
export function drawBattleUi(ui: Ctx, b: Battle, tick: number): void {
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
  drawNextSpell(ui, b, b.f[0]);
}

function drawFighterHud(ui: Ctx, b: Battle, f: Fighter, tick: number): void {
  const right = f.side === 1, w = 132;
  const x = right ? UW - w - 8 : 8;
  // HP box with a bar
  frame(ui, x, 6, w, 30, '#000000', teamColor(f.cls, f.skin, f.alt));
  drawText(ui, f.name, x + 6, 10, '#fcfcfc');
  drawText(ui, f.cls === 'warrior' ? 'WARRIOR' : 'MAGE', x + 6, 20, '#7c7c7c');
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
};
const SHIELD_TAG: Record<string, string> = { guard: 'GUARD', ironSkin: 'IRON SKIN', barrier: 'BARRIER', unbreakable: 'UNBREAKABLE' };

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
  const res = card.cls === 'warrior' ? 'RAGE' : 'MANA';
  const meta = `${card.cost === 'all' ? 'ALL' : card.cost} ${res}${card.dmg !== '-' ? `  DMG ${card.dmg.toUpperCase()}` : ''}`;
  drawText(ui, meta, tx, y + 17, card.cls === 'warrior' ? '#f87858' : '#a4e4fc');
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
  if (!ok) drawText(ui, `NEED ${card.cls === 'warrior' ? 'RAGE' : 'MANA'}`, tw + 44, UH - 18, '#f83800');
}

/** A charge meter under a fighter's feet while a heavy winds up; flashes READY when full. */
function drawChargeBar(ui: Ctx, b: Battle, f: Fighter, tick: number): void {
  if (f.dead || !f.charging || f.charge <= 0.15) return;
  const p = Math.min(1, f.charge / TUNING.heavyCharge);
  const { x, y } = fighterPos(b, f);
  const bx = x * UI - 16, by = (y + 4) * UI;
  frame(ui, bx, by, 32, 6, '#000000', '#000000');
  P(ui, p >= 1 ? (tick % 2 ? '#f8b800' : '#fcfcfc') : '#3cbcfc', bx + 1, by + 1, Math.round(30 * p), 4);
  if (p >= 1) drawTextCentered(ui, 'HEAVY!', x * UI, by + 8, tick % 2 ? '#f8b800' : '#fcfcfc', 1);
}
