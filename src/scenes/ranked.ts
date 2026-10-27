// Ranked: search for a rival near your rating, then the usual online flow (fighters, stage vote) for
// one best-of-3 set that moves both ratings. Shows your rating and the top of the ladder while you wait.
import { popScene, replaceScene, hint, button, hot, type Scene } from './scene';
import { getArena } from '../game/battleView';
import { drawStage } from '../art/arena';
import { getSprite, drawFighterSprite, teamColor, skinOf } from '../art/sprites';
import { UW, screenRect, spread, vy, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered, textWidth } from '../engine/font';
import { wasPressed, k, mouse } from '../engine/input';
import { touchText, type PadMode } from '../engine/touch';
import { sfx } from '../engine/audio';
import { loadMatch, playerDeck, type MatchConfig } from '../game/match';
import { NetSession } from '../net/session';
import { openTransport, pickTransport } from '../net/transport';
import { Search, searchGap } from '../net/matchmaking';
import { ratingStore, settlePending, startRanked, rankedForfeit, rankedOf, type LadderRow, type Rating, type RatingStore } from '../net/rating';
import { CharSelectScene } from './select';
import { win, banner, PAPER, INK, INK2, RED_INK, TRIM } from './skin';
import { actionBar, barTapped, panel, tallArea, GAP, PAD } from './touchUi';

type Mode = 'loading' | 'search' | 'found' | 'error';
/** A matched rival who never shows up on the room code: search again. */
const MEET_TIMEOUT = 15;

export class RankedScene implements Scene {
  m: MatchConfig = loadMatch();
  mode: Mode = 'loading';
  msg = '';
  store: RatingStore | null = null;
  rating: Rating | null = null;
  ladder: LadderRow[] = [];
  search: Search | null = null;
  net: NetSession | null = null;
  t = 0;
  private gone = false;

  enter(): void { void this.begin(); }

  tall(): boolean { return true; }
  pad(): PadMode { return spread.tall ? 'none' : 'back'; }

  private async begin(): Promise<void> {
    this.mode = 'loading';
    this.store = await ratingStore();
    this.rating = await settlePending(this.store);
    this.store.ladder(10).then(l => { this.ladder = l; }, () => {});
    if (this.gone) return;
    const s = await Search.start(this.rating.rating);
    if (this.gone) { s?.cancel(); return; }
    if (!s) { this.fail('RANKED IS NOT SUPPORTED YET HERE'); return; }
    this.search = s;
    this.mode = 'search';
    this.t = 0;
  }

  private fail(msg: string): void { this.mode = 'error'; this.msg = msg; sfx('deny'); }

  private async meet(): Promise<void> {
    const match = this.search!.match!;
    this.mode = 'found';
    this.t = 0;
    sfx('confirm');
    try {
      const kind = await pickTransport();
      const t = await openTransport(kind, match.role, match.code);
      if (this.gone || this.mode !== 'found') { t.close(); return; }
      const hello = { cls: this.m.p1, skin: skinOf(this.m.p1, this.m.p1Skin[this.m.p1]).id, deck: playerDeck(this.m) };
      this.net = new NetSession(match.role, match.code, hello, t, 3);
    } catch {
      this.retry();
    }
  }

  /** The pairing fell through: back in the queue. */
  private retry(): void {
    this.net?.leave();
    this.net = null;
    this.search?.cancel();
    this.search = null;
    void this.begin();
  }

  private leave(): void {
    this.gone = true;
    this.search?.cancel();
    this.net?.leave();
    sfx('back');
    popScene();
  }

  update(dt: number): void {
    this.t += dt;
    const back = wasPressed('back') || mouse.rclick || (mouse.click && (hot('btn') === 0 || barTapped('back')));
    if (this.mode === 'error') { if (back || (mouse.click && !spread.tall) || wasPressed('confirm')) this.leave(); return; }
    if (back) { this.leave(); return; }
    if (this.mode === 'search' && this.search) {
      this.search.tick();
      if (this.search.match) void this.meet();
      return;
    }
    if (this.mode === 'found') {
      const net = this.net;
      if (!net) { if (this.t > MEET_TIMEOUT) this.retry(); return; }
      net.tick();
      if (net.status === 'error' || net.status === 'left' || this.t > MEET_TIMEOUT && !net.matched) { this.retry(); return; }
      if (net.matched && this.rating) {
        startRanked(net, this.rating, this.search!.match!.rival.rating);
        watchForfeit(net);
        replaceScene(new CharSelectScene(net));
      }
    }
  }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    drawStage(c, getArena(), tick);
    c.fillStyle = 'rgba(40,20,0,0.35)';
    c.fillRect(...screenRect());
    if (spread.tall) { this.drawTall(ui, tick); return; }
    banner(ui, 'RANKED MATCH', UW / 2, vy(3));
    const dy = vy(36) - 36, db = vy(176) - 176;

    // you: fighter, rating, record
    const skin = skinOf(this.m.p1, this.m.p1Skin[this.m.p1]).id;
    const bob = Math.floor(tick / 4) % 2;
    win(ui, 16, 36 + dy, 104, 124, { accent: teamColor(this.m.p1, skin, false) });
    drawTextCentered(ui, 'YOU', 68, 46 + dy, RED_INK, 1, false);
    drawFighterSprite(ui, getSprite(this.m.p1, skin, false), 68, 124 + dy - bob * 2, false, 'none', 3);
    const r = this.rating;
    drawTextCentered(ui, r ? String(r.rating) : '...', 68, 132 + dy, INK, 1, false);
    drawTextCentered(ui, r ? `${r.wins}W ${r.losses}L` : '', 68, 144 + dy, INK2, 1, false);

    // status
    const x = 132, w = UW - 148, cx = x + w / 2;
    win(ui, x, 36 + dy, w, 124);
    if (this.mode === 'loading') drawTextCentered(ui, 'LOADING YOUR RATING...', cx, 90 + dy, INK, 1, false);
    if (this.mode === 'error') {
      drawTextCentered(ui, this.msg, cx, 76 + dy, RED_INK, 1, false);
      drawTextCentered(ui, touchText('CLICK TO GO BACK'), cx, 112 + dy, TRIM, 1, false);
    }
    if (this.mode === 'search' && this.search) {
      const s = Math.floor(this.search.waited / 1000);
      drawTextCentered(ui, tick % 8 < 6 ? 'SEARCHING FOR A RIVAL' : '', cx, 52 + dy, RED_INK, 2, false);
      drawTextCentered(ui, `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, cx, 76 + dy, INK, 2, false);
      const gap = Math.round(searchGap(this.search.waited));
      drawTextCentered(ui, `RATINGS ${Math.max(0, (r?.rating ?? 0) - gap)} TO ${(r?.rating ?? 0) + gap}`, cx, 98 + dy, INK2, 1, false);
      const n = this.search.searching;
      drawTextCentered(ui, n ? `${n} OTHER${n > 1 ? 'S' : ''} SEARCHING` : 'NOBODY ELSE IS SEARCHING YET', cx, 110 + dy, INK2, 1, false);
    }
    if (this.mode === 'found') {
      const rival = this.search?.match?.rival;
      drawTextCentered(ui, 'RIVAL FOUND!', cx, 56 + dy, '#007800', 2, false);
      drawTextCentered(ui, rival ? `RATING ${rival.rating}` : '', cx, 80 + dy, INK, 1, false);
      drawTextCentered(ui, tick % 8 < 6 ? 'CONNECTING...' : '', cx, 98 + dy, INK2, 1, false);
    }
    if (this.mode !== 'error') button(ui, 'btn:0', 'CANCEL', cx - 50, 132 + dy, 100, 20, false, INK2);

    // the ladder
    win(ui, 16, 176 + db, UW - 32, 112);
    drawText(ui, this.store?.kind === 'local' ? 'LADDER (THIS BROWSER ONLY)' : 'LADDER', 26, 184 + db, RED_INK);
    drawText(ui, 'BEST OF 3. LEAVING EARLY COUNTS AS A LOSS.', UW - 26 - textWidth('BEST OF 3. LEAVING EARLY COUNTS AS A LOSS.'), 184 + db, TRIM);
    if (!this.ladder.length) drawText(ui, 'NO RANKED SETS PLAYED YET.', 26, 200 + db, INK2);
    this.ladder.slice(0, 10).forEach((row, i) => {
      const col = i < 5 ? 0 : 1, y = 198 + db + (i % 5) * 16, lx = 26 + col * ((UW - 52) / 2);
      const name = row.name.toUpperCase().slice(0, 16);
      drawText(ui, `${i + 1}. ${name}`, lx, y, row.you ? RED_INK : INK);
      const rec = `${row.rating}  ${row.wins}-${row.losses}`;
      drawText(ui, rec, lx + (UW - 52) / 2 - 12 - textWidth(rec), y, row.you ? RED_INK : INK2);
    });
    hint(ui, `${k('cast')} / RIGHT-CLICK: BACK`);
  }

  /** The phone layout: you and your rating, the search, then the ladder, with CANCEL in the bar. */
  private drawTall(ui: Ctx, tick: number): void {
    const a = tallArea(), x0 = a.x + PAD, w = a.w - PAD * 2, cx = UW / 2;
    let y = a.y + PAD;
    drawTextCentered(ui, 'RANKED MATCH', cx, y, PAPER, 3, true);
    y += 21 + GAP * 2;
    const barTop = actionBar(ui, { back: this.mode === 'error' ? undefined : 'CANCEL' });

    // you: fighter, rating, record
    const skin = skinOf(this.m.p1, this.m.p1Skin[this.m.p1]).id;
    const bob = Math.floor(tick / 4) % 2, r = this.rating;
    panel(ui, x0 - 6, y, w + 12, 120);
    drawFighterSprite(ui, getSprite(this.m.p1, skin, false), x0 + 56, y + 108 - bob * 2, false, 'none', 4);
    drawText(ui, 'YOUR RATING', x0 + 120, y + 18, RED_INK, 2);
    drawText(ui, r ? String(r.rating) : '...', x0 + 120, y + 42, INK, 4);
    drawText(ui, r ? `${r.wins} WON  ${r.losses} LOST` : '', x0 + 120, y + 82, INK2, 2);
    y += 120 + GAP * 2;

    // the search
    const sh = 150;
    panel(ui, x0 - 6, y, w + 12, sh);
    if (this.mode === 'loading') drawTextCentered(ui, 'LOADING YOUR RATING...', cx, y + sh / 2 - 7, INK, 2, false);
    if (this.mode === 'error') {
      drawTextCentered(ui, this.msg, cx, y + 50, RED_INK, textWidth(this.msg, 2) < w - 24 ? 2 : 1, false);
      drawTextCentered(ui, 'TAP BACK TO LEAVE', cx, y + 86, TRIM, 2, false);
    }
    if (this.mode === 'search' && this.search) {
      const s = Math.floor(this.search.waited / 1000);
      drawTextCentered(ui, tick % 8 < 6 ? 'SEARCHING FOR A RIVAL' : '', cx, y + 16, RED_INK, 2, false);
      drawTextCentered(ui, `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, cx, y + 42, INK, 4, false);
      const gap = Math.round(searchGap(this.search.waited));
      drawTextCentered(ui, `RATINGS ${Math.max(0, (r?.rating ?? 0) - gap)} TO ${(r?.rating ?? 0) + gap}`, cx, y + 88, INK2, 2, false);
      const n = this.search.searching;
      drawTextCentered(ui, n ? `${n} OTHER${n > 1 ? 'S' : ''} SEARCHING` : 'NOBODY ELSE IS SEARCHING YET', cx, y + 112, INK2, 2, false);
    }
    if (this.mode === 'found') {
      const rival = this.search?.match?.rival;
      drawTextCentered(ui, 'RIVAL FOUND!', cx, y + 24, '#007800', 3, false);
      drawTextCentered(ui, rival ? `RATING ${rival.rating}` : '', cx, y + 66, INK, 2, false);
      drawTextCentered(ui, tick % 8 < 6 ? 'CONNECTING...' : '', cx, y + 98, INK2, 2, false);
    }
    y += sh + GAP * 2;

    // the ladder, in big type when there's room for all ten
    const lh = barTop - GAP * 2 - y;
    if (lh < 80) return;
    panel(ui, x0 - 6, y, w + 12, lh);
    drawText(ui, this.store?.kind === 'local' ? 'LADDER (THIS PHONE)' : 'LADDER', x0 + 8, y + 14, RED_INK, 2);
    drawTextCentered(ui, 'EVERY SET IS BEST OF 3.', cx, y + lh - 46, TRIM, 2, false);
    drawTextCentered(ui, 'LEAVING EARLY COUNTS AS A LOSS.', cx, y + lh - 26, TRIM, 2, false);
    const rows = this.ladder.slice(0, 10), room = lh - 100;
    const big = rows.length * 24 <= room, rh = big ? 24 : 14, s = big ? 2 : 1;
    if (!rows.length) drawText(ui, 'NO RANKED SETS PLAYED YET.', x0 + 8, y + 44, INK2, 2);
    rows.slice(0, Math.floor(room / rh)).forEach((row, i) => {
      const ry = y + 42 + i * rh;
      drawText(ui, `${i + 1}. ${row.name.toUpperCase().slice(0, 14)}`, x0 + 8, ry, row.you ? RED_INK : INK, s);
      const rec = `${row.rating}  ${row.wins}-${row.losses}`;
      drawText(ui, rec, x0 + w - 8 - textWidth(rec, s), ry, row.you ? RED_INK : INK2, s);
    });
  }
}

/** The rival quitting a ranked set early hands you the win. */
function watchForfeit(net: NetSession): void {
  const id = window.setInterval(() => {
    const r = rankedOf(net);
    if (!r || r.delta !== null || net.status === 'error' || net.status === 'lost') { window.clearInterval(id); return; }
    if (net.status === 'left' && net.remote?.bye) { window.clearInterval(id); void rankedForfeit(net); }
  }, 500);
}
