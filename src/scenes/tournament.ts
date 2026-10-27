// Online Mode > TOURNAMENT: open or join a single-elimination bracket of 4 or 8, then play your sets
// as they come up. Each set is best of 3 through the usual online flow; when it is decided, both
// players come back here and the winner moves on. See src/net/tournament.ts.
import { popScene, replaceScene, hint, zone, listMouse, button, hot, isHot, showSel, type Scene } from './scene';
import { bigButton, actionBar, barTapped, panel, rowList, tallArea, Scroller, GAP, PAD } from './touchUi';
import { getArena } from '../game/battleView';
import { drawStage } from '../art/arena';
import { skinOf } from '../art/sprites';
import { UW, screenRect, spread, vy, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered, drawTextOutlined, textWidth } from '../engine/font';
import { wasPressed, navPressed, k, mouse } from '../engine/input';
import { touchText, type PadMode } from '../engine/touch';
import { sfx } from '../engine/audio';
import { loadMatch, playerDeck, type MatchConfig } from '../game/match';
import { NetSession } from '../net/session';
import { openTransport, pickTransport } from '../net/transport';
import { Lobby, lobbyId } from '../net/lobby';
import { ratingStore } from '../net/rating';
import { tournaments, rounds, setsIn, setIndex, setPlayers, nextSet, champion, setCode, type Bracket, type Size } from '../net/tournament';
import { CharSelectScene } from './select';
import { win, selRow, banner, PAPER, INK, INK2, RED_INK, TRIM, BURN } from './skin';

const MEET_TIMEOUT = 20;

/** The tournament set an online session is playing, so the result can be reported. */
const SETS = new WeakMap<object, { k: number; top: string; bottom: string }>();
/** Sessions whose tournament set is decided, on their way back to the bracket. */
const DONE = new WeakSet<object>();
/** A line for the results screen of a tournament set. */
export const tournamentNote = (net: object): string => (DONE.has(net) ? 'TOURNAMENT SET: BACK TO THE BRACKET IN A MOMENT' : SETS.has(net) ? 'TOURNAMENT SET' : '');

/** A round of a tournament set ended: once the set is decided, report it and head back to the bracket. */
export function tournamentRound(net: NetSession, score: [number, number], need: number): void {
  const t = SETS.get(net);
  if (!t || Math.max(...score) < need) return;
  SETS.delete(net);
  DONE.add(net);
  tournaments.report(t.k, score[0] > score[1] ? t.top : t.bottom);
  // a moment on the results screen, then back to the bracket
  window.setTimeout(() => { net.leave(); replaceScene(new TournamentScene()); }, 5000);
}

type Mode = 'loading' | 'browse' | 'in' | 'meeting' | 'error';

export class TournamentScene implements Scene {
  m: MatchConfig = loadMatch();
  mode: Mode = 'loading';
  lobby: Lobby | null = null;
  sel = 0;
  net: NetSession | null = null;
  t = 0;
  msg = '';
  msgT = 0;
  // phones in portrait: open tournaments as big rows; the bracket as a list of sets, round by round
  private tscroll = new Scroller();
  private tlist: [number, number, number, number] = [0, 0, 0, 0];
  private gone = false;

  enter(): void { void this.begin(); }

  tall(): boolean { return true; }
  pad(): PadMode { return spread.tall ? 'none' : 'back'; }

  private async begin(): Promise<void> {
    const rating = (await (await ratingStore()).mine()).rating;
    const skin = skinOf(this.m.p1, this.m.p1Skin[this.m.p1]).id;
    this.lobby = await Lobby.join({ cls: this.m.p1, skin, rating, bestOf: 3 });
    if (this.gone) { this.lobby?.leave(); return; }
    if (!this.lobby || !(await tournaments.open())) { this.mode = 'error'; return; }
    this.mode = tournaments.tid ? 'in' : 'browse';
  }

  private name(id: string | null): string {
    if (!id) return '';
    if (id === lobbyId()) return 'YOU';
    return this.lobby?.here.find(h => h.e.id === id)?.name ?? `PLAYER ${id.slice(0, 4).toUpperCase()}`;
  }

  private note(s: string): void { this.msg = s; this.msgT = 3; sfx('deny'); }

  private exit(): void {
    this.gone = true;
    this.lobby?.leave();
    this.net?.leave();
    sfx('back');
    popScene();
  }

  private get open(): Bracket[] { return tournaments.all().filter(b => b.state === 'open' && b.tid !== tournaments.tid); }

  private async create(size: Size): Promise<void> {
    if (await tournaments.create(size)) { this.mode = 'in'; sfx('confirm'); } else this.mode = 'error';
  }

  private async meet(b: Bracket, s: NonNullable<ReturnType<typeof nextSet>>): Promise<void> {
    this.mode = 'meeting';
    this.t = 0;
    sfx('confirm');
    try {
      const role = s.top ? 'host' : 'guest', code = setCode(b, s.k);
      const tr = await openTransport(await pickTransport(), role, code);
      if (this.gone || this.mode !== 'meeting') { tr.close(); return; }
      const hello = { cls: this.m.p1, skin: skinOf(this.m.p1, this.m.p1Skin[this.m.p1]).id, deck: playerDeck(this.m) };
      this.net = new NetSession(role, code, hello, tr, 3);
      const [top, bottom] = s.top ? [lobbyId(), s.rival] : [s.rival, lobbyId()];
      SETS.set(this.net, { k: s.k, top, bottom });
    } catch {
      this.fallBack();
    }
  }

  private fallBack(): void {
    this.net?.leave();
    this.net = null;
    tournaments.ready(null);
    this.mode = 'in';
    this.note('COULD NOT REACH YOUR RIVAL: PRESS READY AGAIN');
  }

  update(dt: number): void {
    this.t += dt;
    this.msgT = Math.max(0, this.msgT - dt);
    this.lobby?.tick();
    const back = wasPressed('back') || mouse.rclick || (mouse.click && barTapped('back'));
    // on phones the bar's main button is READY / START, and its middle one LEAVE
    const go = mouse.click && (hot('btn') === 0 || barTapped('primary')), quit = mouse.click && (hot('btn') === 1 || barTapped('mid'));
    if (this.mode === 'error') { if (back || (mouse.click && !spread.tall) || wasPressed('confirm')) this.exit(); return; }
    if (this.mode === 'loading') { if (back) this.exit(); return; }

    if (this.mode === 'meeting') {
      if (back) { this.fallBack(); return; }
      const net = this.net;
      if (!net) { if (this.t > MEET_TIMEOUT) this.fallBack(); return; }
      net.tick();
      if (net.status === 'error' || net.status === 'left' || (this.t > MEET_TIMEOUT && !net.matched)) { this.fallBack(); return; }
      if (net.matched) { this.gone = true; tournaments.ready(null); this.lobby?.leave(); replaceScene(new CharSelectScene(net)); }
      return;
    }

    if (this.mode === 'browse') {
      if (back) { this.exit(); return; }
      if (mouse.click && (hot('btn') === 4 || isHot('t:open4'))) { void this.create(4); return; }
      if (mouse.click && (hot('btn') === 8 || isHot('t:open8'))) { void this.create(8); return; }
      const list = this.open, n = list.length;
      if (spread.tall) this.tscroll.update(...this.tlist);
      if (n) {
        this.sel = Math.min(this.sel, n - 1);
        const clicked = listMouse('row', this.sel, i => { this.sel = i; sfx('move'); });
        if (navPressed('up', dt)) { this.sel = (this.sel + n - 1) % n; sfx('move'); }
        if (navPressed('down', dt)) { this.sel = (this.sel + 1) % n; sfx('move'); }
        if (clicked >= 0 || wasPressed('confirm')) {
          const b = list[clicked >= 0 ? clicked : this.sel];
          void tournaments.join(b.tid).then(ok => { this.mode = ok ? 'in' : 'error'; });
          sfx('select');
        }
      } else if (wasPressed('confirm')) void this.create(4);
      return;
    }

    // in a tournament
    const b = tournaments.current();
    if (!b) {
      if (this.t > 3 && tournaments.tid) { tournaments.leave(); this.note('THE TOURNAMENT ENDED (THE HOST LEFT)'); }
      if (back) this.exit();
      if (!tournaments.tid) this.mode = 'browse';
      return;
    }
    if (back) { this.exit(); return; }
    if (quit) { tournaments.leave(); this.mode = 'browse'; sfx('back'); return; }
    const me = lobbyId();
    const joined = b.players.includes(me);
    if (b.state === 'open') {
      if (!joined && this.t > 4 && b.host !== me) { /* the host has not taken us yet (full?) */ }
      if (b.host === me && (wasPressed('confirm') || go)) {
        if (b.players.length < 2) { this.note('NEED AT LEAST 2 PLAYERS'); return; }
        tournaments.start();
        sfx('confirm');
      }
      return;
    }
    const s = nextSet(b, me);
    if (!s) return;
    const readied = tournaments.readyFor(s.k);
    if (!readied.has(me) && (wasPressed('confirm') || go)) { tournaments.ready(s.k); sfx('select'); }
    if (readied.has(me) && readied.has(s.rival)) void this.meet(b, s);
  }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    drawStage(c, getArena(), tick);
    c.fillStyle = 'rgba(40,20,0,0.35)';
    c.fillRect(...screenRect());
    if (spread.tall) { this.drawTall(ui, tick); return; }
    banner(ui, 'TOURNAMENT', UW / 2, vy(3));
    const dy = vy(36) - 36;
    win(ui, 16, 36 + dy, UW - 32, 252);
    if (this.msgT > 0) drawTextCentered(ui, this.msg, UW / 2, 292 + dy, '#f8b800', 1);

    if (this.mode === 'error') {
      drawTextCentered(ui, 'TOURNAMENTS ARE NOT SUPPORTED YET HERE', UW / 2, 140 + dy, RED_INK, 1, false);
      drawTextCentered(ui, touchText('CLICK TO GO BACK'), UW / 2, 156 + dy, TRIM, 1, false);
      return;
    }
    if (this.mode === 'loading') { drawTextCentered(ui, 'LOADING...', UW / 2, 140 + dy, INK, 1, false); return; }
    if (this.mode === 'browse') { this.drawBrowse(ui, tick, dy); return; }

    const b = tournaments.current();
    if (!b) { drawTextCentered(ui, tick % 8 < 6 ? 'FINDING THE TOURNAMENT...' : '', UW / 2, 140 + dy, INK, 1, false); return; }
    this.drawBracket(ui, b, dy);
    const [status, action] = this.status(b, tick);
    drawTextCentered(ui, status, UW / 2, 246 + dy, b.state === 'done' ? '#007800' : RED_INK, 1, false);
    if (action) button(ui, 'btn:0', `${action} (${k('attack')})`, UW / 2 - 60, 260 + dy, 120, 18, false, RED_INK);
    button(ui, 'btn:1', 'LEAVE', UW - 96, 260 + dy, 64, 18, false, INK2);
    hint(ui, `${k('cast')} / RIGHT-CLICK: BACK (YOU STAY IN)`);
  }

  /** The line under the bracket, and the button for what you can do now ('' for nothing). */
  private status(b: Bracket, tick: number): [string, string] {
    const me = lobbyId();
    let status = '', action = '';
    if (b.state === 'open') {
      status = `WAITING FOR PLAYERS: ${b.players.length} OF ${b.size}`;
      if (b.host === me) action = b.players.length >= 2 ? 'START NOW' : '';
      else if (!b.players.includes(me)) status = b.players.length >= b.size ? 'THIS TOURNAMENT IS FULL' : 'JOINING...';
    } else if (b.state === 'done') {
      const champ = champion(b);
      status = champ === me ? 'YOU WON THE TOURNAMENT!' : `CHAMPION: ${this.name(champ)}`;
    } else {
      const s = nextSet(b, me);
      if (this.mode === 'meeting') status = tick % 8 < 6 ? 'CONNECTING TO YOUR RIVAL...' : '';
      else if (s) {
        const ready = tournaments.readyFor(s.k);
        status = ready.has(me) ? `WAITING FOR ${this.name(s.rival)} TO BE READY` : `YOUR SET: VS ${this.name(s.rival)} (BEST OF 3)`;
        if (!ready.has(me)) action = 'READY';
      } else status = !b.players.includes(me) ? 'WATCHING' : this.inStill(b, me) ? 'WAITING FOR YOUR NEXT RIVAL' : 'YOU ARE OUT: WATCHING';
    }
    return [status, action];
  }

  /** The phone layout: open tournaments to join (or open one), then the bracket with READY in the bar. */
  private drawTall(ui: Ctx, tick: number): void {
    const a = tallArea(), x0 = a.x + PAD, w = a.w - PAD * 2, cx = UW / 2;
    let y = a.y + PAD;
    drawTextCentered(ui, 'TOURNAMENT', cx, y, PAPER, 3, true);
    y += 21 + GAP * 2;
    const b = this.mode === 'in' || this.mode === 'meeting' ? tournaments.current() : null;
    const [status, action] = b ? this.status(b, tick) : ['', ''];
    const barTop = actionBar(ui, {
      back: this.mode === 'meeting' ? 'CANCEL' : undefined,
      primary: action ? { id: 'go', label: action } : undefined,
      mid: b ? { id: 'leave', label: 'LEAVE' } : undefined,
    });
    if (this.msgT > 0) drawTextCentered(ui, this.msg, cx, barTop - GAP - 12, '#f8b800', 1, true);
    const note = (lines: string[], color = INK): void => {
      panel(ui, x0 - 6, y, w + 12, 40 + lines.length * 22);
      lines.forEach((ln, i) => drawTextCentered(ui, ln, cx, y + 20 + i * 22, i ? TRIM : color, 2, false));
    };
    if (this.mode === 'error') { note(['TOURNAMENTS ARE NOT', 'SUPPORTED YET HERE'], RED_INK); return; }
    if (this.mode === 'loading') { note(['LOADING...']); return; }
    if (this.mode === 'browse') { this.drawBrowseTall(ui, x0, y, w, barTop); return; }
    if (!b) { note([tick % 8 < 6 ? 'FINDING THE TOURNAMENT...' : '']); return; }

    // the bracket, a round at a time: one plaque per set, yours lit
    const me = lobbyId(), R = rounds(b.size), sh = 44;
    panel(ui, x0 - 6, y, w + 12, barTop - GAP * 2 - y);
    y += 14;
    const name = (id: string | null, r: number): string => (id ? this.name(id) : b.state === 'open' || r > 0 ? '...' : 'BYE').slice(0, 15);
    for (let r = 0; r < R; r++) {
      drawText(ui, r === R - 1 ? 'FINAL' : r === R - 2 ? 'SEMIFINALS' : 'QUARTERFINALS', x0 + 4, y, RED_INK, 2);
      y += 14 + 8;
      for (let j = 0; j < setsIn(b.size, r); j++) {
        const [p, q] = b.state === 'open' && r === 0 ? [b.players[2 * j] ?? null, b.players[2 * j + 1] ?? null] : setPlayers(b, r, j);
        const won = b.won[setIndex(b.size, r, j)];
        bigButton(ui, `set:${r}:${j}`, '', x0, y, w, sh, { on: p === me || q === me, disabled: true });
        const ink = (id: string | null): string => (won && id === won ? RED_INK : won ? INK2 : INK);
        drawText(ui, name(p, r), x0 + 12, y + 15, ink(p), 2);
        const right = name(q, r);
        drawText(ui, right, x0 + w - 12 - textWidth(right, 2), y + 15, ink(q), 2);
        drawTextCentered(ui, 'VS', cx, y + 15, TRIM, 2, false);
        y += sh + 6;
      }
      y += GAP;
    }
    const sy = Math.max(y + GAP, barTop - GAP * 2 - 36);
    if (sy + 14 < barTop - GAP * 2) drawTextCentered(ui, status, cx, sy, b.state === 'done' ? '#007800' : RED_INK, textWidth(status, 2) <= w ? 2 : 1, false);
  }

  private drawBrowseTall(ui: Ctx, x0: number, y: number, w: number, barTop: number): void {
    const cx = UW / 2, list = this.open;
    // the two OPEN buttons sit low, under the thumb
    let by = barTop - GAP * 2 - 76;
    bigButton(ui, 't:open8', 'OPEN AN 8-PLAYER', x0, by, w, 76, { sub: 'THREE ROUNDS' });
    by -= 76 + GAP;
    bigButton(ui, 't:open4', 'OPEN A 4-PLAYER', x0, by, w, 76, { primary: true, sub: 'TWO ROUNDS' });
    drawTextOutlined(ui, 'OPEN TOURNAMENTS', x0, y, PAPER, 2);
    y += 14 + GAP * 2;
    const lh = by - GAP * 3 - y;
    this.tlist = [x0, y, w, lh];
    this.sel = Math.min(this.sel, Math.max(0, list.length - 1));
    rowList(ui, this.tscroll, 'row', list.length, list.length ? this.sel : -1, x0, y, w, lh, 66, (i, rx, ry, rw) => {
      const t = list[i];
      drawText(ui, `${this.name(t.host).slice(0, 16)}'S TOURNAMENT`.slice(0, Math.floor((rw - 28) / 12)), rx + 14, ry + 14, INK, 2);
      drawText(ui, `${t.players.length} OF ${t.size} JOINED`, rx + 14, ry + 38, INK2, 2);
      drawText(ui, 'JOIN →', rx + rw - 14 - textWidth('JOIN →', 2), ry + 38, RED_INK, 2);
    });
    // every set's length, under the list when there's room
    if (list.length * 72 + 40 < lh) {
      drawTextCentered(ui, 'SINGLE ELIMINATION.', cx, y + lh - 44, TRIM, 2, false);
      drawTextCentered(ui, 'EVERY SET IS BEST OF 3.', cx, y + lh - 24, TRIM, 2, false);
    }
    if (!list.length) {
      drawTextCentered(ui, 'NONE RIGHT NOW. OPEN ONE', cx, y + 30, INK2, 2, false);
      drawTextCentered(ui, 'BELOW AND OTHERS ON THIS', cx, y + 54, INK2, 2, false);
      drawTextCentered(ui, 'PAGE CAN JOIN FROM HERE.', cx, y + 78, INK2, 2, false);
    }
  }

  /** Still in the running: never beaten in a set they played. */
  private inStill(b: Bracket, me: string): boolean {
    for (let r = 0; r < rounds(b.size); r++) for (let j = 0; j < setsIn(b.size, r); j++) {
      const [x, y] = setPlayers(b, r, j), w = b.won[setIndex(b.size, r, j)];
      if (w && w !== me && (x === me || y === me)) return false;
    }
    return true;
  }

  private drawBrowse(ui: Ctx, tick: number, dy: number): void {
    drawText(ui, 'OPEN TOURNAMENTS', 28, 46 + dy, RED_INK);
    const list = this.open;
    if (!list.length) {
      drawTextCentered(ui, 'NONE RIGHT NOW. OPEN ONE BELOW AND', UW / 2, 110 + dy, INK2, 1, false);
      drawTextCentered(ui, 'OTHERS ON THIS PAGE CAN JOIN FROM HERE.', UW / 2, 122 + dy, INK2, 1, false);
    }
    list.slice(0, 8).forEach((b, i) => {
      const y = 62 + dy + i * 18, on = i === this.sel && showSel();
      zone(`row:${i}`, 24, y - 4, UW - 48, 16);
      if (on) selRow(ui, 24, y - 4, UW - 48, 16);
      if (on && tick % 8 < 6) drawText(ui, '→', 30, y, '#fce0a8');
      drawText(ui, `${this.name(b.host)}'S TOURNAMENT`, 44, y, INK);
      const right = `${b.players.length} OF ${b.size} JOINED`;
      drawText(ui, right, UW - 36 - textWidth(right), y, INK2);
    });
    drawTextCentered(ui, 'SINGLE ELIMINATION. EVERY SET IS BEST OF 3.', UW / 2, 222 + dy, TRIM, 1, false);
    button(ui, 'btn:4', 'OPEN A 4-PLAYER', UW / 2 - 150, 240 + dy, 140, 20, false, RED_INK);
    button(ui, 'btn:8', 'OPEN AN 8-PLAYER', UW / 2 + 10, 240 + dy, 140, 20, false, RED_INK);
    hint(ui, `CLICK OR ${k('attack')}: JOIN   ${k('cast')} / RIGHT-CLICK: BACK`);
  }

  private drawBracket(ui: Ctx, b: Bracket, dy: number): void {
    const R = rounds(b.size), colW = (UW - 64) / R, bw = Math.min(140, colW - 16), bh = 22;
    const top = 50 + dy, area = 184;
    for (let r = 0; r < R; r++) {
      const n = setsIn(b.size, r);
      drawText(ui, r === R - 1 ? 'FINAL' : r === R - 2 ? 'SEMIFINALS' : 'QUARTERFINALS', 32 + r * colW, top - 4, TRIM);
      for (let j = 0; j < n; j++) {
        const x = 32 + r * colW, y = Math.round(top + 8 + (area / n) * (j + 0.5) - bh / 2);
        const [p, q] = b.state === 'open' && r === 0 ? [b.players[2 * j] ?? null, b.players[2 * j + 1] ?? null] : setPlayers(b, r, j);
        const w = b.won[setIndex(b.size, r, j)];
        ui.fillStyle = '#f0c880';
        ui.fillRect(x, y, bw, bh);
        ui.fillStyle = BURN;
        ui.fillRect(x, y + bh / 2, bw, 1);
        const line = (id: string | null, yy: number): void => {
          const label = id ? this.name(id) : b.state === 'open' || r > 0 ? '...' : 'BYE';
          drawText(ui, label.slice(0, Math.floor((bw - 8) / 6)), x + 4, yy, w && id === w ? RED_INK : w ? INK2 : INK);
        };
        line(p, y + 2);
        line(q, y + bh / 2 + 3);
        // connector to the next round
        if (r < R - 1) { ui.fillStyle = BURN; ui.fillRect(x + bw, y + bh / 2, colW - bw - 4, 1); }
      }
    }
  }
}
