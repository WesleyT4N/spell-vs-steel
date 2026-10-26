// Character select: a roster row of fighters, your pick on the left and the CPU's (or your rival's) on the right.
// Pick a fighter, then a skin; against the CPU you then pick its fighter the same way. Stage select comes next.
// The tutorial uses it too, to pick the class to learn (the right side shows the training dummy),
// and so does training mode, where the right side picks the dummy's class.
import { setScene, hint, zone, hot, isHot, button, showSel, type Scene } from './scene';
import { PLAYABLE, CLASS_INFO } from '../game/classes';
import { getArena } from '../game/battleView';
import { drawStage } from '../art/arena';
import { getSprite, drawFighterSprite, teamColor, SKINS, skinOf, mirrorSkin, type ClassId } from '../art/sprites';
import { P, UW, screenRect, fillScreen, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered } from '../engine/font';
import { win, plaque, banner, vsSeal, FRAME, GOLD, INK, INK2, TRIM, BURN, RED_INK, BLUE_INK } from './skin';
import { wasPressed, navPressed, k, mouse } from '../engine/input';
import { sfx } from '../engine/audio';
import { loadMatch, saveMatch, playerDeck, cycleDeck, type MatchConfig } from '../game/match';
import { loadCustom, validate, presetName } from '../game/deck';
import type { NetSession } from '../net/session';
import { DeckBuilderScene } from './deckbuilder';
import { StageSelectScene } from './stageSelect';
import { TitleScene } from './title';
import { TutorialScene, type TutorialClass } from './tutorial';
import { TrainingScene } from './training';
import { useStage } from '../game/battleView';
import { STAGE_IDS } from '../art/stages';

/** Roster tiles: every playable class, then RANDOM. */
const TILES = PLAYABLE.length + 1;
const RANDOM = PLAYABLE.length;

const BLURB: Record<ClassId, [string, string]> = {
  warrior: ['HEAVY ARMOR, BIG HITS', 'HITS BUILD RAGE'],
  mage: ['GLASS CANNON', 'MANA GROWS EVERY DRAW'],
  rogue: ['CHAINS CHEAP CARDS', 'STRIKES FROM BEHIND'],
  ranger: ['ARROWS, TRAPS AND PETS', 'STAND STILL FOR ENERGY'],
  cleric: ['OUTLASTS AND CHIPS', 'HEALS AND CURSES'],
};

/** 0/1: picking YOUR fighter/skin, 2/3: the CPU's (skipped online), 4: options. */
type Step = 0 | 1 | 2 | 3 | 4;
type Chip = 'DECK' | 'EDIT DECK' | 'CPU LEVEL' | 'MATCH' | 'NEXT';
/** What the screen leads to: a match against the CPU, the tutorial, or training mode. */
export type SelectMode = 'versus' | 'tutorial' | 'training';

// layout (UI pixels)
const PX = [12, UW - 152], PY = 30, PW = 140, PH = 164;
const TW = 60, TH = 54, TGAP = 8, TY = 210;
const TX0 = Math.round(UW / 2 - (TILES * TW + (TILES - 1) * TGAP) / 2);
const CY = 272, CH = 20;

export class CharSelectScene implements Scene {
  m: MatchConfig = loadMatch();
  step: Step = 0;
  /** Roster cursor for the slot being picked. */
  cur: number;
  chip = 0;
  /** Online: picks sent and final, waiting on the rival. */
  locked = false;
  msg = '';
  msgT = 0;
  /** Online: the session whose rival fills the right-hand slot. `tutorial`: pick the class to learn, then start it. */
  constructor(private net?: NetSession, startAt: Step = 0, private mode: SelectMode = 'versus') {
    this.step = net ? 0 : startAt;
    this.cur = this.tileOf(this.slotClass(this.step >= 2 && !net ? 1 : 0));
    if (net) this.sync();
  }

  private get tutorial(): boolean { return this.mode === 'tutorial'; }
  private get training(): boolean { return this.mode === 'training'; }
  private get chips(): Chip[] { return this.net ? ['DECK', 'NEXT'] : this.training ? ['DECK', 'EDIT DECK', 'NEXT'] : ['DECK', 'EDIT DECK', 'CPU LEVEL', 'MATCH', 'NEXT']; }
  private get slot(): 0 | 1 { return !this.net && (this.step === 2 || this.step === 3) ? 1 : 0; }
  private slotClass(s: 0 | 1): ClassId { return s === 0 ? this.m.p1 : this.m.cpu; }
  private tileOf(cls: ClassId): number { const i = PLAYABLE.indexOf(cls); return i < 0 ? 0 : i; }

  private customValid(): boolean {
    const d = loadCustom(this.m.p1);
    return !!d && validate(d).length === 0;
  }
  private mySkin(): string { return skinOf(this.m.p1, this.m.p1Skin[this.m.p1]).id; }
  private cpuSkin(): string {
    return this.m.p1 === this.m.cpu ? mirrorSkin(this.m.cpu, this.mySkin(), this.m.cpuSkin[this.m.cpu]) : skinOf(this.m.cpu, this.m.cpuSkin[this.m.cpu]).id;
  }

  /** Online: tell the rival what we're showing. */
  private sync(): void {
    const net = this.net;
    if (!net) return;
    net.hello = { cls: this.m.p1, skin: this.mySkin(), deck: playerDeck(this.m) };
    // the rival sees 0 while we choose a fighter, 1 until we lock in, 2 once locked
    net.lobby = { ...net.lobby, step: this.locked ? 2 : this.step === 0 ? 0 : 1, tile: this.cur };
  }

  private setClass(s: 0 | 1, cls: ClassId): void {
    if (s === 0) { if (cls !== this.m.p1) this.m.p1Deck = 'starter'; this.m.p1 = cls; }
    else { if (cls !== this.m.cpu && this.m.cpuDeck !== 'random') this.m.cpuDeck = 'starter'; this.m.cpu = cls; }
    saveMatch(this.m);
  }

  private stepSkin(s: 0 | 1, d: 1 | -1): void {
    const cls = this.slotClass(s), list = SKINS[cls].map(x => x.id), skins = s === 0 ? this.m.p1Skin : this.m.cpuSkin;
    const i = list.indexOf(skinOf(cls, skins[cls]).id);
    skins[cls] = list[(i + d + list.length) % list.length];
    sfx('move');
    saveMatch(this.m);
  }

  /** Your deck cycles through the ready-made decks and your custom one; the CPU's through the ready-made ones and RANDOM. */
  private stepDeck(s: 0 | 1, d: 1 | -1): void {
    if (s === 0) this.m.p1Deck = cycleDeck(this.m.p1, this.m.p1Deck, 'custom', d);
    else this.m.cpuDeck = cycleDeck(this.m.cpu, this.m.cpuDeck, 'random', d);
    sfx('move');
    saveMatch(this.m);
  }

  /** Name shown for a slot's deck. */
  private deckLabel(s: 0 | 1, cls: ClassId): string {
    if (s === 0) return this.m.p1Deck === 'custom' ? `CUSTOM${this.customValid() ? '' : '!'}` : presetName(cls, this.m.p1Deck).toUpperCase();
    return this.m.cpuDeck === 'random' ? 'RANDOM' : presetName(cls, this.m.cpuDeck).toUpperCase();
  }

  /** Lock in the hovered tile for the current slot and move on to its skin. */
  private pickTile(n: number): void {
    const cls = n === RANDOM ? PLAYABLE[Math.floor(Math.random() * PLAYABLE.length)] : PLAYABLE[n];
    this.cur = this.tileOf(cls);
    this.setClass(this.slot, cls);
    this.step = (this.slot === 0 ? 1 : 3) as Step;
    sfx('select');
  }

  private advance(): void {
    if (this.tutorial) { sfx('select'); setScene(new TutorialScene(this.m.p1 as TutorialClass)); return; }
    if (this.step === 1 && !this.net) { this.step = 2; this.cur = this.tileOf(this.m.cpu); sfx('select'); }
    else if (this.step === 1 || this.step === 3) { this.step = 4; this.chip = this.chips.length - 1; sfx('select'); }
  }

  private back(): void {
    sfx('back');
    if (this.net) {
      if (this.step === 4 && !this.locked) { this.step = 1; return; }
      if (this.step === 1) { this.step = 0; return; }
      // locked in is final online; backing out leaves the room
      this.net.leave();
      setScene(new TitleScene());
      return;
    }
    if (this.step === 0) { setScene(new TitleScene()); return; }
    this.step = (this.step === 4 && this.net ? 1 : this.step - 1) as Step;
    if (this.step === 0 || this.step === 2) this.cur = this.tileOf(this.slotClass(this.slot));
  }

  private activateChip(c: Chip): void {
    if (c === 'DECK') { this.stepDeck(0, 1); return; }
    else if (c === 'EDIT DECK') { sfx('select'); saveMatch(this.m); setScene(new DeckBuilderScene(this.m.p1, () => setScene(new CharSelectScene(undefined, 4, this.mode)))); return; }
    else if (c === 'CPU LEVEL') { this.m.difficulty = this.m.difficulty === 'easy' ? 'normal' : 'easy'; sfx('move'); }
    else if (c === 'MATCH') { const o = [1, 3, 5] as const; this.m.bestOf = o[(o.indexOf(this.m.bestOf) + 1) % o.length]; sfx('move'); }
    else if (c === 'NEXT') { this.next(); return; }
    saveMatch(this.m);
  }

  /** On to the stage select (online: lock in and wait for the rival). */
  private next(): void {
    if (this.m.p1Deck === 'custom' && !this.customValid()) {
      this.msg = 'YOUR CUSTOM DECK IS NOT READY'; this.msgT = 2; sfx('deny');
      return;
    }
    saveMatch(this.m);
    if (this.net) { this.locked = true; sfx('confirm'); this.sync(); return; }
    sfx('select');
    if (this.training) {
      // training skips the stage select and uses the last stage picked
      useStage(this.m.stage === 'random' || !STAGE_IDS.includes(this.m.stage) ? STAGE_IDS[Math.floor(Math.random() * STAGE_IDS.length)] : this.m.stage);
      setScene(new TrainingScene(this.m));
      return;
    }
    setScene(new StageSelectScene());
  }

  update(dt: number): void {
    this.msgT = Math.max(0, this.msgT - dt);
    const net = this.net;
    if (net) {
      net.tick();
      if (net.status === 'error' || net.status === 'left' || net.status === 'lost') {
        if (mouse.click || wasPressed('confirm') || wasPressed('back') || mouse.rclick) { net.transport.close(); setScene(new TitleScene()); }
        return;
      }
      if (this.locked && net.rivalLobby?.step === 2 && net.rival) { setScene(new StageSelectScene(net)); return; }
      if (this.locked) { if (wasPressed('back') || mouse.rclick) this.back(); return; }
    }
    if (wasPressed('back') || mouse.rclick) { this.back(); return; }

    if (mouse.click) {
      const tile = hot('tile'), sw = hot('swatch'), csw = hot('cswatch'), chip = hot('chip'), deck = hot('deck');
      if (deck >= 0) { this.stepDeck(deck as 0 | 1, 1); this.sync(); return; }
      if (tile >= 0) {
        // a tile picks for the slot being chosen; once both are set it re-picks yours
        if (this.step === 4 || this.step === 1) this.step = 0;
        if (this.step === 3) this.step = 2;
        this.cur = tile;
        this.pickTile(tile);
        this.sync();
        return;
      }
      if (sw >= 0 || csw >= 0) {
        const s: 0 | 1 = sw >= 0 ? 0 : 1, n = sw >= 0 ? sw : csw, cls = this.slotClass(s);
        (s === 0 ? this.m.p1Skin : this.m.cpuSkin)[cls] = SKINS[cls][n].id;
        saveMatch(this.m);
        sfx('select');
        // in the skin step a click is also the confirm
        if ((s === 0 && this.step === 1) || (s === 1 && this.step === 3)) this.advance();
        this.sync();
        return;
      }
      if (chip >= 0) { this.chip = chip; this.activateChip(this.chips[chip]); this.sync(); return; }
      if (!net && !this.tutorial && isHot('panel:1') && this.step !== 2) { this.step = 2; this.cur = this.tileOf(this.m.cpu); sfx('move'); return; }
      if (isHot('panel:0') && this.step !== 0) { this.step = 0; this.cur = this.tileOf(this.m.p1); sfx('move'); this.sync(); return; }
    }

    const l = navPressed('left', dt), r = navPressed('right', dt), d: 1 | -1 = r ? 1 : -1;
    const ok = wasPressed('confirm') || wasPressed('custom');
    if (this.step === 0 || this.step === 2) {
      const h = hot('tile');
      if (mouse.moved && h >= 0 && h !== this.cur) { this.cur = h; sfx('move'); }
      if (l || r) { this.cur = (this.cur + d + TILES) % TILES; sfx('move'); }
      if (ok) this.pickTile(this.cur);
    } else if (this.step === 1 || this.step === 3) {
      if (l || r) this.stepSkin(this.slot, d);
      if (navPressed('up', dt)) this.stepDeck(this.slot, -1);
      if (navPressed('down', dt)) this.stepDeck(this.slot, 1);
      if (ok) this.advance();
    } else {
      const n = this.chips.length, h = hot('chip');
      if (mouse.moved && h >= 0) this.chip = h;
      if (l || r) { this.chip = (this.chip + d + n) % n; sfx('move'); }
      if (navPressed('up', dt) || navPressed('down', dt)) this.activateChip(this.chips[this.chip]);
      else if (ok) this.activateChip(this.chips[this.chip]);
    }
    this.sync();
  }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    drawStage(c, getArena(), tick);
    c.fillStyle = 'rgba(40,20,0,0.35)';
    c.fillRect(...screenRect());

    const net = this.net, rl = net?.rivalLobby, rival = net?.rival;
    // what each slot shows: the hovered tile while choosing, the pick after
    const showing = (s: 0 | 1): { cls: ClassId | null; skin: string } => {
      if (s === 1 && net) {
        if (!rival || !rl) return { cls: null, skin: '' };
        if (rl.step === 0) return { cls: rl.tile === RANDOM ? null : PLAYABLE[rl.tile] ?? null, skin: '' };
        return { cls: rival.cls, skin: rival.skin };
      }
      const choosing = s === this.slot && (this.step === 0 || this.step === 2);
      if (choosing && showSel()) return { cls: this.cur === RANDOM ? null : PLAYABLE[this.cur], skin: '' };
      return { cls: this.slotClass(s), skin: s === 0 ? this.mySkin() : this.cpuSkin() };
    };
    this.drawSlot(ui, 0, showing(0), tick);
    if (this.tutorial) this.drawDummy(ui);
    else this.drawSlot(ui, 1, showing(1), tick);

    // drawn after the slots so its rolled ends sit on top of them
    banner(ui, this.tutorial ? 'TUTORIAL' : this.training ? 'TRAINING' : 'CHOOSE YOUR FIGHTER', UW / 2, 3);

    // VS and the matchup
    vsSeal(ui, UW / 2, 90);
    const status = this.statusLine();
    if (status) drawTextCentered(ui, tick % 16 < 12 || !status.blink ? status.text : '', UW / 2, 130, status.color, 1);

    // roster row
    for (let n = 0; n < TILES; n++) {
      const x = TX0 + n * (TW + TGAP);
      zone(`tile:${n}`, x, TY, TW, TH);
      const mine = (this.step === 0 || this.step === 2) && this.cur === n && showSel();
      const theirs = net && rl && rl.step === 0 && rl.tile === n;
      const picked0 = n === PLAYABLE.indexOf(this.m.p1) && this.step !== 0, picked1 = !net && n === PLAYABLE.indexOf(this.m.cpu) && this.step >= 3;
      const text = plaque(ui, x, TY, TW, TH, !!mine, !mine && hot('tile') === n ? GOLD : FRAME);
      if (n === RANDOM) drawTextCentered(ui, '?', x + TW / 2, TY + 12, mine ? GOLD : RED_INK, 4, false);
      else {
        const cls = PLAYABLE[n];
        drawFighterSprite(ui, getSprite(cls, SKINS[cls][0].id, false), x + TW / 2, TY + TH - 10, false, 'none', 2);
      }
      drawTextCentered(ui, n === RANDOM ? 'RANDOM' : CLASS_INFO[PLAYABLE[n]].name, x + TW / 2, TY + TH - 8, text, 1, false);
      // cursor tags, fighting-game style: yours top left, theirs top right
      const tag = (label: string, color: string, right: boolean): void => {
        const tw = label.length * 6 + 3, tx = right ? x + TW - tw : x;
        P(ui, color, tx, TY - 10, tw, 10);
        drawText(ui, label, tx + 2, TY - 8, '#fcfcfc');
      };
      if (mine && (this.slot === 0 || tick % 8 < 6)) tag(this.slot === 0 ? 'YOU' : this.training ? 'DUMMY' : 'CPU', this.slot === 0 ? '#d82800' : '#0058f8', this.slot === 1);
      else if (picked0) tag('YOU', '#881400', false);
      if (theirs) tag('RIVAL', '#0058f8', true);
      else if (net && rl && rl.step > 0 && rival && n === PLAYABLE.indexOf(rival.cls)) tag('RIVAL', '#0000a8', true);
      else if (picked1) tag(this.training ? 'DUMMY' : 'CPU', '#0000a8', true);
    }

    // option chips
    if (!this.tutorial && (this.step === 4 || !net)) {
      const chips = this.chips, cw = net ? 140 : 86, gap = 6, x0 = Math.round(UW / 2 - (chips.length * cw + (chips.length - 1) * gap) / 2);
      chips.forEach((ch, i) => {
        const x = x0 + i * (cw + gap), on = this.step === 4 && this.chip === i && showSel();
        let label: string = ch;
        if (ch === 'DECK') label = this.m.p1Deck === 'custom' ? `CUSTOM DECK${this.customValid() ? '' : '!'}` : presetName(this.m.p1, this.m.p1Deck).toUpperCase();
        if (ch === 'CPU LEVEL') label = `CPU: ${this.m.difficulty.toUpperCase()}`;
        if (ch === 'MATCH') label = this.m.bestOf === 1 ? '1 ROUND' : `BEST OF ${this.m.bestOf}`;
        if (ch === 'NEXT') label = net ? (this.locked ? 'LOCKED IN' : 'LOCK IN') : this.training ? 'START →' : 'STAGE →';
        button(ui, `chip:${i}`, label, x, CY, cw, CH, on, ch === 'NEXT' ? (this.step === 4 ? '#f8b800' : '#7c7c7c') : '#fcfcfc');
      });
    }
    if (this.msgT > 0) { P(ui, FRAME, screenRect(2)[0], 186, screenRect(2)[2], 16); drawTextCentered(ui, this.msg, UW / 2, 190, '#f87858', 1, false); }

    if (net && (net.status === 'error' || net.status === 'left' || net.status === 'lost')) {
      fillScreen(ui, 'rgba(0,0,0,0.8)', 2);
      drawTextCentered(ui, net.status === 'left' ? 'YOUR RIVAL LEFT' : net.status === 'lost' ? 'CONNECTION LOST' : net.error || 'CONNECTION ERROR', UW / 2, 140, '#f83800', 2);
      hint(ui, 'CLICK: BACK TO TITLE');
      return;
    }
    const keys = `${k('left')}/${k('right')}`;
    hint(ui, this.step === 1 || this.step === 3 ? `${keys}: SKIN   ${this.tutorial ? '' : `${k('up')}/${k('down')}: DECK   `}${k('attack')} / CLICK A COLOR: ${this.tutorial ? 'START' : 'OK'}   ${k('cast')}: BACK`
      : this.locked ? `${k('cast')} / RIGHT-CLICK: LEAVE ROOM`
        : this.step === 4 ? `${keys}: MOVE   ${k('attack')}: CHANGE   ${k('cast')} / RIGHT-CLICK: BACK`
          : `${keys} OR HOVER: CHOOSE   ${k('attack')} / CLICK: PICK   ${k('cast')} / RIGHT-CLICK: BACK`);
  }

  private statusLine(): { text: string; color: string; blink: boolean } | null {
    const net = this.net;
    if (net) {
      const rl = net.rivalLobby;
      if (this.locked) return { text: rl?.step === 2 ? 'BOTH READY!' : 'WAITING FOR RIVAL...', color: '#f8b800', blink: true };
      if (rl?.step === 2) return { text: 'RIVAL IS LOCKED IN', color: '#58d854', blink: false };
      return null;
    }
    if (this.tutorial) return { text: this.step === 0 ? 'PICK A CLASS TO LEARN' : 'PICK A COLOR TO START', color: '#fcfcfc', blink: this.step === 0 };
    if (this.step === 0) return { text: 'PICK YOUR FIGHTER', color: '#fcfcfc', blink: true };
    if (this.step === 2) return { text: this.training ? 'PICK THE DUMMY' : 'PICK THE CPU FIGHTER', color: '#fcfcfc', blink: true };
    if (this.step === 1 || this.step === 3) return { text: 'PICK A COLOR', color: '#fcfcfc', blink: true };
    return null;
  }

  /** Tutorial: the opponent is always the training dummy. */
  private drawDummy(ui: Ctx): void {
    const x = PX[1], cx = x + PW / 2;
    win(ui, x, PY, PW, PH);
    drawTextCentered(ui, 'OPPONENT', cx, PY + 10, TRIM, 1, false);
    drawFighterSprite(ui, getSprite('mage', SKINS.mage[0].id, false), cx, PY + 86, true, 'ghost', 3);
    P(ui, BURN, cx - 20, PY + 87, 40, 2);
    drawTextCentered(ui, 'DUMMY', cx, PY + 94, INK2, 2, false);
    ['A TRAINING DUMMY', 'ABOUT 5 MINUTES', 'OF LESSONS'].forEach((l, i) => drawTextCentered(ui, l, cx, PY + 112 + i * 9, TRIM, 1, false));
  }

  private drawSlot(ui: Ctx, s: 0 | 1, show: { cls: ClassId | null; skin: string }, tick: number): void {
    const x = PX[s], net = this.net;
    const cls = show.cls, skin = cls ? show.skin || SKINS[cls][0].id : '';
    zone(`panel:${s}`, x, PY, PW, PH);
    const active = s === this.slot && this.step < 4;
    // a parchment page with a ribbon in the fighter's color; the slot being chosen blinks a gold frame
    win(ui, x, PY, PW, PH, { accent: cls ? teamColor(cls, skin, false) : undefined, edge: active && tick % 8 < 6 ? GOLD : FRAME });
    const who = s === 0 ? 'YOU' : net ? 'RIVAL' : this.training ? 'DUMMY' : 'CPU';
    drawTextCentered(ui, who, x + PW / 2, PY + 10, s === 0 ? RED_INK : BLUE_INK, 1, false);
    const cx = x + PW / 2, bob = Math.floor(tick / 4 + s) % 2;
    if (!cls) {
      drawTextCentered(ui, '?', cx, PY + 36, TRIM, 6, false);
      drawTextCentered(ui, net && s === 1 && !net.rival ? 'CONNECTING...' : 'RANDOM', cx, PY + 94, INK2, 2, false);
      return;
    }
    drawFighterSprite(ui, getSprite(cls, skin, false), cx, PY + 86 - bob * 2, s === 1, 'none', 3);
    P(ui, BURN, cx - 20, PY + 87, 40, 2);
    drawTextCentered(ui, CLASS_INFO[cls].name, cx, PY + 94, INK, 2, false);
    BLURB[cls].forEach((l, i) => drawTextCentered(ui, l, cx, PY + 112 + i * 9, INK2, 1, false));
    // skins: clickable swatches for your slot (and the CPU's)
    const list = SKINS[cls], sw = 14, sx = Math.round(cx - (list.length * sw) / 2);
    const editable = s === 0 || !net;
    // the deck line is a button: click (or up/down while picking a color) steps through the decks
    if (!(net && s === 1) && !this.tutorial) {
      const text = `DECK: ${this.deckLabel(s, cls)}`, tw = text.length * 6 + 20;
      zone(`deck:${s}`, cx - tw / 2, PY + 129, tw, 12);
      const lit = hot('deck') === s;
      drawTextCentered(ui, `< ${text} >`, cx, PY + 132, lit ? RED_INK : TRIM, 1, false);
    }
    if (!editable) return;
    const skinStep = (s === 0 && this.step === 1) || (s === 1 && this.step === 3);
    list.forEach((sk, n) => {
      const px = sx + n * sw, py = PY + 146;
      zone(`${s === 0 ? 'swatch' : 'cswatch'}:${n}`, px, py - 1, sw, 12);
      if (sk.id === skin) P(ui, skinStep && tick % 8 >= 6 ? GOLD : INK, px, py - 1, 12, 12);
      P(ui, '#000000', px + 2, py + 1, 8, 8);
      P(ui, teamColor(cls, sk.id, false), px + 3, py + 2, 6, 6);
    });
  }
}
