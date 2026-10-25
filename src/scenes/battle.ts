// Versus CPU: runs a Battle, the custom screen, pause and results.
import { setScene, dim, drawMenu, hint, zone, hot, isHot, listMouse, type Scene } from './scene';
import { Battle, NO_INTENT, type Dir, type Intent } from '../game/battle';
import { drawBattle, drawBattleUi } from '../game/battleView';
import { Cpu } from '../game/ai';
import { CARDS, ELEMENT_COLOR, RARITY_COLOR } from '../game/cards';

// Draw screen layout (UI pixels): the hand fans along the bottom, details and cast order above it.
const HAND_Y = 194, HAND_GAP = 84;
const handX = (i: number, n: number): number => Math.round(UW / 2 - (HAND_GAP * (n - 1) + CARD_W) / 2 + i * HAND_GAP);
/** Pixels per raise level: hovered cards rise one level, picked cards two. */
const LIFT = 12;
import { starterDeck, toList, STARTER_NAME } from '../game/deck';
import { playerDeck, type MatchConfig } from '../game/match';
import { TUNING } from '../game/tuning';
import { P, UW, frame, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered } from '../engine/font';
import { wasPressed, isDown, heldDir, navPressed, k, mouse } from '../engine/input';
import { playMusic, stopMusic, sfx } from '../engine/audio';
import { BATTLE_SONG, RESULT_SONG } from '../engine/music';
import { drawCardDetail, drawCardFace, CARD_W, CARD_H, PICKED } from './cardView';
import { SetupScene } from './setup';
import { TitleScene } from './title';
import { OptionsScene } from './options';

export class BattleScene implements Scene {
  b: Battle;
  cpu: Cpu;
  cursor = 0;
  /** True after the mouse moves, false after a key press: decides whether hover or the key cursor raises a card. */
  mouseMode = false;
  /** Current raise of each card in the hand, eased toward its level. */
  lift: number[] = [];
  picks: number[] = [];
  timer: number = TUNING.customTimer;
  paused = false;
  pauseSel = 0;
  resultSel = 0;
  fightBanner = 0;
  holdT = 0;
  lastDir: Dir | null = null;
  ended = false;

  /** Rounds won in the current set: [you, cpu]. */
  constructor(public m: MatchConfig, public score: [number, number] = [0, 0]) {
    this.b = new Battle(
      { cls: m.p1, deck: playerDeck(m), name: 'YOU', skin: m.p1Skin[m.p1] },
      { cls: m.cpu, deck: toList(starterDeck(m.cpu)), name: 'CPU', skin: m.cpuSkin[m.cpu] },
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
      if (b.winner !== null) this.score[b.winner]++;
      stopMusic();
      if (b.winner === 0) sfx('win');
      playMusic('result', RESULT_SONG);
    }
  }

  private openCustom(): void {
    this.cursor = 0;
    this.lift = [];
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
    for (let i = 0; i < offer.length; i++) {
      const cur = this.lift[i] ?? 0, to = this.level(i) * LIFT;
      this.lift[i] = Math.abs(to - cur) < 0.5 ? to : cur + (to - cur) * Math.min(1, dt * 18);
    }
    this.timer -= dt;
    if (this.timer <= 0) { this.confirmCustom(); return; }
    // mouse: hover a card to read it, click to pick or unpick, right-click to undo
    const over = isHot('fight') ? offer.length : hot('card');
    if (mouse.moved) this.mouseMode = true;
    if (over >= 0 && mouse.moved && over !== this.cursor) { this.cursor = over; sfx('move'); }
    if (mouse.click && over >= 0) { this.cursor = over; this.choose(); return; }
    if (mouse.rclick) {
      const at = this.picks.indexOf(hot('card'));
      if (at >= 0) this.picks.splice(at, 1); else this.picks.pop();
      sfx('back');
      return;
    }
    const prev = navPressed('up', dt) || navPressed('left', dt), next = navPressed('down', dt) || navPressed('right', dt);
    if (prev || next || wasPressed('confirm')) this.mouseMode = false;
    if (prev) { this.cursor = (this.cursor + rows - 1) % rows; sfx('move'); }
    if (next) { this.cursor = (this.cursor + 1) % rows; sfx('move'); }
    if (wasPressed('custom') || (wasPressed('pause') && !wasPressed('confirm'))) { this.confirmCustom(); return; }
    if (wasPressed('confirm')) { this.choose(true); return; }
    if (wasPressed('cast') && this.picks.length) { this.picks.pop(); sfx('back'); }
  }

  /** Raise level of hand card `i`: 0 resting, 1 hovered, 2 picked. */
  private level(i: number): number {
    if (this.picks.includes(i)) return 2;
    const hovered = this.mouseMode ? hot('card') === i : this.cursor === i;
    return hovered ? 1 : 0;
  }

  /** Pick or unpick the card under the cursor, or start the fight from the FIGHT button. */
  private choose(advance = false): void {
    const offer = this.b.offer[0];
    if (this.cursor === offer.length) { this.confirmCustom(); return; }
    const at = this.picks.indexOf(this.cursor);
    if (at >= 0) { this.picks.splice(at, 1); sfx('back'); return; }
    this.picks.push(this.cursor);
    sfx('select');
    // with the keyboard, hop to the next card not yet picked
    if (advance) { this.cursor = Math.min(this.cursor + 1, offer.length); while (this.cursor < offer.length && this.picks.includes(this.cursor)) this.cursor++; }
  }

  private updatePause(dt: number): void {
    const items = 4;
    const clicked = listMouse('menu', this.pauseSel, i => { this.pauseSel = i; sfx('move'); });
    if (clicked >= 0) this.pauseSel = clicked;
    if (mouse.rclick) { this.paused = false; return; }
    if (navPressed('up', dt)) { this.pauseSel = (this.pauseSel + items - 1) % items; sfx('move'); }
    if (navPressed('down', dt)) { this.pauseSel = (this.pauseSel + 1) % items; sfx('move'); }
    if (wasPressed('back') && !wasPressed('pause')) { this.paused = false; return; }
    if (wasPressed('confirm') || clicked >= 0 || (wasPressed('pause') && this.pauseSel === 0)) {
      sfx('select');
      if (this.pauseSel === 0) this.paused = false;
      if (this.pauseSel === 1) setScene(new OptionsScene(() => setScene(this)));
      if (this.pauseSel === 2) setScene(new BattleScene(this.m, this.score));
      if (this.pauseSel === 3) { stopMusic(); setScene(new TitleScene()); }
    }
  }

  private get need(): number { return Math.ceil(this.m.bestOf / 2); }
  private get setOver(): boolean { return Math.max(...this.score) >= this.need; }
  private get resultItems(): string[] {
    return this.setOver ? ['REMATCH', 'CHANGE SETUP', 'TITLE'] : ['NEXT ROUND', 'TITLE'];
  }

  private updateResult(dt: number): void {
    const items = this.resultItems.length;
    const clicked = listMouse('menu', this.resultSel, i => { this.resultSel = i; sfx('move'); });
    if (clicked >= 0) this.resultSel = clicked;
    if (navPressed('up', dt)) { this.resultSel = (this.resultSel + items - 1) % items; sfx('move'); }
    if (navPressed('down', dt)) { this.resultSel = (this.resultSel + 1) % items; sfx('move'); }
    if (wasPressed('confirm') || wasPressed('custom') || clicked >= 0) {
      sfx('select');
      stopMusic();
      const choice = this.resultItems[this.resultSel];
      if (choice === 'NEXT ROUND') setScene(new BattleScene(this.m, this.score));
      if (choice === 'REMATCH') setScene(new BattleScene(this.m));
      if (choice === 'CHANGE SETUP') setScene(new SetupScene());
      if (choice === 'TITLE') setScene(new TitleScene());
    }
  }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    const b = this.b;
    drawBattle(c, b, tick);
    if (b.phase !== 'custom') drawBattleUi(ui, b, tick);
    if (this.m.bestOf > 1 && b.phase !== 'over' && b.phase !== 'custom') {
      const round = this.score[0] + this.score[1] + 1;
      drawTextCentered(ui, `ROUND ${round}   ${this.score[0]}-${this.score[1]}`, UW / 2, 36, '#fcfcfc');
    }
    if (b.phase === 'custom') this.drawCustom(c, tick, ui);
    if (this.fightBanner > 0 && b.phase === 'fight') {
      const s = this.fightBanner > 0.45 ? 'READY' : 'FIGHT!';
      drawTextCentered(ui, s, UW / 2, 124, s === 'FIGHT!' ? '#f8b800' : '#fcfcfc', 6);
    }
    if (b.phase === 'ko' && b.koT > 0.4) drawTextCentered(ui, 'K.O.', UW / 2, 116, '#f83800', 6);
    if (b.phase === 'over') {
      dim(ui, 0.45);
      const won = b.winner === 0;
      if (this.m.bestOf === 1) {
        drawTextCentered(ui, won ? 'YOU WIN!' : 'YOU LOSE', UW / 2, 64, won ? '#f8b800' : '#bcbcbc', 5);
      } else {
        const setWon = this.score[0] >= this.need;
        const title = this.setOver ? (setWon ? 'SET WON!' : 'SET LOST') : won ? 'ROUND WON' : 'ROUND LOST';
        drawTextCentered(ui, title, UW / 2, 56, won ? '#f8b800' : '#bcbcbc', 4);
        drawTextCentered(ui, `YOU ${this.score[0]} - ${this.score[1]} CPU`, UW / 2, 104, '#fcfcfc', 2);
      }
      drawMenu(ui, this.resultItems, this.resultSel, UW / 2, 160, tick, { width: 200, gap: 24 });
      hint(ui, `CLICK OR ${k('attack')}: SELECT`);
    }
    if (this.paused) {
      dim(ui, 0.55);
      drawTextCentered(ui, 'PAUSED', UW / 2, 76, '#fcfcfc', 4);
      drawMenu(ui, ['RESUME', 'OPTIONS', 'RESTART', 'QUIT TO TITLE'], this.pauseSel, UW / 2, 130, tick, { width: 200, gap: 24 });
      hint(ui, `CLICK OR ${k('attack')}: SELECT   ${k('cast')} / RIGHT-CLICK: RESUME`);
    }
  }

  private drawCustom(c: Ctx, tick: number, ui: Ctx): void {
    const b = this.b, f = b.f[0];
    const offer = b.offer[0];
    dim(c, 0.5);

    // header: turn, timer, resource
    P(ui, '#000000', 0, 0, UW, 28);
    P(ui, '#0000a8', 0, 0, UW, 26);
    drawText(ui, `DRAW   TURN ${b.turn}`, 10, 10, '#fcfcfc');
    const secs = Math.ceil(this.timer);
    drawTextCentered(ui, String(secs).padStart(2, '0'), UW / 2, 6, secs <= 5 && tick % 4 < 2 ? '#f83800' : '#f8b800', 2);
    const total = this.picks.reduce((a, i) => { const cc = CARDS[offer[i]].cost; return a + (cc === 'all' ? 1 : cc); }, 0);
    const res = f.cls === 'warrior' ? `RAGE ${f.res.toFixed(1).replace('.0', '')}/5` : `MANA ${f.res}/${f.resMax}`;
    drawText(ui, res, UW - 10 - res.length * 6, 10, f.cls === 'warrior' ? '#f87858' : '#a4e4fc');

    // left: the card being read
    const card = offer[this.cursor] ? CARDS[offer[this.cursor]] : null;
    frame(ui, 8, 34, 228, 146, '#000000', card ? ELEMENT_COLOR[card.element] : '#7c7c7c');
    if (card) drawCardDetail(ui, card, 16, 42, 212);
    else {
      drawText(ui, 'START THE FIGHT', 16, 42, '#f8b800', 2);
      drawText(ui, `${this.picks.length} SPELL${this.picks.length === 1 ? '' : 'S'} PICKED`, 16, 64, '#fcfcfc');
      drawText(ui, `CAST THEM IN ORDER WITH ${k('cast')}`, 16, 78, '#bcbcbc');
      drawText(ui, `CPU DECK: ${STARTER_NAME[this.m.cpu].toUpperCase()}`, 16, 100, '#7c7c7c');
    }

    // right: cast order
    frame(ui, 244, 34, 228, 112, '#000000', PICKED);
    drawText(ui, 'CAST ORDER', 252, 42, PICKED);
    if (!this.picks.length) drawText(ui, 'CLICK CARDS TO QUEUE THEM', 252, 58, '#7c7c7c');
    this.picks.slice(0, 6).forEach((i, n) => {
      const cd = CARDS[offer[i]], y = 56 + n * 12;
      drawText(ui, `${n + 1}`, 252, y, PICKED);
      P(ui, ELEMENT_COLOR[cd.element], 264, y, 3, 7);
      drawText(ui, cd.name.toUpperCase(), 272, y, RARITY_COLOR[cd.rarity]);
      drawText(ui, cd.cost === 'all' ? 'A' : String(cd.cost), 456, y, '#fcfcfc');
    });
    const over = f.cls === 'mage' && total > f.res;
    drawText(ui, `TOTAL COST ${total}`, 252, 130, over ? '#f83800' : '#bcbcbc');
    drawText(ui, f.cls === 'warrior' ? 'PAY ON CAST' : 'REFILLS', 464 - (f.cls === 'warrior' ? 11 : 7) * 6, 130, '#7c7c7c');

    // fight button
    const onOk = this.cursor === offer.length;
    zone('fight', 300, 152, 116, 28);
    frame(ui, 300, 152, 116, 28, onOk ? '#f8b800' : '#000000', '#fcfcfc');
    drawTextCentered(ui, 'FIGHT!', 358, 159, onOk ? '#000000' : '#f8b800', 2, false);

    // the hand
    offer.forEach((id, i) => {
      const x = handX(i, offer.length);
      const order = this.picks.indexOf(i), lvl = this.level(i);
      // the hit box covers every raise level, so a rising card never slips out from under the pointer
      zone(`card:${i}`, x, HAND_Y - 2 * LIFT, CARD_W, CARD_H + 2 * LIFT);
      const y = HAND_Y - Math.round(this.lift[i] ?? 0);
      drawCardFace(ui, CARDS[id], x, y, { order, lit: lvl === 1 || (lvl === 2 && this.cursor === i) });
      if (!this.mouseMode && this.cursor === i && tick % 8 < 6) drawTextCentered(ui, '↓', x + CARD_W / 2, y - 10, '#f8b800', 1, false);
    });
    hint(ui, `CLICK: PICK  RIGHT-CLICK: UNDO   KEYS: ${k('left')}/${k('right')} + ${k('attack')}  ${k('cast')} UNDO  ${k('custom')} FIGHT`);
  }
}
