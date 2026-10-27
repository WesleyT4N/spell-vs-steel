// Online Versus lobby: create a room (and share its code or link) or join one. Fighters and the stage
// are picked together once both players are in (see select.ts and stageSelect.ts).
import { pushScene, replaceScene, popScene, hint, zone, hot, isHot, listMouse, button, showSel, type Scene } from './scene';
import { getArena } from '../game/battleView';
import { drawStage } from '../art/arena';
import { getSprite, drawFighterSprite, teamColor, skinOf } from '../art/sprites';
import { P, UW, frame, screenRect, spread, vy, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered, drawTextOutlined, textWidth } from '../engine/font';
import { wasPressed, navPressed, captureNextKey, k, mouse } from '../engine/input';
import { touchActive, touchCodeBox, touchText, type PadMode } from '../engine/touch';
import { bigButton, actionBar, barTapped, panel, tallArea, TAP, GAP, PAD } from './touchUi';
import { sfx } from '../engine/audio';
import { loadMatch, saveMatch, playerDeck, type MatchConfig } from '../game/match';
import { CODE_LEN, isCodeChar, newRoomCode } from '../net/protocol';
import { NetSession } from '../net/session';
import { openTransport, pickTransport, type TransportKind } from '../net/transport';
import { CharSelectScene } from './select';
import { RankedScene } from './ranked';
import { LobbyScene } from './lobby';
import { TournamentScene } from './tournament';
import { win, selRow, banner, PAPER, BURN, INK, INK2, RED_INK, TRIM } from './skin';
import { CLASS_INFO } from '../game/classes';

const ROWS = ['LOBBY', 'RANKED MATCH', 'TOURNAMENT', 'MATCH', 'CREATE ROOM', 'JOIN ROOM'] as const;
type RowName = (typeof ROWS)[number];
type Mode = 'menu' | 'code' | 'busy' | 'room' | 'error';

const RX = 140, RW = UW - 164, Y0 = 44, RH = 18;
const NET_NAME: Record<TransportKind, string> = { room: 'HOSTED ROOM', peer: 'PEER TO PEER (WEBRTC)', local: 'LOCAL TABS (TEST)' };

export class OnlineScene implements Scene {
  /** How far the top half of the screen moves in phone portrait (set each draw). */
  private dy = 0;
  m: MatchConfig = loadMatch();
  sel: number = ROWS.indexOf('CREATE ROOM');
  mode: Mode = 'menu';
  code = '';
  msg = '';
  kind: TransportKind | null = null;
  net: NetSession | null = null;
  waitT = 0;
  copied = 0;

  /** `join`: a room code from a shared link, joined right away. */
  constructor(private join?: string) {}

  tall(): boolean { return true; }
  pad(): PadMode { return spread.tall ? 'none' : 'back'; }

  /** Taps on the phone layout; true when one was handled. */
  private tallInput(): boolean {
    if (!mouse.click) return false;
    if (barTapped('back')) {
      if (this.mode === 'code') { this.mode = 'menu'; captureNextKey(null); sfx('back'); }
      else if (this.mode === 'busy' || this.mode === 'room') this.cancel();
      else if (this.mode === 'error') { this.mode = 'menu'; sfx('back'); }
      else { sfx('back'); popScene(); }
      return true;
    }
    if (barTapped('primary') && this.mode === 'code' && this.code.length === CODE_LEN) { captureNextKey(null); this.connect('guest'); return true; }
    if (this.mode === 'menu') {
      const bo = hot('bo');
      if (bo >= 0) { this.m.bestOf = ([1, 3, 5] as const)[bo]; saveMatch(this.m); sfx('move'); return true; }
      if (isHot('t:create')) { this.activate('CREATE ROOM'); return true; }
      if (isHot('t:lobby')) { this.activate('LOBBY'); return true; }
      if (isHot('t:ranked')) { this.activate('RANKED MATCH'); return true; }
      if (isHot('t:tournament')) { this.activate('TOURNAMENT'); return true; }
      if (isHot('t:join')) { this.activate('JOIN ROOM'); return true; }
    }
    if (this.mode === 'room' && isHot('t:copy')) { this.copy(); return true; }
    return false;
  }

  enter(): void {
    pickTransport().then(kind => {
      this.kind = kind;
      if (this.join) { this.code = this.join.toUpperCase().slice(0, CODE_LEN); this.connect('guest'); }
    });
  }

  private change(row: RowName, d: 1 | -1): void {
    const cycle = <T>(list: readonly T[], v: T): T => list[(list.indexOf(v) + d + list.length) % list.length];
    if (row === 'MATCH') this.m.bestOf = cycle([1, 3, 5] as const, this.m.bestOf);
    else return;
    sfx('move');
    saveMatch(this.m);
  }

  private activate(row: RowName): void {
    if (row === 'LOBBY') { sfx('select'); saveMatch(this.m); pushScene(new LobbyScene()); return; }
    if (row === 'TOURNAMENT') { sfx('select'); saveMatch(this.m); pushScene(new TournamentScene()); return; }
    if (row === 'RANKED MATCH') { sfx('select'); saveMatch(this.m); pushScene(new RankedScene()); return; }
    if (row === 'CREATE ROOM') { this.code = newRoomCode(); this.connect('host'); return; }
    if (row === 'JOIN ROOM') { this.mode = 'code'; this.code = ''; this.typeCode(); sfx('select'); return; }
    this.change(row, 1);
  }

  /** Type a room code: every key goes to the code box (so letters like M don't mute). */
  private typeCode(): void {
    captureNextKey(c => {
      if (this.mode !== 'code') return;
      if (c === 'Escape') { this.mode = 'menu'; sfx('back'); return; }
      if (c === 'Backspace') this.code = this.code.slice(0, -1);
      else if ((c === 'Enter' || c === 'NumpadEnter') && this.code.length === CODE_LEN) { this.connect('guest'); return; }
      else {
        const ch = c.startsWith('Key') ? c.slice(3) : c.startsWith('Digit') ? c.slice(5) : '';
        if (ch && isCodeChar(ch) && this.code.length < CODE_LEN) { this.code += ch; sfx('move'); }
        else sfx('deny');
      }
      this.typeCode();
    });
  }

  private async connect(role: 'host' | 'guest'): Promise<void> {
    if (!this.kind) return;
    this.mode = 'busy';
    this.msg = role === 'host' ? 'OPENING ROOM...' : `JOINING ${this.code}...`;
    this.waitT = 0;
    sfx('select');
    saveMatch(this.m);
    try {
      const t = await openTransport(this.kind, role, this.code);
      if (this.mode !== 'busy') { t.close(); return; } // backed out meanwhile
      const hello = { cls: this.m.p1, skin: skinOf(this.m.p1, this.m.p1Skin[this.m.p1]).id, deck: playerDeck(this.m) };
      this.net = new NetSession(role, this.code, hello, t, this.m.bestOf);
      this.mode = 'room';
      this.waitT = 0;
    } catch (e) {
      this.fail(e instanceof Error ? e.message : 'CONNECTION FAILED');
    }
  }

  private fail(msg: string): void { this.mode = 'error'; this.msg = msg; sfx('deny'); }

  private cancel(): void {
    if (this.net) { this.net.leave(); this.net = null; }
    this.mode = 'menu';
    sfx('back');
  }

  private get link(): string {
    const u = new URL(location.href);
    u.searchParams.set('room', this.code);
    return u.toString();
  }

  /** Share the bare code where a link can't be opened by the other player (claude.ai rooms, the desktop app). */
  private get codeOnly(): boolean { return this.kind === 'room' || !/^https?:$/.test(location.protocol); }

  private copy(): void {
    const text = this.codeOnly ? this.code : this.link;
    navigator.clipboard?.writeText(text).then(() => { this.copied = 2; sfx('select'); }, () => sfx('deny'));
  }

  update(dt: number): void {
    this.copied = Math.max(0, this.copied - dt);
    this.waitT += dt;
    if (spread.tall && this.tallInput()) return;
    const back = wasPressed('back') || mouse.rclick;
    if (this.mode === 'code') {
      // typed keys are captured, so a 'back' press here is the touch pad's BACK button
      if (mouse.rclick || wasPressed('back')) { this.mode = 'menu'; captureNextKey(null); sfx('back'); }
      if (mouse.click && hot('btn') === 0 && this.code.length === CODE_LEN) { captureNextKey(null); this.connect('guest'); }
      return;
    }
    if (this.mode === 'error') { if (back || mouse.click || wasPressed('confirm')) { this.mode = 'menu'; sfx('back'); } return; }
    if (this.mode === 'busy') { if (back) this.cancel(); return; }
    if (this.mode === 'room') {
      const net = this.net!;
      net.tick();
      if (net.status === 'error' || net.status === 'left') { this.net = null; this.fail(net.status === 'left' ? 'THE OTHER PLAYER LEFT' : net.error); return; }
      if (net.matched) { sfx('confirm'); replaceScene(new CharSelectScene(net)); return; }
      if (mouse.click && hot('btn') === 1) this.copy();
      if (back || (mouse.click && hot('btn') === 2)) this.cancel();
      return;
    }

    if (back) { sfx('back'); popScene(); return; }
    if (mouse.click) {
      const arrow = hot('arrow');
      if (arrow >= 0) { this.sel = arrow >> 1; this.change(ROWS[this.sel], arrow & 1 ? 1 : -1); return; }
    }
    const clicked = listMouse('row', this.sel, i => { this.sel = i; sfx('move'); });
    if (clicked >= 0) { this.sel = clicked; this.activate(ROWS[clicked]); return; }
    if (navPressed('up', dt)) { this.sel = (this.sel + ROWS.length - 1) % ROWS.length; sfx('move'); }
    if (navPressed('down', dt)) { this.sel = (this.sel + 1) % ROWS.length; sfx('move'); }
    const l = navPressed('left', dt), r = navPressed('right', dt);
    if (l || r) this.change(ROWS[this.sel], r ? 1 : -1);
    if (wasPressed('confirm')) this.activate(ROWS[this.sel]);
  }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    drawStage(c, getArena(), tick);
    c.fillStyle = 'rgba(40,20,0,0.35)';
    c.fillRect(...screenRect());
    if (spread.tall) { this.drawTall(ui, tick); return; }
    banner(ui, 'ONLINE MODE', UW / 2, vy(3));
    // phone portrait: the top half moves up and the help box down into the spare height, and rows grow taller
    const dy = this.dy = vy(36) - 36, db = vy(288) - 288;

    // your fighter
    const skin = skinOf(this.m.p1, this.m.p1Skin[this.m.p1]).id;
    const bob = Math.floor(tick / 4) % 2;
    win(ui, 16, 36 + dy, 104, 124, { accent: teamColor(this.m.p1, skin, false) });
    drawTextCentered(ui, 'YOU', 68, 46 + dy, RED_INK, 1, false);
    drawFighterSprite(ui, getSprite(this.m.p1, skin, false), 68, 140 + dy - bob * 2, false, 'none', 4);

    if (this.mode === 'menu') this.drawRows(ui, tick);
    else this.drawPanel(ui, tick);

    // how it connects
    win(ui, 16, 176 + db, UW - 32, 112);
    drawText(ui, 'HOW IT WORKS', 26, 184 + db, RED_INK);
    const lines = [
      'LOBBY: SEE WHO IS ON THIS PAGE, CHAT, AND CHALLENGE THEM.',
      'RANKED MATCH FINDS A RIVAL NEAR YOUR RATING. TOURNAMENT: A BRACKET.',
      'FOR A FRIENDLY, ONE PLAYER PICKS CREATE ROOM AND SHARES THE CODE.',
      'THE OTHER OPENS THIS SAME PAGE, PICKS JOIN ROOM, TYPES IT IN.',
      'THEN BOTH PICK FIGHTERS AND VOTE ON THE STAGE. NO PAUSE ONLINE.',
    ];
    lines.forEach((l, i) => drawText(ui, l, 26, 198 + db + i * 12, INK2));
    drawText(ui, `NETWORK: ${this.kind ? NET_NAME[this.kind] : 'CHECKING...'}`, 26, 266 + db, TRIM);
    hint(ui, this.mode === 'code' ? (touchActive() ? 'TYPE THE CODE, THEN TAP JOIN' : 'TYPE THE CODE   ENTER: JOIN   ESC: BACK')
      : this.mode === 'menu' ? `CLICK OR ${k('attack')}: SELECT   ${k('left')}/${k('right')}: CHANGE   ${k('cast')} / RIGHT-CLICK: BACK`
        : `${k('cast')} / RIGHT-CLICK: BACK`);
  }

  private drawRows(ui: Ctx, tick: number): void {
    const rh = Math.round(RH * spread.k), y0 = Y0 + this.dy;
    win(ui, RX - 8, y0 - 8, RW + 16, ROWS.length * rh + 12);
    ROWS.forEach((row, i) => {
      const y = y0 + i * rh, ty = y + 5 + Math.round((rh - RH) / 2);
      const on = i === this.sel && showSel();
      zone(`row:${i}`, RX - 6, y - 1, RW + 12, rh - 1);
      if (on) selRow(ui, RX - 6, y - 1, RW + 12, rh - 2);
      if (on && tick % 8 < 6) drawText(ui, '→', RX, ty, PAPER);
      if (row === 'LOBBY' || row === 'RANKED MATCH' || row === 'TOURNAMENT' || row === 'CREATE ROOM' || row === 'JOIN ROOM') {
        drawTextCentered(ui, row, RX + RW / 2, ty, RED_INK, 1, false);
        return;
      }
      drawText(ui, row, RX + 14, ty, on ? INK : INK2);
      let value = '';
      if (row === 'MATCH') value = this.m.bestOf === 1 ? 'SINGLE ROUND' : `BEST OF ${this.m.bestOf}`;
      const vx = RX + RW - 16, vw = textWidth(value);
      drawText(ui, value, vx - vw, ty, INK);
      const ax = vx - vw - 16;
      zone(`arrow:${i * 2}`, ax - 4, y - 1, 14, rh - 2);
      zone(`arrow:${i * 2 + 1}`, vx + 2, y - 1, 14, rh - 2);
      drawText(ui, '←', ax, ty, hot('arrow') === i * 2 ? RED_INK : on ? INK : BURN);
      drawText(ui, '→', vx + 6, ty, hot('arrow') === i * 2 + 1 ? RED_INK : on ? INK : BURN);
    });
  }

  private drawPanel(ui: Ctx, tick: number): void {
    const x = RX - 8, w = RW + 16, dy = this.dy;
    win(ui, x, 36 + dy, w, 124);
    const cx = x + w / 2;
    if (this.mode === 'code') {
      drawTextCentered(ui, 'ENTER ROOM CODE', cx, 48 + dy, INK, 1, false);
      for (let i = 0; i < CODE_LEN; i++) {
        const bx = cx - (CODE_LEN * 30) / 2 + i * 30;
        frame(ui, bx, 66 + dy, 26, 30, '#f0c880', i === this.code.length && tick % 8 < 5 ? RED_INK : TRIM);
        if (this.code[i]) drawTextCentered(ui, this.code[i], bx + 13, 73 + dy, RED_INK, 2, false);
      }
      // phones type into a hidden text box over the code boxes
      touchCodeBox(cx - (CODE_LEN * 30) / 2, 66 + dy, CODE_LEN * 30, 30, this.code,
        v => [...v.toUpperCase()].filter(isCodeChar).join('').slice(0, CODE_LEN),
        v => { if (v.length > this.code.length) sfx('move'); this.code = v; },
        () => { if (this.code.length === CODE_LEN) { captureNextKey(null); this.connect('guest'); } });
      if (touchActive()) drawTextCentered(ui, this.code.length === CODE_LEN ? '' : 'TAP THE BOXES TO TYPE', cx, 102 + dy, TRIM, 1, false);
      if (this.code.length === CODE_LEN) button(ui, 'btn:0', 'JOIN', cx - 40, 112 + dy, 80, 20, false, RED_INK);
      return;
    }
    if (this.mode === 'busy') { drawTextCentered(ui, this.msg, cx, 92 + dy, RED_INK, 1, false); return; }
    if (this.mode === 'error') {
      drawTextCentered(ui, this.msg, cx, 84 + dy, RED_INK, 1, false);
      drawTextCentered(ui, touchText('CLICK TO GO BACK'), cx, 104 + dy, TRIM, 1, false);
      return;
    }
    const net = this.net!;
    const host = net.role === 'host';
    drawTextCentered(ui, host ? 'ROOM CODE' : 'JOINED ROOM', cx, 46 + dy, INK2, 1, false);
    drawTextCentered(ui, this.code, cx, 60 + dy, RED_INK, 4, false);
    const rival = net.rival;
    let status: string;
    if (!net.matched) status = host ? 'WAITING FOR A RIVAL TO JOIN' : this.waitT > 12 ? 'NO HOST YET: CHECK THE CODE' : 'WAITING FOR THE HOST';
    else status = `RIVAL: ${rival!.cls.toUpperCase()}   STARTING...`;
    drawTextCentered(ui, tick % 8 < 6 || net.matched ? status : '', cx, 100 + dy, net.matched ? '#007800' : INK, 1, false);
    if (rival) P(ui, teamColor(rival.cls, rival.skin, false), cx - textWidth(status) / 2 - 12, 100 + dy, 7, 7);
    if (host) button(ui, 'btn:1', this.copied > 0 ? 'COPIED!' : this.codeOnly ? 'COPY CODE' : 'COPY LINK', cx - 104, 128 + dy, 100, 20, false, INK);
    button(ui, 'btn:2', 'CANCEL', host ? cx + 4 : cx - 50, 128 + dy, 100, 20, false, INK2);
  }

  /** The phone layout: your fighter, then big buttons and code boxes, with BACK (and JOIN) in the bar. */
  private drawTall(ui: Ctx, tick: number): void {
    const a = tallArea(), x0 = a.x + PAD, w = a.w - PAD * 2;
    let y = a.y + PAD;
    drawTextCentered(ui, 'ONLINE MODE', UW / 2, y, PAPER, 3, true);
    y += 21 + GAP;
    const codeFull = this.code.length === CODE_LEN;
    const barTop = actionBar(ui, {
      back: this.mode === 'busy' || this.mode === 'room' ? 'CANCEL' : undefined,
      primary: this.mode === 'code' ? { id: 'join', label: 'JOIN →', disabled: !codeFull } : undefined,
    });

    // your fighter, on a strip with the network underneath
    const skin = skinOf(this.m.p1, this.m.p1Skin[this.m.p1]).id;
    const bob = Math.floor(tick / 4) % 2;
    panel(ui, x0 - 6, y, w + 12, 120);
    drawFighterSprite(ui, getSprite(this.m.p1, skin, false), x0 + 56, y + 108 - bob * 2, false, 'none', 4);
    drawText(ui, 'YOU', x0 + 120, y + 22, RED_INK, 2);
    drawText(ui, CLASS_INFO[this.m.p1].name, x0 + 120, y + 44, INK, 3);
    drawText(ui, `NETWORK: ${this.kind ? NET_NAME[this.kind] : 'CHECKING...'}`, x0 + 120, y + 80, INK2, 1);
    y += 120 + GAP * 2;

    const cx = UW / 2;
    if (this.mode === 'menu') {
      // the buttons sit low, under the thumb: the lobby, ranked and tournaments, then a friendly by room code;
      // the how-to fills what's left between them and your fighter
      let by = barTop - GAP * 2 - 76;
      bigButton(ui, 't:join', 'JOIN ROOM', x0, by, w, 76, { sub: 'TYPE A FRIEND\'S CODE' });
      by -= 76 + GAP;
      bigButton(ui, 't:create', 'CREATE ROOM', x0, by, w, 76, { primary: true, sub: 'GET A CODE TO SHARE' });
      by -= TAP + GAP * 3;
      const bw = (w - GAP * 2) / 3;
      ['1 ROUND', 'BEST OF 3', 'BEST OF 5'].forEach((l, i) =>
        bigButton(ui, `bo:${i}`, l, x0 + i * (bw + GAP), by, bw, TAP, { primary: this.m.bestOf === [1, 3, 5][i] }));
      drawTextOutlined(ui, 'MATCH LENGTH (NOT RANKED)', x0, by - 22, PAPER, 2);
      by -= 22 + GAP + 76;
      ([['t:lobby', 'LOBBY', 'CHAT, CHALLENGE'], ['t:ranked', 'RANKED', 'RATED, BEST OF 3'], ['t:tournament', 'TOURNEY', 'A BRACKET']] as const)
        .forEach(([id, l, sub], i) => bigButton(ui, id, l, x0 + i * (bw + GAP), by, bw, 76, { sub }));
      drawTextOutlined(ui, 'PLAY ANYONE ON THIS PAGE', x0, by - 22, PAPER, 2);
      const lines = [
        'LOBBY: SEE WHO IS HERE AND CHALLENGE',
        'THEM. RANKED FINDS A RIVAL NEAR YOUR',
        'RATING. FOR A FRIENDLY, ONE PLAYER',
        'CREATES A ROOM, THE OTHER JOINS WITH',
        'ITS 5-LETTER CODE. NO PAUSE ONLINE.',
      ];
      const hh = 44 + lines.length * 16, room = by - 22 - GAP * 2 - y;
      if (room >= hh) {
        const hy = y + Math.round((room - hh) / 2);
        panel(ui, x0 - 6, hy, w + 12, hh);
        drawTextCentered(ui, 'HOW IT WORKS', cx, hy + 14, RED_INK, 2, false);
        lines.forEach((l, i) => drawTextCentered(ui, l, cx, hy + 38 + i * 16, INK2, 1, false));
      }
      return;
    }
    // short enough to stay clear of the phone keyboard
    const ph = Math.min(barTop - GAP - y, 240);
    panel(ui, x0 - 6, y, w + 12, ph);
    if (this.mode === 'code') {
      drawTextCentered(ui, 'ENTER ROOM CODE', cx, y + 20, INK, 2, false);
      const bw = Math.min(72, (w - 24 - GAP * (CODE_LEN - 1)) / CODE_LEN), bh = 88;
      const bx0 = Math.round(cx - (CODE_LEN * bw + (CODE_LEN - 1) * GAP) / 2), by = y + 48;
      for (let i = 0; i < CODE_LEN; i++) {
        const bx = Math.round(bx0 + i * (bw + GAP));
        frame(ui, bx, by, bw, bh, '#f0c880', i === this.code.length && tick % 8 < 5 ? RED_INK : TRIM);
        if (this.code[i]) drawTextCentered(ui, this.code[i], bx + bw / 2, by + 30, RED_INK, 4, false);
      }
      // the phone keyboard types into a hidden text box laid over the boxes
      touchCodeBox(bx0, by, CODE_LEN * bw + (CODE_LEN - 1) * GAP, bh, this.code,
        v => [...v.toUpperCase()].filter(isCodeChar).join('').slice(0, CODE_LEN),
        v => { if (v.length > this.code.length) sfx('move'); this.code = v; },
        () => { if (this.code.length === CODE_LEN) { captureNextKey(null); this.connect('guest'); } });
      drawTextCentered(ui, codeFull ? 'TAP JOIN' : 'TAP THE BOXES TO TYPE', cx, by + bh + 20, TRIM, 2, false);
      return;
    }
    if (this.mode === 'busy') { drawTextCentered(ui, this.msg, cx, y + ph / 2 - 7, RED_INK, 2, false); return; }
    if (this.mode === 'error') {
      drawTextCentered(ui, this.msg, cx, y + ph / 2 - 20, RED_INK, textWidth(this.msg, 2) < w - 24 ? 2 : 1, false);
      drawTextCentered(ui, 'TAP BACK TO TRY AGAIN', cx, y + ph / 2 + 10, TRIM, 1, false);
      return;
    }
    const net = this.net!;
    const host = net.role === 'host';
    drawTextCentered(ui, host ? 'ROOM CODE' : 'JOINED ROOM', cx, y + 20, INK2, 2, false);
    drawTextCentered(ui, this.code, cx, y + 48, RED_INK, 8, false);
    const rival = net.rival;
    let status: string;
    if (!net.matched) status = host ? 'WAITING FOR A RIVAL' : this.waitT > 12 ? 'NO HOST YET: CHECK THE CODE' : 'WAITING FOR THE HOST';
    else status = `RIVAL: ${rival!.cls.toUpperCase()}   STARTING...`;
    drawTextCentered(ui, tick % 8 < 6 || net.matched ? status : '', cx, y + 124, net.matched ? '#007800' : INK, 2, false);
    if (host) bigButton(ui, 't:copy', this.copied > 0 ? 'COPIED!' : this.codeOnly ? 'COPY CODE' : 'COPY LINK', x0 + 20, y + 156, w - 40, TAP);
  }
}
