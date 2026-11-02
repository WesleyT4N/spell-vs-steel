// Local Versus: runs a Battle, the custom screen, pause and results. Either side can be a player at this
// keyboard or the CPU, so it covers you vs the CPU (on either side), two players on one keyboard, and CPU vs CPU.
import { classRules } from '../content/classes';
import { pushScene, replaceScene, popTo, goHome, dim, drawMenu, hint, zone, zoneAt, hot, isHot, listMouse, showSel, resetSel, type Scene } from './scene';
import { CLASS_INFO } from '../game/classes';
import { Battle, NO_INTENT, heavyChargeOf, type Dir, type Intent, type Side } from '../game/battle';
import { drawBattle, drawBattleUi, getArena } from '../game/battleView';
import { Cpu } from '../game/ai';
import { styleFor } from '../game/playstyles';
import { substream } from '../game/rng';
import { CARDS, ELEMENT_COLOR } from '../game/cards';

// Draw screen layout (UI pixels): the hand fans along the bottom, details and cast order above it.
const HAND_Y = 194, HAND_GAP = 84;
const handX = (i: number, n: number): number => Math.round(UW / 2 - (HAND_GAP * (n - 1) + CARD_W) / 2 + i * HAND_GAP);
/** Pixels per raise level: hovered cards rise one level, picked cards two. */
const LIFT = 12;
import { deckLabel, rollDeck, sideDeck, sideName, type Ctl, type MatchConfig } from '../game/match';
import { TUNING } from '../game/tuning';
import { P, UW, screenRect, spread, view, mix, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered, drawTextOutlined, textWidth } from '../engine/font';
import { wasPressed, isDown, heldDir, navPressed, k, mouse, gesture, localDir, localDown, localPressed, localNav, localKey } from '../engine/input';
import { touchText, type PadMode } from '../engine/touch';
import { playMusic, stopMusic, sfx, chargeHum, announce, voiceLine } from '../engine/audio';
import { stageMusic } from '../content/stages';
import { drawCardDetail, drawCardFace, costSign, costDeltaText, resName, resInk, RES_INK, CARD_W, CARD_H, PICKED } from './cardView';
import { drawDelta, modInk } from './modValue';
import { CardPreview } from './cardPreview';
import { win, plaque, pip, disc, banner, PAPER, PAPER2, BURN, INK, INK2, TRIM, RED_INK, BLUE_INK, WAX_HI, GOLD, FRAME } from './skin';
import { bigButton, actionBar, barTapped, swipeIn, tallArea, TAP, GAP, PAD } from './touchUi';
import { CharSelectScene } from './select';
import { StatsPanel, type StatsData } from './statsView';
import { trackStats, roundRecord, setTotals, topSpell, type BattleStats, type RoundRecord } from '../game/stats';
import { OptionsScene } from './options';
import { recordSet } from '../game/profile';
import { recordRound, saveReplay, newReplayId, RULES_VERSION, type Replay, type ReplayMode, type RoundTape } from '../game/replay';

/** The replay being recorded for each set, keyed by the set's list of rounds (a new set starts a new list). */
const SET_REPLAYS = new WeakMap<RoundRecord[], Replay>();

export class BattleScene implements Scene {
  b: Battle;
  cpu: Cpu;
  cursor = 0;
  /** True after the mouse moves, false after a key press: decides whether hover or the key cursor raises a card. */
  mouseMode = false;
  /** Current raise of each card in the hand, eased toward its level. */
  lift: number[] = [];
  picks: number[] = [];
  timer: number = TUNING.customTimer;
  paused = false;
  pauseSel = 0;
  resultSel = 0;
  fightBanner = 0;
  /** Per side: how long the held direction has been held, and which it was. */
  holdT: [number, number] = [0, 0];
  lastDir: [Dir | null, Dir | null] = [null, null];
  ended = false;
  /** Which side this screen plays: yours against the CPU (either side), either side online. With two players, whose Draw screen is up. */
  me: Side = 0;
  /** The CPU playing the right side, and the left side's when it is a CPU too. */
  cpu0: Cpu | null = null;
  /** Each side's picks from this Draw screen, kept while the other player picks. */
  private sidePicks: [number[], number[]] = [[], []];
  /** False in training: the Draw screen waits for you. */
  protected timed = true;
  /** The announcer calls the round, FIGHT, K.O. and the winner. Off in training and the tutorial. */
  announce = true;
  private callPhase = '';
  private called = false;
  /** When the round call started, so FIGHT never talks over it. */
  private roundAt = -1e9;
  /** The clip of the card being read on the Draw screen. */
  private preview = new CardPreview();
  /** Post-match stats for this round; they only watch the battle, never change it. */
  stats: BattleStats;
  statsPanel = new StatsPanel();
  /** Each side's deck this round (a RANDOM pick is rolled here). */
  protected decks: [string, string];

  /**
   * Rounds won in the current set, by side, and the stats of the rounds already played.
   * `battle` lets online play hand in a seeded battle. `ctl`: who plays each side.
   */
  constructor(public m: MatchConfig, public score: [number, number] = [0, 0], battle?: Battle, public rounds: RoundRecord[] = [], public ctl: [Ctl, Ctl] = ['player', 'cpu']) {
    this.decks = [rollDeck(m, 0), rollDeck(m, 1)];
    this.b = battle ?? new Battle(
      { cls: m.p1, deck: sideDeck(m, 0, this.decks[0]), name: sideName(ctl, 0), skin: m.p1Skin[m.p1] },
      { cls: m.cpu, deck: sideDeck(m, 1, this.decks[1]), name: sideName(ctl, 1), skin: m.cpuSkin[m.cpu] },
    );
    // the CPUs' styles come from the match seed too, so a seed replays the whole match
    const pickStyle = substream(this.b.seed, 0x57);
    this.cpu = new Cpu(m.difficulty, styleFor(m.cpu, m.difficulty, m.p1, pickStyle));
    this.stats = trackStats(this.b);
    if (this.keepsReplays) recordRound(this.b, t => this.keepRound(t));
    if (ctl[0] === 'cpu') this.cpu0 = new Cpu(m.difficulty, styleFor(m.p1, m.difficulty, m.cpu, pickStyle));
    this.me = this.home;
    this.rivalName = sideName(ctl, this.home === 0 ? 1 : 0);
  }

  /** Sides played at this keyboard, left first. */
  protected get humans(): Side[] { return ([0, 1] as const).filter(s => this.ctl[s] === 'player'); }
  /** Two players share the keyboard, each on their own fixed keys. */
  protected get twoPlayer(): boolean { return this.humans.length === 2; }
  /** Nobody plays: CPU vs CPU to watch. */
  protected get watching(): boolean { return this.humans.length === 0; }
  /** The side the screen speaks to outside the Draw screen: the one player's, else the left. */
  private get home(): Side { return this.humans.length === 1 ? this.humans[0] : 0; }
  private cpuOf(s: Side): Cpu { return s === 0 && this.cpu0 ? this.cpu0 : this.cpu; }

  // Input for the side `s`: the usual (rebindable) keys when one person plays, their own fixed keys when two do.
  private dirOf(s: Side): Dir | null { return this.twoPlayer ? localDir(s) : heldDir(); }
  private pressedOf(s: Side, a: 'up' | 'down' | 'left' | 'right' | 'attack' | 'cast' | 'custom'): boolean { return this.twoPlayer ? localPressed(s, a) : wasPressed(a); }
  private navOf(s: Side, a: 'up' | 'down' | 'left' | 'right', dt: number): boolean { return this.twoPlayer ? localNav(s, a, dt) : navPressed(a, dt); }
  /** On-screen key name for side `s`. */
  protected keyOf(s: Side, a: 'left' | 'right' | 'attack' | 'cast' | 'custom'): string { return this.twoPlayer ? localKey(s, a) : k(a); }

  enter(): void { playMusic(stageMusic(getArena().id)); }
  resume(): void { playMusic(stageMusic(getArena().id)); }
  // phones in portrait: the fight on top at its usual size, the pad, Draw screen, pause and results below it
  tall(): boolean { return true; }
  split(): boolean { return true; }
  /** Online: what the Draw screen or results are waiting on the other side for ('' for nothing). */
  protected get waitingOn(): string { return ''; }
  /** False when a subclass draws its own pause menu. */
  protected tallPause(): boolean { return true; }
  /** Where the bottom part of a split phone screen starts (full-screen UI coordinates). */
  protected get splitTop(): number { return -view.oy * 2 + spread.halfH * 2; }

  /** Tabbing away mid-fight pauses it (online play keeps running: the other side decides). */
  suspend(): void {
    if (this.b.phase === 'fight' && !this.paused && !this.watching) { this.paused = true; this.pauseSel = 0; resetSel(); }
  }

  pad(): PadMode {
    const b = this.b;
    if (this.paused) return spread.tall ? 'none' : 'back';
    // the Draw screen and results are all taps (tap a picked card again to undo it)
    if (b.phase === 'custom' || b.phase === 'over') return 'none';
    // watching CPU vs CPU: a tap anywhere pauses
    if (this.watching) return 'back';
    return b.canOpenCustom() ? 'fight-ready' : 'fight';
  }

  protected playerIntent(dt: number, s: Side = this.me): Intent {
    const f = this.b.f[s];
    const d = this.dirOf(s);
    let move: Dir | null = null;
    if (d) {
      if (d !== this.lastDir[s] || this.pressedOf(s, d)) { move = d; this.holdT[s] = 0; }
      else {
        this.holdT[s] += dt;
        if (this.holdT[s] > 0.18 && f.moveCd <= 0) move = d;
      }
    } else this.holdT[s] = 0;
    this.lastDir[s] = d;
    const attackHeld = this.twoPlayer ? localDown(s, 'attack') : isDown('attack');
    return { move, held: d, attackPressed: this.pressedOf(s, 'attack'), attackHeld, castPressed: this.pressedOf(s, 'cast') };
  }

  update(dt: number): void {
    const b = this.b;
    this.callouts();
    this.fightBanner = Math.max(0, this.fightBanner - dt);

    if (b.phase === 'custom') { this.updateCustom(dt); b.update(dt, [NO_INTENT, NO_INTENT]); return; }
    if (b.phase === 'over') { this.updateResult(dt); b.update(dt, [NO_INTENT, NO_INTENT]); return; }

    if (this.paused) { this.updatePause(dt); return; }
    const pause = wasPressed('pause') || (this.watching && (wasPressed('back') || mouse.click || mouse.rclick));
    if (b.phase === 'fight' && pause) { this.paused = true; this.pauseSel = 0; resetSel(); sfx('select'); return; }

    // a player opens the Draw screen when the gauge is full; with nobody playing, the CPUs do, a moment after
    const wantsDraw = this.watching ? !!this.cpu0?.wantsDraw(b, b.f[0], dt) : this.humans.some(s => this.pressedOf(s, 'custom'));
    if (b.phase === 'fight' && wantsDraw && b.canOpenCustom()) {
      b.beginCustom();
      this.openCustom();
      return;
    }
    const intent = (s: Side): Intent => this.ctl[s] === 'cpu' ? this.cpuOf(s).intent(b, b.f[s], dt) : b.phase === 'fight' ? this.playerIntent(dt, s) : NO_INTENT;
    b.update(dt, [intent(0), intent(1)]);
    // charging heavies hum (rising pitch, then a warble when ready); a quick tap stays silent
    for (const f of b.f) chargeHum(f.side, b.phase === 'fight' && f.charging && f.charge > 0.15 ? Math.min(1, f.charge / heavyChargeOf(f)) : null);
    if ((b.phase as string) === 'over' && !this.ended) {
      this.ended = true;
      resetSel();
      if (b.winner !== null) this.score[b.winner]++;
      this.rounds.push(roundRecord(b, this.stats));
      stopMusic();
      if (b.winner !== null && (b.winner === this.me || this.ctl[b.winner] === 'player' || this.watching)) sfx('win');
      playMusic('victory');
    }
  }

  /** Announcer calls on phase changes: the round as it opens, FIGHT as the first Draw screen closes, K.O., the winner. */
  protected callouts(): void {
    const b = this.b, ph = b.phase, prev = this.callPhase;
    this.callPhase = ph;
    if (!this.announce || ph === prev) return;
    if (!prev) {
      if (this.m.bestOf > 1) {
        const last = this.score[0] === this.need - 1 && this.score[1] === this.need - 1;
        announce(last ? 'final' : 'round', { n: this.score[0] + this.score[1] + 1 });
        this.roundAt = performance.now() + (last ? 700 : 0);
      }
      return;
    }
    if (ph === 'fight' && prev === 'custom' && !this.called) {
      this.called = true;
      const wait = this.roundAt + 1400 - performance.now();
      if (wait > 0) window.setTimeout(() => announce('fight'), wait); else announce('fight');
    }
    if (ph === 'ko') announce('ko');
    // a monster pack winning has no name to call
    if (ph === 'over' && b.winner !== null && !b.f[b.winner].mob) {
      const w = b.f[b.winner], who = CLASS_INFO[w.cls].name;
      const perfect = w.hp >= w.maxHp;
      const call = (): void => announce(this.setOver && this.m.bestOf > 1 ? 'match' : 'wins', { who });
      if (perfect) { announce('perfect'); window.setTimeout(call, 1800); } else call();
      // the winner's victory line once the announcer is done
      window.setTimeout(() => voiceLine(w.cls, 'win', 0, w.side, undefined, w.skin), (perfect ? 1800 : 0) + (this.setOver && this.m.bestOf > 1 ? 2600 : 1500));
    }
  }

  protected openCustom(): void {
    // with two players the left one picks first, then the right
    if (this.twoPlayer) this.me = 0;
    this.sidePicks = [[], []];
    this.freshHand();
  }

  private freshHand(): void {
    this.cursor = 0;
    resetSel();
    this.lift = [];
    this.picks = [];
    this.timer = TUNING.customTimer;
  }

  protected confirmCustom(): void {
    const b = this.b;
    if (this.ctl[this.me] === 'player') this.sidePicks[this.me] = this.picks;
    // two players: hand the Draw screen to the right-hand player
    if (this.twoPlayer && this.me === 0) { this.me = 1; this.freshHand(); sfx('confirm'); return; }
    const picks = ([0, 1] as const).map(s => this.ctl[s] === 'cpu' ? this.cpuOf(s).pick(b, b.f[s]) : this.sidePicks[s]) as [number[], number[]];
    b.endCustom(picks);
    this.me = this.home;
    this.fightBanner = 0.9;
  }

  protected updateCustom(dt: number): void {
    // nobody to pick: the CPUs pick and the fight goes on
    if (this.watching) { this.confirmCustom(); return; }
    const offer = this.b.offer[this.me];
    const reading = this.reading();
    this.preview.show(reading >= 0 ? CARDS[offer[reading]] : null);
    this.preview.update(dt);
    const rows = offer.length + 1;
    for (let i = 0; i < offer.length; i++) {
      const cur = this.lift[i] ?? 0, to = this.level(i) * LIFT;
      this.lift[i] = Math.abs(to - cur) < 0.5 ? to : cur + (to - cur) * Math.min(1, dt * 18);
    }
    if (this.timed) {
      this.timer -= dt;
      if (this.timer <= 0) { this.confirmCustom(); return; }
    }
    if (spread.tall) {
      if (barTapped('back')) { if (this.picks.length) { this.picks = []; sfx('back'); } return; }
      if (barTapped('primary')) { this.confirmCustom(); return; }
      // flick a card up to queue it, down to take it back out
      const sw = gesture.swipe;
      const at = sw === 'up' || sw === 'down' ? zoneAt(gesture.sx, gesture.sy) : null;
      if (at?.startsWith('card:')) {
        const i = Number(at.slice(5)), p = this.picks.indexOf(i);
        if (sw === 'up' && p < 0) { this.picks.push(i); sfx('select'); }
        if (sw === 'down' && p >= 0) { this.picks.splice(p, 1); sfx('back'); }
        return;
      }
    }
    // mouse: hover a card to read it, click to pick or unpick, right-click to undo
    const over = isHot('fight') ? offer.length : hot('card');
    if (mouse.moved) this.mouseMode = true;
    if (over >= 0 && mouse.moved && over !== this.cursor) { this.cursor = over; sfx('move'); }
    if (mouse.click && over >= 0) { this.cursor = over; this.choose(); return; }
    if (mouse.rclick) {
      const at = this.picks.indexOf(hot('card'));
      if (at >= 0) this.picks.splice(at, 1); else this.picks.pop();
      sfx('back');
      return;
    }
    const s = this.me;
    const prev = this.navOf(s, 'up', dt) || this.navOf(s, 'left', dt), next = this.navOf(s, 'down', dt) || this.navOf(s, 'right', dt);
    // two players pick with their own attack key; Enter still picks for either
    const ok = this.twoPlayer ? localPressed(s, 'attack') || wasPressed('confirm') : wasPressed('confirm');
    if (prev || next || ok) this.mouseMode = false;
    if (prev) { this.cursor = (this.cursor + rows - 1) % rows; sfx('move'); }
    if (next) { this.cursor = (this.cursor + 1) % rows; sfx('move'); }
    if (this.pressedOf(s, 'custom') || (wasPressed('pause') && !wasPressed('confirm'))) { this.confirmCustom(); return; }
    if (ok) { this.choose(true); return; }
    if (this.pressedOf(s, 'cast') && this.picks.length) { this.picks.pop(); sfx('back'); }
  }

  /** The hand card under the pointer, or under the key cursor; -1 when none is being read. */
  private reading(): number {
    const n = this.b.offer[this.me].length;
    const i = this.mouseMode ? hot('card') : showSel() ? this.cursor : -1;
    return i >= 0 && i < n ? i : -1;
  }

  /** Raise level of hand card `i`: 0 resting, 1 hovered, 2 picked. */
  private level(i: number): number {
    if (this.picks.includes(i)) return 2;
    const hovered = this.mouseMode ? hot('card') === i : this.cursor === i && showSel();
    return hovered ? 1 : 0;
  }

  /** Pick or unpick the card under the cursor, or start the fight from the FIGHT button. */
  private choose(advance = false): void {
    const offer = this.b.offer[this.me];
    if (this.cursor === offer.length) { this.confirmCustom(); return; }
    const at = this.picks.indexOf(this.cursor);
    if (at >= 0) { this.picks.splice(at, 1); sfx('back'); return; }
    this.picks.push(this.cursor);
    sfx('select');
    // with the keyboard, hop to the next card not yet picked
    if (advance) { this.cursor = Math.min(this.cursor + 1, offer.length); while (this.cursor < offer.length && this.picks.includes(this.cursor)) this.cursor++; }
  }

  protected updatePause(dt: number): void {
    const items = 4;
    const clicked = listMouse('menu', this.pauseSel, i => { this.pauseSel = i; sfx('move'); });
    if (clicked >= 0) this.pauseSel = clicked;
    if (mouse.rclick) { this.paused = false; return; }
    if (navPressed('up', dt)) { this.pauseSel = (this.pauseSel + items - 1) % items; sfx('move'); }
    if (navPressed('down', dt)) { this.pauseSel = (this.pauseSel + 1) % items; sfx('move'); }
    if (wasPressed('back') && !wasPressed('pause')) { this.paused = false; return; }
    if (wasPressed('confirm') || clicked >= 0 || (wasPressed('pause') && this.pauseSel === 0)) {
      sfx('select');
      if (this.pauseSel === 0) this.paused = false;
      if (this.pauseSel === 1) pushScene(new OptionsScene());
      if (this.pauseSel === 2) replaceScene(this.again(this.score, this.rounds));
      if (this.pauseSel === 3) { stopMusic(); goHome(); }
    }
  }

  /** False where a round is not a real match (training, replays): nothing gets recorded. */
  protected get keepsReplays(): boolean { return true; }
  protected get replayMode(): ReplayMode { return this.watching ? 'watch' : this.twoPlayer ? 'versus' : 'cpu'; }

  /** A round just ended: add it to this set's replay and save it, so even an unfinished set keeps its rounds. */
  protected keepRound(t: RoundTape): void {
    let r = SET_REPLAYS.get(this.rounds);
    if (!r) {
      r = { id: newReplayId(), v: RULES_VERSION, at: Date.now(), mode: this.replayMode, me: this.humans.length === 1 ? this.me : null, bestOf: this.m.bestOf, stage: getArena().id, rounds: [] };
      SET_REPLAYS.set(this.rounds, r);
    }
    r.rounds.push(t);
    r.at = Date.now();
    saveReplay(r);
    recordSet(r, this.myDeck);
    this.afterRound(r);
  }

  /** The spell deck choice the player at this keyboard fights with, for the profile's favorite deck. */
  protected get myDeck(): string { return this.decks[this.me]; }

  /** The set's replay so far, once a round of it has ended. */
  protected get setReplay(): Replay | null { return SET_REPLAYS.get(this.rounds) ?? null; }
  /** Called as each round ends, with the set's replay so far. */
  protected afterRound(_r: Replay): void { /* online play scores ranked sets here */ }
  /** An extra line on the results screen, under the score. */
  protected resultNote(): string { return ''; }
  /** A call-out over the results menu (online: what the rival asked for). */
  protected resultAlert(): string { return ''; }
  /** Results menu items that can't be picked right now. */
  protected resultDisabled(): boolean[] { return []; }

  /** Hooks the online scene overrides. */
  protected rivalName = 'CPU';
  protected pauseItems = ['RESUME', 'OPTIONS', 'RESTART', 'QUIT TO TITLE'];
  protected rivalDeckText(): string {
    const foe: Side = this.me === 0 ? 1 : 0, f = this.b.f[foe];
    return `${f.name} SPELL DECK: ${deckLabel(f.cls, this.decks[foe])}`;
  }

  /** The next round (or a fresh set) of this match; arcade fights carry their run along. */
  protected again(score: [number, number], rounds: RoundRecord[]): Scene {
    return new BattleScene(this.m, score, undefined, rounds, this.ctl);
  }

  protected get need(): number { return Math.ceil(this.m.bestOf / 2); }
  protected get setOver(): boolean { return Math.max(...this.score) >= this.need; }
  protected get resultItems(): string[] {
    return this.setOver ? ['REMATCH', 'CHARACTER SELECT', 'TITLE'] : ['NEXT ROUND', 'TITLE'];
  }

  protected updateResult(dt: number): void {
    this.statsPanel.update(this.statsData());
    this.swipeStats();
    const items = this.resultItems.length;
    const clicked = listMouse('menu', this.resultSel, i => { this.resultSel = i; sfx('move'); });
    if (clicked >= 0) this.resultSel = clicked;
    if (navPressed('up', dt)) { this.resultSel = (this.resultSel + items - 1) % items; sfx('move'); }
    if (navPressed('down', dt)) { this.resultSel = (this.resultSel + 1) % items; sfx('move'); }
    if (wasPressed('confirm') || wasPressed('custom') || clicked >= 0) {
      sfx('select');
      stopMusic();
      this.onResult(this.resultItems[this.resultSel]);
    }
  }

  /** Phone layout: swiping the stats steps through their tabs. */
  protected swipeStats(): void {
    const d = spread.tall ? swipeIn(...this.statsRect) : 0;
    if (!d) return;
    const n = this.statsPanel.tabs(this.statsData()).length;
    this.statsPanel.tab = (this.statsPanel.tab + d + n) % n;
    sfx('move');
  }
  /** Where the phone layout drew the stats panel. */
  protected statsRect: [number, number, number, number] = [0, 0, 0, 0];

  /** A results menu item was picked. */
  protected onResult(choice: string): void {
    if (choice === 'NEXT ROUND') replaceScene(this.again(this.score, this.rounds));
    if (choice === 'REMATCH') replaceScene(this.again([0, 0], []));
    // back to the character select this match came from, picks intact
    if (choice === 'CHARACTER SELECT') popTo(s => s instanceof CharSelectScene, () => new CharSelectScene());
    if (choice === 'TITLE') goHome();
  }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    const b = this.b;
    // one player sees their side's hidden things (traps, stealth); sharing a screen or watching, everything shows
    const shared = this.humans.length !== 1;
    drawBattle(c, b, tick, shared ? 'all' : this.me, true);
    if (b.phase !== 'custom') {
      if (!shared) drawBattleUi(ui, b, tick, this.me);
      else drawBattleUi(ui, b, tick, 0, this.twoPlayer
        ? { cast: [this.keyOf(0, 'cast'), this.keyOf(1, 'cast')], draw: `${this.keyOf(0, 'custom')} / ${this.keyOf(1, 'custom')}` }
        : { cast: [null, null], draw: null });
    }
    if (this.m.bestOf > 1 && b.phase !== 'over' && b.phase !== 'custom') {
      const round = this.score[0] + this.score[1] + 1;
      drawTextCentered(ui, `ROUND ${round}   ${this.score[this.me]}-${this.score[1 - this.me]}`, UW / 2, 36, '#fcfcfc');
    }
    if (b.phase === 'custom') {
      if (spread.tall) this.drawCustomTop(c, ui);
      else this.drawCustom(c, tick, ui);
    }
    if (this.fightBanner > 0 && b.phase === 'fight') {
      const s = this.fightBanner > 0.45 ? 'READY' : 'FIGHT!';
      drawTextCentered(ui, s, UW / 2, 124, s === 'FIGHT!' ? '#f8b800' : '#fcfcfc', 6);
    }
    if (b.phase === 'ko' && b.koT > 0.4) drawTextCentered(ui, b.winner === null ? 'DOUBLE K.O.' : 'K.O.', UW / 2, 116, '#f83800', b.winner === null ? 4 : 6);
    if (spread.tall) return;
    if (b.phase === 'over') this.drawResult(ui, tick);
    if (this.paused) {
      dim(ui, 0.55);
      drawTextCentered(ui, 'PAUSED', UW / 2, 76, '#fcfcfc', 4);
      drawMenu(ui, this.pauseItems, this.pauseSel, UW / 2, 130, tick, { width: 200, gap: 24 });
      hint(ui, `CLICK OR ${k('attack')}: SELECT   ${k('cast')} / RIGHT-CLICK: RESUME`);
    }
  }

  /** What the stats panel shows: this round, or the whole set once a best-of set is decided. */
  protected statsData(): StatsData {
    const me = this.me, names: [string, string] = this.humans.length !== 1 ? [this.b.f[0].name, this.b.f[1].name] : me === 0 ? ['YOU', this.rivalName] : [this.rivalName, 'YOU'];
    const set = this.m.bestOf > 1;
    const totals = set && this.setOver && this.rounds.length > 1 ? setTotals(this.rounds) : null;
    const scope = totals ? `SET OF ${this.rounds.length}` : set ? `ROUND ${Math.max(1, this.rounds.length)}` : 'THIS MATCH';
    return { me, names, fighters: this.b.f, shown: totals ?? this.stats.side, scope, rounds: set ? this.rounds : [], current: this.stats };
  }

  /** Results: the outcome on a banner, the stats panel, and the menu with your best spell beside it. */
  private drawResult(ui: Ctx, tick: number): void {
    const b = this.b;
    dim(ui, 0.55);
    const won = b.winner === this.me;
    const setWon = this.score[this.me] >= this.need;
    let title = this.m.bestOf === 1 ? (b.winner === null ? 'DRAW' : won ? 'YOU WIN!' : 'YOU LOSE')
      : this.setOver ? (setWon ? 'SET WON!' : 'SET LOST') : won ? 'ROUND WON' : 'ROUND LOST';
    let score = `YOU ${this.score[this.me]} - ${this.score[1 - this.me]} ${this.rivalName}`;
    if (this.humans.length !== 1) {
      // sharing a screen or watching: name the winner instead of "you"
      const top: Side = this.setOver ? (this.score[0] >= this.need ? 0 : 1) : (b.winner ?? 0);
      const who = b.f[top].name;
      title = b.winner === null && !this.setOver ? 'DRAW' : this.m.bestOf === 1 ? `${who} WINS!` : this.setOver ? `${who} WINS THE SET` : `${who} WINS THE ROUND`;
      score = `${b.f[0].name} ${this.score[0]} - ${this.score[1]} ${b.f[1].name}`;
    }
    banner(ui, title, UW / 2, 6);
    // the score, and any note (online ranked: the rating change) after it on the same line
    const note = this.resultNote(), line = this.m.bestOf > 1 ? score : '';
    const gap = line && note ? '   ' : '', x0 = Math.round(UW / 2 - textWidth(line + gap + note) / 2);
    if (line) drawTextOutlined(ui, line, x0, 34, '#fcfcfc');
    if (note) drawTextOutlined(ui, note, x0 + textWidth(line + gap), 34, '#f8b800');
    const data = this.statsData();
    this.statsPanel.draw(ui, data, 8, 46, 344, 254);
    const items = this.resultItems;
    drawMenu(ui, items, this.resultSel, 416, 62, tick, { width: 112, gap: 22, disabled: this.resultDisabled() });
    // under the menu, the rival's ask on two lines ("RIVAL WANTS" / "A REMATCH")
    const alert = this.resultAlert(), alertY = 62 + items.length * 22 + 6;
    if (alert) {
      const [l1, l2] = alert.startsWith('RIVAL WANTS ') ? ['RIVAL WANTS', alert.slice(12)] : [alert, ''];
      win(ui, 360, alertY, 112, 34, { burn: 3, accent: '#f8b800' });
      if (tick % 16 < 12) {
        drawTextCentered(ui, l1, 416, alertY + 10, RED_INK, 1, false);
        drawTextCentered(ui, l2, 416, alertY + 21, RED_INK, 1, false);
      }
    }
    // your best spell of the round (or set), as a card
    // (it gives way to the rival's ask while that is up: there is no room for both)
    const best = alert ? null : topSpell(data.shown[this.me]);
    if (best) {
      const y = 62 + items.length * 22 + 14;
      win(ui, 368, y, 96, 152, { burn: 3 });
      drawTextCentered(ui, 'BEST SPELL', 416, y + 8, RED_INK, 1, false);
      drawCardFace(ui, CARDS[best[0]], 378, y + 20);
      const done = best[1].heal > best[1].dmg ? `+${Math.round(best[1].heal)} HEALED` : `${Math.round(best[1].dmg)} DAMAGE`;
      drawTextCentered(ui, done, 416, y + 130, INK, 1, false);
    }
    hint(ui, `CLICK OR ${k('attack')}: SELECT   ${k('left')}/${k('right')}: STATS TABS`);
  }

  private drawCustom(c: Ctx, tick: number, ui: Ctx): void {
    const b = this.b, f = b.f[this.me];
    const offer = b.offer[this.me];
    dim(c, 0.45);

    // header: turn, timer, resource, on a parchment strip that reaches the screen's sides
    const [sx, , sw] = screenRect(2);
    win(ui, sx + 4, 2, sw - 8, 26, { burn: 3 });
    // two players take turns at the Draw screen: say whose it is
    if (this.twoPlayer) drawText(ui, `${f.name} DRAW   TURN ${b.turn}`, 14, 11, this.me === 0 ? RED_INK : BLUE_INK);
    else drawText(ui, `DRAW   TURN ${b.turn}`, 14, 11, INK);
    const secs = Math.ceil(this.timer);
    if (this.timed) drawTextCentered(ui, String(secs).padStart(2, '0'), UW / 2, 8, secs <= 5 && tick % 4 < 2 ? WAX_HI : RED_INK, 2, false);
    else drawTextCentered(ui, 'NO TIME LIMIT', UW / 2, 11, INK2, 1, false);
    this.drawResourcePreview(ui, tick);
    const { short, cost, dmg } = this.handPlan();
    const total = this.picks.reduce((a, i) => a + cost[i], 0);
    // Rage is earned in the fight and paid on cast, so a short Warrior card is "later", not "can't"
    const builds = !!CLASS_INFO[f.cls].builds;

    // left: the card being read, with its element as a ribbon across the top
    const card = showSel() && offer[this.cursor] ? CARDS[offer[this.cursor]] : null;
    win(ui, 8, 34, 228, 130, { accent: card ? ELEMENT_COLOR[card.element] : undefined });
    if (card) {
      drawCardDetail(ui, card, 18, 44, 208, 1, cost[this.cursor], dmg[this.cursor]);
      const need = short[this.cursor];
      if (need > 0) {
        if (builds) drawText(ui, `BUILD ${need} MORE ${resName(card)} IN THE FIGHT`, 18, 150, resInk(card));
        else drawText(ui, `NEED ${need} MORE ${resName(card)}`, 18, 150, RED_INK);
      }
    } else if (!showSel()) {
      drawText(ui, 'YOUR HAND', 18, 44, RED_INK, 2);
      drawText(ui, 'TOUCH AND HOLD A CARD TO READ IT', 18, 66, INK);
      drawText(ui, 'TAP CARDS TO PICK THEM, IN CAST ORDER', 18, 80, INK2);
      drawText(ui, this.rivalDeckText(), 18, 102, TRIM);
    } else {
      drawText(ui, 'START THE FIGHT', 18, 44, RED_INK, 2);
      drawText(ui, `${this.picks.length} SPELL${this.picks.length === 1 ? '' : 'S'} PICKED`, 18, 66, INK);
      drawText(ui, `CAST THEM IN ORDER WITH ${this.keyOf(this.me, 'cast')}`, 18, 80, INK2);
      drawText(ui, this.rivalDeckText(), 18, 102, TRIM);
    }

    // right: the clip of the card being read, else the cast order
    win(ui, 244, 34, 228, 98);
    if (this.reading() >= 0) this.preview.draw(ui, 252, 41, 212, 84);
    else this.drawCastOrder(ui, short, cost, builds, total);

    // fight button: red wax, ringed in gold when it has the cursor
    const onOk = this.cursor === offer.length && showSel();
    // sits above the highest a raised card can reach (HAND_Y - 2 * LIFT)
    zone('fight', 300, 138, 116, 24);
    plaque(ui, 300, 138, 116, 24, true);
    if (onOk) { P(ui, GOLD, 300, 138, 116, 2); P(ui, GOLD, 300, 160, 116, 2); P(ui, GOLD, 300, 138, 2, 24); P(ui, GOLD, 414, 138, 2, 24); }
    drawTextCentered(ui, this.twoPlayer && this.me === 0 ? 'DONE' : 'FIGHT!', 358, 143, onOk ? GOLD : PAPER, 2, false);

    // the hand
    offer.forEach((id, i) => {
      const x = handX(i, offer.length);
      const order = this.picks.indexOf(i), lvl = this.level(i);
      // the hit box covers every raise level, so a rising card never slips out from under the pointer
      zone(`card:${i}`, x, HAND_Y - 2 * LIFT, CARD_W, CARD_H + 2 * LIFT);
      const y = HAND_Y - Math.round(this.lift[i] ?? 0);
      drawCardFace(ui, CARDS[id], x, y, { order, lit: lvl === 1 || (lvl === 2 && this.cursor === i && showSel()), short: short[i], builds, cost: cost[i], dmg: dmg[i] });
      if (!this.mouseMode && this.cursor === i && showSel() && tick % 8 < 6) drawTextCentered(ui, '↓', x + CARD_W / 2, y - 10, GOLD, 1, true);
    });
    const s = this.me, done = this.twoPlayer && s === 0 ? 'DONE' : 'FIGHT';
    hint(ui, `CLICK: PICK  RIGHT-CLICK: UNDO   KEYS: ${this.keyOf(s, 'left')}/${this.keyOf(s, 'right')} + ${this.keyOf(s, 'attack')}  ${this.keyOf(s, 'cast')} UNDO  ${this.keyOf(s, 'custom')} ${done}`);
  }

  // ---------- phones in portrait ----------

  /** The bottom of the screen under the fight: wood under the pad, or the Draw screen, results and pause. */
  drawBelow(ui: Ctx, tick: number): void {
    const b = this.b, a = tallArea(), top = this.splitTop;
    const [sx, sy, sw, sh] = screenRect(2);
    P(ui, '#000000', sx, top, sw, sy + sh - top);
    P(ui, FRAME, sx, top + 2, sw, sy + sh - top - 2);
    P(ui, mix(FRAME, '#000000', 0.35), sx, top + 2, sw, 4);
    P(ui, TRIM, sx, top, sw, 2);
    if (b.phase === 'custom' && !this.watching) this.drawCustomBelow(ui, tick, top, a);
    if (b.phase === 'over') this.drawResultTall(ui, tick);
    else if (this.paused && this.tallPause()) this.drawPauseTall(ui, tick);
  }

  /** The Draw screen's top part: the arena dims and the card being read shows over it, with its clip. */
  private drawCustomTop(c: Ctx, ui: Ctx): void {
    dim(c, 0.45);
    const offer = this.b.offer[this.me], i = this.reading();
    const [sx, sy, sw, sh] = screenRect(2);
    const x = sx + PAD, w = sw - PAD * 2;
    const card = i >= 0 ? CARDS[offer[i]] : null;
    if (!card) {
      // a short note at the bottom, so the dimmed fight still shows above it
      const h = 150, y = sy + sh - h - 12;
      win(ui, x, y, w, h);
      drawText(ui, this.twoPlayer ? `${this.b.f[this.me].name}: YOUR HAND` : 'YOUR HAND', x + 14, y + 14, this.me === 0 ? RED_INK : BLUE_INK, 3);
      ['HOLD A CARD TO READ IT', 'TAP OR FLICK UP TO QUEUE', 'FLICK DOWN TO TAKE IT BACK'].forEach((l, n) => drawText(ui, l, x + 14, y + 46 + n * 22, n ? INK2 : INK, 2));
      drawText(ui, this.rivalDeckText(), x + 14, y + h - 18, TRIM);
      return;
    }
    const y = sy + 12, h = sh - 24;
    win(ui, x, y, w, h, { accent: ELEMENT_COLOR[card.element] });
    const clipH = Math.min(150, Math.floor(h * 0.42));
    this.preview.draw(ui, x + 10, y + 10, w - 20, clipH);
    const plan = this.handPlan();
    drawCardDetail(ui, card, x + 14, y + clipH + 20, w - 28, h - clipH > 200 ? 2 : 1, plan.cost[i], plan.dmg[i]);
    const need = plan.short[i];
    if (need > 0) drawText(ui, CLASS_INFO[this.b.f[this.me].cls].builds ? `BUILD ${need} MORE ${resName(card)} IN THE FIGHT` : `NEED ${need} MORE ${resName(card)}`, x + 14, y + h - 20, CLASS_INFO[this.b.f[this.me].cls].builds ? resInk(card) : RED_INK);
  }

  /** The Draw screen under the fight: timer and resource, the cast order, the hand and FIGHT. */
  private drawCustomBelow(ui: Ctx, tick: number, top: number, a: { x: number; w: number }): void {
    const b = this.b, f = b.f[this.me], offer = b.offer[this.me];
    const x0 = a.x + PAD, w = a.w - PAD * 2;
    const { short, cost, dmg } = this.handPlan(), builds = !!CLASS_INFO[f.cls].builds;
    // header: turn, a big timer, the resource
    win(ui, x0 - 8, top + 12, w + 16, 40, { burn: 3 });
    drawText(ui, `TURN ${b.turn}`, x0 + 4, top + 26, this.twoPlayer ? (this.me === 0 ? RED_INK : BLUE_INK) : INK, 2);
    const secs = Math.ceil(this.timer);
    if (this.timed) drawTextCentered(ui, String(secs).padStart(2, '0'), UW / 2 - 40, top + 22, secs <= 5 && tick % 4 < 2 ? WAX_HI : RED_INK, 3, false);
    ui.save();
    ui.translate(0, top + 16);
    this.drawResourcePreview(ui, tick);
    ui.restore();

    // online, once your picks are in, the bar says what the screen is waiting on
    const barTop = this.waitingOn
      ? actionBar(ui, { back: false, primary: { id: 'fight', label: tick % 16 < 12 ? this.waitingOn : '', disabled: true } })
      : actionBar(ui, { back: 'CLEAR', primary: { id: 'fight', label: this.twoPlayer && this.me === 0 ? 'DONE' : 'FIGHT!' } });
    // the hand, resting just above the bar; picked cards rise
    const handY = barTop - 14 - CARD_H;
    offer.forEach((id, i) => {
      const x = handX(i, offer.length);
      const order = this.picks.indexOf(i), lvl = this.level(i);
      zone(`card:${i}`, x - 4, handY - 2 * LIFT, CARD_W + 8, CARD_H + 2 * LIFT + 10);
      const y = handY - Math.round(this.lift[i] ?? 0);
      drawCardFace(ui, CARDS[id], x, y, { order, lit: lvl === 1, short: short[i], builds, cost: cost[i], dmg: dmg[i] });
    });
    // the cast order: five slots
    const slotY = handY - 2 * LIFT - 14 - 44, n = 5, slw = Math.floor((w - GAP * (n - 1)) / n);
    for (let s = 0; s < n; s++) {
      const x = x0 + s * (slw + GAP), pick = this.picks[s];
      const cd = pick !== undefined ? CARDS[offer[pick]] : null;
      if (cd) {
        plaque(ui, x, slotY, slw, 44, false, PICKED);
        P(ui, ELEMENT_COLOR[cd.element], x + 3, slotY + 3, slw - 6, 3);
        drawText(ui, String(s + 1), x + 6, slotY + 12, PICKED, 2);
        const name = cd.name.toUpperCase(), lines = name.length > Math.floor((slw - 26) / 6) ? name.split(' ') : [name];
        lines.slice(0, 2).forEach((l, j) => drawText(ui, l.slice(0, Math.floor((slw - 26) / 6)), x + 22, slotY + (lines.length > 1 ? 10 + j * 12 : 16), INK));
      } else {
        P(ui, mix(FRAME, '#000000', 0.3), x, slotY, slw, 44);
        drawTextCentered(ui, String(s + 1), x + slw / 2, slotY + 15, TRIM, 2, false);
      }
    }
    drawText(ui, 'CAST ORDER', x0, slotY - 14, PAPER);
    const total = this.picks.reduce((acc, i) => acc + cost[i], 0);
    const over = !builds && this.picks.some(i => short[i] > 0);
    const label = `TOTAL COST ${total}`;
    drawText(ui, label, x0 + w - textWidth(label), slotY - 14, over ? '#f87858' : PAPER2);
  }

  /** Pause on phones: big buttons over the whole screen. */
  private drawPauseTall(ui: Ctx, tick: number): void {
    dim(ui, 0.6);
    const a = tallArea(), items = this.pauseItems, x0 = a.x + PAD, w = a.w - PAD * 2, bh = TAP + 14;
    const y0 = Math.round(a.y + a.h / 2 - (items.length * (bh + GAP)) / 2);
    drawTextCentered(ui, 'PAUSED', UW / 2, y0 - 60, '#fcfcfc', 4);
    items.forEach((it, i) => bigButton(ui, `menu:${i}`, it, x0, y0 + i * (bh + GAP), w, bh, { primary: i === 0, on: i === this.pauseSel && showSel() && i > 0 }));
    void tick;
  }

  /** Results on phones: the banner, the stats filling the screen, and the choices as big buttons in the thumb zone. */
  private drawResultTall(ui: Ctx, tick: number): void {
    const b = this.b, a = tallArea(), x0 = a.x + PAD, w = a.w - PAD * 2;
    dim(ui, 0.6);
    const won = b.winner === this.me, setWon = this.score[this.me] >= this.need;
    let title = this.m.bestOf === 1 ? (b.winner === null ? 'DRAW' : won ? 'YOU WIN!' : 'YOU LOSE')
      : this.setOver ? (setWon ? 'SET WON!' : 'SET LOST') : won ? 'ROUND WON' : 'ROUND LOST';
    let score = `YOU ${this.score[this.me]} - ${this.score[1 - this.me]} ${this.rivalName}`;
    if (this.humans.length !== 1) {
      const topSide: Side = this.setOver ? (this.score[0] >= this.need ? 0 : 1) : (b.winner ?? 0);
      const who = b.f[topSide].name;
      title = b.winner === null && !this.setOver ? 'DRAW' : this.m.bestOf === 1 ? `${who} WINS!` : this.setOver ? `${who} WINS THE SET` : `${who} WINS THE ROUND`;
      score = `${b.f[0].name} ${this.score[0]} - ${this.score[1]} ${b.f[1].name}`;
    }
    let y = a.y + 12;
    banner(ui, title, UW / 2, y, title.length > 14 ? 2 : 3);
    y += 48;
    if (this.m.bestOf > 1) { drawTextCentered(ui, score, UW / 2, y, '#fcfcfc', 2); y += 26; }
    // online ranked: the rating change; a tournament set: where it goes next
    const note = this.resultNote();
    if (note) { drawTextCentered(ui, note, UW / 2, y, '#f8b800', textWidth(note, 2) <= w ? 2 : 1); y += 26; }
    const items = this.resultItems, bh = TAP + 8, alert = this.resultAlert();
    const btnY = a.y + a.h - PAD - items.length * (bh + GAP) + GAP;
    // the rival's ask sits right over the buttons that answer it
    if (alert) {
      const ay = btnY - GAP - 32;
      win(ui, x0, ay, w, 32, { burn: 3, accent: '#f8b800' });
      drawTextCentered(ui, tick % 16 < 12 ? alert : '', UW / 2, ay + 11, RED_INK, 2, false);
    }
    const alertH = alert ? 32 + GAP : 0;
    const data = this.statsData();
    const best = topSpell(data.shown[this.me]);
    const bestH = best ? 64 : 0;
    const ph = btnY - 16 - bestH - alertH - y;
    this.statsRect = [x0, y, w, ph];
    this.statsPanel.draw(ui, data, x0, y, w, ph);
    if (best) {
      const by = y + ph + 8;
      win(ui, x0, by, w, 56, { burn: 3 });
      drawText(ui, 'BEST SPELL', x0 + 12, by + 10, RED_INK);
      drawText(ui, CARDS[best[0]].name.toUpperCase(), x0 + 12, by + 24, INK, 2);
      const done = best[1].heal > best[1].dmg ? `+${Math.round(best[1].heal)} HEALED` : `${Math.round(best[1].dmg)} DAMAGE`;
      drawText(ui, done, x0 + w - 12 - textWidth(done, 2), by + 24, INK2, 2);
    }
    const off = this.resultDisabled();
    items.forEach((it, i) => {
      const wait = i === 0 && this.waitingOn;
      bigButton(ui, `menu:${i}`, wait ? (tick % 16 < 12 ? wait : '') : it, x0, btnY + i * (bh + GAP), w, bh, { primary: i === 0, disabled: !!wait || !!off[i], on: i === this.resultSel && showSel() && i > 0 });
    });
  }

  private drawCastOrder(ui: Ctx, short: number[], cost: number[], builds: boolean, total: number): void {
    const f = this.b.f[this.me], offer = this.b.offer[this.me];
    drawText(ui, 'CAST ORDER', 254, 44, PICKED);
    if (!this.picks.length) drawText(ui, touchText('CLICK CARDS TO QUEUE THEM'), 254, 60, TRIM);
    this.picks.slice(0, 5).forEach((i, n) => {
      const cd = CARDS[offer[i]], y = 58 + n * 12;
      drawText(ui, `${n + 1}`, 254, y, PICKED);
      P(ui, ELEMENT_COLOR[cd.element], 266, y, 3, 7);
      drawText(ui, cd.name.toUpperCase(), 274, y, INK);
      // costs right-aligned at 462; one an earlier pick changed is green or red with its change beside it
      const sign = costSign(cd, cost[i]), now = sign ? String(cost[i]) : cd.cost === 'all' ? 'A' : String(cd.cost);
      const plain = short[i] > 0 ? (builds ? resInk(cd) : RED_INK) : INK;
      drawText(ui, now, 462 - textWidth(now), y, short[i] > 0 ? plain : modInk(sign, plain));
      if (sign) { const t = costDeltaText(cd, cost[i]); drawDelta(ui, t, sign, 462 - textWidth(now) - 8 - textWidth(t), y); }
    });
    const info = CLASS_INFO[f.cls];
    const over = !builds && this.picks.some(i => short[i] > 0);
    drawText(ui, `TOTAL COST ${total}`, 254, 118, over ? RED_INK : INK2);
    drawText(ui, info.refill, 462 - info.refill.length * 6, 118, TRIM);
  }

  /**
   * Each hand card's cost, damage multiplier (Arcane Blast's empower) and how much resource it is missing right now (0 = payable). Picked cards are
   * checked at their place in the cast order; the rest as if queued next, after what the picks spend, gain
   * and discount (Arcane Power picked first shows the next spells 1 cheaper).
   */
  private handPlan(): { short: number[]; cost: number[]; dmg: number[] } {
    const b = this.b, f = b.f[this.me], offer = b.offer[this.me];
    const picked = this.picks.map(i => CARDS[offer[i]]);
    const plan = b.planCosts(f, picked);
    const short: number[] = [], cost: number[] = [], dmg: number[] = [];
    offer.forEach((id, i) => {
      const at = this.picks.indexOf(i);
      const p = at >= 0 ? plan : b.planCosts(f, [...picked, CARDS[id]]), n = at >= 0 ? at : picked.length;
      short.push(Math.max(0, -p.left[n]));
      cost.push(p.cost[n]);
      dmg.push(p.dmg[n]);
    });
    return { short, cost, dmg };
  }

  /** Header resource pips, with what the picked spells would add blinking in. */
  private drawResourcePreview(ui: Ctx, tick: number): void {
    const b = this.b, f = b.f[this.me], offer = b.offer[this.me];
    const info = CLASS_INFO[f.cls];
    let gainMax = 0, gainRes = 0, refill = false;
    for (const i of this.picks) {
      const g = CARDS[offer[i]].gain;
      if (!g) continue;
      gainMax += g.max ?? 0; gainRes += g.res ?? 0; refill ||= !!g.refill;
    }
    const { cap, max } = classRules(f.cls).pool(f);
    const newMax = Math.min(cap, max + gainMax);
    const now = Math.floor(f.res);
    const after = Math.max(refill ? newMax : now, now) + gainRes;
    const slots = Math.max(cap, after);
    const blink = tick % 4 < 3;
    const x0 = UW - 10 - slots * 11;
    for (let i = 0; i < slots; i++) {
      const px = x0 + i * 11, py = 10;
      const isSlot = i < max, newSlot = !isSlot && i < newMax;
      if (newSlot && blink) disc(ui, px + 4, py + 4, 6, GOLD);
      const empty = isSlot ? BURN : newSlot ? PAPER2 : PAPER;
      if (i < now) pip(ui, px, py, i >= max ? '#f878f8' : info.pip);
      else if (i < after && blink) pip(ui, px, py, i >= newMax ? '#f8b8f8' : '#a4e4fc');
      else pip(ui, px, py, null, empty);
    }
    drawText(ui, info.res, x0 - info.res.length * 6 - 6, 11, RES_INK[info.res]);
    const parts: string[] = [];
    if (newMax > max) parts.push(`+${newMax - max} MAX`);
    if (after > now) parts.push(refill && after - now > gainRes ? 'REFILL' : `+${after - now}`);
    if (parts.length) drawText(ui, parts.join(' '), x0 - info.res.length * 6 - 12 - textWidth(parts.join(' ')), 11, RED_INK);
  }
}
