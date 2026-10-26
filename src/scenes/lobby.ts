// Online Mode > LOBBY: everyone on the page right now, a chat, and challenges. Pick a player and
// challenge them; once they accept, both go through the usual online flow (fighters, stage vote) as a
// friendly room match. The challenger's match length is used.
import { setScene, hint, zone, hot, listMouse, button, showSel, type Scene } from './scene';
import { getArena } from '../game/battleView';
import { drawStage } from '../art/arena';
import { teamColor, skinOf } from '../art/sprites';
import { CLASS_INFO } from '../game/classes';
import { P, UW, screenRect, vy, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered, textWidth, wrap, hasGlyph } from '../engine/font';
import { wasPressed, navPressed, k, mouse } from '../engine/input';
import { touchActive, touchText } from '../engine/touch';
import { textField, textFieldFocused, focusTextField, blurTextField } from '../engine/textField';
import { sfx } from '../engine/audio';
import { loadMatch, playerDeck, type MatchConfig } from '../game/match';
import { NetSession } from '../net/session';
import { openTransport, pickTransport } from '../net/transport';
import { Lobby, CHAT_MAX, type Here } from '../net/lobby';
import { ratingStore, settlePending } from '../net/rating';
import { CharSelectScene } from './select';
import { OnlineScene } from './online';
import { win, selRow, banner, INK, INK2, RED_INK, TRIM, BURN } from './skin';

type Mode = 'loading' | 'lobby' | 'meeting' | 'error';
const MEET_TIMEOUT = 15;
const LX = 16, LW = 180, RX = 204, RW = UW - 220, TOP = 36, H = 252, ROW = 14;

const clean = (s: string): string => [...s.toUpperCase()].filter(ch => hasGlyph(ch)).join('').slice(0, CHAT_MAX);

export class LobbyScene implements Scene {
  m: MatchConfig = loadMatch();
  mode: Mode = 'loading';
  lobby: Lobby | null = null;
  sel = 0;
  draft = '';
  msg = '';
  msgT = 0;
  net: NetSession | null = null;
  t = 0;
  private gone = false;

  enter(): void { void this.begin(); }

  private async begin(): Promise<void> {
    const rating = await settlePending(await ratingStore());
    const skin = skinOf(this.m.p1, this.m.p1Skin[this.m.p1]).id;
    const lobby = await Lobby.join({ cls: this.m.p1, skin, rating: rating.rating, bestOf: this.m.bestOf });
    if (this.gone) { lobby?.leave(); return; }
    if (!lobby) { this.mode = 'error'; return; }
    this.lobby = lobby;
    this.mode = 'lobby';
  }

  private note(s: string): void { this.msg = s; this.msgT = 3; }

  private leave(): void {
    this.gone = true;
    blurTextField();
    this.lobby?.leave();
    this.net?.leave();
    sfx('back');
    setScene(new OnlineScene());
  }

  private send(): void {
    const t = clean(this.draft);
    if (t && this.lobby) { this.lobby.say(t); sfx('move'); }
    this.draft = '';
  }

  private challenge(h: Here): void {
    const l = this.lobby!;
    if (l.me.ch?.to === h.e.id) { l.cancelChallenge(); sfx('back'); return; }
    l.challenge(h.e.id);
    sfx('select');
  }

  private async meet(): Promise<void> {
    const meet = this.lobby!.meet!;
    this.mode = 'meeting';
    this.t = 0;
    sfx('confirm');
    try {
      const t = await openTransport(await pickTransport(), meet.role, meet.code);
      if (this.gone || this.mode !== 'meeting') { t.close(); return; }
      const hello = { cls: this.m.p1, skin: skinOf(this.m.p1, this.m.p1Skin[this.m.p1]).id, deck: playerDeck(this.m) };
      this.net = new NetSession(meet.role, meet.code, hello, t, this.m.bestOf);
    } catch {
      this.fallThrough();
    }
  }

  /** The challenge never turned into a match: back to the lobby. */
  private fallThrough(): void {
    this.net?.leave();
    this.net = null;
    this.lobby?.leave();
    this.lobby = null;
    this.mode = 'loading';
    this.note('COULD NOT CONNECT TO YOUR RIVAL');
    void this.begin();
  }

  update(dt: number): void {
    this.t += dt;
    this.msgT = Math.max(0, this.msgT - dt);
    const typing = textFieldFocused();
    const back = !typing && (wasPressed('back') || mouse.rclick);
    if (this.mode === 'error') { if (back || mouse.click || wasPressed('confirm')) this.leave(); return; }
    if (this.mode === 'meeting') {
      if (back) { this.leave(); return; }
      const net = this.net;
      if (!net) { if (this.t > MEET_TIMEOUT) this.fallThrough(); return; }
      net.tick();
      if (net.status === 'error' || net.status === 'left' || (this.t > MEET_TIMEOUT && !net.matched)) { this.fallThrough(); return; }
      if (net.matched) { this.gone = true; blurTextField(); this.lobby?.leave(); setScene(new CharSelectScene(net)); }
      return;
    }
    const l = this.lobby;
    if (!l) { if (back) this.leave(); return; }
    l.tick();
    if (l.meet) { void this.meet(); return; }
    if (l.answer) { this.note(l.answer === 'declined' ? 'YOUR CHALLENGE WAS TURNED DOWN' : 'THEY LEFT THE LOBBY'); l.answer = null; sfx('deny'); }

    // a challenge to us comes first
    const inc = l.incoming[0];
    if (inc) {
      if (mouse.click && hot('btn') === 10) { l.accept(inc.e.id); return; }
      if (mouse.click && hot('btn') === 11) { l.decline(inc.e.id); sfx('back'); return; }
      if (!typing && wasPressed('confirm')) { l.accept(inc.e.id); return; }
      if (back || (!typing && wasPressed('custom'))) { l.decline(inc.e.id); sfx('back'); return; }
      return;
    }
    if (back) { this.leave(); return; }
    if (typing) return;

    const n = l.here.length;
    if (n) {
      this.sel = Math.min(this.sel, n - 1);
      const clicked = listMouse('row', this.sel, i => { this.sel = i; sfx('move'); });
      if (clicked >= 0) this.sel = clicked;
      if (navPressed('up', dt)) { this.sel = (this.sel + n - 1) % n; sfx('move'); }
      if (navPressed('down', dt)) { this.sel = (this.sel + 1) % n; sfx('move'); }
      if (wasPressed('confirm') || (mouse.click && hot('btn') === 0)) this.challenge(l.here[this.sel]);
    }
    if (wasPressed('custom')) focusTextField();
  }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    drawStage(c, getArena(), tick);
    c.fillStyle = 'rgba(40,20,0,0.35)';
    c.fillRect(...screenRect());
    banner(ui, 'LOBBY', UW / 2, vy(3));
    const dy = vy(TOP) - TOP;
    const l = this.lobby;

    win(ui, LX, TOP + dy, LW, H);
    win(ui, RX, TOP + dy, RW, H);
    if (this.mode === 'error') {
      drawTextCentered(ui, 'THE LOBBY NEEDS THE CLAUDE.AI PAGE', UW / 2, 140 + dy, RED_INK, 1, false);
      drawTextCentered(ui, touchText('CLICK TO GO BACK'), UW / 2, 156 + dy, TRIM, 1, false);
      return;
    }
    if (!l) { drawTextCentered(ui, 'JOINING THE LOBBY...', UW / 2, 140 + dy, INK, 1, false); return; }

    // who is here
    drawText(ui, `HERE NOW (${l.here.length + 1})`, LX + 10, TOP + 8 + dy, RED_INK);
    const y0 = TOP + 24 + dy;
    P(ui, teamColor(l.me.cls, l.me.skin, false), LX + 10, y0, 7, 7);
    drawText(ui, l.myName === 'YOU' ? 'YOU' : `${l.myName.slice(0, 12)} (YOU)`, LX + 22, y0, INK2);
    drawText(ui, String(l.me.rating), LX + LW - 10 - textWidth(String(l.me.rating)), y0, INK2);
    const shown = l.here.slice(0, 11);
    shown.forEach((h, i) => {
      const y = y0 + (i + 1) * ROW, on = i === this.sel && showSel();
      zone(`row:${i}`, LX + 4, y - 3, LW - 8, ROW - 1);
      if (on) selRow(ui, LX + 4, y - 3, LW - 8, ROW - 1);
      P(ui, teamColor(h.e.cls, h.e.skin, false), LX + 10, y, 7, 7);
      const challenged = l.me.ch?.to === h.e.id;
      drawText(ui, h.name.slice(0, 14), LX + 22, y, INK);
      const right = challenged ? 'ASKED' : String(h.e.rating);
      drawText(ui, right, LX + LW - 10 - textWidth(right), y, challenged ? RED_INK : on ? INK : INK2);
    });
    if (!l.here.length) {
      drawText(ui, 'NOBODY ELSE YET.', LX + 10, y0 + 22, INK2);
      drawText(ui, 'SHARE THIS PAGE TO PLAY.', LX + 10, y0 + 34, INK2);
    }
    if (l.searching) drawText(ui, `${l.searching} IN THE RANKED QUEUE`, LX + 10, TOP + H - 46 + dy, TRIM);
    const pick = l.here[this.sel];
    if (pick) {
      const asked = l.me.ch?.to === pick.e.id;
      drawText(ui, `${CLASS_INFO[pick.e.cls].name.toUpperCase()}, ${pick.e.bestOf === 1 ? 'SINGLE ROUND' : `BEST OF ${pick.e.bestOf}`}`, LX + 10, TOP + H - 34 + dy, INK2);
      button(ui, 'btn:0', asked ? 'CANCEL' : 'CHALLENGE', LX + 20, TOP + H - 24 + dy, LW - 40, 18, false, asked ? INK2 : RED_INK);
    }

    // chat
    drawText(ui, 'CHAT', RX + 10, TOP + 8 + dy, RED_INK);
    const maxChars = Math.floor((RW - 20) / 6);
    const lines: Array<[string, string]> = [];
    for (const ln of l.log) for (const [i, w] of wrap(`${ln.name}: ${ln.text}`, maxChars).entries()) lines.push([i ? `  ${w}` : w, ln.mine ? RED_INK : INK]);
    const fit = Math.floor((H - 52) / 11);
    lines.slice(-fit).forEach(([s, col], i) => drawText(ui, s, RX + 10, TOP + 22 + dy + i * 11, col));
    if (!l.log.length) drawText(ui, 'SAY HELLO!', RX + 10, TOP + 22 + dy, INK2);
    // the typing box
    const bx = RX + 8, by = TOP + H - 24 + dy, bw = RW - 16, bh = 16;
    const focused = textFieldFocused();
    P(ui, focused ? '#fff4d8' : '#f0c880', bx, by, bw, bh);
    P(ui, focused ? RED_INK : BURN, bx, by + bh - 1, bw, 1);
    const shownDraft = clean(this.draft);
    const tail = shownDraft.slice(-(maxChars - 1));
    if (shownDraft || focused) drawText(ui, tail + (focused && tick % 16 < 9 ? '_' : ''), bx + 4, by + 5, INK);
    else drawText(ui, touchActive() ? 'TAP HERE TO CHAT' : `CLICK HERE OR ${k('custom')} TO CHAT`, bx + 4, by + 5, INK2);
    if (this.mode === 'lobby') textField(bx, by, bw, bh, this.draft, CHAT_MAX, v => { this.draft = v; }, () => { this.send(); });

    if (this.msgT > 0) drawTextCentered(ui, this.msg, UW / 2, TOP + H + 4 + dy, '#f8b800', 1);

    // a challenge to us
    const inc = l.incoming[0];
    if (inc && this.mode === 'lobby') {
      const w = 260, x = UW / 2 - w / 2, y = 110 + dy;
      win(ui, x, y, w, 76, { accent: teamColor(inc.e.cls, inc.e.skin, false) });
      drawTextCentered(ui, `${inc.name} CHALLENGES YOU!`, UW / 2, y + 12, RED_INK, 1, false);
      drawTextCentered(ui, `${CLASS_INFO[inc.e.cls].name.toUpperCase()}   RATING ${inc.e.rating}   ${inc.e.bestOf === 1 ? 'SINGLE ROUND' : `BEST OF ${inc.e.bestOf}`}`, UW / 2, y + 26, INK2, 1, false);
      button(ui, 'btn:10', `ACCEPT (${k('attack')})`, x + 20, y + 46, 100, 20, false, RED_INK);
      button(ui, 'btn:11', `DECLINE (${k('custom')})`, x + w - 120, y + 46, 100, 20, false, INK2);
    }
    if (this.mode === 'meeting') {
      const w = 220, x = UW / 2 - w / 2, y = 120 + dy;
      win(ui, x, y, w, 44);
      drawTextCentered(ui, `CONNECTING TO ${l.meet?.rival.name ?? 'YOUR RIVAL'}...`, UW / 2, y + 18, tick % 8 < 6 ? RED_INK : INK2, 1, false);
    }
    hint(ui, focused ? 'ENTER: SEND   ESC: STOP TYPING' : `${k('attack')}: CHALLENGE   ${k('custom')}: CHAT   ${k('cast')} / RIGHT-CLICK: BACK`);
  }
}
