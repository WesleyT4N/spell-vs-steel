import { setScene, hint, zone, hot, isHot, listMouse, showSel, type Scene } from './scene';
import { getArena } from '../game/battleView';
import { drawStage } from '../art/arena';
import { P, UW, screenRect, vy, vspan, spread, type Ctx } from '../engine/gfx';
import { getTouchSettings, setTouchSettings, type PadMode, type PadSize } from '../engine/touch';
import { bigButton, actionBar, barTapped, tabs, panel, swipeIn, tallArea, TAP, GAP, PAD } from './touchUi';
import { drawText, drawTextCentered } from '../engine/font';
import { wasPressed, navPressed, k, mouse } from '../engine/input';
import { sfx, getAudioSettings, setAudioSettings, isMuted, toggleMute, voiceLine, announce } from '../engine/audio';
import { PLAYABLE } from '../game/classes';
import { ControlsScene } from './controls';
import { win, selRow, PAPER, PAPER2, BURN, INK, INK2, RED_INK, TRIM, FRAME } from './skin';

type Row = 'master' | 'musicOn' | 'music' | 'sfxOn' | 'sfx' | 'voice' | 'announcer' | 'mute' | 'keys' | 'back';
const ROWS: Array<[Row, string]> = [
  ['master', 'MASTER VOLUME'],
  ['musicOn', 'MUSIC'],
  ['music', 'MUSIC VOLUME'],
  ['sfxOn', 'SOUND FX'],
  ['sfx', 'SFX VOLUME'],
  ['voice', 'CHARACTER VOICES'],
  ['announcer', 'ANNOUNCER VOICE'],
  ['mute', 'MUTE ALL (M)'],
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
const PX = 64, PW = UW - 128, Y0 = 56, RH = 20, BAR_X = 236, BLOCK = 14;
const rowY = (i: number): number => Y0 + i * RH + (i >= 8 ? 10 : 0);
// phone portrait spreads the rows into the spare height (vy); `off` centers a row's contents in its taller box

/** Audio settings and a door to the key mapping screen. Settings save in the browser. */
export class OptionsScene implements Scene {
  sel = 0;
  /** Phone layout tab: 0 sound, 1 touch controls. */
  tab = 0;
  private tabRect: [number, number, number, number] = [0, 0, 0, 0];
  constructor(private back: () => void) {}

  tall(): boolean { return true; }
  pad(): PadMode { return spread.tall ? 'none' : 'back'; }

  /** Taps on the phone layout; true when it handled this frame. */
  private tallInput(): boolean {
    if (barTapped('back')) { sfx('back'); this.back(); return true; }
    const t = hot('otab');
    const sw = swipeIn(...this.tabRect);
    if ((t >= 0 && mouse.click && t !== this.tab) || sw) { this.tab = sw ? (this.tab + 1) % 2 : t; sfx('move'); return true; }
    if (!mouse.click) return false;
    const s = getAudioSettings();
    if (isHot('tog:musicOn') || isHot('tog:sfxOn')) {
      const row = isHot('tog:musicOn') ? 'musicOn' : 'sfxOn';
      setAudioSettings({ [row]: !s[row] }); sfx('select'); return true;
    }
    if (isHot('tog:mute')) { toggleMute(); sfx('select'); return true; }
    const size = hot('tsize');
    if (size >= 0) { setTouchSettings({ size: (['S', 'M', 'L'] as PadSize[])[size] }); sfx('select'); return true; }
    if (isHot('tog:left')) { setTouchSettings({ left: !getTouchSettings().left }); sfx('select'); return true; }
    if (isHot('tog:buzz')) {
      const on = !getTouchSettings().buzz;
      setTouchSettings({ buzz: on });
      if (on) { try { navigator.vibrate?.(30); } catch { /* not allowed */ } }
      sfx('select'); return true;
    }
    return false;
  }

  update(dt: number): void {
    if (spread.tall && this.tallInput()) return;
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
    if (ok && row === 'keys') { sfx('select'); setScene(new ControlsScene(() => setScene(this))); }
    if (ok && row === 'back') { sfx('back'); this.back(); }
  }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    drawStage(c, getArena(), tick);
    c.fillStyle = 'rgba(40,20,0,0.35)';
    c.fillRect(...screenRect());
    if (spread.tall) { this.drawTall(ui); return; }
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
      if (row === 'keys') drawText(ui, '→', BAR_X, ty, TRIM);
    });
    hint(ui, `CLICK OR DRAG THE BARS   ${k('left')}/${k('right')}: ADJUST   ${k('cast')} / RIGHT-CLICK: BACK`);
  }

  /** The phone layout: sound and touch settings on two tabs, with finger-sized sliders and switches. */
  private drawTall(ui: Ctx): void {
    const a = tallArea(), x0 = a.x + PAD, w = a.w - PAD * 2;
    let y = a.y + PAD;
    drawTextCentered(ui, 'OPTIONS', UW / 2, y, PAPER, 3, true);
    y += 21 + GAP;
    tabs(ui, 'otab', ['SOUND', 'TOUCH'], this.tab, x0, y, w);
    // swiping the tabs flips them; not the panel, where fingers drag the volume sliders
    this.tabRect = [a.x, a.y, a.w, y + 48 - a.y];
    y += 48 + GAP;
    const barTop = actionBar(ui, {});
    panel(ui, x0 - 6, y, w + 12, barTop - GAP - y);
    y += 16;
    const room = barTop - GAP - 12 - y;
    if (this.tab === 0) this.drawSound(ui, x0 + 8, y, w - 16, room);
    else this.drawTouch(ui, x0 + 8, y, w - 16, room);
  }

  /** One labelled row: the label in ink on the left, a switch on the right when `toggle` is given. */
  private toggleRow(ui: Ctx, id: string, label: string, on: boolean, x: number, y: number, w: number, onText = 'ON', offText = 'OFF'): void {
    drawText(ui, label, x, y + Math.round((TAP - 14) / 2), INK, 2);
    bigButton(ui, `tog:${id}`, on ? onText : offText, x + w - 110, y, 110, TAP, { primary: on });
  }

  private drawSound(ui: Ctx, x: number, y: number, w: number, room: number): void {
    const s = getAudioSettings();
    // each volume: label (with its switch for music and sfx), then a row of ten tall blocks between - and +
    const vols: Array<[Vol, string, ('musicOn' | 'sfxOn')?]> = [
      ['master', 'MASTER'], ['music', 'MUSIC', 'musicOn'], ['sfx', 'SOUND FX', 'sfxOn'],
      ['voice', 'VOICES'], ['announcer', 'ANNOUNCER'],
    ];
    const per = Math.min(136, Math.floor((room - TAP - GAP) / vols.length));
    const sh = Math.max(40, Math.min(TAP, per - 50));
    for (const [row, label, sw] of vols) {
      const i = ROWS.findIndex(r => r[0] === row);
      const live = isLive(row, s);
      if (sw) {
        drawText(ui, label, x, y + 6, live ? INK : INK2, 2);
        bigButton(ui, `tog:${sw}`, s[sw] ? 'ON' : 'OFF', x + w - 84, y - 4, 84, 32, { primary: s[sw], scale: 2 });
      } else drawText(ui, label, x, y + 6, INK, 2);
      drawText(ui, String(s[row]), x + w - (sw ? 104 : 0) - (s[row] > 9 ? 28 : 14), y + 6, live ? INK : TRIM, 2);
      const sy = y + 34;
      bigButton(ui, `step:${i * 2}`, '-', x, sy, sh, sh);
      bigButton(ui, `step:${i * 2 + 1}`, '+', x + w - sh, sy, sh, sh);
      const bx = x + sh + 8, bw = (w - sh * 2 - 16) / 10;
      P(ui, BURN, bx, sy, w - sh * 2 - 16, sh);
      for (let n = 0; n < 10; n++) {
        const lx = Math.round(bx + n * bw);
        zone(`block:${i * 100 + n}`, lx, sy - 8, Math.round(bw), sh + 16);
        // blocks rise left to right, like a volume wedge
        const bh = Math.round(sh * (0.45 + 0.55 * (n + 1) / 10));
        P(ui, n < s[row] ? (live ? RED_INK : TRIM) : PAPER, lx + 2, sy + sh - bh - 2, Math.round(bw) - 4, bh);
      }
      y += Math.max(per, sh + 44);
    }
    y += 4;
    this.toggleRow(ui, 'mute', 'MUTE ALL', isMuted(), x, y, w);
  }

  private drawTouch(ui: Ctx, x: number, y: number, w: number, room: number): void {
    const t = getTouchSettings(), y0 = y;
    drawText(ui, 'PAD SIZE', x, y + 2, INK, 2);
    y += 24;
    const bw = (w - GAP * 2) / 3;
    (['S', 'M', 'L'] as PadSize[]).forEach((sz, i) =>
      bigButton(ui, `tsize:${i}`, ['SMALL', 'MEDIUM', 'LARGE'][i], x + i * (bw + GAP), y, bw, TAP, { primary: t.size === sz }));
    y += TAP + GAP * 3;
    this.toggleRow(ui, 'left', 'LEFT-HANDED', t.left, x, y, w);
    drawText(ui, 'BUTTONS ON THE LEFT, D-PAD ON THE RIGHT', x, y + TAP + 6, INK2, 1);
    y += TAP + GAP * 3 + 8;
    this.toggleRow(ui, 'buzz', 'VIBRATION', t.buzz, x, y, w);
    drawText(ui, 'A SHORT BUZZ ON EACH PAD PRESS', x, y + TAP + 6, INK2, 1);
    y += TAP + GAP * 3 + 8;
    drawText(ui, 'SWIPE IN FROM THE LEFT EDGE TO GO BACK', x, y, INK2, 1);
    drawText(ui, 'ON ANY SCREEN.', x, y + 12, INK2, 1);
    y += 34;
    const ph = Math.min(300, y0 + room - y);
    if (ph >= 140) this.drawPadPreview(ui, x, y, w, ph, t);
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
