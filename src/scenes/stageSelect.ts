// Stage select: a live preview of the stage under the cursor with both fighters on it, and a row of stage tiles.
// Online, each player votes; the same pick comes out on both machines (a tie wins, otherwise a seeded coin
// flip between the two votes, shown as a roulette).
import { setScene, hint, zone, hot, showSel, type Scene } from './scene';
import { getStage, STAGE_IDS } from '../art/stages';
import { drawPanel, drawStage, panelFoot } from '../art/arena';
import { useStage } from '../game/battleView';
import { getSprite, drawFighterSprite, skinOf, mirrorSkin } from '../art/sprites';
import { P, W, H, UW, frame, rng, screenRect, fillScreen, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered } from '../engine/font';
import { wasPressed, navPressed, k, mouse } from '../engine/input';
import { sfx } from '../engine/audio';
import { loadMatch, saveMatch, type MatchConfig } from '../game/match';
import type { Hello } from '../net/protocol';
import type { NetSession } from '../net/session';
import { BattleScene } from './battle';
import { OnlineBattleScene } from './onlineBattle';
import { CharSelectScene } from './select';
import { TitleScene } from './title';

/** Stage tiles: every stage, then RANDOM. */
const TILES = [...STAGE_IDS, 'random'];
const ROULETTE = 2.4, REVEAL = 1.2;

// layout (UI pixels)
const VX = 120, VY = 28;              // live preview, 240x160 (half the fight's size)
const TW = 60, TH = 40, TGAP = 4, TY = 238;
const TX0 = Math.round(UW / 2 - (TILES.length * TW + (TILES.length - 1) * TGAP) / 2);

/**
 * The stage both machines play, from the host's and the guest's votes. A RANDOM vote rolls first;
 * matching votes win outright, otherwise a coin flip picks one of the two.
 */
export function resolveStage(seed: number, host: string, guest: string): { stage: string; votes: [string, string] } {
  const r = rng((seed ^ 0x57a9e) >>> 0);
  const roll = (v: string): string => (v === 'random' ? STAGE_IDS[Math.floor(r() * STAGE_IDS.length)] : v);
  const a = roll(host), b = roll(guest);
  return { stage: a === b || r() < 0.5 ? a : b, votes: [a, b] };
}

const thumbs = new Map<string, HTMLCanvasElement>();
/** A still of the stage with its empty grid, shrunk to a tile. */
function thumb(id: string): HTMLCanvasElement {
  let t = thumbs.get(id);
  if (t) return t;
  const full = document.createElement('canvas');
  full.width = W; full.height = H;
  const fc = full.getContext('2d')!;
  const st = getStage(id);
  st.draw(fc, 0, 0);
  for (let r = 0; r < 3; r++) for (let col = 0; col < 6; col++) drawPanel(fc, col, r, 'clean', 0, col < 3 ? 0 : 1, undefined, st);
  t = document.createElement('canvas');
  t.width = TW; t.height = TH;
  const tc = t.getContext('2d')!;
  tc.imageSmoothingEnabled = true;
  tc.imageSmoothingQuality = 'high';
  tc.drawImage(full, 0, 0, TW, TH);
  thumbs.set(id, t);
  return t;
}

export class StageSelectScene implements Scene {
  m: MatchConfig = loadMatch();
  cur: number;
  /** Shown in the preview: the cursor's stage, or the roulette's. */
  view: string;
  /** The picked stage once settled, and the two votes the roulette swings between. */
  final: string | null = null;
  swing: [string, string] | null = null;
  t = 0;
  private preview = document.createElement('canvas');

  constructor(private net?: NetSession) {
    const i = TILES.indexOf(this.m.stage);
    this.cur = i < 0 ? 0 : i;
    this.view = this.cursorStage();
    this.preview.width = W; this.preview.height = H;
    if (net) net.lobby = { ...net.lobby, stage: TILES[this.cur], voted: false };
  }

  private cursorStage(): string { return TILES[this.cur] === 'random' ? STAGE_IDS[Math.floor(this.t * 6) % STAGE_IDS.length] : TILES[this.cur]; }
  private get voted(): boolean { return this.net ? this.net.lobby.voted : this.final !== null; }

  /** Left and right fighters, as the fight will place them. */
  private fighters(): [Pick<Hello, 'cls' | 'skin'>, Pick<Hello, 'cls' | 'skin'>] {
    const net = this.net;
    if (net && net.rival) return net.side === 0 ? [net.hello, net.rival] : [net.rival, net.hello];
    const mine = skinOf(this.m.p1, this.m.p1Skin[this.m.p1]).id;
    const cpu = this.m.p1 === this.m.cpu ? mirrorSkin(this.m.cpu, mine, this.m.cpuSkin[this.m.cpu]) : skinOf(this.m.cpu, this.m.cpuSkin[this.m.cpu]).id;
    return [{ cls: this.m.p1, skin: mine }, { cls: this.m.cpu, skin: cpu }];
  }

  private vote(): void {
    const pick = TILES[this.cur];
    this.m.stage = pick;
    saveMatch(this.m);
    sfx('confirm');
    if (this.net) { this.net.lobby = { ...this.net.lobby, stage: pick, voted: true }; return; }
    this.final = pick === 'random' ? STAGE_IDS[Math.floor(Math.random() * STAGE_IDS.length)] : pick;
    this.swing = null;
    this.t = ROULETTE; // straight to the reveal
  }

  private start(): void {
    useStage(this.final!);
    if (this.net) { setScene(new OnlineBattleScene(this.net, [0, 0], 1)); return; }
    setScene(new BattleScene(this.m));
  }

  update(dt: number): void {
    this.t += dt;
    const net = this.net;
    if (net) {
      net.tick();
      if (net.status === 'error' || net.status === 'left' || net.status === 'lost') {
        if (mouse.click || wasPressed('confirm') || wasPressed('back') || mouse.rclick) { net.transport.close(); setScene(new TitleScene()); }
        return;
      }
      const rl = net.rivalLobby;
      // both votes in: settle it, the same way on both machines
      if (!this.final && net.lobby.voted && rl?.voted) {
        const host = net.side === 0 ? net.lobby.stage : rl.stage, guest = net.side === 0 ? rl.stage : net.lobby.stage;
        const res = resolveStage(net.start!.seed, host, guest);
        this.final = res.stage;
        this.swing = res.votes[0] !== res.votes[1] ? res.votes : null;
        this.t = this.swing ? 0 : ROULETTE;
      }
    }

    if (this.final) {
      const settled = this.t >= ROULETTE;
      if (!settled && this.swing) {
        // swing between the two votes, slowing down, and land on the pick
        const n = Math.floor(Math.sqrt(ROULETTE - this.t) * 9);
        const other = this.swing[0] === this.final ? this.swing[1] : this.swing[0];
        const shown = n % 2 === 0 ? this.final : other;
        if (shown !== this.view) sfx('move');
        this.view = shown;
      } else {
        if (this.view !== this.final) sfx('select');
        this.view = this.final;
      }
      if (this.t >= ROULETTE + REVEAL) {
        if (!net) { this.start(); return; }
        if (net.myReady === 0) net.myReady = 1;
        if (net.remoteReady >= 1) { this.start(); return; }
      }
      return;
    }

    if (wasPressed('back') || mouse.rclick) {
      sfx('back');
      if (net) { if (!this.voted) { net.leave(); setScene(new TitleScene()); } return; }
      setScene(new CharSelectScene(undefined, 4));
      return;
    }
    if (this.voted) { this.view = this.tileStage(net!.lobby.stage); return; }

    const h = hot('stile');
    if (mouse.moved && h >= 0 && h !== this.cur) { this.cur = h; sfx('move'); }
    const l = navPressed('left', dt), r = navPressed('right', dt);
    if (l || r) { this.cur = (this.cur + (r ? 1 : -1) + TILES.length) % TILES.length; sfx('move'); }
    if (net) net.lobby = { ...net.lobby, stage: TILES[this.cur] };
    this.view = this.cursorStage();
    if ((mouse.click && h >= 0) || wasPressed('confirm') || wasPressed('custom')) {
      if (mouse.click && h >= 0) this.cur = h;
      this.vote();
    }
  }

  /** A vote as a stage to show ('random' shows a cycling stage). */
  private tileStage(v: string): string { return v === 'random' ? STAGE_IDS[Math.floor(this.t * 6) % STAGE_IDS.length] : v; }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    const st = getStage(this.view);
    // the full-size stage behind everything, dimmed, and a sharp half-size preview with the fighters on it
    drawStage(c, st, tick);
    c.fillStyle = 'rgba(0,0,24,0.65)';
    c.fillRect(...screenRect());
    const pc = this.preview.getContext('2d')!;
    st.draw(pc, tick, 0);
    for (let r = 0; r < 3; r++) for (let col = 0; col < 6; col++) drawPanel(pc, col, r, 'clean', tick, col < 3 ? 0 : 1, undefined, st);
    const [a, b] = this.fighters(), bob = Math.floor(tick / 4) % 2;
    for (const [f, col, flip] of [[a, 1, false], [b, 4, true]] as const) {
      const foot = panelFoot(col, 1);
      drawFighterSprite(pc, getSprite(f.cls, f.skin, false), foot.x, foot.y - (flip ? bob : 1 - bob), flip);
    }
    frame(ui, VX - 2, VY - 2, W + 4, H + 4, '#000000', '#fcfcfc');
    ui.drawImage(this.preview, VX, VY);

    drawTextCentered(ui, 'SELECT STAGE', UW / 2, 6, '#f8b800', 2);
    drawTextCentered(ui, st.name.toUpperCase(), UW / 2, 196, '#fcfcfc', 2);
    drawTextCentered(ui, st.tag.toUpperCase(), UW / 2, 214, '#bcbcbc', 1);

    const net = this.net, rl = net?.rivalLobby;
    TILES.forEach((id, n) => {
      const x = TX0 + n * (TW + TGAP);
      zone(`stile:${n}`, x, TY, TW, TH);
      const mine = net ? TILES.indexOf(net.lobby.stage) === n : this.cur === n;
      const theirs = !!rl && TILES.indexOf(rl.stage) === n;
      const lit = (this.final && this.view === id) || (!this.final && mine && showSel());
      frame(ui, x, TY, TW, TH, '#000000', lit ? '#f8b800' : hot('stile') === n ? '#fcfcfc' : '#7c7c7c');
      if (id === 'random') {
        P(ui, '#000000', x + 1, TY + 1, TW - 2, TH - 2);
        drawTextCentered(ui, '?', x + TW / 2, TY + 6, '#f8b800', 3, false);
        drawTextCentered(ui, 'RANDOM', x + TW / 2, TY + 30, '#fcfcfc', 1, false);
      } else ui.drawImage(thumb(id), x, TY);
      if (lit) { P(ui, '#f8b800', x - 2, TY - 2, TW + 4, 2); P(ui, '#f8b800', x - 2, TY + TH, TW + 4, 2); P(ui, '#f8b800', x - 2, TY, 2, TH); P(ui, '#f8b800', x + TW, TY, 2, TH); }
      // vote tags under the tile: yours left, theirs right
      const tag = (label: string, color: string, right: boolean, solid: boolean): void => {
        const tw = label.length * 6 + 3, tx = right ? x + TW - tw : x;
        P(ui, solid ? color : '#000000', tx, TY + TH + 2, tw, 10);
        if (!solid) { P(ui, color, tx, TY + TH + 2, tw, 1); P(ui, color, tx, TY + TH + 11, tw, 1); }
        drawText(ui, label, tx + 2, TY + TH + 4, '#fcfcfc');
      };
      if (net) {
        if (mine && (showSel() || net.lobby.voted)) tag('YOU', '#d82800', false, net.lobby.voted);
        if (theirs) tag('RIVAL', '#0058f8', true, !!rl?.voted);
      } else if (mine && showSel()) tag('YOU', '#d82800', false, true);
    });

    let status = '';
    if (this.final && this.t >= ROULETTE) status = tick % 8 < 6 ? 'GET READY!' : '';
    else if (this.final) status = 'VOTES SPLIT: FLIPPING A COIN...';
    else if (net && net.lobby.voted) status = rl?.voted ? '' : tick % 16 < 12 ? 'WAITING FOR RIVAL TO VOTE...' : '';
    else if (net) status = rl?.voted ? 'RIVAL HAS VOTED' : 'VOTE FOR A STAGE';
    if (status) drawTextCentered(ui, status, UW / 2, 294, '#f8b800', 1);

    if (net && (net.status === 'error' || net.status === 'left' || net.status === 'lost')) {
      fillScreen(ui, 'rgba(0,0,0,0.8)', 2);
      drawTextCentered(ui, net.status === 'left' ? 'YOUR RIVAL LEFT' : net.status === 'lost' ? 'CONNECTION LOST' : net.error || 'CONNECTION ERROR', UW / 2, 140, '#f83800', 2);
      hint(ui, 'CLICK: BACK TO TITLE');
      return;
    }
    hint(ui, `${k('left')}/${k('right')} OR HOVER: CHOOSE   ${k('attack')} / CLICK: ${net ? 'VOTE' : 'FIGHT'}   ${k('cast')} / RIGHT-CLICK: ${net ? 'LEAVE' : 'BACK'}`);
  }
}
