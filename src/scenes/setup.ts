// Match setup: both fighters, the player's deck, CPU difficulty.
import { setScene, hint, type Scene } from './scene';
import { getArena } from '../game/battleView';
import { getSprite, drawFighterSprite, teamColor, type ClassId } from '../art/sprites';
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
const ROWS = ['YOU', 'DECK', 'EDIT DECK', 'CPU', 'CPU LEVEL', 'FIGHT!'] as const;

export class SetupScene implements Scene {
  m: MatchConfig = loadMatch();
  sel = 5;
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
      if (row === 'CPU LEVEL') { this.m.difficulty = this.m.difficulty === 'easy' ? 'normal' : 'easy'; sfx('move'); }
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
    frame(c, 10, 20, 52, 58, '#000000', teamColor(this.m.p1, false));
    drawFighterSprite(c, getSprite(this.m.p1, false), 36, 70 - bob, false, 'none', 2);
    drawTextCentered(c, 'YOU', 36, 22, '#fcfcfc', 1, false);
    const alt = this.m.p1 === this.m.cpu;
    frame(c, W - 62, 20, 52, 58, '#000000', teamColor(this.m.cpu, alt));
    drawFighterSprite(c, getSprite(this.m.cpu, alt), W - 36, 70 - (1 - bob), true, 'none', 2);
    drawTextCentered(c, 'CPU', W - 36, 22, '#fcfcfc', 1, false);
    drawTextCentered(c, 'VS', W / 2, 44, '#f8b800', 2);

    // option rows
    const x0 = 40, y0 = 86;
    frame(c, x0 - 14, y0 - 4, W - 2 * x0 + 28, ROWS.length * 10 + 5, '#000000', '#fcfcfc');
    ROWS.forEach((row, i) => {
      const y = y0 + i * 10;
      const on = i === this.sel;
      if (on) P(c, '#0000a8', x0 - 12, y - 2, W - 2 * x0 + 24, 10);
      const label = row === 'FIGHT!' || row === 'EDIT DECK' ? '' : row;
      let value = '';
      if (row === 'YOU') value = this.m.p1.toUpperCase();
      if (row === 'DECK') value = this.m.p1Deck === 'starter' ? `STARTER: ${STARTER_NAME[this.m.p1].toUpperCase()}` : `CUSTOM${this.customValid() ? '' : ' (NOT READY)'}`;
      if (row === 'CPU') value = this.m.cpu.toUpperCase() + (alt ? ' (ALT)' : '');
      if (row === 'CPU LEVEL') value = this.m.difficulty.toUpperCase();
      if (label) {
        drawText(c, label, x0, y, '#bcbcbc');
        const v = on ? `← ${value} →` : value;
        drawText(c, v, W - x0 - v.length * 6 + 1, y, on ? '#fcfcfc' : '#fcfcfc');
      } else {
        drawTextCentered(c, row, W / 2, y, row === 'FIGHT!' ? '#f8b800' : '#fcfcfc', 1, false);
      }
      if (on && tick % 8 < 6) drawText(c, '→', x0 - 10, y, '#f8b800');
    });
    if (this.msgT > 0) drawTextCentered(c, this.msg, W / 2, 142, '#f83800');
    hint(c, `${k('left')}/${k('right')} CHANGE  ${k('attack')} OK  ${k('cast')} BACK  ${k('custom')} FIGHT`);
  }
}
