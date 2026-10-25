import { hint, type Scene } from './scene';
import { getArena } from '../game/battleView';
import { W, H, frame, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered } from '../engine/font';
import { wasPressed, navPressed, BINDABLE, getKey, setKey, resetKeys, keyName, k, captureNextKey, RESERVED, type Bindable } from '../engine/input';
import { sfx } from '../engine/audio';

const LABELS: Record<Bindable, string> = {
  up: 'MOVE UP', down: 'MOVE DOWN', left: 'MOVE LEFT', right: 'MOVE RIGHT',
  attack: 'ATTACK / OK', cast: 'CAST / BACK', custom: 'CUSTOM SCREEN', pause: 'PAUSE',
};
const ROWS = [...BINDABLE, 'reset', 'back'] as const;

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
    if (wasPressed('back')) { sfx('back'); this.back(); return; }
    if (!wasPressed('confirm')) return;
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

  draw(c: Ctx, tick: number): void {
    getArena().draw(c, tick, 0);
    c.fillStyle = 'rgba(0,0,24,0.6)';
    c.fillRect(0, 0, W, H);
    frame(c, 12, 6, W - 24, 142, '#000000', '#fcfcfc');
    drawTextCentered(c, 'CONTROLS', W / 2, 11, '#f8b800', 1, false);
    ROWS.forEach((row, i) => {
      const y = 23 + i * 9;
      const on = i === this.sel;
      if (on && tick % 2 === 0) drawText(c, '→', 20, y, '#f8b800');
      if (row === 'reset' || row === 'back') {
        drawText(c, row === 'reset' ? 'RESET DEFAULTS' : 'BACK', 28, y, on ? '#fcfcfc' : '#bcbcbc');
        return;
      }
      drawText(c, LABELS[row], 28, y, on ? '#fcfcfc' : '#bcbcbc');
      const v = on && this.waiting ? (tick % 2 ? 'PRESS A KEY' : '') : keyName(getKey(row));
      drawText(c, v, 130, y, on && this.waiting ? '#f8b800' : '#fcd8a8');
    });
    drawText(c, `HOLD ${k('attack')}: HEAVY   ${k('cast')}+DIR: AIM BLINK`, 20, 117, '#7c7c7c');
    drawText(c, 'ARROWS MOVE  ESC PAUSE  M MUTE', 20, 126, '#7c7c7c');
    if (this.msgT > 0) drawTextCentered(c, this.msg, W / 2, 137, '#f83800', 1, false);
    hint(c, this.waiting ? 'PRESS A KEY  ESC: CANCEL' : `${k('attack')}: REBIND  ${k('cast')}: BACK`);
  }
}
