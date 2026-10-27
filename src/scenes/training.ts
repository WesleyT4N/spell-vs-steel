// Training mode: a fight that never ends, for testing decks. The dummy's behavior, both sides' HP and
// resources, and the Draw gauge are set from the pause menu; R puts both fighters back to the start of the turn.
import { getSave, setSave } from '../engine/save';
import { replaceScene, popTo, goHome, dim, hint, zone, hot, showSel, drawMenu, listMouse } from './scene';
import { clearStats } from '../game/stats';
import type { StatsData } from './statsView';
import { NO_INTENT, heavyChargeOf, type Battle, type Dir, type Fighter, type Intent } from '../game/battle';
import { Cpu } from '../game/ai';
import { CARDS } from '../game/cards';
import { CLASS_INFO } from '../game/classes';
import { TUNING } from '../game/tuning';
import type { MatchConfig } from '../game/match';
import { UW, spread, screenRect, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered, textWidth } from '../engine/font';
import { wasPressed, navPressed, k, mouse } from '../engine/input';
import { touchActive } from '../engine/touch';
import { sfx, stopMusic } from '../engine/audio';
import { BattleScene } from './battle';
import { CharSelectScene } from './select';
import { win, selRow, banner, PAPER, INK, INK2, RED_INK, TRIM } from './skin';
import { bigButton, actionBar, barTapped, panel, tallArea, Scroller, TAP, GAP, PAD } from './touchUi';

type DummyAct = 'stand' | 'move' | 'dodge' | 'attack' | 'easy' | 'normal';
type HpMode = 'refill' | 'normal';
/** 'normal' plays by the class rules; 'full' keeps the bar topped up; a number pins it there. */
type ResMode = 'normal' | 'full' | 0 | 1 | 2 | 3 | 4 | 5;

interface Settings {
  act: DummyAct;
  spells: boolean;
  hp: [HpMode, HpMode];
  res: [ResMode, ResMode];
  gauge: 'normal' | 'full';
}

const ACTS: Array<[DummyAct, string]> = [['stand', 'STAND'], ['move', 'MOVE'], ['dodge', 'DODGE'], ['attack', 'ATTACK'], ['easy', 'CPU EASY'], ['normal', 'CPU NORMAL']];
const RES: ResMode[] = ['normal', 'full', 0, 1, 2, 3, 4, 5];
/** Seconds without a hit before a Refill HP bar tops back up. */
const REFILL_AFTER = 2;
/** How long LAST HIT stays lit after a hit. */
const HIT_GLOW = 1.5;

function loadSettings(): Settings {
  const def: Settings = { act: 'stand', spells: false, hp: ['refill', 'refill'], res: ['normal', 'normal'], gauge: 'normal' };
  return { ...def, ...(getSave('training') as Partial<Settings> | null) };
}
function saveSettings(s: Settings): void {
  setSave('training', { ...s });
}

/** The training dummy: simple scripted behaviors, or the real CPU at either level. */
class Dummy extends Cpu {
  private t = 0;
  private swings = 0;
  private charging = false;
  private castT = 0;

  constructor(public act: DummyAct, public spells: boolean) { super(act === 'easy' ? 'easy' : 'normal'); }

  intent(b: Battle, f: Fighter, dt: number): Intent {
    if (b.phase !== 'fight' || f.dead) { this.charging = false; return NO_INTENT; }
    if (this.act === 'easy' || this.act === 'normal') {
      const out = super.intent(b, f, dt);
      return this.spells ? out : { ...out, castPressed: false };
    }
    const out: Intent = { ...NO_INTENT };
    this.t -= dt;
    this.castT -= dt;
    // with spells on, the scripted dummies cast whatever is next as soon as they can pay for it
    const top = f.queue[0] ? CARDS[f.queue[0]] : null;
    if (this.spells && top && this.castT <= 0 && f.castCd <= 0 && b.canAfford(f, top)) { out.castPressed = true; this.castT = 1.5; }

    if (this.act === 'dodge') {
      if (this.inDanger(b, f)) { const d = this.safeStep(b, f); if (d) out.move = d; }
    } else if (this.act === 'move') {
      if (this.t <= 0) {
        this.t = 0.5 + Math.random() * 0.5;
        const dirs: Dir[] = ['up', 'down', 'left', 'right'];
        out.move = dirs[Math.floor(Math.random() * 4)];
      }
    } else if (this.act === 'attack') {
      if (this.charging) {
        out.attackHeld = true;
        if (f.charge >= heavyChargeOf(f) + 0.1 || !f.charging) { out.attackHeld = false; this.charging = false; }
      } else if (this.t <= 0) {
        // follow your row (melee classes close in), swing, and every third swing charge a heavy
        const foe = b.foe(f);
        const melee = f.cls === 'warrior' || f.cls === 'rogue';
        const col = melee ? b.frontCol(f.side) : f.col;
        const step = this.toward(b, f, col, foe.row);
        if (step) { out.move = step; this.t = 0.15; }
        else if (f.lock <= 0) {
          this.t = 1.1;
          out.attackPressed = true;
          this.charging = ++this.swings % 3 === 0;
          out.attackHeld = this.charging;
        }
      }
    }
    out.held = out.move;
    return out;
  }

  private toward(b: Battle, f: Fighter, col: number, row: number): Dir | null {
    const opts: Dir[] = [];
    if (row < f.row) opts.push('up');
    if (row > f.row) opts.push('down');
    if (col < f.col) opts.push('left');
    if (col > f.col) opts.push('right');
    for (const o of opts) {
      const [dc, dr] = o === 'up' ? [0, -1] : o === 'down' ? [0, 1] : o === 'left' ? [-1, 0] : [1, 0];
      if (b.canStand(f, f.col + dc, f.row + dr)) return o;
    }
    return null;
  }

  pick(b: Battle, f: Fighter): number[] { return this.spells ? super.pick(b, f) : []; }
}

/** One row of the training menu. */
interface Row { label: string; value?: () => string; change?: (d: 1 | -1) => void; act?: () => void }

export class TrainingScene extends BattleScene {
  s = loadSettings();
  /** Each side's queue and resource when the fight last left the Draw screen; R goes back to it. */
  private snap: Array<{ queue: string[]; res: number; resMax: number }> = [];
  private lastHitT: [number, number] = [-99, -99];
  private prevHp: [number, number] = [0, 0];
  private dealt = 0;
  private lastDmg = 0;
  private lastDmgT = -99;
  private menuSel = 0;
  private resetT = 0;
  /** The stats panel, opened from the pause menu over the paused fight. */
  private statsOpen = false;
  private statsSel = 0;
  /** The phone menu's list, which scrolls under a finger. */
  private menuScroll = new Scroller();
  private menuRect: [number, number, number, number] = [0, 0, 0, 0];

  constructor(m: MatchConfig) {
    // one endless round, so no round counter
    super({ ...m, bestOf: 1 });
    this.timed = false;
    this.announce = false;
    this.rivalName = 'DUMMY';
    this.b.noKo = true;
    this.b.f[1].name = 'DUMMY';
    this.cpu = new Dummy(this.s.act, this.s.spells);
    this.prevHp = [this.b.f[0].hp, this.b.f[1].hp];
  }

  protected get keepsReplays(): boolean { return false; }

  protected rivalDeckText(): string { return `DUMMY: ${ACTS.find(a => a[0] === this.s.act)![1]}${this.s.spells ? ', CASTS SPELLS' : ''}`; }

  private get rows(): Row[] {
    const s = this.s, dummy = CLASS_INFO[this.m.cpu], you = CLASS_INFO[this.m.p1];
    const cycle = <T>(list: readonly T[], cur: T, d: 1 | -1): T => list[(list.indexOf(cur) + d + list.length) % list.length];
    const resText = (r: ResMode): string => (r === 'normal' ? 'NORMAL' : r === 'full' ? 'ALWAYS FULL' : `FIXED AT ${r}`);
    const hpText = (h: HpMode): string => (h === 'refill' ? 'REFILL' : 'NORMAL');
    return [
      { label: 'RESUME', act: () => { this.paused = false; } },
      { label: 'DUMMY ACTION', value: () => ACTS.find(a => a[0] === s.act)![1], change: d => { s.act = cycle(ACTS.map(a => a[0]), s.act, d); this.newDummy(); } },
      { label: 'DUMMY SPELLS', value: () => (s.spells ? 'ON' : 'OFF'), change: () => { s.spells = !s.spells; this.newDummy(); } },
      { label: 'YOUR HP', value: () => hpText(s.hp[0]), change: () => { s.hp[0] = s.hp[0] === 'refill' ? 'normal' : 'refill'; } },
      { label: 'DUMMY HP', value: () => hpText(s.hp[1]), change: () => { s.hp[1] = s.hp[1] === 'refill' ? 'normal' : 'refill'; } },
      { label: `YOUR ${you.res}`, value: () => resText(s.res[0]), change: d => { s.res[0] = cycle(RES, s.res[0], d); } },
      { label: `DUMMY ${dummy.res}`, value: () => resText(s.res[1]), change: d => { s.res[1] = cycle(RES, s.res[1], d); } },
      { label: 'DRAW GAUGE', value: () => (s.gauge === 'full' ? 'ALWAYS FULL' : 'NORMAL'), change: () => { s.gauge = s.gauge === 'full' ? 'normal' : 'full'; } },
      { label: touchActive() ? 'RESET POSITIONS' : 'RESET POSITIONS (R)', act: () => { this.paused = false; this.reset(); } },
      { label: 'NEW HAND NOW', act: () => { this.paused = false; this.newHand(); } },
      { label: 'SESSION STATS', act: () => { this.statsOpen = true; this.statsSel = 0; this.paused = true; } },
      { label: 'RESTART FROM TURN 1', act: () => replaceScene(new TrainingScene(this.m)) },
      { label: 'CHARACTER SELECT', act: () => { stopMusic(); popTo(s => s instanceof CharSelectScene, () => new CharSelectScene(undefined, 0, 'training')); } },
      { label: 'QUIT TO TITLE', act: () => { stopMusic(); goHome(); } },
    ];
  }

  private newDummy(): void { this.cpu = new Dummy(this.s.act, this.s.spells); }

  /** Both fighters back where this turn's fight began: start panels, full HP, the spells picked, the field cleared. */
  private reset(): void {
    const b = this.b;
    b.resetField();
    b.noKo = true;
    b.f.forEach((f, i) => {
      const sn = this.snap[i];
      if (!sn) return;
      f.queue = [...sn.queue];
      f.res = sn.res;
      f.resMax = sn.resMax;
    });
    b.f[1].name = 'DUMMY';
    b.gauge = 0;
    this.prevHp = [b.f[0].hp, b.f[1].hp];
    this.resetT = 0.8;
    this.applySettings();
    sfx('select');
  }

  private newHand(): void {
    this.b.beginCustom();
    this.openCustom();
  }

  protected confirmCustom(): void {
    super.confirmCustom();
    this.applySettings();
    this.snap = this.b.f.map(f => ({ queue: [...f.queue], res: f.res, resMax: f.resMax }));
  }

  /** Pin resources and the Draw gauge to the chosen settings. */
  private applySettings(): void {
    const b = this.b;
    b.f.forEach((f, i) => {
      const r = this.s.res[i];
      if (r === 'normal') return;
      const cap = f.cls === 'mage' ? TUNING.mage.manaCap : f.cls === 'warrior' ? TUNING.warrior.rageMax : f.resMax;
      const want = r === 'full' ? cap : r;
      if (f.cls === 'mage') f.resMax = Math.max(f.resMax, Math.min(cap, want));
      f.res = want;
    });
    if (this.s.gauge === 'full' && b.phase === 'fight') b.gauge = 1;
  }

  update(dt: number): void {
    const b = this.b;
    this.resetT = Math.max(0, this.resetT - dt);
    if (b.phase === 'fight' && !this.paused && wasPressed('reset')) { this.reset(); return; }
    this.applySettings();
    const before = b.stats[0].basic + b.stats[0].spell + b.stats[0].other;
    const wasPaused = this.paused;
    super.update(dt);
    // the menu opens on RESUME
    if (this.paused && !wasPaused) this.menuSel = 0;
    if (b.phase !== 'fight') return;
    this.applySettings();
    // damage readout: what you dealt this frame (combos come from the battle's true combo counter)
    const now = b.time;
    const total = b.stats[0].basic + b.stats[0].spell + b.stats[0].other;
    const d = total - before;
    if (d > 0) {
      this.lastDmg = d; this.lastDmgT = now;
      this.dealt += d;
    }
    // HP refill: back to full after a moment with no hits
    b.f.forEach((f, i) => {
      if (f.hp < this.prevHp[i]) this.lastHitT[i] = now;
      if (this.s.hp[i] === 'refill' && f.hp < f.maxHp && now - this.lastHitT[i] > REFILL_AFTER) f.hp = f.maxHp;
      this.prevHp[i] = f.hp;
    });
  }

  /** Training draws its own pause menu (its settings), over the fight. */
  protected tallPause(): boolean { return false; }

  protected updatePause(dt: number): void {
    if (this.statsOpen) { this.updateStats(dt); return; }
    if (spread.tall) {
      if (mouse.click && barTapped('back')) { sfx('select'); this.paused = false; this.close(); return; }
      this.menuScroll.update(...this.menuRect);
    }
    const rows = this.rows, n = rows.length;
    const h = hot('trow'), arrow = hot('tarrow');
    if (mouse.moved && h >= 0 && h !== this.menuSel) { this.menuSel = h; sfx('move'); }
    if (mouse.rclick || (wasPressed('back') && !wasPressed('pause'))) { this.paused = false; this.close(); return; }
    const keySel = this.menuSel;
    if (navPressed('up', dt)) { this.menuSel = (this.menuSel + n - 1) % n; sfx('move'); }
    if (navPressed('down', dt)) { this.menuSel = (this.menuSel + 1) % n; sfx('move'); }
    if (spread.tall && this.menuSel !== keySel) this.revealSel();
    const row = rows[this.menuSel];
    const l = navPressed('left', dt), r = navPressed('right', dt);
    if (row.change && (l || r)) { row.change(r ? 1 : -1); sfx('move'); this.close(false); return; }
    if (mouse.click && arrow >= 0) {
      // arrows are numbered row * 2 (left) and row * 2 + 1 (right)
      const rr = rows[arrow >> 1];
      this.menuSel = arrow >> 1;
      rr.change?.(arrow & 1 ? 1 : -1); sfx('move'); this.close(false); return;
    }
    const pick = mouse.click && h >= 0 ? h : wasPressed('confirm') || (wasPressed('pause') && this.menuSel === 0) ? this.menuSel : -1;
    if (pick < 0) return;
    this.menuSel = pick;
    const pr = rows[pick];
    if (pr.change) { pr.change(1); sfx('move'); this.close(false); return; }
    sfx('select');
    pr.act?.();
    if (!this.statsOpen) this.close();
  }

  private static readonly STATS_ITEMS = ['BACK', 'CLEAR STATS'];

  /** The session stats: tabs on left/right, BACK or CLEAR STATS, right-click or the back key returns to the menu. */
  private updateStats(dt: number): void {
    this.statsPanel.update(this.statsData());
    this.swipeStats();
    if (spread.tall && mouse.click && (barTapped('back') || barTapped('mid'))) {
      sfx('select');
      if (barTapped('back')) this.statsOpen = false; else clearStats(this.stats);
      return;
    }
    const n = TrainingScene.STATS_ITEMS.length;
    const clicked = listMouse('menu', this.statsSel, i => { this.statsSel = i; sfx('move'); });
    if (mouse.rclick || (wasPressed('back') && !wasPressed('pause'))) { this.statsOpen = false; sfx('back'); return; }
    if (navPressed('up', dt)) { this.statsSel = (this.statsSel + n - 1) % n; sfx('move'); }
    if (navPressed('down', dt)) { this.statsSel = (this.statsSel + 1) % n; sfx('move'); }
    const pick = clicked >= 0 ? clicked : wasPressed('confirm') || wasPressed('pause') ? this.statsSel : -1;
    if (pick < 0) return;
    sfx('select');
    if (pick === 0) this.statsOpen = false;
    else clearStats(this.stats);
  }

  protected statsData(): StatsData {
    return { ...super.statsData(), scope: 'THIS SESSION', rounds: [] };
  }

  /** Remember the settings; `resume` also leaves the menu. */
  private close(resume = true): void {
    saveSettings(this.s);
    if (resume) this.applySettings();
  }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    const paused = this.paused;
    this.paused = false;
    super.draw(c, tick, ui);
    this.paused = paused;
    const b = this.b;
    if (b.phase === 'fight' || b.phase === 'ko') this.drawReadout(ui, tick);
    if (this.resetT > 0 && b.phase === 'fight') drawTextCentered(ui, 'RESET', UW / 2, 124, '#58d854', 4);
    if (spread.tall) return;
    if (paused && this.statsOpen) this.drawStats(ui, tick);
    else if (paused) this.drawMenu(ui, tick);
  }

  // ---------- phones in portrait: the menu and stats cover the whole screen ----------

  drawBelow(ui: Ctx, tick: number): void {
    super.drawBelow(ui, tick);
    if (!this.paused) return;
    if (this.statsOpen) this.drawStatsTall(ui);
    else this.drawMenuTall(ui, tick);
  }

  /** Top of menu row `i` in the phone list (RESUME, row 0, is the bar's button): settings, a gap, then the actions. */
  private rowTop(i: number): number { return (i - 1) * (TAP + GAP) + (i >= 8 ? 20 : 0); }

  private revealSel(): void {
    if (this.menuSel > 0) this.menuScroll.reveal(this.rowTop(this.menuSel), TAP, this.menuRect[3]);
  }

  private drawMenuTall(ui: Ctx, tick: number): void {
    const [sx, sy, sw, sh] = screenRect(2);
    ui.fillStyle = 'rgba(40,20,0,0.75)';
    ui.fillRect(sx, sy, sw, sh);
    const a = tallArea(), x0 = a.x + PAD, w = a.w - PAD * 2, rows = this.rows;
    let y = a.y + PAD;
    drawTextCentered(ui, 'TRAINING', UW / 2, y, PAPER, 3, true);
    y += 21 + GAP;
    const barTop = actionBar(ui, { back: 'RESUME' });
    const lh = barTop - GAP - y - 12;
    this.menuRect = [a.x, y + 6, a.w, lh];
    const sc = this.menuScroll;
    sc.max = Math.max(0, this.rowTop(rows.length - 1) + TAP - lh + 8);
    panel(ui, x0 - 6, y, w + 12, lh + 12);
    ui.save();
    ui.beginPath(); ui.rect(x0 - 3, y + 3, w + 6, lh + 6); ui.clip();
    const ix = x0 + 6, iw = w - 12, top = y + 6;
    rows.forEach((r, i) => {
      if (i === 0) return;
      const ry = top + this.rowTop(i) - Math.round(sc.pos);
      if (ry + TAP < top || ry > top + lh) return;
      const on = i === this.menuSel && showSel();
      if (!r.value) { bigButton(ui, `trow:${i}`, r.label, ix, ry, iw, TAP, { on }); return; }
      // a setting: tap the row (or >) for the next value, < for the one before
      const v = r.value(), stw = 252, stx = ix + iw - stw;
      zone(`trow:${i}`, ix, ry, iw - stw, TAP);
      if (on) selRow(ui, ix, ry, iw, TAP);
      drawText(ui, r.label, ix + 6, ry + Math.round((TAP - 14) / 2), on ? INK : INK2, textWidth(r.label, 2) < iw - stw - 12 ? 2 : 1);
      bigButton(ui, `tarrow:${i * 2}`, '<', stx, ry, TAP, TAP);
      bigButton(ui, `tarrow:${i * 2 + 1}`, '>', stx + stw - TAP, ry, TAP, TAP);
      drawTextCentered(ui, v, stx + stw / 2, ry + Math.round((TAP - 14) / 2), RED_INK, textWidth(v, 2) < stw - TAP * 2 - 8 ? 2 : 1, false);
    });
    ui.restore();
    if (sc.max > 0) {
      const th = Math.max(30, lh * lh / (lh + sc.max)), ty = top + (lh - th) * (sc.pos / sc.max);
      ui.fillStyle = 'rgba(80,48,0,0.5)'; ui.fillRect(x0 + w + 1, ty, 3, th);
    }
    void tick;
  }

  private drawStatsTall(ui: Ctx): void {
    const [sx, sy, sw, sh] = screenRect(2);
    ui.fillStyle = 'rgba(40,20,0,0.75)';
    ui.fillRect(sx, sy, sw, sh);
    const a = tallArea(), x0 = a.x + PAD, w = a.w - PAD * 2;
    let y = a.y + PAD;
    drawTextCentered(ui, 'TRAINING STATS', UW / 2, y, PAPER, 3, true);
    y += 21 + GAP;
    const barTop = actionBar(ui, { mid: { id: 'clear', label: 'CLEAR STATS' } });
    this.statsRect = [x0, y, w, barTop - GAP - y];
    this.statsPanel.draw(ui, this.statsData(), x0, y, w, barTop - GAP - y);
  }

  private drawStats(ui: Ctx, tick: number): void {
    dim(ui, 0.6);
    banner(ui, 'TRAINING STATS', UW / 2, 6);
    this.statsPanel.draw(ui, this.statsData(), 8, 46, 344, 254);
    drawMenu(ui, TrainingScene.STATS_ITEMS, this.statsSel, 416, 62, tick, { width: 112, gap: 22 });
    hint(ui, `CLICK OR ${k('attack')}: SELECT   ${k('left')}/${k('right')}: TABS   ${k('cast')} / RIGHT-CLICK: BACK`);
  }

  /** Fighting-game damage readout, under the Draw gauge. */
  private drawReadout(ui: Ctx, tick: number): void {
    const w = 208, x = Math.round(UW / 2 - w / 2), y = 34;
    win(ui, x, y, w, 26, { burn: 3 });
    const recent = this.b.time - this.lastDmgT <= HIT_GLOW;
    drawText(ui, `LAST HIT ${Math.round(this.lastDmg)}`, x + 7, y + 6, recent ? RED_INK : INK);
    // true combos only: hits that land while the dummy can't act
    const c = this.b.combo.shown(0), best = this.b.combo.best[0];
    const combo = c ? `COMBO ${c.hits} HITS ${Math.round(c.dmg)} DMG` : 'COMBO -';
    drawText(ui, combo, x + w - 7 - textWidth(combo), y + 6, c?.live && tick % 4 < 3 ? RED_INK : INK);
    drawText(ui, best.hits ? `BEST ${Math.round(best.dmg)}` : 'BEST -', x + 7, y + 15, INK2);
    const keys = touchActive() ? 'PAUSE: MENU' : `R: RESET  ${k('pause')}: MENU`;
    drawText(ui, keys, x + w - 7 - textWidth(keys), y + 15, TRIM);
  }

  private drawMenu(ui: Ctx, tick: number): void {
    dim(ui, 0.6);
    const rows = this.rows, x = 92, w = UW - 184, rh = Math.round(17 * spread.k), y0 = 46;
    banner(ui, 'TRAINING MODE', UW / 2, 8);
    win(ui, x, y0 - 8, w, rows.length * rh + 14);
    rows.forEach((r, i) => {
      // a gap between the settings and the actions below them
      const yy = y0 + i * rh + (i >= 8 ? 4 : 0), on = i === this.menuSel && showSel();
      const ty = yy + 2 + Math.round((rh - 17) / 2);
      zone(`trow:${i}`, x + 2, yy - 3, w - 4, rh - 1);
      if (on) selRow(ui, x + 4, yy - 3, w - 8, rh - 2);
      drawText(ui, r.label, x + 14, ty, on ? INK : INK2);
      if (on && tick % 8 < 6) drawText(ui, '→', x + 4, ty, PAPER);
      if (r.value) {
        const v = r.value(), vx = x + w - 92;
        drawTextCentered(ui, v, vx + 40, ty, RED_INK, 1, false);
        zone(`tarrow:${i * 2}`, vx - 4, yy - 3, 14, rh - 1);
        zone(`tarrow:${i * 2 + 1}`, vx + 74, yy - 3, 14, rh - 1);
        drawText(ui, '<', vx, ty, hot('tarrow') === i * 2 ? INK : TRIM);
        drawText(ui, '>', vx + 78, ty, hot('tarrow') === i * 2 + 1 ? INK : TRIM);
      }
    });
    hint(ui, `${k('up')}/${k('down')}: MOVE   ${k('left')}/${k('right')} OR CLICK: CHANGE   ${k('cast')} / RIGHT-CLICK: RESUME`);
  }
}
