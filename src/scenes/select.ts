// Character select: a roster row of fighters, the left side's pick on the left and the right side's on the right.
// Pick a fighter, then a skin, for the left side and then the right. In local Versus each side's header toggles
// it between a player and the CPU (you vs CPU on either side, two players on one keyboard, or CPU vs CPU), and
// each side picks its own deck. Online the right side is your rival. Stage select comes next.
// The tutorial uses it too, to pick the class to learn (the right side shows the training dummy),
// and so does training mode, where the right side picks the dummy's class, and arcade mode, where you only pick yourself.
import { setScene, hint, zone, hot, isHot, button, showSel, type Scene } from './scene';
import { PLAYABLE, CLASS_INFO } from '../game/classes';
import { getArena } from '../game/battleView';
import { drawStage } from '../art/arena';
import { getSprite, getPortrait, drawFighterSprite, teamColor, SKINS, skinOf, mirrorSkin, type ClassId } from '../art/sprites';
import { P, UW, screenRect, fillScreen, vy, vspan, mix, dith, spread, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered, wrap } from '../engine/font';
import { win, plaque, banner, vsSeal, FRAME, GOLD, INK, INK2, TRIM, PAPER, RED_INK, BLUE_INK } from './skin';
import { wasPressed, navPressed, k, mouse } from '../engine/input';
import { sfx } from '../engine/audio';
import { loadMatch, saveMatch, playerDeck, sideName, cycleDeck, deckLabel, type MatchConfig } from '../game/match';
import { loadCustom, validate } from '../game/deck';
import type { NetSession } from '../net/session';
import { DeckBuilderScene } from './deckbuilder';
import { StageSelectScene } from './stageSelect';
import { TitleScene } from './title';
import { TutorialScene, type TutorialClass } from './tutorial';
import { TrainingScene } from './training';
import { ArcadeLadderScene } from './arcade';
import { newRun, loadRecords, clock } from '../game/arcade';
import { useStage } from '../game/battleView';
import { STAGE_IDS } from '../art/stages';
import type { PadMode } from '../engine/touch';
import { bigButton, actionBar, barTapped, swipeIn, tallArea, dots, TAP, GAP, PAD } from './touchUi';

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
const PORTRAIT_IN = 0.18;
/** Portrait frame size (UI pixels) at a zoom: the 40x32 bust inside a 2px ink border (2x by default). */
const frameW = (z: number): number => 40 * z + 4, frameH = (z: number): number => 32 * z + 4;

/** 0/1: picking the left side's fighter/skin, 2/3: the right side's (skipped online), 4: options. */
type Step = 0 | 1 | 2 | 3 | 4;
type Chip = 'DECK' | 'EDIT DECK' | 'CPU LEVEL' | 'MATCH' | 'NEXT';
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

  tall(): boolean { return true; }
  pad(): PadMode { return spread.tall ? 'none' : 'back'; }
  /** Full-height phone layout: where each side's panel and the color row were drawn, for swipes. */
  private tallRects: { panel: Array<[number, number, number, number]>; colors: [number, number, number, number] | null } = { panel: [], colors: null };

  private get tutorial(): boolean { return this.mode === 'tutorial'; }
  private get training(): boolean { return this.mode === 'training'; }
  /** Arcade: you pick only your own fighter and deck; the ladder picks the rivals. */
  private get arcade(): boolean { return this.mode === 'arcade'; }
  /** Local Versus: both sides can be a player or the CPU, and each picks a deck on its panel. */
  private get local(): boolean { return this.mode === 'versus' && !this.net; }
  private get chips(): Chip[] { return this.net ? ['DECK', 'NEXT'] : this.training || this.arcade ? ['DECK', 'EDIT DECK', 'NEXT'] : ['EDIT DECK', 'CPU LEVEL', 'MATCH', 'NEXT']; }
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
    setScene(new DeckBuilderScene(this.slotClass(s), () => { const back = new CharSelectScene(undefined, 4, this.mode); back.focus = s; setScene(back); }));
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
    if (this.tutorial) { sfx('select'); setScene(new TutorialScene(this.m.p1 as TutorialClass)); return; }
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
      setScene(new TitleScene());
      return;
    }
    if (this.step === 0) { setScene(new TitleScene()); return; }
    this.step = (this.step === 4 && (this.net || this.arcade) ? 1 : this.step - 1) as Step;
    if (this.step === 0 || this.step === 2) this.cur = this.tileOf(this.slotClass(this.slot));
  }

  private activateChip(c: Chip): void {
    if (c === 'DECK') { this.toggleDeck(0); return; }
    else if (c === 'EDIT DECK') { this.editDeck(this.local ? this.focus : 0); return; }
    else if (c === 'CPU LEVEL') { this.m.difficulty = this.m.difficulty === 'easy' ? 'normal' : 'easy'; sfx('move'); }
    else if (c === 'MATCH') { const o = [1, 3, 5] as const; this.m.bestOf = o[(o.indexOf(this.m.bestOf) + 1) % o.length]; sfx('move'); }
    else if (c === 'NEXT') { this.next(); return; }
    saveMatch(this.m);
  }

  /** On to the stage select (online: lock in and wait for the rival). */
  private next(): void {
    for (const s of this.local ? [0, 1] as const : [0] as const) {
      if (this.deckOf(s) === 'custom' && !this.customValid(s)) {
        this.msg = this.local ? `${this.who(s)}'S CUSTOM ${CLASS_INFO[this.slotClass(s)].name} DECK IS NOT READY` : 'YOUR CUSTOM DECK IS NOT READY';
        this.msgT = 2; sfx('deny');
        return;
      }
    }
    saveMatch(this.m);
    if (this.net) { this.locked = true; sfx('confirm'); this.sync(); return; }
    sfx('select');
    if (this.arcade) { setScene(new ArcadeLadderScene(newRun(this.m))); return; }
    if (this.training) {
      // training skips the stage select and uses the last stage picked
      useStage(this.m.stage === 'random' || !STAGE_IDS.includes(this.m.stage) ? STAGE_IDS[Math.floor(Math.random() * STAGE_IDS.length)] : this.m.stage);
      setScene(new TrainingScene(this.m));
      return;
    }
    setScene(new StageSelectScene());
  }

  update(dt: number): void {
    this.t += dt;
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
    if (spread.tall && this.tallInput()) { this.sync(); return; }

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

  /** Full-height phone layout: the action bar and swipes. True when something was handled. */
  private tallInput(): boolean {
    if (barTapped('back')) { this.back(); return true; }
    if (barTapped('primary')) {
      if (this.tutorial) { sfx('select'); setScene(new TutorialScene(this.m.p1 as TutorialClass)); }
      else if (!this.locked) this.next();
      return true;
    }
    // swipe a fighter panel to step its class; swipe the color row to step the skin
    for (const s of [0, 1] as const) {
      const r = this.tallRects.panel[s];
      if (!r || (s === 1 && (this.net || this.tutorial || this.arcade))) continue;
      const d = swipeIn(...r);
      if (!d) continue;
      const i = PLAYABLE.indexOf(this.slotClass(s)), cls = PLAYABLE[(i + d + PLAYABLE.length) % PLAYABLE.length];
      this.setClass(s, cls);
      if (this.slot === s && (this.step === 0 || this.step === 2)) this.step = (s === 0 ? 1 : 3) as Step;
      this.cur = this.tileOf(cls);
      sfx('move');
      return true;
    }
    const cr = this.tallRects.colors;
    const d = cr ? swipeIn(...cr) : 0;
    if (d) { this.stepSkin(this.colorSide(), d); return true; }
    return false;
  }

  /** Whose colors the phone layout's color row shows: the side being picked, else the focused one. */
  private colorSide(): 0 | 1 {
    if (this.net || this.arcade || this.tutorial) return 0;
    return this.step === 2 || this.step === 3 ? 1 : this.step === 4 && this.local ? this.focus : 0;
  }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    drawStage(c, getArena(), tick);
    c.fillStyle = 'rgba(40,20,0,0.35)';
    c.fillRect(...screenRect());
    if (spread.tall) { this.drawTall(ui, tick); return; }

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
      const chips = this.chips, cw = net ? 140 : this.local ? 104 : 86, gap = 6, x0 = Math.round(UW / 2 - (chips.length * cw + (chips.length - 1) * gap) / 2);
      chips.forEach((ch, i) => {
        const x = x0 + i * (cw + gap), on = this.step === 4 && this.chip === i && showSel();
        const label = this.chipLabel(ch);
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
    hint(ui, this.local && (this.step === 1 || this.step === 3) ? `${keys}: SKIN   ${ud}: DECK   ${k('attack')} / CLICK A COLOR: OK   ${k('cast')}: BACK`
      : this.local && (this.step === 0 || this.step === 2) ? `${keys}: CHOOSE   ${ud} / CLICK THE NAME: PLAYER OR CPU   ${k('attack')}: PICK   ${k('cast')}: BACK`
      : this.step === 1 || this.step === 3 ? `${keys}: SKIN   ${k('attack')} / CLICK A COLOR: ${this.tutorial ? 'START' : 'OK'}   ${k('cast')}: BACK`
      : this.locked ? `${k('cast')} / RIGHT-CLICK: LEAVE ROOM`
        : this.step === 4 ? `${keys}: MOVE   ${k('attack')}: CHANGE   ${k('cast')} / RIGHT-CLICK: BACK`
          : `${keys} OR HOVER: CHOOSE   ${k('attack')} / CLICK: PICK   ${k('cast')} / RIGHT-CLICK: BACK`);
  }

  private chipLabel(ch: Chip): string {
    if (ch === 'DECK') return this.m.p1Deck === 'custom' ? `CUSTOM DECK${this.customValid() ? '' : '!'}` : deckLabel(this.m.p1, this.m.p1Deck);
    if (ch === 'EDIT DECK' && this.local) return `EDIT ${this.focus === 0 ? 'LEFT' : 'RIGHT'} DECK`;
    if (ch === 'CPU LEVEL') return `CPU: ${this.m.difficulty.toUpperCase()}`;
    if (ch === 'MATCH') return this.m.bestOf === 1 ? '1 ROUND' : `BEST OF ${this.m.bestOf}`;
    if (ch === 'NEXT') return this.net ? (this.locked ? 'LOCKED IN' : 'LOCK IN') : this.training || this.arcade ? 'START →' : 'STAGE →';
    return ch;
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
  private drawPortrait(ui: Ctx, s: 0 | 1, cls: ClassId | null, skin: string, cx: number, y: number, z = 2): void {
    const FW = frameW(z), FH = frameH(z);
    const x = cx - FW / 2, key = `${cls}:${skin}`, sh = this.shown[s];
    if (sh.key !== key) { sh.key = key; sh.at = sh.at < 0 ? -1 : this.t; }
    const k = sh.at < 0 ? 1 : Math.min(1, (this.t - sh.at) / PORTRAIT_IN);
    P(ui, '#000000', x - 1, y - 1, FW + 2, FH + 2);
    P(ui, FRAME, x, y, FW, FH);
    const ix = x + 2, iy = y + 2, iw = FW - 4, ih = FH - 4;
    // dithered bands, light toward the bottom; dither cells match the portrait's pixels
    const ramp = cls ? BACKDROP[cls] : ['#000000', '#1c1c38', '#3c3c3c'] as const;
    for (let yy = 0; yy < ih; yy += z) {
      const v = (yy / ih) * (ramp.length - 1), b = Math.min(ramp.length - 2, Math.floor(v)), f = v - b;
      for (let xx = 0; xx < iw; xx += z) P(ui, dith(xx / z, yy / z) < f ? ramp[b + 1] : ramp[b], ix + xx, iy + yy, Math.min(z, iw - xx), Math.min(z, ih - yy));
    }
    if (!cls) return;
    const img = getPortrait(cls, skin), pw = img.width * z, ph = img.height * z;
    // slides from the outer edge (left panel from the left), snapped to the 2px grid
    const off = Math.round(((1 - k) ** 2 * (s === 0 ? -iw : iw)) / z) * z;
    ui.save();
    ui.beginPath(); ui.rect(ix, iy, iw, ih); ui.clip();
    const px = cx - pw / 2 + off, py = iy + ih - ph;
    if (s === 1) { ui.translate(px + pw, py); ui.scale(-1, 1); ui.drawImage(img, 0, 0, pw, ph); }
    else ui.drawImage(img, px, py, pw, ph);
    ui.restore();
    if (k < 1) {
      // the arrival flash fades out in dithered steps
      for (let yy = 0; yy < ih; yy += z) for (let xx = 0; xx < iw; xx += z) if (dith(xx / z, yy / z) > k * 1.6) P(ui, '#fcfcfc', ix + xx, iy + yy, Math.min(z, iw - xx), Math.min(z, ih - yy));
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
      button(ui, `deck:${s}`, `DECK: ${deck}`.length * 6 <= 84 ? `DECK: ${deck}` : deck, x + 8, this.py + 130, PW - 52, 12, false, TRIM);
      button(ui, `edit:${s}`, 'EDIT', x + PW - 40, this.py + 130, 32, 12, false, TRIM);
    } else if (!(net && s === 1)) drawTextCentered(ui, `DECK: ${deck}`, cx, this.py + 132, TRIM, 1, false);
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

  // ---------- full-height phone layout ----------

  private drawTall(ui: Ctx, tick: number): void {
    const a = tallArea(), net = this.net, rl = net?.rivalLobby, rival = net?.rival;
    const x0 = a.x + PAD, w = a.w - PAD * 2;
    const barTop = a.y + a.h - 84;
    let y = a.y + 12;
    banner(ui, this.tutorial ? 'TUTORIAL' : this.training ? 'TRAINING' : this.arcade ? 'ARCADE' : 'CHOOSE YOUR FIGHTER', UW / 2, y);
    y += 40;

    // laid out from the bar up: options, colors and the roster sit in the thumb zone; the two sides fill the rest
    const cols = 3, tw = Math.floor((w - GAP * (cols - 1)) / cols), th = 108;
    const chips = this.chips.map((ch, i) => ({ ch, i })).filter(o => o.ch !== 'NEXT');
    const showChips = !this.tutorial && chips.length > 0 && (this.step === 4 || !net);
    const cs = this.colorSide(), cls = this.slotClass(cs), list = SKINS[cls];
    const sw = Math.min(52, Math.floor((w - 4 * (list.length - 1)) / list.length));
    const chipY = barTop - 14 - (TAP + 6);
    const colorY = (showChips ? chipY : barTop - 4) - 14 - sw;
    const rosterY = colorY - 14 - 2 * th - GAP;
    const statusY = rosterY - 26;
    const ph = Math.max(220, Math.min(360, statusY - 10 - y));
    const z = ph >= 330 ? 4 : 3;

    // the two sides, with the VS seal between them
    const pw = Math.floor((w - 40) / 2);
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
    this.tallRects.panel = [[x0, y, pw, ph], [x0 + w - pw, y, pw, ph]];
    this.drawTallSlot(ui, 0, showing(0), x0, y, pw, ph, tick, z);
    if (this.tutorial) this.drawTallNote(ui, x0 + w - pw, y, pw, ph, 'OPPONENT', 'DUMMY', ['A TRAINING', 'DUMMY. ABOUT', '5 MINUTES OF', 'LESSONS'], BLUE_INK, z);
    else if (this.arcade) {
      const best = loadRecords()[this.m.p1];
      this.drawTallNote(ui, x0 + w - pw, y, pw, ph, 'THE LADDER', '4 RIVALS', ['+ YOUR SHADOW', 'EASY TO HARD', 'BEST OF 3', best ? `BEST ${clock(best.time)}` : 'NOT CLEARED'], BLUE_INK, z);
    } else this.drawTallSlot(ui, 1, showing(1), x0 + w - pw, y, pw, ph, tick, z);
    vsSeal(ui, UW / 2, y + 54 + frameH(z) / 2);

    const status = this.statusLine();
    if (status?.text) drawTextCentered(ui, tick % 16 < 12 || !status.blink ? status.text : '', UW / 2, statusY, status.color, status.text.length * 12 < w ? 2 : 1);

    // the roster, three to a row
    for (let n = 0; n < TILES; n++) {
      const x = x0 + (n % cols) * (tw + GAP), ty = rosterY + Math.floor(n / cols) * (th + GAP);
      const mine = (this.step === 0 || this.step === 2) && this.cur === n && showSel();
      bigButton(ui, `tile:${n}`, '', x, ty, tw, th, { on: mine });
      if (n === RANDOM) drawTextCentered(ui, '?', x + tw / 2, ty + 20, RED_INK, 7, false);
      else drawFighterSprite(ui, getSprite(PLAYABLE[n], SKINS[PLAYABLE[n]][0].id, false), x + tw / 2, ty + th - 30, false, 'none', 3);
      drawTextCentered(ui, n === RANDOM ? 'RANDOM' : CLASS_INFO[PLAYABLE[n]].name, x + tw / 2, ty + th - 24, INK, 2, false);
      const tag = (label: string, color: string, right: boolean): void => {
        const lw = label.length * 6 + 5, lx = right ? x + tw - lw - 5 : x + 5;
        P(ui, color, lx, ty + 5, lw, 11);
        drawText(ui, label, lx + 3, ty + 7, '#fcfcfc');
      };
      const theirs = net && rl && rl.step === 0 && rl.tile === n;
      if (n === PLAYABLE.indexOf(this.m.p1) && this.step !== 0) tag(this.who(0), '#881400', false);
      if (theirs || (net && rl && rl.step > 0 && rival && n === PLAYABLE.indexOf(rival.cls))) tag('RIVAL', '#0000a8', true);
      else if (!net && !this.arcade && !this.tutorial && n === PLAYABLE.indexOf(this.m.cpu) && this.step >= 3) tag(this.who(1), '#0000a8', true);
    }

    // the color row for the side being picked
    const sx = Math.round(UW / 2 - (list.length * sw + (list.length - 1) * 4) / 2);
    const skin = cs === 0 ? this.mySkin() : this.cpuSkin();
    this.tallRects.colors = [x0, colorY - 6, w, sw + 12];
    list.forEach((sk, n) => {
      const px = sx + n * (sw + 4);
      zone(`${cs === 0 ? 'swatch' : 'cswatch'}:${n}`, px, colorY, sw, sw);
      P(ui, '#000000', px - 1, colorY - 1, sw + 2, sw + 2);
      P(ui, sk.id === skin ? GOLD : FRAME, px, colorY, sw, sw);
      P(ui, FRAME, px + 4, colorY + 4, sw - 8, sw - 8);
      P(ui, teamColor(cls, sk.id, false), px + 6, colorY + 6, sw - 12, sw - 12);
    });

    // match options (NEXT moves to the bar)
    if (showChips) {
      const cw = Math.floor((w - GAP * (chips.length - 1)) / chips.length);
      chips.forEach(({ ch, i }, j) => {
        const label = this.chipLabel(ch), [sub, val] = label.includes(': ') ? label.split(': ') : ch === 'EDIT DECK' ? ['EDIT', label.replace(/^EDIT /, '')] : ['', label];
        bigButton(ui, `chip:${i}`, val, x0 + j * (cw + GAP), chipY, cw, TAP + 6, { sub: sub || undefined, on: this.step === 4 && this.chip === i && showSel() });
      });
    }

    if (this.msgT > 0) { P(ui, FRAME, a.x, barTop - 30, a.w, 26); drawTextCentered(ui, this.msg, UW / 2, barTop - 24, '#f87858', 1, false); }
    const steps = this.net || this.arcade || this.tutorial ? 2 : 3;
    const at = this.step <= 1 ? 0 : this.step <= 3 && steps === 3 ? 1 : steps - 1;
    actionBar(ui, { primary: { id: 'next', label: this.tutorial ? 'START →' : this.chipLabel('NEXT'), disabled: this.locked } });
    dots(ui, steps, at, UW / 2 + 10, barTop + 37);

    if (net && (net.status === 'error' || net.status === 'left' || net.status === 'lost')) {
      fillScreen(ui, 'rgba(0,0,0,0.8)', 2);
      drawTextCentered(ui, net.status === 'left' ? 'YOUR RIVAL LEFT' : net.status === 'lost' ? 'CONNECTION LOST' : net.error || 'CONNECTION ERROR', UW / 2, 140, '#f83800', 2);
      drawTextCentered(ui, 'TAP: BACK TO TITLE', UW / 2, 170, '#fcfcfc', 2);
    }
  }

  /** A side's panel in the phone layout: who it is, a 3x portrait, the class name, its deck and a hint to swipe. */
  private drawTallSlot(ui: Ctx, s: 0 | 1, show: { cls: ClassId | null; skin: string }, x: number, y: number, w: number, h: number, tick: number, z: number): void {
    const net = this.net, cls = show.cls, skin = cls ? show.skin || SKINS[cls][0].id : '';
    zone(`panel:${s}`, x, y, w, h);
    const active = s === this.slot && this.step < 4;
    win(ui, x, y, w, h, { accent: cls ? teamColor(cls, skin, false) : undefined, edge: active && tick % 8 < 6 ? GOLD : FRAME });
    const cx = x + w / 2, who = this.who(s);
    if (this.local) bigButton(ui, `ctl:${s}`, who, x + 10, y + 10, w - 20, 36, { scale: 2 });
    else drawTextCentered(ui, who, cx, y + 18, s === 0 ? RED_INK : BLUE_INK, 2, false);
    const py = y + 54;
    this.drawPortrait(ui, s, cls, skin, cx, py, z);
    let ty = py + frameH(z) + 8;
    if (!cls) {
      drawTextCentered(ui, '?', cx, py + 26, PAPER, 8, false);
      drawTextCentered(ui, net && s === 1 && !net.rival ? 'CONNECTING' : 'RANDOM', cx, ty, INK2, 2, false);
      return;
    }
    drawTextCentered(ui, CLASS_INFO[cls].name, cx, ty, INK, 2, false);
    ty += 20;
    wrap(BLURB[cls][0], Math.floor((w - 16) / 6)).slice(0, 2).forEach((l, i) => drawTextCentered(ui, l, cx, ty + i * 10, INK2, 1, false));
    const deck = `${deckLabel(cls, this.deckOf(s))}${this.deckOf(s) === 'custom' && !this.customValid(s) ? '!' : ''}`;
    if (this.local) {
      bigButton(ui, `deck:${s}`, deck, x + 10, y + h - 50, w - 20, 40, { sub: 'DECK', scale: deck.length * 12 < w - 30 ? 2 : 1 });
    } else if (!(net && s === 1)) drawTextCentered(ui, `DECK: ${deck}`, cx, y + h - 26, TRIM, 1, false);
    // a nudge that the panel swipes
    if (!(net && s === 1) && !(s === 1 && (this.tutorial || this.arcade))) {
      drawText(ui, '<', x + 8, py + frameH(z) / 2 - 7, TRIM, 2);
      drawText(ui, '>', x + w - 18, py + frameH(z) / 2 - 7, TRIM, 2);
    }
  }

  /** The right panel in the phone layout when it isn't a fighter (tutorial dummy, arcade ladder). */
  private drawTallNote(ui: Ctx, x: number, y: number, w: number, h: number, head: string, big: string, lines: string[], color: string, z: number): void {
    win(ui, x, y, w, h);
    const cx = x + w / 2, fh = frameH(z);
    drawTextCentered(ui, head, cx, y + 18, color, 2, false);
    this.drawPortrait(ui, 1, null, '', cx, y + 54, z);
    drawFighterSprite(ui, getSprite('mage', SKINS.mage[0].id, false), cx, y + 54 + fh - 12, true, 'ghost', 3);
    drawTextCentered(ui, big, cx, y + 54 + fh + 8, INK2, 2, false);
    lines.forEach((l, i) => drawTextCentered(ui, l, cx, y + 54 + fh + 30 + i * 12, TRIM, 1, false));
  }
}
