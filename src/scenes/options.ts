import { pushScene, popScene, hint, zone, hot, isHot, listMouse, showSel, type Scene } from './scene';
import { getArena } from '../game/battleView';
import { drawStage } from '../art/arena';
import { P, UW, screenRect, type Ctx } from '../engine/gfx';
import { getTouchSettings, setTouchSettings, touchActive, type PadMode, type PadSize } from '../engine/touch';
import { drawText, drawTextCentered } from '../engine/font';
import { wasPressed, navPressed, k, mouse } from '../engine/input';
import { sfx, getAudioSettings, setAudioSettings, isMuted, toggleMute, voiceLine, announce } from '../engine/audio';
import { PLAYABLE } from '../game/classes';
import { ControlsScene } from './controls';
import { platform } from '../platform';
import { win, selRow, PAPER, PAPER2, BURN, INK, INK2, RED_INK, TRIM, FRAME } from './skin';

type Row = 'master' | 'musicOn' | 'music' | 'sfxOn' | 'sfx' | 'voice' | 'announcer' | 'mute' | 'fullscreen' | 'touch' | 'keys' | 'back';
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
  // phones and tablets only (see rows())
  ['touch', 'TOUCH CONTROLS'],
  ['keys', 'KEY MAPPING'],
  ['back', 'BACK'],
];
/** The rows on show: TOUCH CONTROLS only where there is a touch screen. */
const rows = (): Array<[Row, string]> => (touchActive() ? ROWS : ROWS.filter(([r]) => r !== 'touch'));
type Vol = 'master' | 'music' | 'sfx' | 'voice' | 'announcer';
const isVol = (r: Row): r is Vol => r === 'master' || r === 'music' || r === 'sfx' || r === 'voice' || r === 'announcer';
const SIZES: PadSize[] = ['S', 'M', 'L'];
const TOUCH_ROWS: Array<['size' | 'left' | 'buzz' | 'back', string]> = [['size', 'PAD SIZE'], ['left', 'LEFT-HANDED'], ['buzz', 'VIBRATION'], ['back', 'BACK']];
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
const PX = 64, PW = UW - 128, Y0 = 56, BAR_X = 236, BLOCK = 14;
const rowH = (): number => (rows().length > 11 ? 17 : rows().length > 10 ? 18 : 20);
const rowY = (i: number): number => Y0 + i * rowH() + (i >= rows().findIndex(([r]) => r === 'touch' || r === 'keys') ? 10 : 0);
// `off` centers a row's contents in its box

/** Audio settings and a door to the key mapping screen. Settings save in the browser. */
export class OptionsScene implements Scene {
  sel = 0;
  /** Phone layout tab: 0 sound, 1 touch controls. Wider screens show the touch controls as a page of their own. */
  tab = 0;
  /** The row picked on the wide touch controls page. */
  tsel = 0;
  constructor(private back: () => void = popScene) {}
  pad(): PadMode { return 'back'; }

  update(dt: number): void {
    
    if (this.tab === 1) { this.updateTouch(dt); return; }
    const ROWS = rows();
    this.sel = Math.min(this.sel, ROWS.length - 1);
    if (navPressed('up', dt)) { this.sel = (this.sel + ROWS.length - 1) % ROWS.length; sfx('move'); }
    if (navPressed('down', dt)) { this.sel = (this.sel + 1) % ROWS.length; sfx('move'); }
    if (wasPressed('back') || mouse.rclick) { sfx('back'); this.back(); return; }
    const s = getAudioSettings();

    // mouse: a volume block sets that level, the arrows step it, a row click acts like OK
    const block = hot('block');
    if (block >= 0 && (mouse.click || (mouse.down && mouse.moved))) {
      const row = rows()[Math.floor(block / 100)][0];
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
      const row = rows()[step >> 1][0];
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
    if (ok && row === 'touch') { this.tab = 1; this.tsel = 0; sfx('select'); }
    if (ok && row === 'back') { sfx('back'); this.back(); }
  }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    drawStage(c, getArena(), tick);
    c.fillStyle = 'rgba(40,20,0,0.35)';
    c.fillRect(...screenRect());
    
    win(ui, PX - 16, 18, PW + 32, 262);
    if (this.tab === 1) { this.drawTouchWide(ui, tick); return; }
    drawTextCentered(ui, 'OPTIONS', UW / 2, 30, RED_INK, 2, false);
    const s = getAudioSettings(), RH = rowH();
    rows().forEach(([row, label], i) => {
      const y = rowY(i), rh = RH, off = Math.round((rh - RH) / 2);
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
      if (row === 'keys' || row === 'touch') drawText(ui, '→', BAR_X, ty, TRIM);
    });
    hint(ui, `CLICK OR DRAG THE BARS   ${k('left')}/${k('right')}: ADJUST   ${k('cast')} / RIGHT-CLICK: BACK`);
  }

  /** The touch controls page on wider screens (phones on their side): the same settings as the phone layout's TOUCH tab. */
  private updateTouch(dt: number): void {
    const n = TOUCH_ROWS.length;
    if (navPressed('up', dt)) { this.tsel = (this.tsel + n - 1) % n; sfx('move'); }
    if (navPressed('down', dt)) { this.tsel = (this.tsel + 1) % n; sfx('move'); }
    const leave = (): void => { this.tab = 0; this.sel = rows().findIndex(([r]) => r === 'touch'); sfx('back'); };
    if (wasPressed('back') || mouse.rclick) { leave(); return; }
    const size = hot('tsize');
    if (size >= 0 && mouse.click) { setTouchSettings({ size: SIZES[size] }); sfx('select'); return; }
    const clicked = listMouse('trow', this.tsel, i => { this.tsel = i; sfx('move'); });
    if (clicked >= 0) this.tsel = clicked;
    const row = TOUCH_ROWS[this.tsel][0], t = getTouchSettings();
    const l = navPressed('left', dt), r = navPressed('right', dt), ok = wasPressed('confirm') || clicked >= 0;
    if (row === 'size' && (l || r || ok)) { setTouchSettings({ size: SIZES[(SIZES.indexOf(t.size) + (l ? 2 : 1)) % 3] }); sfx('move'); }
    if (row === 'left' && (l || r || ok)) { setTouchSettings({ left: !t.left }); sfx('select'); }
    if (row === 'buzz' && (l || r || ok)) {
      setTouchSettings({ buzz: !t.buzz });
      if (!t.buzz) { try { navigator.vibrate?.(30); } catch { /* not allowed */ } }
      sfx('select');
    }
    if (row === 'back' && ok) leave();
  }

  private drawTouchWide(ui: Ctx, tick: number): void {
    drawTextCentered(ui, 'TOUCH CONTROLS', UW / 2, 30, RED_INK, 2, false);
    const t = getTouchSettings();
    TOUCH_ROWS.forEach(([row, label], i) => {
      const y = Y0 + i * 22 + (row === 'back' ? 8 : 0), on = i === this.tsel && showSel(), ty = y + 7;
      zone(`trow:${i}`, PX - 12, y, PW + 24, 20);
      if (on) selRow(ui, PX - 12, y, PW + 24, 20);
      if (on && tick % 8 < 6) drawText(ui, '→', PX - 4, ty, PAPER);
      drawText(ui, label, PX + 10, ty, on ? INK : INK2);
      if (row === 'size') SIZES.forEach((sz, n) => {
        const x = BAR_X + n * 56;
        zone(`tsize:${n}`, x - 4, y, 52, 20);
        drawText(ui, ['SMALL', 'MEDIUM', 'LARGE'][n], x, ty, t.size === sz ? RED_INK : isHot(`tsize:${n}`) ? INK : TRIM);
      });
      if (row === 'left') drawText(ui, t.left ? 'ON' : 'OFF', BAR_X, ty, t.left ? '#007800' : INK);
      if (row === 'buzz') drawText(ui, t.buzz ? 'ON' : 'OFF', BAR_X, ty, t.buzz ? '#007800' : INK);
    });
    const py = Y0 + TOUCH_ROWS.length * 22 + 16, ph = 272 - py;
    drawText(ui, 'LEFT-HANDED: BUTTONS ON THE LEFT, D-PAD ON THE RIGHT', PX + 10, py - 4, TRIM);
    if (ph >= 80) this.drawPadPreview(ui, UW / 2 - ph * 0.8, py + 8, ph * 1.6, ph - 8, t);
    hint(ui, `CLICK OR ${k('attack')}: CHANGE   ${k('left')}/${k('right')}: ADJUST   ${k('cast')} / RIGHT-CLICK: BACK`);
  }

  /** A little phone showing where the fight pad sits with these settings. */
  private drawPadPreview(ui: Ctx, x: number, y: number, w: number, h: number, t: ReturnType<typeof getTouchSettings>): void {
    P(ui, '#000000', x, y, w, h);
    P(ui, FRAME, x + 2, y + 2, w - 4, h - 4);
    const sx = x + 10, sw = w - 20, sh = Math.round(h * 0.38);
    P(ui, '#1c2a5c', sx, y + 10, sw, sh);
    P(ui, '#3c5c2c', sx, y + 10 + Math.round(sh * 0.7), sw, sh - Math.round(sh * 0.7));
    drawTextCentered(ui, 'FIGHT', sx + sw / 2, y + 10 + Math.round(sh * 0.35) - 3, PAPER2, 1, false);
    const k = { S: 0.82, M: 1, L: 1.16 }[t.size];
    const below = h - sh - 20, size = Math.round(Math.min(below * 0.78, sw * 0.4) * k / 1.16);
    const cy = y + 10 + sh + Math.round(below / 2) + 2;
    let dx = sx + 8 + size / 2, ax = sx + sw - 8 - size / 2;
    if (t.left) [dx, ax] = [ax, dx];
    const arm = Math.round(size / 3);
    P(ui, '#fce0a8', Math.round(dx - arm / 2) - 2, Math.round(cy - size / 2) - 2, arm + 4, size + 4);
    P(ui, '#fce0a8', Math.round(dx - size / 2) - 2, Math.round(cy - arm / 2) - 2, size + 4, arm + 4);
    P(ui, '#8c6020', Math.round(dx - arm / 2), Math.round(cy - size / 2), arm, size);
    P(ui, '#8c6020', Math.round(dx - size / 2), Math.round(cy - arm / 2), size, arm);
    const d = size * 0.48;
    const dot = (cx: number, cyy: number, col: string): void => {
      ui.fillStyle = '#fce0a8'; ui.beginPath(); ui.arc(cx, cyy, d / 2 + 2, 0, Math.PI * 2); ui.fill();
      ui.fillStyle = col; ui.beginPath(); ui.arc(cx, cyy, d / 2, 0, Math.PI * 2); ui.fill();
    };
    dot(ax + size / 2 - d / 2, cy - size / 2 + d / 2, '#a81000');
    dot(ax - size / 2 + d / 2, cy + size / 2 - d / 2, '#0028a8');
  }
}
