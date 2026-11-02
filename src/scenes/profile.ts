// Player profile (title > PROFILE): sets won and lost with each class and in each mode, the ranked
// rating, the favorite fighter and spell deck, and the door to the saved replays.
import { popScene, pushScene, hint, button, hot, showSel, type Scene } from './scene';
import { ReplaysScene } from './replays';
import { getArena } from '../game/battleView';
import { drawStage } from '../art/arena';
import { getSprite, drawFighterSprite, defaultSkin, type ClassId } from '../art/sprites';
import { CLASS_INFO, PLAYABLE } from '../game/classes';
import { loadMatch, deckLabel } from '../game/match';
import { loadRecords, clock, type ArcadeRecord } from '../game/arcade';
import { loadProfile, total, pct, favoriteClass, favoriteDeck, type Profile, type WinLoss } from '../game/profile';
import { loadReplays, type ReplayMode } from '../game/replay';
import { ratingStore, type Rating } from '../net/rating';
import { UW, screenRect, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered, textWidth } from '../engine/font';
import { wasPressed, navPressed, k, mouse } from '../engine/input';
import { type PadMode } from '../engine/touch';
import { sfx } from '../engine/audio';
import { win, banner, selRow, INK, INK2, RED_INK, TRIM } from './skin';

const MODES: Array<[ReplayMode, string]> = [['cpu', 'VS CPU'], ['arcade', 'ARCADE'], ['online', 'ONLINE'], ['ranked', 'RANKED']];
const ITEMS = ['REPLAYS', 'BACK'];
const WON = '#007800';

const wl = (x: WinLoss | undefined): string => `${x?.w ?? 0}-${x?.l ?? 0}`;
const best = (r: ArcadeRecord | undefined): string => (r ? `${clock(r.time)}${r.continues ? ` ${r.continues}C` : ''}` : '-');

export class ProfileScene implements Scene {
  profile: Profile = loadProfile();
  arcade = loadRecords();
  replays = loadReplays().length;
  /** Null until the rating store answers (the shared ladder on the published page, else this browser's). */
  rating: Rating | null = null;
  sel = 0;
  private skins = loadMatch().p1Skin;

  enter(): void {
    void ratingStore().then(s => s.mine()).then(r => { this.rating = r; }, () => {});
  }
  resume(): void { this.replays = loadReplays().length; }
  pad(): PadMode { return 'back'; }

  private open(item: string): void {
    if (item === 'REPLAYS') { sfx('confirm'); pushScene(new ReplaysScene()); }
    else { sfx('back'); popScene(); }
  }

  update(dt: number): void {
    
    if (wasPressed('back') || mouse.rclick) { this.open('BACK'); return; }
    const c = hot('pb');
    if (mouse.click && c >= 0) { this.open(ITEMS[c]); return; }
    if (c >= 0 && mouse.moved) this.sel = c;
    if (navPressed('left', dt) || navPressed('right', dt) || navPressed('up', dt) || navPressed('down', dt)) { this.sel = 1 - this.sel; sfx('move'); }
    if (wasPressed('confirm')) this.open(ITEMS[this.sel]);
  }

  private sprite(cls: ClassId): ReturnType<typeof getSprite> { return getSprite(cls, this.skins[cls] ?? defaultSkin(cls), false); }

  /** The ranked line: the rating and its record, or why there isn't one. */
  private ranked(): [string, string] {
    const r = this.rating;
    if (!r) return ['...', ''];
    if (!r.games) return ['UNRANKED', 'NO RATING YET'];
    return [String(r.rating), `${r.wins}-${r.losses} IN ${r.games} SETS`];
  }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    drawStage(c, getArena(), tick);
    c.fillStyle = 'rgba(40,20,0,0.35)';
    c.fillRect(...screenRect());
    
    banner(ui, 'PLAYER PROFILE', UW / 2, 3);
    const p = this.profile, all = total(p), bob = Math.floor(tick / 4) % 2;

    // the card: overall record, ranked, favorites
    const cx = 16, cw = 196, top = 36, h = 236, mid = cx + cw / 2;
    win(ui, cx, top, cw, h);
    let y = top + 10;
    drawTextCentered(ui, 'RECORD', mid, y, INK2, 1, false);
    drawTextCentered(ui, wl(all), mid, y + 12, INK, 3, false);
    drawTextCentered(ui, all.w + all.l ? `${pct(all)} WON` : 'NO SETS YET', mid, y + 37, all.w >= all.l ? WON : RED_INK, 1, false);
    y += Math.round(h * 0.24);
    const [rate, rateSub] = this.ranked();
    drawTextCentered(ui, 'RANKED RATING', mid, y, INK2, 1, false);
    drawTextCentered(ui, rate, mid, y + 12, RED_INK, 2, false);
    drawTextCentered(ui, rateSub, mid, y + 30, INK2, 1, false);
    y += Math.round(h * 0.24);
    const fav = favoriteClass(p), deck = favoriteDeck(p);
    drawText(ui, 'FAVORITE FIGHTER', cx + 12, y, INK2);
    drawText(ui, fav ? CLASS_INFO[fav].name.toUpperCase() : '-', cx + 12, y + 12, INK, 2);
    if (fav) drawFighterSprite(ui, this.sprite(fav), cx + cw - 30, y + 30 - bob, true, 'none', 2);
    y += Math.round(h * 0.22);
    drawText(ui, 'FAVORITE SPELL DECK', cx + 12, y, INK2);
    if (deck) {
      const name = deckLabel(deck.cls, deck.deck);
      drawText(ui, name, cx + 12, y + 12, INK, textWidth(name, 2) <= cw - 24 ? 2 : 1);
      drawText(ui, `${CLASS_INFO[deck.cls].name.toUpperCase()}, ${deck.n} SET${deck.n === 1 ? '' : 'S'}`, cx + 12, y + 30, TRIM);
    } else drawText(ui, '-', cx + 12, y + 12, INK, 2);

    // by class
    const tx = 220, tw = UW - 16 - tx;
    win(ui, tx, top, tw, h);
    const col = { w: tx + 100, l: tx + 124, pct: tx + 148, arc: tx + 182 };
    y = top + 10;
    drawText(ui, 'CLASS', tx + 34, y, INK2);
    drawText(ui, 'W', col.w, y, INK2); drawText(ui, 'L', col.l, y, INK2); drawText(ui, 'WIN', col.pct, y, INK2); drawText(ui, 'ARCADE', col.arc, y, INK2);
    const rh = Math.min(34, Math.floor((h - 64) / PLAYABLE.length));
    PLAYABLE.forEach((cls, i) => {
      const ry = top + 24 + i * rh, ty = ry + Math.round(rh / 2) - 3, x = p.classes[cls];
      if (cls === fav) selRow(ui, tx + 6, ry, tw - 12, rh - 2);
      drawFighterSprite(ui, this.sprite(cls), tx + 20, ry + rh - 3, false, 'none', 1);
      drawText(ui, CLASS_INFO[cls].name.toUpperCase(), tx + 34, ty, INK);
      drawText(ui, String(x?.w ?? 0), col.w, ty, x?.w ? WON : INK2);
      drawText(ui, String(x?.l ?? 0), col.l, ty, x?.l ? RED_INK : INK2);
      drawText(ui, pct(x), col.pct, ty, INK);
      drawText(ui, best(this.arcade[cls]), col.arc, ty, this.arcade[cls] ? INK : INK2);
    });
    // by mode, two to a line
    const my = top + 24 + PLAYABLE.length * rh + 8;
    MODES.forEach(([m, name], i) => {
      const x = tx + 12 + (i % 2) * (tw / 2 - 6), yy = my + Math.floor(i / 2) * 12;
      drawText(ui, name, x, yy, INK2);
      drawText(ui, wl(p.modes[m]), x + 52, yy, INK);
    });

    // REPLAYS and BACK
    const by = 282, bw = 120;
    ITEMS.forEach((it, i) => {
      const label = it === 'REPLAYS' ? `REPLAYS (${this.replays})` : '← BACK';
      button(ui, `pb:${i}`, label, UW / 2 - bw - 4 + i * (bw + 8), by, bw, 20, i === this.sel && showSel());
    });
    hint(ui, `CLICK OR ${k('attack')}: SELECT   ${k('cast')} / RIGHT-CLICK: BACK`);
  }
}
