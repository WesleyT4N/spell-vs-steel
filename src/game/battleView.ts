// Draws a Battle: arena, panels, fighters, spell effects and the HUD.
import { k } from '../engine/input';
import { Colosseum, drawPanel, panelFoot, panelCenter, X0, Y0, PW, FACE, LIP, type PanelState } from '../art/arena';
import { getSprite, drawFighterSprite, teamColor, type Tint } from '../art/sprites';
import { P, W, blob, frame, mix, type Ctx } from '../engine/gfx';
import { drawText, drawTextOutlined, drawTextCentered, textWidth } from '../engine/font';
import { CARDS, ELEMENT_COLOR, type Element } from './cards';
import { TUNING } from './tuning';
import type { Battle, Fighter, Fx, Projectile, Wall } from './battle';

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
    const hl = mark && Math.floor(b.time * 10) % 2 ? mark.color : undefined;
    drawPanel(c, col, r, state, tick, p.owner, hl);
  }
  // Frost Nova / Glacial zones get a frosty tint on the trigger columns
  for (const f of b.f) {
    if (f.st.frostNova > 0 && !f.frostNovaUsed) {
      for (let col = 0; col < 6; col++) for (let r = 0; r < 3; r++) {
        const inRange = col !== f.col && Math.abs(col - f.col) <= TUNING.frostNovaRange;
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
  for (const t of b.texts) {
    const pc = panelFoot(t.x, t.y);
    drawTextCentered(c, t.text, pc.x, pc.y - 34 - t.t * 14, t.color);
  }
  c.restore();
  drawHud(c, b, tick);
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
  const s = getSprite(f.cls, f.alt);
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
  // charge aura
  if (f.charging && f.charge > 0.15) {
    const full = f.charge >= TUNING.heavyCharge;
    const col = full ? (tick % 2 ? '#fcfcfc' : '#f8b800') : '#3cbcfc';
    const r = 6 + (tick % 3);
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2 + b.time * 6;
      P(c, col, fx + Math.cos(ang) * r, y - 9 + Math.sin(ang) * r * 0.8, 1, 1);
    }
  }
  let tint: Tint = 'none';
  if (f.flash > 0) tint = 'flash';
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
    case 'castName': {
      if (e.t > 1.0) break;
      const name = String(e.data?.name ?? '').toUpperCase();
      const col = ELEMENT_COLOR[(e.data?.el as Element) ?? 'steel'];
      const tw = textWidth(name);
      const bx = e.side === 0 ? 4 : W - tw - 10;
      frame(c, bx, 30, tw + 6, 11, '#000000', col);
      drawText(c, name, bx + 3, 32, '#fcfcfc');
      break;
    }
  }
}

// ---------- HUD ----------
function drawHud(c: Ctx, b: Battle, tick: number): void {
  for (const f of b.f) {
    const right = f.side === 1;
    const x = right ? W - 62 : 4;
    // HP box (BN style)
    frame(c, x, 4, 58, 13, '#000000', teamColor(f.cls, f.alt));
    const hp = String(Math.max(0, Math.ceil(f.hp)));
    const low = f.hp / f.maxHp < 0.3;
    drawText(c, hp, x + 56 - textWidth(hp, 1) - 2, 7, low && tick % 4 < 2 ? '#f83800' : '#fcfcfc');
    drawText(c, f.cls === 'warrior' ? 'WAR' : 'MAG', x + 3, 7, '#bcbcbc');
    // resource
    drawResource(c, f, x, 19, tick);
  }
  // custom gauge
  const gx = 84, gw = 72;
  frame(c, gx, 4, gw, 7, '#000000', '#fcfcfc');
  const full = b.gauge >= 1;
  P(c, full ? (tick % 4 < 2 ? '#f8b800' : '#fcfcfc') : '#3cbcfc', gx + 1, 5, Math.round((gw - 2) * b.gauge), 5);
  drawTextCentered(c, full ? `${k('custom')}: DRAW` : 'DRAW', 120, 13, full ? '#f8b800' : '#bcbcbc');
}

function drawResource(c: Ctx, f: Fighter, x: number, y: number, tick: number): void {
  if (f.cls === 'warrior') {
    drawTextOutlined(c, 'RAGE', x, y, '#f87858');
    for (let i = 0; i < 5; i++) {
      const v = f.res - i;
      const px = x + 28 + i * 6;
      P(c, '#000000', px - 1, y - 1, 6, 9);
      P(c, '#503000', px, y, 4, 7);
      if (v >= 1) { P(c, f.st.avatar > 0 ? '#f8b800' : '#d82800', px, y, 4, 7); P(c, '#f87858', px, y, 4, 1); }
      else if (v >= 0.5) P(c, '#881400', px, y + 3, 4, 4);
    }
  } else {
    drawTextOutlined(c, 'MANA', x, y, '#a4e4fc');
    const max = Math.max(5, Math.ceil(f.res));
    for (let i = 0; i < max; i++) {
      const px = x + 28 + i * 6;
      const filled = i < f.res, cap = i < f.resMax;
      P(c, '#000000', px - 1, y - 1, 6, 9);
      P(c, cap ? '#0000a8' : '#3c3c3c', px, y, 4, 7);
      if (filled) { P(c, i >= f.resMax ? '#f878f8' : '#3cbcfc', px, y, 4, 7); P(c, '#fcfcfc', px, y, 1, 2); }
    }
    if (f.powerLeft > 0 && tick % 4 < 3) drawTextOutlined(c, '-1', x + 30 + max * 6, y, '#f878f8');
  }
  void mix;
}
