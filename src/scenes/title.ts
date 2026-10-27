import { pushScene, drawMenu, hint, listMouse, type Scene } from './scene';
import { getArena } from '../game/battleView';
import { drawStage } from '../art/arena';
import { drawLogo } from '../art/logo';
import { getFrame, drawFighterSprite, defaultSkin, type ClassId } from '../art/sprites';
import type { FrameId } from '../art/fighterFrames';
import { FIRE as FIRE_RAMP, STEEL, SHADOW, HOLY } from '../game/fxView';
import { P, W, UW, UH, view, screenRect, clamp, dith, type Ctx } from '../engine/gfx';
import { PLAYABLE } from '../game/classes';
import { drawText, drawTextCentered, drawTextOutlined, textWidth } from '../engine/font';
import { wasPressed, navPressed, anyPressed, k, mouse, page } from '../engine/input';
import type { PadMode } from '../engine/touch';
import { playMusic, sfx, isMuted } from '../engine/audio';
import { CharSelectScene } from './select';
import { DeckBuilderScene } from './deckbuilder';
import { OptionsScene } from './options';
import { OnlineScene } from './online';
import { ReplaysScene } from './replays';
import { tutorialDone } from './tutorial';
import { loadMatch } from '../game/match';
import { DEV_TOOLS } from '../flags';
import { RED_INK } from './skin';

const ITEMS = ['ARCADE MODE', 'VERSUS MODE', 'ONLINE MODE', 'TRAINING MODE', 'TUTORIAL', 'SPELL DECK BUILDER', 'REPLAYS', 'OPTIONS', ...(DEV_TOOLS ? ['DEV TOOLS'] : [])];

// eight rows (nine in dev builds) still clear the version line
const MENU_Y = ITEMS.length > 8 ? 156 : ITEMS.length > 7 ? 162 : ITEMS.length > 6 ? 168 : 172, MENU_GAP = ITEMS.length > 8 ? 14 : ITEMS.length > 7 ? 15 : ITEMS.length > 6 ? 16 : 18;
// taller screens (phone portrait) have room under the stage: rows grow into it, with double-size text once they fit
const MAX_GAP = 36, BIG_GAP = 24;

/** Row gap, text scale, menu width and version-line y for the current screen height. */
function menuLayout(): { gap: number; scale: number; width: number; versionY: number } {
  // the screen's bottom edge on the UI layer, less the footer and the version line
  const bottom = UH + view.oy * 2 - 14;
  const versionY = bottom - 18;
  const gap = Math.max(MENU_GAP, Math.min(MAX_GAP, Math.floor((versionY - 6 - MENU_Y) / ITEMS.length)));
  const scale = gap >= BIG_GAP ? 2 : 1;
  return { gap, scale, width: scale > 1 ? 240 : 200, versionY: Math.max(288, versionY) };
}

// The title is a running duel: every few seconds the newest fighter fires its class's shot across the menu, the
// other one takes the hit and poofs away, and the next challenger appears in the smoke. So every matchup comes around.
const SWAP = 3.5, POOF = 0.5;
// cycle beats (seconds after a swap): wind up, let fly, the hit lands
const WIND = 1.1, FIRE = 1.35, HIT = 2.05;
// Mage under SPELL, Warrior under STEEL to start, then the rest of the roster
const ROSTER: ClassId[] = ['mage', 'warrior', ...PLAYABLE.filter(c => c !== 'mage' && c !== 'warrior')];
const X = [34, 206], FOOT = 130;

/** Each class's shot: its element colors (dark to light) and a shape. */
const SHOT: Record<ClassId, { ramp: string[]; kind: 'orb' | 'arrow' | 'blade' | 'wave' }> = {
  warrior: { ramp: STEEL, kind: 'wave' },
  mage: { ramp: FIRE_RAMP, kind: 'orb' },
  rogue: { ramp: SHADOW, kind: 'blade' },
  ranger: { ramp: ['#005800', '#58d854', '#b8f818', '#fcfcfc'], kind: 'arrow' },
  priest: { ramp: HOLY, kind: 'orb' },
};

// the opening plays once per page load: fade in, the logo drops and lands with a shake, the fighters hop in, the menu rises
let introPlayed = false;
const LOGO_DROP = [0.35, 0.8], HOP_IN = [0.85, 1.25], MENU_IN = [1.25, 1.6], INTRO = 1.6;

/** The next class for one side, skipping the one the other side shows. */
function nextClass(cur: ClassId, other: ClassId): ClassId {
  let i = ROSTER.indexOf(cur);
  do i = (i + 1) % ROSTER.length; while (ROSTER[i] === other);
  return ROSTER[i];
}

/** A ring of smoke puffs that spreads and shrinks as k goes 0 to 1. */
function poof(c: Ctx, x: number, y: number, k: number): void {
  const r = 4 + k * 14, s = Math.max(1, Math.round(4 * (1 - k)));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    P(c, i % 2 ? '#fcfcfc' : '#bcbcbc', x + Math.cos(a) * r - s / 2, y + Math.sin(a) * r * 0.7 - s / 2, s, s);
  }
}

/** 0 to 1 as t goes from a to b. */
const span = (t: number, [a, b]: number[]): number => clamp((t - a) / (b - a));

/** A shot in flight at (x, y), heading `dir` (1 right, -1 left). */
function drawShot(c: Ctx, cls: ClassId, x: number, y: number, dir: number, t: number): void {
  const { ramp, kind } = SHOT[cls], [d, m, l, w] = ramp;
  x = Math.round(x); y = Math.round(y);
  if (kind === 'orb') {
    // trail of dithered sparks, then a round core
    for (let i = 1; i < 6; i++) if ((i + Math.floor(t * 20)) % 2) P(c, i < 3 ? m : d, x - dir * (i * 3 + 2), y + ((i * 7) % 3) - 1, 2, 2);
    P(c, d, x - 3, y - 2, 6, 4); P(c, d, x - 2, y - 3, 4, 6);
    P(c, l, x - 2, y - 2, 4, 4);
    P(c, w, x - 1, y - 1, 2, 2);
  } else if (kind === 'arrow') {
    P(c, '#804d42', x - dir * 9, y, 9, 1);
    P(c, w, x - (dir > 0 ? 0 : 0), y, 1, 1);
    P(c, l, x - dir * 1, y - 1, 1, 3);
    P(c, m, x - dir * 10, y - 1, 2, 1); P(c, m, x - dir * 10, y + 1, 2, 1);
    if (Math.floor(t * 20) % 2) P(c, l, x - dir * 14, y, 2, 1);
  } else if (kind === 'blade') {
    // a spinning dagger: flips between flat and upright
    if (Math.floor(t * 16) % 2) { P(c, l, x - 3, y, 6, 1); P(c, d, x + (dir > 0 ? -4 : 3), y - 1, 1, 3); }
    else { P(c, l, x, y - 3, 1, 6); P(c, d, x - 1, y + 2, 3, 1); }
    P(c, m, x - dir * 6, y, 1, 1); P(c, d, x - dir * 9, y, 1, 1);
  } else {
    // a crescent of steel skimming the ground
    for (let i = -5; i <= 5; i++) {
      const bend = Math.round((i * i) / 8) * dir;
      P(c, Math.abs(i) > 3 ? m : l, x - bend, y + i, 2, 1);
    }
    P(c, w, x + dir, y - 1, 1, 3);
    for (let i = 1; i < 4; i++) P(c, d, x - dir * (3 + i * 3), y - 4 + i * 2, 2, 1);
  }
}

interface Spark { x: number; y: number; vx: number; vy: number; age: number; life: number; ramp: string[] }

export class TitleScene implements Scene {
  sel = 0;
  t = 0;
  fighters: [ClassId, ClassId] = [ROSTER[0], ROSTER[1]];
  /** Which side swapped last and how long ago. */
  swapSide: 0 | 1 = 1;
  swapT = POOF;
  /** Time into the opening; past INTRO once it's done (or skipped). */
  intro = introPlayed ? INTRO : 0;
  sparks: Spark[] = [];
  /** Screen shake left, in seconds. */
  shake = 0;
  /** Drifting motes in the air, x/y in world pixels. */
  motes = Array.from({ length: 14 }, (_, i) => ({ x: (i * 53) % W, y: 40 + ((i * 37) % 100), s: 6 + (i % 4) * 3 }));

  enter(): void { playMusic('menu'); }
  // a screen opened from here (the sandbox, a fight) may have changed the music
  resume(): void { playMusic('menu'); }
  pad(): PadMode { return 'none'; }

  /** The side about to be knocked out, and the one knocking it. */
  private get target(): 0 | 1 { return (1 - this.swapSide) as 0 | 1; }

  private burst(x: number, y: number, ramp: string[], n: number, speed: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = (0.4 + Math.random() * 0.6) * speed;
      this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, age: 0, life: 0.25 + Math.random() * 0.3, ramp });
    }
  }

  update(dt: number): void {
    this.t += dt;
    if (this.intro < INTRO) {
      // it waits on the black screen for the first click, like powering on the cartridge
      if (!page.engaged) return;
      const was = this.intro;
      this.intro += dt;
      // the logo lands
      if (was < LOGO_DROP[1] && this.intro >= LOGO_DROP[1]) { this.shake = 0.25; sfx('hit'); }
      // any key or click skips to the menu, without picking anything
      if (was > 0.15 && (anyPressed() || mouse.click)) this.intro = INTRO;
      if (this.intro >= INTRO) introPlayed = true;
      return;
    }
    this.shake = Math.max(0, this.shake - dt);
    const prev = this.swapT;
    this.swapT += dt;
    if (ROSTER.length > 2) {
      const a = this.swapSide, b = this.target;
      if (prev < HIT && this.swapT >= HIT) { this.burst(X[b] + (b ? -8 : 8), FOOT - 24, SHOT[this.fighters[a]].ramp, 20, 80); this.shake = 0.15; }
      if (this.swapT >= SWAP) {
        this.swapT = 0;
        this.swapSide = b;
        this.fighters[b] = nextClass(this.fighters[b], this.fighters[a]);
      }
    }
    for (const p of this.sparks) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 140 * dt; }
    this.sparks = this.sparks.filter(p => p.age < p.life);
    for (const m of this.motes) { m.y -= m.s * dt; m.x += Math.sin(this.t + m.s) * 3 * dt; if (m.y < 30) { m.y = 150; m.x = Math.random() * W; } }

    if (navPressed('up', dt)) { this.sel = (this.sel + ITEMS.length - 1) % ITEMS.length; sfx('move'); }
    if (navPressed('down', dt)) { this.sel = (this.sel + 1) % ITEMS.length; sfx('move'); }
    const clicked = listMouse('menu', this.sel, i => { this.sel = i; sfx('move'); });
    if (clicked >= 0) this.sel = clicked;
    if (wasPressed('confirm') || wasPressed('custom') || clicked >= 0) {
      sfx('select');
      const item = ITEMS[this.sel];
      if (item === 'ARCADE MODE') pushScene(new CharSelectScene(undefined, 0, 'arcade'));
      if (item === 'VERSUS MODE') pushScene(new CharSelectScene());
      if (item === 'ONLINE MODE') pushScene(new OnlineScene());
      if (item === 'TRAINING MODE') pushScene(new CharSelectScene(undefined, 0, 'training'));
      if (item === 'TUTORIAL') pushScene(new CharSelectScene(undefined, 0, 'tutorial'));
      if (item === 'SPELL DECK BUILDER') pushScene(new DeckBuilderScene(loadMatch().p1));
      if (item === 'REPLAYS') pushScene(new ReplaysScene());
      if (item === 'OPTIONS') pushScene(new OptionsScene());
      // loaded on demand, so the prod build (DEV_TOOLS off) carries none of the dev tools code
      if (item === 'DEV TOOLS' && DEV_TOOLS) void import('./devMenu').then(m => pushScene(new m.DevMenuScene()));
    }
  }

  /** The frame a side shows at this point in the duel. */
  private frameOf(side: 0 | 1): FrameId {
    const t = this.swapT, idle: FrameId = Math.floor(this.t * 2.5 + side) % 2 ? 'idle1' : 'idle0';
    if (side === this.swapSide) {
      if (t >= WIND && t < FIRE) return 'windup';
      if (t >= FIRE && t < FIRE + 0.3) return this.fighters[side] === 'warrior' || this.fighters[side] === 'rogue' ? 'slash' : 'cast1';
      return idle;
    }
    if (t >= HIT && t < HIT + 0.45) return 'hit';
    if (t >= HIT + 0.45) return 'kneel';
    return idle;
  }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    const intro = this.intro, sx = this.shake > 0 ? Math.round(Math.sin(this.t * 90) * 2) : 0;
    c.save();
    c.translate(sx, 0);
    drawStage(c, getArena(), tick);
    c.fillStyle = 'rgba(40,20,0,0.25)';
    c.fillRect(...screenRect());
    // warm motes drifting up through the air
    for (const m of this.motes) if (Math.floor(this.t * 3 + m.s) % 4) P(c, m.s > 10 ? '#fce0a8' : '#f8b800', Math.round(m.x), Math.round(m.y), 1, 1);

    // fighters flanking the menu, the Mage under SPELL and the Warrior under STEEL to start, facing each other
    const hop = span(intro, HOP_IN);
    for (const side of [0, 1] as const) {
      if (hop <= 0) break;
      const cls = this.fighters[side], x = X[side], skin = defaultSkin(cls);
      if (intro < INTRO) {
        // hop in from the screen edge on an arc
        const fx = Math.round(side ? x + (1 - hop) * 60 : x - (1 - hop) * 60), fy = FOOT - Math.round(Math.sin(hop * Math.PI) * 22);
        drawFighterSprite(c, getFrame(cls, skin, false, hop < 1 ? 'hop' : 'land'), fx, fy, side === 1, 'none', 2);
        P(c, '#000000', x - 12, FOOT + 1, 24, 2);
        continue;
      }
      const k = side === this.swapSide ? this.swapT / POOF : 1;
      const hurt = side === this.target && this.swapT >= HIT && this.swapT < HIT + 0.12;
      // knocked back a step by the hit
      const kb = side === this.target && this.swapT >= HIT ? (side ? 4 : -4) : 0;
      // the new fighter flashes in from the smoke
      if (k >= 0.35) drawFighterSprite(c, getFrame(cls, skin, false, this.frameOf(side)), x + kb, FOOT, side === 1, k < 0.6 || hurt ? 'flash' : 'none', 2);
      P(c, '#000000', x - 12, FOOT + 1, 24, 2);
      if (k < 1) poof(c, x, 112, k);
    }
    // the shot crossing between them (it passes behind the menu)
    if (intro >= INTRO && this.swapT >= FIRE && this.swapT < HIT) {
      const a = this.swapSide, dir = a ? -1 : 1, f = (this.swapT - FIRE) / (HIT - FIRE), cls = this.fighters[a];
      const x0 = X[a] + dir * 20, x1 = X[1 - a] - dir * 10, low = SHOT[cls].kind === 'wave';
      drawShot(c, cls, x0 + (x1 - x0) * f, low ? FOOT - 7 : FOOT - 26 - Math.sin(f * Math.PI) * 6, dir, this.t);
    }
    // the attacker gathers its element in its hand before letting fly
    if (intro >= INTRO && this.swapT >= WIND && this.swapT < FIRE) {
      const a = this.swapSide, dir = a ? -1 : 1, r = SHOT[this.fighters[a]].ramp, f = (this.swapT - WIND) / (FIRE - WIND);
      const hx = X[a] + dir * 16, hy = FOOT - 28, rad = 1 + Math.round(f * 4);
      for (let i = 0; i < 6; i++) {
        const an = this.t * 9 + (i / 6) * Math.PI * 2, d = (1 - f) * 10 + 2;
        P(c, r[1 + (i % 3)], Math.round(hx + Math.cos(an) * d), Math.round(hy + Math.sin(an) * d), 1, 1);
      }
      P(c, r[1], hx - rad, hy - rad + 1, rad * 2, rad * 2 - 2); P(c, r[1], hx - rad + 1, hy - rad, rad * 2 - 2, rad * 2);
      P(c, r[3], hx - 1, hy - 1, 2, 2);
    }
    for (const p of this.sparks) { const r = p.ramp, i = Math.min(r.length - 1, Math.floor((1 - p.age / p.life) * r.length)); const z = p.age < p.life / 2 ? 2 : 1; P(c, r[i], Math.round(p.x), Math.round(p.y), z, z); }

    // the logo drops in and lands with a bounce
    const drop = span(intro, LOGO_DROP);
    if (drop > 0) drawLogo(c, W / 2, Math.round(10 - (1 - drop) ** 2 * 110), this.t);
    c.restore();
    // a white flash as it lands
    const flash = 1 - clamp((intro - LOGO_DROP[1]) / 0.25);
    if (intro >= LOGO_DROP[1] && flash > 0) {
      const [rx, ry, rw, rh] = screenRect();
      for (let y = 0; y < rh; y += 1) for (let x = 0; x < rw; x += 1) if (dith(x, y) < flash * 0.7) P(c, '#fcfcfc', rx + x, ry + y);
    }
    // fade in from black at the very start
    const dark = 1 - clamp(intro / LOGO_DROP[0]);
    if (dark > 0) { const [rx, ry, rw, rh] = screenRect(); for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) if (dith(x, y) < dark) P(c, '#000000', rx + x, ry + y); }

    const { gap, scale, width, versionY } = menuLayout();
    const rise = span(intro, MENU_IN);
    if (rise <= 0) return;
    ui.save();
    ui.translate(0, Math.round((1 - rise) ** 2 * 80) & ~1);
    drawMenu(ui, ITEMS, this.sel, UW / 2, MENU_Y, tick, { width, gap, scale, grow: false });
    ui.restore();
    if (intro < INTRO) return;
    // first-timers get a nudge toward the tutorial
    if (!tutorialDone() && tick % 8 < 6) {
      const x = scale > 1 ? UW / 2 + textWidth('TUTORIAL', scale) / 2 + 8 : UW / 2 + 40;
      drawText(ui, 'NEW!', x, MENU_Y + ITEMS.indexOf('TUTORIAL') * gap + Math.round((gap - 17) / 2), RED_INK);
    }
    drawTextOutlined(ui, DEV_TOOLS ? 'PROTOTYPE 0.2  DEV BUILD' : 'PROTOTYPE 0.2', 8, 8, '#fcfcfc');
    drawTextCentered(ui, 'DESIGNED BY WES   -   BUILT BY CLAUDE', UW / 2, versionY, '#fcfcfc');
    if (isMuted()) drawTextOutlined(ui, 'MUTED', 8, 22, '#fcfcfc');
    hint(ui, `CLICK OR ${k('up')}/${k('down')} + ${k('attack')} TO SELECT   M: MUTE`);
  }
}
