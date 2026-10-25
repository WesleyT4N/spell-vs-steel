// Card rendering for the sharp UI layer: the full rules readout and the card face used in the Draw hand.
import { P, frame, dith, mix, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered, textWidth, wrap } from '../engine/font';
import { ELEMENT_COLOR, RARITY_COLOR, type CardDef, type Element } from '../game/cards';

const EMBLEM: Record<Element | 'shield', string[]> = {
  shield: ['#########', '####.####', '####.####', '#.......#', '####.####', '.###.###.', '.###.###.', '..##.##..', '...#.#...'],
  steel: ['........#', '.......##', '......##.', '.....##..', '#...##...', '.#.##....', '..##.....', '.###.....', '#..#.....'],
  fire: ['....#....', '...##....', '...###...', '..####.#.', '.######..', '.#######.', '#########', '.#######.', '..#####..'],
  frost: ['....#....', '.#..#..#.', '..#.#.#..', '...###...', '#########', '...###...', '..#.#.#..', '.#..#..#.', '....#....'],
  arcane: ['....#....', '....#....', '...###...', '..#####..', '#########', '..#####..', '...###...', '....#....', '....#....'],
};

export const resName = (card: CardDef): string => (card.cls === 'warrior' ? 'RAGE' : 'MANA');
export const resColor = (card: CardDef): string => (card.cls === 'warrior' ? '#f87858' : '#a4e4fc');
const costText = (card: CardDef): string => (card.cost === 'all' ? 'A' : String(card.cost));

function drawEmblem(c: Ctx, el: Element | 'shield', cx: number, cy: number, s: number, col: string): void {
  const rows = EMBLEM[el], x0 = Math.round(cx - (9 * s) / 2), y0 = Math.round(cy - (9 * s) / 2);
  for (const [dx, dy, color] of [[s, s, '#000000'], [0, 0, col]] as const)
    rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') P(c, color, x0 + x * s + dx, y0 + y * s + dy, s, s); }));
}

// dithered art backdrops, one per element and size
const artCache = new Map<string, HTMLCanvasElement>();
function artBox(el: Element, w: number, h: number): HTMLCanvasElement {
  const key = `${el}:${w}x${h}`;
  let o = artCache.get(key);
  if (o) return o;
  o = document.createElement('canvas');
  o.width = w; o.height = h;
  const x = o.getContext('2d')!;
  const top = mix(ELEMENT_COLOR[el], '#000000', 0.75), bot = mix(ELEMENT_COLOR[el], '#000000', 0.35);
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
    const t = yy / Math.max(1, h - 1);
    P(x, dith(xx, yy) < t ? bot : top, xx, yy);
  }
  artCache.set(key, o);
  return o;
}

/** Name, rarity, cost, damage and rules text in a column `w` pixels wide. Returns the y below it. */
export function drawCardDetail(c: Ctx, card: CardDef, x: number, y: number, w: number): number {
  const chars = Math.floor(w / 6);
  let yy = y;
  const big = textWidth(card.name.toUpperCase(), 2) <= w;
  if (big) { drawText(c, card.name.toUpperCase(), x, yy, '#fcfcfc', 2); yy += 18; }
  else for (const line of wrap(card.name.toUpperCase(), chars)) { drawText(c, line, x, yy, '#fcfcfc'); yy += 10; }
  drawText(c, `${card.rarity.toUpperCase()}  ${card.element.toUpperCase()}`, x, yy, RARITY_COLOR[card.rarity]); yy += 14;
  drawText(c, `COST ${card.cost === 'all' ? 'ALL' : card.cost} ${resName(card)}`, x, yy, resColor(card)); yy += 11;
  if (card.dmg !== '-') { drawText(c, `DAMAGE ${card.dmg.toUpperCase()}`, x, yy, '#f8b800'); yy += 11; }
  yy += 6;
  for (const line of wrap(card.short.toUpperCase(), chars)) { drawText(c, line, x, yy, '#fcfcfc'); yy += 11; }
  return yy;
}

/** Picked cards and the cast order panel share this color. */
export const PICKED = '#3cbcfc';

export const CARD_W = 76;
export const CARD_H = 104;

/** A card face as it sits in the hand. `order` is its cast position when picked, else -1. */
export function drawCardFace(c: Ctx, card: CardDef, x: number, y: number, opts: { order?: number; lit?: boolean; faded?: boolean } = {}): void {
  const w = CARD_W, h = CARD_H, order = opts.order ?? -1;
  const edge = order >= 0 ? PICKED : opts.lit ? '#fcfcfc' : RARITY_COLOR[card.rarity];
  P(c, '#000000', x + 3, y + 3, w, h); // drop shadow
  frame(c, x, y, w, h, '#181818', edge);
  if (opts.lit || order >= 0) { P(c, edge, x + 1, y + 1, w - 2, 1); P(c, edge, x + 1, y + h - 2, w - 2, 1); }
  // cost gem
  const gem = card.cls === 'warrior' ? '#d82800' : '#0058f8';
  P(c, '#000000', x + 3, y + 3, 16, 16);
  P(c, gem, x + 4, y + 4, 14, 14);
  P(c, mix(gem, '#fcfcfc', 0.4), x + 5, y + 5, 4, 2);
  drawTextCentered(c, costText(card), x + 11, y + 8, '#fcfcfc', 1, false);
  // rarity pip
  P(c, '#000000', x + w - 14, y + 5, 10, 10);
  P(c, RARITY_COLOR[card.rarity], x + w - 13, y + 6, 8, 8);
  // name, up to two centered lines under the gem
  const lines = wrap(card.name.toUpperCase(), 12).slice(0, 2);
  lines.forEach((l, i) => drawTextCentered(c, l, x + w / 2, y + 22 + i * 9 + (lines.length === 1 ? 4 : 0), '#fcfcfc', 1, false));
  // art
  const ax = x + 5, ay = y + 42, aw = w - 10, ah = 36;
  P(c, '#000000', ax - 1, ay - 1, aw + 2, ah + 2);
  c.drawImage(artBox(card.element, aw, ah), ax, ay);
  // steel spells that deal no damage are guards and shouts: a shield instead of a sword
  drawEmblem(c, card.element === 'steel' && card.dmg === '-' ? 'shield' : card.element, ax + aw / 2, ay + ah / 2, 3, ELEMENT_COLOR[card.element]);
  // damage
  const d = card.dmg === '-' ? '' : card.dmg.toUpperCase();
  if (!d) drawTextCentered(c, 'EFFECT', x + w / 2, y + 86, '#bcbcbc', 1, false);
  else if (textWidth(d, 2) <= w - 8) drawTextCentered(c, d, x + w / 2, y + 83, '#f8b800', 2, false);
  else drawTextCentered(c, d.slice(0, 12), x + w / 2, y + 86, '#f8b800', 1, false);
  if (opts.faded) { c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(x, y, w, h); }
  if (order >= 0) {
    P(c, '#000000', x + w - 19, y - 7, 22, 20);
    P(c, PICKED, x + w - 18, y - 6, 20, 18);
    drawTextCentered(c, String(order + 1), x + w - 8, y - 3, '#000000', 2, false);
  }
}
