// Spell deck select: the second step before a fight (fighter, spell deck, stage). Each side's spell decks sit
// in a list: the starter, one per Mythic, your own deck and RANDOM, each with its Mythic and Legendaries as
// icons. Versus and training pick both sides here, with the CPU level and match length; arcade picks only yours.
// Online you pick yours and lock in, and the stage vote opens once both players have.
import { pushScene, popScene, goHome, hint, zone, hot, isHot, button, showSel, type Scene } from './scene';
import type { SelectMode } from './select';
import { CLASS_INFO } from '../game/classes';
import { getArena, useStage } from '../game/battleView';
import { drawStage } from '../art/arena';
import { getPortrait, teamColor, skinOf, mirrorSkin, type ClassId } from '../art/sprites';
import { cardIconCanvas, ICON_SIZE } from '../art/cardIcons';
import { P, UW, screenRect, fillScreen, vy, vspan, spread, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered, textWidth } from '../engine/font';
import { win, banner, stepTrail, plaque, GOLD, FRAME, INK, INK2, TRIM, PAPER, PAPER2, RED_INK, BLUE_INK } from './skin';
import { wasPressed, navPressed, k, mouse } from '../engine/input';
import { sfx } from '../engine/audio';
import { loadMatch, saveMatch, playerDeck, sideName, type MatchConfig } from '../game/match';
import { presetsFor, loadCustom, validate, deckSize } from '../game/deck';
import { CARDS } from '../game/cards';
import { STAGE_IDS } from '../content/stages';
import type { NetSession } from '../net/session';
import { DeckBuilderScene } from './deckbuilder';
import { StageSelectScene } from './stageSelect';
import { TrainingScene } from './training';
import { ArcadeLadderScene } from './arcade';
import { newRun } from '../game/arcade';
import type { PadMode } from '../engine/touch';
import { bigButton, actionBar, barTapped, swipeIn, tallArea, TAP, GAP, PAD } from './touchUi';

/** One line of a side's list: a ready-made deck, the player's own deck, or RANDOM. */
interface Choice { id: string; name: string; sub: string; mythic: string | null; legends: string[]; ok: boolean }

const byRarity = (ids: string[], r: string): string[] => ids.filter(id => CARDS[id]?.rarity === r);

/** A class's spell deck choices, in the order the list shows them. */
export function deckChoices(cls: ClassId): Choice[] {
  const list: Choice[] = presetsFor(cls).map(p => ({
    id: p.id, name: p.name.toUpperCase(), sub: p.id === 'starter' ? 'STARTER' : (CARDS[p.mythic]?.name ?? '').toUpperCase(),
    mythic: p.mythic || null, legends: byRarity(Object.keys(p.cards), 'legendary'), ok: true,
  }));
  const own = loadCustom(cls), ids = own ? Object.keys(own) : [], ok = !!own && validate(own).length === 0;
  list.push({ id: 'custom', name: 'MY SPELL DECK', sub: ok ? 'CUSTOM' : own && deckSize(own) ? 'NOT READY' : 'NOT BUILT YET', mythic: byRarity(ids, 'mythic')[0] ?? null, legends: byRarity(ids, 'legendary'), ok });
  list.push({ id: 'random', name: 'RANDOM', sub: 'NEW EACH ROUND', mythic: null, legends: [], ok: true });
  return list;
}

type Chip = 'CPU LEVEL' | 'MATCH' | 'NEXT';

// layout (UI pixels)
const PY = 44, PH = 224, PW = 222, PX2 = [12, UW - 12 - PW], PX1 = Math.round(UW / 2 - PW / 2);
const ROW_Y = 52, ROW_H = 22, ROW_GAP = 2, CY = 276, CH = 20;

export class DeckSelectScene implements Scene {
  m: MatchConfig = loadMatch();
  /** The side the cursor is on, and its row on each side (a deck, or EDIT under the list). */
  side: 0 | 1 = 0;
  row: [number, number] = [0, 0];
  /** The cursor is on the bottom row (match options and NEXT) instead of a list. */
  low = false;
  chip = 0;
  /** Online: your deck is locked in, waiting on the rival. */
  locked = false;
  msg = '';
  msgT = 0;
  t = 0;
  /** Phone layout: where the list was drawn, for swipes between the sides. */
  private listRect: [number, number, number, number] = [0, 0, 0, 0];

  constructor(private mode: SelectMode = 'versus', private net?: NetSession) {
    this.findRows();
    this.sync();
  }

  tall(): boolean { return true; }
  pad(): PadMode { return spread.tall ? 'none' : 'back'; }
  /** Back from the deck builder: the decks may have changed. */
  resume(): void { this.m = loadMatch(); this.findRows(); this.msgT = 0; }

  private get local(): boolean { return this.mode === 'versus' && !this.net; }
  /** The sides whose deck is picked here: yours, and in versus and training the other side too. */
  private get sides(): Array<0 | 1> { return this.local || (this.mode === 'training' && !this.net) ? [0, 1] : [0]; }
  /** The panels on show: online the rival's too, though you can't pick for it. */
  private get panels(): Array<0 | 1> { return this.net ? [0, 1] : this.sides; }
  private get chips(): Chip[] {
    if (!this.local) return ['NEXT'];
    return [...(this.m.sides.includes('cpu') ? ['CPU LEVEL' as const] : []), 'MATCH', 'NEXT'];
  }
  private who(s: 0 | 1): string {
    if (this.local) return sideName(this.m.sides, s);
    return s === 0 ? 'YOU' : this.net ? 'RIVAL' : this.mode === 'training' ? 'DUMMY' : 'CPU';
  }
  private clsOf(s: 0 | 1): ClassId { return s === 1 && this.net?.rival ? this.net.rival.cls : s === 0 ? this.m.p1 : this.m.cpu; }
  private skinOf(s: 0 | 1): string {
    if (s === 1 && this.net?.rival) return this.net.rival.skin;
    const mine = skinOf(this.m.p1, this.m.p1Skin[this.m.p1]).id;
    if (s === 0) return mine;
    return this.m.p1 === this.m.cpu ? mirrorSkin(this.m.cpu, mine, this.m.cpuSkin[this.m.cpu]) : skinOf(this.m.cpu, this.m.cpuSkin[this.m.cpu]).id;
  }
  private deckOf(s: 0 | 1): string { return s === 0 ? this.m.p1Deck : this.m.cpuDeck; }

  /** Put each side's cursor on its current deck. */
  private findRows(): void {
    for (const s of [0, 1] as const) this.row[s] = Math.max(0, deckChoices(this.clsOf(s)).findIndex(c => c.id === this.deckOf(s)));
  }

  /** Online: tell the rival our fighter and deck, and whether we're locked in. */
  private sync(): void {
    const net = this.net;
    if (!net) return;
    net.hello = { cls: this.m.p1, skin: this.skinOf(0), deck: playerDeck(this.m) };
    net.lobby = { ...net.lobby, step: this.locked ? 2 : 1 };
  }

  private setDeck(s: 0 | 1, id: string): void {
    if (this.deckOf(s) === id) return;
    if (s === 0) this.m.p1Deck = id; else this.m.cpuDeck = id;
    sfx('move');
    saveMatch(this.m);
    this.sync();
  }

  /** Move a side's cursor to a row; a deck row picks that deck. */
  private moveTo(s: 0 | 1, i: number): void {
    const list = deckChoices(this.clsOf(s));
    this.side = s; this.low = false;
    this.row[s] = Math.max(0, Math.min(list.length, i));
    if (this.row[s] < list.length) this.setDeck(s, list[this.row[s]].id);
    else sfx('move');
  }

  private editDeck(s: 0 | 1): void {
    sfx('select');
    saveMatch(this.m);
    pushScene(new DeckBuilderScene(this.clsOf(s)));
  }

  private activateChip(c: Chip): void {
    if (c === 'CPU LEVEL') { this.m.difficulty = this.m.difficulty === 'easy' ? 'normal' : this.m.difficulty === 'normal' ? 'hard' : 'easy'; sfx('move'); }
    else if (c === 'MATCH') { const o = [1, 3, 5] as const; this.m.bestOf = o[(o.indexOf(this.m.bestOf) + 1) % o.length]; sfx('move'); }
    else { this.next(); return; }
    saveMatch(this.m);
  }

  private chipLabel(c: Chip): string {
    if (c === 'CPU LEVEL') return `CPU: ${this.m.difficulty.toUpperCase()}`;
    if (c === 'MATCH') return this.m.bestOf === 1 ? '1 ROUND' : `BEST OF ${this.m.bestOf}`;
    if (this.net) return this.locked ? 'LOCKED IN' : 'LOCK IN';
    return this.mode === 'training' || this.mode === 'arcade' ? 'START →' : 'STAGE →';
  }

  /** On to the stage select (arcade: the ladder; training: the fight; online: lock in and wait for the rival). */
  private next(): void {
    for (const s of this.sides) {
      if (this.deckOf(s) === 'custom' && !deckChoices(this.clsOf(s))[presetsFor(this.clsOf(s)).length].ok) {
        this.msg = this.sides.length > 1 ? `${this.who(s)}'S CUSTOM ${CLASS_INFO[this.clsOf(s)].name} SPELL DECK IS NOT READY` : 'YOUR CUSTOM SPELL DECK IS NOT READY';
        this.msgT = 2; sfx('deny');
        this.side = s; this.low = false;
        return;
      }
    }
    saveMatch(this.m);
    if (this.net) { this.locked = true; sfx('confirm'); this.sync(); return; }
    sfx('select');
    if (this.mode === 'arcade') { pushScene(new ArcadeLadderScene(newRun(this.m))); return; }
    if (this.mode === 'training') {
      // training skips the stage select and uses the last stage picked
      useStage(this.m.stage === 'random' || !STAGE_IDS.includes(this.m.stage) ? STAGE_IDS[Math.floor(Math.random() * STAGE_IDS.length)] : this.m.stage);
      pushScene(new TrainingScene(this.m));
      return;
    }
    pushScene(new StageSelectScene());
  }

  private back(): void {
    sfx('back');
    // locked in is final online; backing out leaves the room
    if (this.net && this.locked) { this.net.leave(); goHome(); return; }
    popScene();
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
      if (this.locked) { if (wasPressed('back') || mouse.rclick || (spread.tall && barTapped('back'))) this.back(); return; }
    }
    if (wasPressed('back') || mouse.rclick) { this.back(); return; }
    if (spread.tall) {
      if (barTapped('back')) { this.back(); return; }
      if (barTapped('primary')) { this.next(); return; }
      const tab = hot('dside');
      if (mouse.click && tab >= 0 && this.sides.includes(tab as 0 | 1)) { if (this.side !== tab) sfx('move'); this.side = tab as 0 | 1; return; }
      const sw = this.sides.length > 1 ? swipeIn(...this.listRect) : 0;
      if (sw) { this.side = this.side === 0 ? 1 : 0; sfx('move'); return; }
    }

    if (mouse.click) {
      for (const s of this.sides) {
        const d = hot(`d${s}`);
        if (d < 0) continue;
        if (d >= deckChoices(this.clsOf(s)).length) { this.side = s; this.row[s] = d; this.editDeck(s); return; }
        this.moveTo(s, d);
        return;
      }
      const edit = hot('edit');
      if (edit >= 0) { this.editDeck(edit as 0 | 1); return; }
      const chip = hot('chip');
      if (chip >= 0) { this.chip = chip; this.activateChip(this.chips[chip]); return; }
    }

    const up = navPressed('up', dt), down = navPressed('down', dt), l = navPressed('left', dt), r = navPressed('right', dt);
    const ok = wasPressed('confirm') || wasPressed('custom');
    const n = this.chips.length, s = this.side, rows = deckChoices(this.clsOf(s)).length + 1;
    if (this.low) {
      const h = hot('chip');
      if (mouse.moved && h >= 0) this.chip = h;
      if (l || r) { this.chip = (this.chip + (r ? 1 : -1) + n) % n; sfx('move'); }
      if (up) { this.low = false; sfx('move'); }
      if (ok) this.activateChip(this.chips[this.chip]);
      return;
    }
    if (up && this.row[s] > 0) this.moveTo(s, this.row[s] - 1);
    if (down) {
      if (this.row[s] < rows - 1) this.moveTo(s, this.row[s] + 1);
      else { this.low = true; this.chip = n - 1; sfx('move'); }
    }
    // left/right hops between the two sides' lists
    if ((l || r) && this.sides.length > 1) { this.side = s === 0 ? 1 : 0; sfx('move'); }
    if (ok) {
      if (this.row[s] === rows - 1) this.editDeck(s);
      // OK on a deck: on to the other side's list, then to NEXT
      else if (s === 0 && this.sides.length > 1) { this.side = 1; sfx('select'); }
      else { this.low = true; this.chip = n - 1; sfx('select'); }
    }
  }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    drawStage(c, getArena(), tick);
    c.fillStyle = 'rgba(40,20,0,0.45)';
    c.fillRect(...screenRect());
    if (spread.tall) { this.drawTall(ui, tick); return; }

    banner(ui, 'CHOOSE YOUR SPELL DECK', UW / 2, vy(3));
    stepTrail(ui, 1, UW / 2, vy(30));
    const panels = this.panels, py = vy(PY), ph = vspan(PY, PH);
    panels.forEach((s, i) => this.drawPanel(ui, s, panels.length > 1 ? PX2[i] : PX1, py, PW, ph, tick));

    const chips = this.chips, cw = 110, gap = 6, x0 = Math.round(UW / 2 - (chips.length * cw + (chips.length - 1) * gap) / 2);
    chips.forEach((ch, i) => button(ui, `chip:${i}`, this.chipLabel(ch), x0 + i * (cw + gap), vy(CY), cw, vspan(CY, CH), this.low && this.chip === i && showSel(), ch === 'NEXT' ? '#f8b800' : '#fcfcfc'));
    if (this.msgT > 0) { P(ui, FRAME, screenRect(2)[0], vy(CY) - 18, screenRect(2)[2], 16); drawTextCentered(ui, this.msg, UW / 2, vy(CY) - 14, '#f87858', 1, false); }

    if (this.netDown(ui)) { hint(ui, 'CLICK: BACK TO TITLE'); return; }
    const ud = `${k('up')}/${k('down')}`, lr = `${k('left')}/${k('right')}`;
    hint(ui, this.locked ? `${k('cast')} / RIGHT-CLICK: LEAVE ROOM`
      : this.low ? `${lr}: MOVE   ${k('attack')}: CHANGE   ${k('up')}: BACK TO THE LIST   ${k('cast')}: BACK`
        : `${ud}: CHOOSE${this.sides.length > 1 ? `   ${lr}: ${this.who(0)} / ${this.who(1)}` : ''}   ${k('attack')} / CLICK A DECK: PICK   ${k('cast')} / RIGHT-CLICK: BACK`);
  }

  /** Online: the connection dropped. Covers the screen and returns true. */
  private netDown(ui: Ctx): boolean {
    const net = this.net;
    if (!net || (net.status !== 'error' && net.status !== 'left' && net.status !== 'lost')) return false;
    fillScreen(ui, 'rgba(0,0,0,0.8)', 2);
    drawTextCentered(ui, net.status === 'left' ? 'YOUR RIVAL LEFT' : net.status === 'lost' ? 'CONNECTION LOST' : net.error || 'CONNECTION ERROR', UW / 2, 140, '#f83800', 2);
    return true;
  }

  /** A fighter's bust in a small ink frame. */
  private bust(ui: Ctx, s: 0 | 1, x: number, y: number, z: number): void {
    const cls = this.clsOf(s), skin = this.skinOf(s), img = getPortrait(cls, skin);
    P(ui, '#000000', x - 1, y - 1, 40 * z + 6, 32 * z + 6);
    P(ui, FRAME, x, y, 40 * z + 4, 32 * z + 4);
    P(ui, '#1c1c38', x + 2, y + 2, 40 * z, 32 * z);
    ui.drawImage(img, x + 2, y + 2, img.width * z, img.height * z);
  }

  private drawPanel(ui: Ctx, s: 0 | 1, x: number, y: number, w: number, h: number, tick: number): void {
    const net = this.net, rival = s === 1 && !!net, cls = this.clsOf(s), skin = this.skinOf(s);
    const focused = !rival && this.side === s && !this.low && !this.locked;
    win(ui, x, y, w, h, { accent: rival && !net!.rival ? undefined : teamColor(cls, skin, false), edge: focused && this.sides.length > 1 && tick % 8 < 6 ? GOLD : FRAME });
    if (!rival || net!.rival) this.bust(ui, s, x + 8, y + 9, 1);
    drawText(ui, this.who(s), x + 60, y + 12, s === 0 ? RED_INK : BLUE_INK);
    drawText(ui, rival && !net!.rival ? '?' : CLASS_INFO[cls].name, x + 60, y + 24, INK, 2);
    if (rival) {
      // the rival picks on their own screen: show where they are
      const rl = net!.rivalLobby, done = rl?.step === 2;
      const text = !net!.rival ? 'CONNECTING...' : done ? 'LOCKED IN' : 'PICKING A SPELL DECK...';
      drawTextCentered(ui, done || tick % 16 < 12 ? text : '', x + w / 2, y + h / 2, done ? '#007800' : INK2, 1, false);
      return;
    }
    if (s === 0 && this.locked) {
      drawTextCentered(ui, 'LOCKED IN', x + w / 2, y + h / 2 - 20, '#007800', 2, false);
      drawTextCentered(ui, tick % 16 < 12 ? 'WAITING FOR RIVAL...' : '', x + w / 2, y + h / 2 + 4, INK2, 1, false);
      return;
    }
    const list = deckChoices(cls), pick = this.deckOf(s);
    for (let i = 0; i <= list.length; i++) {
      const ry = y + vspan(PY, ROW_Y) + i * (ROW_H + ROW_GAP), rx = x + 8, rw = w - 16, id = `d${s}:${i}`;
      const cursor = focused && this.row[s] === i && showSel();
      zone(id, rx, ry, rw, ROW_H);
      if (i === list.length) {
        const text = plaque(ui, rx, ry, rw, ROW_H, false, cursor ? GOLD : isHot(id) ? PAPER : FRAME);
        drawTextCentered(ui, 'EDIT SPELL DECK...', rx + rw / 2, ry + 8, text, 1, false);
        continue;
      }
      const ch = list[i], on = ch.id === pick;
      const text = plaque(ui, rx, ry, rw, ROW_H, on, cursor ? GOLD : isHot(id) ? PAPER : FRAME);
      this.icon(ui, ch, rx + 1, ry + 1, 1, on);
      drawText(ui, ch.name, rx + 26, ry + 3, text);
      drawText(ui, ch.sub, rx + 26, ry + 12, on ? PAPER2 : ch.ok ? INK2 : RED_INK);
      // the deck's Legendaries along the right edge
      ch.legends.slice(0, 3).forEach((id2, j) => this.cardIcon(ui, id2, rx + rw - 1 - ICON_SIZE - j * (ICON_SIZE + 1), ry + 1, 1));
    }
  }

  private cardIcon(ui: Ctx, id: string, x: number, y: number, z: number): void {
    const img = cardIconCanvas(id);
    if (img) ui.drawImage(img, x, y, ICON_SIZE * z, ICON_SIZE * z);
  }

  /** A deck's badge: its Mythic, or a ? for RANDOM and an empty slot for a deck without one. */
  private icon(ui: Ctx, ch: Choice, x: number, y: number, z: number, on: boolean): void {
    const n = ICON_SIZE * z;
    if (ch.mythic) { this.cardIcon(ui, ch.mythic, x, y, z); return; }
    if (ch.id === 'random') { drawTextCentered(ui, '?', x + n / 2, y + n / 2 - 7 * z, on ? GOLD : RED_INK, 2 * z, false); return; }
    P(ui, TRIM, x + 2 * z, y + 2 * z, n - 4 * z, n - 4 * z);
    P(ui, on ? '#a81000' : PAPER, x + 3 * z, y + 3 * z, n - 6 * z, n - 6 * z);
  }

  // ---------- full-height phone layout ----------

  private drawTall(ui: Ctx, tick: number): void {
    const a = tallArea(), net = this.net, x0 = a.x + PAD, w = a.w - PAD * 2;
    let y = a.y + 12;
    banner(ui, 'CHOOSE SPELL DECK', UW / 2, y);
    y += 40;
    stepTrail(ui, 1, UW / 2, y, { scale: 2 });
    y += 22 + GAP;

    // who's picking: a tab per side (online the rival's shows where they are), or just yours
    const panels = this.panels, tw = Math.floor((w - GAP * (panels.length - 1)) / panels.length), th = 72;
    panels.forEach((s, i) => {
      const tx = x0 + i * (tw + GAP), rival = s === 1 && !!net, mine = this.sides.includes(s);
      if (panels.length > 1) bigButton(ui, `dside:${s}`, ' ', tx, y, tw, th, { on: mine && this.side === s, disabled: !mine });
      else win(ui, tx, y, tw, th);
      if (!rival || net!.rival) this.bust(ui, s, tx + 10, y + (th - 36) / 2, 1);
      drawText(ui, this.who(s), tx + 62, y + 18, s === 0 ? RED_INK : BLUE_INK, 1);
      const sub = rival ? (!net!.rival ? 'CONNECTING' : net!.rivalLobby?.step === 2 ? 'LOCKED IN' : 'PICKING...') : CLASS_INFO[this.clsOf(s)].name;
      drawText(ui, sub, tx + 62, y + 34, rival ? INK2 : INK, textWidth(sub, 2) <= tw - 70 ? 2 : 1);
    });
    y += th + GAP;

    // from the bar up: the match options, the picked deck's Mythic and Legendaries with EDIT, then the list fills the rest
    const barTop = actionBar(ui, { back: this.locked ? 'LEAVE' : undefined, primary: { id: 'next', label: this.chipLabel('NEXT'), disabled: this.locked } });
    const opts = this.chips.map((ch, i) => ({ ch, i })).filter(o => o.ch !== 'NEXT');
    const optY = barTop - 14 - TAP, stripH = 92;
    const stripY = (opts.length ? optY - GAP : barTop - 14) - stripH;
    if (opts.length) {
      const cw = Math.floor((w - GAP * (opts.length - 1)) / opts.length);
      opts.forEach(({ ch, i }, j) => {
        const [sub, val] = this.chipLabel(ch).includes(': ') ? this.chipLabel(ch).split(': ') : ['MATCH', this.chipLabel(ch)];
        bigButton(ui, `chip:${i}`, val, x0 + j * (cw + GAP), optY, cw, TAP, { sub, on: this.low && this.chip === i && showSel() });
      });
    }
    if (this.netDown(ui)) { drawTextCentered(ui, 'TAP: BACK TO TITLE', UW / 2, 170, '#fcfcfc', 2); return; }

    const s = this.side, cls = this.clsOf(s), list = deckChoices(cls), pick = this.deckOf(s);
    this.listRect = [a.x, y, a.w, stripY - y];
    if (this.locked) {
      win(ui, x0, y, w, stripY - GAP - y);
      drawTextCentered(ui, 'LOCKED IN', UW / 2, y + 40, '#007800', 3, false);
      drawTextCentered(ui, tick % 16 < 12 ? 'WAITING FOR RIVAL...' : '', UW / 2, y + 80, INK2, 2, false);
    } else {
      const rh = Math.max(TAP, Math.min(TAP + 18, Math.floor((stripY - GAP - y + GAP) / list.length) - GAP));
      list.forEach((ch, i) => {
        const ry = y + i * (rh + GAP), on = ch.id === pick;
        bigButton(ui, `d${s}:${i}`, ' ', x0, ry, w, rh, { primary: on, on: !on && this.row[s] === i && !this.low && showSel() });
        this.icon(ui, ch, x0 + 10, ry + (rh - 40) / 2, 2, on);
        drawText(ui, ch.name, x0 + 62, ry + rh / 2 - 12, on ? PAPER : INK, 2);
        drawText(ui, ch.sub, x0 + 62, ry + rh / 2 + 6, on ? PAPER2 : ch.ok ? INK2 : RED_INK, 1);
      });
    }

    // the picked deck at a glance, and EDIT
    win(ui, x0, stripY, w, stripH);
    const cur = list.find(ch => ch.id === pick) ?? list[0], ew = 110, iy = stripY + 34;
    if (cur.id === 'random') drawText(ui, 'A READY-MADE SPELL DECK, ROLLED EACH ROUND', x0 + 12, stripY + 40, INK2, 1);
    else {
      drawText(ui, 'MYTHIC', x0 + 12, stripY + 16, INK2, 1);
      if (cur.mythic) this.cardIcon(ui, cur.mythic, x0 + 12, iy, 2); else drawText(ui, 'NONE', x0 + 12, iy + 16, RED_INK, 1);
      drawText(ui, 'LEGENDARIES', x0 + 70, stripY + 16, INK2, 1);
      const fit = Math.floor((w - 70 - ew - 12) / 44);
      cur.legends.slice(0, fit).forEach((id, j) => this.cardIcon(ui, id, x0 + 70 + j * 44, iy, 2));
      if (!cur.legends.length) drawText(ui, 'NONE', x0 + 70, iy + 16, INK2, 1);
    }
    if (!this.locked) bigButton(ui, `edit:${s}`, 'EDIT', x0 + w - ew - 10, stripY + (stripH - TAP) / 2, ew, TAP);
    if (this.msgT > 0) { P(ui, FRAME, a.x, stripY - 30, a.w, 26); drawTextCentered(ui, this.msg, UW / 2, stripY - 24, '#f87858', 1, false); }
  }
}
