// Spell deck builder: 30 spells, 4/2/1 copy limits, max 5 Legendaries, exactly 1 Mythic. Autosaves to the browser.
// Opening it (or switching class) first asks what to start from: your saved deck, a ready-made deck or an empty one.
import { popScene, hint, zone, hot, isHot, button, showSel, type Scene } from './scene';
import { getArena } from '../game/battleView';
import { drawStage } from '../art/arena';
import { teamColor, type ClassId } from '../art/sprites';
import { P, UW, screenRect, spread, vy, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered, textWidth } from '../engine/font';
import { wasPressed, navPressed, mouse, gesture } from '../engine/input';
import { touchActive, type PadMode } from '../engine/touch';
import { sfx } from '../engine/audio';
import { cardsFor, ELEMENT_COLOR, MAX_COPIES, RARITY_COLOR, type CardDef } from '../game/cards';
import { canAdd, countRarity, deckSize, loadCustom, saveCustom, presetDeck, presetsFor, validate, DECK_SIZE, MAX_LEGENDARIES, type DeckCounts, type DeckPreset } from '../game/deck';
import { loadMatch, saveMatch } from '../game/match';
import { PLAYABLE } from '../game/classes';
import { drawCardDetail, drawCardFace, resInk, CARD_W, CARD_H } from './cardView';
import { CardPreview } from './cardPreview';
import { openDeckPanel } from './deckPanel';
import type { SpellDeck } from '../game/deckYaml';
import { win, selRow, plaque, ink, PAPER, BURN, INK, INK2, RED_INK, GOLD, TRIM } from './skin';
import { bigButton, actionBar, barTapped, swipeIn, tallArea, tabs, sheet, panel, Scroller, TAP, GAP, PAD } from './touchUi';

const RARITY_ORDER = { common: 0, uncommon: 1, legendary: 2, mythic: 3 };
const CLASSES: ClassId[] = PLAYABLE;

// layout (UI pixels)
const VISIBLE = 16, RH = 14;
const LX = 8, LY = 52, LW = 268;
const DX = 286, DW = UW - DX - 8;
/** Height of the card's clip at the top of the detail window. */
const PREVIEW_H = 80;
// touch: a scrollable grid of card tiles instead of thin rows; each tile has its count and -/+ buttons under the card
const COLS = 3, TX = LX + 8, TPX = 86, TPY = CARD_H + 28, TBTN = 26, TBH = 18;

export class DeckBuilderScene implements Scene {
  deck: DeckCounts = {};
  cards: CardDef[] = [];
  sel = 0;
  scroll = 0;
  msg = '';
  msgT = 0;

  private preview = new CardPreview();
  /** Closes the YAML panel while it is open. */
  private closeYaml: (() => void) | null = null;
  /** The start-from picker: its choices ('custom', a ready-made deck id, 'empty'), or null once a start is picked. */
  private picks: string[] | null = null;
  private pickSel = 0;
  /** Tile grid scroll in UI pixels (touch). */
  private tscroll = 0;
  /** The tile grid's window this frame, for scrolling and keeping the selection in view. */
  private grid = { top: 0, h: 0 };

  constructor(public cls: ClassId, private back: () => void = popScene) {
    this.load();
  }

  tall(): boolean { return true; }
  pad(): PadMode { return spread.tall ? 'none' : 'back'; }
  /** Full-height phone layout: the card grid's scroll, its window, and how long a finger has rested on one card. */
  private tscroller = new Scroller();
  private tgrid: [number, number, number, number] = [0, 0, 0, 0];
  private holdT = 0;
  /** The card a resting finger is reading (shown in a sheet from the bottom), or -1. */
  private reading = -1;
  /** The start-from choice whose spell list is open in a sheet, or -1. */
  private peek = -1;

  private load(): void {
    this.loadCards();
    this.deck = loadCustom(this.cls) ?? presetDeck(this.cls, 'starter');
    this.openPicker();
  }

  private loadCards(): void {
    this.cards = cardsFor(this.cls).sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity] || costNum(a) - costNum(b));
    this.sel = this.top; this.scroll = 0; this.tscroll = 0;
  }

  /** The YAML import/export panel (a DOM overlay); while it is open the builder ignores input. */
  private openYaml(): void {
    sfx('select');
    this.closeYaml = openDeckPanel({
      current: { cls: this.cls, deck: this.deck },
      onImport: g => this.applyImport(g),
      onClose: () => { this.closeYaml = null; },
    });
  }

  /** A legal imported spell deck replaces the saved deck of its class (switching to that class if needed). */
  private applyImport(g: SpellDeck): void {
    if (g.cls !== this.cls) { this.cls = g.cls; this.loadCards(); }
    this.deck = { ...g.deck };
    saveCustom(this.cls, this.deck);
    this.picks = null;
    this.sel = this.top; this.scroll = 0; this.tscroll = 0;
    this.flash(`IMPORTED ${(g.name ?? 'SPELL DECK').toUpperCase()}`);
    sfx('confirm');
  }

  /** Show the start-from picker, on your saved deck if there is one, else the deck picked on the character select. */
  private openPicker(): void {
    const saved = loadCustom(this.cls), hasSaved = !!saved && deckSize(saved) > 0;
    this.peek = -1;
    this.picks = [...(hasSaved ? ['custom'] : []), ...this.presets.map(p => p.id), 'empty', 'import'];
    const m = loadMatch(), picked = m.p1 === this.cls ? m.p1Deck : m.cpu === this.cls ? m.cpuDeck : 'starter';
    const want = hasSaved ? 'custom' : picked;
    this.pickSel = Math.max(0, this.picks.indexOf(want));
  }

  private choosePick(id: string): void {
    if (id === 'import') { this.openYaml(); return; }
    const p = this.presets.find(x => x.id === id);
    if (id === 'custom') this.deck = loadCustom(this.cls) ?? {};
    else { this.deck = p ? { ...p.cards } : {}; saveCustom(this.cls, this.deck); }
    this.flash(id === 'custom' ? 'EDITING YOUR SPELL DECK' : p ? `STARTED FROM ${p.name.toUpperCase()}` : 'EMPTY SPELL DECK');
    this.picks = null;
    this.sel = this.top; this.scroll = 0; this.tscroll = 0;
    sfx('select');
  }

  /** The one row above the cards reopens the start-from picker. */
  private get presets(): DeckPreset[] { return presetsFor(this.cls); }
  private readonly top = 1;
  private get rows(): number { return this.top + this.cards.length; }
  private cardAt(idx: number): CardDef | undefined { return idx >= this.top ? this.cards[idx - this.top] : undefined; }

  private flash(s: string): void { this.msg = s; this.msgT = 1.6; }

  private change(card: CardDef, d: 1 | -1): void {
    const have = this.deck[card.id] ?? 0;
    if (d > 0) {
      const why = canAdd(this.deck, card);
      if (why) { this.flash(why); sfx('deny'); return; }
      this.deck[card.id] = have + 1;
      sfx('select');
    } else {
      if (!have) { sfx('deny'); return; }
      if (have === 1) delete this.deck[card.id]; else this.deck[card.id] = have - 1;
      sfx('back');
    }
    saveCustom(this.cls, this.deck);
  }

  private switchClass(cls: ClassId): void {
    if (cls === this.cls) return;
    this.cls = cls;
    this.load();
    sfx('move');
  }

  private special(): void { this.openPicker(); sfx('select'); }

  /** The start-from picker takes the input while it is open. */
  private updatePicker(dt: number): void {
    const picks = this.picks!;
    const h = hot('pick');
    // touch: the first tap shows a deck's spells, a second tap on it starts from it
    if (h >= 0 && mouse.click && touchActive() && h !== this.pickSel && picks[h] !== 'empty' && picks[h] !== 'import') { this.pickSel = h; sfx('move'); return; }
    if (h >= 0 && mouse.moved && !touchActive()) this.pickSel = h;
    if (h >= 0 && mouse.click) { this.choosePick(picks[h]); return; }
    if (navPressed('up', dt)) { this.pickSel = (this.pickSel + picks.length - 1) % picks.length; sfx('move'); }
    if (navPressed('down', dt)) { this.pickSel = (this.pickSel + 1) % picks.length; sfx('move'); }
    if (wasPressed('confirm')) { this.choosePick(picks[this.pickSel]); return; }
    if (wasPressed('back') || wasPressed('pause') || mouse.rclick) { sfx('back'); this.back(); }
  }

  /** Phones and tablets get the tile grid. */
  private get tiles(): boolean { return touchActive(); }
  private maxTileScroll(): number { return Math.max(0, Math.ceil(this.cards.length / COLS) * TPY - this.grid.h + 6); }

  private follow(): void {
    if (this.tiles) {
      if (!this.cardAt(this.sel)) return;
      const top = Math.floor((this.sel - this.top) / COLS) * TPY;
      if (top < this.tscroll) this.tscroll = top;
      if (top + TPY > this.tscroll + this.grid.h) this.tscroll = top + TPY - this.grid.h;
      return;
    }
    if (this.sel < this.scroll) this.scroll = this.sel;
    if (this.sel >= this.scroll + VISIBLE) this.scroll = this.sel - VISIBLE + 1;
  }

  /** Touch: tap a tile or its + to add a copy, - to remove one; holding a tile reads it; dragging scrolls. */
  private updateTiles(): boolean {
    if (mouse.wheel) this.tscroll = Math.max(0, Math.min(this.maxTileScroll(), this.tscroll + mouse.wheel * 28));
    if (isHot('change') && mouse.click) { this.sel = 0; this.special(); return true; }
    const minus = hot('tminus'), plus = hot('tplus'), tile = hot('tile');
    if (minus >= 0 && mouse.click) { this.sel = this.top + minus; this.change(this.cards[minus], -1); return true; }
    if (plus >= 0 && mouse.click) { this.sel = this.top + plus; this.change(this.cards[plus], 1); return true; }
    const over = Math.max(tile, minus, plus);
    if (over >= 0 && mouse.moved) this.sel = this.top + over;
    if (tile >= 0 && (mouse.click || mouse.rclick)) { this.sel = this.top + tile; this.change(this.cards[tile], mouse.click ? 1 : -1); return true; }
    return false;
  }

  update(dt: number): void {
    this.msgT = Math.max(0, this.msgT - dt);
    this.preview.show(!this.picks && showSel() ? this.cardAt(this.sel) ?? null : null);
    this.preview.update(dt);
    if (this.closeYaml) return;
    if (spread.tall) { this.updateTall(dt); return; }
    if (isHot('yaml') && mouse.click) { this.openYaml(); return; }
    if (this.picks) {
      // class tabs still switch class (and reopen the picker for it)
      const tab = hot('tab');
      if (tab >= 0 && mouse.click) { this.switchClass(CLASSES[tab]); return; }
      if (wasPressed('lb') || wasPressed('rb')) {
        const step = wasPressed('lb') ? -1 : 1;
        this.switchClass(CLASSES[(CLASSES.indexOf(this.cls) + step + CLASSES.length) % CLASSES.length]);
        return;
      }
      this.updatePicker(dt);
      return;
    }

    if (this.tiles && this.updateTiles()) return;
    // mouse: hover reads a card, click adds, right-click removes, wheel scrolls
    if (mouse.wheel && hot('row') >= 0) this.scroll = Math.max(0, Math.min(this.rows - VISIBLE, this.scroll + mouse.wheel * 2));
    const tab = hot('tab');
    if (tab >= 0 && mouse.click) { this.switchClass(CLASSES[tab]); return; }
    if (isHot('done') && mouse.click) { this.exit(); return; }
    const minus = hot('minus'), plus = hot('plus'), row = hot('row');
    if (minus >= 0 && mouse.click) { this.sel = minus; this.change(this.cardAt(minus)!, -1); return; }
    if (plus >= 0 && mouse.click) { this.sel = plus; this.change(this.cardAt(plus)!, 1); return; }
    const over = Math.max(row, minus, plus);
    if (over >= 0 && mouse.moved) this.sel = over;
    if (row >= 0 && (mouse.click || mouse.rclick)) {
      this.sel = row;
      const card = this.cardAt(row);
      if (card) this.change(card, mouse.click ? 1 : -1);
      else if (mouse.click) this.special();
      return;
    }

    // the tile grid steps a whole row up and down
    const step = this.tiles && this.cardAt(this.sel) ? COLS : 1;
    if (navPressed('up', dt)) { this.sel = Math.max(0, this.sel - step); sfx('move'); this.follow(); }
    if (navPressed('down', dt)) { this.sel = Math.min(this.rows - 1, this.sel + step); sfx('move'); this.follow(); }
    if (wasPressed('lb') || wasPressed('rb')) {
      const step = wasPressed('lb') ? -1 : 1;
      this.switchClass(CLASSES[(CLASSES.indexOf(this.cls) + step + CLASSES.length) % CLASSES.length]);
      return;
    }
    if (wasPressed('pause')) { this.exit(); return; }
    const card = this.cardAt(this.sel);
    if (card) {
      if (wasPressed('confirm') || navPressed('right', dt)) this.change(card, 1);
      else if (navPressed('left', dt)) this.change(card, -1);
      else if (wasPressed('cast')) { this.change(card, -1); return; }
    } else if (wasPressed('confirm')) this.special();
    // BACK leaves even with a card selected (the cast key removes a copy first, above)
    if (wasPressed('back')) this.exit();
  }

  private exit(): void {
    // using a valid custom deck right away is what people expect after building one
    if (validate(this.deck).length === 0) {
      const m = loadMatch();
      if (m.p1 === this.cls) { m.p1Deck = 'custom'; saveMatch(m); }
    }
    sfx('back');
    this.back();
  }

  /** The full-height phone layout's input: tabs, the bar, swipes between classes, the card grid and the picker. */
  private updateTall(dt: number): void {
    const tab = hot('tab');
    if (tab >= 0 && mouse.click) { this.switchClass(CLASSES[tab]); return; }
    // a ready-made deck's list, open in a sheet over the picker: START takes it, any other tap closes it
    if (this.picks && this.peek >= 0) {
      if (mouse.click && isHot('t:start')) { this.choosePick(this.picks[this.peek]); this.peek = -1; return; }
      if (mouse.click || wasPressed('back') || mouse.rclick) { this.peek = -1; sfx('back'); }
      return;
    }
    if (barTapped('mid')) { this.openYaml(); return; }
    if (barTapped('back') || barTapped('primary') || wasPressed('back') || mouse.rclick) {
      if (this.picks) { sfx('back'); this.back(); } else this.exit();
      return;
    }
    // swiping the grid sideways steps through the classes
    const sw = swipeIn(...this.tgrid);
    if (sw) { this.switchClass(CLASSES[(CLASSES.indexOf(this.cls) + sw + CLASSES.length) % CLASSES.length]); return; }
    if (this.picks) {
      const h = hot('pick'), id = this.picks[h];
      // a deck with spells in it opens its list first, like hovering one does on wider screens
      if (h >= 0 && mouse.click) {
        if (id === 'empty' || id === 'import') this.choosePick(id);
        else { this.pickSel = this.peek = h; sfx('open'); }
      }
      return;
    }
    if (isHot('change') && mouse.click) { this.special(); return; }
    this.tscroller.update(...this.tgrid);
    // a finger resting on a card reads it; lifting closes the sheet, dragging cancels
    const t = hot('tile');
    if (mouse.touched || Math.abs(gesture.dy) > 1 || !mouse.down) this.holdT = 0;
    else if (t >= 0) this.holdT += dt;
    this.reading = mouse.down && t >= 0 && this.holdT >= 0.35 ? t : -1;
    if (this.reading >= 0) this.sel = this.top + this.reading;
    const minus = hot('tminus');
    if (minus >= 0 && mouse.click) { this.sel = this.top + minus; this.change(this.cards[minus], -1); return; }
    if (t >= 0 && mouse.click) { this.sel = this.top + t; this.change(this.cards[t], 1); }
  }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    drawStage(c, getArena(), tick);
    c.fillStyle = 'rgba(40,20,0,0.5)';
    c.fillRect(...screenRect());
    if (spread.tall) { this.drawTall(ui); return; }

    // header: class tabs, counts, done (phone portrait moves it up, and the list rows grow, into the spare height)
    const hy = vy(4) - 4;
    win(ui, 8, 4 + hy, UW - 16, 40, { accent: teamColor(this.cls, loadMatch().p1Skin[this.cls], false), burn: 3 });
    CLASSES.forEach((cl, i) => button(ui, `tab:${i}`, cl.toUpperCase(), 14 + i * 54, 12 + hy, 52, 14, cl === this.cls, cl === this.cls ? RED_INK : INK2));
    drawText(ui, 'SPELL DECK', 300, 11 + hy, INK);
    const n = deckSize(this.deck), leg = countRarity(this.deck, 'legendary'), myth = countRarity(this.deck, 'mythic');
    drawText(ui, `SPELLS ${n}/${DECK_SIZE}`, 14, 31 + hy, n === DECK_SIZE ? '#007800' : RED_INK);
    drawText(ui, `LEGENDARY ${leg}/${MAX_LEGENDARIES}`, 104, 31 + hy, leg <= MAX_LEGENDARIES ? ink(RARITY_COLOR.legendary) : RED_INK);
    drawText(ui, `MYTHIC ${myth}/1`, 212, 31 + hy, myth === 1 ? ink(RARITY_COLOR.mythic) : RED_INK);
    const ok = validate(this.deck).length === 0;
    drawText(ui, ok ? 'READY' : 'NOT READY', 300, 23 + hy, ok ? '#007800' : RED_INK);
    button(ui, 'yaml', 'YAML', UW - 112, 13 + hy, 46, 24, false, INK2);
    button(ui, 'done', 'DONE', UW - 60, 13 + hy, 46, 24, false, RED_INK);

    // list
    const ly = vy(LY), rh = Math.round(RH * spread.k), off = Math.round((rh - RH) / 2);
    win(ui, LX, ly - 4, LW, VISIBLE * rh + 6);
    if (this.tiles) this.drawTiles(ui, ly, VISIBLE * rh);
    else {
      for (let i = 0; i < VISIBLE; i++) {
        const idx = this.scroll + i;
        if (idx >= this.rows) break;
        const y = ly + i * rh, ty = y + 3 + off;
        const on = idx === this.sel && showSel();
        zone(`row:${idx}`, LX + 1, y - 1, LW - 2, rh);
        if (on) selRow(ui, LX + 1, y - 1, LW - 2, rh);
        const card = this.cardAt(idx);
        if (!card) {
          drawText(ui, 'CHANGE STARTING SPELL DECK...', LX + 64, ty, on ? INK : INK2);
          continue;
        }
        const have = this.deck[card.id] ?? 0, max = MAX_COPIES[card.rarity];
        zone(`minus:${idx}`, LX + 2, y - 1, 14, rh);
        zone(`plus:${idx}`, LX + 42, y - 1, 14, rh);
        if (on) {
          drawText(ui, '-', LX + 6, ty, hot('minus') === idx ? GOLD : have ? PAPER : BURN);
          drawText(ui, '+', LX + 46, ty, hot('plus') === idx ? RED_INK : have < max ? INK : BURN);
        }
        drawText(ui, `${have}/${max}`, LX + 18, ty, have ? INK : TRIM);
        P(ui, ELEMENT_COLOR[card.element], LX + 58, y + 2 + off, 3, 8);
        drawText(ui, card.name.toUpperCase(), LX + 66, ty, card.rarity === 'common' ? INK : ink(RARITY_COLOR[card.rarity]));
        drawText(ui, card.cost === 'all' ? 'A' : String(card.cost), LX + LW - 14, ty, resInk(card));
      }
      // scrollbar
      const total = this.rows, trackH = VISIBLE * rh;
      const bh = Math.max(10, Math.round((VISIBLE / total) * trackH));
      const by = ly + Math.round((this.scroll / Math.max(1, total - VISIBLE)) * (trackH - bh));
      P(ui, BURN, LX + LW + 1, ly - 2, 3, trackH);
      P(ui, INK2, LX + LW + 1, by - 2, 3, bh);
    }

    // detail: the card's clip, then its numbers and rules
    const card = showSel() ? this.cardAt(this.sel) : undefined;
    const dh = VISIBLE * rh + 6;
    win(ui, DX, ly - 4, DW, dh, { accent: card ? ELEMENT_COLOR[card.element] : undefined });
    if (card) {
      const have = this.deck[card.id] ?? 0;
      this.preview.draw(ui, DX + 8, ly + 6, DW - 16, PREVIEW_H);
      const y = drawCardDetail(ui, card, DX + 8, ly + PREVIEW_H + 14, DW - 16) + 6;
      drawText(ui, `IN SPELL DECK ${have} / ${MAX_COPIES[card.rarity]}`, DX + 8, y, have ? INK : TRIM);
    } else if (!showSel()) {
      drawText(ui, 'TOUCH A CARD TO READ IT', DX + 8, ly + 8, INK2);
    } else {
      drawText(ui, 'START FROM YOUR SPELL DECK,', DX + 8, ly + 8, INK2);
      drawText(ui, 'A READY-MADE ONE OR NOTHING', DX + 8, ly + 20, INK2);
    }

    // footer
    const errs = validate(this.deck);
    const fy = ly + VISIBLE * rh + 10;
    if (this.msgT > 0) drawTextCentered(ui, this.msg, UW / 2, fy, '#f8b800');
    else if (errs.length) drawTextCentered(ui, errs[0], UW / 2, fy, '#f83800');
    else drawTextCentered(ui, 'SPELL DECK READY. SAVED IN THIS BROWSER.', UW / 2, fy, '#58d854');
    if (this.picks) { this.drawPicker(ui); return; }
    hint(ui, this.tiles ? 'TAP: ADD   -: REMOVE   HOLD: READ   DRAG: SCROLL' : `HOVER TO READ   CLICK: ADD   RIGHT-CLICK: REMOVE   WHEEL: SCROLL`);
  }

  /** Touch: the start-from button over a scrolling grid of card tiles, inside the list window (top `ly`, height `h`). */
  private drawTiles(ui: Ctx, ly: number, h: number): void {
    const bh = Math.round(18 * spread.k), on = this.sel === 0 && showSel();
    button(ui, 'change', 'CHANGE STARTING SPELL DECK...', LX + 6, ly, LW - 12, bh, on, INK2);
    const top = ly + bh + 4, gh = h - bh - 4;
    this.grid = { top, h: gh };
    this.tscroll = Math.min(this.tscroll, this.maxTileScroll());
    ui.save();
    ui.beginPath();
    ui.rect(LX, top, LW, gh);
    ui.clip();
    this.cards.forEach((card, i) => {
      const x = TX + (i % COLS) * TPX, y = top + 4 + Math.floor(i / COLS) * TPY - this.tscroll;
      if (y + TPY < top || y > top + gh) return;
      const have = this.deck[card.id] ?? 0, max = MAX_COPIES[card.rarity], lit = this.sel === this.top + i && showSel();
      // hit zones only over the visible part of the tile
      const clip = (zy: number, zh: number): [number, number] => { const a = Math.max(zy, top), b = Math.min(zy + zh, top + gh); return [a, b - a]; };
      const [fy, fh] = clip(y, CARD_H);
      if (fh > 0) zone(`tile:${i}`, x, fy, CARD_W, fh);
      // cards not in the deck are faded
      drawCardFace(ui, card, x, y, { lit, faded: !have });
      const by = y + CARD_H + 5, [zy, zh] = clip(by, TBH);
      if (zh > 0) { zone(`tminus:${i}`, x - 2, zy, TBTN + 2, zh); zone(`tplus:${i}`, x + CARD_W - TBTN, zy, TBTN + 2, zh); }
      // drawn as plain plaques: button() would add zones outside the clip
      const mt = plaque(ui, x, by, TBTN, TBH, isHot(`tminus:${i}`));
      drawTextCentered(ui, '-', x + TBTN / 2, by + 6, isHot(`tminus:${i}`) ? mt : have ? INK : BURN, 1, false);
      drawTextCentered(ui, `${have}/${max}`, x + CARD_W / 2, by + 6, have ? INK : TRIM, 1, false);
      const pt = plaque(ui, x + CARD_W - TBTN, by, TBTN, TBH, isHot(`tplus:${i}`));
      drawTextCentered(ui, '+', x + CARD_W - TBTN / 2, by + 6, isHot(`tplus:${i}`) ? pt : have < max ? RED_INK : BURN, 1, false);
    });
    ui.restore();
    // scrollbar
    const max = this.maxTileScroll();
    if (max > 0) {
      const sh = Math.max(16, Math.round(gh * gh / (gh + max)));
      P(ui, BURN, LX + LW + 1, top, 3, gh);
      P(ui, INK2, LX + LW + 1, top + Math.round((this.tscroll / max) * (gh - sh)), 3, sh);
    }
  }

  /** The start-from picker: choices on the left, the hovered deck's list on the right. */
  private drawPicker(ui: Ctx): void {
    const picks = this.picks!;
    ui.fillStyle = 'rgba(40,20,0,0.55)';
    // phone portrait: placed and sized like the list window, with taller rows
    const ly = vy(LY), lh = VISIBLE * Math.round(RH * spread.k);
    ui.fillRect(0, ly - 6, UW, lh + 30);
    const x = 24, y = ly - 2, w = UW - 48, hgt = lh + 2, colW = 176, rh = Math.round(22 * spread.k), ro = Math.round((rh - 22) / 2);
    win(ui, x, y, w, hgt, { accent: teamColor(this.cls, loadMatch().p1Skin[this.cls], false) });
    drawText(ui, 'START YOUR SPELL DECK FROM', x + 10, y + 8, INK);
    const saved = loadCustom(this.cls);
    picks.forEach((id, i) => {
      const ry = y + 24 + i * rh, on = i === this.pickSel && showSel();
      zone(`pick:${i}`, x + 4, ry - 2, colW, rh);
      if (on) selRow(ui, x + 4, ry - 2, colW, rh);
      const p = this.presets.find(q => q.id === id);
      const name = id === 'custom' ? 'YOUR SPELL DECK' : id === 'empty' ? 'EMPTY SPELL DECK' : id === 'import' ? 'IMPORT YAML...' : p!.name.toUpperCase() + (id === 'starter' ? ' (STARTER)' : '');
      const sub = id === 'custom' ? (saved && !validate(saved).length ? 'SAVED, READY' : `SAVED, ${deckSize(saved ?? {})}/${DECK_SIZE} SPELLS`)
        : id === 'empty' ? 'BUILD FROM SCRATCH' : id === 'import' ? 'PASTE OR PICK A FILE'
          : `MYTHIC: ${(this.cards.find(c => c.id === p!.mythic)?.name ?? '').toUpperCase()}`;
      drawText(ui, name, x + 22, ry + 2 + ro, on ? INK : INK2);
      drawText(ui, sub, x + 22, ry + 11 + ro, p ? ink(RARITY_COLOR.mythic) : TRIM);
    });
    // the hovered choice's list
    const lx = x + colW + 16, id = showSel() ? picks[this.pickSel] : undefined;
    P(ui, BURN, lx - 8, y + 22, 1, hgt - 30);
    const list = id === 'custom' ? saved ?? {} : this.presets.find(q => q.id === id)?.cards ?? {};
    const cards = this.cards.filter(c => list[c.id]);
    if (!id) drawText(ui, 'TOUCH A SPELL DECK TO SEE IT', lx, y + 24, INK2);
    else if (id === 'import') ['PASTE A SPELL DECK OR PICK A', '.YAML FILE. IMPORTS THAT', 'BREAK A DECK RULE ARE', 'REFUSED. YAML IN THE', 'HEADER EXPORTS YOUR DECK.'].forEach((l, i) => drawText(ui, l, lx, y + 24 + i * 11, INK2));
    else if (!cards.length && id !== 'import') drawText(ui, id === 'empty' ? 'NO SPELLS YET' : 'YOUR SPELL DECK IS EMPTY', lx, y + 24, INK2);
    cards.forEach((c, i) => drawText(ui, `${list[c.id]}X ${c.name.toUpperCase()}`, lx, y + 24 + i * 11, c.rarity === 'common' ? INK2 : ink(RARITY_COLOR[c.rarity])));
    if (id && id !== 'custom' && picks[0] === 'custom') drawText(ui, 'REPLACES YOUR SAVED SPELL DECK', lx, y + hgt - 14, RED_INK);
    hint(ui, touchActive() ? 'TAP: SEE A SPELL DECK   TAP IT AGAIN: START FROM IT' : `HOVER TO SEE A SPELL DECK   CLICK: START FROM IT   RIGHT-CLICK: BACK`);
  }

  // ---------- full-height phone layout ----------

  /** The phone layout: class tabs, the counts, a scrolling grid of cards and the action bar. */
  private drawTall(ui: Ctx): void {
    const a = tallArea(), x0 = a.x + PAD, w = a.w - PAD * 2;
    let y = a.y + 10;
    tabs(ui, 'tab', CLASSES.map(c => c.toUpperCase()), CLASSES.indexOf(this.cls), x0, y, w, 48);
    y += 58;
    // the counts
    const n = deckSize(this.deck), leg = countRarity(this.deck, 'legendary'), myth = countRarity(this.deck, 'mythic');
    const ok = validate(this.deck).length === 0;
    win(ui, x0, y, w, 46, { accent: teamColor(this.cls, loadMatch().p1Skin[this.cls], false), burn: 3 });
    drawText(ui, `SPELLS ${n}/${DECK_SIZE}`, x0 + 12, y + 10, n === DECK_SIZE ? '#007800' : RED_INK, 2);
    drawText(ui, ok ? 'READY' : 'NOT READY', x0 + w - 12 - (ok ? 60 : 108), y + 10, ok ? '#007800' : RED_INK, 2);
    drawText(ui, `LEGENDARY ${leg}/${MAX_LEGENDARIES}`, x0 + 12, y + 30, leg <= MAX_LEGENDARIES ? ink(RARITY_COLOR.legendary) : RED_INK);
    drawText(ui, `MYTHIC ${myth}/1`, x0 + 150, y + 30, myth === 1 ? ink(RARITY_COLOR.mythic) : RED_INK);
    y += 56;

    const barTop = a.y + a.h - 84, msgY = barTop - 22;
    actionBar(ui, { mid: { id: 'yaml', label: 'YAML' }, primary: { id: 'done', label: 'DONE' } });
    const errs = validate(this.deck);
    const note = this.msgT > 0 ? [this.msg, '#f8b800'] : errs.length ? [errs[0], '#f83800'] : ['SPELL DECK READY. SAVED HERE.', '#58d854'];
    drawTextCentered(ui, note[0], UW / 2, msgY, note[1], note[0].length * 12 < w ? 2 : 1);

    if (this.picks) { this.drawTallPicker(ui, x0, y, w, msgY - 10 - y); return; }
    bigButton(ui, 'change', 'CHANGE STARTING DECK', x0, y, w, 48);
    y += 58;
    // the card grid: four to a row, tap a card to add a copy, - takes one out, rest a finger on a card to read it
    const gh = msgY - 10 - y, cols = 4, cw = Math.floor((w - GAP * (cols - 1)) / cols), rowH = CARD_H + 56;
    this.tgrid = [a.x, y, a.w, gh];
    const sc = this.tscroller;
    sc.max = Math.max(0, Math.ceil(this.cards.length / cols) * rowH - gh + 8);
    panel(ui, x0 - 6, y - 6, w + 12, gh + 12);
    ui.save();
    ui.beginPath(); ui.rect(x0 - 3, y - 3, w + 6, gh + 6); ui.clip();
    this.cards.forEach((card, i) => {
      const cx = x0 + (i % cols) * (cw + GAP), cy = y + 6 + Math.floor(i / cols) * rowH - Math.round(sc.pos);
      if (cy + rowH < y || cy > y + gh) return;
      const have = this.deck[card.id] ?? 0, max = MAX_COPIES[card.rarity];
      const clip = (zy: number, zh: number): [number, number] => { const lo = Math.max(zy, y), hi = Math.min(zy + zh, y + gh); return [lo, hi - lo]; };
      const fx = cx + Math.round((cw - CARD_W) / 2);
      const [fy, fh] = clip(cy, CARD_H);
      if (fh > 0) zone(`tile:${i}`, fx, fy, CARD_W, fh);
      drawCardFace(ui, card, fx, cy, { lit: this.reading === i, faded: !have });
      // under the card: a big minus and the count
      const by = cy + CARD_H + 6, [zy, zh] = clip(by, 44);
      if (zh > 0) zone(`tminus:${i}`, cx, zy, 48, zh);
      const mt = plaque(ui, cx, by, 48, 42, mouse.down && isHot(`tminus:${i}`));
      drawTextCentered(ui, '-', cx + 24, by + 14, mouse.down && isHot(`tminus:${i}`) ? mt : have ? INK : BURN, 2, false);
      drawText(ui, `${have}/${max}`, cx + 56, by + 14, have ? INK : TRIM, 2);
    });
    ui.restore();
    if (sc.max > 0) {
      const sh = Math.max(24, Math.round(gh * gh / (gh + sc.max)));
      P(ui, BURN, a.x + a.w - 6, y, 4, gh);
      P(ui, INK2, a.x + a.w - 6, y + Math.round((sc.pos / sc.max) * (gh - sh)), 4, sh);
    }
    // reading a card: its clip and rules slide up from the bottom
    const card = this.reading >= 0 ? this.cards[this.reading] : undefined;
    if (card) {
      sheet(ui, 360, (sx, sy, sw) => {
        this.preview.draw(ui, sx, sy, sw, 140);
        const yy = drawCardDetail(ui, card, sx, sy + 152, sw, 2);
        drawText(ui, `IN DECK ${this.deck[card.id] ?? 0} / ${MAX_COPIES[card.rarity]}`, sx, yy + 4, INK2, 2);
      });
    }
  }

  /** The start-from picker in the phone layout: a column of big choices. */
  private drawTallPicker(ui: Ctx, x: number, y: number, w: number, h: number): void {
    const picks = this.picks!;
    panel(ui, x - 6, y, w + 12, h);
    drawTextCentered(ui, 'START YOUR SPELL DECK FROM', UW / 2, y + 14, INK, 2, false);
    const saved = loadCustom(this.cls);
    const rh = Math.min(TAP + 16, Math.floor((h - 44) / picks.length) - 6);
    picks.forEach((id, i) => {
      const p = this.presets.find(q => q.id === id);
      const name = id === 'custom' ? 'YOUR DECK' : id === 'empty' ? 'EMPTY DECK' : id === 'import' ? 'IMPORT YAML' : p!.name.toUpperCase() + (id === 'starter' ? ' (STARTER)' : '');
      const sub = id === 'custom' ? (saved && !validate(saved).length ? 'SAVED, READY' : `SAVED, ${deckSize(saved ?? {})}/${DECK_SIZE} SPELLS`)
        : id === 'empty' ? 'BUILD FROM SCRATCH' : id === 'import' ? 'PASTE OR PICK A FILE'
          : `MYTHIC: ${(this.cards.find(c => c.id === p!.mythic)?.name ?? '').toUpperCase()}`;
      bigButton(ui, `pick:${i}`, name, x + 6, y + 40 + i * (rh + 6), w - 12, rh, { sub, scale: name.length * 12 < w - 30 ? 2 : 1, on: i === this.peek });
    });
    // the tapped deck's spells, and START to take it
    const id = this.peek >= 0 ? picks[this.peek] : undefined;
    if (!id) return;
    const p = this.presets.find(q => q.id === id);
    const list = id === 'custom' ? saved ?? {} : p?.cards ?? {};
    const cards = this.cards.filter(c => list[c.id]), half = Math.ceil(cards.length / 2);
    sheet(ui, 150 + Math.max(1, half) * 16 + 70, (sx, sy, sw, sh) => {
      drawText(ui, id === 'custom' ? 'YOUR SPELL DECK' : p!.name.toUpperCase(), sx, sy, INK, 2);
      drawText(ui, `${deckSize(list)} SPELLS`, sx + sw - textWidth(`${deckSize(list)} SPELLS`, 1), sy + 4, TRIM, 1);
      if (!cards.length) drawText(ui, 'YOUR SPELL DECK IS EMPTY', sx, sy + 34, INK2, 1);
      const cw = Math.floor(sw / 2), max = Math.floor((cw - 8) / 6);
      cards.forEach((c, i) => drawText(ui, `${list[c.id]}X ${c.name.toUpperCase()}`.slice(0, max), sx + (i < half ? 0 : cw), sy + 32 + (i % half) * 16,
        c.rarity === 'common' ? INK2 : ink(RARITY_COLOR[c.rarity]), 1));
      if (id !== 'custom' && picks[0] === 'custom') drawText(ui, 'REPLACES YOUR SAVED SPELL DECK', sx, sy + sh - 84, RED_INK, 1);
      bigButton(ui, 't:start', 'START FROM IT', sx, sy + sh - 66, sw, TAP, { primary: true });
    });
  }
}

const costNum = (c: CardDef): number => (c.cost === 'all' ? 6 : c.cost);
