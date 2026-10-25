// Versus CPU: runs a Battle, the custom screen, pause and results.
import { setScene, dim, drawMenu, hint, type Scene } from './scene';
import { Battle, NO_INTENT, type Dir, type Intent } from '../game/battle';
import { drawBattle } from '../game/battleView';
import { Cpu } from '../game/ai';
import { CARDS, ELEMENT_COLOR, RARITY_COLOR } from '../game/cards';
import { starterDeck, toList, STARTER_NAME } from '../game/deck';
import { playerDeck, type MatchConfig } from '../game/match';
import { TUNING } from '../game/tuning';
import { P, W, H, frame, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered, drawTextOutlined } from '../engine/font';
import { wasPressed, isDown, heldDir, navPressed, k } from '../engine/input';
import { playMusic, stopMusic, sfx } from '../engine/audio';
import { BATTLE_SONG, RESULT_SONG } from '../engine/music';
import { drawCardDetail } from './deckbuilder';
import { SetupScene } from './setup';
import { TitleScene } from './title';

export class BattleScene implements Scene {
  b: Battle;
  cpu: Cpu;
  cursor = 0;
  picks: number[] = [];
  timer: number = TUNING.customTimer;
  paused = false;
  pauseSel = 0;
  resultSel = 0;
  fightBanner = 0;
  holdT = 0;
  lastDir: Dir | null = null;
  ended = false;

  constructor(public m: MatchConfig) {
    this.b = new Battle(
      { cls: m.p1, deck: playerDeck(m), name: 'YOU' },
      { cls: m.cpu, deck: toList(starterDeck(m.cpu)), name: 'CPU' },
    );
    this.cpu = new Cpu(m.difficulty);
  }

  enter(): void { playMusic('battle', BATTLE_SONG); }

  private playerIntent(dt: number): Intent {
    const f = this.b.f[0];
    const d = heldDir();
    let move: Dir | null = null;
    if (d) {
      if (d !== this.lastDir || wasPressed(d)) { move = d; this.holdT = 0; }
      else {
        this.holdT += dt;
        if (this.holdT > 0.18 && f.moveCd <= 0) move = d;
      }
    } else this.holdT = 0;
    this.lastDir = d;
    return { move, held: d, attackPressed: wasPressed('attack'), attackHeld: isDown('attack'), castPressed: wasPressed('cast') };
  }

  update(dt: number): void {
    const b = this.b;
    this.fightBanner = Math.max(0, this.fightBanner - dt);

    if (b.phase === 'custom') { this.updateCustom(dt); b.update(dt, [NO_INTENT, NO_INTENT]); return; }
    if (b.phase === 'over') { this.updateResult(dt); b.update(dt, [NO_INTENT, NO_INTENT]); return; }

    if (this.paused) { this.updatePause(dt); return; }
    if (b.phase === 'fight' && wasPressed('pause')) { this.paused = true; this.pauseSel = 0; sfx('select'); return; }

    if (b.phase === 'fight' && wasPressed('custom') && b.canOpenCustom()) {
      b.beginCustom();
      this.openCustom();
      return;
    }
    const pi = b.phase === 'fight' ? this.playerIntent(dt) : NO_INTENT;
    const ci = this.cpu.intent(b, b.f[1], dt);
    b.update(dt, [pi, ci]);
    if ((b.phase as string) === 'over' && !this.ended) {
      this.ended = true;
      stopMusic();
      if (b.winner === 0) sfx('win');
      playMusic('result', RESULT_SONG);
    }
  }

  private openCustom(): void {
    this.cursor = 0;
    this.picks = [];
    this.timer = TUNING.customTimer;
  }

  private confirmCustom(): void {
    const cpuPicks = this.cpu.pick(this.b, this.b.f[1]);
    this.b.endCustom([this.picks, cpuPicks]);
    this.fightBanner = 0.9;
  }

  private updateCustom(dt: number): void {
    const offer = this.b.offer[0];
    const rows = offer.length + 1;
    this.timer -= dt;
    if (this.timer <= 0) { this.confirmCustom(); return; }
    if (navPressed('up', dt)) { this.cursor = (this.cursor + rows - 1) % rows; sfx('move'); }
    if (navPressed('down', dt)) { this.cursor = (this.cursor + 1) % rows; sfx('move'); }
    if (wasPressed('custom') || (wasPressed('pause') && !wasPressed('confirm'))) { this.confirmCustom(); return; }
    if (wasPressed('confirm')) {
      if (this.cursor === offer.length) { this.confirmCustom(); return; }
      const at = this.picks.indexOf(this.cursor);
      if (at >= 0) { this.picks.splice(at, 1); sfx('back'); }
      else { this.picks.push(this.cursor); sfx('select'); this.cursor = Math.min(this.cursor + 1, rows - 1); while (this.cursor < offer.length && this.picks.includes(this.cursor)) this.cursor++; }
    }
    if (wasPressed('cast') && this.picks.length) { this.picks.pop(); sfx('back'); }
  }

  private updatePause(dt: number): void {
    const items = 3;
    if (navPressed('up', dt)) { this.pauseSel = (this.pauseSel + items - 1) % items; sfx('move'); }
    if (navPressed('down', dt)) { this.pauseSel = (this.pauseSel + 1) % items; sfx('move'); }
    if (wasPressed('back') && !wasPressed('pause')) { this.paused = false; return; }
    if (wasPressed('confirm') || (wasPressed('pause') && this.pauseSel === 0)) {
      sfx('select');
      if (this.pauseSel === 0) this.paused = false;
      if (this.pauseSel === 1) setScene(new BattleScene(this.m));
      if (this.pauseSel === 2) { stopMusic(); setScene(new TitleScene()); }
    }
  }

  private updateResult(dt: number): void {
    const items = 3;
    if (navPressed('up', dt)) { this.resultSel = (this.resultSel + items - 1) % items; sfx('move'); }
    if (navPressed('down', dt)) { this.resultSel = (this.resultSel + 1) % items; sfx('move'); }
    if (wasPressed('confirm') || wasPressed('custom')) {
      sfx('select');
      stopMusic();
      if (this.resultSel === 0) setScene(new BattleScene(this.m));
      if (this.resultSel === 1) setScene(new SetupScene());
      if (this.resultSel === 2) setScene(new TitleScene());
    }
  }

  draw(c: Ctx, tick: number): void {
    const b = this.b;
    drawBattle(c, b, tick);
    if (b.phase === 'custom') this.drawCustom(c, tick);
    if (this.fightBanner > 0 && b.phase === 'fight') {
      const s = this.fightBanner > 0.45 ? 'READY' : 'FIGHT!';
      drawTextCentered(c, s, W / 2, 62, s === 'FIGHT!' ? '#f8b800' : '#fcfcfc', 3);
    }
    if (b.phase === 'ko' && b.koT > 0.4) drawTextCentered(c, 'K.O.', W / 2, 58, '#f83800', 3);
    if (b.phase === 'over') {
      dim(c, 0.45);
      const won = b.winner === 0;
      drawTextCentered(c, won ? 'YOU WIN!' : 'YOU LOSE', W / 2, 36, won ? '#f8b800' : '#bcbcbc', 3);
      drawMenu(c, ['REMATCH', 'CHANGE SETUP', 'TITLE'], this.resultSel, W / 2, 80, tick, { width: 104 });
      hint(c, `${k('attack')}: SELECT`);
    }
    if (this.paused) {
      dim(c, 0.55);
      drawTextCentered(c, 'PAUSED', W / 2, 40, '#fcfcfc', 2);
      drawMenu(c, ['RESUME', 'RESTART', 'QUIT TO TITLE'], this.pauseSel, W / 2, 70, tick, { width: 104 });
      hint(c, `${k('attack')}: SELECT  ${k('cast')}: RESUME`);
    }
  }

  private drawCustom(c: Ctx, tick: number): void {
    const b = this.b, f = b.f[0];
    const offer = b.offer[0];
    dim(c, 0.35);
    // left: hand
    const lx = 4, ly = 24, lw = 118;
    frame(c, lx, ly, lw, 126, '#000000', '#3cbcfc');
    P(c, '#0000a8', lx + 1, ly + 1, lw - 2, 10);
    drawText(c, `DRAW  TURN ${b.turn}`, lx + 4, ly + 3, '#fcfcfc');
    const secs = Math.ceil(this.timer);
    drawText(c, String(secs).padStart(2, '0'), lx + lw - 16, ly + 3, secs <= 5 && tick % 4 < 2 ? '#f83800' : '#f8b800');
    offer.forEach((id, i) => {
      const card = CARDS[id];
      const y = ly + 15 + i * 15;
      const on = this.cursor === i;
      const order = this.picks.indexOf(i);
      if (on) P(c, '#0000a8', lx + 2, y - 2, lw - 4, 14);
      P(c, '#000000', lx + 4, y - 1, 11, 11);
      P(c, ELEMENT_COLOR[card.element], lx + 5, y, 9, 9);
      drawText(c, card.cost === 'all' ? 'A' : String(card.cost), lx + 7, y + 1, '#000000');
      drawText(c, card.name.toUpperCase().slice(0, 14), lx + 19, y + 1, order >= 0 ? '#7c7c7c' : RARITY_COLOR[card.rarity]);
      if (order >= 0) { P(c, '#f8b800', lx + lw - 13, y - 1, 9, 11); drawText(c, String(order + 1), lx + lw - 11, y + 1, '#000000'); }
      if (on && tick % 8 < 6) drawText(c, '→', lx + 1, y + 1, '#f8b800');
    });
    const okY = ly + 15 + offer.length * 15 + 2;
    const onOk = this.cursor === offer.length;
    frame(c, lx + 30, okY, 58, 12, onOk ? '#f8b800' : '#000000', '#fcfcfc');
    drawTextCentered(c, 'FIGHT!', lx + 59, okY + 3, onOk ? '#000000' : '#f8b800', 1, false);

    // resource and picked total
    const ry = ly + 108;
    const total = this.picks.reduce((a, i) => { const cc = CARDS[offer[i]].cost; return a + (cc === 'all' ? 1 : cc); }, 0);
    if (f.cls === 'warrior') {
      drawText(c, `RAGE ${f.res.toFixed(1).replace('.0', '')}/5`, lx + 4, ry, '#f87858');
      drawText(c, `COST ${total}`, lx + 70, ry, '#bcbcbc');
    } else {
      drawText(c, `MANA ${f.res}/${f.resMax}`, lx + 4, ry, '#a4e4fc');
      drawText(c, `COST ${total}`, lx + 70, ry, total > f.res ? '#f83800' : '#bcbcbc');
    }
    drawText(c, f.cls === 'warrior' ? 'PAY RAGE ON CAST' : 'REFILLS EACH TURN', lx + 4, ry + 9, '#7c7c7c');

    // right: detail
    const dx = 126, dw = W - dx - 4;
    const card = offer[this.cursor] ? CARDS[offer[this.cursor]] : null;
    frame(c, dx, ly, dw, 126, '#000000', card ? ELEMENT_COLOR[card.element] : '#7c7c7c');
    if (card) drawCardDetail(c, card, dx + 4, ly + 4, Math.floor((dw - 8) / 6));
    else {
      drawText(c, 'START THE FIGHT', dx + 4, ly + 4, '#fcfcfc');
      drawText(c, `${this.picks.length} SPELL${this.picks.length === 1 ? '' : 'S'} PICKED`, dx + 4, ly + 16, '#bcbcbc');
      drawText(c, 'CAST IN ORDER', dx + 4, ly + 26, '#bcbcbc');
      drawText(c, 'WITH X', dx + 4, ly + 34, '#bcbcbc');
      drawText(c, 'CPU DECK:', dx + 4, ly + 50, '#7c7c7c');
      drawText(c, STARTER_NAME[this.m.cpu].toUpperCase(), dx + 4, ly + 58, '#7c7c7c');
    }
    drawTextOutlined(c, `${k('attack')} PICK  ${k('cast')} UNDO  ${k('custom')} FIGHT`, 6, H - 9, '#fcfcfc');
  }
}
