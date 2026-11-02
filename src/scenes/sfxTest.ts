// Dev tool: a sound board of every recorded sound effect (assets/audio/sfx/), grouped the way the game uses them.
// ORIGINAL switches the whole game back to the old synthesized sounds, to compare.
import { popScene, hint, zone, hot, button, type Scene } from './scene';
import { getArena } from '../game/battleView';
import { drawStage } from '../art/arena';
import { UW, screenRect, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered } from '../engine/font';
import { wasPressed, navPressed, k, mouse } from '../engine/input';
import { sfx, sfxSlot, unlockAudio } from '../engine/audio';
import { sfxSlots, isSynthOnly, setSynthOnly } from '../engine/sfxSamples';

/** Groups by slot name; anything unlisted lands in SPELLS. */
const GROUPS: Array<[string, (s: string) => boolean]> = [
  ['MENUS', s => s.startsWith('ui_') || ['pip', 'charged', 'win', 'step'].includes(s)],
  ['HITS', s => s.startsWith('hit_') || ['heavyImpact', 'ko', 'block', 'guard', 'shieldHit', 'break', 'reflect', 'counter', 'spark', 'freeze', 'thaw', 'heal'].includes(s)],
  ['CASTS', s => s.startsWith('cast_')],
  ['ATTACKS', s => s.startsWith('shot_') || ['cleave', 'cleaveHeavy', 'dagger', 'stab', 'knife', 'thrust', 'smash', 'wide', 'arrow', 'aimed', 'bolt', 'boltHeavy', 'holySpark', 'lob'].includes(s)],
  ['SPELLS', () => true],
];
const COLS = 6, CW = 78, RH = 12, X0 = (UW - COLS * CW) / 2, Y0 = 50;

/** Slot name as a short label: ui_move -> MOVE, hit_fire -> FIRE, cleaveHeavy -> CLEAVE HEAVY. */
const label = (s: string): string => s.replace(/^(ui|hit|cast|shot)_/, '').replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase().slice(0, 12);

interface Cell { slot: string; group: number; x: number; y: number }

export class SfxTestScene implements Scene {
  sel = 0;
  private cells: Cell[] = [];
  private heads: Array<[string, number]> = [];
  constructor(private back: () => void = popScene) {
    const slots = sfxSlots();
    const taken = new Set<string>();
    let y = Y0;
    GROUPS.forEach(([name, test], g) => {
      const mine = slots.filter(s => !taken.has(s) && test(s));
      if (!mine.length) return;
      mine.forEach(s => taken.add(s));
      this.heads.push([name, y]);
      mine.forEach((slot, i) => this.cells.push({ slot, group: g, x: X0 + (i % COLS) * CW, y: y + 8 + Math.floor(i / COLS) * RH }));
      y += 8 + Math.ceil(mine.length / COLS) * RH + 2;
    });
  }

  private play(): void {
    unlockAudio();
    const c = this.cells[this.sel];
    if (c && !sfxSlot(c.slot)) sfx('deny');
  }

  update(dt: number): void {
    const n = this.cells.length;
    if (!n) { if (wasPressed('back') || wasPressed('confirm') || mouse.rclick) this.back(); return; }
    if (navPressed('left', dt)) this.sel = (this.sel + n - 1) % n;
    if (navPressed('right', dt)) this.sel = (this.sel + 1) % n;
    if (navPressed('up', dt)) this.sel = (this.sel + n - COLS) % n;
    if (navPressed('down', dt)) this.sel = (this.sel + COLS) % n;
    if (hot('orig') >= 0 && mouse.click) { setSynthOnly(!isSynthOnly()); sfx('select'); return; }
    const h = hot('slot');
    if (h >= 0 && mouse.click) { this.sel = h; this.play(); return; }
    if (wasPressed('confirm')) this.play();
    if (wasPressed('custom')) { setSynthOnly(!isSynthOnly()); sfx('select'); }
    if (wasPressed('back') || mouse.rclick) { sfx('back'); this.back(); }
  }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    drawStage(c, getArena(), tick);
    c.fillStyle = 'rgba(0,0,24,0.8)';
    c.fillRect(...screenRect());
    drawTextCentered(ui, 'SOUND TEST', UW / 2, 14, '#f8b800', 2);
    button(ui, 'orig:0', isSynthOnly() ? 'IN GAME: ORIGINAL' : 'IN GAME: NEW', UW / 2 - 60, 32, 120, 14, isSynthOnly());
    if (!this.cells.length) drawTextCentered(ui, 'NO RECORDED SOUNDS FOUND', UW / 2, 120, '#fcfcfc');
    for (const [name, y] of this.heads) drawText(ui, name, X0, y, '#bcbcbc');
    this.cells.forEach((cell, i) => {
      const on = i === this.sel;
      zone(`slot:${i}`, cell.x, cell.y, CW - 3, RH - 2);
      ui.fillStyle = on ? '#f8b800' : 'rgba(255,255,255,0.08)';
      ui.fillRect(cell.x, cell.y, CW - 3, RH - 2);
      drawTextCentered(ui, label(cell.slot), cell.x + (CW - 3) / 2, cell.y + 2, on ? '#000000' : '#fcfcfc', 1, false);
    });
    hint(ui, `CLICK OR ARROWS + ${k('attack')}: PLAY   ${k('custom')}: NEW/ORIGINAL   ${k('cast')}: BACK`);
  }
}
