// Character select: a roster row of fighters, the left side's pick on the left and the right side's on the right.
// Pick a fighter, then a skin, for the left side and then the right. In local Versus each side's header toggles
// it between a player and the CPU (you vs CPU on either side, two players on one keyboard, or CPU vs CPU), and
// each side picks its own deck. Online the right side is your rival. Stage select comes next.
// The tutorial uses it too, to pick the class to learn (the right side shows the training dummy),
// and so does training mode, where the right side picks the dummy's class, and arcade mode, where you only pick yourself.
import { pushScene, popScene, goHome, hint, zone, hot, isHot, button, showSel, type Scene } from './scene';
import { PLAYABLE, CLASS_INFO } from '../game/classes';
import { getArena } from '../game/battleView';
import { drawStage } from '../art/arena';
import { getSprite, getPortrait, drawFighterSprite, teamColor, SKINS, skinOf, mirrorSkin, type ClassId } from '../art/sprites';
import { P, UW, screenRect, fillScreen, vy, vspan, mix, dith, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered } from '../engine/font';
import { win, plaque, banner, vsSeal, FRAME, GOLD, INK, INK2, TRIM, PAPER, RED_INK, BLUE_INK } from './skin';
import { wasPressed, navPressed, k, mouse } from '../engine/input';
import { sfx } from '../engine/audio';
import { loadMatch, saveMatch, playerDeck, sideName, cycleDeck, deckLabel, type MatchConfig } from '../game/match';
import { loadCustom, validate } from '../game/deck';
import type { NetSession } from '../net/session';
import { DeckBuilderScene } from './deckbuilder';
import { StageSelectScene } from './stageSelect';
import { TutorialScene, type TutorialClass } from './tutorial';
import { TrainingScene } from './training';
import { ArcadeLadderScene } from './arcade';
import { newRun, loadRecords, clock } from '../game/arcade';
import { useStage } from '../game/battleView';
import { STAGE_IDS } from '../content/stages';

/** Roster tiles: every playable class, then RANDOM. */
const TILES = PLAYABLE.length + 1;
const RANDOM = PLAYABLE.length;

const BLURB: Record<ClassId, [string, string]> = {
  warrior: ['HEAVY ARMOR, BIG HITS', 'HITS BUILD RAGE'],
  mage: ['GLASS CANNON', 'MANA GROWS EVERY DRAW'],
  rogue: ['CHAINS CHEAP CARDS', 'STRIKES FROM BEHIND'],
  ranger: ['ARROWS, TRAPS AND PETS', 'STAND STILL FOR ENERGY'],
  priest: ['OUTLASTS AND CHIPS', 'HEALS AND CURSES'],
};

/** Portrait backdrops: a dark wash in each class's element (steel, arcane, shadow, nature, holy), dark to light. */
const BACKDROP: Record<ClassId, [string, string, string]> = {
  warrior: ['#1c1c38', '#3c3c3c', '#7c7c7c'],
  mage: ['#1c1c38', '#4428bc', '#940084'],
  rogue: ['#000000', '#1c1c38', '#5b162a'],
  ranger: ['#002800', '#005800', '#00a800'],
  priest: ['#503000', '#ac7c00', '#f8d878'],
};
// portrait frame (UI pixels): the 40x32 bust at 2x inside a 2px ink border
const FW = 84, FH = 68, PORTRAIT_IN = 0.18;

/** 0/1: picking the left side's fighter/skin, 2/3: the right side's (skipped online), 4: options. */
type Step = 0 | 1 | 2 | 3 | 4;
type Chip = 'SPELL DECK' | 'EDIT SPELL DECK' | 'CPU LEVEL' | 'MATCH' | 'NEXT';
/** What the screen leads to: a match against the CPU, the tutorial, training mode, or an arcade run. */
export type SelectMode = 'versus' | 'tutorial' | 'training' | 'arcade';

// layout (UI pixels)
const PX = [12, UW - 152], PY = 30, PW = 140, PH = 164;
const TW = 60, TH = 54, TGAP = 8, TILE_Y = 210;
const TX0 = Math.round(UW / 2 - (TILES * TW + (TILES - 1) * TGAP) / 2);
const CY = 272, CH = 20;

export class CharSelectScene implements Scene {
  /** Top of the fighter panels; phone portrait moves them up into the spare height. */
  private get py(): number { return vy(PY); }
  m: MatchConfig = loadMatch();
  step: Step = 0;
  /** Roster cursor for the slot being picked. */
  cur: number;
  chip = 0;
  /** Online: picks sent and final, waiting on the rival. */
  locked = false;
  msg = '';
  msgT = 0;
  /** Local Versus: the side EDIT DECK opens, the last one picked for or clicked. */
  focus: 0 | 1 = 0;
  t = 0;
  /** Per side: the portrait on show and when it arrived, so a new pick slides in. */
  shown: Array<{ key: string; at: number }> = [{ key: '', at: -1 }, { key: '', at: -1 }];
  /** Online: the session whose rival fills the right-hand slot. `tutorial`: pick the class to learn, then start it. */
  constructor(private net?: NetSession, startAt: Step = 0, private mode: SelectMode = 'versus') {
    this.step = net ? 0 : startAt;
    this.cur = this.tileOf(this.slotClass(this.step >= 2 && !net ? 1 : 0));
    if (net) this.sync();
  }

  /** Back from the deck builder, the stage select or a fight: pick up what they saved (decks, stage). */
  resume(): void { this.m = loadMatch(); this.msgT = 0; }

  private get tutorial(): boolean { return this.mode === 'tutorial'; }
  private get training(): boolean { return this.mode === 'training'; }
  /** Arcade: you pick only your own fighter and deck; the ladder picks the rivals. */
  private get arcade(): boolean { return this.mode === 'arcade'; }
  /** Local Versus: both sides can be a player or the CPU, and each picks a deck on its panel. */
  private get local(): boolean { return this.mode === 'versus' && !this.net; }
  private get chips(): Chip[] { return this.net ? ['SPELL DECK', 'NEXT'] : this.training || this.arcade ? ['SPELL DECK', 'EDIT SPELL DECK', 'NEXT'] : ['EDIT SPELL DECK', 'CPU LEVEL', 'MATCH', 'NEXT']; }
  /** What a side is called on this screen. */
  private who(s: 0 | 1): string {
    if (this.local) return sideName(this.m.sides, s);
    return s === 0 ? 'YOU' : this.net ? 'RIVAL' : this.training ? 'DUMMY' : 'CPU';
  }
  private get slot(): 0 | 1 { return !this.net && (this.step === 2 || this.step === 3) ? 1 : 0; }
  private slotClass(s: 0 | 1): ClassId { return s === 0 ? this.m.p1 : this.m.cpu; }
  private tileOf(cls: ClassId): number { const i = PLAYABLE.indexOf(cls); return i < 0 ? 0 : i; }

  private customValid(s: 0 | 1 = 0): boolean {
    const d = loadCustom(this.slotClass(s));
    return !!d && validate(d).length === 0;
  }
  private deckOf(s: 0 | 1): string { return s === 0 ? this.m.p1Deck : this.m.cpuDeck; }

  private toggleCtl(s: 0 | 1): void {
    this.m.sides[s] = this.m.sides[s] === 'player' ? 'cpu' : 'player';
    sfx('move');
    saveMatch(this.m);
  }
  /** Steps a side's deck through the ready-made decks (starter, then one per Mythic), the custom deck and RANDOM. */
  private toggleDeck(s: 0 | 1, d: 1 | -1 = 1): void {
    if (s === 0) this.m.p1Deck = cycleDeck(this.m.p1, this.m.p1Deck, d);
    else this.m.cpuDeck = cycleDeck(this.m.cpu, this.m.cpuDeck, d);
    sfx('move');
    saveMatch(this.m);
  }
  private editDeck(s: 0 | 1): void {
    sfx('select');
    saveMatch(this.m);
    pushScene(new DeckBuilderScene(this.slotClass(s)));
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
    // a new class starts on its starter (RANDOM stays RANDOM)
    if (s === 0) { if (cls !== this.m.p1 && this.m.p1Deck !== 'random') this.m.p1Deck = 'starter'; this.m.p1 = cls; }
    else { if (cls !== this.m.cpu && this.m.cpuDeck !== 'random') this.m.cpuDeck = 'starter'; this.m.cpu = cls; }
    this.focus = s;
    saveMatch(this.m);
  }

  private stepSkin(s: 0 | 1, d: 1 | -1): void {
    const cls = this.slotClass(s), list = SKINS[cls].map(x => x.id), skins = s === 0 ? this.m.p1Skin : this.m.cpuSkin;
    const i = list.indexOf(skinOf(cls, skins[cls]).id);
    skins[cls] = list[(i + d + list.length) % list.length];
    sfx('move');
    saveMatch(this.m);
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
    if (this.tutorial) { sfx('select'); pushScene(new TutorialScene(this.m.p1 as TutorialClass)); return; }
    if (this.step === 1 && !this.net && !this.arcade) { this.step = 2; this.cur = this.tileOf(this.m.cpu); sfx('select'); }
    else if (this.step === 1 || this.step === 3) { this.step = 4; this.chip = this.chips.length - 1; sfx('select'); }
  }

  private back(): void {
    sfx('back');
    if (this.net) {
      if (this.step === 4 && !this.locked) { this.step = 1; return; }
      if (this.step === 1) { this.step = 0; return; }
      // locked in is final online; backing out leaves the room
      this.net.leave();
      goHome();
      return;
    }
    if (this.step === 0) { popScene(); return; }
    this.step = (this.step === 4 && (this.net || this.arcade) ? 1 : this.step - 1) as Step;
    if (this.step === 0 || this.step === 2) this.cur = this.tileOf(this.slotClass(this.slot));
  }

  private activateChip(c: Chip): void {
    if (c === 'SPELL DECK') { this.toggleDeck(0); return; }
    else if (c === 'EDIT SPELL DECK') { this.editDeck(this.local ? this.focus : 0); return; }
    else if (c === 'CPU LEVEL') { this.m.difficulty = this.m.difficulty === 'easy' ? 'normal' : this.m.difficulty === 'normal' ? 'hard' : 'easy'; sfx('move'); }
    else if (c === 'MATCH') { const o = [1, 3, 5] as const; this.m.bestOf = o[(o.indexOf(this.m.bestOf) + 1) % o.length]; sfx('move'); }
    else if (c === 'NEXT') { this.next(); return; }
    saveMatch(this.m);
  }

  /** On to the stage select (online: lock in and wait for the rival). */
  private next(): void {
    for (const s of this.local ? [0, 1] as const : [0] as const) {
      if (this.deckOf(s) === 'custom' && !this.customValid(s)) {
        this.msg = this.local ? `${this.who(s)}'S CUSTOM ${CLASS_INFO[this.slotClass(s)].name} SPELL DECK IS NOT READY` : 'YOUR CUSTOM SPELL DECK IS NOT READY';
        this.msgT = 2; sfx('deny');
        return;
      }
    }
    saveMatch(this.m);
    if (this.net) { this.locked = true; sfx('confirm'); this.sync(); return; }
    sfx('select');
    if (this.arcade) { pushScene(new ArcadeLadderScene(newRun(this.m))); return; }
    if (this.training) {
      // training skips the stage select and uses the last stage picked
      useStage(this.m.stage === 'random' || !STAGE_IDS.includes(this.m.stage) ? STAGE_IDS[Math.floor(Math.random() * STAGE_IDS.length)] : this.m.stage);
      pushScene(new TrainingScene(this.m));
      return;
    }
    pushScene(new StageSelectScene());
  }

  update(dt: number): void {
    this.t += dt;
    this.msgT = Math.max(0, this.msgT - dt);
    const net = this.net;
    if (net) {
      net.tick();
      if (net.status === 'error' || net.status === 'left' || net.status === 'lost') {
        if (mouse.click || wasPressed('confirm') || wasPressed('back') || mouse.rclick) { net.close(); goHome(); }
        return;
      }
      if (this.locked && net.rivalLobby?.step === 2 && net.rival) { pushScene(new StageSelectScene(net)); return; }
      if (this.locked) { if (wasPressed('back') || mouse.rclick) this.back(); return; }
    }
    if (wasPressed('back') || mouse.rclick) { this.back(); return; }

    if (mouse.click) {
      const tile = hot('tile'), sw = hot('swatch'), csw = hot('cswatch'), chip = hot('chip');
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
      if (this.local) {
        const ctl = hot('ctl'), deck = hot('deck'), edit = hot('edit');
        if (ctl >= 0) { this.toggleCtl(ctl as 0 | 1); return; }
        if (deck >= 0) { this.focus = deck as 0 | 1; this.toggleDeck(deck as 0 | 1); return; }
        if (edit >= 0) { this.editDeck(edit as 0 | 1); return; }
      }
      if (!net && !this.tutorial && !this.arcade && isHot('panel:1') && this.step !== 2) { this.step = 2; this.focus = 1; this.cur = this.tileOf(this.m.cpu); sfx('move'); return; }
      if (isHot('panel:0') && this.step !== 0) { this.step = 0; this.focus = 0; this.cur = this.tileOf(this.m.p1); sfx('move'); this.sync(); return; }
    }

    const l = navPressed('left', dt), r = navPressed('right', dt), d: 1 | -1 = r ? 1 : -1;
    const ok = wasPressed('confirm') || wasPressed('custom');
    // local Versus: up/down flips the side being picked between player and CPU, or (on the skin step) its deck
    const up = this.local && navPressed('up', dt), down = this.local && navPressed('down', dt), flip = up || down;
    if (this.step === 0 || this.step === 2) {
      const h = hot('tile');
      if (mouse.moved && h >= 0 && h !== this.cur) { this.cur = h; sfx('move'); }
      if (l || r) { this.cur = (this.cur + d + TILES) % TILES; sfx('move'); }
      if (flip) this.toggleCtl(this.slot);
      if (ok) this.pickTile(this.cur);
    } else if (this.step === 1 || this.step === 3) {
      if (l || r) this.stepSkin(this.slot, d);
      if (flip) this.toggleDeck(this.slot, up ? -1 : 1);
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
    else if (this.arcade) this.drawLadder(ui);
    else this.drawSlot(ui, 1, showing(1), tick);

    // drawn after the slots so its rolled ends sit on top of them
    banner(ui, this.tutorial ? 'TUTORIAL' : this.training ? 'TRAINING MODE' : this.arcade ? 'ARCADE' : 'CHOOSE YOUR FIGHTER', UW / 2, vy(3));

    // VS and the matchup
    vsSeal(ui, UW / 2, this.py + 60);
    const status = this.statusLine();
    if (status) drawTextCentered(ui, tick % 16 < 12 || !status.blink ? status.text : '', UW / 2, this.py + 100, status.color, 1);

    // roster row
    const ty = vy(TILE_Y);
    for (let n = 0; n < TILES; n++) {
      const x = TX0 + n * (TW + TGAP);
      zone(`tile:${n}`, x, ty, TW, TH);
      const mine = (this.step === 0 || this.step === 2) && this.cur === n && showSel();
      const theirs = net && rl && rl.step === 0 && rl.tile === n;
      const picked0 = n === PLAYABLE.indexOf(this.m.p1) && this.step !== 0, picked1 = !net && !this.arcade && n === PLAYABLE.indexOf(this.m.cpu) && this.step >= 3;
      const text = plaque(ui, x, ty, TW, TH, !!mine, !mine && hot('tile') === n ? GOLD : FRAME);
      if (n === RANDOM) drawTextCentered(ui, '?', x + TW / 2, ty + 12, mine ? GOLD : RED_INK, 4, false);
      else {
        const cls = PLAYABLE[n];
        drawFighterSprite(ui, getSprite(cls, SKINS[cls][0].id, false), x + TW / 2, ty + TH - 10, false, 'none', 2);
      }
      drawTextCentered(ui, n === RANDOM ? 'RANDOM' : CLASS_INFO[PLAYABLE[n]].name, x + TW / 2, ty + TH - 8, text, 1, false);
      // cursor tags, fighting-game style: yours top left, theirs top right
      const tag = (label: string, color: string, right: boolean): void => {
        const tw = label.length * 6 + 3, tx = right ? x + TW - tw : x;
        P(ui, color, tx, ty - 10, tw, 10);
        drawText(ui, label, tx + 2, ty - 8, '#fcfcfc');
      };
      if (mine && (this.slot === 0 || tick % 8 < 6)) tag(this.who(this.slot), this.slot === 0 ? '#d82800' : '#0058f8', this.slot === 1);
      else if (picked0) tag(this.who(0), '#881400', false);
      if (theirs) tag('RIVAL', '#0058f8', true);
      else if (net && rl && rl.step > 0 && rival && n === PLAYABLE.indexOf(rival.cls)) tag('RIVAL', '#0000a8', true);
      else if (picked1) tag(this.who(1), '#0000a8', true);
    }

    // option chips
    if (!this.tutorial && (this.step === 4 || !net)) {
      const chips = this.chips, cw = net ? 140 : 110, gap = 6, x0 = Math.round(UW / 2 - (chips.length * cw + (chips.length - 1) * gap) / 2);
      chips.forEach((ch, i) => {
        const x = x0 + i * (cw + gap), on = this.step === 4 && this.chip === i && showSel();
        let label: string = ch;
        if (ch === 'SPELL DECK') label = this.m.p1Deck === 'custom' ? `CUSTOM SPELL DECK${this.customValid() ? '' : '!'}` : deckLabel(this.m.p1, this.m.p1Deck);
        if (ch === 'EDIT SPELL DECK' && this.local) label = `EDIT ${this.focus === 0 ? 'P1' : 'P2'} SPELL DECK`;
        if (ch === 'CPU LEVEL') label = `CPU: ${this.m.difficulty.toUpperCase()}`;
        if (ch === 'MATCH') label = this.m.bestOf === 1 ? '1 ROUND' : `BEST OF ${this.m.bestOf}`;
        if (ch === 'NEXT') label = net ? (this.locked ? 'LOCKED IN' : 'LOCK IN') : this.training || this.arcade ? 'START →' : 'STAGE →';
        button(ui, `chip:${i}`, label, x, vy(CY), cw, vspan(CY, CH), on, ch === 'NEXT' ? (this.step === 4 ? '#f8b800' : '#7c7c7c') : '#fcfcfc');
      });
    }
    if (this.msgT > 0) { P(ui, FRAME, screenRect(2)[0], vy(186), screenRect(2)[2], 16); drawTextCentered(ui, this.msg, UW / 2, vy(186) + 4, '#f87858', 1, false); }

    if (net && (net.status === 'error' || net.status === 'left' || net.status === 'lost')) {
      fillScreen(ui, 'rgba(0,0,0,0.8)', 2);
      drawTextCentered(ui, net.status === 'left' ? 'YOUR RIVAL LEFT' : net.status === 'lost' ? 'CONNECTION LOST' : net.error || 'CONNECTION ERROR', UW / 2, 140, '#f83800', 2);
      hint(ui, 'CLICK: BACK TO TITLE');
      return;
    }
    const keys = `${k('left')}/${k('right')}`, ud = `${k('up')}/${k('down')}`;
    hint(ui, this.local && (this.step === 1 || this.step === 3) ? `${keys}: SKIN   ${ud}: SPELL DECK   ${k('attack')} / CLICK A COLOR: OK   ${k('cast')}: BACK`
      : this.local && (this.step === 0 || this.step === 2) ? `${keys}: CHOOSE   ${ud} / CLICK THE NAME: PLAYER OR CPU   ${k('attack')}: PICK   ${k('cast')}: BACK`
      : this.step === 1 || this.step === 3 ? `${keys}: SKIN   ${k('attack')} / CLICK A COLOR: ${this.tutorial ? 'START' : 'OK'}   ${k('cast')}: BACK`
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
    if (this.local && this.step < 4) {
      const who = this.who(this.slot), cpu = this.m.sides[this.slot] === 'cpu';
      const text = this.step === 1 || this.step === 3 ? `${who}: PICK A COLOR` : cpu ? `PICK THE ${who} FIGHTER` : who === 'YOU' ? 'PICK YOUR FIGHTER' : `${who}: PICK YOUR FIGHTER`;
      return { text, color: '#fcfcfc', blink: true };
    }
    if (this.step === 0) return { text: 'PICK YOUR FIGHTER', color: '#fcfcfc', blink: true };
    if (this.step === 2) return { text: this.training ? 'PICK THE DUMMY' : 'PICK THE CPU FIGHTER', color: '#fcfcfc', blink: true };
    if (this.step === 1 || this.step === 3) return { text: 'PICK A COLOR', color: '#fcfcfc', blink: true };
    if (this.local) {
      const n = this.m.sides.filter(c => c === 'player').length;
      return { text: n === 2 ? 'TWO PLAYERS, ONE KEYBOARD' : n === 0 ? 'CPU VS CPU: SIT BACK AND WATCH' : '', color: '#f8b800', blink: false };
    }
    return null;
  }

  /** Tutorial: the opponent is always the training dummy. */
  private drawDummy(ui: Ctx): void {
    const x = PX[1], cx = x + PW / 2;
    win(ui, x, this.py, PW, PH);
    drawTextCentered(ui, 'OPPONENT', cx, this.py + 10, TRIM, 1, false);
    // the dummy gets the empty portrait frame with its ghosted stand-in inside
    this.drawPortrait(ui, 1, null, '', cx, this.py + 23);
    drawFighterSprite(ui, getSprite('mage', SKINS.mage[0].id, false), cx, this.py + 87, true, 'ghost', 2);
    drawTextCentered(ui, 'DUMMY', cx, this.py + 95, INK2, 2, false);
    ['A TRAINING DUMMY', 'ABOUT 5 MINUTES', 'OF LESSONS'].forEach((l, i) => drawTextCentered(ui, l, cx, this.py + 111 + i * 9, TRIM, 1, false));
  }

  /**
   * A fighter's portrait in an ink frame over a wash in its element, facing the middle. A new pick slides in from
   * the outer edge behind a white flash. `cls` null draws the empty frame (RANDOM, or a rival still connecting).
   */
  private drawPortrait(ui: Ctx, s: 0 | 1, cls: ClassId | null, skin: string, cx: number, y: number): void {
    const x = cx - FW / 2, key = `${cls}:${skin}`, sh = this.shown[s];
    if (sh.key !== key) { sh.key = key; sh.at = sh.at < 0 ? -1 : this.t; }
    const k = sh.at < 0 ? 1 : Math.min(1, (this.t - sh.at) / PORTRAIT_IN);
    P(ui, '#000000', x - 1, y - 1, FW + 2, FH + 2);
    P(ui, FRAME, x, y, FW, FH);
    const ix = x + 2, iy = y + 2, iw = FW - 4, ih = FH - 4;
    // dithered bands, light toward the bottom; 2px dither cells to match the 2x portrait pixels
    const ramp = cls ? BACKDROP[cls] : ['#000000', '#1c1c38', '#3c3c3c'] as const;
    for (let yy = 0; yy < ih; yy += 2) {
      const v = (yy / ih) * (ramp.length - 1), b = Math.min(ramp.length - 2, Math.floor(v)), f = v - b;
      for (let xx = 0; xx < iw; xx += 2) P(ui, dith(xx >> 1, yy >> 1) < f ? ramp[b + 1] : ramp[b], ix + xx, iy + yy, 2, 2);
    }
    if (!cls) return;
    const img = getPortrait(cls, skin), pw = img.width * 2, ph = img.height * 2;
    // slides from the outer edge (left panel from the left), snapped to the 2px grid
    const off = Math.round(((1 - k) ** 2 * (s === 0 ? -iw : iw)) / 2) * 2;
    ui.save();
    ui.beginPath(); ui.rect(ix, iy, iw, ih); ui.clip();
    const px = cx - pw / 2 + off, py = iy + ih - ph;
    if (s === 1) { ui.translate(px + pw, py); ui.scale(-1, 1); ui.drawImage(img, 0, 0, pw, ph); }
    else ui.drawImage(img, px, py, pw, ph);
    ui.restore();
    if (k < 1) {
      // the arrival flash fades out in dithered steps
      for (let yy = 0; yy < ih; yy += 2) for (let xx = 0; xx < iw; xx += 2) if (dith(xx >> 1, yy >> 1) > k * 1.6) P(ui, '#fcfcfc', ix + xx, iy + yy, 2, 2);
    }
    // a thin team-color sill under the bust
    P(ui, cls ? mix(teamColor(cls, skin, false), '#000000', 0.2) : FRAME, ix, iy + ih - 2, iw, 2);
  }

  /** Arcade: the right panel previews the ladder instead of a rival. */
  private drawLadder(ui: Ctx): void {
    const x = PX[1], cx = x + PW / 2;
    win(ui, x, this.py, PW, PH);
    drawTextCentered(ui, 'THE LADDER', cx, this.py + 10, BLUE_INK, 1, false);
    PLAYABLE.forEach((cls, i) => drawFighterSprite(ui, getSprite(cls, SKINS[cls][0].id, false), x + 18 + i * 26, this.py + 52, true, 'none', 1));
    drawTextCentered(ui, '?', cx, this.py + 62, RED_INK, 3, false);
    drawTextCentered(ui, '4 RIVALS + YOUR SHADOW', cx, this.py + 94, INK, 1, false);
    ['EVERY OTHER CLASS', 'EASY UP TO HARD', 'BEST OF 3 EACH'].forEach((l, i) => drawTextCentered(ui, l, cx, this.py + 108 + i * 9, TRIM, 1, false));
    const best = loadRecords()[this.m.p1];
    drawTextCentered(ui, best ? `BEST ${clock(best.time)} / ${best.continues} CONT.` : 'NOT CLEARED YET', cx, this.py + 146, INK2, 1, false);
  }

  private drawSlot(ui: Ctx, s: 0 | 1, show: { cls: ClassId | null; skin: string }, tick: number): void {
    const x = PX[s], net = this.net;
    const cls = show.cls, skin = cls ? show.skin || SKINS[cls][0].id : '';
    zone(`panel:${s}`, x, this.py, PW, PH);
    const active = s === this.slot && this.step < 4;
    // a parchment page with a ribbon in the fighter's color; the slot being chosen blinks a gold frame
    win(ui, x, this.py, PW, PH, { accent: cls ? teamColor(cls, skin, false) : undefined, edge: active && tick % 8 < 6 ? GOLD : FRAME });
    const who = this.who(s);
    // local Versus: the name is a toggle between a player and the CPU
    if (this.local) button(ui, `ctl:${s}`, `< ${who} >`, x + PW / 2 - 34, this.py + 6, 68, 14, false, s === 0 ? RED_INK : BLUE_INK);
    else drawTextCentered(ui, who, x + PW / 2, this.py + 10, s === 0 ? RED_INK : BLUE_INK, 1, false);
    const cx = x + PW / 2;
    if (!cls) {
      this.drawPortrait(ui, s, null, '', cx, this.py + 23);
      drawTextCentered(ui, '?', cx, this.py + 36, PAPER, 6, false);
      drawTextCentered(ui, net && s === 1 && !net.rival ? 'CONNECTING...' : 'RANDOM', cx, this.py + 95, INK2, 2, false);
      return;
    }
    this.drawPortrait(ui, s, cls, skin, cx, this.py + 23);
    drawTextCentered(ui, CLASS_INFO[cls].name, cx, this.py + 95, INK, 2, false);
    BLURB[cls].forEach((l, i) => drawTextCentered(ui, l, cx, this.py + 111 + i * 9, INK2, 1, false));
    // skins: clickable swatches for your slot (and the CPU's)
    const list = SKINS[cls], sw = 14, sx = Math.round(cx - (list.length * sw) / 2);
    const editable = s === 0 || !net;
    const deck = `${deckLabel(cls, this.deckOf(s))}${this.deckOf(s) === 'custom' && !this.customValid(s) ? '!' : ''}`;
    if (this.local) {
      // the deck steps through the ready-made decks, custom and RANDOM; EDIT opens the deck builder
      button(ui, `deck:${s}`, `SPELL DECK: ${deck}`.length * 6 <= 84 ? `SPELL DECK: ${deck}` : deck, x + 8, this.py + 130, PW - 52, 12, false, TRIM);
      button(ui, `edit:${s}`, 'EDIT', x + PW - 40, this.py + 130, 32, 12, false, TRIM);
    } else if (!(net && s === 1)) drawTextCentered(ui, `SPELL DECK: ${deck}`.length * 6 <= PW - 8 ? `SPELL DECK: ${deck}` : deck, cx, this.py + 132, TRIM, 1, false);
    if (!editable) return;
    const skinStep = (s === 0 && this.step === 1) || (s === 1 && this.step === 3);
    list.forEach((sk, n) => {
      const px = sx + n * sw, py = this.py + 146;
      zone(`${s === 0 ? 'swatch' : 'cswatch'}:${n}`, px, py - 1, sw, 12);
      if (sk.id === skin) P(ui, skinStep && tick % 8 >= 6 ? GOLD : INK, px, py - 1, 12, 12);
      P(ui, '#000000', px + 2, py + 1, 8, 8);
      P(ui, teamColor(cls, sk.id, false), px + 3, py + 2, 6, 6);
    });
  }
}
