// Grimoire builder: 30 spells, 4/2/1 copy limits, max 5 Legendaries, exactly 1 Mythic. Autosaves to the browser.
import { hint, type Scene } from './scene';
import { getArena } from '../game/battleView';
import { teamColor, type ClassId } from '../art/sprites';
import { P, W, H, frame, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered, wrap } from '../engine/font';
import { wasPressed, navPressed, k } from '../engine/input';
import { sfx } from '../engine/audio';
import { cardsFor, ELEMENT_COLOR, MAX_COPIES, RARITY_COLOR, type CardDef } from '../game/cards';
import { canAdd, countRarity, deckSize, loadCustom, saveCustom, starterDeck, validate, DECK_SIZE, MAX_LEGENDARIES, type DeckCounts } from '../game/deck';
import { loadMatch, saveMatch } from '../game/match';

const VISIBLE = 11;
const RARITY_ORDER = { common: 0, uncommon: 1, legendary: 2, mythic: 3 };

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

  update(dt: number): void {
    this.msgT = Math.max(0, this.msgT - dt);
    if (navPressed('up', dt)) { this.sel = (this.sel + this.rows - 1) % this.rows; sfx('move'); }
    if (navPressed('down', dt)) { this.sel = (this.sel + 1) % this.rows; sfx('move'); }
    if (this.sel < this.scroll) this.scroll = this.sel;
    if (this.sel >= this.scroll + VISIBLE) this.scroll = this.sel - VISIBLE + 1;

    if (wasPressed('lb') || wasPressed('rb')) {
      this.cls = this.cls === 'warrior' ? 'mage' : 'warrior';
      this.load();
      sfx('move');
      return;
    }
    if (wasPressed('pause')) { this.exit(); return; }
    const card = this.cards[this.sel];
    if (card) {
      if (wasPressed('confirm') || navPressed('right', dt)) this.change(card, 1);
      else if (navPressed('left', dt)) this.change(card, -1);
      else if (wasPressed('cast')) { this.change(card, -1); return; }
    } else if (wasPressed('confirm')) {
      if (this.sel === this.cards.length) { this.deck = starterDeck(this.cls); this.flash('RESET TO STARTER'); }
      else { this.deck = {}; this.flash('CLEARED'); }
      saveCustom(this.cls, this.deck);
      sfx('select');
    }
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

  draw(c: Ctx, tick: number): void {
    getArena().draw(c, tick, 0);
    c.fillStyle = 'rgba(0,0,24,0.75)';
    c.fillRect(0, 0, W, H);

    // header
    frame(c, 4, 3, W - 8, 19, '#000000', teamColor(this.cls, loadMatch().p1Skin[this.cls], false));
    drawText(c, `Q ← ${this.cls.toUpperCase()} GRIMOIRE → E`, 8, 6, '#fcfcfc');
    const n = deckSize(this.deck), leg = countRarity(this.deck, 'legendary'), myth = countRarity(this.deck, 'mythic');
    drawText(c, `${n}/${DECK_SIZE}`, 8, 14, n === DECK_SIZE ? '#58d854' : '#f8b800');
    drawText(c, `LEG ${leg}/${MAX_LEGENDARIES}`, 52, 14, leg <= MAX_LEGENDARIES ? RARITY_COLOR.legendary : '#f83800');
    drawText(c, `MYTH ${myth}/1`, 114, 14, myth === 1 ? RARITY_COLOR.mythic : '#f83800');
    const ok = validate(this.deck).length === 0;
    drawText(c, ok ? 'READY' : 'NOT READY', W - 10 - (ok ? 5 : 9) * 6, 14, ok ? '#58d854' : '#f83800');

    // list
    const lx = 4, ly = 26, lw = 146;
    frame(c, lx, ly - 2, lw, VISIBLE * 9 + 3, '#000000', '#7c7c7c');
    for (let i = 0; i < VISIBLE; i++) {
      const idx = this.scroll + i;
      if (idx >= this.rows) break;
      const y = ly + i * 9;
      const on = idx === this.sel;
      if (on) P(c, '#0000a8', lx + 1, y - 1, lw - 2, 9);
      const card = this.cards[idx];
      if (!card) {
        drawText(c, idx === this.cards.length ? 'RESET TO STARTER' : 'CLEAR ALL', lx + 20, y, on ? '#fcfcfc' : '#bcbcbc');
        continue;
      }
      const have = this.deck[card.id] ?? 0;
      drawText(c, `${have}/${MAX_COPIES[card.rarity]}`, lx + 3, y, have ? '#fcfcfc' : '#7c7c7c');
      P(c, ELEMENT_COLOR[card.element], lx + 24, y + 1, 2, 5);
      drawText(c, card.name.toUpperCase().slice(0, 16), lx + 29, y, RARITY_COLOR[card.rarity]);
      drawText(c, card.cost === 'all' ? 'A' : String(card.cost), lx + lw - 9, y, '#fcfcfc');
    }
    // scrollbar
    const total = this.rows;
    const bh = Math.max(6, Math.round((VISIBLE / total) * (VISIBLE * 9)));
    const by = ly + Math.round((this.scroll / Math.max(1, total - VISIBLE)) * (VISIBLE * 9 - bh));
    P(c, '#3c3c3c', lx + lw, ly - 1, 2, VISIBLE * 9);
    P(c, '#bcbcbc', lx + lw, by - 1, 2, bh);

    // detail
    const card = this.cards[this.sel];
    const dx = 156, dw = W - dx - 4;
    frame(c, dx, ly - 2, dw, VISIBLE * 9 + 3, '#000000', card ? ELEMENT_COLOR[card.element] : '#7c7c7c');
    if (card) drawCardDetail(c, card, dx + 3, ly + 1, Math.floor((dw - 6) / 6));

    // footer
    const errs = validate(this.deck);
    if (this.msgT > 0) drawTextCentered(c, this.msg, W / 2, 128, '#f8b800');
    else if (errs.length) drawTextCentered(c, errs[0], W / 2, 128, '#f83800');
    else drawTextCentered(c, 'GRIMOIRE READY. SAVED.', W / 2, 128, '#58d854');
    drawTextCentered(c, 'DECKS SAVE IN THIS BROWSER', W / 2, 138, '#7c7c7c', 1, false);
    hint(c, `${k('right')}/${k('attack')}: ADD  ${k('left')}/${k('cast')}: REMOVE  ENTER: DONE`);
  }
}

const costNum = (c: CardDef): number => (c.cost === 'all' ? 6 : c.cost);

/** Name, rarity, cost, damage and rules text in a narrow column. Shared with the custom screen. */
export function drawCardDetail(c: Ctx, card: CardDef, x: number, y: number, chars: number, maxLines = 99): number {
  let yy = y;
  for (const line of wrap(card.name.toUpperCase(), chars)) { drawText(c, line, x, yy, '#fcfcfc'); yy += 8; }
  drawText(c, card.rarity.toUpperCase(), x, yy, RARITY_COLOR[card.rarity]); yy += 9;
  const res = card.cls === 'warrior' ? 'RAGE' : 'MANA';
  drawText(c, `${card.cost === 'all' ? 'ALL' : card.cost} ${res}`, x, yy, card.cls === 'warrior' ? '#f87858' : '#a4e4fc'); yy += 8;
  if (card.dmg !== '-') { drawText(c, `DMG ${card.dmg.toUpperCase()}`, x, yy, '#f8b800'); yy += 8; }
  yy += 2;
  const lines = wrap(card.short.toUpperCase(), chars).slice(0, maxLines);
  for (const line of lines) { drawText(c, line, x, yy, '#bcbcbc'); yy += 8; }
  return yy;
}
