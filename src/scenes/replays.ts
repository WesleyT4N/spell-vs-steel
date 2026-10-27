// Replays: the list of saved matches (title > REPLAYS), and the player that watches one. Playback
// runs the recorded controls through a fresh battle and skips the Draw screens, Battle Network style.
import { pushScene, popScene, replaceScene, popTo, hint, zone, hot, isHot, listMouse, showSel, resetSel, type Scene } from './scene';
import { actionBar, barTapped, panel, rowList, swipeIn, tallArea, Scroller, GAP, PAD } from './touchUi';
import { BattleScene } from './battle';
import { getArena, useStage } from '../game/battleView';
import { drawStage } from '../art/arena';
import { getSprite, drawFighterSprite, teamColor, defaultSkin } from '../art/sprites';
import { CLASS_INFO } from '../game/classes';
import { loadMatch, type MatchConfig } from '../game/match';
import { heavyChargeOf } from '../game/battle';
import { roundRecord, type RoundRecord } from '../game/stats';
import { loadReplays, toggleKeep, replayScore, replayClasses, TapePlayer, RULES_VERSION, type Replay, type ReplayMode } from '../game/replay';
import { P, UW, screenRect, spread, vy, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered, drawTextOutlined, textWidth } from '../engine/font';
import { wasPressed, navPressed, k, mouse } from '../engine/input';
import { touchText, touchActive, type PadMode } from '../engine/touch';
import { sfx, playMusic, stopMusic, chargeHum } from '../engine/audio';
import { win, selRow, banner, PAPER, BURN, INK, INK2, RED_INK, TRIM } from './skin';

const MODE_NAME: Record<ReplayMode, string> = { cpu: 'VS CPU', arcade: 'ARCADE', versus: '2 PLAYERS', watch: 'CPU VS CPU', online: 'ONLINE', ranked: 'RANKED' };
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const when = (at: number): string => {
  const d = new Date(at), p = (n: number): string => String(n).padStart(2, '0');
  return `${MONTHS[d.getMonth()]} ${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const secs = (n: number): string => { const s = Math.round(n / 60); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

const LX = 16, LW = UW - 32, LY = 38, RH = 16, SHOWN = 8;
/** Phones in portrait: height of a replay row, and of the selected replay's panel above the action bar. */
const TROW = 66;

/** "2-1 WON" from the recording player's side (just the score when nobody's side), and its ink. */
function result(r: Replay): [string, string] {
  const s = replayScore(r);
  if (r.me === null) return [`${s[0]}-${s[1]}`, INK];
  const mine = s[r.me], theirs = s[1 - r.me];
  return [`${mine}-${theirs} ${mine > theirs ? 'WON' : mine < theirs ? 'LOST' : 'EVEN'}`, mine > theirs ? '#007800' : mine < theirs ? RED_INK : INK];
}

/** Saved replays, newest first. Every finished round of a real match is saved as it ends. */
export class ReplaysScene implements Scene {
  list: Replay[] = loadReplays();
  sel = 0;
  top = 0;
  msg = '';
  msgT = 0;
  // phones in portrait: a scrolling list of big rows (tap one to pick it, again to watch), its details below
  private tscroll = new Scroller();
  private tlist: [number, number, number, number] = [0, 0, 0, 0];
  private tdetail: [number, number, number, number] = [0, 0, 0, 0];

  constructor(select?: string) {
    const i = this.list.findIndex(r => r.id === select);
    if (i >= 0) this.sel = i;
    this.scroll();
  }

  private scroll(): void {
    if (this.sel < this.top) this.top = this.sel;
    if (this.sel >= this.top + SHOWN) this.top = this.sel - SHOWN + 1;
  }

  private watch(r: Replay): void { sfx('confirm'); pushScene(new ReplayScene(r)); }

  tall(): boolean { return true; }
  pad(): PadMode { return spread.tall ? 'none' : 'back'; }

  /** Taps and swipes on the phone layout; true when one was handled. */
  private tallInput(): boolean {
    if (mouse.click && barTapped('back')) { sfx('back'); popScene(); return true; }
    const n = this.list.length;
    if (!n) return false;
    const r = this.list[this.sel];
    if (mouse.click && barTapped('primary')) { this.watch(r); return true; }
    if (mouse.click && barTapped('mid')) { this.keep(r); return true; }
    // swiping the details steps through the replays
    const sw = swipeIn(...this.tdetail);
    if (sw) { this.sel = (this.sel + sw + n) % n; this.tscroll.reveal(this.sel * (TROW + 6), TROW + 8, this.tlist[3]); sfx('move'); return true; }
    this.tscroll.update(...this.tlist);
    const i = hot('trow');
    if (mouse.click && i >= 0) {
      if (i === this.sel) this.watch(r);
      else { this.sel = i; sfx('move'); }
      return true;
    }
    return false;
  }

  private keep(r: Replay): void {
    if (!toggleKeep(r.id)) { this.msg = 'KEPT LIST IS FULL (20)'; this.msgT = 2; sfx('deny'); return; }
    this.list = loadReplays();
    this.sel = Math.max(0, this.list.findIndex(x => x.id === r.id));
    this.scroll();
    sfx('select');
  }

  update(dt: number): void {
    this.msgT = Math.max(0, this.msgT - dt);
    if (spread.tall && this.tallInput()) return;
    if (wasPressed('back') || mouse.rclick) { sfx('back'); popScene(); return; }
    const n = this.list.length;
    if (!n) { if ((mouse.click && !spread.tall) || wasPressed('confirm')) { sfx('back'); popScene(); } return; }
    if (mouse.wheel) { this.top = Math.max(0, Math.min(n - SHOWN, this.top + Math.sign(mouse.wheel))); }
    if (mouse.click && hot('keep') >= 0) { this.keep(this.list[hot('keep')]); return; }
    const clicked = listMouse('row', this.sel, i => { this.sel = i; sfx('move'); });
    if (clicked >= 0) { this.sel = clicked; this.watch(this.list[clicked]); return; }
    if (navPressed('up', dt)) { this.sel = (this.sel + n - 1) % n; this.scroll(); sfx('move'); }
    if (navPressed('down', dt)) { this.sel = (this.sel + 1) % n; this.scroll(); sfx('move'); }
    if (wasPressed('custom')) this.keep(this.list[this.sel]);
    else if (wasPressed('confirm')) this.watch(this.list[this.sel]);
  }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    drawStage(c, getArena(), tick);
    c.fillStyle = 'rgba(40,20,0,0.35)';
    c.fillRect(...screenRect());
    if (spread.tall) { this.drawTall(ui, tick); return; }
    banner(ui, 'REPLAYS', UW / 2, vy(3));
    const dy = vy(LY) - LY, db = vy(214) - 214;
    win(ui, LX, LY - 6 + dy, LW, SHOWN * RH + 12);
    if (!this.list.length) {
      drawTextCentered(ui, 'NO REPLAYS YET', UW / 2, LY + 40 + dy, RED_INK, 2, false);
      drawTextCentered(ui, 'EVERY MATCH YOU PLAY IS SAVED HERE AS IT ENDS.', UW / 2, LY + 70 + dy, INK2, 1, false);
      hint(ui, touchText(`CLICK OR ${k('attack')}: BACK`));
      return;
    }
    for (let j = 0; j < SHOWN; j++) {
      const i = this.top + j, r = this.list[i];
      if (!r) break;
      const y = LY + j * RH + dy, ty = y + 4;
      const on = i === this.sel && showSel();
      zone(`row:${i}`, LX + 4, y, LW - 34, RH - 1);
      if (on) selRow(ui, LX + 4, y, LW - 8, RH - 1);
      if (on && tick % 8 < 6) drawText(ui, '→', LX + 8, ty, PAPER);
      const [a, b] = replayClasses(r), [res, col] = result(r);
      drawText(ui, when(r.at), LX + 20, ty, on ? INK : INK2);
      drawText(ui, MODE_NAME[r.mode] ?? '', LX + 104, ty, on ? INK : INK2);
      drawText(ui, `${CLASS_INFO[a].name.toUpperCase()} VS ${CLASS_INFO[b].name.toUpperCase()}`, LX + 176, ty, INK);
      drawText(ui, res, LX + 330, ty, col);
      // keep toggle
      const kx = LX + LW - 28;
      zone(`keep:${i}`, kx - 2, y, 22, RH - 1);
      drawText(ui, '*', kx + 4, ty, r.keep ? RED_INK : hot('keep') === i ? INK2 : BURN);
    }
    if (this.top > 0) drawTextCentered(ui, '↑', UW - 22, LY - 4 + dy, INK2, 1, false);
    if (this.top + SHOWN < this.list.length) drawTextCentered(ui, '↓', UW - 22, LY + SHOWN * RH - 4 + dy, INK2, 1, false);

    // the selected replay: both fighters and each round
    const r = this.list[this.sel];
    win(ui, LX, 184 + db, LW, 104);
    const [a, b] = r.rounds[0].specs;
    const bob = Math.floor(tick / 4) % 2;
    drawFighterSprite(ui, getSprite(a.cls, a.skin ?? defaultSkin(a.cls), false), LX + 40, 268 + db - bob * 2, false, 'none', 3);
    drawFighterSprite(ui, getSprite(b.cls, b.skin ?? defaultSkin(b.cls), false), LX + LW - 40, 268 + db - bob * 2, true, 'none', 3);
    P(ui, teamColor(a.cls, a.skin ?? defaultSkin(a.cls), false), LX + 14, 196 + db, 7, 7);
    drawText(ui, a.name, LX + 24, 196 + db, INK);
    drawText(ui, b.name, LX + LW - 24 - textWidth(b.name), 196 + db, INK);
    P(ui, teamColor(b.cls, b.skin ?? defaultSkin(b.cls), false), LX + LW - 21, 196 + db, 7, 7);
    const mx = UW / 2;
    drawTextCentered(ui, r.bestOf === 1 ? 'SINGLE ROUND' : `BEST OF ${r.bestOf}`, mx, 194 + db, RED_INK, 1, false);
    r.rounds.slice(0, 5).forEach((t, i) => {
      const who = t.winner === null ? 'DRAW' : `${t.specs[t.winner].name} WON`;
      drawTextCentered(ui, `ROUND ${i + 1}  ${who}  ${secs(t.n)}`, mx, 210 + db + i * 11, INK2, 1, false);
    });
    if (r.v !== RULES_VERSION) drawTextCentered(ui, 'OLDER BUILD: MAY NOT PLAY BACK THE SAME', mx, 270 + db, TRIM, 1, false);
    if (this.msgT > 0) drawTextCentered(ui, this.msg, mx, 270 + db, RED_INK, 1, false);
    hint(ui, `CLICK OR ${k('attack')}: WATCH   ${k('custom')} / *: KEEP   ${k('cast')} / RIGHT-CLICK: BACK`);
  }

  /** The phone layout: big replay rows, the picked one's fighters and rounds, WATCH and KEEP in the bar. */
  private drawTall(ui: Ctx, tick: number): void {
    const a = tallArea(), x0 = a.x + PAD, w = a.w - PAD * 2, cx = UW / 2;
    let y = a.y + PAD;
    drawTextCentered(ui, 'REPLAYS', cx, y, PAPER, 3, true);
    y += 21 + GAP * 2;
    const r = this.list[this.sel];
    const barTop = actionBar(ui, r ? {
      primary: { id: 'watch', label: 'WATCH →' },
      mid: { id: 'keep', label: r.keep ? 'KEPT *' : 'KEEP', on: !!r.keep },
    } : {});
    if (!r) {
      panel(ui, x0 - 6, y, w + 12, 150);
      drawTextCentered(ui, 'NO REPLAYS YET', cx, y + 40, RED_INK, 3, false);
      drawTextCentered(ui, 'EVERY MATCH YOU PLAY IS', cx, y + 84, INK2, 2, false);
      drawTextCentered(ui, 'SAVED HERE AS IT ENDS.', cx, y + 104, INK2, 2, false);
      return;
    }

    // the list
    const shownRounds = Math.min(5, r.rounds.length), detailH = 150 + shownRounds * 20;
    const dTop = barTop - GAP * 2 - detailH, lh = dTop - GAP * 3 - y;
    this.tlist = [x0, y, w, lh];
    rowList(ui, this.tscroll, 'trow', this.list.length, this.sel, x0, y, w, lh, TROW, (i, rx, ry, rw) => {
      const it = this.list[i], [ca, cb] = replayClasses(it), [res, col] = result(it);
      drawText(ui, `${CLASS_INFO[ca].name.toUpperCase()} VS ${CLASS_INFO[cb].name.toUpperCase()}`, rx + 14, ry + 14, INK, 2);
      drawText(ui, res, rx + rw - 14 - textWidth(res, 2), ry + 14, col, 2);
      drawText(ui, `${when(it.at)}  ${MODE_NAME[it.mode] ?? ''}`, rx + 14, ry + 38, INK2, 2);
      if (it.keep) drawText(ui, 'KEPT', rx + rw - 14 - textWidth('KEPT', 2), ry + 38, RED_INK, 2);
    });

    // the picked replay: both fighters and each round
    this.tdetail = [a.x, dTop, a.w, detailH];
    panel(ui, x0 - 6, dTop, w + 12, detailH);
    const [fa, fb] = r.rounds[0].specs;
    const bob = Math.floor(tick / 4) % 2, foot = dTop + 92;
    drawFighterSprite(ui, getSprite(fa.cls, fa.skin ?? defaultSkin(fa.cls), false), x0 + 50, foot - bob * 2, false, 'none', 3);
    drawFighterSprite(ui, getSprite(fb.cls, fb.skin ?? defaultSkin(fb.cls), false), x0 + w - 50, foot - bob * 2, true, 'none', 3);
    drawTextCentered(ui, fa.name.slice(0, 8), x0 + 50, foot + 8, INK, 2, false);
    drawTextCentered(ui, fb.name.slice(0, 8), x0 + w - 50, foot + 8, INK, 2, false);
    drawTextCentered(ui, MODE_NAME[r.mode] ?? '', cx, dTop + 30, RED_INK, 2, false);
    drawTextCentered(ui, r.bestOf === 1 ? 'SINGLE ROUND' : `BEST OF ${r.bestOf}`, cx, dTop + 54, INK2, 2, false);
    r.rounds.slice(0, shownRounds).forEach((t, i) => {
      const who = t.winner === null ? 'DRAW' : `${t.specs[t.winner].name.slice(0, 10)} WON`;
      drawTextCentered(ui, `ROUND ${i + 1}  ${who}  ${secs(t.n)}`, cx, dTop + 122 + i * 20, INK, 2, false);
    });
    const note = this.msgT > 0 ? this.msg : r.v !== RULES_VERSION ? 'OLDER BUILD: MAY NOT PLAY BACK THE SAME' : 'SWIPE HERE FOR THE NEXT ONE';
    drawTextCentered(ui, note, cx, dTop + detailH - 20, this.msgT > 0 ? RED_INK : TRIM, 1, false);
  }
}

const SPEEDS = [1, 2, 4] as const;

/** Watches one replay, a round at a time. Draw screens are skipped: the fight plays straight through. */
export class ReplayScene extends BattleScene {
  private player: TapePlayer;
  private speed = 0;
  private halt = false;
  /** The round ended differently from the recording (a rules change since). */
  private stale = false;

  constructor(readonly replay: Replay, readonly roundNo = 0, score: [number, number] = [0, 0], rounds: RoundRecord[] = []) {
    const tape = replay.rounds[roundNo];
    const player = new TapePlayer(tape);
    const [a, b] = tape.specs;
    const saved = loadMatch();
    const m: MatchConfig = {
      ...saved, p1: a.cls, cpu: b.cls, p1Deck: 'starter', cpuDeck: 'starter', bestOf: replay.bestOf, sides: ['cpu', 'cpu'],
      p1Skin: { ...saved.p1Skin, [a.cls]: a.skin ?? defaultSkin(a.cls) }, cpuSkin: { ...saved.cpuSkin, [b.cls]: b.skin ?? defaultSkin(b.cls) },
    };
    super(m, score, player.b, rounds, ['cpu', 'cpu']);
    this.player = player;
  }

  protected get keepsReplays(): boolean { return false; }
  protected rivalDeckText(): string { return ''; }

  enter(): void {
    useStage(this.replay.stage);
    super.enter();
  }

  private get last(): boolean { return this.roundNo + 1 >= this.replay.rounds.length; }
  protected get resultItems(): string[] { return this.last ? ['WATCH AGAIN', 'REPLAYS'] : ['NEXT ROUND', 'WATCH AGAIN', 'REPLAYS']; }

  update(dt: number): void {
    const b = this.b;
    this.callouts();
    this.fightBanner = Math.max(0, this.fightBanner - dt);
    if (b.phase === 'over') { this.updateResult(dt); return; }
    if (wasPressed('back') || mouse.rclick) { this.exit(); return; }
    // a tap pauses; a tap on the speed label up top changes speed
    const onSpeed = mouse.click && isHot('rspeed');
    if (wasPressed('custom') || wasPressed('pause') || (mouse.click && !onSpeed)) { this.halt = !this.halt; sfx('select'); }
    if (wasPressed('confirm') || onSpeed) { this.speed = (this.speed + 1) % SPEEDS.length; sfx('move'); }
    if (this.halt) { for (const f of b.f) chargeHum(f.side, null); return; }

    const first = b.turn === 1 && b.phase === 'custom';
    for (let n = SPEEDS[this.speed]; n > 0; n--) {
      this.player.skipDraw();
      if (!this.player.step()) break;
      this.player.skipDraw();
      if ((b.phase as string) === 'over') break;
    }
    if (first && b.phase === 'fight') this.fightBanner = 0.9;
    for (const f of b.f) chargeHum(f.side, b.phase === 'fight' && f.charging && f.charge > 0.15 ? Math.min(1, f.charge / heavyChargeOf(f)) : null);
    if (this.player.done && (b.phase as string) !== 'over') b.phase = 'over'; // a tape that stops early (should not happen)
    if ((b.phase as string) === 'over' && !this.ended) {
      this.ended = true;
      this.stale = !this.player.matches;
      resetSel();
      if (b.winner !== null) this.score[b.winner]++;
      this.rounds.push(roundRecord(b, this.stats));
      stopMusic();
      sfx('win');
      playMusic('victory');
    }
  }

  protected updateResult(dt: number): void {
    this.statsPanel.update(this.statsData());
    const items = this.resultItems;
    const clicked = listMouse('menu', this.resultSel, i => { this.resultSel = i; sfx('move'); });
    if (clicked >= 0) this.resultSel = clicked;
    if (navPressed('up', dt)) { this.resultSel = (this.resultSel + items.length - 1) % items.length; sfx('move'); }
    if (navPressed('down', dt)) { this.resultSel = (this.resultSel + 1) % items.length; sfx('move'); }
    if (wasPressed('back') || mouse.rclick) { this.exit(); return; }
    if (wasPressed('confirm') || wasPressed('custom') || clicked >= 0) {
      sfx('select');
      stopMusic();
      const choice = items[this.resultSel];
      if (choice === 'NEXT ROUND') replaceScene(new ReplayScene(this.replay, this.roundNo + 1, this.score, this.rounds));
      if (choice === 'WATCH AGAIN') replaceScene(new ReplayScene(this.replay));
      if (choice === 'REPLAYS') this.exit();
    }
  }

  private exit(): void {
    for (const f of this.b.f) chargeHum(f.side, null);
    stopMusic();
    sfx('back');
    // back to the list, still on this replay
    popTo(s => s instanceof ReplaysScene, () => new ReplaysScene(this.replay.id));
  }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    super.draw(c, tick, ui);
    const b = this.b;
    if (b.phase === 'over') {
      if (this.stale) drawTextCentered(ui, 'THIS ROUND PLAYED OUT DIFFERENTLY: IT WAS RECORDED ON AN OLDER BUILD', UW / 2, 290, '#f8b800', 1);
      return;
    }
    // under the round counter (where online play shows the ping), and the keys in the bottom right
    const label = this.halt ? (tick % 30 < 20 ? 'REPLAY  PAUSED' : 'REPLAY') : `REPLAY  ${SPEEDS[this.speed]}X`;
    drawTextOutlined(ui, label, Math.round(UW / 2 - textWidth(label) / 2), 48, this.halt ? '#f8b800' : '#fcfcfc');
    zone('rspeed', UW / 2 - 60, 40, 120, 24);
    const help = touchActive() ? 'TAP: PAUSE   TAP REPLAY: SPEED' : `${k('attack')}: SPEED   ${k('custom')} / CLICK: PAUSE   ${k('cast')}: EXIT`;
    drawTextOutlined(ui, help, UW - 8 - textWidth(help), 302, '#bcbcbc');
  }
}
