// MODS (title > MODS): every installed mod, shipped with the game or imported, with its skins. Each can be switched
// on or off (kept in the save); imported ones can be deleted; IMPORT opens a file picker / paste box (modPanel.ts).
// Mod skins show up as extra colors on the fighter select.
import { popScene, hint, zone, hot, isHot, showSel, type Scene } from './scene';
import { actionBar, barTapped, bigButton, panel, rowList, tallArea, Scroller, GAP, PAD, TAP } from './touchUi';
import { openModPanel } from './modPanel';
import { MODS, setModOn, removeMod, type ModEntry } from '../mods';
import { getArena } from '../game/battleView';
import { drawStage } from '../art/arena';
import { getFrame, drawFighterSprite, type ClassId } from '../art/sprites';
import { CLASS_INFO } from '../game/classes';
import { UW, screenRect, spread, vy, vspan, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered, textWidth, wrap } from '../engine/font';
import { wasPressed, navPressed, k, mouse, usingPad } from '../engine/input';
import { type PadMode } from '../engine/touch';
import { sfx } from '../engine/audio';
import { win, banner, selRow, plaque, INK, INK2, RED_INK, TRIM, PAPER } from './skin';

/** Buttons under the list on desktop, left to right. */
const BTNS = ['IMPORT', 'DELETE', 'BACK'] as const;
type Btn = typeof BTNS[number];
const ON_INK = '#007800';
const RH = 18, SHOWN = 9, TROW = 74;

const title = (e: ModEntry): string => (e.mod?.name ?? e.id).toUpperCase();
const sourceText = (e: ModEntry): string => (e.source === 'built-in' ? 'INCLUDED WITH THE GAME' : 'IMPORTED');
/** One line per skin: "WIZARD (MAGE)". */
const skinText = (e: ModEntry): string[] => (e.mod?.skins ?? []).map(s => `${s.name.toUpperCase()} (${CLASS_INFO[s.cls as ClassId]?.name.toUpperCase() ?? s.cls})`);
/** Where a mod's skins show up, and whether they bring their own voices. */
const footText = (e: ModEntry): string => (e.mod?.skins.some(s => s.voice) ? 'SKINS AND VOICES ON THE FIGHTER SELECT' : 'EXTRA SKINS ON THE FIGHTER SELECT');

export class ModsScene implements Scene {
  /** The mod under the cursor. */
  cur = 0;
  /** Keyboard / gamepad focus: a list row (-1) or one of the buttons below it. */
  btn = -1;
  msg = '';
  msgT = 0;
  /** DELETE pressed once on this mod: the next press deletes it. */
  armed: string | null = null;
  private closePanel: (() => void) | null = null;
  private top = 0;
  private tscroll = new Scroller();
  private tlist: [number, number, number, number] = [0, 0, 0, 0];

  tall(): boolean { return true; }
  pad(): PadMode { return spread.tall ? 'none' : 'back'; }
  exit(): void { this.closePanel?.(); }

  private get entry(): ModEntry | undefined { return MODS[this.cur]; }
  private say(s: string): void { this.msg = s; this.msgT = 3; }

  private toggle(e: ModEntry | undefined): void {
    if (!e) return;
    if (!e.mod) { sfx('deny'); this.say('THIS FILE FAILED THE MOD CHECKS'); return; }
    setModOn(e.id, !e.on);
    sfx('select');
    this.say(e.on ? `${title(e)} IS ON` : `${title(e)} IS OFF`);
  }

  private openImport(): void {
    sfx('select');
    this.closePanel = openModPanel({
      onImport: e => { this.cur = MODS.indexOf(e); this.btn = -1; this.reveal(); sfx('confirm'); this.say(`IMPORTED ${title(e)}`); },
      onClose: () => { this.closePanel = null; },
      pad: usingPad(),
    });
  }

  private del(e: ModEntry | undefined): void {
    if (!e) return;
    if (e.source !== 'imported') { sfx('deny'); this.say('MODS THAT COME WITH THE GAME CAN ONLY BE SWITCHED OFF'); return; }
    if (this.armed !== e.id) { this.armed = e.id; sfx('move'); this.say('PRESS DELETE AGAIN TO REMOVE IT'); return; }
    removeMod(e.id);
    this.armed = null;
    this.cur = Math.max(0, Math.min(this.cur, MODS.length - 1));
    sfx('back');
    this.say(`DELETED ${title(e)}`);
  }

  private press(b: Btn): void {
    if (b === 'IMPORT') this.openImport();
    else if (b === 'DELETE') this.del(this.entry);
    else { sfx('back'); popScene(); }
  }

  private reveal(): void {
    if (this.cur < this.top) this.top = this.cur;
    if (this.cur >= this.top + SHOWN) this.top = this.cur - SHOWN + 1;
    this.tscroll.reveal(this.cur * (TROW + 6), TROW + 8, this.tlist[3]);
  }

  private pick(i: number): void {
    if (i === this.cur) return;
    this.cur = i; this.armed = null; this.reveal(); sfx('move');
  }

  update(dt: number): void {
    this.msgT = Math.max(0, this.msgT - dt);
    if (this.closePanel) {
      // the panel takes keys and clicks; a pad's B still closes it
      if (wasPressed('back')) this.closePanel();
      return;
    }
    const n = MODS.length;
    if (spread.tall) {
      if (barTapped('back')) { sfx('back'); popScene(); return; }
      if (barTapped('primary')) { this.openImport(); return; }
      if (barTapped('mid')) { this.toggle(this.entry); return; }
      if (mouse.click && isHot('tdel')) { this.del(this.entry); return; }
      this.tscroll.update(...this.tlist);
      const i = hot('trow');
      if (mouse.click && i >= 0) { if (i === this.cur) this.toggle(this.entry); else this.pick(i); return; }
    }
    if (wasPressed('back') || mouse.rclick) { sfx('back'); popScene(); return; }
    // mouse: rows pick, their switch toggles; the buttons below
    if (!spread.tall) {
      if (mouse.wheel && n > SHOWN) this.top = Math.max(0, Math.min(n - SHOWN, this.top + Math.sign(mouse.wheel)));
      const sw = hot('sw'), row = hot('row'), b = hot('mb');
      if (mouse.click && sw >= 0) { this.pick(sw); this.toggle(MODS[sw]); return; }
      if (mouse.moved && row >= 0 && row !== this.cur) { this.pick(row); this.btn = -1; }
      if (mouse.moved && b >= 0) this.btn = b;
      if (mouse.click && row >= 0) { if (row === this.cur) this.toggle(this.entry); else this.pick(row); return; }
      if (mouse.click && b >= 0) { this.press(BTNS[b]); return; }
    }
    // keys and pads: up and down through the list and onto the buttons, left and right along them
    if (navPressed('up', dt)) {
      if (this.btn >= 0) { this.btn = -1; if (!n) this.btn = 0; }
      else if (n) this.pick((this.cur + n - 1) % n);
      sfx('move');
    }
    if (navPressed('down', dt)) {
      if (this.btn < 0 && n && this.cur < n - 1) this.pick(this.cur + 1);
      else this.btn = Math.max(0, this.btn);
      sfx('move');
    }
    if (this.btn >= 0 && navPressed('left', dt)) { this.btn = (this.btn + BTNS.length - 1) % BTNS.length; sfx('move'); }
    if (this.btn >= 0 && navPressed('right', dt)) { this.btn = (this.btn + 1) % BTNS.length; sfx('move'); }
    if (wasPressed('custom')) { this.openImport(); return; }
    if (wasPressed('confirm')) {
      if (this.btn >= 0 || !n) this.press(BTNS[Math.max(0, this.btn)]);
      else this.toggle(this.entry);
    }
  }

  /** A mod's skins, drawn standing in a row (only while it is on: a switched-off skin is not loaded). */
  private skins(ui: Ctx, e: ModEntry, cx: number, foot: number, scale: number, gap: number, tick: number): void {
    const list = e.mod?.skins ?? [];
    const x0 = cx - ((list.length - 1) * gap) / 2;
    list.forEach((s, i) => {
      const x = x0 + i * gap;
      if (e.on && !e.refused.includes(`${s.cls}:${s.id}`)) {
        const f = (['idle0', 'idle1', 'idle2', 'idle3'] as const)[Math.floor(tick / 8 + i) % 4];
        drawFighterSprite(ui, getFrame(s.cls as ClassId, s.id, false, f), x, foot, false, 'none', scale);
      } else drawTextCentered(ui, 'OFF', x, foot - 30, TRIM, Math.min(2, scale), false);
      drawTextCentered(ui, s.name.toUpperCase(), x, foot + 6, INK, Math.min(2, scale), false);
    });
  }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    drawStage(c, getArena(), tick);
    c.fillStyle = 'rgba(40,20,0,0.35)';
    c.fillRect(...screenRect());
    if (spread.tall) { this.drawTall(ui, tick); return; }
    banner(ui, 'MODS', UW / 2, vy(3));
    const top = vy(36), h = vspan(36, 236), lx = 16, lw = 196, dx = lx + lw + 8, dw = UW - 16 - dx;
    // the list
    win(ui, lx, top, lw, h);
    const n = MODS.length;
    if (!n) {
      drawTextCentered(ui, 'NO MODS YET', lx + lw / 2, top + 30, RED_INK, 2, false);
      wrap('IMPORT ONE TO ADD NEW SKINS FOR THE FIGHTERS.', 28).forEach((l, i) => drawTextCentered(ui, l, lx + lw / 2, top + 56 + i * 10, INK2, 1, false));
    }
    for (let j = 0; j < Math.min(SHOWN, n); j++) {
      const i = this.top + j, e = MODS[i];
      if (!e) break;
      const y = top + 8 + j * (RH + 2), on = i === this.cur;
      zone(`row:${i}`, lx + 4, y, lw - 48, RH);
      if (on) selRow(ui, lx + 4, y, lw - 8, RH);
      if (on && this.btn < 0 && showSel() && tick % 8 < 6) drawText(ui, '→', lx + 8, y + 6, PAPER);
      const name = title(e), max = Math.floor((lw - 70) / 6);
      drawText(ui, name.length > max ? `${name.slice(0, max - 1)}.` : name, lx + 20, y + 6, e.mod ? INK : RED_INK);
      // the switch
      zone(`sw:${i}`, lx + lw - 42, y + 1, 36, RH - 2);
      const label = !e.mod ? 'BAD' : e.on ? 'ON' : 'OFF';
      const ink = plaque(ui, lx + lw - 42, y + 1, 36, RH - 2, e.on || isHot(`sw:${i}`));
      drawTextCentered(ui, label, lx + lw - 24, y + 6, e.on ? ink : !e.mod ? RED_INK : INK2, 1, false);
    }
    if (this.top > 0) drawTextCentered(ui, '↑', lx + lw / 2, top + 1, INK2, 1, false);
    if (this.top + SHOWN < n) drawTextCentered(ui, '↓', lx + lw / 2, top + h - 9, INK2, 1, false);

    // the mod under the cursor
    win(ui, dx, top, dw, h);
    const e = this.entry, mx = dx + dw / 2;
    if (e) {
      drawTextCentered(ui, title(e), mx, top + 10, INK, textWidth(title(e), 2) <= dw - 16 ? 2 : 1, false);
      drawTextCentered(ui, e.mod?.author ? `BY ${e.mod.author.toUpperCase()}` : sourceText(e), mx, top + 30, INK2, 1, false);
      if (e.mod?.author) drawTextCentered(ui, sourceText(e), mx, top + 42, TRIM, 1, false);
      if (e.mod) {
        drawTextCentered(ui, e.on ? 'ON' : 'OFF', mx, top + 56, e.on ? ON_INK : RED_INK, 1, false);
        const n = e.mod.skins.length, sc = n > 3 ? 1 : n > 1 ? 2 : 4, gap = n > 1 ? Math.min(90, (dw - 50) / (n - 1)) : 0;
        this.skins(ui, e, mx, top + h - 56, sc, gap, tick);
        const lines = skinText(e);
        drawTextCentered(ui, `${lines.length} SKIN${lines.length === 1 ? '' : 'S'}: ${lines.join(', ')}`.slice(0, 38), mx, top + h - 26, INK2, 1, false);
        drawTextCentered(ui, footText(e), mx, top + h - 14, TRIM, 1, false);
        if (e.refused.length) drawTextCentered(ui, `ALREADY TAKEN: ${e.refused.join(', ')}`.toUpperCase().slice(0, 38), mx, top + 68, RED_INK, 1, false);
      } else {
        drawTextCentered(ui, 'THIS FILE FAILED THE MOD CHECKS:', mx, top + 60, RED_INK, 1, false);
        wrap((e.error ?? '').toUpperCase(), 36).slice(0, 8).forEach((l, i) => drawTextCentered(ui, l, mx, top + 76 + i * 10, INK2, 1, false));
      }
    }

    // the buttons
    const by = vy(280), bw = 96;
    BTNS.forEach((b, i) => {
      const dis = b === 'DELETE' && e?.source !== 'imported';
      const label = b === 'BACK' ? '← BACK' : b === 'DELETE' && this.armed && this.armed === e?.id ? 'SURE?' : b;
      zone(`mb:${i}`, UW / 2 - (bw * 3 + 16) / 2 + i * (bw + 8), by, bw, 20);
      const lit = (i === this.btn && showSel()) || isHot(`mb:${i}`);
      const ink = plaque(ui, UW / 2 - (bw * 3 + 16) / 2 + i * (bw + 8), by, bw, 20, lit);
      drawTextCentered(ui, label, UW / 2 - (bw * 3 + 16) / 2 + i * (bw + 8) + bw / 2, by + 7, dis ? TRIM : lit ? ink : INK, 1, false);
    });
    if (this.msgT > 0) drawTextCentered(ui, this.msg.slice(0, 38), dx + dw / 2, top + 80, RED_INK, 1, false);
    hint(ui, `${k('attack')}: SWITCH ON / OFF   ${k('custom')}: IMPORT   ${k('cast')}: BACK`);
  }

  /** The phone layout: big mod rows (tap one to pick it, again to switch it), its skins below, IMPORT in the bar. */
  private drawTall(ui: Ctx, tick: number): void {
    const a = tallArea(), x0 = a.x + PAD, w = a.w - PAD * 2, cx = UW / 2;
    let y = a.y + PAD;
    drawTextCentered(ui, 'MODS', cx, y, PAPER, 3, true);
    y += 21 + GAP * 2;
    const e = this.entry;
    const barTop = actionBar(ui, {
      primary: { id: 'import', label: 'IMPORT +' },
      ...(e?.mod ? { mid: { id: 'onoff', label: e.on ? 'MOD ON' : 'MOD OFF', on: e.on } } : {}),
    });
    const detailH = 250, dTop = barTop - GAP * 2 - detailH;
    const lh = dTop - GAP * 3 - y;
    this.tlist = [x0, y, w, lh];
    if (!MODS.length) {
      panel(ui, x0 - 6, y, w + 12, 150);
      drawTextCentered(ui, 'NO MODS YET', cx, y + 40, RED_INK, 3, false);
      drawTextCentered(ui, 'IMPORT ONE TO ADD NEW', cx, y + 84, INK2, 2, false);
      drawTextCentered(ui, 'SKINS FOR THE FIGHTERS.', cx, y + 104, INK2, 2, false);
      return;
    }
    rowList(ui, this.tscroll, 'trow', MODS.length, this.cur, x0, y, w, lh, TROW, (i, rx, ry, rw) => {
      const it = MODS[i], state = !it.mod ? 'BAD FILE' : it.on ? 'ON' : 'OFF';
      const name = title(it), max = Math.floor((rw - 40 - textWidth(state, 2)) / 12);
      drawText(ui, name.length > max ? `${name.slice(0, max - 1)}.` : name, rx + 14, ry + 16, it.mod ? INK : RED_INK, 2);
      drawText(ui, state, rx + rw - 14 - textWidth(state, 2), ry + 16, !it.mod ? RED_INK : it.on ? ON_INK : INK2, 2);
      drawText(ui, it.source === 'built-in' ? 'WITH THE GAME' : 'IMPORTED', rx + 14, ry + 44, INK2, 2);
    });

    // the picked mod
    panel(ui, x0 - 6, dTop, w + 12, detailH);
    if (!e) return;
    drawTextCentered(ui, title(e), cx, dTop + 18, INK, textWidth(title(e), 3) <= w - 24 ? 3 : 2, false);
    drawTextCentered(ui, e.mod?.author ? `BY ${e.mod.author.toUpperCase()}` : sourceText(e), cx, dTop + 48, INK2, 2, false);
    if (e.mod) {
      const n = e.mod.skins.length, gap = n > 1 ? Math.min(150, (w - 80) / (n - 1)) : 0;
      this.skins(ui, e, cx, dTop + 180, n > 3 ? 2 : n > 1 ? 3 : 5, gap, tick);
      drawTextCentered(ui, footText(e), cx, dTop + detailH - 24, TRIM, 1, false);
    } else {
      wrap((e.error ?? '').toUpperCase(), 28).slice(0, 6).forEach((l, i) => drawTextCentered(ui, l, cx, dTop + 80 + i * 20, RED_INK, 2, false));
    }
    if (e.source === 'imported') bigButton(ui, 'tdel', this.armed === e.id ? 'SURE?' : 'DELETE', x0 + w - 110, dTop + 14, 104, TAP - 14, { scale: 2 });
    if (this.msgT > 0) drawTextCentered(ui, this.msg, cx, dTop - 18, PAPER, 1, true);
  }
}
