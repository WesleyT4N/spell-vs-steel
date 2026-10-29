// A small window for typing a name (renaming a spell deck). A keyboard types straight into it, phones tap the
// box for their own keyboard, and a gamepad (or the arrows, or the mouse) picks letters from a grid of keys.
import { hint, zone, hot, isHot, button, showSel } from './scene';
import { P, UW, UH, spread, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered, textWidth } from '../engine/font';
import { wasPressed, navPressed, mouse, k, usingPad } from '../engine/input';
import { touchActive } from '../engine/touch';
import { textField, textFieldFocused, focusTextField, blurTextField } from '../engine/textField';
import { sfx } from '../engine/audio';
import { win, plaque, GOLD, INK, INK2, RED_INK, PAPER, FRAME } from './skin';
import { bigButton, tallArea, TAP, GAP, PAD } from './touchUi';

/** One key of the grid: a character, or one of the editing keys. */
interface Key { label: string; ch?: string; act?: 'space' | 'del' | 'cancel' | 'ok'; row: number; x: number; w: number }

const COLS = 13, KW = 22, KH = 18, KGAP = 2;
const LETTERS = ['ABCDEFGHIJKLM', 'NOPQRSTUVWXYZ', "0123456789-!'"];

function layout(): Key[] {
  const keys: Key[] = [];
  LETTERS.forEach((row, r) => [...row].forEach((ch, i) => keys.push({ label: ch, ch, row: r, x: i * (KW + KGAP), w: KW })));
  // the bottom row: four wide keys across the same width
  const span = (n: number): number => n * (KW + KGAP) - KGAP;
  let x = 0;
  for (const [label, act, n] of [['SPACE', 'space', 4], ['DEL', 'del', 3], ['CANCEL', 'cancel', 3], ['OK', 'ok', 3]] as const) {
    keys.push({ label, act, row: 3, x, w: span(n) });
    x += span(n) + KGAP;
  }
  return keys;
}

export class NameEntry {
  private keys = layout();
  private sel = 0;
  /** Typed text is cleaned by `clean` (the allowed characters and length) as it comes in. */
  constructor(public text: string, private title: string, private clean: (s: string) => string, private maxLen: number) {
    // a keyboard player types right away; a gamepad player starts on the grid
    if (!touchActive() && !usingPad()) queueMicrotask(focusTextField);
  }

  private get grid(): boolean { return !touchActive(); }

  private put(s: string): void { this.text = this.clean(s); }

  private press(key: Key): 'ok' | 'cancel' | null {
    if (key.act === 'ok') return this.finish();
    if (key.act === 'cancel') { blurTextField(); sfx('back'); return 'cancel'; }
    if (key.act === 'del') { this.text = this.text.slice(0, -1); sfx('back'); return null; }
    if (this.text.length >= this.maxLen) { sfx('deny'); return null; }
    this.put(this.text + (key.act === 'space' ? ' ' : key.ch!));
    sfx('move');
    return null;
  }

  private finish(): 'ok' | null {
    if (!this.text.trim()) { sfx('deny'); return null; }
    blurTextField();
    return 'ok';
  }

  /** Move the grid cursor: sideways along the row, or up and down to the key nearest above or below. */
  private nav(dx: number, dy: number): void {
    const cur = this.keys[this.sel];
    if (dx) {
      const row = this.keys.filter(q => q.row === cur.row), i = row.indexOf(cur);
      this.sel = this.keys.indexOf(row[(i + dx + row.length) % row.length]);
    } else {
      const r = (cur.row + dy + 4) % 4, mid = cur.x + cur.w / 2;
      const row = this.keys.filter(q => q.row === r);
      const best = row.reduce((a, b) => (Math.abs(b.x + b.w / 2 - mid) < Math.abs(a.x + a.w / 2 - mid) ? b : a));
      this.sel = this.keys.indexOf(best);
    }
    sfx('move');
  }

  /** Returns 'ok' once a name is confirmed, 'cancel' when backed out of, else null. */
  update(dt: number): 'ok' | 'cancel' | null {
    // typing into the box: Enter (handled by the box) confirms, Esc leaves the box for the grid
    if (this.entered) { this.entered = false; return this.finish(); }
    if (mouse.click) {
      if (isHot('name:box')) { focusTextField(); return null; }
      if (isHot('name:ok')) return this.finish();
      if (isHot('name:cancel')) { sfx('back'); return 'cancel'; }
      const h = hot('nkey');
      if (h >= 0) { this.sel = h; return this.press(this.keys[h]); }
    }
    if (textFieldFocused()) return null;
    if (this.grid) {
      const h = hot('nkey');
      if (h >= 0 && mouse.moved) this.sel = h;
      if (navPressed('left', dt)) this.nav(-1, 0);
      if (navPressed('right', dt)) this.nav(1, 0);
      if (navPressed('up', dt)) this.nav(0, -1);
      if (navPressed('down', dt)) this.nav(0, 1);
      if (wasPressed('confirm')) return this.press(this.keys[this.sel]);
    }
    if (wasPressed('pause')) return this.finish();
    if (wasPressed('back') || mouse.rclick) {
      if (this.text && this.grid && !mouse.rclick) { this.text = this.text.slice(0, -1); sfx('back'); return null; }
      sfx('back');
      return 'cancel';
    }
    return null;
  }
  /** Enter was pressed in the box. */
  private entered = false;

  draw(ui: Ctx, tick: number): void {
    ui.fillStyle = 'rgba(40,20,0,0.6)';
    ui.fillRect(0, 0, UW, UH);
    if (spread.tall) { this.drawTall(ui, tick); return; }
    const gw = COLS * (KW + KGAP) - KGAP, w = gw + 24, h = this.grid ? 146 : 92, x = Math.round(UW / 2 - w / 2), y = Math.round(UH / 2 - h / 2);
    win(ui, x, y, w, h, { edge: GOLD });
    drawTextCentered(ui, this.title, UW / 2, y + 10, INK, 1, false);
    this.box(ui, x + 12, y + 24, gw, 20, 1, tick);
    if (this.grid) {
      const gy = y + 54;
      this.keys.forEach((key, i) => {
        const kx = x + 12 + key.x, ky = gy + key.row * (KH + KGAP), id = `nkey:${i}`, on = i === this.sel && showSel() && !textFieldFocused();
        zone(id, kx, ky, key.w, KH);
        const ink = plaque(ui, kx, ky, key.w, KH, on || isHot(id), on ? GOLD : FRAME);
        drawTextCentered(ui, key.label, kx + key.w / 2, ky + 6, key.act === 'ok' && !on ? RED_INK : ink, 1, false);
      });
      hint(ui, textFieldFocused() ? 'TYPE A NAME   ENTER: OK   ESC: USE THE KEYS BELOW'
        : `ARROWS: PICK A KEY   ${k('attack')}: PRESS IT   ${k('cast')}: DELETE   ${k('pause')}: OK   CLICK THE NAME TO TYPE`);
    } else {
      button(ui, 'name:cancel', 'CANCEL', x + 12, y + 56, 80, 22, false, INK2);
      button(ui, 'name:ok', 'OK', x + w - 92, y + 56, 80, 22, false, RED_INK);
      hint(ui, 'TAP THE NAME TO TYPE');
    }
  }

  /** The name and a blinking caret; the page's text box sits over it to take typing. */
  private box(ui: Ctx, x: number, y: number, w: number, h: number, s: number, tick: number): void {
    const focused = textFieldFocused();
    zone('name:box', x, y, w, h);
    P(ui, focused ? GOLD : FRAME, x - 1, y - 1, w + 2, h + 2);
    P(ui, PAPER, x, y, w, h);
    const ty = y + Math.round((h - 7 * s) / 2);
    drawText(ui, this.text, x + 6, ty, INK, s);
    if (tick % 16 < 9) P(ui, RED_INK, x + 6 + textWidth(this.text, s) + s, ty, s, 7 * s);
    textField(x, y, w, h, this.text, this.maxLen, v => this.put(v), () => { this.entered = true; });
  }

  private drawTall(ui: Ctx, tick: number): void {
    const a = tallArea(), x = a.x + PAD, w = a.w - PAD * 2, y = a.y + 60, h = 220;
    win(ui, x, y, w, h, { edge: GOLD });
    drawTextCentered(ui, this.title, UW / 2, y + 18, INK, 2, false);
    this.box(ui, x + 16, y + 52, w - 32, TAP, 2, tick);
    drawTextCentered(ui, textFieldFocused() ? '' : 'TAP THE NAME TO TYPE', UW / 2, y + 122, INK2, 1, false);
    const bw = Math.floor((w - 32 - GAP) / 2);
    bigButton(ui, 'name:cancel', 'CANCEL', x + 16, y + h - TAP - 16, bw, TAP);
    bigButton(ui, 'name:ok', 'OK', x + 16 + bw + GAP, y + h - TAP - 16, bw, TAP, { primary: true, disabled: !this.text.trim() });
  }
}
