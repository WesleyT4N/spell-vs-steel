// Card rendering for the sharp UI layer: the full rules readout and the card face used in the Draw hand.
import { P, dith, mix, type Ctx } from '../engine/gfx';
import { paper, seal, disc, ink, PAPER, INK, INK2, RED_INK, BLUE_INK, GOLD, WAX, WAX_HI, FRAME } from './skin';
import { drawText, drawTextCentered, textWidth, wrap } from '../engine/font';
import { ELEMENT_COLOR, RARITY_COLOR, type CardDef, type Element } from '../game/cards';
import { CLASS_INFO } from '../game/classes';
import { drawIconAt, ICON_SIZE } from '../art/cardIcons';
import { modSign, modInk, drawDelta, deltaText, pctText, BUFF_WAX, NERF_WAX } from './modValue';

const EMBLEM: Record<Element | 'shield', string[]> = {
  shield: ['#########', '####.####', '####.####', '#.......#', '####.####', '.###.###.', '.###.###.', '..##.##..', '...#.#...'],
  steel: ['........#', '.......##', '......##.', '.....##..', '#...##...', '.#.##....', '..##.....', '.###.....', '#..#.....'],
  fire: ['....#....', '...##....', '...###...', '..####.#.', '.######..', '.#######.', '#########', '.#######.', '..#####..'],
  frost: ['....#....', '.#..#..#.', '..#.#.#..', '...###...', '#########', '...###...', '..#.#.#..', '.#..#..#.', '....#....'],
  arcane: ['....#....', '....#....', '...###...', '..#####..', '#########', '..#####..', '...###...', '....#....', '....#....'],
  shadow: ['...####..', '..##.....', '.##......', '.##......', '.##......', '.##......', '.##......', '..##.....', '...####..'],
  poison: ['....#....', '....#....', '...###...', '..#####..', '.#######.', '.###.###.', '.##...##.', '..##.##..', '...###...'],
  nature: ['......###', '....#####', '...######', '..######.', '.######..', '.#####...', '.###.....', '#.#......', '#........'],
  holy: ['...###...', '...###...', '#########', '#########', '...###...', '...###...', '...###...', '...###...', '...###...'],
};

export const resName = (card: CardDef): string => CLASS_INFO[card.cls].res;
export const resColor = (card: CardDef): string => CLASS_INFO[card.cls].resColor;
/** The resource color as ink, for text on parchment. */
export const resInk = (card: CardDef): string => RES_INK[CLASS_INFO[card.cls].res];
export const RES_INK: Record<string, string> = { RAGE: RED_INK, MANA: BLUE_INK, ENERGY: '#7c5800' };
const costText = (card: CardDef): string => (card.cost === 'all' ? 'A' : String(card.cost));
/** -1/0/+1 for a card whose cost is now `cost` (see modSign); 'All' costs only change when they become free. */
export function costSign(card: CardDef, cost: number | undefined): number {
  if (cost === undefined) return 0;
  if (card.cost === 'all') return cost === 0 ? 1 : 0;
  return modSign(card.cost, cost, true);
}
/** The change to a card's cost as tag text: -1, +1, or FREE for an All cost that costs nothing. */
export const costDeltaText = (card: CardDef, cost: number): string => (card.cost === 'all' ? 'FREE' : deltaText(cost - card.cost));

export function drawEmblem(c: Ctx, el: Element | 'shield', cx: number, cy: number, s: number, col: string): void {
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

/** Name, rarity, cost, damage and rules text in a column `w` pixels wide, in ink for a parchment window. Returns the y below it. */
/** `cost` is what the card costs right now, when something has changed it (shown in the modifier look); `dmg` its damage multiplier. */
export function drawCardDetail(c: Ctx, card: CardDef, x: number, y: number, w: number, z = 1, cost?: number, dmg = 1): number {
  const chars = Math.floor(w / (6 * z));
  let yy = y;
  const big = textWidth(card.name.toUpperCase(), 2 * z) <= w;
  if (big) { drawText(c, card.name.toUpperCase(), x, yy, INK, 2 * z); yy += 18 * z; }
  else for (const line of wrap(card.name.toUpperCase(), chars)) { drawText(c, line, x, yy, INK, z); yy += 10 * z; }
  drawText(c, card.rarity.toUpperCase(), x, yy, ink(RARITY_COLOR[card.rarity]), z);
  drawText(c, card.element.toUpperCase(), x + textWidth(card.rarity.toUpperCase(), z) + 12 * z, yy, ink(ELEMENT_COLOR[card.element]), z); yy += 14 * z;
  // COST 2 MANA [-1]: a cost something has changed, in the modifier look
  const sign = costSign(card, cost), now = sign ? String(cost) : card.cost === 'all' ? 'ALL' : String(card.cost);
  let cx = x;
  drawText(c, 'COST ', cx, yy, resInk(card), z); cx += textWidth('COST ', z);
  drawText(c, now, cx, yy, modInk(sign, resInk(card)), z); cx += textWidth(now, z);
  drawText(c, ` ${resName(card)}`, cx, yy, resInk(card), z); cx += textWidth(` ${resName(card)}`, z);
  if (sign) drawDelta(c, costDeltaText(card, cost!), sign, cx + 6, yy + (z - 1) * 3);
  yy += 11 * z;
  if (card.dmg !== '-') {
    // DAMAGE 1850 [+25%]: an empowered hit, in the modifier look
    const t = `DAMAGE ${card.dmg.toUpperCase()}`, up = modSign(1, dmg, false);
    drawText(c, t, x, yy, modInk(up, RED_INK), z);
    if (up) drawDelta(c, pctText(dmg), up, x + textWidth(t, z) + 6, yy + (z - 1) * 3);
    yy += 11 * z;
  }
  yy += 6 * z;
  for (const line of wrap(card.short.toUpperCase(), chars)) { drawText(c, line, x, yy, INK, z); yy += 11 * z; }
  return yy;
}

/** Picked cards and the cast order share this color: red wax. */
export const PICKED = WAX;

export const CARD_W = 76;
export const CARD_H = 104;

/**
 * A parchment card face as it sits in the hand. `order` is its cast position when picked, else -1.
 * `short` marks affordability: 0 = payable (gold ring on the seal), above 0 = that much resource missing
 * (grey seal, dimmed, NEED tag), unset = not shown. `builds` is for resources earned mid-fight (Rage):
 * a short card stays bright and gets a soft +N tag instead, since it will be castable later. `cost` is what
 * it costs right now: when that differs from the print, the seal turns green (cheaper) or grey (dearer)
 * and the printed cost sits struck through beside it.
 */
export function drawCardFace(c: Ctx, card: CardDef, x: number, y: number, opts: { order?: number; lit?: boolean; faded?: boolean; short?: number; builds?: boolean; cost?: number; dmg?: number } = {}): void {
  const w = CARD_W, h = CARD_H, order = opts.order ?? -1;
  const edge = order >= 0 ? WAX : opts.lit ? GOLD : FRAME;
  P(c, 'rgba(40,20,0,0.5)', x + 3, y + 3, w, h); // drop shadow
  P(c, '#000000', x - 1, y - 1, w + 2, h + 2);
  P(c, edge, x, y, w, h);
  paper(c, x + 2, y + 2, w - 4, h - 4, 4);
  // wax seal cost
  const short = opts.short ?? -1, hard = short > 0 && !opts.builds;
  const sign = costSign(card, opts.cost);
  const gem = hard ? '#7c7c7c' : sign > 0 ? BUFF_WAX : sign < 0 ? NERF_WAX : CLASS_INFO[card.cls].gem;
  if (short === 0) disc(c, x + 12, y + 12, 10, GOLD);
  seal(c, x + 12, y + 12, 8, gem);
  drawTextCentered(c, sign ? String(opts.cost) : costText(card), x + 12, y + 9, '#fcfcfc', 1, false);
  if (sign) drawDelta(c, costDeltaText(card, opts.cost!), sign, x + 23, y + 9);
  // rarity ribbon hanging from the top edge
  P(c, RARITY_COLOR[card.rarity], x + w - 12, y + 2, 6, 11);
  P(c, mix(RARITY_COLOR[card.rarity], '#000000', 0.35), x + w - 7, y + 2, 1, 11);
  P(c, PAPER, x + w - 10, y + 11, 2, 2);
  // name, up to two centered lines under the seal
  const lines = wrap(card.name.toUpperCase(), 12).slice(0, 2);
  lines.forEach((l, i) => drawTextCentered(c, l, x + w / 2, y + 23 + i * 9 + (lines.length === 1 ? 4 : 0), INK, 1, false));
  // art
  // the art box is as tall as an icon at game scale (20 art px = 40 UI px)
  const ax = x + 6, ay = y + 41, aw = w - 12, ah = 40;
  P(c, FRAME, ax - 1, ay - 1, aw + 2, ah + 2);
  c.drawImage(artBox(card.element, aw, ah), ax, ay);
  drawSpellArt(c, card, ax + aw / 2, ay + ah / 2, 2);
  // damage
  const d = card.dmg === '-' ? '' : card.dmg.toUpperCase(), up = d ? modSign(1, opts.dmg ?? 1, false) : 0, dInk = modInk(up, RED_INK);
  if (!d) drawTextCentered(c, 'EFFECT', x + w / 2, y + 87, INK2, 1, false);
  else if (textWidth(d, 2) <= w - 8) drawTextCentered(c, d, x + w / 2, y + 84, dInk, 2, false);
  else drawTextCentered(c, d.slice(0, 12), x + w / 2, y + 87, dInk, 1, false);
  // an empowered hit: green damage and its +25% tag in the art's top-right corner (clear of the NEED tag)
  if (up) { const t = pctText(opts.dmg!); drawDelta(c, t, up, ax + aw - textWidth(t) - 5, ay + 3); }
  if (opts.faded || hard) { c.fillStyle = `rgba(60,40,10,${opts.faded || !opts.lit ? 0.45 : 0.2})`; c.fillRect(x, y, w, h); }
  if (short > 0) {
    const tag = hard ? `NEED ${short}` : `+${short} ${resName(card)}`, tw = textWidth(tag) + 6;
    P(c, '#000000', x + (w - tw) / 2 - 1, y + 65, tw + 2, 13);
    P(c, PAPER, x + (w - tw) / 2, y + 66, tw, 11);
    drawTextCentered(c, tag, x + w / 2, y + 68, hard ? RED_INK : resInk(card), 1, false);
  }
  if (order >= 0) { // a red wax tab with the cast order
    P(c, '#000000', x + w - 19, y - 7, 22, 20);
    P(c, WAX, x + w - 18, y - 6, 20, 18); P(c, WAX_HI, x + w - 18, y - 6, 20, 1);
    drawTextCentered(c, String(order + 1), x + w - 8, y - 3, PAPER, 2, false);
  }
}

/** A square art tile with the card's emblem, for compact callouts. */
export function drawCardIcon(c: Ctx, card: CardDef, x: number, y: number, size: number): void {
  P(c, '#000000', x - 1, y - 1, size + 2, size + 2);
  c.drawImage(artBox(card.element, size, size), x, y);
  drawSpellArt(c, card, x + size / 2, y + size / 2, Math.max(1, Math.floor(size / ICON_SIZE)));
}

/** The spell's icon centered on (cx, cy), `s` UI px per art px (2 = game scale), or its element emblem if it has no icon. */
function drawSpellArt(c: Ctx, card: CardDef, cx: number, cy: number, s: number): void {
  const n = ICON_SIZE * s;
  if (drawIconAt(c, card.id, Math.round(cx - n / 2), Math.round(cy - n / 2), s)) return;
  // steel spells that deal no damage are guards and shouts: a shield instead of a sword
  drawEmblem(c, card.element === 'steel' && card.dmg === '-' ? 'shield' : card.element, cx, cy, Math.max(2, s + 1), ELEMENT_COLOR[card.element]);
}
