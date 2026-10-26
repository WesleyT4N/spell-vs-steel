// Grimoire builder: 30 spells, 4/2/1 copy limits, max 5 Legendaries, exactly 1 Mythic. Autosaves to the browser.
import { hint, zone, hot, isHot, button, showSel, type Scene } from './scene';
import { getArena } from '../game/battleView';
import { drawStage } from '../art/arena';
import { teamColor, type ClassId } from '../art/sprites';
import { P, UW, screenRect, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered } from '../engine/font';
import { wasPressed, navPressed, mouse } from '../engine/input';
import { sfx } from '../engine/audio';
import { cardsFor, ELEMENT_COLOR, MAX_COPIES, RARITY_COLOR, type CardDef } from '../game/cards';
import { canAdd, countRarity, deckSize, loadCustom, saveCustom, presetDeck, presetsFor, validate, DECK_SIZE, MAX_LEGENDARIES, type DeckCounts, type DeckPreset } from '../game/deck';
import { loadMatch, saveMatch } from '../game/match';
import { PLAYABLE } from '../game/classes';
import { drawCardDetail, resInk } from './cardView';
import { CardPreview } from './cardPreview';
import { win, selRow, ink, PAPER, BURN, INK, INK2, RED_INK, GOLD, TRIM } from './skin';

const RARITY_ORDER = { common: 0, uncommon: 1, legendary: 2, mythic: 3 };
const CLASSES: ClassId[] = PLAYABLE;

// layout (UI pixels)
const VISIBLE = 16, RH = 14;
const LX = 8, LY = 52, LW = 268;
const DX = 286, DW = UW - DX - 8;
/** Height of the card's clip at the top of the detail window. */
const PREVIEW_H = 80;

export class DeckBuilderScene implements Scene {
  deck: DeckCounts = {};
  cards: CardDef[] = [];
  sel = 0;
  scroll = 0;
  msg = '';
  msgT = 0;

  private preview = new CardPreview();

  constructor(public cls: ClassId, private back: () => void) {
    this.load();
  }

  private load(): void {
    this.cards = cardsFor(this.cls).sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity] || costNum(a) - costNum(b));
    // no saved deck yet: start from the ready-made deck picked on the character select
    const m = loadMatch();
    const picked = m.p1 === this.cls ? m.p1Deck : m.cpu === this.cls ? m.cpuDeck : 'starter';
    this.deck = loadCustom(this.cls) ?? presetDeck(this.cls, picked);
    // the START FROM rows sit above the cards, in view; the cursor starts on the first card
    this.sel = this.top; this.scroll = 0;
  }

  /** Rows above the cards: start from each ready-made deck, then CLEAR ALL. */
  private get presets(): DeckPreset[] { return presetsFor(this.cls); }
  private get top(): number { return this.presets.length + 1; }
  private get rows(): number { return this.top + this.cards.length; }
  private cardAt(idx: number): CardDef | undefined { return idx >= this.top ? this.cards[idx - this.top] : undefined; }
  private specialLabel(idx: number): string {
    const p = this.presets[idx];
    return p ? `START FROM ${p.name.toUpperCase()}${p.id === 'starter' ? ' (STARTER)' : ''}` : 'CLEAR ALL';
  }

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

  private special(idx: number): void {
    const p = this.presets[idx];
    if (p) { this.deck = { ...p.cards }; this.flash(`LOADED ${p.name.toUpperCase()}`); }
    else { this.deck = {}; this.flash('CLEARED'); }
    saveCustom(this.cls, this.deck);
    sfx('select');
  }

  private follow(): void {
    if (this.sel < this.scroll) this.scroll = this.sel;
    if (this.sel >= this.scroll + VISIBLE) this.scroll = this.sel - VISIBLE + 1;
  }

  update(dt: number): void {
    this.msgT = Math.max(0, this.msgT - dt);
    this.preview.show(showSel() ? this.cardAt(this.sel) ?? null : null);
    this.preview.update(dt);

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
      else if (mouse.click) this.special(row);
      return;
    }

    if (navPressed('up', dt)) { this.sel = (this.sel + this.rows - 1) % this.rows; sfx('move'); this.follow(); }
    if (navPressed('down', dt)) { this.sel = (this.sel + 1) % this.rows; sfx('move'); this.follow(); }
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
    } else if (wasPressed('confirm')) this.special(this.sel);
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

  draw(c: Ctx, tick: number, ui: Ctx): void {
    drawStage(c, getArena(), tick);
    c.fillStyle = 'rgba(40,20,0,0.5)';
    c.fillRect(...screenRect());

    // header: class tabs, counts, done
    win(ui, 8, 4, UW - 16, 40, { accent: teamColor(this.cls, loadMatch().p1Skin[this.cls], false), burn: 3 });
    CLASSES.forEach((cl, i) => button(ui, `tab:${i}`, cl.toUpperCase(), 14 + i * 54, 12, 52, 14, cl === this.cls, cl === this.cls ? RED_INK : INK2));
    drawText(ui, 'GRIMOIRE', 300, 11, INK);
    const n = deckSize(this.deck), leg = countRarity(this.deck, 'legendary'), myth = countRarity(this.deck, 'mythic');
    drawText(ui, `SPELLS ${n}/${DECK_SIZE}`, 14, 31, n === DECK_SIZE ? '#007800' : RED_INK);
    drawText(ui, `LEGENDARY ${leg}/${MAX_LEGENDARIES}`, 104, 31, leg <= MAX_LEGENDARIES ? ink(RARITY_COLOR.legendary) : RED_INK);
    drawText(ui, `MYTHIC ${myth}/1`, 212, 31, myth === 1 ? ink(RARITY_COLOR.mythic) : RED_INK);
    const ok = validate(this.deck).length === 0;
    drawText(ui, ok ? 'READY' : 'NOT READY', 300, 23, ok ? '#007800' : RED_INK);
    button(ui, 'done', 'DONE', UW - 86, 13, 70, 24, false, RED_INK);

    // list
    win(ui, LX, LY - 4, LW, VISIBLE * RH + 6);
    for (let i = 0; i < VISIBLE; i++) {
      const idx = this.scroll + i;
      if (idx >= this.rows) break;
      const y = LY + i * RH, ty = y + 3;
      const on = idx === this.sel && showSel();
      zone(`row:${idx}`, LX + 1, y - 1, LW - 2, RH);
      if (on) selRow(ui, LX + 1, y - 1, LW - 2, RH);
      const card = this.cardAt(idx);
      if (!card) {
        drawText(ui, this.specialLabel(idx), LX + 64, ty, on ? INK : INK2);
        continue;
      }
      const have = this.deck[card.id] ?? 0, max = MAX_COPIES[card.rarity];
      zone(`minus:${idx}`, LX + 2, y - 1, 14, RH);
      zone(`plus:${idx}`, LX + 42, y - 1, 14, RH);
      if (on) {
        drawText(ui, '-', LX + 6, ty, hot('minus') === idx ? GOLD : have ? PAPER : BURN);
        drawText(ui, '+', LX + 46, ty, hot('plus') === idx ? RED_INK : have < max ? INK : BURN);
      }
      drawText(ui, `${have}/${max}`, LX + 18, ty, have ? INK : TRIM);
      P(ui, ELEMENT_COLOR[card.element], LX + 58, y + 2, 3, 8);
      drawText(ui, card.name.toUpperCase(), LX + 66, ty, card.rarity === 'common' ? INK : ink(RARITY_COLOR[card.rarity]));
      drawText(ui, card.cost === 'all' ? 'A' : String(card.cost), LX + LW - 14, ty, resInk(card));
    }
    // scrollbar
    const total = this.rows, trackH = VISIBLE * RH;
    const bh = Math.max(10, Math.round((VISIBLE / total) * trackH));
    const by = LY + Math.round((this.scroll / Math.max(1, total - VISIBLE)) * (trackH - bh));
    P(ui, BURN, LX + LW + 1, LY - 2, 3, trackH);
    P(ui, INK2, LX + LW + 1, by - 2, 3, bh);

    // detail: the card's clip, then its numbers and rules
    const card = showSel() ? this.cardAt(this.sel) : undefined;
    const dh = VISIBLE * RH + 6;
    win(ui, DX, LY - 4, DW, dh, { accent: card ? ELEMENT_COLOR[card.element] : undefined });
    if (card) {
      const have = this.deck[card.id] ?? 0;
      this.preview.draw(ui, DX + 8, LY + 6, DW - 16, PREVIEW_H);
      const y = drawCardDetail(ui, card, DX + 8, LY + PREVIEW_H + 14, DW - 16) + 6;
      drawText(ui, `IN DECK ${have} / ${MAX_COPIES[card.rarity]}`, DX + 8, y, have ? INK : TRIM);
    } else if (!showSel()) {
      drawText(ui, 'TOUCH A CARD TO READ IT', DX + 8, LY + 8, INK2);
    } else {
      const p = this.presets[this.sel];
      if (!p) drawText(ui, 'REMOVE EVERY SPELL', DX + 8, LY + 8, INK2);
      else {
        // a ready-made deck to start from: its Mythic and what it runs
        drawText(ui, 'REPLACE YOUR DECK WITH', DX + 8, LY + 8, INK2);
        drawText(ui, p.name.toUpperCase(), DX + 8, LY + 22, INK);
        const myth = this.cards.find(c => c.id === p.mythic);
        if (myth) drawText(ui, `MYTHIC: ${myth.name.toUpperCase()}`, DX + 8, LY + 36, ink(RARITY_COLOR.mythic));
        const list = this.cards.filter(c => p.cards[c.id]);
        list.forEach((c, i) => drawText(ui, `${p.cards[c.id]}X ${c.name.toUpperCase()}`, DX + 8, LY + 52 + i * 11, c.rarity === 'common' ? INK2 : ink(RARITY_COLOR[c.rarity])));
      }
    }

    // footer
    const errs = validate(this.deck);
    const fy = LY + VISIBLE * RH + 10;
    if (this.msgT > 0) drawTextCentered(ui, this.msg, UW / 2, fy, '#f8b800');
    else if (errs.length) drawTextCentered(ui, errs[0], UW / 2, fy, '#f83800');
    else drawTextCentered(ui, 'GRIMOIRE READY. SAVED IN THIS BROWSER.', UW / 2, fy, '#58d854');
    hint(ui, `HOVER TO READ   CLICK: ADD   RIGHT-CLICK: REMOVE   WHEEL: SCROLL`);
  }
}

const costNum = (c: CardDef): number => (c.cost === 'all' ? 6 : c.cost);
