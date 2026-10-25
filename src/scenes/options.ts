import { setScene, hint, type Scene } from './scene';
import { getArena } from '../game/battleView';
import { P, W, H, frame, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered } from '../engine/font';
import { wasPressed, navPressed, k } from '../engine/input';
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

/** Audio settings and a door to the key mapping screen. Settings save in the browser. */
export class OptionsScene implements Scene {
  sel = 0;
  constructor(private back: () => void) {}

  update(dt: number): void {
    if (navPressed('up', dt)) { this.sel = (this.sel + ROWS.length - 1) % ROWS.length; sfx('move'); }
    if (navPressed('down', dt)) { this.sel = (this.sel + 1) % ROWS.length; sfx('move'); }
    if (wasPressed('back')) { sfx('back'); this.back(); return; }
    const row = ROWS[this.sel][0];
    const s = getAudioSettings();
    const l = navPressed('left', dt), r = navPressed('right', dt);
    if ((l || r) && (row === 'master' || row === 'music' || row === 'sfx')) {
      const v = Math.max(0, Math.min(10, s[row] + (r ? 1 : -1)));
      setAudioSettings({ [row]: v });
      sfx('move');
    }
    const toggle = wasPressed('confirm') || l || r;
    if (toggle && (row === 'musicOn' || row === 'sfxOn')) { setAudioSettings({ [row]: !s[row] }); sfx('select'); }
    if (toggle && row === 'mute') { toggleMute(); sfx('select'); }
    if (wasPressed('confirm') && row === 'keys') { sfx('select'); setScene(new ControlsScene(() => setScene(this))); }
    if (wasPressed('confirm') && row === 'back') { sfx('back'); this.back(); }
  }

  draw(c: Ctx, tick: number): void {
    getArena().draw(c, tick, 0);
    c.fillStyle = 'rgba(0,0,24,0.6)';
    c.fillRect(0, 0, W, H);
    frame(c, 12, 8, W - 24, 132, '#000000', '#fcfcfc');
    drawTextCentered(c, 'OPTIONS', W / 2, 14, '#f8b800', 1, false);
    const s = getAudioSettings();
    ROWS.forEach(([row, label], i) => {
      const y = 30 + i * 13 + (i >= 6 ? 4 : 0);
      const on = i === this.sel;
      if (on) P(c, '#0000a8', 16, y - 3, W - 32, 12);
      if (on && tick % 8 < 6) drawText(c, '→', 20, y, '#f8b800');
      drawText(c, label, 30, y, on ? '#fcfcfc' : '#bcbcbc');
      if (row === 'master' || row === 'music' || row === 'sfx') {
        const v = s[row];
        const live = row === 'master' || (row === 'music' ? s.musicOn : s.sfxOn);
        for (let n = 0; n < 10; n++) P(c, n < v ? (live ? '#f8b800' : '#7c7c7c') : '#3c3c3c', 132 + n * 6, y, 4, 7);
        drawText(c, String(v), 196, y, live ? '#fcfcfc' : '#7c7c7c');
      }
      if (row === 'musicOn' || row === 'sfxOn') drawText(c, s[row] ? 'ON' : 'OFF', 132, y, s[row] ? '#fcfcfc' : '#f83800');
      if (row === 'mute') drawText(c, isMuted() ? 'ON' : 'OFF', 132, y, isMuted() ? '#f83800' : '#fcfcfc');
    });
    const row = ROWS[this.sel][0];
    const adjustable = row === 'master' || row === 'music' || row === 'sfx';
    hint(c, adjustable ? `${k('left')}/${k('right')}: ADJUST  ${k('cast')}: BACK` : `${k('attack')}: SELECT  ${k('cast')}: BACK`);
  }
}
