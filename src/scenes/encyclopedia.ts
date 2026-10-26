// Card encyclopedia: every spell of every class as a browsable grid of card faces, with filters.
// Classes come from the card list itself, so new classes appear here as soon as their cards exist.
import { hint, zone, hot, isHot, button, type Scene } from './scene';
import { getArena } from '../game/battleView';
import { drawStage } from '../art/arena';
import type { ClassId } from '../art/sprites';
import { P, UW, frame, screenRect, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered, textWidth } from '../engine/font';
import { wasPressed, navPressed, mouse, k } from '../engine/input';
import { sfx } from '../engine/audio';
import { PLAYABLE } from '../game/classes';
import { ALL_CARDS, ELEMENT_COLOR, MAX_COPIES, RARITY_COLOR, type CardDef, type Element, type Rarity } from '../game/cards';
import { starterDeck, STARTER_NAME } from '../game/deck';
import { drawCardDetail, drawCardFace, CARD_W, CARD_H } from './cardView';
import { win, INK2, RED_INK, TRIM } from './skin';
import { CardPreview } from './cardPreview';

const RARITIES: Rarity[] = ['common', 'uncommon', 'legendary', 'mythic'];
const RANK: Record<Rarity, number> = { common: 0, uncommon: 1, legendary: 2, mythic: 3 };

// layout (UI pixels)
const GX = 8, GY = 54, COLS = 3, PX = 80, PY = 112;
const CLIP_Y = 50, CLIP_H = 252;
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

  private maxScroll(n: number): number { return Math.max(0, Math.ceil(n / COLS) * PY - CLIP_H + 6); }

  private follow(): void {
    const top = Math.floor(this.sel / COLS) * PY;
    if (top < this.scroll) this.scroll = top;
    if (top + CARD_H + 8 > this.scroll + CLIP_H) this.scroll = top + CARD_H + 8 - CLIP_H;
  }

  update(dt: number): void {
    const cards = this.list();
    this.preview.show(cards[this.sel] ?? null);
    this.preview.update(dt);
    if (mouse.wheel) this.scroll = Math.max(0, Math.min(this.maxScroll(cards.length), this.scroll + mouse.wheel * 28));

    const tab = hot('tab');
    if (tab >= 0 && mouse.click) { this.cls = this.tabs[tab]; this.refilter(); sfx('move'); return; }
    const r = hot('rar');
    if (r >= 0 && mouse.click) { this.rarity = this.rarity === RARITIES[r] ? null : RARITIES[r]; this.refilter(); sfx('move'); return; }
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

    // header: class tabs, then rarity and element filters
    frame(ui, 8, 4, UW - 16, 42, '#000000', '#7c7c7c');
    let x = 14;
    this.tabs.forEach((t, i) => {
      const label = t ? t.toUpperCase() : 'ALL';
      const w = Math.max(44, textWidth(label) + 14);
      button(ui, `tab:${i}`, label, x, 9, w, 14, t === this.cls, t === this.cls ? '#f8b800' : '#bcbcbc');
      x += w + 4;
    });
    drawText(ui, `${cards.length} SPELL${cards.length === 1 ? '' : 'S'}`, x + 8, 13, '#7c7c7c');
    button(ui, 'done', 'DONE', UW - 64, 9, 50, 14, false, '#f8b800');
    x = 14;
    RARITIES.forEach((r, i) => {
      const label = r.toUpperCase(), w = textWidth(label) + 10, on = this.rarity === r;
      zone(`rar:${i}`, x, 27, w, 14);
      frame(ui, x, 27, w, 14, on ? RARITY_COLOR[r] : '#000000', isHot(`rar:${i}`) || on ? '#fcfcfc' : RARITY_COLOR[r]);
      drawText(ui, label, x + 5, 31, on ? '#000000' : RARITY_COLOR[r]);
      x += w + 3;
    });
    x += 10;
    this.elements().forEach((el, i) => {
      const label = el.toUpperCase(), w = textWidth(label) + 10, on = this.element === el;
      if (x + w > UW - 12) return; // with every class shown, the last elements don't fit: pick a class tab to filter them
      zone(`el:${i}`, x, 27, w, 14);
      frame(ui, x, 27, w, 14, on ? ELEMENT_COLOR[el] : '#000000', isHot(`el:${i}`) || on ? '#fcfcfc' : ELEMENT_COLOR[el]);
      drawText(ui, label, x + 5, 31, on ? '#000000' : ELEMENT_COLOR[el]);
      x += w + 3;
    });

    // the grid, clipped to its window
    this.scroll = Math.min(this.scroll, this.maxScroll(cards.length));
    ui.save();
    ui.beginPath();
    ui.rect(0, CLIP_Y, DX - 4, CLIP_H);
    ui.clip();
    cards.forEach((card, i) => {
      const cx = GX + (i % COLS) * PX, cy = GY + Math.floor(i / COLS) * PY - this.scroll;
      if (cy + CARD_H < CLIP_Y || cy > CLIP_Y + CLIP_H) return;
      const top = Math.max(cy, CLIP_Y), bot = Math.min(cy + CARD_H, CLIP_Y + CLIP_H);
      zone(`card:${i}`, cx, top, CARD_W, bot - top);
      drawCardFace(ui, card, cx, cy, { lit: i === this.sel });
    });
    ui.restore();
    if (!cards.length) drawTextCentered(ui, 'NO SPELLS MATCH THESE FILTERS', (DX - 4) / 2, 160, '#7c7c7c', 1, false);
    // scrollbar
    const max = this.maxScroll(cards.length);
    if (max > 0) {
      const bh = Math.max(16, Math.round(CLIP_H * CLIP_H / (CLIP_H + max)));
      const by = CLIP_Y + Math.round((this.scroll / max) * (CLIP_H - bh));
      P(ui, '#3c3c3c', DX - 6, CLIP_Y, 2, CLIP_H);
      P(ui, '#bcbcbc', DX - 6, by, 2, bh);
    }

    // detail
    const card = cards[this.sel];
    win(ui, DX, CLIP_Y, DW, CLIP_H, { accent: card ? ELEMENT_COLOR[card.element] : undefined });
    if (card) {
      this.preview.draw(ui, DX + 8, CLIP_Y + 8, DW - 16, CLIP_BOX);
      let y = drawCardDetail(ui, card, DX + 6, CLIP_Y + CLIP_BOX + 16, DW - 12) + 4;
      const line = (s: string, col: string): void => { drawText(ui, s, DX + 6, y, col); y += 11; };
      line(`${card.cls.toUpperCase()}   MAX ${MAX_COPIES[card.rarity]} PER DECK`, INK2);
      const inStarter = starterDeck(card.cls)[card.id] ?? 0;
      line(inStarter ? `${STARTER_NAME[card.cls].toUpperCase()}: ${inStarter}` : 'NOT IN STARTER', inStarter ? '#007800' : TRIM);
      line(`CAST LOCK ${(card.lock ?? 0.3).toFixed(2)}S`, TRIM);
      if (this.test) button(ui, 'test', `${k('attack')}: TEST IN SANDBOX`, DX + 6, CLIP_Y + CLIP_H - 22, DW - 12, 16, false, RED_INK);
    }
    hint(ui, `HOVER TO READ   WHEEL: SCROLL   Q/E: CLASS   ${k('attack')}: TEST   ${k('cast')}: BACK`);
  }
}
