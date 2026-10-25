// Match setup: both fighters, the player's deck, CPU difficulty.
import { setScene, hint, type Scene } from './scene';
import { getArena } from '../game/battleView';
import { getSprite, drawFighterSprite, teamColor, SKINS, skinOf, mirrorSkin, type ClassId } from '../art/sprites';
import { P, W, H, frame, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered } from '../engine/font';
import { wasPressed, navPressed, k } from '../engine/input';
import { sfx } from '../engine/audio';
import { loadMatch, saveMatch, type MatchConfig } from '../game/match';
import { loadCustom, validate, STARTER_NAME } from '../game/deck';
import { BattleScene } from './battle';
import { DeckBuilderScene } from './deckbuilder';
import { TitleScene } from './title';

const CLASSES: ClassId[] = ['warrior', 'mage'];
const ROWS = ['YOU', 'SKIN', 'DECK', 'EDIT DECK', 'CPU', 'CPU SKIN', 'CPU LEVEL', 'MATCH', 'FIGHT!'] as const;

export class SetupScene implements Scene {
  m: MatchConfig = loadMatch();
  sel: number = ROWS.length - 1;
  msg = '';
  msgT = 0;

  private customValid(): boolean {
    const d = loadCustom(this.m.p1);
    return !!d && validate(d).length === 0;
  }

  update(dt: number): void {
    this.msgT = Math.max(0, this.msgT - dt);
    if (navPressed('up', dt)) { this.sel = (this.sel + ROWS.length - 1) % ROWS.length; sfx('move'); }
    if (navPressed('down', dt)) { this.sel = (this.sel + 1) % ROWS.length; sfx('move'); }
    const l = navPressed('left', dt), r = navPressed('right', dt);
    if (l || r) {
      const d = r ? 1 : -1;
      const row = ROWS[this.sel];
      const cycle = <T>(list: readonly T[], v: T): T => list[(list.indexOf(v) + d + list.length) % list.length];
      if (row === 'YOU') { this.m.p1 = cycle(CLASSES, this.m.p1); this.m.p1Deck = 'starter'; sfx('move'); }
      if (row === 'DECK') { this.m.p1Deck = this.m.p1Deck === 'starter' ? 'custom' : 'starter'; sfx('move'); }
      if (row === 'CPU') { this.m.cpu = cycle(CLASSES, this.m.cpu); sfx('move'); }
      if (row === 'SKIN') { const ids = SKINS[this.m.p1].map(s => s.id); this.m.p1Skin[this.m.p1] = cycle(ids, this.m.p1Skin[this.m.p1]); sfx('move'); }
      if (row === 'CPU SKIN') { const ids = SKINS[this.m.cpu].map(s => s.id); this.m.cpuSkin[this.m.cpu] = cycle(ids, this.m.cpuSkin[this.m.cpu]); sfx('move'); }
      if (row === 'CPU LEVEL') { this.m.difficulty = this.m.difficulty === 'easy' ? 'normal' : 'easy'; sfx('move'); }
      if (row === 'MATCH') { this.m.bestOf = cycle([1, 3, 5] as const, this.m.bestOf); sfx('move'); }
      saveMatch(this.m);
    }
    if (wasPressed('back')) { sfx('back'); setScene(new TitleScene()); return; }
    if (wasPressed('confirm') || wasPressed('custom')) {
      const row = ROWS[this.sel];
      if (row === 'EDIT DECK') { sfx('select'); setScene(new DeckBuilderScene(this.m.p1, () => setScene(new SetupScene()))); return; }
      if (row === 'FIGHT!' || wasPressed('custom')) {
        if (this.m.p1Deck === 'custom' && !this.customValid()) {
          this.msg = 'CUSTOM DECK IS NOT READY'; this.msgT = 2; sfx('deny');
          return;
        }
        sfx('select');
        saveMatch(this.m);
        setScene(new BattleScene(this.m));
        return;
      }
      this.sel = ROWS.length - 1;
      sfx('move');
    }
  }

  draw(c: Ctx, tick: number): void {
    getArena().draw(c, tick, 0);
    c.fillStyle = 'rgba(0,0,24,0.55)';
    c.fillRect(0, 0, W, H);
    drawTextCentered(c, 'VERSUS CPU', W / 2, 6, '#f8b800');

    // portraits
    const bob = Math.floor(tick / 4) % 2;
    const mySkin = skinOf(this.m.p1, this.m.p1Skin[this.m.p1]).id;
    const cpuSkin = this.m.p1 === this.m.cpu ? mirrorSkin(this.m.cpu, mySkin, this.m.cpuSkin[this.m.cpu]) : skinOf(this.m.cpu, this.m.cpuSkin[this.m.cpu]).id;
    frame(c, 10, 16, 52, 54, '#000000', teamColor(this.m.p1, mySkin, false));
    drawFighterSprite(c, getSprite(this.m.p1, mySkin, false), 36, 66 - bob, false, 'none', 2);
    drawTextCentered(c, 'YOU', 36, 18, '#fcfcfc', 1, false);
    frame(c, W - 62, 16, 52, 54, '#000000', teamColor(this.m.cpu, cpuSkin, false));
    drawFighterSprite(c, getSprite(this.m.cpu, cpuSkin, false), W - 36, 66 - (1 - bob), true, 'none', 2);
    drawTextCentered(c, 'CPU', W - 36, 18, '#fcfcfc', 1, false);
    drawTextCentered(c, 'VS', W / 2, 38, '#f8b800', 2);

    // option rows
    const x0 = 36, y0 = 77, rh = 8;
    frame(c, x0 - 14, y0 - 4, W - 2 * x0 + 28, ROWS.length * rh + 4, '#000000', '#fcfcfc');
    ROWS.forEach((row, i) => {
      const y = y0 + i * rh;
      const on = i === this.sel;
      if (on) P(c, '#0000a8', x0 - 12, y - 1, W - 2 * x0 + 24, rh);
      const label = row === 'FIGHT!' || row === 'EDIT DECK' ? '' : row;
      let value = '';
      if (row === 'YOU') value = this.m.p1.toUpperCase();
      if (row === 'DECK') value = this.m.p1Deck === 'starter' ? `STARTER: ${STARTER_NAME[this.m.p1].toUpperCase()}` : `CUSTOM${this.customValid() ? '' : ' (NOT READY)'}`;
      if (row === 'CPU') value = this.m.cpu.toUpperCase();
      if (row === 'CPU LEVEL') value = this.m.difficulty.toUpperCase();
      if (row === 'SKIN' || row === 'CPU SKIN') {
        // no names: one swatch per skin in its main color, the chosen one framed
        const cls = row === 'SKIN' ? this.m.p1 : this.m.cpu;
        const cur = row === 'SKIN' ? mySkin : cpuSkin;
        drawText(c, row, x0, y, '#bcbcbc');
        const list = SKINS[cls], sx = W - x0 - list.length * 9 - (on ? 8 : 0);
        if (on) { drawText(c, '←', sx - 8, y, '#fcfcfc'); drawText(c, '→', sx + list.length * 9 + 2, y, '#fcfcfc'); }
        list.forEach((sk, n) => {
          const px = sx + n * 9;
          if (sk.id === cur) P(c, '#fcfcfc', px - 1, y - 1, 8, 8);
          P(c, '#000000', px, y, 6, 6);
          P(c, teamColor(cls, sk.id, false), px + 1, y + 1, 4, 4);
        });
        if (on && tick % 8 < 6) drawText(c, '→', x0 - 10, y, '#f8b800');
        return;
      }
      if (row === 'MATCH') value = this.m.bestOf === 1 ? 'SINGLE' : `BEST OF ${this.m.bestOf}`;
      if (label) {
        drawText(c, label, x0, y, '#bcbcbc');
        const v = on ? `← ${value} →` : value;
        drawText(c, v, W - x0 - v.length * 6 + 1, y, on ? '#fcfcfc' : '#fcfcfc');
      } else {
        drawTextCentered(c, row, W / 2, y, row === 'FIGHT!' ? '#f8b800' : '#fcfcfc', 1, false);
      }
      if (on && tick % 8 < 6) drawText(c, '→', x0 - 10, y, '#f8b800');
    });
    if (this.msgT > 0) { P(c, '#000000', 0, 62, W, 10); drawTextCentered(c, this.msg, W / 2, 63, '#f83800'); }
    hint(c, `${k('left')}/${k('right')} CHANGE  ${k('attack')} OK  ${k('cast')} BACK  ${k('custom')} FIGHT`);
  }
}
