import { setScene, drawMenu, hint, listMouse, type Scene } from './scene';
import { getArena } from '../game/battleView';
import { drawLogo } from '../art/logo';
import { getSprite, drawFighterSprite, defaultSkin } from '../art/sprites';
import { P, W, H, UW, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered } from '../engine/font';
import { wasPressed, navPressed, k } from '../engine/input';
import { playMusic, sfx, isMuted } from '../engine/audio';
import { MENU_SONG } from '../engine/music';
import { SetupScene } from './setup';
import { DeckBuilderScene } from './deckbuilder';
import { OptionsScene } from './options';
import { OnlineScene } from './online';
import { loadMatch } from '../game/match';

const ITEMS = ['VERSUS CPU', 'ONLINE VERSUS', 'DECK BUILDER', 'OPTIONS'];

export class TitleScene implements Scene {
  sel = 0;
  t = 0;

  enter(): void { playMusic('menu', MENU_SONG); }

  update(dt: number): void {
    this.t += dt;
    if (navPressed('up', dt)) { this.sel = (this.sel + ITEMS.length - 1) % ITEMS.length; sfx('move'); }
    if (navPressed('down', dt)) { this.sel = (this.sel + 1) % ITEMS.length; sfx('move'); }
    const clicked = listMouse('menu', this.sel, i => { this.sel = i; sfx('move'); });
    if (clicked >= 0) this.sel = clicked;
    if (wasPressed('confirm') || wasPressed('custom') || clicked >= 0) {
      sfx('select');
      const item = ITEMS[this.sel];
      if (item === 'VERSUS CPU') setScene(new SetupScene());
      if (item === 'ONLINE VERSUS') setScene(new OnlineScene());
      if (item === 'DECK BUILDER') setScene(new DeckBuilderScene(loadMatch().p1, () => setScene(new TitleScene())));
      if (item === 'OPTIONS') setScene(new OptionsScene(() => setScene(new TitleScene())));
    }
  }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    getArena().draw(c, tick, 0);
    c.fillStyle = 'rgba(0,0,24,0.45)';
    c.fillRect(0, 0, W, H);
    // fighters flanking the logo
    const bob = Math.floor(this.t * 2.5) % 2;
    // the Mage stands under SPELL, the Warrior under STEEL, facing each other
    drawFighterSprite(c, getSprite('mage', defaultSkin('mage'), false), 34, 130 - (1 - bob), false, 'none', 2);
    drawFighterSprite(c, getSprite('warrior', defaultSkin('warrior'), false), 206, 130 - bob, true, 'none', 2);
    P(c, '#000000', 22, 131, 24, 2); P(c, '#000000', 194, 131, 24, 2);
    drawLogo(c, W / 2, 10, this.t);
    drawMenu(ui, ITEMS, this.sel, UW / 2, 180, tick, { width: 200, gap: 22 });
    drawTextCentered(ui, 'PROTOTYPE 0.2', UW / 2, 280, '#7c7c7c', 1, false);
    if (isMuted()) drawText(ui, 'MUTED', 8, 8, '#7c7c7c');
    hint(ui, `CLICK OR ${k('up')}/${k('down')} + ${k('attack')} TO SELECT   M: MUTE`);
  }
}
