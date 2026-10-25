import { setScene, drawMenu, hint, type Scene } from './scene';
import { getArena } from '../game/battleView';
import { drawLogo } from '../art/logo';
import { getSprite, drawFighterSprite } from '../art/sprites';
import { P, W, H, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered } from '../engine/font';
import { wasPressed, navPressed, k } from '../engine/input';
import { playMusic, sfx, isMuted } from '../engine/audio';
import { MENU_SONG } from '../engine/music';
import { SetupScene } from './setup';
import { DeckBuilderScene } from './deckbuilder';
import { OptionsScene } from './options';
import { loadMatch } from '../game/match';

const ITEMS = ['VERSUS CPU', 'DECK BUILDER', 'OPTIONS'];

export class TitleScene implements Scene {
  sel = 0;
  t = 0;

  enter(): void { playMusic('menu', MENU_SONG); }

  update(dt: number): void {
    this.t += dt;
    if (navPressed('up', dt)) { this.sel = (this.sel + ITEMS.length - 1) % ITEMS.length; sfx('move'); }
    if (navPressed('down', dt)) { this.sel = (this.sel + 1) % ITEMS.length; sfx('move'); }
    if (wasPressed('confirm') || wasPressed('custom')) {
      sfx('select');
      if (this.sel === 0) setScene(new SetupScene());
      if (this.sel === 1) setScene(new DeckBuilderScene(loadMatch().p1, () => setScene(new TitleScene())));
      if (this.sel === 2) setScene(new OptionsScene(() => setScene(new TitleScene())));
    }
  }

  draw(c: Ctx, tick: number): void {
    getArena().draw(c, tick, 0);
    c.fillStyle = 'rgba(0,0,24,0.45)';
    c.fillRect(0, 0, W, H);
    // fighters flanking the logo
    const bob = Math.floor(this.t * 2.5) % 2;
    drawFighterSprite(c, getSprite('warrior', false), 34, 130 - bob, false, 'none', 2);
    drawFighterSprite(c, getSprite('mage', false), 206, 130 - (1 - bob), true, 'none', 2);
    P(c, '#000000', 22, 131, 24, 2); P(c, '#000000', 194, 131, 24, 2);
    drawLogo(c, W / 2, 10);
    drawMenu(c, ITEMS, this.sel, W / 2, 92, tick, { width: 104 });
    drawTextCentered(c, 'PROTOTYPE 0.1', W / 2, 136, '#7c7c7c', 1, false);
    if (isMuted()) drawText(c, 'MUTED', 4, 4, '#7c7c7c');
    hint(c, `${k('up')}/${k('down')}: MOVE  ${k('attack')}: SELECT  M: MUTE`);
  }
}
