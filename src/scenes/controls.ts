import { hint, zone, listMouse, showSel, type Scene } from './scene';
import { getArena } from '../game/battleView';
import { drawStage } from '../art/arena';
import { UW, screenRect, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered } from '../engine/font';
import { wasPressed, navPressed, BINDABLE, getKey, setKey, resetKeys, keyName, k, captureNextKey, RESERVED, mouse, type Bindable } from '../engine/input';
import { sfx } from '../engine/audio';
import { win, selRow, PAPER, INK, INK2, RED_INK, BLUE_INK, TRIM } from './skin';

const LABELS: Record<Bindable, string> = {
  up: 'MOVE UP', down: 'MOVE DOWN', left: 'MOVE LEFT', right: 'MOVE RIGHT',
  attack: 'ATTACK / OK', cast: 'CAST / BACK', custom: 'OPEN DRAW SCREEN', pause: 'PAUSE',
};
const ROWS = [...BINDABLE, 'reset', 'back'] as const;
const PX = 64, PW = UW - 128, Y0 = 48, RH = 20;
const rowY = (i: number): number => Y0 + i * RH + (i >= BINDABLE.length ? 8 : 0);

/** Rebinding screen: pick an action, press the new key. */
export class ControlsScene implements Scene {
  sel = 0;
  waiting = false;
  msg = '';
  msgT = 0;
  constructor(private back: () => void) {}

  update(dt: number): void {
    this.msgT -= dt;
    if (this.waiting) return;
    if (navPressed('up', dt)) { this.sel = (this.sel + ROWS.length - 1) % ROWS.length; sfx('move'); }
    if (navPressed('down', dt)) { this.sel = (this.sel + 1) % ROWS.length; sfx('move'); }
    if (wasPressed('back') || mouse.rclick) { sfx('back'); this.back(); return; }
    const clicked = listMouse('row', this.sel, i => { this.sel = i; sfx('move'); });
    if (clicked >= 0) this.sel = clicked;
    if (!wasPressed('confirm') && clicked < 0) return;
    const row = ROWS[this.sel];
    if (row === 'back') { sfx('back'); this.back(); return; }
    if (row === 'reset') { resetKeys(); sfx('select'); this.flash('DEFAULTS RESTORED'); return; }
    sfx('select');
    this.waiting = true;
    captureNextKey(code => {
      this.waiting = false;
      if (code === 'Escape') { sfx('back'); return; }
      if (RESERVED.has(code)) { sfx('deny'); this.flash(`${keyName(code)} IS RESERVED`); return; }
      setKey(row, code);
      sfx('select');
    });
  }

  private flash(s: string): void { this.msg = s; this.msgT = 2; }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    drawStage(c, getArena(), tick);
    c.fillStyle = 'rgba(40,20,0,0.35)';
    c.fillRect(...screenRect());
    win(ui, PX - 16, 14, PW + 32, 286);
    drawTextCentered(ui, 'KEY MAPPING', UW / 2, 26, RED_INK, 2, false);
    ROWS.forEach((row, i) => {
      const y = rowY(i), ty = y + 6;
      const on = i === this.sel && showSel();
      zone(`row:${i}`, PX - 12, y, PW + 24, RH - 2);
      if (on) selRow(ui, PX - 12, y, PW + 24, RH - 2);
      if (on && tick % 8 < 6) drawText(ui, '→', PX - 4, ty, PAPER);
      if (row === 'reset' || row === 'back') {
        drawText(ui, row === 'reset' ? 'RESET DEFAULTS' : 'BACK', PX + 10, ty, on ? INK : INK2);
        return;
      }
      drawText(ui, LABELS[row], PX + 10, ty, on ? INK : INK2);
      const v = on && this.waiting ? (tick % 4 < 3 ? 'PRESS A KEY' : '') : keyName(getKey(row));
      drawText(ui, v, 240, ty, on && this.waiting ? RED_INK : BLUE_INK);
    });
    drawText(ui, `HOLD ${k('attack')}: HEAVY ATTACK    ${k('cast')} + DIRECTION: AIM SPELL`, PX, 262, TRIM);
    drawText(ui, 'ARROW KEYS ALSO MOVE    ESC: PAUSE    M: MUTE', PX, 274, TRIM);
    if (this.msgT > 0) drawTextCentered(ui, this.msg, UW / 2, 288, RED_INK, 1, false);
    hint(ui, this.waiting ? 'PRESS A KEY   ESC: CANCEL' : `CLICK A ROW OR ${k('attack')}: REBIND   ${k('cast')} / RIGHT-CLICK: BACK`);
  }
}
