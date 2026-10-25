// Grimoire builder: 30 spells, 4/2/1 copy limits, max 5 Legendaries, exactly 1 Mythic. Autosaves to the browser.
import { hint, zone, hot, isHot, button, type Scene } from './scene';
import { getArena } from '../game/battleView';
import { teamColor, type ClassId } from '../art/sprites';
import { P, W, H, UW, frame, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered, wrap } from '../engine/font';
import { wasPressed, navPressed, mouse } from '../engine/input';
import { sfx } from '../engine/audio';
import { cardsFor, ELEMENT_COLOR, MAX_COPIES, RARITY_COLOR, type CardDef } from '../game/cards';
import { canAdd, countRarity, deckSize, loadCustom, saveCustom, starterDeck, validate, DECK_SIZE, MAX_LEGENDARIES, type DeckCounts } from '../game/deck';
import { loadMatch, saveMatch } from '../game/match';
import { CLASS_IDS } from '../game/classes';
import { drawCardFace, resColor, resName, CARD_W, CARD_H } from './cardView';

const RARITY_ORDER = { common: 0, uncommon: 1, legendary: 2, mythic: 3 };
const CLASSES: ClassId[] = CLASS_IDS;

// layout (UI pixels)
const VISIBLE = 16, RH = 14;
const LX = 8, LY = 52, LW = 268;
const DX = 286, DW = UW - DX - 8;

export class DeckBuilderScene implements Scene {
  deck: DeckCounts = {};
  cards: CardDef[] = [];
  sel = 0;
  scroll = 0;
  msg = '';
  msgT = 0;

  constructor(public cls: ClassId, private back: () => void) {
    this.load();
  }

  private load(): void {
    this.cards = cardsFor(this.cls).sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity] || costNum(a) - costNum(b));
    this.deck = loadCustom(this.cls) ?? starterDeck(this.cls);
    this.sel = 0; this.scroll = 0;
  }

  private get rows(): number { return this.cards.length + 2; }

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
    if (idx === this.cards.length) { this.deck = starterDeck(this.cls); this.flash('RESET TO STARTER'); }
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

    // mouse: hover reads a card, click adds, right-click removes, wheel scrolls
    if (mouse.wheel && hot('row') >= 0) this.scroll = Math.max(0, Math.min(this.rows - VISIBLE, this.scroll + mouse.wheel * 2));
    const tab = hot('tab');
    if (tab >= 0 && mouse.click) { this.switchClass(CLASSES[tab]); return; }
    if (isHot('done') && mouse.click) { this.exit(); return; }
    const minus = hot('minus'), plus = hot('plus'), row = hot('row');
    if (minus >= 0 && mouse.click) { this.sel = minus; this.change(this.cards[minus], -1); return; }
    if (plus >= 0 && mouse.click) { this.sel = plus; this.change(this.cards[plus], 1); return; }
    const over = Math.max(row, minus, plus);
    if (over >= 0 && mouse.moved) this.sel = over;
    if (row >= 0 && (mouse.click || mouse.rclick)) {
      this.sel = row;
      const card = this.cards[row];
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
    const card = this.cards[this.sel];
    if (card) {
      if (wasPressed('confirm') || navPressed('right', dt)) this.change(card, 1);
      else if (navPressed('left', dt)) this.change(card, -1);
      else if (wasPressed('cast')) { this.change(card, -1); return; }
    } else if (wasPressed('confirm')) this.special(this.sel);
    if (wasPressed('back') && !card) this.exit();
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
    getArena().draw(c, tick, 0);
    c.fillStyle = 'rgba(0,0,24,0.75)';
    c.fillRect(0, 0, W, H);

    // header: class tabs, counts, done
    frame(ui, 8, 6, UW - 16, 38, '#000000', teamColor(this.cls, loadMatch().p1Skin[this.cls], false));
    CLASSES.forEach((cl, i) => button(ui, `tab:${i}`, cl.toUpperCase(), 14 + i * 54, 11, 52, 14, cl === this.cls, cl === this.cls ? '#f8b800' : '#bcbcbc'));
    drawText(ui, 'GRIMOIRE', 300, 11, '#fcfcfc');
    const n = deckSize(this.deck), leg = countRarity(this.deck, 'legendary'), myth = countRarity(this.deck, 'mythic');
    drawText(ui, `SPELLS ${n}/${DECK_SIZE}`, 14, 31, n === DECK_SIZE ? '#58d854' : '#f8b800');
    drawText(ui, `LEGENDARY ${leg}/${MAX_LEGENDARIES}`, 104, 31, leg <= MAX_LEGENDARIES ? RARITY_COLOR.legendary : '#f83800');
    drawText(ui, `MYTHIC ${myth}/1`, 212, 31, myth === 1 ? RARITY_COLOR.mythic : '#f83800');
    const ok = validate(this.deck).length === 0;
    drawText(ui, ok ? 'READY' : 'NOT READY', 300, 23, ok ? '#58d854' : '#f83800');
    button(ui, 'done', 'DONE', UW - 86, 13, 70, 24, false, '#f8b800');

    // list
    frame(ui, LX, LY - 4, LW, VISIBLE * RH + 6, '#000000', '#7c7c7c');
    for (let i = 0; i < VISIBLE; i++) {
      const idx = this.scroll + i;
      if (idx >= this.rows) break;
      const y = LY + i * RH, ty = y + 3;
      const on = idx === this.sel;
      zone(`row:${idx}`, LX + 1, y - 1, LW - 2, RH);
      if (on) P(ui, '#0000a8', LX + 1, y - 1, LW - 2, RH);
      const card = this.cards[idx];
      if (!card) {
        drawText(ui, idx === this.cards.length ? 'RESET TO STARTER' : 'CLEAR ALL', LX + 64, ty, on ? '#fcfcfc' : '#bcbcbc');
        continue;
      }
      const have = this.deck[card.id] ?? 0, max = MAX_COPIES[card.rarity];
      zone(`minus:${idx}`, LX + 2, y - 1, 14, RH);
      zone(`plus:${idx}`, LX + 42, y - 1, 14, RH);
      if (on) {
        drawText(ui, '-', LX + 6, ty, hot('minus') === idx ? '#f8b800' : have ? '#fcfcfc' : '#3c3c3c');
        drawText(ui, '+', LX + 46, ty, hot('plus') === idx ? '#f8b800' : have < max ? '#fcfcfc' : '#3c3c3c');
      }
      drawText(ui, `${have}/${max}`, LX + 18, ty, have ? '#fcfcfc' : '#7c7c7c');
      P(ui, ELEMENT_COLOR[card.element], LX + 58, y + 2, 3, 8);
      drawText(ui, card.name.toUpperCase(), LX + 66, ty, RARITY_COLOR[card.rarity]);
      drawText(ui, card.cost === 'all' ? 'A' : String(card.cost), LX + LW - 14, ty, resColor(card));
    }
    // scrollbar
    const total = this.rows, trackH = VISIBLE * RH;
    const bh = Math.max(10, Math.round((VISIBLE / total) * trackH));
    const by = LY + Math.round((this.scroll / Math.max(1, total - VISIBLE)) * (trackH - bh));
    P(ui, '#3c3c3c', LX + LW + 1, LY - 2, 3, trackH);
    P(ui, '#bcbcbc', LX + LW + 1, by - 2, 3, bh);

    // detail: the card itself, its numbers, then its rules
    const card = this.cards[this.sel];
    const dh = VISIBLE * RH + 6;
    frame(ui, DX, LY - 4, DW, dh, '#000000', card ? ELEMENT_COLOR[card.element] : '#7c7c7c');
    if (card) {
      const have = this.deck[card.id] ?? 0;
      drawCardFace(ui, card, DX + 8, LY + 4, { lit: true });
      const cx = DX + CARD_W + 18;
      let y = LY + 8;
      const line = (s: string, col: string): void => { drawText(ui, s, cx, y, col); y += 12; };
      line(card.rarity.toUpperCase(), RARITY_COLOR[card.rarity]);
      line(card.element.toUpperCase(), ELEMENT_COLOR[card.element]);
      line(`${card.cost === 'all' ? 'ALL' : card.cost} ${resName(card)}`, resColor(card));
      if (card.dmg !== '-') line(`DMG ${card.dmg.toUpperCase()}`, '#f8b800');
      y += 6;
      line('IN DECK', '#7c7c7c');
      line(`${have} / ${MAX_COPIES[card.rarity]}`, have ? '#fcfcfc' : '#7c7c7c');
      let ry = LY + CARD_H + 16;
      drawText(ui, card.name.toUpperCase(), DX + 8, ry, '#fcfcfc'); ry += 14;
      for (const l of wrap(card.short.toUpperCase(), Math.floor((DW - 16) / 6))) { drawText(ui, l, DX + 8, ry, '#bcbcbc'); ry += 11; }
    } else {
      drawText(ui, this.sel === this.cards.length ? 'PUT THE STARTER DECK BACK' : 'REMOVE EVERY SPELL', DX + 8, LY + 8, '#bcbcbc');
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
