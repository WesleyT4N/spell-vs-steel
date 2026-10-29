// A small window for typing a name (renaming a spell deck) in a real text box, focused as it opens: a keyboard
// types into it and phones bring up their own keyboard. Someone on a gamepad gets an on-screen QWERTY keyboard
// under the box instead.
import { hint, zone, hot, isHot, button, showSel } from './scene';
import { P, UW, UH, spread, type Ctx } from '../engine/gfx';
import { drawTextCentered } from '../engine/font';
import { wasPressed, navPressed, mouse, k, usingPad } from '../engine/input';
import { touchActive } from '../engine/touch';
import { textField, textFieldFocused, focusTextField, blurTextField } from '../engine/textField';
import { sfx } from '../engine/audio';
import { win, plaque, GOLD, INK, INK2, RED_INK, FRAME } from './skin';
import { bigButton, tallArea, TAP, GAP, PAD } from './touchUi';

/** One key of the on-screen keyboard: a character, or one of the editing keys. */
interface Key { label: string; ch?: string; act?: 'space' | 'del' | 'cancel' | 'ok'; row: number; x: number; w: number }

const COLS = 11, KW = 22, KH = 18, KGAP = 2, STEP = KW + KGAP, ROWS = 5;
/** QWERTY rows, each shifted right a little more like a real keyboard. */
const QWERTY: Array<[string, number]> = [['1234567890-', 0], ["QWERTYUIOP'", 0], ['ASDFGHJKL!', KW / 2], ['ZXCVBNM.?', KW]];

function layout(): Key[] {
  const keys: Key[] = [];
  QWERTY.forEach(([row, off], r) => [...row].forEach((ch, i) => keys.push({ label: ch, ch, row: r, x: off + i * STEP, w: KW })));
  // the bottom row: four wide keys across the same width
  let x = 0;
  for (const [label, act, n] of [['SPACE', 'space', 4], ['DEL', 'del', 2], ['CANCEL', 'cancel', 3], ['OK', 'ok', 2]] as const) {
    keys.push({ label, act, row: 4, x, w: n * STEP - KGAP });
    x += n * STEP;
  }
  return keys;
}

export class NameEntry {
  private keys = layout();
  /** The on-screen keyboard's cursor (starts on OK); without it, CANCEL (0) or OK (1). */
  private sel = this.keys.length - 1;
  private btn = 1;
  /** Enter was pressed in the box. */
  private entered = false;

  /** Typed text is cleaned by `clean` (the allowed characters and length) as it comes in. */
  constructor(public text: string, private title: string, private clean: (s: string) => string, private maxLen: number) {
    if (!this.grid) queueMicrotask(focusTextField);
  }

  /** The on-screen keyboard is for gamepads. */
  private get grid(): boolean { return usingPad() && !touchActive(); }

  private finish(): 'ok' | null {
    if (!this.text.trim()) { sfx('deny'); return null; }
    blurTextField();
    return 'ok';
  }

  private cancel(): 'cancel' { blurTextField(); sfx('back'); return 'cancel'; }

  private press(key: Key): 'ok' | 'cancel' | null {
    if (key.act === 'ok') return this.finish();
    if (key.act === 'cancel') return this.cancel();
    if (key.act === 'del') { this.text = this.text.slice(0, -1); sfx('back'); return null; }
    if (this.text.length >= this.maxLen) { sfx('deny'); return null; }
    this.text = this.clean(this.text + (key.act === 'space' ? ' ' : key.ch!));
    sfx('move');
    return null;
  }

  /** Move the keyboard cursor: along the row, or up and down to the nearest key above or below. */
  private nav(dx: number, dy: number): void {
    const cur = this.keys[this.sel];
    if (dx) {
      const row = this.keys.filter(q => q.row === cur.row), i = row.indexOf(cur);
      this.sel = this.keys.indexOf(row[(i + dx + row.length) % row.length]);
    } else {
      const r = (cur.row + dy + ROWS) % ROWS, mid = cur.x + cur.w / 2;
      const best = this.keys.filter(q => q.row === r).reduce((a, b) => (Math.abs(b.x + b.w / 2 - mid) < Math.abs(a.x + a.w / 2 - mid) ? b : a));
      this.sel = this.keys.indexOf(best);
    }
    sfx('move');
  }

  /** Returns 'ok' once a name is confirmed, 'cancel' when backed out of, else null. */
  update(dt: number): 'ok' | 'cancel' | null {
    if (this.entered) { this.entered = false; return this.finish(); }
    if (mouse.click) {
      if (isHot('name:ok')) return this.finish();
      if (isHot('name:cancel')) return this.cancel();
      const h = hot('nkey');
      if (h >= 0) { this.sel = h; return this.press(this.keys[h]); }
    }
    // typing: the box has the keys (Esc leaves it)
    if (textFieldFocused()) return null;
    if (this.grid) {
      if (navPressed('left', dt)) this.nav(-1, 0);
      if (navPressed('right', dt)) this.nav(1, 0);
      if (navPressed('up', dt)) this.nav(0, -1);
      if (navPressed('down', dt)) this.nav(0, 1);
      if (wasPressed('confirm')) return this.press(this.keys[this.sel]);
      if (wasPressed('pause')) return this.finish();
      // B deletes a letter, and backs out once the name is empty
      if (wasPressed('back') && this.text) { this.text = this.text.slice(0, -1); sfx('back'); return null; }
    } else {
      if (navPressed('left', dt) || navPressed('right', dt)) { this.btn = 1 - this.btn; sfx('move'); }
      if (navPressed('up', dt)) { focusTextField(); return null; }
      if (wasPressed('confirm')) return this.btn ? this.finish() : this.cancel();
      if (wasPressed('pause')) return this.finish();
    }
    if (wasPressed('back') || mouse.rclick) return this.cancel();
    return null;
  }

  draw(ui: Ctx): void {
    ui.fillStyle = 'rgba(40,20,0,0.6)';
    ui.fillRect(0, 0, UW, UH);
    const typing = textFieldFocused();
    if (spread.tall) {
      const a = tallArea(), x = a.x + PAD, w = a.w - PAD * 2, y = a.y + 60, h = 200;
      win(ui, x, y, w, h, { edge: GOLD });
      drawTextCentered(ui, this.title, UW / 2, y + 18, INK, 2, false);
      this.box(ui, x + 16, y + 48, w - 32, TAP, typing);
      const bw = Math.floor((w - 32 - GAP) / 2);
      bigButton(ui, 'name:cancel', 'CANCEL', x + 16, y + h - TAP - 16, bw, TAP);
      bigButton(ui, 'name:ok', 'OK', x + 16 + bw + GAP, y + h - TAP - 16, bw, TAP, { primary: true, disabled: !this.text.trim() });
      return;
    }
    const grid = this.grid, gw = COLS * STEP - KGAP, w = gw + 24, h = grid ? 66 + ROWS * (KH + KGAP) : 96;
    const x = Math.round(UW / 2 - w / 2), y = Math.round(UH / 2 - h / 2);
    win(ui, x, y, w, h, { edge: GOLD });
    drawTextCentered(ui, this.title, UW / 2, y + 10, INK, 1, false);
    this.box(ui, x + 12, y + 26, gw, 24, typing);
    if (grid) {
      const gy = y + 58;
      this.keys.forEach((key, i) => {
        const kx = x + 12 + key.x, ky = gy + key.row * (KH + KGAP), id = `nkey:${i}`, on = i === this.sel && !typing;
        zone(id, kx, ky, key.w, KH);
        const ink = plaque(ui, kx, ky, key.w, KH, on || isHot(id), on ? GOLD : FRAME);
        drawTextCentered(ui, key.label, kx + key.w / 2, ky + 6, key.act === 'ok' && !on ? RED_INK : ink, 1, false);
      });
      hint(ui, typing ? 'TYPE A NAME   ENTER: OK   ESC: LEAVE THE BOX'
        : `${k('attack')}: PRESS A KEY   ${k('cast')}: DELETE   ${k('pause')}: OK`);
      return;
    }
    const on = (i: number): boolean => !typing && this.btn === i && showSel();
    button(ui, 'name:cancel', 'CANCEL', x + 12, y + h - 32, 90, 22, on(0), INK2);
    button(ui, 'name:ok', 'OK', x + w - 102, y + h - 32, 90, 22, on(1), RED_INK);
    hint(ui, touchActive() ? 'TAP THE NAME TO TYPE'
      : typing ? 'TYPE A NAME   ENTER: OK   ESC: LEAVE THE BOX'
        : `${k('left')}/${k('right')}: CHOOSE   ${k('attack')}: PRESS   ${k('up')} / CLICK THE NAME: TYPE   ${k('cast')}: CANCEL`);
  }

  /** The page's text box, in a frame that lights up while it has the keys. */
  private box(ui: Ctx, x: number, y: number, w: number, h: number, typing: boolean): void {
    P(ui, typing ? GOLD : FRAME, x - 2, y - 2, w + 4, h + 4);
    textField(x, y, w, h, this.text, this.maxLen, v => { this.text = this.clean(v); }, () => { this.entered = true; }, { visible: true });
  }
}
