// Card encyclopedia: every spell of every class as a browsable grid of card faces, with filters.
// Classes come from the card list itself, so new classes appear here as soon as their cards exist.
import { hint, zone, hot, isHot, button, type Scene } from './scene';
import { getArena } from '../game/battleView';
import { drawStage } from '../art/arena';
import type { ClassId } from '../art/sprites';
import { P, UW, frame, screenRect, vy, vspan, spread, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered, textWidth } from '../engine/font';
import { wasPressed, navPressed, mouse, k } from '../engine/input';
import type { PadMode } from '../engine/touch';
import { sfx } from '../engine/audio';
import { PLAYABLE } from '../game/classes';
import { ALL_CARDS, ELEMENT_COLOR, MAX_COPIES, RARITY_COLOR, type CardDef, type Element, type Rarity } from '../game/cards';
import { presetsFor } from '../game/deck';
import { drawCardDetail, drawCardFace, CARD_W, CARD_H } from './cardView';
import { win, INK, INK2, RED_INK, TRIM, BURN, PAPER } from './skin';
import { bigButton, actionBar, barTapped, tabs, panel, sheet, swipeIn, tallArea, Scroller, GAP, PAD } from './touchUi';
import { CardPreview } from './cardPreview';

const RARITIES: Rarity[] = ['common', 'uncommon', 'legendary', 'mythic'];
const RANK: Record<Rarity, number> = { common: 0, uncommon: 1, legendary: 2, mythic: 3 };

// layout (UI pixels)
const GX = 8, GY = 54, COLS = 3, PX = 80, PY = 112;
const CLIP_TOP = 50, CLIP_SIZE = 252;
// the grid window; phone portrait grows it into the spare height
const clipY = (): number => vy(CLIP_TOP), clipH = (): number => vspan(CLIP_TOP, CLIP_SIZE);
const DX = 252, DW = UW - DX - 8;
/** The looping clip of the selected card, at the top of the detail window. */
const CLIP_BOX = 84;

const costNum = (c: CardDef): number => (c.cost === 'all' ? 6 : c.cost);

export class EncyclopediaScene implements Scene {
  /** null = every class. */
  cls: ClassId | null = null;
  rarity: Rarity | null = null;
  element: Element | null = null;
  sel = 0;
  scroll = 0;
  private preview = new CardPreview();
  private classes: ClassId[] = [...new Set(ALL_CARDS.map(c => c.cls))].filter(c => PLAYABLE.includes(c));

  constructor(private back: () => void, private test?: (card: CardDef) => void) {}

  // phones in portrait: filters on top, a scrolling grid, and a tapped card's rules in a sheet
  tall(): boolean { return true; }
  pad(): PadMode { return spread.tall ? 'none' : 'back'; }
  private tscroll = new Scroller();
  private tgrid: [number, number, number, number] = [0, 0, 0, 0];
  /** The card open in the phone layout's sheet, or -1. */
  reading = -1;

  /** The phone layout's input; true when it took this frame. */
  private updateTall(cards: CardDef[]): boolean {
    if (this.reading >= 0) {
      // the sheet: TEST tries the card, any other tap (or BACK) closes it
      if (isHot('test') && mouse.click && cards[this.reading]) { this.runTest(cards[this.reading]); return true; }
      if (mouse.click || wasPressed('back') || mouse.rclick) { this.reading = -1; sfx('back'); }
      return true;
    }
    if (barTapped('back')) { sfx('back'); this.back(); return true; }
    const sw = swipeIn(...this.tgrid);
    if (sw) {
      const t = this.tabs, i = t.indexOf(this.cls);
      this.cls = t[(i + sw + t.length) % t.length];
      this.refilter(); this.tscroll.pos = 0; sfx('move');
      return true;
    }
    this.tscroll.update(...this.tgrid);
    const c = hot('tcard');
    if (c >= 0 && mouse.click) { this.sel = this.reading = c; sfx('open'); return true; }
    return false;
  }

  private get tabs(): Array<ClassId | null> { return [null, ...this.classes]; }

  private list(): CardDef[] {
    const order = this.classes;
    return ALL_CARDS
      .filter(c => order.includes(c.cls) && (!this.cls || c.cls === this.cls) && (!this.rarity || c.rarity === this.rarity) && (!this.element || c.element === this.element))
      .sort((a, b) => order.indexOf(a.cls) - order.indexOf(b.cls) || RANK[a.rarity] - RANK[b.rarity] || costNum(a) - costNum(b) || a.name.localeCompare(b.name));
  }

  /** Elements used by the cards in the current class tab. */
  private elements(): Element[] {
    const all: Element[] = ['steel', 'fire', 'frost', 'arcane'];
    return all.filter(e => ALL_CARDS.some(c => c.element === e && (!this.cls || c.cls === this.cls)));
  }

  private refilter(): void {
    this.sel = 0;
    this.scroll = 0;
    if (this.element && !this.elements().includes(this.element)) this.element = null;
  }

  private maxScroll(n: number): number { return Math.max(0, Math.ceil(n / COLS) * PY - clipH() + 6); }

  private follow(): void {
    const top = Math.floor(this.sel / COLS) * PY;
    if (top < this.scroll) this.scroll = top;
    if (top + CARD_H + 8 > this.scroll + clipH()) this.scroll = top + CARD_H + 8 - clipH();
  }

  update(dt: number): void {
    const cards = this.list();
    this.preview.show(cards[this.sel] ?? null);
    this.preview.update(dt);
    if (spread.tall && this.updateTall(cards)) return;
    if (mouse.wheel && !spread.tall) this.scroll = Math.max(0, Math.min(this.maxScroll(cards.length), this.scroll + mouse.wheel * 28));

    const tab = hot('tab');
    if (tab >= 0 && mouse.click) { this.cls = this.tabs[tab]; this.refilter(); this.tscroll.pos = 0; sfx('move'); return; }
    const r = hot('rar');
    if (r >= 0 && mouse.click) { this.rarity = this.rarity === RARITIES[r] ? null : RARITIES[r]; this.refilter(); this.tscroll.pos = 0; sfx('move'); return; }
    const e = hot('el');
    if (e >= 0 && mouse.click) { const el = this.elements()[e]; this.element = this.element === el ? null : el; this.refilter(); sfx('move'); return; }
    if (isHot('done') && mouse.click) { sfx('back'); this.back(); return; }
    if (isHot('test') && mouse.click && cards[this.sel]) { this.runTest(cards[this.sel]); return; }
    const over = hot('card');
    if (over >= 0 && (mouse.moved || mouse.click) && over !== this.sel) this.sel = over;

    const n = cards.length;
    if (n) {
      const move = (d: number): void => { this.sel = Math.max(0, Math.min(n - 1, this.sel + d)); this.follow(); sfx('move'); };
      if (navPressed('left', dt)) move(-1);
      if (navPressed('right', dt)) move(1);
      if (navPressed('up', dt)) move(-COLS);
      if (navPressed('down', dt)) move(COLS);
      if (wasPressed('confirm') && cards[this.sel]) { this.runTest(cards[this.sel]); return; }
    }
    if (wasPressed('lb') || wasPressed('rb')) {
      const tabs = this.tabs, i = tabs.indexOf(this.cls);
      this.cls = tabs[(i + (wasPressed('rb') ? 1 : tabs.length - 1)) % tabs.length];
      this.refilter();
      sfx('move');
    }
    if (wasPressed('back') || wasPressed('pause') || mouse.rclick) { sfx('back'); this.back(); }
  }

  private runTest(card: CardDef): void {
    if (!this.test) return;
    sfx('select');
    this.test(card);
  }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    drawStage(c, getArena(), tick);
    c.fillStyle = 'rgba(0,0,24,0.8)';
    c.fillRect(...screenRect());
    const cards = this.list();
    if (this.sel >= cards.length) this.sel = Math.max(0, cards.length - 1);
    if (spread.tall) { this.drawTall(ui, cards); return; }

    // header: class tabs, then rarity and element filters (phone portrait moves it up)
    const hy = vy(4) - 4;
    frame(ui, 8, 4 + hy, UW - 16, 42, '#000000', '#7c7c7c');
    let x = 14;
    this.tabs.forEach((t, i) => {
      const label = t ? t.toUpperCase() : 'ALL';
      const w = Math.max(44, textWidth(label) + 14);
      button(ui, `tab:${i}`, label, x, 9 + hy, w, 14, t === this.cls, t === this.cls ? '#f8b800' : '#bcbcbc');
      x += w + 4;
    });
    drawText(ui, `${cards.length} SPELL${cards.length === 1 ? '' : 'S'}`, x + 8, 13 + hy, '#7c7c7c');
    button(ui, 'done', 'DONE', UW - 64, 9 + hy, 50, 14, false, '#f8b800');
    x = 14;
    RARITIES.forEach((r, i) => {
      const label = r.toUpperCase(), w = textWidth(label) + 10, on = this.rarity === r;
      zone(`rar:${i}`, x, 27 + hy, w, 14);
      frame(ui, x, 27 + hy, w, 14, on ? RARITY_COLOR[r] : '#000000', isHot(`rar:${i}`) || on ? '#fcfcfc' : RARITY_COLOR[r]);
      drawText(ui, label, x + 5, 31 + hy, on ? '#000000' : RARITY_COLOR[r]);
      x += w + 3;
    });
    x += 10;
    this.elements().forEach((el, i) => {
      const label = el.toUpperCase(), w = textWidth(label) + 10, on = this.element === el;
      if (x + w > UW - 12) return; // with every class shown, the last elements don't fit: pick a class tab to filter them
      zone(`el:${i}`, x, 27 + hy, w, 14);
      frame(ui, x, 27 + hy, w, 14, on ? ELEMENT_COLOR[el] : '#000000', isHot(`el:${i}`) || on ? '#fcfcfc' : ELEMENT_COLOR[el]);
      drawText(ui, label, x + 5, 31 + hy, on ? '#000000' : ELEMENT_COLOR[el]);
      x += w + 3;
    });

    // the grid, clipped to its window
    this.scroll = Math.min(this.scroll, this.maxScroll(cards.length));
    ui.save();
    ui.beginPath();
    ui.rect(0, clipY(), DX - 4, clipH());
    ui.clip();
    cards.forEach((card, i) => {
      const cx = GX + (i % COLS) * PX, cy = clipY() + GY - CLIP_TOP + Math.floor(i / COLS) * PY - this.scroll;
      if (cy + CARD_H < clipY() || cy > clipY() + clipH()) return;
      const top = Math.max(cy, clipY()), bot = Math.min(cy + CARD_H, clipY() + clipH());
      zone(`card:${i}`, cx, top, CARD_W, bot - top);
      drawCardFace(ui, card, cx, cy, { lit: i === this.sel });
    });
    ui.restore();
    if (!cards.length) drawTextCentered(ui, 'NO SPELLS MATCH THESE FILTERS', (DX - 4) / 2, 160, '#7c7c7c', 1, false);
    // scrollbar
    const max = this.maxScroll(cards.length);
    if (max > 0) {
      const bh = Math.max(16, Math.round(clipH() * clipH() / (clipH() + max)));
      const by = clipY() + Math.round((this.scroll / max) * (clipH() - bh));
      P(ui, '#3c3c3c', DX - 6, clipY(), 2, clipH());
      P(ui, '#bcbcbc', DX - 6, by, 2, bh);
    }

    // detail
    const card = cards[this.sel];
    win(ui, DX, clipY(), DW, clipH(), { accent: card ? ELEMENT_COLOR[card.element] : undefined });
    if (card) {
      this.preview.draw(ui, DX + 8, clipY() + 8, DW - 16, CLIP_BOX);
      let y = drawCardDetail(ui, card, DX + 6, clipY() + CLIP_BOX + 16, DW - 12) + 4;
      const line = (s: string, col: string): void => { drawText(ui, s, DX + 6, y, col); y += 11; };
      line(`${card.cls.toUpperCase()}   MAX ${MAX_COPIES[card.rarity]} PER DECK`, INK2);
      const presets = presetsFor(card.cls), inDecks = presets.filter(p => p.cards[card.id]).length;
      line(inDecks ? `IN ${inDecks} OF ${presets.length} READY DECKS` : 'IN NO READY DECK', inDecks ? '#007800' : TRIM);
      line(`CAST LOCK ${(card.lock ?? 0.3).toFixed(2)}S`, TRIM);
      if (this.test) button(ui, 'test', `${k('attack')}: TEST IN SANDBOX`, DX + 6, clipY() + clipH() - 22, DW - 12, 16, false, RED_INK);
    }
    hint(ui, `HOVER TO READ   WHEEL: SCROLL   Q/E: CLASS   ${k('attack')}: TEST   ${k('cast')}: BACK`);
  }

  private drawTall(ui: Ctx, cards: CardDef[]): void {
    const a = tallArea(), x0 = a.x + PAD, w = a.w - PAD * 2;
    let y = a.y + PAD;
    drawTextCentered(ui, 'SPELLBOOK', UW / 2, y, PAPER, 3, true);
    drawText(ui, `${cards.length}`, x0 + w - textWidth(`${cards.length}`, 2), y + 4, TRIM, 2);
    y += 21 + GAP;
    tabs(ui, 'tab', this.tabs.map(t => (t ? t.toUpperCase() : 'ALL')), this.tabs.indexOf(this.cls), x0, y, w, 44);
    y += 44 + 6;
    // filters: tap one to show only it, tap it again to clear
    const chips = (prefix: string, labels: string[], colors: string[], on: number): void => {
      const n = labels.length, cw = (w - 6 * (n - 1)) / n;
      const ts = labels.every(l => textWidth(l, 2) <= cw - 20) ? 2 : 1;
      labels.forEach((l, i) => {
        const bx = Math.round(x0 + i * (cw + 6));
        bigButton(ui, `${prefix}:${i}`, '', bx, y, Math.round(cw), 40, { on: i === on });
        P(ui, colors[i], bx + 6, y + 8, 4, 20);
        drawTextCentered(ui, l, bx + cw / 2 + 4, y + (ts === 2 ? 13 : 16), i === on ? INK : INK2, ts, false);
      });
    };
    chips('rar', RARITIES.map(r => r.toUpperCase()), RARITIES.map(r => RARITY_COLOR[r]), this.rarity ? RARITIES.indexOf(this.rarity) : -1);
    y += 40 + 6;
    const els = this.elements();
    chips('el', els.map(e => e.toUpperCase()), els.map(e => ELEMENT_COLOR[e]), this.element ? els.indexOf(this.element) : -1);
    y += 40 + GAP;
    const barTop = actionBar(ui, {});

    // the grid: four cards to a row, tap one to read it
    const gh = barTop - GAP - y, cols = 4, cw = Math.floor((w - GAP * (cols - 1)) / cols), rowH = CARD_H + 12;
    this.tgrid = [a.x, y, a.w, gh];
    const sc = this.tscroll;
    sc.max = Math.max(0, Math.ceil(cards.length / cols) * rowH - gh + 8);
    panel(ui, x0 - 6, y - 6, w + 12, gh + 12);
    ui.save();
    ui.beginPath(); ui.rect(x0 - 3, y - 3, w + 6, gh + 6); ui.clip();
    cards.forEach((card, i) => {
      const cx = x0 + (i % cols) * (cw + GAP) + Math.round((cw - CARD_W) / 2), cy = y + 6 + Math.floor(i / cols) * rowH - Math.round(sc.pos);
      if (cy + CARD_H < y || cy > y + gh) return;
      const top = Math.max(cy, y), bot = Math.min(cy + CARD_H, y + gh);
      zone(`tcard:${i}`, cx, top, CARD_W, bot - top);
      drawCardFace(ui, card, cx, cy, { lit: i === this.reading });
    });
    ui.restore();
    if (!cards.length) drawTextCentered(ui, 'NO SPELLS MATCH THESE FILTERS', UW / 2, y + 40, INK2, 1, false);
    if (sc.max > 0) {
      const sh = Math.max(24, Math.round(gh * gh / (gh + sc.max)));
      P(ui, BURN, a.x + a.w - 6, y, 4, gh);
      P(ui, INK2, a.x + a.w - 6, y + Math.round((sc.pos / sc.max) * (gh - sh)), 4, sh);
    }

    const card = this.reading >= 0 ? cards[this.reading] : undefined;
    if (card) {
      sheet(ui, this.test ? 460 : 400, (sx, sy, sw, shh) => {
        this.preview.draw(ui, sx, sy, sw, 140);
        let yy = drawCardDetail(ui, card, sx, sy + 152, sw, 2) + 4;
        const presets = presetsFor(card.cls), inDecks = presets.filter(p => p.cards[card.id]).length;
        drawText(ui, `${card.cls.toUpperCase()}   MAX ${MAX_COPIES[card.rarity]} PER DECK`, sx, yy, INK2, 1); yy += 12;
        drawText(ui, inDecks ? `IN ${inDecks} OF ${presets.length} READY DECKS` : 'IN NO READY DECK', sx, yy, inDecks ? '#007800' : TRIM, 1);
        if (this.test) bigButton(ui, 'test', 'TEST IN SANDBOX', sx, sy + shh - 62, sw, 58, { primary: true });
      });
    }
  }
}
