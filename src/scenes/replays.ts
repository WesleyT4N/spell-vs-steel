// Replays: the list of saved matches (title > PROFILE > REPLAYS), and the player that watches one. Playback
// runs the recorded controls through a fresh battle and skips the Draw screens, Battle Network style.
import { pushScene, popScene, replaceScene, popTo, hint, zone, hot, isHot, listMouse, showSel, resetSel, button, type Scene } from './scene';
import { BattleScene } from './battle';
import { getArena, useStage } from '../game/battleView';
import { drawStage } from '../art/arena';
import { getSprite, drawFighterSprite, teamColor, defaultSkin } from '../art/sprites';
import { CLASS_INFO } from '../game/classes';
import { loadMatch, type MatchConfig } from '../game/match';
import { heavyChargeOf } from '../game/battle';
import { roundRecord, type RoundRecord } from '../game/stats';
import { loadReplays, toggleKeep, replayScore, replayClasses, TapePlayer, RULES_VERSION, type Replay, type ReplayMode } from '../game/replay';
import { P, UW, screenRect, type Ctx } from '../engine/gfx';
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
  pad(): PadMode { return 'back'; }

  private keep(r: Replay): void {
    if (!toggleKeep(r.id)) { this.msg = 'KEPT LIST IS FULL (20)'; this.msgT = 2; sfx('deny'); return; }
    this.list = loadReplays();
    this.sel = Math.max(0, this.list.findIndex(x => x.id === r.id));
    this.scroll();
    sfx('select');
  }

  update(dt: number): void {
    this.msgT = Math.max(0, this.msgT - dt);
    
    if (wasPressed('back') || mouse.rclick) { sfx('back'); popScene(); return; }
    const n = this.list.length;
    if (!n) { if ((mouse.click) || wasPressed('confirm')) { sfx('back'); popScene(); } return; }
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
    
    banner(ui, 'REPLAYS', UW / 2, 3);
    const dy = LY - LY, db = 214 - 214;
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
}

/** Playback speeds: slow motion, normal, fast forward. */
const SPEEDS = [0.25, 0.5, 1, 2, 4] as const;
const NORMAL = 2;
const speedName = (s: number): string => (s === 0.25 ? '1/4X' : s === 0.5 ? '1/2X' : `${s}X`);
/** The playback controls, by zone id: on every layout, so mouse and fingers get what keys and pads do. */
type Ctl = 'slow' | 'play' | 'fast' | 'step';
const CTLS: Ctl[] = ['slow', 'play', 'fast', 'step'];

/**
 * Watches one replay, a round at a time. Draw screens are skipped: the fight plays straight through.
 * Slow motion, pausing and frame steps only change how many recorded updates run per frame, so the
 * battle still plays back exactly as recorded.
 */
export class ReplayScene extends BattleScene {
  private player: TapePlayer;
  private speed = NORMAL;
  /** Recorded updates owed at the current speed (slow motion runs one every few frames). */
  private owed = 0;
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

  // phones in portrait: the controls fill the space under the fight, EXIT among them
  pad(): PadMode { return super.pad(); }

  private get last(): boolean { return this.roundNo + 1 >= this.replay.rounds.length; }
  protected get resultItems(): string[] { return this.last ? ['WATCH AGAIN', 'REPLAYS'] : ['NEXT ROUND', 'WATCH AGAIN', 'REPLAYS']; }

  /** The control tapped or clicked this frame, if any. */
  private tapped(): Ctl | 'exit' | null {
    if (!mouse.click) return null;
    if (isHot('bar:back')) return 'exit';
    return CTLS.find(c => isHot(`rc:${c}`)) ?? null;
  }

  /** One recorded update, with any Draw screen around it fast-forwarded. False once the tape is done. */
  private runOne(): boolean {
    this.player.skipDraw();
    const ok = this.player.step();
    this.player.skipDraw();
    return ok;
  }

  update(dt: number): void {
    const b = this.b;
    this.callouts();
    this.fightBanner = Math.max(0, this.fightBanner - dt);
    if (b.phase === 'over') { this.updateResult(dt); return; }
    const tap = this.tapped();
    if (wasPressed('back') || mouse.rclick || tap === 'exit') { this.exit(); return; }
    // ←/→ change speed, the Draw button plays and pauses, attack steps one frame; a tap anywhere else pauses
    const slower = navPressed('left', dt) || tap === 'slow', faster = navPressed('right', dt) || tap === 'fast';
    const step = wasPressed('confirm') || tap === 'step';
    if (slower || faster) {
      const to = Math.max(0, Math.min(SPEEDS.length - 1, this.speed + (faster ? 1 : -1)));
      if (to !== this.speed) { this.speed = to; this.owed = 0; sfx('move'); }
      if (this.halt) { this.halt = false; sfx('select'); }
    }
    if (wasPressed('custom') || wasPressed('pause') || tap === 'play' || (mouse.click && !tap)) { this.halt = !this.halt; sfx('select'); }
    if (step) { this.halt = true; this.owed = 0; }

    const first = b.turn === 1 && b.phase === 'custom';
    if (step) this.runOne();
    else if (!this.halt) {
      this.owed += SPEEDS[this.speed];
      for (; this.owed >= 1; this.owed--) if (!this.runOne() || (b.phase as string) === 'over') { this.owed = 0; break; }
    }
    if (first && b.phase === 'fight') this.fightBanner = 0.9;
    const humming = !this.halt && b.phase === 'fight';
    for (const f of b.f) chargeHum(f.side, humming && f.charging && f.charge > 0.15 ? Math.min(1, f.charge / heavyChargeOf(f)) : null);
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
    // under the round counter (where online play shows the ping)
    const label = this.halt ? (tick % 30 < 20 ? 'REPLAY  PAUSED' : 'REPLAY') : `REPLAY  ${speedName(SPEEDS[this.speed])}`;
    drawTextOutlined(ui, label, Math.round(UW / 2 - textWidth(label) / 2), 48, this.halt ? '#f8b800' : '#fcfcfc');
    
    // the controls under the label, clear of the grid, and their keys in the bottom right
    const bw = 36, bh = 18, gap = 4, x0 = Math.round(UW / 2 - (CTLS.length * (bw + gap) - gap) / 2), y = 58;
    CTLS.forEach((c, i) => button(ui, `rc:${c}`, this.ctlLabel(c), x0 + i * (bw + gap), y, bw, bh, c === 'play' && this.halt));
    if (!touchActive()) {
      const help = `${k('left')}/${k('right')}: SPEED   ${k('custom')}: PAUSE   ${k('attack')}: STEP   ${k('cast')}: EXIT`;
      drawTextOutlined(ui, help, UW - 8 - textWidth(help), 304, '#bcbcbc');
    }
  }

  private ctlLabel(c: Ctl): string {
    return c === 'slow' ? '<<' : c === 'fast' ? '>>' : c === 'step' ? '+1' : this.halt ? 'PLAY' : 'II';
  }
}
