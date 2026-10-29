// Spell deck builder: 30 spells, 4/2/1 copy limits, max 5 Legendaries, exactly 1 Mythic. Autosaves.
// Opening it (or switching class) shows your spell decks for the class, to edit, rename, clone or delete; a new
// one starts from a ready-made deck, an empty one or a friend's share code. Opened on one of your decks, it edits that.
import { popScene, hint, zone, hot, isHot, button, showSel, type Scene } from './scene';
import { getArena } from '../game/battleView';
import { drawStage } from '../art/arena';
import { teamColor, type ClassId } from '../art/sprites';
import { P, UW, screenRect, spread, vy, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered, textWidth } from '../engine/font';
import { wasPressed, navPressed, mouse, gesture, k, usingPad } from '../engine/input';
import { touchActive, type PadMode } from '../engine/touch';
import { sfx } from '../engine/audio';
import { cardsFor, ELEMENT_COLOR, MAX_COPIES, RARITY_COLOR, type CardDef } from '../game/cards';
import {
  canAdd, countRarity, deckSize, customDecks, getCustom, createCustom, saveCustom, renameCustom, cloneCustom, deleteCustom, cleanDeckName,
  customChoice, customIdOf, presetsFor, validate, DECK_SIZE, MAX_LEGENDARIES, MAX_CUSTOM_DECKS, DECK_NAME_MAX, type DeckCounts, type DeckPreset,
} from '../game/deck';
import type { SavedDeck } from '../engine/save';
import { loadMatch, saveMatch } from '../game/match';
import { PLAYABLE, CLASS_INFO } from '../game/classes';
import { drawCardDetail, drawCardFace, resInk, CARD_W, CARD_H } from './cardView';
import { CardPreview } from './cardPreview';
import { openDeckPanel, type DeckPanel } from './deckPanel';
import { NameEntry } from './nameEntry';
import type { SpellDeck } from '../game/deckCode';
import { win, selRow, plaque, ink, PAPER, BURN, INK, INK2, RED_INK, GOLD, TRIM } from './skin';
import { bigButton, actionBar, barTapped, swipeIn, tallArea, tabs, sheet, panel, rowList, Scroller, TAP, GAP, PAD } from './touchUi';

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
/** What can be done to one of your decks from the list. */
const ACTS = ['EDIT', 'RENAME', 'CLONE', 'SHARE', 'DELETE'] as const;
type Act = typeof ACTS[number];

export class DeckBuilderScene implements Scene {
  deck: DeckCounts = {};
  cards: CardDef[] = [];
  sel = 0;
  scroll = 0;
  msg = '';
  msgT = 0;

  private preview = new CardPreview();
  /** The share / import panel while it is open. */
  private sharing: DeckPanel | null = null;
  /** The start-from picker for a new deck: its choices (a ready-made deck id, 'empty', 'import'), or null when closed. */
  private picks: string[] | null = null;
  private pickSel = 0;
  /** The list of your decks is showing (rather than the picker or one deck's cards). */
  private listing = false;
  /** In the list: the row (a deck, or NEW after the last), whether the cursor is on the actions, and which one. */
  private listSel = 0;
  private onActs = false;
  private actSel = 0;
  /** A deck whose DELETE was pressed once: pressing it again deletes. */
  private armed: string | null = null;
  /** The deck being edited. */
  private editing: string | null = null;
  /** Renaming a deck: the name box, and which deck. */
  private naming: { entry: NameEntry; id: string } | null = null;
  /** Phone layout: the list's scroll. */
  private lscroller = new Scroller();
  private lrect: [number, number, number, number] = [0, 0, 0, 0];
  /** Tile grid scroll in UI pixels (touch). */
  private tscroll = 0;
  /** The tile grid's window this frame, for scrolling and keeping the selection in view. */
  private grid = { top: 0, h: 0 };

  constructor(public cls: ClassId, private back: () => void = popScene, deckId?: string) {
    this.loadCards();
    if (deckId && getCustom(cls, deckId)) this.edit(deckId, false);
    else this.openList();
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

  private get decks(): SavedDeck[] { return customDecks(this.cls); }
  /** The deck under the list cursor, or null on NEW. */
  private get listed(): SavedDeck | null { return this.decks[this.listSel] ?? null; }
  private get editingName(): string { return (this.editing && getCustom(this.cls, this.editing)?.name) || 'SPELL DECK'; }

  /** Show the list of your decks for the class, on the one being edited (or the one picked for the fight). With none yet, the picker. */
  private openList(): void {
    const decks = this.decks;
    if (!decks.length) { this.listing = false; this.openPicker(); return; }
    const m = loadMatch(), picked = customIdOf(m.p1 === this.cls ? m.p1Deck : m.cpu === this.cls ? m.cpuDeck : '');
    const want = this.editing ?? picked;
    this.listSel = Math.max(0, decks.findIndex(d => d.id === want));
    this.listing = true; this.picks = null; this.onActs = false; this.armed = null; this.editing = null;
    this.lscroller.pos = 0;
  }

  /** Open one of your decks for editing. */
  private edit(id: string, say = true): void {
    const d = getCustom(this.cls, id);
    if (!d) return;
    this.editing = id;
    this.deck = { ...d.cards };
    this.listing = false; this.picks = null; this.armed = null;
    this.sel = this.top; this.scroll = 0; this.tscroll = 0; this.tscroller.pos = 0;
    if (say) { this.flash(`EDITING ${d.name}`); sfx('select'); }
  }

  /** Run one of the list's actions on the deck under the cursor. */
  private act(a: Act): void {
    const d = this.listed;
    if (!d) return;
    if (a !== 'DELETE') this.armed = null;
    if (a === 'EDIT') { this.edit(d.id); return; }
    if (a === 'SHARE') { this.openShare(); return; }
    if (a === 'RENAME') { this.naming = { entry: new NameEntry(d.name, 'NAME THIS SPELL DECK', cleanDeckName, DECK_NAME_MAX), id: d.id }; sfx('select'); return; }
    if (a === 'CLONE') {
      const c = cloneCustom(this.cls, d.id);
      if (!c) { this.flash(`${MAX_CUSTOM_DECKS} SPELL DECKS IS THE MOST: DELETE ONE FIRST`); sfx('deny'); return; }
      this.listSel = this.decks.findIndex(x => x.id === c.id);
      this.flash(`COPIED AS ${c.name}`); sfx('confirm');
      return;
    }
    // DELETE asks twice
    if (this.armed !== d.id) { this.armed = d.id; this.flash(`DELETE ${d.name}? PRESS DELETE AGAIN`); sfx('deny'); return; }
    deleteCustom(this.cls, d.id);
    this.armed = null;
    // a fight setup that used it goes back to the starter
    const m = loadMatch(), gone = customChoice(d.id);
    if (m.p1 === this.cls && m.p1Deck === gone) m.p1Deck = 'starter';
    if (m.cpu === this.cls && m.cpuDeck === gone) m.cpuDeck = 'starter';
    saveMatch(m);
    this.listSel = Math.min(this.listSel, this.decks.length);
    if (!this.decks.length) this.onActs = false;
    this.flash(`DELETED ${d.name}`); sfx('back');
  }

  /** The rename box takes the input while it is open. */
  private updateNaming(dt: number): void {
    const n = this.naming!, r = n.entry.update(dt);
    if (r === 'cancel') this.naming = null;
    if (r === 'ok') {
      const name = renameCustom(this.cls, n.id, n.entry.text);
      this.naming = null;
      if (name) { this.flash(`RENAMED TO ${name}`); sfx('confirm'); }
    }
  }

  /** The list of your decks takes the input while it shows (wider screens; phones use updateTall). */
  private updateList(dt: number): void {
    const decks = this.decks, rows = decks.length + 1;
    const h = hot('dl'), a = hot('act');
    if (h >= 0 && mouse.moved && !touchActive() && !this.onActs) this.listSel = h;
    if (mouse.click && h >= 0) {
      this.listSel = h; this.armed = null;
      if (h >= decks.length) { this.newDeck(); return; }
      this.onActs = true; this.actSel = 0; sfx('select');
      return;
    }
    if (mouse.click && a >= 0) { this.actSel = a; this.act(ACTS[a]); return; }
    if (a >= 0 && mouse.moved && this.onActs) this.actSel = a;
    const up = navPressed('up', dt), down = navPressed('down', dt), l = navPressed('left', dt), r = navPressed('right', dt);
    if (up || down) {
      this.listSel = (this.listSel + (down ? 1 : -1) + rows) % rows;
      this.onActs = false; this.armed = null; sfx('move');
    }
    if (this.onActs) {
      if (l || r) { this.actSel = (this.actSel + (r ? 1 : -1) + ACTS.length) % ACTS.length; sfx('move'); }
      if (wasPressed('confirm')) this.act(ACTS[this.actSel]);
      else if (wasPressed('back') || mouse.rclick) { this.onActs = false; this.armed = null; sfx('back'); }
      return;
    }
    if (wasPressed('confirm') || (r && this.listed)) {
      if (!this.listed) { this.newDeck(); return; }
      this.onActs = true; this.actSel = 0; sfx('select');
      return;
    }
    if (wasPressed('back') || wasPressed('pause') || mouse.rclick) { sfx('back'); this.back(); }
  }

  /** On to the start-from picker, if there is room for another deck. */
  private newDeck(): void {
    if (this.decks.length >= MAX_CUSTOM_DECKS) { this.flash(`${MAX_CUSTOM_DECKS} SPELL DECKS IS THE MOST: DELETE ONE FIRST`); sfx('deny'); return; }
    this.listing = false;
    this.openPicker();
    sfx('select');
  }

  private loadCards(): void {
    this.cards = cardsFor(this.cls).sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity] || costNum(a) - costNum(b));
    this.sel = this.top; this.scroll = 0; this.tscroll = 0;
  }

  /**
   * The share / import panel (a DOM overlay) for the deck under the list cursor or being edited; from the
   * start-from picker (or NEW in the list) it only imports. While it is open the builder ignores input, except a
   * gamepad's A (copy the code) and B (close), since a pad can't reach the panel's buttons.
   */
  private openShare(): void {
    sfx('select');
    const d = this.listing ? this.listed : null;
    const current = this.picks ? undefined : this.listing ? d && { cls: this.cls, name: d.name, deck: d.cards } : { cls: this.cls, name: this.editing ? this.editingName : undefined, deck: this.deck };
    this.sharing = openDeckPanel({
      current: current ?? undefined,
      onImport: g => this.applyImport(g),
      onClose: () => { this.sharing = null; },
      pad: usingPad(),
    });
  }

  /** A legal imported spell deck becomes a new deck of its class (switching to that class if needed). */
  private applyImport(g: SpellDeck): void {
    if (g.cls !== this.cls) { this.cls = g.cls; this.loadCards(); }
    const made = createCustom(this.cls, g.name ?? 'IMPORTED', g.deck);
    if (!made) { this.openList(); this.flash(`${MAX_CUSTOM_DECKS} SPELL DECKS IS THE MOST: DELETE ONE FIRST`); sfx('deny'); return; }
    this.edit(made.id, false);
    this.flash(`IMPORTED AS ${made.name}`);
    sfx('confirm');
  }

  /** Show the start-from picker for a new deck, on the ready-made deck picked for the fight. */
  private openPicker(): void {
    this.peek = -1;
    this.picks = [...this.presets.map(p => p.id), 'empty', 'import'];
    const m = loadMatch(), picked = m.p1 === this.cls ? m.p1Deck : m.cpu === this.cls ? m.cpuDeck : 'starter';
    this.pickSel = Math.max(0, this.picks.indexOf(picked));
  }

  /** Leave the picker: back to the list, or out of the builder when there are no decks to list. */
  private closePicker(): void {
    sfx('back');
    if (this.decks.length) this.openList(); else this.back();
  }

  private choosePick(id: string): void {
    if (id === 'import') { this.openShare(); return; }
    const p = this.presets.find(x => x.id === id);
    const made = createCustom(this.cls, p ? `MY ${p.name}` : 'SPELL DECK', p ? p.cards : {});
    if (!made) { this.flash(`${MAX_CUSTOM_DECKS} SPELL DECKS IS THE MOST: DELETE ONE FIRST`); sfx('deny'); return; }
    this.edit(made.id, false);
    this.flash(p ? `NEW DECK FROM ${p.name.toUpperCase()}` : 'NEW EMPTY SPELL DECK');
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
    if (this.editing) saveCustom(this.cls, this.editing, this.deck);
  }

  private switchClass(cls: ClassId): void {
    if (cls === this.cls) return;
    this.cls = cls;
    this.loadCards();
    this.editing = null;
    this.openList();
    sfx('move');
  }

  /** The row above the cards goes back to the list of your decks. */
  private special(): void { this.openList(); sfx('select'); }

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
    if (wasPressed('back') || wasPressed('pause') || mouse.rclick) this.closePicker();
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
    this.preview.show(!this.picks && !this.listing && showSel() ? this.cardAt(this.sel) ?? null : null);
    this.preview.update(dt);
    if (this.sharing) {
      if (usingPad() && wasPressed('back')) this.sharing.close();
      else if (usingPad() && wasPressed('confirm')) { this.sharing.copyCode(); sfx('confirm'); }
      return;
    }
    if (this.naming) { this.updateNaming(dt); return; }
    if (spread.tall) { this.updateTall(dt); return; }
    if (isHot('share') && mouse.click) { this.openShare(); return; }
    if (this.picks || this.listing) {
      if (isHot('done') && mouse.click) { if (this.listing) { sfx('back'); this.back(); } else this.closePicker(); return; }
      // class tabs still switch class (and reopen the list for it)
      const tab = hot('tab');
      if (tab >= 0 && mouse.click) { this.switchClass(CLASSES[tab]); return; }
      if (wasPressed('lb') || wasPressed('rb')) {
        const step = wasPressed('lb') ? -1 : 1;
        this.switchClass(CLASSES[(CLASSES.indexOf(this.cls) + step + CLASSES.length) % CLASSES.length]);
        return;
      }
      if (this.listing) this.updateList(dt); else this.updatePicker(dt);
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
    if (this.editing && validate(this.deck).length === 0) {
      const m = loadMatch();
      if (m.p1 === this.cls) { m.p1Deck = customChoice(this.editing); saveMatch(m); }
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
    if (this.listing) { this.updateTallList(); return; }
    if (barTapped('mid')) { this.openShare(); return; }
    if (barTapped('back') || barTapped('primary') || wasPressed('back') || mouse.rclick) {
      if (this.picks) this.closePicker(); else this.exit();
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

  /** Phone layout, the list of your decks: tap one for its spells and what to do with it, NEW in the bar. */
  private updateTallList(): void {
    if (this.onActs) {
      // the deck's sheet is open: its buttons, or any other tap closes it
      const tapped = ACTS.find(a => isHot(`t:${a.toLowerCase()}`));
      if (mouse.click && tapped) {
        const id = this.listed?.id;
        this.act(tapped);
        // gone, copied or opened: the sheet closes
        if (tapped !== 'RENAME' && (tapped !== 'DELETE' || !this.decks.some(d => d.id === id))) this.onActs = false;
        return;
      }
      if (mouse.click || wasPressed('back') || mouse.rclick) { this.onActs = false; this.armed = null; sfx('back'); }
      return;
    }
    if (barTapped('back') || wasPressed('back') || mouse.rclick) { sfx('back'); this.back(); return; }
    if (barTapped('primary')) { this.newDeck(); return; }
    const sw = swipeIn(...this.lrect);
    if (sw) { this.switchClass(CLASSES[(CLASSES.indexOf(this.cls) + sw + CLASSES.length) % CLASSES.length]); return; }
    this.lscroller.update(...this.lrect);
    const h = hot('dl');
    if (h >= 0 && mouse.click) { this.listSel = h; this.onActs = true; this.armed = null; sfx('open'); }
  }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    this.drawScreen(c, tick, ui);
    this.naming?.entry.draw(ui);
  }

  private drawScreen(c: Ctx, tick: number, ui: Ctx): void {
    drawStage(c, getArena(), tick);
    c.fillStyle = 'rgba(40,20,0,0.5)';
    c.fillRect(...screenRect());
    if (spread.tall) { this.drawTall(ui); return; }

    // header: class tabs, counts, done (phone portrait moves it up, and the list rows grow, into the spare height)
    const hy = vy(4) - 4;
    win(ui, 8, 4 + hy, UW - 16, 40, { accent: teamColor(this.cls, loadMatch().p1Skin[this.cls], false), burn: 3 });
    CLASSES.forEach((cl, i) => button(ui, `tab:${i}`, cl.toUpperCase(), 14 + i * 54, 12 + hy, 52, 14, cl === this.cls, cl === this.cls ? RED_INK : INK2));
    // the deck being edited; in the list, the one under the cursor
    const head = this.listing ? this.listed?.cards ?? {} : this.deck;
    const title = this.listing ? this.listed?.name ?? 'NEW SPELL DECK' : this.picks ? 'NEW SPELL DECK' : this.editingName;
    drawText(ui, fitText(title, UW - 116 - 300), 300, 11 + hy, INK);
    const n = deckSize(head), leg = countRarity(head, 'legendary'), myth = countRarity(head, 'mythic');
    drawText(ui, `SPELLS ${n}/${DECK_SIZE}`, 14, 31 + hy, n === DECK_SIZE ? '#007800' : RED_INK);
    drawText(ui, `LEGENDARY ${leg}/${MAX_LEGENDARIES}`, 104, 31 + hy, leg <= MAX_LEGENDARIES ? ink(RARITY_COLOR.legendary) : RED_INK);
    drawText(ui, `MYTHIC ${myth}/1`, 212, 31 + hy, myth === 1 ? ink(RARITY_COLOR.mythic) : RED_INK);
    const ok = validate(head).length === 0;
    drawText(ui, ok ? 'READY' : 'NOT READY', 300, 23 + hy, ok ? '#007800' : RED_INK);
    button(ui, 'share', 'SHARE', UW - 112, 13 + hy, 46, 24, false, INK2);
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
          drawText(ui, '← ALL YOUR SPELL DECKS', LX + 64, ty, on ? INK : INK2);
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
      drawText(ui, 'BACK TO THE LIST OF YOUR', DX + 8, ly + 8, INK2);
      drawText(ui, 'SPELL DECKS, TO RENAME, CLONE,', DX + 8, ly + 20, INK2);
      drawText(ui, 'DELETE OR START ANOTHER ONE', DX + 8, ly + 32, INK2);
    }

    // footer
    const errs = validate(this.deck);
    const fy = ly + VISIBLE * rh + 10;
    if (this.msgT > 0) drawTextCentered(ui, this.msg, UW / 2, fy, '#f8b800');
    else if (this.listing || this.picks) { /* nothing being edited */ }
    else if (errs.length) drawTextCentered(ui, errs[0], UW / 2, fy, '#f83800');
    else drawTextCentered(ui, `${this.editingName} IS READY. SAVED.`, UW / 2, fy, '#58d854');
    if (this.listing) { this.drawList(ui); return; }
    if (this.picks) { this.drawPicker(ui); return; }
    hint(ui, this.tiles ? 'TAP: ADD   -: REMOVE   HOLD: READ   DRAG: SCROLL' : `HOVER TO READ   CLICK: ADD   RIGHT-CLICK: REMOVE   WHEEL: SCROLL`);
  }

  /** Touch: the start-from button over a scrolling grid of card tiles, inside the list window (top `ly`, height `h`). */
  private drawTiles(ui: Ctx, ly: number, h: number): void {
    const bh = Math.round(18 * spread.k), on = this.sel === 0 && showSel();
    button(ui, 'change', '← ALL YOUR SPELL DECKS', LX + 6, ly, LW - 12, bh, on, INK2);
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
    drawText(ui, 'START A NEW SPELL DECK FROM', x + 10, y + 8, INK);
    picks.forEach((id, i) => {
      const ry = y + 24 + i * rh, on = i === this.pickSel && showSel();
      zone(`pick:${i}`, x + 4, ry - 2, colW, rh);
      if (on) selRow(ui, x + 4, ry - 2, colW, rh);
      const p = this.presets.find(q => q.id === id);
      const name = id === 'empty' ? 'EMPTY SPELL DECK' : id === 'import' ? 'IMPORT A CODE...' : p!.name.toUpperCase() + (id === 'starter' ? ' (STARTER)' : '');
      const sub = id === 'empty' ? 'BUILD FROM SCRATCH' : id === 'import' ? 'PASTE A FRIEND\'S CODE'
          : `MYTHIC: ${(this.cards.find(c => c.id === p!.mythic)?.name ?? '').toUpperCase()}`;
      drawText(ui, name, x + 22, ry + 2 + ro, on ? INK : INK2);
      drawText(ui, sub, x + 22, ry + 11 + ro, p ? ink(RARITY_COLOR.mythic) : TRIM);
    });
    // the hovered choice's list
    const lx = x + colW + 16, id = showSel() ? picks[this.pickSel] : undefined;
    P(ui, BURN, lx - 8, y + 22, 1, hgt - 30);
    const list = this.presets.find(q => q.id === id)?.cards ?? {};
    const cards = this.cards.filter(c => list[c.id]);
    if (!id) drawText(ui, 'TOUCH A SPELL DECK TO SEE IT', lx, y + 24, INK2);
    else if (id === 'import') ['PASTE A FRIEND\'S SPELL DECK', 'CODE. ONE THAT BREAKS A DECK', 'RULE IS REFUSED. SHARE', 'MAKES A CODE FOR YOUR OWN.'].forEach((l, i) => drawText(ui, l, lx, y + 24 + i * 11, INK2));
    else if (!cards.length) drawText(ui, 'NO SPELLS YET', lx, y + 24, INK2);
    cards.forEach((c, i) => drawText(ui, `${list[c.id]}X ${c.name.toUpperCase()}`, lx, y + 24 + i * 11, c.rarity === 'common' ? INK2 : ink(RARITY_COLOR[c.rarity])));
    if (id) drawText(ui, `SAVED AS A NEW DECK (${this.decks.length + 1}/${MAX_CUSTOM_DECKS})`, lx, y + hgt - 14, TRIM);
    hint(ui, touchActive() ? 'TAP: SEE A SPELL DECK   TAP IT AGAIN: START FROM IT' : `HOVER TO SEE A SPELL DECK   CLICK: START FROM IT   RIGHT-CLICK: BACK`);
  }

  /** The list of your decks: names on the left; the one under the cursor's actions and spells on the right. */
  private drawList(ui: Ctx): void {
    const decks = this.decks, d = showSel() ? this.listed : null;
    ui.fillStyle = 'rgba(40,20,0,0.55)';
    const ly = vy(LY), lh = VISIBLE * Math.round(RH * spread.k);
    ui.fillRect(0, ly - 6, UW, lh + 30);
    // touch gets taller rows, as many as fit
    const x = 24, y = ly - 2, w = UW - 48, hgt = lh + 2, colW = 176;
    const rh = touchActive() ? Math.min(Math.round(24 * spread.k), Math.floor((hgt - 28) / (decks.length + 1))) : Math.round(16 * spread.k), ro = Math.round((rh - 16) / 2);
    win(ui, x, y, w, hgt, { accent: teamColor(this.cls, loadMatch().p1Skin[this.cls], false) });
    drawText(ui, `${CLASS_INFO[this.cls].name} SPELL DECKS ${decks.length}/${MAX_CUSTOM_DECKS}`, x + 10, y + 8, INK);
    const m = loadMatch(), fighting = customIdOf(m.p1 === this.cls ? m.p1Deck : '');
    for (let i = 0; i <= decks.length; i++) {
      const ry = y + 24 + i * rh, on = i === this.listSel && showSel(), ty = ry + 3 + ro;
      zone(`dl:${i}`, x + 4, ry - 2, colW, rh);
      if (on) selRow(ui, x + 4, ry - 2, colW, rh);
      const dk = decks[i];
      if (!dk) { drawText(ui, '+ NEW SPELL DECK', x + 22, ty, decks.length >= MAX_CUSTOM_DECKS ? TRIM : on ? RED_INK : INK2); continue; }
      const ready = !validate(dk.cards).length, status = ready ? 'READY' : `${deckSize(dk.cards)}/${DECK_SIZE}`;
      // the deck picked for your next fight wears a mark
      if (dk.id === fighting) drawText(ui, '●', x + 12, ty, RED_INK);
      drawText(ui, dk.name, x + 22, ty, on ? INK : INK2);
      drawText(ui, status, x + colW - 4 - textWidth(status, 1), ty, ready ? '#007800' : RED_INK);
    }
    const lx = x + colW + 16, rw = x + w - 10 - lx;
    P(ui, BURN, lx - 8, y + 22, 1, hgt - 30);
    if (!d) {
      const lines = !showSel() ? ['TOUCH A SPELL DECK TO SEE IT']
        : decks.length >= MAX_CUSTOM_DECKS ? [`YOU HAVE ${MAX_CUSTOM_DECKS} SPELL DECKS, THE MOST`, 'THERE IS ROOM FOR. DELETE ONE', 'TO START ANOTHER.']
          : ['START A NEW SPELL DECK FROM A', 'READY-MADE ONE, AN EMPTY ONE OR', 'A FRIEND\'S CODE.'];
      lines.forEach((l, i) => drawText(ui, l, lx, y + 24 + i * 11, INK2));
    } else {
      // what to do with it
      const gap = 4, bw = Math.floor((rw - gap * (ACTS.length - 1)) / ACTS.length), bh = touchActive() ? 24 : 16, ly2 = y + 14 + bh;
      ACTS.forEach((a, i) => {
        const armed = a === 'DELETE' && this.armed === d.id;
        button(ui, `act:${i}`, armed ? 'SURE?' : a, lx + i * (bw + gap), y + 6, bw, bh, this.onActs && this.actSel === i && showSel(), a === 'EDIT' || armed ? RED_INK : INK2);
      });
      const cards = this.cards.filter(c => d.cards[c.id]), fit = Math.floor((hgt - ly2 + y - 4) / 11), cols = cards.length > fit ? 2 : 1;
      const cw = Math.floor(rw / cols), max = Math.floor((cw - 4) / 6), per = Math.ceil(cards.length / cols);
      if (!cards.length) drawText(ui, 'NO SPELLS YET', lx, ly2, INK2);
      cards.forEach((c, i) => drawText(ui, `${d.cards[c.id]}X ${c.name.toUpperCase()}`.slice(0, max), lx + Math.floor(i / per) * cw, ly2 + (i % per) * 11,
        c.rarity === 'common' ? INK2 : ink(RARITY_COLOR[c.rarity])));
    }
    const ud = `${k('up')}/${k('down')}`;
    hint(ui, touchActive() ? 'TAP A SPELL DECK, THEN WHAT TO DO WITH IT'
      : this.onActs ? `${k('left')}/${k('right')}: CHOOSE   ${k('attack')}: DO IT   ${k('cast')}: BACK TO THE LIST`
        : `${ud}: CHOOSE   ${k('attack')}: OPEN   LB/RB: CLASS   ${k('cast')} / RIGHT-CLICK: BACK`);
  }

  // ---------- full-height phone layout ----------

  /** The phone layout: class tabs, the counts, a scrolling grid of cards and the action bar. */
  private drawTall(ui: Ctx): void {
    const a = tallArea(), x0 = a.x + PAD, w = a.w - PAD * 2;
    let y = a.y + 10;
    tabs(ui, 'tab', CLASSES.map(c => c.toUpperCase()), CLASSES.indexOf(this.cls), x0, y, w, 48);
    y += 58;
    if (this.listing) { this.drawTallList(ui, x0, y, w); return; }
    // the deck's name and counts
    const n = deckSize(this.deck), leg = countRarity(this.deck, 'legendary'), myth = countRarity(this.deck, 'mythic');
    const ok = validate(this.deck).length === 0;
    win(ui, x0, y, w, 46, { accent: teamColor(this.cls, loadMatch().p1Skin[this.cls], false), burn: 3 });
    drawText(ui, this.picks ? 'NEW SPELL DECK' : this.editingName, x0 + 12, y + 10, INK, 2);
    drawText(ui, ok ? 'READY' : 'NOT READY', x0 + w - 12 - (ok ? 60 : 108), y + 10, ok ? '#007800' : RED_INK, 2);
    drawText(ui, `SPELLS ${n}/${DECK_SIZE}`, x0 + 12, y + 30, n === DECK_SIZE ? '#007800' : RED_INK);
    drawText(ui, `LEGENDARY ${leg}/${MAX_LEGENDARIES}`, x0 + 120, y + 30, leg <= MAX_LEGENDARIES ? ink(RARITY_COLOR.legendary) : RED_INK);
    drawText(ui, `MYTHIC ${myth}/1`, x0 + 246, y + 30, myth === 1 ? ink(RARITY_COLOR.mythic) : RED_INK);
    y += 56;

    const barTop = a.y + a.h - 84, msgY = barTop - 22;
    if (this.picks) actionBar(ui, {});
    else actionBar(ui, { mid: { id: 'share', label: 'SHARE' }, primary: { id: 'done', label: 'DONE' } });
    const errs = validate(this.deck);
    const note = this.msgT > 0 ? [this.msg, '#f8b800'] : errs.length ? [errs[0], '#f83800'] : ['SPELL DECK READY. SAVED HERE.', '#58d854'];
    drawTextCentered(ui, note[0], UW / 2, msgY, note[1], note[0].length * 12 < w ? 2 : 1);

    if (this.picks) { this.drawTallPicker(ui, x0, y, w, msgY - 10 - y); return; }
    bigButton(ui, 'change', '← ALL SPELL DECKS', x0, y, w, 48);
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

  /** The phone layout's list of your decks: a scrolling column, NEW in the bar, and a sheet for the tapped deck. */
  private drawTallList(ui: Ctx, x0: number, y: number, w: number): void {
    const decks = this.decks, full = decks.length >= MAX_CUSTOM_DECKS;
    const barTop = actionBar(ui, { primary: { id: 'new', label: '+ NEW DECK', disabled: full } }), msgY = barTop - 22;
    const note = this.msgT > 0 ? [this.msg, '#f8b800'] : [`${CLASS_INFO[this.cls].name} SPELL DECKS ${decks.length}/${MAX_CUSTOM_DECKS}`, '#fcfcfc'];
    drawTextCentered(ui, note[0], UW / 2, msgY, note[1], note[0].length * 12 < w ? 2 : 1);
    const h = msgY - 16 - y, fighting = customIdOf(loadMatch().p1 === this.cls ? loadMatch().p1Deck : '');
    this.lrect = [x0 - PAD, y, w + PAD * 2, h];
    rowList(ui, this.lscroller, 'dl', decks.length, this.onActs ? this.listSel : -1, x0, y, w, h, TAP + 14, (i, rx, ry, rw) => {
      const d = decks[i], ready = !validate(d.cards).length, mythic = this.cards.find(c => d.cards[c.id] && c.rarity === 'mythic');
      drawText(ui, d.name, rx + 14, ry + 14, INK, 2);
      drawText(ui, ready ? 'READY' : `NOT READY, ${deckSize(d.cards)}/${DECK_SIZE} SPELLS`, rx + 14, ry + 38, ready ? '#007800' : RED_INK, 1);
      if (d.id === fighting) drawText(ui, 'PICKED', rx + rw - 14 - textWidth('PICKED', 1), ry + 38, INK2, 1);
      if (mythic) drawText(ui, mythic.name.toUpperCase(), rx + rw - 14 - textWidth(mythic.name.toUpperCase(), 1), ry + 14, ink(RARITY_COLOR.mythic), 1);
    });
    if (!decks.length) drawTextCentered(ui, 'NO SPELL DECKS YET', UW / 2, y + 30, INK2, 2, false);
    const d = this.onActs ? this.listed : null;
    if (!d) return;
    const cards = this.cards.filter(c => d.cards[c.id]), half = Math.ceil(cards.length / 2);
    sheet(ui, 150 + Math.max(1, half) * 16 + 70 + TAP, (sx, sy, sw, sh) => {
      drawText(ui, d.name, sx, sy, INK, 2);
      drawText(ui, `${deckSize(d.cards)} SPELLS`, sx + sw - textWidth(`${deckSize(d.cards)} SPELLS`, 1), sy + 4, TRIM, 1);
      if (!cards.length) drawText(ui, 'NO SPELLS YET', sx, sy + 34, INK2, 1);
      const cw = Math.floor(sw / 2), max = Math.floor((cw - 8) / 6);
      cards.forEach((c, i) => drawText(ui, `${d.cards[c.id]}X ${c.name.toUpperCase()}`.slice(0, max), sx + (i < half ? 0 : cw), sy + 32 + (i % half) * 16,
        c.rarity === 'common' ? INK2 : ink(RARITY_COLOR[c.rarity]), 1));
      const by = sy + sh - TAP * 2 - GAP - 8, bw = Math.floor((sw - GAP * 2) / 3), armed = this.armed === d.id;
      bigButton(ui, 't:rename', 'RENAME', sx, by, bw, TAP);
      bigButton(ui, 't:clone', 'CLONE', sx + bw + GAP, by, bw, TAP, { disabled: full });
      bigButton(ui, 't:delete', armed ? 'SURE?' : 'DELETE', sx + (bw + GAP) * 2, by, bw, TAP, { sub: armed ? 'TAP AGAIN' : undefined });
      bigButton(ui, 't:share', 'SHARE', sx, by + TAP + GAP, bw, TAP);
      bigButton(ui, 't:edit', 'EDIT', sx + bw + GAP, by + TAP + GAP, sw - bw - GAP, TAP, { primary: true });
    });
  }

  /** The start-from picker in the phone layout: a column of big choices. */
  private drawTallPicker(ui: Ctx, x: number, y: number, w: number, h: number): void {
    const picks = this.picks!;
    panel(ui, x - 6, y, w + 12, h);
    drawTextCentered(ui, 'START A NEW SPELL DECK FROM', UW / 2, y + 14, INK, 2, false);
    const rh = Math.min(TAP + 16, Math.floor((h - 44) / picks.length) - 6);
    picks.forEach((id, i) => {
      const p = this.presets.find(q => q.id === id);
      const name = id === 'empty' ? 'EMPTY DECK' : id === 'import' ? 'IMPORT A CODE' : p!.name.toUpperCase() + (id === 'starter' ? ' (STARTER)' : '');
      const sub = id === 'empty' ? 'BUILD FROM SCRATCH' : id === 'import' ? 'PASTE A FRIEND\'S CODE'
          : `MYTHIC: ${(this.cards.find(c => c.id === p!.mythic)?.name ?? '').toUpperCase()}`;
      bigButton(ui, `pick:${i}`, name, x + 6, y + 40 + i * (rh + 6), w - 12, rh, { sub, scale: name.length * 12 < w - 30 ? 2 : 1, on: i === this.peek });
    });
    // the tapped deck's spells, and START to take it
    const id = this.peek >= 0 ? picks[this.peek] : undefined;
    if (!id) return;
    const p = this.presets.find(q => q.id === id);
    const list = p?.cards ?? {};
    const cards = this.cards.filter(c => list[c.id]), half = Math.ceil(cards.length / 2);
    sheet(ui, 150 + Math.max(1, half) * 16 + 70, (sx, sy, sw, sh) => {
      drawText(ui, p!.name.toUpperCase(), sx, sy, INK, 2);
      drawText(ui, `${deckSize(list)} SPELLS`, sx + sw - textWidth(`${deckSize(list)} SPELLS`, 1), sy + 4, TRIM, 1);
      const cw = Math.floor(sw / 2), max = Math.floor((cw - 8) / 6);
      cards.forEach((c, i) => drawText(ui, `${list[c.id]}X ${c.name.toUpperCase()}`.slice(0, max), sx + (i < half ? 0 : cw), sy + 32 + (i % half) * 16,
        c.rarity === 'common' ? INK2 : ink(RARITY_COLOR[c.rarity]), 1));
      bigButton(ui, 't:start', 'START FROM IT', sx, sy + sh - 66, sw, TAP, { primary: true });
    });
  }
}

const costNum = (c: CardDef): number => (c.cost === 'all' ? 6 : c.cost);
/** Cut text to fit `w` UI pixels at 1x, ending in '..' when cut. */
const fitText = (s: string, w: number): string => (textWidth(s, 1) <= w ? s : s.slice(0, Math.max(1, Math.floor(w / 6) - 2)) + '..');
