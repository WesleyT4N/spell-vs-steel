import { setScene, drawMenu, hint, listMouse, type Scene } from './scene';
import { getArena } from '../game/battleView';
import { drawStage } from '../art/arena';
import { drawLogo } from '../art/logo';
import { getSprite, drawFighterSprite, defaultSkin, type ClassId } from '../art/sprites';
import { P, W, UW, screenRect, type Ctx } from '../engine/gfx';
import { PLAYABLE } from '../game/classes';
import { drawText, drawTextCentered } from '../engine/font';
import { wasPressed, navPressed, k } from '../engine/input';
import type { PadMode } from '../engine/touch';
import { playMusic, sfx, isMuted } from '../engine/audio';
import { MENU_SONG } from '../engine/music';
import { CharSelectScene } from './select';
import { DeckBuilderScene } from './deckbuilder';
import { OptionsScene } from './options';
import { OnlineScene } from './online';
import { tutorialDone } from './tutorial';
import { loadMatch } from '../game/match';
import { DEV_TOOLS } from '../flags';
import { RED_INK } from './skin';

const ITEMS = ['VERSUS MODE', 'ONLINE MODE', 'TRAINING', 'TUTORIAL', 'DECK BUILDER', 'OPTIONS', ...(DEV_TOOLS ? ['DEV TOOLS'] : [])];

// seven rows in dev builds still clear the version line
const MENU_Y = ITEMS.length > 6 ? 168 : 172, MENU_GAP = ITEMS.length > 6 ? 16 : 18;

// the side fighters take turns swapping for another class, so every matchup comes around
const SWAP = 3.5, POOF = 0.5;
// Mage under SPELL, Warrior under STEEL to start, then the rest of the roster
const ROSTER: ClassId[] = ['mage', 'warrior', ...PLAYABLE.filter(c => c !== 'mage' && c !== 'warrior')];
const X = [34, 206];

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

export class TitleScene implements Scene {
  sel = 0;
  t = 0;
  fighters: [ClassId, ClassId] = [ROSTER[0], ROSTER[1]];
  /** Which side swapped last and how long ago. */
  swapSide: 0 | 1 = 1;
  swapT = POOF;

  enter(): void { playMusic('menu', MENU_SONG); }
  pad(): PadMode { return 'none'; }

  update(dt: number): void {
    this.t += dt;
    this.swapT += dt;
    if (this.swapT >= SWAP && ROSTER.length > 2) {
      this.swapT = 0;
      const s = (1 - this.swapSide) as 0 | 1;
      this.swapSide = s;
      this.fighters[s] = nextClass(this.fighters[s], this.fighters[1 - s]);
    }
    if (navPressed('up', dt)) { this.sel = (this.sel + ITEMS.length - 1) % ITEMS.length; sfx('move'); }
    if (navPressed('down', dt)) { this.sel = (this.sel + 1) % ITEMS.length; sfx('move'); }
    const clicked = listMouse('menu', this.sel, i => { this.sel = i; sfx('move'); });
    if (clicked >= 0) this.sel = clicked;
    if (wasPressed('confirm') || wasPressed('custom') || clicked >= 0) {
      sfx('select');
      const item = ITEMS[this.sel];
      if (item === 'VERSUS MODE') setScene(new CharSelectScene());
      if (item === 'ONLINE MODE') setScene(new OnlineScene());
      if (item === 'TRAINING') setScene(new CharSelectScene(undefined, 0, 'training'));
      if (item === 'TUTORIAL') setScene(new CharSelectScene(undefined, 0, 'tutorial'));
      if (item === 'DECK BUILDER') setScene(new DeckBuilderScene(loadMatch().p1, () => setScene(new TitleScene())));
      if (item === 'OPTIONS') setScene(new OptionsScene(() => setScene(new TitleScene())));
      // loaded on demand, so the prod build (DEV_TOOLS off) carries none of the dev tools code
      if (item === 'DEV TOOLS' && DEV_TOOLS) void import('./devMenu').then(m => setScene(new m.DevMenuScene(() => setScene(new TitleScene()))));
    }
  }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    drawStage(c, getArena(), tick);
    c.fillStyle = 'rgba(40,20,0,0.25)';
    c.fillRect(...screenRect());
    // fighters flanking the menu, the Mage under SPELL and the Warrior under STEEL to start, facing each other
    const bob = Math.floor(this.t * 2.5) % 2;
    for (const side of [0, 1] as const) {
      const cls = this.fighters[side], x = X[side];
      const k = side === this.swapSide ? this.swapT / POOF : 1;
      // the new fighter flashes in from the smoke
      if (k >= 0.35) drawFighterSprite(c, getSprite(cls, defaultSkin(cls), false), x, 130 - (side ? bob : 1 - bob), side === 1, k < 0.6 ? 'flash' : 'none', 2);
      P(c, '#000000', x - 12, 131, 24, 2);
      if (k < 1) poof(c, x, 112, k);
    }
    drawLogo(c, W / 2, 10, this.t);
    drawMenu(ui, ITEMS, this.sel, UW / 2, MENU_Y, tick, { width: 200, gap: MENU_GAP });
    // first-timers get a nudge toward the tutorial
    if (!tutorialDone() && tick % 8 < 6) drawText(ui, 'NEW!', UW / 2 + 40, MENU_Y + ITEMS.indexOf('TUTORIAL') * MENU_GAP + Math.round((MENU_GAP - 17) / 2), RED_INK);
    drawTextCentered(ui, DEV_TOOLS ? 'PROTOTYPE 0.2  DEV BUILD' : 'PROTOTYPE 0.2', UW / 2, 288, '#7c7c7c', 1, false);
    if (isMuted()) drawText(ui, 'MUTED', 8, 8, '#7c7c7c');
    hint(ui, `CLICK OR ${k('up')}/${k('down')} + ${k('attack')} TO SELECT   M: MUTE`);
  }
}
