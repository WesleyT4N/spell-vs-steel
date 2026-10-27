import { pushScene, popScene, hint, zone, hot, listMouse, showSel, type Scene } from './scene';
import { getArena } from '../game/battleView';
import { drawStage } from '../art/arena';
import { P, UW, screenRect, vy, vspan, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered } from '../engine/font';
import { wasPressed, navPressed, k, mouse } from '../engine/input';
import { sfx, getAudioSettings, setAudioSettings, isMuted, toggleMute, voiceLine, announce } from '../engine/audio';
import { PLAYABLE } from '../game/classes';
import { ControlsScene } from './controls';
import { platform } from '../platform';
import { win, selRow, PAPER, BURN, INK, INK2, RED_INK, TRIM } from './skin';

type Row = 'master' | 'musicOn' | 'music' | 'sfxOn' | 'sfx' | 'voice' | 'announcer' | 'mute' | 'fullscreen' | 'keys' | 'back';
const ROWS: Array<[Row, string]> = [
  ['master', 'MASTER VOLUME'],
  ['musicOn', 'MUSIC'],
  ['music', 'MUSIC VOLUME'],
  ['sfxOn', 'SOUND FX'],
  ['sfx', 'SFX VOLUME'],
  ['voice', 'CHARACTER VOICES'],
  ['announcer', 'ANNOUNCER VOICE'],
  ['mute', 'MUTE ALL (M)'],
  // only where the platform can switch it (not iPhone Safari)
  ...(platform.fullscreen.supported() ? [['fullscreen', 'FULLSCREEN'] as [Row, string]] : []),
  ['keys', 'KEY MAPPING'],
  ['back', 'BACK'],
];
type Vol = 'master' | 'music' | 'sfx' | 'voice' | 'announcer';
const isVol = (r: Row): r is Vol => r === 'master' || r === 'music' || r === 'sfx' || r === 'voice' || r === 'announcer';
/** A volume row's bar is lit unless its ON/OFF switch is off. */
const isLive = (r: Vol, s: ReturnType<typeof getAudioSettings>): boolean => (r === 'music' ? s.musicOn : r === 'sfx' ? s.sfxOn : true);

/** After the voice or announcer level changes, a sample at the new level (once the player stops tapping). */
let previewTimer = 0;
function preview(row: Row): void {
  if (row !== 'voice' && row !== 'announcer') return;
  window.clearTimeout(previewTimer);
  previewTimer = window.setTimeout(() => {
    if (row === 'voice') voiceLine(PLAYABLE[Math.floor(Math.random() * PLAYABLE.length)], 'castBig');
    else { announce('fight'); }
  }, 300);
}

// layout (UI pixels)
// the key mapping and back rows sit a little apart; with the fullscreen row the rows pack tighter to fit
const PX = 64, PW = UW - 128, Y0 = 56, RH = ROWS.length > 10 ? 18 : 20, BAR_X = 236, BLOCK = 14;
const GROUP = ROWS.findIndex(([r]) => r === 'keys');
const rowY = (i: number): number => Y0 + i * RH + (i >= GROUP ? 10 : 0);
// phone portrait spreads the rows into the spare height (vy); `off` centers a row's contents in its taller box

/** Audio settings and a door to the key mapping screen. Settings save in the browser. */
export class OptionsScene implements Scene {
  sel = 0;
  constructor(private back: () => void = popScene) {}

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
        if (s[row] !== to) { setAudioSettings({ [row]: to }); sfx('move'); preview(row); }
      }
      return;
    }
    const step = hot('step');
    if (step >= 0 && mouse.click) {
      const row = ROWS[step >> 1][0];
      if (isVol(row)) { setAudioSettings({ [row]: Math.max(0, Math.min(10, s[row] + (step & 1 ? 1 : -1))) }); sfx('move'); preview(row); }
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
      preview(row);
    }
    const ok = wasPressed('confirm') || clicked >= 0;
    const toggle = ok || l || r;
    if (toggle && (row === 'musicOn' || row === 'sfxOn')) { setAudioSettings({ [row]: !s[row] }); sfx('select'); }
    if (toggle && row === 'mute') { toggleMute(); sfx('select'); }
    if (toggle && row === 'fullscreen') { void platform.fullscreen.set(!platform.fullscreen.isOn()); sfx('select'); }
    if (ok && row === 'keys') { sfx('select'); pushScene(new ControlsScene()); }
    if (ok && row === 'back') { sfx('back'); this.back(); }
  }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    drawStage(c, getArena(), tick);
    c.fillStyle = 'rgba(40,20,0,0.35)';
    c.fillRect(...screenRect());
    win(ui, PX - 16, vy(18), PW + 32, vspan(18, 262));
    drawTextCentered(ui, 'OPTIONS', UW / 2, vy(30), RED_INK, 2, false);
    const s = getAudioSettings();
    ROWS.forEach(([row, label], i) => {
      const y = vy(rowY(i)), rh = vspan(rowY(i), RH), off = Math.round((rh - RH) / 2);
      const on = i === this.sel && showSel();
      zone(`row:${i}`, PX - 12, y, PW + 24, rh - 2);
      if (on) selRow(ui, PX - 12, y, PW + 24, rh - 2);
      const ty = y + 6 + off;
      if (on && tick % 8 < 6) drawText(ui, '→', PX - 4, ty, PAPER);
      drawText(ui, label, PX + 10, ty, on ? INK : INK2);
      if (isVol(row)) {
        const v = s[row];
        const live = isLive(row, s);
        drawText(ui, '←', BAR_X - 14, ty, on ? INK : TRIM);
        zone(`step:${i * 2}`, BAR_X - 18, y, 14, rh - 2);
        for (let n = 0; n < 10; n++) {
          zone(`block:${i * 100 + n}`, BAR_X + n * BLOCK, y + 2, BLOCK, rh - 4);
          P(ui, n < v ? (live ? RED_INK : TRIM) : BURN, BAR_X + n * BLOCK + 1, y + 4 + off, BLOCK - 4, 10);
        }
        drawText(ui, '→', BAR_X + 10 * BLOCK + 2, ty, on ? INK : TRIM);
        zone(`step:${i * 2 + 1}`, BAR_X + 10 * BLOCK, y, 14, rh - 2);
        drawText(ui, String(v), BAR_X + 10 * BLOCK + 20, ty, live ? INK : TRIM);
      }
      if (row === 'musicOn' || row === 'sfxOn') drawText(ui, s[row] ? 'ON' : 'OFF', BAR_X, ty, s[row] ? '#007800' : RED_INK);
      if (row === 'mute') drawText(ui, isMuted() ? 'ON' : 'OFF', BAR_X, ty, isMuted() ? RED_INK : INK);
      if (row === 'fullscreen') drawText(ui, platform.fullscreen.isOn() ? 'ON' : 'OFF', BAR_X, ty, INK);
      if (row === 'keys') drawText(ui, '→', BAR_X, ty, TRIM);
    });
    hint(ui, `CLICK OR DRAG THE BARS   ${k('left')}/${k('right')}: ADJUST   ${k('cast')} / RIGHT-CLICK: BACK`);
  }
}
