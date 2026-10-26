import { hint, zone, hot, listMouse, showSel, type Scene } from './scene';
import { getArena } from '../game/battleView';
import { drawStage } from '../art/arena';
import { UW, screenRect, vy, vspan, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered } from '../engine/font';
import { wasPressed, navPressed, BINDABLE, getKey, setKey, resetKeys, keyName, k, captureNextKey, RESERVED, mouse, type Bindable,
  LOCAL_ACTS, getP2Key, setP2Key, resetP2Keys, type LocalAct,
  getPadButton, getP2PadButton, setPadButton, resetPads, padReserved } from '../engine/input';
import { parsePad, padName, padCount } from '../engine/gamepad';
import { sfx } from '../engine/audio';
import { win, selRow, plaque, PAPER, INK, INK2, RED_INK, BLUE_INK, TRIM } from './skin';

const LABELS: Record<Bindable, string> = {
  up: 'MOVE UP', down: 'MOVE DOWN', left: 'MOVE LEFT', right: 'MOVE RIGHT',
  attack: 'ATTACK / OK', cast: 'CAST / BACK', custom: 'OPEN DRAW SCREEN', pause: 'PAUSE',
};
/** Tabs: player 1's keys (used everywhere), then player 2's for two players on one keyboard in Versus. */
const TABS = ['PLAYER 1', 'PLAYER 2'] as const;
type Row = Bindable | 'reset' | 'back';
const PX = 64, PW = UW - 128, Y0 = 64, RH = 18, KEY_X = 232, PAD_X = 330;
const TY = 40, TW = 104, TGAP = 8, TX0 = Math.round(UW / 2 - (TABS.length * TW + (TABS.length - 1) * TGAP) / 2);

/**
 * Rebinding screen: pick an action, then press the new key or pad button (whichever you press is the one that
 * changes). Tabs switch between player 1's and player 2's keys and buttons.
 */
export class ControlsScene implements Scene {
  sel = 0;
  tab = 0;
  waiting = false;
  msg = '';
  msgT = 0;
  constructor(private back: () => void) {}

  private get rows(): Row[] { return this.tab === 0 ? [...BINDABLE, 'reset', 'back'] : [...LOCAL_ACTS, 'reset', 'back']; }
  private rowY(i: number): number { return Y0 + i * RH + (i >= this.rows.length - 2 ? 8 : 0); }

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
      if (this.tab === 0) resetKeys(); else resetP2Keys();
      resetPads(this.tab as 0 | 1);
      sfx('select'); this.flash('DEFAULTS RESTORED');
      return;
    }
    sfx('select');
    this.waiting = true;
    const tabAt = this.tab;
    captureNextKey(code => {
      this.waiting = false;
      if (code === 'Escape') { sfx('back'); return; }
      const pad = parsePad(code);
      if (pad) {
        if (pad.button === 'Back') { sfx('back'); return; }
        if (padReserved(pad.button, row as Bindable)) { sfx('deny'); this.flash(`${padName(pad.button)} IS RESERVED`); return; }
        setPadButton(tabAt as 0 | 1, row as Bindable, pad.button);
        sfx('select');
        return;
      }
      // player 1's pause key pauses for both players in Versus, so player 2 can't take it
      if (RESERVED.has(code) || (tabAt === 1 && code === getKey('pause'))) { sfx('deny'); this.flash(`${keyName(code)} IS RESERVED`); return; }
      if (tabAt === 0) setKey(row as Bindable, code);
      else setP2Key(row as LocalAct, code);
      sfx('select');
    });
  }

  private flash(s: string): void { this.msg = s; this.msgT = 2; }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    drawStage(c, getArena(), tick);
    c.fillStyle = 'rgba(40,20,0,0.35)';
    c.fillRect(...screenRect());
    win(ui, PX - 16, vy(14), PW + 32, vspan(14, 286));
    drawTextCentered(ui, 'KEY MAPPING', UW / 2, vy(22), RED_INK, 2, false);
    TABS.forEach((t, i) => {
      const x = TX0 + i * (TW + TGAP), on = i === this.tab;
      const ty = vy(TY), th = vspan(TY, 14);
      zone(`tab:${i}`, x, ty, TW, th);
      const text = plaque(ui, x, ty, TW, th, on);
      drawTextCentered(ui, t, x + TW / 2, ty + Math.round((th - 6) / 2), on ? text : i === 1 ? BLUE_INK : RED_INK, 1, false);
    });
    this.rows.forEach((row, i) => {
      // phone portrait spreads the rows into the spare height
      const y = vy(this.rowY(i)), rh = vspan(this.rowY(i), RH), ty = y + 5 + Math.round((rh - RH) / 2);
      const on = i === this.sel && showSel();
      zone(`row:${i}`, PX - 12, y, PW + 24, rh - 1);
      if (on) selRow(ui, PX - 12, y, PW + 24, rh - 1);
      if (on && tick % 8 < 6) drawText(ui, '→', PX - 4, ty, PAPER);
      if (row === 'reset' || row === 'back') {
        drawText(ui, row === 'reset' ? 'RESET DEFAULTS' : 'BACK', PX + 10, ty, on ? INK : INK2);
        return;
      }
      drawText(ui, LABELS[row], PX + 10, ty, on ? INK : INK2);
      if (on && this.waiting) { if (tick % 4 < 3) drawText(ui, 'PRESS A KEY OR BUTTON', KEY_X, ty, RED_INK); return; }
      drawText(ui, keyName(this.tab === 0 ? getKey(row) : getP2Key(row as LocalAct)), KEY_X, ty, BLUE_INK);
      drawText(ui, padName(this.tab === 0 ? getPadButton(row) : getP2PadButton(row as LocalAct)), PAD_X, ty, BLUE_INK);
    });
    drawText(ui, 'KEY', KEY_X, vy(Y0 - 8), TRIM);
    drawText(ui, padCount() ? 'PAD' : 'PAD (NONE)', PAD_X, vy(Y0 - 8), TRIM);
    if (this.tab === 0) {
      drawText(ui, `HOLD ${k('attack')}: HEAVY ATTACK    ${k('cast')} + DIRECTION: AIM SPELL`, PX, vy(262), TRIM);
      drawText(ui, 'ARROWS ALSO MOVE (NOT IN 2P VERSUS)   ESC: PAUSE   M: MUTE', PX, vy(262) + 12, TRIM);
    } else {
      drawText(ui, 'FOR TWO PLAYERS IN VERSUS: PAD 2 PLAYS PLAYER 2', PX, vy(262), TRIM);
      drawText(ui, `NUMPAD ALSO WORKS: 8456 MOVE, 1 2 3   ${keyName(getKey('pause'))}/ESC: PAUSE`, PX, vy(262) + 12, TRIM);
    }
    if (this.msgT > 0) drawTextCentered(ui, this.msg, UW / 2, vy(262) + 26, RED_INK, 1, false);
    hint(ui, this.waiting ? 'PRESS A KEY OR PAD BUTTON   ESC / SELECT: CANCEL' : `CLICK A ROW OR ${k('attack')}: REBIND   ←/→: TAB   ${k('cast')} / RIGHT-CLICK: BACK`);
  }
}
