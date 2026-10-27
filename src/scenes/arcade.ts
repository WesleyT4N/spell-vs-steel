// Arcade mode: the ladder screen between fights, the fights themselves (best of 3, CONTINUE on a loss),
// and the clear screen. You pick your fighter and deck on the shared character select first.
import { replaceScene, goHome, drawMenu, hint, listMouse, type Scene } from './scene';
import { getArena, useStage } from '../game/battleView';
import { drawStage } from '../art/arena';
import { getStage } from '../art/stages';
import { getSprite, drawFighterSprite, skinOf, type ClassId } from '../art/sprites';
import { CLASS_INFO } from '../game/classes';
import { TUNING } from '../game/tuning';
import { deckLabel } from '../game/match';
import { setTotals, topSpell, type RoundRecord } from '../game/stats';
import { CARDS } from '../game/cards';
import { BOSS_HP, clock, rungMatch, saveClear, loadRecords, type ArcadeRun, type FightRecord } from '../game/arcade';
import { UW, vy, screenRect, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered } from '../engine/font';
import { wasPressed, navPressed, k, mouse } from '../engine/input';
import type { PadMode } from '../engine/touch';
import { playMusic, stopMusic, sfx } from '../engine/audio';
import { MENU_SONG, RESULT_SONG } from '../engine/music';
import { win, plaque, banner, FRAME, GOLD, INK, INK2, TRIM, RED_INK, BLUE_INK } from './skin';
import { BattleScene } from './battle';
import type { ReplayMode } from '../game/replay';

const LEVEL: Record<string, string> = { easy: 'EASY', normal: 'NORMAL', hard: 'HARD' };
const BOSS_NAME = 'SHADOW';

// ladder layout (UI pixels): your panel, the rungs (boss on top), the next rival's panel
const SIDE_W = 116, SIDE_H = 196, PY = 40;
const RX = 134, RW = UW - 2 * RX, RH = 28, RGAP = 6;

export class ArcadeLadderScene implements Scene {
  sel = 0;
  t = 0;
  constructor(private run: ArcadeRun) {}

  enter(): void { playMusic('menu', MENU_SONG); }
  pad(): PadMode { return 'none'; }

  private get items(): string[] { return [this.run.ladder[this.run.at].boss ? 'FACE THE BOSS!' : 'FIGHT!', 'GIVE UP']; }

  update(dt: number): void {
    this.t += dt;
    const n = this.items.length;
    if (navPressed('up', dt)) { this.sel = (this.sel + n - 1) % n; sfx('move'); }
    if (navPressed('down', dt)) { this.sel = (this.sel + 1) % n; sfx('move'); }
    const clicked = listMouse('menu', this.sel, i => { this.sel = i; sfx('move'); });
    if (clicked >= 0) this.sel = clicked;
    if (wasPressed('back') || mouse.rclick) { this.sel = 1; sfx('move'); return; }
    if (wasPressed('confirm') || wasPressed('custom') || clicked >= 0) {
      sfx('select');
      if (this.sel === 1) { stopMusic(); goHome(); return; }
      replaceScene(arcadeFight(this.run));
    }
  }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    const run = this.run, next = run.ladder[run.at];
    useStage(next.stage);
    drawStage(c, getArena(), tick);
    c.fillStyle = 'rgba(40,20,0,0.35)';
    c.fillRect(...screenRect());
    banner(ui, `ARCADE  ${run.at + 1}/${run.ladder.length}`, UW / 2, vy(3));

    // your panel
    const py = vy(PY), mine = skinOf(run.m.p1, run.m.p1Skin[run.m.p1]).id;
    win(ui, 10, py, SIDE_W, SIDE_H);
    drawTextCentered(ui, 'YOU', 10 + SIDE_W / 2, py + 10, RED_INK, 1, false);
    drawFighterSprite(ui, getSprite(run.m.p1, mine, false), 10 + SIDE_W / 2, py + 92 - (Math.floor(tick / 4) % 2) * 2, false, 'none', 3);
    drawTextCentered(ui, CLASS_INFO[run.m.p1].name, 10 + SIDE_W / 2, py + 100, INK, 2, false);
    const deck = deckLabel(run.m.p1, run.m.p1Deck);
    [deck, `CONTINUES ${run.continues}`, `TIME ${clock(run.time)}`].forEach((l, i) => drawTextCentered(ui, l, 10 + SIDE_W / 2, py + 124 + i * 12, i ? INK2 : TRIM, 1, false));
    const best = loadRecords()[run.m.p1];
    if (best) drawTextCentered(ui, `BEST ${clock(best.time)} / ${best.continues}C`, 10 + SIDE_W / 2, py + 176, TRIM, 1, false);

    // the ladder: fight 1 at the bottom, the boss on top
    run.ladder.forEach((r, i) => {
      const y = py + (run.ladder.length - 1 - i) * (RH + RGAP), done = i < run.at, now = i === run.at;
      const text = plaque(ui, RX, y, RW, RH, now && tick % 16 < 12, now ? GOLD : FRAME);
      const hidden = r.boss && !now;
      drawFighterSprite(ui, getSprite(r.cls, r.skin, false), RX + 20, y + RH - 2, true, hidden ? 'ghost' : 'none', 1);
      drawText(ui, r.boss ? (hidden ? 'BOSS  ???' : `BOSS  ${BOSS_NAME}`) : `${i + 1}  ${CLASS_INFO[r.cls].name}`, RX + 38, y + 6, text, 1);
      drawText(ui, r.boss ? 'HARD  FULL POWER' : `${LEVEL[r.difficulty]}  ${Math.round(r.power * 100)}% POWER`, RX + 38, y + 16, now ? text : INK2, 1);
      if (done) drawTextCentered(ui, 'CLEAR', RX + RW - 30, y + 10, RED_INK, 1, false);
    });

    // the next rival
    const rx = UW - 10 - SIDE_W, rcx = rx + SIDE_W / 2;
    win(ui, rx, py, SIDE_W, SIDE_H, { accent: next.boss ? GOLD : undefined });
    drawTextCentered(ui, next.boss ? 'BOSS' : 'NEXT RIVAL', rcx, py + 10, BLUE_INK, 1, false);
    drawFighterSprite(ui, getSprite(next.cls, next.skin, false), rcx, py + 92 - (Math.floor(tick / 4 + 1) % 2) * 2, true, 'none', 3);
    drawTextCentered(ui, next.boss ? BOSS_NAME : CLASS_INFO[next.cls].name, rcx, py + 100, INK, 2, false);
    const lines = [deckLabel(next.cls, next.deck), `CPU ${LEVEL[next.difficulty]}`, getStage(next.stage).name.toUpperCase()];
    lines.push(next.boss ? `FULL KIT  HP x${BOSS_HP}` : `${Math.round(next.power * 100)}% POWER`);
    lines.forEach((l, i) => drawTextCentered(ui, l, rcx, py + 124 + i * 12, i ? INK2 : TRIM, 1, false));

    drawMenu(ui, this.items, this.sel, UW / 2, vy(PY + SIDE_H + 12), tick, { width: 160, gap: 18 });
    hint(ui, `CLICK OR ${k('up')}/${k('down')} + ${k('attack')}: SELECT   BEST OF 3 EACH`);
  }
}

/** The run's next fight, from round 1. */
export function arcadeFight(run: ArcadeRun): BattleScene {
  const r = run.ladder[run.at];
  useStage(r.stage);
  return new ArcadeBattleScene(run, [0, 0], []);
}

/** An arcade fight: a best-of-3 set against the rung's CPU. Win the set to climb, lose it to CONTINUE or give up. */
export class ArcadeBattleScene extends BattleScene {
  private counted = false;
  constructor(private run: ArcadeRun, score: [number, number], rounds: RoundRecord[]) {
    super(rungMatch(run), score, undefined, rounds, ['player', 'cpu']);
    const rung = run.ladder[run.at];
    this.rivalName = rung.boss ? BOSS_NAME : 'CPU';
    // GIVE UP stands where QUIT TO TITLE does, and does the same
    this.pauseItems = ['RESUME', 'OPTIONS', 'RESTART', 'GIVE UP'];
    // rivals fight with a weakened kit (less HP, less damage); the boss at full power with extra HP
    const f = this.b.f[1];
    f.power = rung.power;
    f.maxHp = f.hp = Math.round(TUNING.hp[f.cls as ClassId] * (rung.boss ? BOSS_HP : rung.power));
    if (rung.boss) f.name = BOSS_NAME;
  }

  protected get replayMode(): ReplayMode { return 'arcade'; }
  protected again(score: [number, number], rounds: RoundRecord[]): Scene { return new ArcadeBattleScene(this.run, score, rounds); }

  update(dt: number): void {
    super.update(dt);
    // fighting time (Draw screens left out) goes on the run's clock once per round, lost sets included
    if (this.b.phase === 'over' && !this.counted) { this.counted = true; this.run.time += this.stats.fightSecs; }
  }

  private get won(): boolean { return this.score[0] >= this.need; }

  protected get resultItems(): string[] {
    if (!this.setOver) return ['NEXT ROUND', 'GIVE UP'];
    return this.won ? [this.run.ladder[this.run.at].boss ? 'CLAIM VICTORY' : 'NEXT FIGHT'] : ['CONTINUE', 'GIVE UP'];
  }

  protected onResult(choice: string): void {
    const run = this.run;
    if (choice === 'NEXT ROUND') replaceScene(this.again(this.score, this.rounds));
    if (choice === 'CONTINUE') { run.continues++; run.tries++; replaceScene(this.again([0, 0], [])); }
    if (choice === 'GIVE UP') goHome();
    if (choice === 'NEXT FIGHT' || choice === 'CLAIM VICTORY') run.fights.push(this.record());
    if (choice === 'NEXT FIGHT') { run.at++; run.tries = 1; replaceScene(new ArcadeLadderScene(run)); }
    if (choice === 'CLAIM VICTORY') replaceScene(new ArcadeClearScene(run));
  }

  /** The won set, summed up for the clear screen. */
  private record(): FightRecord {
    const rung = this.run.ladder[this.run.at], rs = this.rounds;
    const sum = (f: (r: RoundRecord) => number): number => rs.reduce((t, r) => t + f(r), 0);
    const top = setTotals(rs);
    const best = top ? topSpell(top[0]) : null;
    return {
      cls: rung.cls, skin: rung.skin, difficulty: rung.difficulty, boss: rung.boss,
      rounds: [rs.filter(r => r.winner === 0).length, rs.filter(r => r.winner === 1).length],
      secs: sum(r => r.secs), dealt: sum(r => r.dealt[0]), taken: sum(r => r.dealt[1]), tries: this.run.tries,
      best: best ? [best[0], best[1].dmg + best[1].heal] : null,
    };
  }
}

/** The run is won: your fighter, the clock and continues, and whether it is a new best for the class. */
export class ArcadeClearScene implements Scene {
  t = 0;
  record: boolean;
  constructor(private run: ArcadeRun) {
    this.record = saveClear(run.m.p1, { time: run.time, continues: run.continues });
  }
  enter(): void { playMusic('result', RESULT_SONG); sfx('win'); }
  pad(): PadMode { return 'none'; }

  update(dt: number): void {
    this.t += dt;
    if (this.t > 1 && (wasPressed('confirm') || wasPressed('custom') || wasPressed('back') || mouse.click)) {
      sfx('select'); stopMusic(); goHome();
    }
  }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    const run = this.run;
    drawStage(c, getArena(), tick);
    c.fillStyle = 'rgba(40,20,0,0.35)';
    c.fillRect(...screenRect());
    banner(ui, 'ARCADE CLEAR!', UW / 2, vy(4), 3);

    // the champion: your fighter, the run's clock and continues
    const y = vy(48), lx = 8, lw = 132, h = 244, lcx = lx + lw / 2;
    win(ui, lx, y, lw, h, { accent: GOLD });
    const skin = skinOf(run.m.p1, run.m.p1Skin[run.m.p1]).id;
    drawFighterSprite(ui, getSprite(run.m.p1, skin, false), lcx, y + 86 - (Math.floor(tick / 4) % 2) * 3, false, tick % 40 < 2 ? 'flash' : 'none', 3);
    drawTextCentered(ui, CLASS_INFO[run.m.p1].name, lcx, y + 94, INK, 2, false);
    drawTextCentered(ui, 'IS CHAMPION', lcx, y + 112, RED_INK, 1, false);
    drawTextCentered(ui, deckLabel(run.m.p1, run.m.p1Deck), lcx, y + 124, TRIM, 1, false);
    drawTextCentered(ui, `TIME ${clock(run.time)}`, lcx, y + 144, INK2, 1, false);
    drawTextCentered(ui, `CONTINUES ${run.continues}`, lcx, y + 156, INK2, 1, false);
    const best = run.fights.reduce<[string, number] | null>((b, f) => f.best && (!b || f.best[1] > b[1]) ? f.best : b, null);
    if (best) {
      drawTextCentered(ui, 'BEST SPELL', lcx, y + 176, TRIM, 1, false);
      drawTextCentered(ui, CARDS[best[0]].name.toUpperCase(), lcx, y + 188, INK, 1, false);
      drawTextCentered(ui, `${Math.round(best[1])} IN ONE SET`, lcx, y + 200, INK2, 1, false);
    }
    if (this.record && tick % 16 < 12) drawTextCentered(ui, 'NEW BEST!', lcx, y + 222, RED_INK, 2, false);

    // every fight of the run, one row each, and the totals
    const tx = lx + lw + 8, tw = UW - 8 - tx;
    win(ui, tx, y, tw, h);
    const cols: Array<[string, number]> = [['FOE', 8], ['LEVEL', 88], ['ROUNDS', 132], ['TIME', 176], ['DEALT', 210], ['TAKEN', 248], ['SETS', 286]];
    cols.forEach(([l, cx]) => drawText(ui, l, tx + cx, y + 10, TRIM, 1));
    const rowH = 28, fights = run.fights;
    fights.forEach((f, i) => {
      const ry = y + 24 + i * rowH;
      if (i % 2 === 0) ui.fillStyle = 'rgba(172,124,0,0.12)', ui.fillRect(tx + 4, ry, tw - 8, rowH);
      drawFighterSprite(ui, getSprite(f.cls, f.skin, false), tx + 18, ry + rowH - 2, true, 'none', 1);
      const cells = [f.boss ? 'SHADOW' : CLASS_INFO[f.cls].name, f.boss ? 'HARD+' : LEVEL[f.difficulty], `${f.rounds[0]}-${f.rounds[1]}`, clock(f.secs), `${Math.round(f.dealt)}`, `${Math.round(f.taken)}`, `${f.tries}`];
      cells.forEach((t, n) => drawText(ui, t, tx + (n === 0 ? 34 : cols[n][1]), ry + 10, f.boss && n === 0 ? RED_INK : INK, 1));
    });
    const ty = y + 24 + fights.length * rowH + 6, total = (k: 'secs' | 'dealt' | 'taken'): number => fights.reduce((t, f) => t + f[k], 0);
    ui.fillStyle = INK; ui.fillRect(tx + 6, ty - 3, tw - 12, 1);
    const won = fights.reduce((t, f) => t + f.rounds[0], 0), lost = fights.reduce((t, f) => t + f.rounds[1], 0);
    [['TOTAL', 8], [`${won}-${lost}`, 132], [clock(total('secs')), 176], [`${Math.round(total('dealt'))}`, 210], [`${Math.round(total('taken'))}`, 248], [`${fights.reduce((t, f) => t + f.tries, 0)}`, 286]]
      .forEach(([t, cx]) => drawText(ui, t as string, tx + (cx as number), ty + 4, INK, 1));
    hint(ui, `CLICK OR ${k('attack')}: TITLE`);
  }
}
