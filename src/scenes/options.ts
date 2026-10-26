import { setScene, hint, zone, hot, listMouse, showSel, type Scene } from './scene';
import { getArena } from '../game/battleView';
import { drawStage } from '../art/arena';
import { P, UW, frame, screenRect, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered } from '../engine/font';
import { wasPressed, navPressed, k, mouse } from '../engine/input';
import { sfx, getAudioSettings, setAudioSettings, isMuted, toggleMute } from '../engine/audio';
import { ControlsScene } from './controls';

type Row = 'master' | 'musicOn' | 'music' | 'sfxOn' | 'sfx' | 'mute' | 'keys' | 'back';
const ROWS: Array<[Row, string]> = [
  ['master', 'MASTER VOLUME'],
  ['musicOn', 'MUSIC'],
  ['music', 'MUSIC VOLUME'],
  ['sfxOn', 'SOUND FX'],
  ['sfx', 'SFX VOLUME'],
  ['mute', 'MUTE ALL (M)'],
  ['keys', 'KEY MAPPING'],
  ['back', 'BACK'],
];
const isVol = (r: Row): r is 'master' | 'music' | 'sfx' => r === 'master' || r === 'music' || r === 'sfx';

// layout (UI pixels)
const PX = 64, PW = UW - 128, Y0 = 62, RH = 24, BAR_X = 236, BLOCK = 14;
const rowY = (i: number): number => Y0 + i * RH + (i >= 6 ? 10 : 0);

/** Audio settings and a door to the key mapping screen. Settings save in the browser. */
export class OptionsScene implements Scene {
  sel = 0;
  constructor(private back: () => void) {}

  update(dt: number): void {
    if (navPressed('up', dt)) { this.sel = (this.sel + ROWS.length - 1) % ROWS.length; sfx('move'); }
    if (navPressed('down', dt)) { this.sel = (this.sel + 1) % ROWS.length; sfx('move'); }
    if (wasPressed('back') || mouse.rclick) { sfx('back'); this.back(); return; }
    const s = getAudioSettings();

    // mouse: a volume block sets that level, the arrows step it, a row click acts like OK
    const block = hot('block');
    if (block >= 0 && (mouse.click || (mouse.down && mouse.moved))) {
      const row = ROWS[Math.floor(block / 100)][0];
      const v = (block % 100) + 1;
      // clicking the only lit block turns that volume off
      if (isVol(row)) {
        const to = mouse.click && s[row] === 1 && v === 1 ? 0 : v;
        if (s[row] !== to) { setAudioSettings({ [row]: to }); sfx('move'); }
      }
      return;
    }
    const step = hot('step');
    if (step >= 0 && mouse.click) {
      const row = ROWS[step >> 1][0];
      if (isVol(row)) { setAudioSettings({ [row]: Math.max(0, Math.min(10, s[row] + (step & 1 ? 1 : -1))) }); sfx('move'); }
      return;
    }
    const clicked = listMouse('row', this.sel, i => { this.sel = i; sfx('move'); });
    if (clicked >= 0) this.sel = clicked;

    const row = ROWS[this.sel][0];
    const l = navPressed('left', dt), r = navPressed('right', dt);
    const wheel = mouse.wheel && hot('row') === this.sel ? -mouse.wheel : 0;
    if ((l || r || wheel) && isVol(row)) {
      const v = Math.max(0, Math.min(10, s[row] + (r ? 1 : l ? -1 : wheel)));
      setAudioSettings({ [row]: v });
      sfx('move');
    }
    const ok = wasPressed('confirm') || clicked >= 0;
    const toggle = ok || l || r;
    if (toggle && (row === 'musicOn' || row === 'sfxOn')) { setAudioSettings({ [row]: !s[row] }); sfx('select'); }
    if (toggle && row === 'mute') { toggleMute(); sfx('select'); }
    if (ok && row === 'keys') { sfx('select'); setScene(new ControlsScene(() => setScene(this))); }
    if (ok && row === 'back') { sfx('back'); this.back(); }
  }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    drawStage(c, getArena(), tick);
    c.fillStyle = 'rgba(0,0,24,0.6)';
    c.fillRect(...screenRect());
    frame(ui, PX - 16, 18, PW + 32, 262, '#000000', '#fcfcfc');
    drawTextCentered(ui, 'OPTIONS', UW / 2, 30, '#f8b800', 2, false);
    const s = getAudioSettings();
    ROWS.forEach(([row, label], i) => {
      const y = rowY(i);
      const on = i === this.sel && showSel();
      zone(`row:${i}`, PX - 12, y, PW + 24, RH - 2);
      if (on) P(ui, '#0000a8', PX - 12, y, PW + 24, RH - 2);
      const ty = y + 8;
      if (on && tick % 8 < 6) drawText(ui, '→', PX - 4, ty, '#f8b800');
      drawText(ui, label, PX + 10, ty, on ? '#fcfcfc' : '#bcbcbc');
      if (isVol(row)) {
        const v = s[row];
        const live = row === 'master' || (row === 'music' ? s.musicOn : s.sfxOn);
        drawText(ui, '←', BAR_X - 14, ty, on ? '#fcfcfc' : '#7c7c7c');
        zone(`step:${i * 2}`, BAR_X - 18, y, 14, RH - 2);
        for (let n = 0; n < 10; n++) {
          zone(`block:${i * 100 + n}`, BAR_X + n * BLOCK, y + 2, BLOCK, RH - 6);
          P(ui, n < v ? (live ? '#f8b800' : '#7c7c7c') : '#3c3c3c', BAR_X + n * BLOCK + 1, y + 5, BLOCK - 4, 12);
        }
        drawText(ui, '→', BAR_X + 10 * BLOCK + 2, ty, on ? '#fcfcfc' : '#7c7c7c');
        zone(`step:${i * 2 + 1}`, BAR_X + 10 * BLOCK, y, 14, RH - 2);
        drawText(ui, String(v), BAR_X + 10 * BLOCK + 20, ty, live ? '#fcfcfc' : '#7c7c7c');
      }
      if (row === 'musicOn' || row === 'sfxOn') drawText(ui, s[row] ? 'ON' : 'OFF', BAR_X, ty, s[row] ? '#58d854' : '#f83800');
      if (row === 'mute') drawText(ui, isMuted() ? 'ON' : 'OFF', BAR_X, ty, isMuted() ? '#f83800' : '#fcfcfc');
      if (row === 'keys') drawText(ui, '→', BAR_X, ty, '#7c7c7c');
    });
    hint(ui, `CLICK OR DRAG THE BARS   ${k('left')}/${k('right')}: ADJUST   ${k('cast')} / RIGHT-CLICK: BACK`);
  }
}
