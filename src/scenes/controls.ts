import { hint, zone, hot, listMouse, showSel, type Scene } from './scene';
import { getArena } from '../game/battleView';
import { drawStage } from '../art/arena';
import { UW, screenRect, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered } from '../engine/font';
import { wasPressed, navPressed, BINDABLE, getKey, setKey, resetKeys, keyName, k, captureNextKey, RESERVED, mouse, type Bindable,
  LOCAL_ACTS, getLocalKey, setLocalKey, resetLocalKeys, type LocalAct } from '../engine/input';
import { sfx } from '../engine/audio';
import { win, selRow, plaque, PAPER, INK, INK2, RED_INK, BLUE_INK, TRIM } from './skin';

const LABELS: Record<Bindable, string> = {
  up: 'MOVE UP', down: 'MOVE DOWN', left: 'MOVE LEFT', right: 'MOVE RIGHT',
  attack: 'ATTACK / OK', cast: 'CAST / BACK', custom: 'OPEN DRAW SCREEN', pause: 'PAUSE',
};
/** Tabs: the single-player keys, then each side's keys when two people share the keyboard in Versus. */
const TABS = ['1 PLAYER', 'VERSUS P1', 'VERSUS P2'] as const;
type Row = Bindable | 'reset' | 'back';
const PX = 64, PW = UW - 128, Y0 = 64, RH = 18;
const TY = 40, TW = 104, TGAP = 8, TX0 = Math.round(UW / 2 - (TABS.length * TW + (TABS.length - 1) * TGAP) / 2);

/** Rebinding screen: pick an action, press the new key. Tabs switch between the 1-player keys and P1/P2's Versus keys. */
export class ControlsScene implements Scene {
  sel = 0;
  tab = 0;
  waiting = false;
  msg = '';
  msgT = 0;
  constructor(private back: () => void) {}

  private get rows(): Row[] { return this.tab === 0 ? [...BINDABLE, 'reset', 'back'] : [...LOCAL_ACTS, 'reset', 'back']; }
  private rowY(i: number): number { return Y0 + i * RH + (i >= this.rows.length - 2 ? 8 : 0); }
  /** The Versus player a tab binds. */
  private get player(): 0 | 1 { return this.tab === 2 ? 1 : 0; }

  private setTab(t: number): void {
    this.tab = (t + TABS.length) % TABS.length;
    this.sel = Math.min(this.sel, this.rows.length - 1);
    sfx('move');
  }

  update(dt: number): void {
    this.msgT -= dt;
    if (this.waiting) return;
    const rows = this.rows;
    if (navPressed('up', dt)) { this.sel = (this.sel + rows.length - 1) % rows.length; sfx('move'); }
    if (navPressed('down', dt)) { this.sel = (this.sel + 1) % rows.length; sfx('move'); }
    if (navPressed('left', dt) || wasPressed('lb')) this.setTab(this.tab - 1);
    if (navPressed('right', dt) || wasPressed('rb')) this.setTab(this.tab + 1);
    if (wasPressed('back') || mouse.rclick) { sfx('back'); this.back(); return; }
    const tab = hot('tab');
    if (mouse.click && tab >= 0) { if (tab !== this.tab) this.setTab(tab); return; }
    const clicked = listMouse('row', this.sel, i => { this.sel = i; sfx('move'); });
    if (clicked >= 0) this.sel = clicked;
    if (!wasPressed('confirm') && clicked < 0) return;
    const row = rows[this.sel];
    if (row === 'back') { sfx('back'); this.back(); return; }
    if (row === 'reset') {
      if (this.tab === 0) resetKeys(); else resetLocalKeys(this.player);
      sfx('select'); this.flash('DEFAULTS RESTORED');
      return;
    }
    sfx('select');
    this.waiting = true;
    const tabAt = this.tab;
    captureNextKey(code => {
      this.waiting = false;
      if (code === 'Escape') { sfx('back'); return; }
      // Enter pauses for both players in Versus, so it can't be one player's key
      if (RESERVED.has(code) || (tabAt > 0 && code === 'Enter')) { sfx('deny'); this.flash(`${keyName(code)} IS RESERVED`); return; }
      if (tabAt === 0) setKey(row as Bindable, code);
      else setLocalKey(tabAt === 2 ? 1 : 0, row as LocalAct, code);
      sfx('select');
    });
  }

  private flash(s: string): void { this.msg = s; this.msgT = 2; }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    drawStage(c, getArena(), tick);
    c.fillStyle = 'rgba(40,20,0,0.35)';
    c.fillRect(...screenRect());
    win(ui, PX - 16, 14, PW + 32, 286);
    drawTextCentered(ui, 'KEY MAPPING', UW / 2, 22, RED_INK, 2, false);
    TABS.forEach((t, i) => {
      const x = TX0 + i * (TW + TGAP), on = i === this.tab;
      zone(`tab:${i}`, x, TY, TW, 14);
      const text = plaque(ui, x, TY, TW, 14, on);
      drawTextCentered(ui, t, x + TW / 2, TY + 4, on ? text : i === 2 ? BLUE_INK : i === 1 ? RED_INK : INK, 1, false);
    });
    this.rows.forEach((row, i) => {
      const y = this.rowY(i), ty = y + 5;
      const on = i === this.sel && showSel();
      zone(`row:${i}`, PX - 12, y, PW + 24, RH - 1);
      if (on) selRow(ui, PX - 12, y, PW + 24, RH - 1);
      if (on && tick % 8 < 6) drawText(ui, '→', PX - 4, ty, PAPER);
      if (row === 'reset' || row === 'back') {
        drawText(ui, row === 'reset' ? 'RESET DEFAULTS' : 'BACK', PX + 10, ty, on ? INK : INK2);
        return;
      }
      drawText(ui, LABELS[row], PX + 10, ty, on ? INK : INK2);
      const key = this.tab === 0 ? getKey(row) : getLocalKey(this.player, row as LocalAct);
      const v = on && this.waiting ? (tick % 4 < 3 ? 'PRESS A KEY' : '') : keyName(key);
      drawText(ui, v, 240, ty, on && this.waiting ? RED_INK : BLUE_INK);
    });
    if (this.tab === 0) {
      drawText(ui, `HOLD ${k('attack')}: HEAVY ATTACK    ${k('cast')} + DIRECTION: AIM SPELL`, PX, 262, TRIM);
      drawText(ui, 'ARROW KEYS ALSO MOVE    ESC: PAUSE    M: MUTE', PX, 274, TRIM);
    } else {
      drawText(ui, 'TWO PLAYERS ON ONE KEYBOARD IN VERSUS.  ENTER/ESC: PAUSE', PX, 262, TRIM);
      drawText(ui, this.tab === 1 ? 'THE TOUCH PAD ALSO PLAYS AS P1' : 'THE NUMPAD ALSO WORKS: 8456 MOVE, 1 2 3', PX, 274, TRIM);
    }
    if (this.msgT > 0) drawTextCentered(ui, this.msg, UW / 2, 288, RED_INK, 1, false);
    hint(ui, this.waiting ? 'PRESS A KEY   ESC: CANCEL' : `CLICK A ROW OR ${k('attack')}: REBIND   ←/→: TAB   ${k('cast')} / RIGHT-CLICK: BACK`);
  }
}
