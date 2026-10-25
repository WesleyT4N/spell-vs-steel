import { hint, type Scene } from './scene';
import { getArena } from '../game/battleView';
import { W, H, frame, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered } from '../engine/font';
import { wasPressed } from '../engine/input';
import { sfx } from '../engine/audio';

const LINES: Array<[string, string]> = [
  ['ARROWS/WASD', 'MOVE'],
  ['Z (TAP)', 'LIGHT ATTACK'],
  ['Z (HOLD)', 'CHARGE HEAVY ATTACK'],
  ['X', 'CAST NEXT SPELL'],
  ['X + DIRECTION', 'AIM BLINK'],
  ['SPACE', 'CUSTOM SCREEN (GAUGE FULL)'],
  ['ENTER/ESC', 'PAUSE'],
  ['M', 'MUTE'],
  ['', ''],
  ['CUSTOM SCREEN', ''],
  ['Z', 'PICK / UNPICK SPELL'],
  ['X', 'UNDO LAST PICK'],
  ['SPACE/ENTER', 'FIGHT'],
];

export class ControlsScene implements Scene {
  constructor(private back: () => void) {}
  update(): void {
    if (wasPressed('back') || wasPressed('confirm')) { sfx('back'); this.back(); }
  }
  draw(c: Ctx, tick: number): void {
    getArena().draw(c, tick, 0);
    c.fillStyle = 'rgba(0,0,24,0.6)';
    c.fillRect(0, 0, W, H);
    frame(c, 12, 8, W - 24, 138, '#000000', '#fcfcfc');
    drawTextCentered(c, 'CONTROLS', W / 2, 13, '#f8b800', 1, false);
    LINES.forEach(([k, v], i) => {
      drawText(c, k, 20, 26 + i * 9, '#fcfcfc');
      drawText(c, v, 106, 26 + i * 9, '#bcbcbc');
    });
    hint(c, 'X: BACK');
  }
}
