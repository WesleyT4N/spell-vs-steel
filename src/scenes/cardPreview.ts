// Card previews: a short looping clip of a spell, played live on its own tiny Battle.
// The clip runs the real rules on a throwaway Battle with its own seed, so it never touches the match being
// played (online lockstep included): nothing it does reaches another Battle, and its sounds are muted.
import { Battle, NO_INTENT, type Intent } from '../game/battle';
import { drawBattle } from '../game/battleView';
import { CARDS, type CardDef } from '../game/cards';
import type { ClassId } from '../art/sprites';
import { W, H, P, type Ctx } from '../engine/gfx';
import { withoutSfx } from '../engine/audio';
import { FRAME } from './skin';

const STEP = 1 / 60;
/** Seconds before the cast, the longest a clip runs after it, and the pause before it loops. */
const LEAD = 0.45, MAX_RUN = 3.2, MIN_RUN = 1.1, HOLD = 0.5;
/** The part of the world a clip shows: the whole grid, with headroom for sprites and tall effects. */
const CROP_Y = 70, CROP_H = 88;

/** Who stands in for the enemy: a class the caster doesn't share, so the two never look alike. */
const DUMMY: Record<ClassId, ClassId> = { warrior: 'mage', mage: 'warrior', rogue: 'warrior', ranger: 'warrior', cleric: 'warrior' };

export class CardPreview {
  private b: Battle | null = null;
  private id = '';
  /** Clip time; the cast happens at LEAD. */
  private t = 0;
  private acc = 0;
  private endT = 0;
  private canvas: HTMLCanvasElement | null = null;

  /** Start (or keep playing) the clip for `card`; null stops it. */
  show(card: CardDef | null): void {
    if (!card) { this.b = null; this.id = ''; return; }
    if (card.id === this.id && this.b) return;
    this.id = card.id;
    this.restart();
  }

  private restart(): void {
    const card = CARDS[this.id];
    withoutSfx(() => {
      // a fixed seed: the same card plays the same clip every loop
      const b = new Battle({ cls: card.cls, deck: [], name: 'YOU' }, { cls: DUMMY[card.cls], deck: [], name: 'DUMMY' }, 0x5eed);
      b.endCustom([[], []]);
      b.noKo = true;
      // free spells and no Draw screen, like the sandbox
      b.costOf = () => 0;
      b.canAfford = () => true;
      // the dummy waits on its front column, so melee spells land too
      b.f[1].col = 3;
      b.f[0].queue = [card.id];
      if (card.needsStealth) b.stealth(b.f[0], LEAD + 1);
      this.b = b;
    });
    this.t = 0;
    this.acc = 0;
    this.endT = 0;
  }

  update(dt: number): void {
    const b = this.b;
    if (!b) return;
    this.acc = Math.min(this.acc + dt, 0.1);
    withoutSfx(() => {
      while (this.acc >= STEP) {
        this.acc -= STEP;
        this.t += STEP;
        const cast = this.t >= LEAD && this.t - STEP < LEAD;
        const me: Intent = cast ? { ...NO_INTENT, castPressed: true } : NO_INTENT;
        b.gauge = 0;
        b.update(STEP, [me, NO_INTENT]);
        for (const f of b.f) if (f.hp < f.maxHp * 0.3) f.hp = f.maxHp; // the dummy never runs out
        const ran = this.t - LEAD;
        const busy = b.projectiles.length || b.timers.length || b.anims.length || b.fx.length || b.f[0].lock > 0;
        if (!this.endT && ran > MIN_RUN && (!busy || ran > MAX_RUN)) this.endT = this.t + HOLD;
      }
    });
    if (this.endT && this.t >= this.endT) this.restart();
  }

  /** Draw the clip into a `w`×`h` box on the UI layer, centered on the grid, with a thin frame. */
  draw(ui: Ctx, x: number, y: number, w: number, h: number): void {
    P(ui, '#000000', x - 1, y - 1, w + 2, h + 2);
    P(ui, FRAME, x - 2, y - 2, w + 4, 1); P(ui, FRAME, x - 2, y + h + 1, w + 4, 1);
    P(ui, FRAME, x - 2, y - 2, 1, h + 4); P(ui, FRAME, x + w + 1, y - 2, 1, h + 4);
    const b = this.b;
    if (!b) return;
    const cv = (this.canvas ??= Object.assign(document.createElement('canvas'), { width: W, height: H }));
    const c = cv.getContext('2d')!;
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, W, H);
    drawBattle(c, b, Math.floor(this.t * 8), 'all');
    const sw = Math.min(w, W), sh = Math.min(h, CROP_H);
    const sx = Math.round((W - sw) / 2), sy = CROP_Y + Math.round((CROP_H - sh) / 2);
    ui.save();
    ui.imageSmoothingEnabled = false;
    ui.drawImage(cv, sx, sy, sw, sh, x + Math.round((w - sw) / 2), y + Math.round((h - sh) / 2), sw, sh);
    ui.restore();
  }
}
