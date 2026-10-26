// An online round: the Versus scene, driven by rollback netcode (src/net/rollback.ts) instead of a CPU.
import { setScene, dim, hint, resetSel } from './scene';
import { BattleScene } from './battle';
import { TitleScene } from './title';
import { Battle, heavyChargeOf, type Side } from '../game/battle';
import { loadMatch } from '../game/match';
import { Rollback, MAX_ROLLBACK } from '../net/rollback';
import { statsRollbackRoots } from '../game/stats';
import { NO_INPUT, type NetInput } from '../net/protocol';
import type { NetSession } from '../net/session';
import { roundRecord, type RoundRecord } from '../game/stats';
import { UW, type Ctx } from '../engine/gfx';
import { drawTextCentered, drawTextOutlined, textWidth } from '../engine/font';
import { wasPressed, navPressed, mouse, k } from '../engine/input';
import { playMusic, stopMusic, sfx, chargeHum } from '../engine/audio';
import { RESULT_SONG } from '../engine/music';
import { listMouse } from './scene';
import { win, RED_INK } from './skin';

/** Seed for round `r` of a match, the same on both machines. */
const roundSeed = (seed: number, r: number): number => (seed + Math.imul(r, 0x9e3779b9)) >>> 0;

export class OnlineBattleScene extends BattleScene {
  rb: Rollback;
  /** Presses seen since the last scheduled input, merged into the next one. */
  private pend: NetInput | null = null;
  /** Frames in a row spent waiting because we got too far ahead of the other side. */
  stall = 0;
  /** Smoothed frames we run ahead of the other side's clock (positive: we are ahead). */
  private lead = 0;
  private tickN = 0;
  /** Longest correction in about the last second, for the connection readout. */
  private shownRollback = 0;
  private shownRollbackT = 0;
  /** Picks sent for this Draw screen; waiting on the rival's. */
  locked = false;
  waitingNext = false;

  constructor(public net: NetSession, score: [number, number], public roundNo: number, rounds: RoundRecord[] = []) {
    const me: Side = net.side;
    const mine = net.hello, theirs = net.rival!;
    const spec = (h: typeof mine, you: boolean) => ({ cls: h.cls, deck: h.deck.slice(), name: you ? 'YOU' : 'RIVAL', skin: h.skin });
    const specs = me === 0 ? [spec(mine, true), spec(theirs, false)] : [spec(theirs, false), spec(mine, true)];
    const m = { ...loadMatch(), bestOf: net.start!.bestOf };
    super(m, score, new Battle(specs[0], specs[1], roundSeed(net.start!.seed, roundNo)), rounds);
    this.me = me;
    this.rivalName = 'RIVAL';
    this.pauseItems = ['RESUME', 'LEAVE MATCH'];
    net.beginRound(roundNo);
    this.rb = new Rollback(this.b, me, { local: f => net.localInput(f), remote: f => net.remoteInput(f) },
      statsRollbackRoots(this.stats), (f, h) => net.recordHash(f, h));
  }

  protected rivalDeckText(): string { return `RIVAL: ${this.net.rival?.cls.toUpperCase() ?? ''}`; }

  protected confirmCustom(): void {
    if (this.locked) return;
    this.locked = true;
    this.net.setPicks(this.b.turn, this.picks);
    sfx('confirm');
  }

  update(dt: number): void {
    const b = this.b, net = this.net;
    net.tick();
    this.callouts();
    this.fightBanner = Math.max(0, this.fightBanner - dt);
    if (net.status === 'lost' || net.status === 'left' || net.status === 'error') { this.updateDown(); return; }

    if (b.phase === 'custom') {
      if (!this.locked) this.updateCustom(dt);
      const theirs = net.remotePicks(b.turn);
      if (this.locked && theirs) {
        const mine = this.picks.slice();
        b.endCustom(this.me === 0 ? [mine, theirs] : [theirs, mine]);
        this.rb.resave();
        this.locked = false;
        this.fightBanner = 0.9;
      }
      return;
    }
    if (b.phase === 'over' && this.ended) { this.updateResult(dt); return; }

    // the fight keeps running under the pause menu: there is no pausing an online match
    if (this.paused) this.updatePause(dt);
    else if (b.phase === 'fight' && wasPressed('pause')) { this.paused = true; this.pauseSel = 0; resetSel(); sfx('select'); }
    const live = b.phase === 'fight' && !this.paused;
    const now: NetInput = live ? { ...this.playerIntent(dt), draw: wasPressed('custom') } : NO_INPUT;
    this.pend = this.pend ? merge(this.pend, now) : now;

    // our input goes in a couple of frames ahead (net.delay), which hides most small hiccups
    if (net.scheduled <= this.rb.frame + net.delay) {
      net.pushLocal(this.pend ?? held(now));
      this.pend = null;
    }
    const ran = this.rb.advance(this.framesToRun());
    net.frame = this.rb.frame;
    if (this.rb.lastRollback >= this.shownRollback || ++this.shownRollbackT > 60) { this.shownRollback = this.rb.lastRollback; this.shownRollbackT = 0; }
    this.stall = ran === 0 && this.rb.ahead >= MAX_ROLLBACK ? this.stall + 1 : 0;
    if ((b.phase as string) === 'custom') {
      // the Draw screen only ever opens on a frame both sides agree on
      this.openCustom();
      this.paused = false;
      return;
    }
    for (const f of b.f) chargeHum(f.side, b.phase === 'fight' && f.charging && f.charge > 0.15 ? Math.min(1, f.charge / heavyChargeOf(f)) : null);
    if ((b.phase as string) === 'over' && this.rb.settled && !this.ended) {
      this.ended = true;
      resetSel();
      if (b.winner !== null) this.score[b.winner]++;
      this.rounds.push(roundRecord(b, this.stats));
      this.paused = false;
      stopMusic();
      if (b.winner === this.me) sfx('win');
      playMusic('result', RESULT_SONG);
    }
  }

  /**
   * Frames to run this tick: one normally, two to catch up when the other side's clock is ahead,
   * none now and then when ours is ahead, so neither side keeps guessing further than it must.
   */
  private framesToRun(): number {
    const net = this.net, r = net.remote;
    this.tickN++;
    if (!r || r.fr === undefined || !net.rtt) return 1;
    // where the other side's clock is now: its last report, plus the trip and the time since
    const theirs = r.fr + (net.rtt / 2 + (performance.now() - net.heardAt)) / (1000 / 60);
    this.lead = this.lead * 0.9 + (this.rb.frame - theirs) * 0.1;
    if (this.lead < -2) return 2;
    if (this.lead > 2 && this.tickN % 6 === 0) return 0;
    return 1;
  }

  protected updatePause(dt: number): void {
    const items = this.pauseItems.length;
    const clicked = listMouse('menu', this.pauseSel, i => { this.pauseSel = i; sfx('move'); });
    if (clicked >= 0) this.pauseSel = clicked;
    if (mouse.rclick || (wasPressed('back') && !wasPressed('pause'))) { this.paused = false; return; }
    if (navPressed('up', dt)) { this.pauseSel = (this.pauseSel + items - 1) % items; sfx('move'); }
    if (navPressed('down', dt)) { this.pauseSel = (this.pauseSel + 1) % items; sfx('move'); }
    if (wasPressed('confirm') || clicked >= 0 || (wasPressed('pause') && this.pauseSel === 0)) {
      sfx('select');
      if (this.pauseSel === 0) this.paused = false;
      else this.quit();
    }
  }

  protected get resultItems(): string[] { return [this.setOver ? 'REMATCH' : 'NEXT ROUND', 'LEAVE']; }

  protected updateResult(dt: number): void {
    this.statsPanel.update(this.statsData());
    const net = this.net, next = this.roundNo + 1;
    if (this.waitingNext && net.remoteReady >= next) {
      stopMusic();
      setScene(new OnlineBattleScene(net, this.setOver ? [0, 0] : this.score, next, this.setOver ? [] : this.rounds));
      return;
    }
    if (this.waitingNext) return;
    const items = this.resultItems.length;
    const clicked = listMouse('menu', this.resultSel, i => { this.resultSel = i; sfx('move'); });
    if (clicked >= 0) this.resultSel = clicked;
    if (navPressed('up', dt)) { this.resultSel = (this.resultSel + items - 1) % items; sfx('move'); }
    if (navPressed('down', dt)) { this.resultSel = (this.resultSel + 1) % items; sfx('move'); }
    if (wasPressed('confirm') || wasPressed('custom') || clicked >= 0) {
      sfx('select');
      if (this.resultSel === 1) { this.quit(); return; }
      this.waitingNext = true;
      net.myReady = next;
    }
  }

  /** Connection gone: any key or click goes back to the title. */
  private updateDown(): void {
    for (const f of this.b.f) chargeHum(f.side, null);
    if (mouse.click || wasPressed('confirm') || wasPressed('back')) this.quit();
  }

  private quit(): void {
    if (this.net.status !== 'left') this.net.leave();
    else this.net.transport.close();
    stopMusic();
    setScene(new TitleScene());
  }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    super.draw(c, tick, ui);
    const b = this.b, net = this.net;
    // connection readout, top corner under the HUD
    const ping = net.rtt ? `PING ${Math.round(net.rtt)}MS  DELAY ${net.delay}F  ROLLBACK ${this.shownRollback}F` : '';
    if (b.phase === 'fight') drawTextOutlined(ui, ping, Math.round(UW / 2 - textWidth(ping) / 2), 48, '#bcbcbc');
    if (net.desync) drawTextCentered(ui, 'DESYNC: THE TWO GAMES DISAGREE', UW / 2, 270, '#f83800', 1);
    if (b.phase === 'custom' && this.locked) {
      win(ui, 300, 150, 116, 30, { burn: 3 });
      drawTextCentered(ui, tick % 8 < 6 ? 'WAITING FOR' : '', 358, 157, RED_INK, 1, false);
      drawTextCentered(ui, 'RIVAL...', 358, 168, RED_INK, 1, false);
    }
    if ((b.phase === 'fight' || b.phase === 'ko') && this.stall > 20) {
      win(ui, UW / 2 - 90, 139, 180, 20, { burn: 3 });
      drawTextCentered(ui, 'WAITING FOR RIVAL...', UW / 2, 146, RED_INK, 1, false);
    }
    if (b.phase === 'over' && this.waitingNext) {
      win(ui, 360, 38, 112, 20, { burn: 3 });
      drawTextCentered(ui, 'WAITING FOR RIVAL', 416, 45, RED_INK, 1, false);
    }
    if (net.status === 'lost' || net.status === 'left' || net.status === 'error') {
      dim(ui, 0.7);
      const msg = net.status === 'left' ? 'YOUR RIVAL LEFT' : net.status === 'lost' ? 'CONNECTION LOST' : net.error || 'CONNECTION ERROR';
      drawTextCentered(ui, msg, UW / 2, 130, '#f83800', 2);
      hint(ui, `CLICK OR ${k('attack')}: BACK TO TITLE`);
    }
  }
}

function merge(a: NetInput, b: NetInput): NetInput {
  return {
    move: b.move ?? a.move, held: b.held, attackHeld: b.attackHeld,
    attackPressed: a.attackPressed || b.attackPressed, castPressed: a.castPressed || b.castPressed, draw: a.draw || b.draw,
  };
}
/** Same held keys, no new presses. */
const held = (i: NetInput): NetInput => ({ ...NO_INPUT, held: i.held, attackHeld: i.attackHeld });
