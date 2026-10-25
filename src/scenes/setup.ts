// Match setup: both fighters, the player's deck, CPU difficulty.
import { setScene, hint, zone, hot, listMouse, type Scene } from './scene';
import { getArena } from '../game/battleView';
import { getSprite, drawFighterSprite, teamColor, SKINS, skinOf, mirrorSkin, type ClassId } from '../art/sprites';
import { P, W, H, UW, frame, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered, textWidth } from '../engine/font';
import { wasPressed, navPressed, k, mouse } from '../engine/input';
import { sfx } from '../engine/audio';
import { loadMatch, saveMatch, type MatchConfig } from '../game/match';
import { loadCustom, validate, STARTER_NAME } from '../game/deck';
import { BattleScene } from './battle';
import { DeckBuilderScene } from './deckbuilder';
import { TitleScene } from './title';

const CLASSES: ClassId[] = ['warrior', 'mage'];
const ROWS = ['YOU', 'SKIN', 'DECK', 'EDIT DECK', 'CPU', 'CPU SKIN', 'CPU LEVEL', 'MATCH', 'FIGHT!'] as const;
type RowName = (typeof ROWS)[number];

// layout (UI pixels)
const RX = 72, RW = UW - 144, Y0 = 150, RH = 16;
const VX = RX + RW - 16; // right edge of the value column
const SW = 14;           // skin swatch pitch

export class SetupScene implements Scene {
  m: MatchConfig = loadMatch();
  sel: number = ROWS.length - 1;
  msg = '';
  msgT = 0;

  private customValid(): boolean {
    const d = loadCustom(this.m.p1);
    return !!d && validate(d).length === 0;
  }

  private mySkin(): string { return skinOf(this.m.p1, this.m.p1Skin[this.m.p1]).id; }
  private cpuSkin(): string {
    return this.m.p1 === this.m.cpu ? mirrorSkin(this.m.cpu, this.mySkin(), this.m.cpuSkin[this.m.cpu]) : skinOf(this.m.cpu, this.m.cpuSkin[this.m.cpu]).id;
  }

  /** Step a row's value left or right. */
  private change(row: RowName, d: 1 | -1): void {
    const cycle = <T>(list: readonly T[], v: T): T => list[(list.indexOf(v) + d + list.length) % list.length];
    if (row === 'YOU') { this.m.p1 = cycle(CLASSES, this.m.p1); this.m.p1Deck = 'starter'; }
    else if (row === 'DECK') this.m.p1Deck = this.m.p1Deck === 'starter' ? 'custom' : 'starter';
    else if (row === 'CPU') this.m.cpu = cycle(CLASSES, this.m.cpu);
    else if (row === 'SKIN') this.m.p1Skin[this.m.p1] = cycle(SKINS[this.m.p1].map(s => s.id), this.m.p1Skin[this.m.p1]);
    else if (row === 'CPU SKIN') this.m.cpuSkin[this.m.cpu] = cycle(SKINS[this.m.cpu].map(s => s.id), this.m.cpuSkin[this.m.cpu]);
    else if (row === 'CPU LEVEL') this.m.difficulty = this.m.difficulty === 'easy' ? 'normal' : 'easy';
    else if (row === 'MATCH') this.m.bestOf = cycle([1, 3, 5] as const, this.m.bestOf);
    else return;
    sfx('move');
    saveMatch(this.m);
  }

  private pickSkin(mine: boolean, n: number): void {
    const cls = mine ? this.m.p1 : this.m.cpu;
    const id = SKINS[cls][n]?.id;
    if (!id) return;
    if (mine) this.m.p1Skin[cls] = id; else this.m.cpuSkin[cls] = id;
    sfx('select');
    saveMatch(this.m);
  }

  private activate(row: RowName): void {
    if (row === 'EDIT DECK') { sfx('select'); setScene(new DeckBuilderScene(this.m.p1, () => setScene(new SetupScene()))); return; }
    if (row === 'FIGHT!') { this.fight(); return; }
    this.change(row, 1);
  }

  private fight(): void {
    if (this.m.p1Deck === 'custom' && !this.customValid()) {
      this.msg = 'CUSTOM DECK IS NOT READY'; this.msgT = 2; sfx('deny');
      return;
    }
    sfx('select');
    saveMatch(this.m);
    setScene(new BattleScene(this.m));
  }

  update(dt: number): void {
    this.msgT = Math.max(0, this.msgT - dt);
    if (wasPressed('back') || mouse.rclick) { sfx('back'); setScene(new TitleScene()); return; }

    // mouse: skin thumbnails and swatches pick directly, arrows step, a row click steps forward
    if (mouse.click) {
      const thumb = hot('thumb'), mine = hot('swatch'), theirs = hot('cswatch'), arrow = hot('arrow');
      if (thumb >= 0) { this.pickSkin(ROWS[this.sel] === 'SKIN', thumb); return; }
      if (mine >= 0) { this.sel = ROWS.indexOf('SKIN'); this.pickSkin(true, mine); return; }
      if (theirs >= 0) { this.sel = ROWS.indexOf('CPU SKIN'); this.pickSkin(false, theirs); return; }
      if (arrow >= 0) { this.sel = arrow >> 1; this.change(ROWS[this.sel], arrow & 1 ? 1 : -1); return; }
    }
    const clicked = listMouse('row', this.sel, i => { this.sel = i; sfx('move'); });
    if (clicked >= 0) { this.sel = clicked; this.activate(ROWS[clicked]); return; }
    if (mouse.wheel && hot('row') === this.sel) this.change(ROWS[this.sel], mouse.wheel > 0 ? 1 : -1);

    if (navPressed('up', dt)) { this.sel = (this.sel + ROWS.length - 1) % ROWS.length; sfx('move'); }
    if (navPressed('down', dt)) { this.sel = (this.sel + 1) % ROWS.length; sfx('move'); }
    const l = navPressed('left', dt), r = navPressed('right', dt);
    if (l || r) this.change(ROWS[this.sel], r ? 1 : -1);
    if (wasPressed('custom')) { this.fight(); return; }
    if (wasPressed('confirm')) {
      const row = ROWS[this.sel];
      if (row === 'EDIT DECK' || row === 'FIGHT!') { this.activate(row); return; }
      this.sel = ROWS.length - 1;
      sfx('move');
    }
  }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    getArena().draw(c, tick, 0);
    c.fillStyle = 'rgba(0,0,24,0.55)';
    c.fillRect(0, 0, W, H);
    drawTextCentered(ui, 'VERSUS CPU', UW / 2, 8, '#f8b800', 2);

    const bob = Math.floor(tick / 4) % 2;
    const mySkin = this.mySkin(), cpuSkin = this.cpuSkin();
    const focus = ROWS[this.sel];
    if (focus === 'SKIN' || focus === 'CPU SKIN') {
      // skin picker: every skin as an in-game sprite, click one to wear it
      const mine = focus === 'SKIN', cls = mine ? this.m.p1 : this.m.cpu, cur = mine ? mySkin : cpuSkin;
      frame(ui, 16, 30, UW - 32, 110, '#000000', teamColor(cls, cur, false));
      drawText(ui, mine ? 'YOUR SKIN' : 'CPU SKIN', 24, 36, '#fcfcfc');
      const list = SKINS[cls], gap = 54, x1 = UW / 2 - ((list.length - 1) * gap) / 2;
      list.forEach((sk, n) => {
        const fx = x1 + n * gap, picked = sk.id === cur, id = `thumb:${n}`;
        zone(id, Math.round(fx - 24), 48, 48, 86);
        const over = hot('thumb') === n;
        if (picked || over) frame(ui, Math.round(fx - 24), 48, 48, 86, picked ? '#0000a8' : '#000000', picked ? '#fcfcfc' : '#7c7c7c');
        drawFighterSprite(ui, getSprite(cls, sk.id, false), fx, 128 - (picked ? bob * 2 : 0), !mine, 'none', 2);
      });
    } else {
      frame(ui, 24, 30, 104, 110, '#000000', teamColor(this.m.p1, mySkin, false));
      drawFighterSprite(ui, getSprite(this.m.p1, mySkin, false), 76, 132 - bob * 2, false, 'none', 4);
      drawTextCentered(ui, 'YOU', 76, 34, '#fcfcfc', 1, false);
      frame(ui, UW - 128, 30, 104, 110, '#000000', teamColor(this.m.cpu, cpuSkin, false));
      drawFighterSprite(ui, getSprite(this.m.cpu, cpuSkin, false), UW - 76, 132 - (1 - bob) * 2, true, 'none', 4);
      drawTextCentered(ui, 'CPU', UW - 76, 34, '#fcfcfc', 1, false);
      drawTextCentered(ui, 'VS', UW / 2, 70, '#f8b800', 4);
      P(ui, 'rgba(0,0,0,0.7)', 140, 104, UW - 280, 32);
      const deck = this.m.p1Deck === 'starter' ? STARTER_NAME[this.m.p1].toUpperCase() : 'CUSTOM';
      drawTextCentered(ui, `${this.m.p1.toUpperCase()} (${deck})`, UW / 2, 110, '#bcbcbc', 1, false);
      drawTextCentered(ui, `VS ${this.m.cpu.toUpperCase()} (${STARTER_NAME[this.m.cpu].toUpperCase()})`, UW / 2, 122, '#7c7c7c', 1, false);
    }

    // option rows
    frame(ui, RX - 8, Y0 - 6, RW + 16, ROWS.length * RH + 8, '#000000', '#fcfcfc');
    ROWS.forEach((row, i) => {
      const y = Y0 + i * RH, ty = y + 4;
      const on = i === this.sel;
      zone(`row:${i}`, RX - 6, y - 1, RW + 12, RH - 1);
      if (on) P(ui, '#0000a8', RX - 6, y - 1, RW + 12, RH - 2);
      if (on && tick % 8 < 6) drawText(ui, '→', RX, ty, '#f8b800');
      if (row === 'FIGHT!' || row === 'EDIT DECK') {
        drawTextCentered(ui, row, UW / 2, ty, row === 'FIGHT!' ? '#f8b800' : '#fcfcfc', 1, false);
        return;
      }
      drawText(ui, row, RX + 14, ty, on ? '#fcfcfc' : '#bcbcbc');
      // every value row gets clickable arrows either side of the value
      let vw: number;
      if (row === 'SKIN' || row === 'CPU SKIN') {
        const mine = row === 'SKIN', cls = mine ? this.m.p1 : this.m.cpu, cur = mine ? mySkin : cpuSkin;
        const list = SKINS[cls];
        vw = list.length * SW;
        const sx = VX - vw;
        list.forEach((sk, n) => {
          const px = sx + n * SW;
          zone(`${mine ? 'swatch' : 'cswatch'}:${n}`, px - 1, y, SW, RH - 3);
          if (sk.id === cur) P(ui, '#fcfcfc', px - 2, y + 1, 12, 12);
          P(ui, '#000000', px, y + 3, 8, 8);
          P(ui, teamColor(cls, sk.id, false), px + 1, y + 4, 6, 6);
        });
      } else {
        let value = '';
        if (row === 'YOU') value = this.m.p1.toUpperCase();
        if (row === 'DECK') value = this.m.p1Deck === 'starter' ? `STARTER: ${STARTER_NAME[this.m.p1].toUpperCase()}` : `CUSTOM${this.customValid() ? '' : ' (NOT READY)'}`;
        if (row === 'CPU') value = this.m.cpu.toUpperCase();
        if (row === 'CPU LEVEL') value = this.m.difficulty.toUpperCase();
        if (row === 'MATCH') value = this.m.bestOf === 1 ? 'SINGLE ROUND' : `BEST OF ${this.m.bestOf}`;
        vw = textWidth(value);
        drawText(ui, value, VX - vw, ty, '#fcfcfc');
      }
      const lit = on || hot('row') === i;
      const ax = VX - vw - 16;
      zone(`arrow:${i * 2}`, ax - 4, y - 1, 14, RH - 2);
      zone(`arrow:${i * 2 + 1}`, VX + 2, y - 1, 14, RH - 2);
      drawText(ui, '←', ax, ty, hot('arrow') === i * 2 ? '#f8b800' : lit ? '#fcfcfc' : '#3c3c3c');
      drawText(ui, '→', VX + 6, ty, hot('arrow') === i * 2 + 1 ? '#f8b800' : lit ? '#fcfcfc' : '#3c3c3c');
    });
    if (this.msgT > 0) { P(ui, '#000000', 0, 128, UW, 16); drawTextCentered(ui, this.msg, UW / 2, 132, '#f83800'); }
    hint(ui, `CLICK TO CHANGE   ${k('left')}/${k('right')}: CHANGE   ${k('custom')}: FIGHT   ${k('cast')} / RIGHT-CLICK: BACK`);
  }
}
