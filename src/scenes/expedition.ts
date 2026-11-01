// Expedition (roguelike) screens: the act map, the fights, spell rewards, rest stops, the shop, your deck,
// and the end of the run. Every screen has a phone portrait layout (tall) and the usual one for desktop and
// phone landscape; both offer the same choices.
import { pushScene, replaceScene, popScene, goHome, drawMenu, hint, zone, hot, isHot, listMouse, dim, type Scene } from './scene';
import { BattleScene } from './battle';
import { Battle, NO_INTENT } from '../game/battle';
import { Cpu } from '../game/ai';
import { loadMatch } from '../game/match';
import { useStage, getArena } from '../game/battleView';
import { drawStage } from '../art/arena';
import { getSprite, drawFighterSprite } from '../art/sprites';
import { getMobSprite } from '../art/mobSprites';
import { MOBS } from '../game/mobs';
import { CARDS } from '../game/cards';
import { CLASS_INFO } from '../game/classes';
import {
  choices, makeFight, spellChoices, goldFor, rollRelic, addRelic, addSpell, removeSpell, heal, stock, relicOf, has, newRun,
  REST_HEAL, BOSS_FLOOR, RUN_FLOORS, actOf, nextAct, type ExpeditionRun, type MapNode, type NodeKind, type ShopItem,
} from '../game/expedition';
import { UW, P, screenRect, spread, vy, mix, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered, drawTextOutlined, textWidth, wrap } from '../engine/font';
import { wasPressed, navPressed, k, mouse } from '../engine/input';
import { touchActive, type PadMode } from '../engine/touch';
import { playMusic, stopMusic, sfx } from '../engine/audio';
import { win, plaque, banner, disc, PAPER, INK, INK2, TRIM, RED_INK, BLUE_INK, GOLD, FRAME, WAX } from './skin';
import { actionBar, barTapped, bigButton, panel, tallArea, GAP, PAD, TAP } from './touchUi';
import { drawCardFace, drawCardDetail, CARD_W, CARD_H } from './cardView';
import type { RoundRecord } from '../game/stats';
import type { ReplayMode } from '../game/replay';

const KIND_NAME: Record<NodeKind, string> = { fight: 'FIGHT', elite: 'ELITE', rest: 'REST STOP', shop: 'SHOP', boss: 'BOSS' };
const KIND_TEXT: Record<NodeKind, string[]> = {
  fight: ['A PACK OF MONSTERS.', 'WIN: GOLD + A SPELL.'],
  elite: ['A TOUGH MONSTER.', 'WIN: GOLD, A RELIC', 'AND A RARER SPELL.'],
  rest: ['HEAL OR REMOVE', 'A SPELL.'],
  shop: ['BUY SPELLS, RELICS', 'OR A REMOVAL.'],
  boss: ['THE ACT BOSS.', 'WIN: A LEGENDARY.'],
};

/** The act's stage behind the run's menus, washed out so the parchment reads. */
function backdrop(c: Ctx, tick: number, run: ExpeditionRun): void {
  useStage(actOf(run).stage);
  drawStage(c, getArena(), tick);
  c.fillStyle = 'rgba(40,20,0,0.45)';
  c.fillRect(...screenRect());
}

/** HP, gold, deck size and relics in one line. */
function runLine(run: ExpeditionRun): string {
  return `HP ${Math.ceil(run.hp)}/${run.maxHp}   GOLD ${run.gold}   DECK ${Object.values(run.deck).reduce((a, b) => a + b, 0)}`;
}

// ---------- map ----------

/** Little pictures for map nodes: the pack's first monster, a campfire, a coin purse. */
/** Pointer picking in a list of zones `id:i`. With a mouse, hovering moves the pick and a click acts on what it's on.
 *  With a finger, the first tap only picks and a tap on the picked one acts, so a stray tap never commits.
 *  Returns the index to act on, or -1. */
function pointerPick(id: string, sel: number, pick: (i: number) => void): number {
  const h = hot(id);
  if (h < 0) return -1;
  const finger = touchActive();
  if (mouse.click) {
    if (finger && h !== sel) { pick(h); sfx('move'); return -1; }
    return h;
  }
  if (!finger && mouse.moved && h !== sel) { pick(h); sfx('move'); }
  return -1;
}

/** Seconds a run screen waits before it takes input. */
const SETTLE = 0.3;

/** How a map node reads: one you can pick now, the one picked, one already walked, or one further up. */
type NodeLook = 'open' | 'picked' | 'done' | 'later';

/** One map node: a disc with the monster (or a campfire / coin purse) on it. `z` is the sprite scale. */
function drawNodeIcon(ui: Ctx, n: MapNode, cx: number, cy: number, look: NodeLook, z: number, tick: number): void {
  const r = (n.kind === 'boss' ? 20 : 12) * z + (look === 'picked' ? 2 : 0);
  // elites wear a red ring so they read on the small map too
  const ring = look === 'picked' ? (tick % 16 < 10 ? GOLD : '#fcfcfc') : look === 'open' ? GOLD : n.kind === 'elite' && look === 'later' ? '#d82800' : FRAME;
  if (look === 'picked') disc(ui, cx, cy, r + 5, RED_INK);
  disc(ui, cx, cy, r + 2, ring);
  const face = n.kind === 'elite' ? '#f0c880' : n.kind === 'boss' ? '#fcb8a0' : PAPER;
  disc(ui, cx, cy, r, look === 'done' ? mix(PAPER, '#7c7c7c', 0.5) : look === 'later' ? mix(face, '#5c4c30', 0.55) : face);
  const tint = look === 'done' ? 'ghost' : 'none';
  if (n.pack.length) {
    const s = getMobSprite(n.pack[0]);
    drawFighterSprite(ui, s, cx, cy + Math.round((s.h * z) / 2) - z, true, tint, z);
  } else if (n.kind === 'rest') {
    // a campfire: logs and a flame
    P(ui, INK, cx - 7 * z, cy + 4 * z, 14 * z, 3 * z);
    P(ui, '#f83800', cx - 4 * z, cy - 4 * z, 8 * z, 8 * z); P(ui, '#f8b800', cx - 2 * z, cy - 6 * z, 4 * z, 9 * z); P(ui, '#fcfcfc', cx - z, cy - z, 2 * z, 3 * z);
  } else if (n.kind === 'shop') {
    // a coin purse
    P(ui, INK, cx - 6 * z, cy - 3 * z, 12 * z, 10 * z); P(ui, '#ac7c00', cx - 5 * z, cy - 2 * z, 10 * z, 8 * z); P(ui, INK, cx - 3 * z, cy - 6 * z, 6 * z, 3 * z);
    P(ui, GOLD, cx - 2 * z, cy + z, 4 * z, 3 * z);
  }
  if (n.kind === 'elite' && z > 1) drawTextOutlined(ui, 'ELITE', cx - textWidth('ELITE') / 2, cy + r - 4, GOLD);
}

export class ExpeditionMapScene implements Scene {
  sel = 0;
  t = 0;
  quitting = false;
  quitSel = 1;
  /** Node centers from the last draw, for taps. */
  private spots = new Map<number, [number, number]>();
  /** Seconds left on the new act's title card (after an act boss). */
  introT = 0;
  constructor(public run: ExpeditionRun, newAct = false) { if (newAct) this.introT = 3; }

  enter(): void { playMusic('menu'); }
  resume(): void { playMusic('menu'); }
  pad(): PadMode { return 'none'; }
  tall(): boolean { return true; }

  /** The nodes you can go to next, left to right, so left/right on the keys and pad move the way they look. */
  private get options(): MapNode[] { return [...choices(this.run)].sort((a, b) => a.lane - b.lane); }

  private go(n: MapNode): void {
    const run = this.run;
    sfx('select');
    run.at = n.id;
    run.path.push(n.id);
    run.stats.floors = run.act * (BOSS_FLOOR + 1) + n.floor + 1;
    if (n.kind === 'rest') { replaceScene(new RestScene(run)); return; }
    if (n.kind === 'shop') { replaceScene(new ShopScene(run)); return; }
    stopMusic();
    useStage(actOf(run).stage);
    replaceScene(new ExpeditionBattleScene(run, n));
  }

  update(dt: number): void {
    this.t += dt;
    // a beat before taking input, so keys mashed in the fight (or on the screen before) don't pick anything
    if (this.t < SETTLE) return;
    if (this.introT > 0) {
      this.introT -= dt;
      if (mouse.click || wasPressed('confirm') || wasPressed('attack') || wasPressed('back')) { this.introT = 0; sfx('select'); }
      return;
    }
    const opts = this.options;
    this.sel = Math.min(this.sel, opts.length - 1);
    if (this.quitting) { this.updateQuit(dt); return; }
    if (spread.tall && mouse.click) {
      if (barTapped('back')) { this.quitting = true; this.quitSel = 1; sfx('back'); return; }
      if (barTapped('mid')) { sfx('select'); pushScene(new DeckScene(this.run, 'view')); return; }
      if (barTapped('primary')) { this.go(opts[this.sel]); return; }
    }
    const act = pointerPick('node', this.sel, i => { this.sel = i; });
    if (act >= 0) { this.go(opts[act]); return; }
    if (!spread.tall && mouse.click && isHot('deck')) { sfx('select'); pushScene(new DeckScene(this.run, 'view')); return; }
    if (!spread.tall && mouse.click && isHot('quit')) { this.quitting = true; this.quitSel = 1; sfx('back'); return; }
    const n = opts.length;
    if (navPressed('left', dt) && this.sel > 0) { this.sel--; sfx('move'); }
    if (navPressed('right', dt) && this.sel < n - 1) { this.sel++; sfx('move'); }
    if (wasPressed('cast')) { sfx('select'); pushScene(new DeckScene(this.run, 'view')); return; }
    if (wasPressed('back') || wasPressed('pause') || mouse.rclick) { this.quitting = true; this.quitSel = 1; sfx('back'); return; }
    if (wasPressed('confirm') || wasPressed('attack')) this.go(opts[this.sel]);
  }

  private updateQuit(dt: number): void {
    if (spread.tall && mouse.click) {
      if (isHot('quit:yes')) { stopMusic(); goHome(); return; }
      if (isHot('quit:no') || barTapped('back')) { this.quitting = false; sfx('back'); return; }
    }
    const clicked = listMouse('menu', this.quitSel, i => { this.quitSel = i; sfx('move'); });
    if (navPressed('up', dt) || navPressed('down', dt)) { this.quitSel = 1 - this.quitSel; sfx('move'); }
    if (wasPressed('back') || mouse.rclick) { this.quitting = false; sfx('back'); return; }
    if (wasPressed('confirm') || wasPressed('attack') || clicked >= 0) {
      if ((clicked >= 0 ? clicked : this.quitSel) === 0) { stopMusic(); goHome(); } else { this.quitting = false; sfx('back'); }
    }
  }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    backdrop(c, tick, this.run);
    if (spread.tall) { this.drawTall(ui, tick); return; }
    const run = this.run;
    banner(ui, `ACT ${run.act + 1}: ${actOf(run).name}`, UW / 2, vy(3));
    // you, on the left
    const lx = 8, ly = vy(36), lw = 112, lh = vy(296) - ly;
    win(ui, lx, ly, lw, lh);
    drawFighterSprite(ui, getSprite(run.cls, run.skin, false), lx + lw / 2, ly + 62 - (Math.floor(tick / 4) % 2) * 2, false, 'none', 2);
    drawTextCentered(ui, CLASS_INFO[run.cls].name, lx + lw / 2, ly + 68, INK, 1, false);
    const hpLow = run.hp / run.maxHp < 0.3;
    drawTextCentered(ui, `HP ${Math.ceil(run.hp)}/${run.maxHp}`, lx + lw / 2, ly + 82, hpLow ? RED_INK : INK, 1, false);
    drawTextCentered(ui, `GOLD ${run.gold}`, lx + lw / 2, ly + 94, TRIM, 1, false);
    drawTextCentered(ui, 'RELICS', lx + lw / 2, ly + 112, RED_INK, 1, false);
    if (!run.relics.length) drawTextCentered(ui, 'NONE YET', lx + lw / 2, ly + 124, INK2, 1, false);
    run.relics.forEach((id, i) => drawTextCentered(ui, relicOf(id).name, lx + lw / 2, ly + 124 + i * 10, INK, 1, false));
    // the deck and quit buttons
    const by = ly + lh - 44;
    this.smallButton(ui, 'deck', `${k('cast')}: DECK (${Object.values(run.deck).reduce((a, b) => a + b, 0)})`, lx + 6, by, lw - 12);
    this.smallButton(ui, 'quit', 'ABANDON RUN', lx + 6, by + 20, lw - 12);

    // the map
    const top = vy(66), bottom = vy(286);
    this.drawMap(ui, tick, UW / 2, 70, top, bottom, false);

    // the chosen node, on the right
    const rx = UW - 120, rw = 112;
    const n = this.options[this.sel];
    win(ui, rx, ly, rw, lh, { accent: n.kind === 'boss' || n.kind === 'elite' ? GOLD : undefined });
    this.drawInfo(ui, n, rx, ly, rw, 1);
    if (this.quitting) this.drawQuit(ui, tick);
    else hint(ui, `CLICK OR ${k('left')}/${k('right')}: PICK   ${k('attack')}: GO   ${k('cast')}: DECK`);
    this.drawIntro(ui);
  }

  private smallButton(ui: Ctx, id: string, label: string, x: number, y: number, w: number): void {
    zone(id, x, y, w, 16);
    const text = plaque(ui, x, y, w, 16, isHot(id));
    drawTextCentered(ui, label, x + w / 2, y + 5, text, 1, false);
  }

  /** The node's name, what's in it, and what you get. */
  private drawInfo(ui: Ctx, n: MapNode, x: number, y: number, w: number, s: number): void {
    const cx = x + w / 2;
    drawTextCentered(ui, KIND_NAME[n.kind], cx, y + 10 * s, n.kind === 'boss' ? RED_INK : BLUE_INK, s + (s > 1 ? 0 : 1), false);
    let yy = y + 30 * s;
    for (const id of new Set(n.pack)) {
      const d = MOBS[id], count = n.pack.filter(p => p === id).length, sp = getMobSprite(id);
      drawFighterSprite(ui, sp, cx, yy + sp.h, true, 'none', s);
      yy += sp.h * s + 4;
      drawTextCentered(ui, count > 1 ? `${d.name} X${count}` : d.name, cx, yy, INK, 1, false);
      yy += 10;
      if (s > 1 || n.pack.length === 1) for (const l of wrap(d.blurb.toUpperCase(), Math.floor((w - 8) / 6))) { drawTextCentered(ui, l, cx, yy, INK2, 1, false); yy += 9; }
      yy += 4;
    }
    for (const l of KIND_TEXT[n.kind]) for (const part of wrap(l, Math.floor((w - 8) / 6))) { drawTextCentered(ui, part, cx, yy + 4, TRIM, 1, false); yy += 10; }
  }

  /** Floors bottom to top, lanes left to right, the path you took inked red. */
  private drawMap(ui: Ctx, tick: number, cx: number, laneW: number, top: number, bottom: number, big: boolean): void {
    const run = this.run, opts = this.options, step = (bottom - top) / BOSS_FLOOR;
    const pos = (n: MapNode): [number, number] => [Math.round(cx + (n.lane - 1) * laneW), Math.round(bottom - n.floor * step)];
    this.spots.clear();
    // paths first
    for (const n of run.map) for (const id of n.next) {
      const m = run.map[id], [x0, y0] = pos(n), [x1, y1] = pos(m);
      const walked = run.path.includes(n.id) && run.path.includes(m.id);
      const toPick = n.id === run.at && opts.includes(m);
      const steps = Math.max(4, Math.round(Math.hypot(x1 - x0, y1 - y0) / 6));
      for (let i = 1; i < steps; i++) {
        if (!walked && !toPick && i % 2) continue;
        const x = x0 + ((x1 - x0) * i) / steps, y = y0 + ((y1 - y0) * i) / steps;
        P(ui, walked ? RED_INK : toPick ? GOLD : mix(INK, PAPER, 0.35), Math.round(x) - 1, Math.round(y) - 1, 3, 3);
      }
    }
    // big phone maps draw the sprites at 2x when the floors are tall enough
    const z = big && step >= 72 && laneW >= 90 ? 2 : 1;
    for (const n of run.map) {
      const [x, y] = pos(n), i = opts.indexOf(n), can = i >= 0, now = i === this.sel;
      this.spots.set(n.id, [x, y]);
      // the whole lane cell is the tap / click target, not just the disc
      if (can) zone(`node:${i}`, x - laneW / 2, y - step / 2, laneW, n.kind === 'boss' ? step * 1.4 : step);
      const look: NodeLook = now ? 'picked' : can ? 'open' : run.path.includes(n.id) ? 'done' : 'later';
      drawNodeIcon(ui, n, x, y, look, n.kind === 'boss' ? 1 : z, tick);
    }
    // labels last, so the floor above never covers them
    // (the small desktop map has no room: there the red path and the picked ring say it)
    if (z > 1) for (const n of run.map) {
      const [x, y] = pos(n), r = (n.kind === 'boss' ? 20 : 12 * z) + 2;
      if (n.id === run.at && n.kind !== 'elite') drawTextOutlined(ui, 'YOU', x - textWidth('YOU') / 2, y + r - 4, '#fcfcfc');
      if (opts.indexOf(n) === this.sel) drawTextOutlined(ui, '↓', x - 2, y - r - 12 + (tick % 8 < 4 ? 0 : 2), GOLD);
    }
  }

  /** The new act's title card: ACT 2, its name, and the full heal. */
  private drawIntro(ui: Ctx): void {
    if (this.introT <= 0) return;
    dim(ui, 0.75);
    const cy = spread.tall ? tallArea().y + tallArea().h / 2 : vy(150);
    drawTextCentered(ui, `ACT ${this.run.act + 1}`, UW / 2, cy - 44, GOLD, 2, true);
    drawTextCentered(ui, actOf(this.run).name, UW / 2, cy - 18, '#fcfcfc', 4, true);
    drawTextCentered(ui, 'FULLY HEALED', UW / 2, cy + 26, '#58d854', 2, true);
  }

  private drawQuit(ui: Ctx, tick: number): void {
    dim(ui, 0.6);
    drawTextCentered(ui, 'ABANDON THIS RUN?', UW / 2, vy(110), '#fcfcfc', 3);
    drawMenu(ui, ['YES, ABANDON', 'NO, KEEP GOING'], this.quitSel, UW / 2, vy(150), tick, { width: 180, gap: 22 });
  }

  private drawTall(ui: Ctx, tick: number): void {
    const run = this.run, a = tallArea(), x0 = a.x + PAD, w = a.w - PAD * 2;
    let y = a.y + PAD;
    drawTextCentered(ui, actOf(run).name, UW / 2, y, PAPER, 3, true);
    y += 26;
    drawTextCentered(ui, runLine(run), UW / 2, y, run.hp / run.maxHp < 0.3 ? '#f87858' : '#fcfcfc', 1, true);
    y += 12;
    drawTextCentered(ui, run.relics.length ? run.relics.map(id => relicOf(id).name).join('  ') : 'NO RELICS YET', UW / 2, y, GOLD, 1, true);
    y += 16;
    const barTop = actionBar(ui, { back: 'ABANDON', mid: { id: 'deck', label: 'DECK' }, primary: { id: 'go', label: 'GO!' } });
    // the chosen node's card above the bar, the map above that
    const infoH = 92, iy = barTop - GAP - infoH;
    const n = this.options[this.sel];
    panel(ui, x0, iy, w, infoH);
    drawTextCentered(ui, KIND_NAME[n.kind], x0 + w / 2, iy + 10, n.kind === 'boss' ? RED_INK : BLUE_INK, 2, false);
    const names = [...new Set(n.pack)].map(id => { const c = n.pack.filter(p => p === id).length; return c > 1 ? `${MOBS[id].name} X${c}` : MOBS[id].name; });
    const lines = [...(names.length ? [names.join(', ')] : []), ...KIND_TEXT[n.kind]];
    lines.slice(0, 4).forEach((l, i) => drawTextCentered(ui, l, x0 + w / 2, iy + 32 + i * 12, i === 0 && names.length ? INK : TRIM, 1, false));
    this.drawMap(ui, tick, UW / 2, Math.min(130, Math.round(w / 3.4)), y + 30, iy - 30, true);
    if (this.quitting) {
      dim(ui, 0.6);
      const by = a.y + a.h / 2 - TAP - GAP;
      drawTextCentered(ui, 'ABANDON THIS RUN?', UW / 2, by - 40, '#fcfcfc', 3);
      bigButton(ui, 'quit:yes', 'YES, ABANDON', x0, by, w, TAP);
      bigButton(ui, 'quit:no', 'NO, KEEP GOING', x0, by + TAP + GAP, w, TAP, { primary: true });
    }
    this.drawIntro(ui);
  }
}

// ---------- fights ----------

/** A CPU that never plays: the monsters run on their own patterns. */
const IDLE = { intent: () => NO_INTENT, pick: () => [], wantsDraw: () => false } as unknown as Cpu;

/** A map fight: one round against the pack. A win goes to the rewards, a loss ends the run. */
export class ExpeditionBattleScene extends BattleScene {
  private left = false;
  constructor(private run: ExpeditionRun, private node: MapNode, battle?: Battle) {
    useStage(actOf(run).stage);
    const m = { ...loadMatch(), p1: run.cls, p1Deck: 'starter', bestOf: 1 as const, sides: ['player', 'cpu'] as ['player', 'cpu'] };
    m.p1Skin = { ...m.p1Skin, [run.cls]: run.skin };
    super(m, [0, 0], battle ?? makeFight(run, node.pack, undefined, 1), [], ['player', 'cpu']);
    this.cpu = IDLE;
    this.rivalName = node.kind === 'boss' ? 'BOSS' : 'PACK';
    this.pauseItems = ['RESUME', 'OPTIONS', 'RETRY FIGHT', 'ABANDON RUN'];
  }

  protected get keepsReplays(): boolean { return false; }
  protected rivalDeckText(): string { return `PACK: ${this.node.pack.map(id => MOBS[id].name).join(', ')}`; }
  protected get replayMode(): ReplayMode { return 'cpu'; }
  // RETRY: the same fight again from the HP you came in with
  protected again(_score: [number, number], _rounds: RoundRecord[]): Scene { return new ExpeditionBattleScene(this.run, this.node); }

  update(dt: number): void {
    super.update(dt);
    if (this.b.phase !== 'over' || this.left) return;
    this.left = true;
    const run = this.run, b = this.b, me = b.f[0];
    run.stats.secs += this.stats.fightSecs;
    run.stats.dealt += b.stats[0].basic + b.stats[0].spell + b.stats[0].other;
    run.stats.taken += Math.max(0, run.hp - me.hp);
    run.stats.kills += b.mobs.filter(m => m.dead).length;
    run.hp = Math.max(0, Math.min(run.maxHp, Math.ceil(me.hp)));
    if (b.winner !== 0) { run.over = 'dead'; replaceScene(new RunOverScene(run)); return; }
    run.stats.fights++;
    if (this.node.kind === 'elite') run.stats.elites++;
    if (has(run, 'sapflask')) heal(run, 0.05);
    replaceScene(new RewardScene(run, this.node));
  }
}

// ---------- rewards ----------

/** After a win: the gold, any relic, then pick 1 of 3 spells (or skip for a little gold). */
export class RewardScene implements Scene {
  sel = 0;
  t = 0;
  gold: number;
  relic: string | null = null;
  offer: string[];
  constructor(private run: ExpeditionRun, private node: MapNode) {
    this.gold = goldFor(run, node.kind);
    run.gold += this.gold;
    if (node.kind === 'elite') { this.relic = rollRelic(run); if (this.relic) addRelic(run, this.relic); }
    this.offer = spellChoices(run, node.kind);
  }

  enter(): void { playMusic('victory'); }
  pad(): PadMode { return 'none'; }
  tall(): boolean { return true; }

  private get count(): number { return this.offer.length + 1; }

  private take(i: number): void {
    const run = this.run;
    if (i < this.offer.length) { addSpell(run, this.offer[i]); sfx('confirm'); } else { run.gold += 10; sfx('select'); }
    if (this.node.kind === 'boss') {
      // the act is cleared: on to the next one (fully healed), or the run is won
      if (nextAct(run)) { replaceScene(new ExpeditionMapScene(run, true)); return; }
      run.over = 'won'; replaceScene(new RunOverScene(run)); return;
    }
    replaceScene(new ExpeditionMapScene(run));
  }

  update(dt: number): void {
    this.t += dt;
    // a beat before taking input, so keys mashed in the fight (or on the screen before) don't pick anything
    if (this.t < SETTLE) return;
    if (spread.tall && mouse.click && barTapped('primary')) { this.take(this.sel); return; }
    const act = pointerPick('pick', this.sel, i => { this.sel = i; });
    if (act >= 0) { this.take(act); return; }
    if (navPressed('left', dt) || navPressed('up', dt)) { this.sel = (this.sel + this.count - 1) % this.count; sfx('move'); }
    if (navPressed('right', dt) || navPressed('down', dt)) { this.sel = (this.sel + 1) % this.count; sfx('move'); }
    if (wasPressed('confirm') || wasPressed('attack')) this.take(this.sel);
  }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    backdrop(c, tick, this.run);
    const tall = spread.tall, a = tall ? tallArea() : null;
    const top = a ? a.y + PAD : vy(3);
    if (a) drawTextCentered(ui, 'VICTORY!', UW / 2, top, PAPER, 3, true); else banner(ui, 'VICTORY!', UW / 2, top);
    let y = top + 30;
    drawTextCentered(ui, `+${this.gold} GOLD   (${this.run.gold} TOTAL)`, UW / 2, y, GOLD, tall ? 2 : 1, true);
    y += tall ? 20 : 12;
    if (this.relic) { const r = relicOf(this.relic); drawTextCentered(ui, `RELIC: ${r.name} - ${r.text}`, UW / 2, y, '#fcfcfc', 1, true); y += 12; }
    drawTextCentered(ui, this.node.kind === 'boss' ? 'CLAIM A LEGENDARY SPELL' : 'ADD A SPELL TO YOUR DECK', UW / 2, y + 4, PAPER, tall ? 2 : 1, true);
    y += tall ? 26 : 18;
    // the offered cards in a row, then SKIP
    const n = this.offer.length, gap = 10, rowW = n * CARD_W + (n - 1) * gap, x0 = Math.round(UW / 2 - rowW / 2);
    this.offer.forEach((id, i) => {
      const x = x0 + i * (CARD_W + gap), lift = i === this.sel ? -6 : 0;
      zone(`pick:${i}`, x, y, CARD_W, CARD_H);
      drawCardFace(ui, CARDS[id], x, y + lift, { lit: i === this.sel });
      const have = this.run.deck[id] ?? 0;
      if (have) drawTextCentered(ui, `YOU HAVE ${have}`, x + CARD_W / 2, y + CARD_H + 4, '#fcfcfc', 1, true);
    });
    y += CARD_H + 16;
    const skipSel = this.sel === n;
    // details of the card picked
    const card = this.sel < n ? CARDS[this.offer[this.sel]] : null;
    if (tall && a) {
      const barTop = actionBar(ui, { back: false, primary: { id: 'take', label: skipSel ? 'SKIP (+10 GOLD)' : 'TAKE IT' } });
      bigButton(ui, `pick:${n}`, 'SKIP: +10 GOLD', a.x + PAD, y, a.w - PAD * 2, TAP, { on: skipSel });
      y += TAP + GAP;
      if (card) { panel(ui, a.x + PAD, y, a.w - PAD * 2, barTop - GAP - y); drawCardDetail(ui, card, a.x + PAD + 10, y + 10, a.w - PAD * 2 - 20, 2); }
      return;
    }
    const sw = 160, sx = UW / 2 - sw / 2;
    zone(`pick:${n}`, sx, y, sw, 18);
    const ink = plaque(ui, sx, y, sw, 18, skipSel);
    drawTextCentered(ui, 'SKIP: +10 GOLD', UW / 2, y + 6, ink, 1, false);
    y += 26;
    if (card) { win(ui, 70, y, UW - 140, vy(300) - y); drawCardDetail(ui, card, 80, y + 8, UW - 160, 1); }
    hint(ui, `CLICK OR ${k('left')}/${k('right')}: PICK   ${k('attack')}: TAKE`);
  }
}

// ---------- rest ----------

export class RestScene implements Scene {
  t = 0;
  sel = 0;
  constructor(private run: ExpeditionRun) {}
  enter(): void { playMusic('menu'); }
  resume(): void { if (this.removed) replaceScene(new ExpeditionMapScene(this.run)); }
  pad(): PadMode { return 'none'; }
  tall(): boolean { return true; }
  private removed = false;
  private get share(): number { return has(this.run, 'moonwell') ? 0.5 : REST_HEAL; }
  private get items(): string[] {
    const amt = Math.min(this.run.maxHp - this.run.hp, Math.round(this.run.maxHp * this.share));
    return [`HEAL ${Math.round(this.share * 100)}% (+${amt} HP)`, 'REMOVE A SPELL'];
  }

  private choose(i: number): void {
    sfx('select');
    if (i === 0) { heal(this.run, this.share); sfx('confirm'); replaceScene(new ExpeditionMapScene(this.run)); return; }
    pushScene(new DeckScene(this.run, 'remove', () => { this.removed = true; }));
  }

  update(dt: number): void {
    this.t += dt;
    // a beat before taking input, so keys mashed in the fight (or on the screen before) don't pick anything
    if (this.t < SETTLE) return;
    if (spread.tall && mouse.click) { const h = hot('rest'); if (h >= 0) { this.choose(h); return; } }
    const clicked = listMouse('menu', this.sel, i => { this.sel = i; sfx('move'); });
    if (navPressed('up', dt) || navPressed('down', dt)) { this.sel = 1 - this.sel; sfx('move'); }
    if (wasPressed('confirm') || wasPressed('attack') || clicked >= 0) this.choose(clicked >= 0 ? clicked : this.sel);
  }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    backdrop(c, tick, this.run);
    const run = this.run;
    if (spread.tall) {
      const a = tallArea(), x0 = a.x + PAD, w = a.w - PAD * 2;
      let y = a.y + PAD;
      drawTextCentered(ui, 'REST STOP', UW / 2, y, PAPER, 3, true);
      y += 30;
      drawTextCentered(ui, runLine(run), UW / 2, y, '#fcfcfc', 1, true);
      y = a.y + Math.round(a.h * 0.22);
      this.drawFire(ui, tick, UW / 2 + 20, y + 40, 4);
      y = a.y + Math.round(a.h * 0.5);
      this.items.forEach((label, i) => { bigButton(ui, `rest:${i}`, label, x0, y, w, TAP + 10, { primary: i === 0 }); y += TAP + 10 + GAP; });
      return;
    }
    banner(ui, 'REST STOP', UW / 2, vy(3));
    drawTextCentered(ui, runLine(run), UW / 2, vy(40), '#fcfcfc', 1, true);
    this.drawFire(ui, tick, UW / 2, vy(110), 2);
    drawMenu(ui, this.items, this.sel, UW / 2, vy(170), tick, { width: 220, gap: 24 });
    hint(ui, `CLICK OR ${k('up')}/${k('down')} + ${k('attack')}: CHOOSE`);
  }

  private drawFire(ui: Ctx, tick: number, cx: number, cy: number, s: number): void {
    const f = Math.floor(tick / 6) % 2;
    P(ui, INK, cx - 14 * s, cy + 6 * s, 28 * s, 4 * s);
    P(ui, '#f83800', cx - 8 * s, cy - 10 * s + f * s, 16 * s, 16 * s - f * s);
    P(ui, '#f8b800', cx - 4 * s, cy - 14 * s - f * s, 8 * s, 18 * s);
    P(ui, '#fcfcfc', cx - 2 * s, cy - 2 * s, 4 * s, 6 * s);
    drawFighterSprite(ui, getSprite(this.run.cls, this.run.skin, false), cx - 28 * s, cy + 10 * s, false, 'none', s);
  }
}

// ---------- shop ----------

export class ShopScene implements Scene {
  t = 0;
  sel = 0;
  items: ShopItem[];
  private removing: ShopItem | null = null;
  constructor(private run: ExpeditionRun) { this.items = stock(run); }
  enter(): void { playMusic('menu'); }
  resume(): void {
    // back from the deck after paying for a removal
    if (this.removing && this.done) { this.removing.sold = true; this.run.gold -= this.removing.price; this.run.removeCost += 25; }
    this.removing = null; this.done = false;
  }
  private done = false;
  pad(): PadMode { return 'none'; }
  tall(): boolean { return true; }
  private get count(): number { return this.items.length + 1; }

  private label(it: ShopItem): string {
    if (it.kind === 'spell') return CARDS[it.id].name.toUpperCase();
    if (it.kind === 'relic') return relicOf(it.id).name;
    return 'REMOVE A SPELL';
  }

  private buy(i: number): void {
    if (i >= this.items.length) { sfx('select'); replaceScene(new ExpeditionMapScene(this.run)); return; }
    const it = this.items[i], run = this.run;
    if (it.sold || run.gold < it.price) { sfx('back'); return; }
    if (it.kind === 'remove') { this.removing = it; sfx('select'); pushScene(new DeckScene(run, 'remove', () => { this.done = true; })); return; }
    run.gold -= it.price;
    it.sold = true;
    if (it.kind === 'spell') addSpell(run, it.id); else addRelic(run, it.id);
    sfx('confirm');
  }

  update(dt: number): void {
    this.t += dt;
    // a beat before taking input, so keys mashed in the fight (or on the screen before) don't pick anything
    if (this.t < SETTLE) return;
    if (spread.tall && mouse.click && barTapped('back')) { replaceScene(new ExpeditionMapScene(this.run)); return; }
    if (spread.tall && mouse.click && barTapped('primary')) { this.buy(this.sel); return; }
    const act = pointerPick('shop', this.sel, i => { this.sel = i; });
    if (act >= 0) { this.buy(act); return; }
    if (navPressed('up', dt)) { this.sel = (this.sel + this.count - 1) % this.count; sfx('move'); }
    if (navPressed('down', dt)) { this.sel = (this.sel + 1) % this.count; sfx('move'); }
    if (wasPressed('back') || mouse.rclick) { sfx('back'); replaceScene(new ExpeditionMapScene(this.run)); return; }
    if (wasPressed('confirm') || wasPressed('attack')) this.buy(this.sel);
  }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    backdrop(c, tick, this.run);
    const run = this.run, tall = spread.tall, a = tall ? tallArea() : null;
    const x0 = a ? a.x + PAD : 40, w = a ? a.w - PAD * 2 : 230;
    let y = a ? a.y + PAD : vy(3);
    if (a) drawTextCentered(ui, 'SHOP', UW / 2, y, PAPER, 3, true); else banner(ui, 'SHOP', UW / 2, y);
    y += 30;
    drawTextCentered(ui, `GOLD ${run.gold}`, a ? UW / 2 : x0 + w / 2, y, GOLD, 2, true);
    y += 22;
    const rowH = tall ? TAP : 20;
    const rows = [...this.items.map(it => ({ it, text: this.label(it) })), { it: null, text: 'LEAVE' }];
    const barTop = a ? actionBar(ui, { back: 'LEAVE', primary: { id: 'buy', label: this.sel < this.items.length ? 'BUY' : 'LEAVE' } }) : 0;
    rows.forEach(({ it, text }, i) => {
      const yy = y + i * (rowH + (tall ? 6 : 4)), on = i === this.sel;
      if (tall && !it) return; // LEAVE lives in the bar on phones
      zone(`shop:${i}`, x0, yy, w, rowH);
      const sold = !!it?.sold, poor = !!it && !sold && run.gold < it.price;
      const ink = plaque(ui, x0, yy, w, rowH, on);
      const s = tall ? 2 : 1, ty = yy + Math.round((rowH - 7 * s) / 2);
      drawText(ui, text, x0 + 8, ty, sold ? TRIM : on ? ink : INK, s);
      if (it) {
        const price = sold ? 'SOLD' : `${it.price}G`;
        drawText(ui, price, x0 + w - 8 - textWidth(price, s), ty, sold ? TRIM : poor ? RED_INK : on ? ink : INK, s);
      }
    });
    // what the selected item is
    const it = this.items[this.sel];
    if (!it) { if (!tall) hint(ui, `CLICK OR ${k('up')}/${k('down')} + ${k('attack')}: BUY`); return; }
    if (tall && a) {
      const py = y + this.items.length * (rowH + 6) + GAP, ph = Math.max(60, barTop - GAP - py);
      panel(ui, x0, py, w, ph);
      if (it.kind === 'spell') drawCardDetail(ui, CARDS[it.id], x0 + 10, py + 10, w - 20, 2);
      else drawTextCentered(ui, it.kind === 'relic' ? relicOf(it.id).text : 'TAKE ONE SPELL OUT OF YOUR DECK', UW / 2, py + 20, INK, 2, false);
      return;
    }
    const px = x0 + w + 16, pw = UW - px - 16, py = vy(36), ph = vy(296) - py;
    win(ui, px, py, pw, ph);
    if (it.kind === 'spell') {
      drawCardFace(ui, CARDS[it.id], px + Math.round((pw - CARD_W) / 2), py + 10, {});
      drawCardDetail(ui, CARDS[it.id], px + 8, py + CARD_H + 20, pw - 16, 1);
    } else {
      const lines = wrap(it.kind === 'relic' ? relicOf(it.id).text : 'TAKE ONE SPELL OUT OF YOUR DECK.', Math.floor((pw - 16) / 6));
      drawTextCentered(ui, it.kind === 'relic' ? 'RELIC' : 'SERVICE', px + pw / 2, py + 12, BLUE_INK, 2, false);
      lines.forEach((l, i) => drawTextCentered(ui, l, px + pw / 2, py + 40 + i * 10, INK, 1, false));
    }
    hint(ui, `CLICK OR ${k('up')}/${k('down')} + ${k('attack')}: BUY   ${k('cast')}: LEAVE`);
  }
}

// ---------- your deck ----------

/** Your run's spell deck: look through it, or pick one to remove (rest stop, shop). */
export class DeckScene implements Scene {
  sel = 0;
  constructor(private run: ExpeditionRun, private mode: 'view' | 'remove', private onRemove?: () => void) {}
  pad(): PadMode { return 'none'; }
  tall(): boolean { return true; }
  private get ids(): string[] {
    return Object.keys(this.run.deck).sort((x, y) => {
      const a = CARDS[x], b = CARDS[y], ca = typeof a.cost === 'number' ? a.cost : 6, cb = typeof b.cost === 'number' ? b.cost : 6;
      return ca - cb || a.name.localeCompare(b.name);
    });
  }

  update(dt: number): void {
    const ids = this.ids, n = ids.length;
    if (spread.tall && mouse.click && barTapped('back')) { sfx('back'); popScene(); return; }
    if (spread.tall && mouse.click && barTapped('primary') && this.mode === 'remove') { this.remove(ids[this.sel]); return; }
    const act = pointerPick('card', this.sel, i => { this.sel = i; });
    // viewing, a click only reads the card; removing, a click removes it (a finger taps twice: once to pick, once to remove)
    if (act >= 0) { if (this.mode === 'remove') this.remove(ids[act]); else this.sel = act; return; }
    const cols = spread.tall ? 1 : 2;
    if (navPressed('up', dt)) { this.sel = (this.sel + n - cols) % n; sfx('move'); }
    if (navPressed('down', dt)) { this.sel = (this.sel + cols) % n; sfx('move'); }
    if (cols > 1 && (navPressed('left', dt) || navPressed('right', dt))) { this.sel = this.sel % 2 ? this.sel - 1 : Math.min(n - 1, this.sel + 1); sfx('move'); }
    if (wasPressed('back') || wasPressed('cast') || mouse.rclick) { sfx('back'); popScene(); return; }
    if ((wasPressed('confirm') || wasPressed('attack')) && this.mode === 'remove') this.remove(ids[this.sel]);
  }

  private remove(id: string | undefined): void {
    if (!id) return;
    removeSpell(this.run, id);
    sfx('confirm');
    this.onRemove?.();
    popScene();
  }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    backdrop(c, tick, this.run);
    const ids = this.ids, run = this.run, total = Object.values(run.deck).reduce((a, b) => a + b, 0);
    this.sel = Math.min(this.sel, ids.length - 1);
    const title = this.mode === 'remove' ? 'REMOVE A SPELL' : `YOUR DECK (${total})`;
    const card = CARDS[ids[this.sel]];
    if (spread.tall) {
      const a = tallArea(), x0 = a.x + PAD, w = a.w - PAD * 2;
      let y = a.y + PAD;
      drawTextCentered(ui, title, UW / 2, y, PAPER, 3, true);
      y += 30;
      const barTop = actionBar(ui, { back: '← BACK', primary: this.mode === 'remove' ? { id: 'remove', label: 'REMOVE IT' } : undefined });
      const detailH = 170, rowH = 26, rows = Math.max(1, Math.floor((barTop - GAP - detailH - GAP - y) / (rowH + 4)));
      const first = Math.max(0, Math.min(ids.length - rows, this.sel - Math.floor(rows / 2)));
      ids.slice(first, first + rows).forEach((id, j) => {
        const i = first + j, yy = y + j * (rowH + 4);
        zone(`card:${i}`, x0, yy, w, rowH);
        const ink = plaque(ui, x0, yy, w, rowH, i === this.sel);
        drawText(ui, `${run.deck[id]}X ${CARDS[id].name.toUpperCase()}`, x0 + 8, yy + 6, i === this.sel ? ink : INK, 2);
      });
      if (card) { const py = barTop - GAP - detailH; panel(ui, x0, py, w, detailH); drawCardDetail(ui, card, x0 + 10, py + 10, w - 20, 2); }
      return;
    }
    banner(ui, title, UW / 2, vy(3));
    const x0 = 16, colW = 136, rowH = 15, y0 = vy(36);
    ids.forEach((id, i) => {
      const x = x0 + (i % 2) * (colW + 6), y = y0 + Math.floor(i / 2) * (rowH + 3);
      zone(`card:${i}`, x, y, colW, rowH);
      const ink = plaque(ui, x, y, colW, rowH, i === this.sel);
      drawText(ui, `${run.deck[id]}X ${CARDS[id].name.toUpperCase()}`.slice(0, 21), x + 5, y + 4, i === this.sel ? ink : INK, 1);
    });
    const px = x0 + colW * 2 + 18, pw = UW - px - 12;
    if (card) {
      win(ui, px, y0, pw, vy(296) - y0);
      drawCardFace(ui, card, px + Math.round((pw - CARD_W) / 2), y0 + 8, { lit: true });
      drawCardDetail(ui, card, px + 8, y0 + CARD_H + 18, pw - 16, 1);
    }
    hint(ui, this.mode === 'remove' ? `${touchActive() ? 'TAP TWICE' : 'CLICK'} OR ${k('attack')}: REMOVE   ${k('cast')}: BACK` : `${k('cast')}: BACK`);
  }
}

// ---------- the end ----------

export class RunOverScene implements Scene {
  t = 0;
  sel = 0;
  constructor(private run: ExpeditionRun) {}
  enter(): void { stopMusic(); playMusic(this.run.over === 'won' ? 'victory' : 'menu'); }
  pad(): PadMode { return 'none'; }
  tall(): boolean { return true; }
  private readonly items = ['NEW RUN', 'TITLE'];

  private choose(i: number): void {
    sfx('select');
    if (i === 0) replaceScene(new ExpeditionMapScene(newRun(this.run.cls, this.run.skin)));
    else goHome();
  }

  update(dt: number): void {
    this.t += dt;
    // a beat before taking input, so keys mashed in the fight (or on the screen before) don't pick anything
    if (this.t < SETTLE) return;
    if (spread.tall && mouse.click) {
      if (barTapped('back')) { this.choose(1); return; }
      if (barTapped('primary')) { this.choose(0); return; }
    }
    const clicked = listMouse('menu', this.sel, i => { this.sel = i; sfx('move'); });
    if (navPressed('up', dt) || navPressed('down', dt)) { this.sel = 1 - this.sel; sfx('move'); }
    if (wasPressed('confirm') || wasPressed('attack') || clicked >= 0) this.choose(clicked >= 0 ? clicked : this.sel);
  }

  private lines(): string[] {
    const s = this.run.stats, mins = Math.floor(s.secs / 60), secs = Math.floor(s.secs % 60);
    return [
      `FLOORS CLEARED  ${s.floors}/${RUN_FLOORS}`,
      `FIGHTS WON  ${s.fights}   ELITES  ${s.elites}`,
      `MONSTERS DEFEATED  ${s.kills}`,
      `DAMAGE DEALT  ${s.dealt}`,
      `FIGHTING TIME  ${mins}:${String(secs).padStart(2, '0')}`,
      `SPELL DECK  ${Object.values(this.run.deck).reduce((a, b) => a + b, 0)} SPELLS`,
      `RELICS  ${this.run.relics.length ? this.run.relics.map(id => relicOf(id).name).join(', ') : 'NONE'}`,
    ];
  }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    backdrop(c, tick, this.run);
    const won = this.run.over === 'won', title = won ? 'EXPEDITION CLEARED!' : 'RUN OVER';
    if (spread.tall) {
      const a = tallArea(), x0 = a.x + PAD, w = a.w - PAD * 2;
      let y = a.y + PAD;
      drawTextCentered(ui, title, UW / 2, y, won ? GOLD : '#f87858', 3, true);
      y += 34;
      const barTop = actionBar(ui, { back: 'TITLE', primary: { id: 'again', label: 'NEW RUN' } });
      panel(ui, x0, y, w, barTop - GAP - y);
      drawFighterSprite(ui, getSprite(this.run.cls, this.run.skin, false), UW / 2, y + 90, false, won ? 'none' : 'ghost', 3);
      this.lines().forEach((l, i) => { for (const [j, part] of wrap(l, Math.floor((w - 20) / 6)).entries()) drawTextCentered(ui, part, UW / 2, y + 110 + i * 22 + j * 10, INK, 1, false); });
      return;
    }
    banner(ui, title, UW / 2, vy(3));
    const px = 70, pw = UW - 140, py = vy(40), ph = vy(230) - py;
    win(ui, px, py, pw, ph, { accent: won ? GOLD : WAX });
    drawFighterSprite(ui, getSprite(this.run.cls, this.run.skin, false), px + 50, py + 80, false, won ? 'none' : 'ghost', 2);
    this.lines().forEach((l, i) => { for (const [j, part] of wrap(l, 44).entries()) drawText(ui, part, px + 100, py + 14 + i * 18 + j * 9, INK, 1); });
    drawMenu(ui, this.items, this.sel, UW / 2, vy(244), tick, { width: 160, gap: 20 });
    hint(ui, `CLICK OR ${k('up')}/${k('down')} + ${k('attack')}: SELECT`);
  }
}

/** Title > EXPEDITION MODE, after the fighter is picked: a fresh run. */
export function startExpedition(cls: ExpeditionRun['cls'], skin: string): void {
  pushScene(new ExpeditionMapScene(newRun(cls, skin)));
}
