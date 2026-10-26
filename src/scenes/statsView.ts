// The post-match stats panel: a Parchment window with SUMMARY, SPELLS and ROUNDS (or TURNS) tabs.
// Shared by the Versus results screen, online results and training's session stats.
import type { Fighter, Side } from '../game/battle';
import { CARDS, ELEMENT_COLOR } from '../game/cards';
import { CLASS_INFO } from '../game/classes';
import { accuracy, ccCount, mostUsed, rankedSources, sourceLabel, type BattleStats, type RoundRecord, type SideStats } from '../game/stats';
import { teamColor } from '../art/sprites';
import { P, mix, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered, textWidth } from '../engine/font';
import { wasPressed, mouse } from '../engine/input';
import { sfx } from '../engine/audio';
import { zone, hot } from './scene';
import { win, plaque, ink, PAPER2, INK, INK2, RED_INK, TRIM, GOLD } from './skin';

export interface StatsData {
  /** The side the viewer plays; it is always the left column. */
  me: Side;
  names: [string, string];
  fighters: [Fighter, Fighter];
  /** The stats the SUMMARY and SPELLS tabs show (this round, the whole set or the training session). */
  shown: [SideStats, SideStats];
  /** What `shown` covers, for the window's corner. */
  scope: string;
  /** Finished rounds of the set; empty in training, where the last tab charts the current turns instead. */
  rounds: RoundRecord[];
  current: BattleStats;
}

const GREEN_INK = '#007800';

export class StatsPanel {
  tab = 0;
  /** The round the turn-by-turn chart shows (-1 = the latest). */
  round = -1;

  tabs(d: StatsData): string[] { return ['SUMMARY', 'SPELLS', d.rounds.length ? 'ROUNDS' : 'TURNS']; }

  /** Tab keys and clicks. Left/right are free for this: the menus beside the panel move up and down. */
  update(d: StatsData): void {
    const n = this.tabs(d).length;
    const t = hot('stab');
    if (mouse.click && t >= 0 && t !== this.tab) { this.tab = t; sfx('move'); }
    if (wasPressed('left')) { this.tab = (this.tab + n - 1) % n; sfx('move'); }
    if (wasPressed('right')) { this.tab = (this.tab + 1) % n; sfx('move'); }
    const r = hot('sround');
    if (mouse.click && r >= 0) { this.round = r; sfx('move'); }
  }

  draw(ui: Ctx, d: StatsData, x: number, y: number, w: number, h: number): void {
    win(ui, x, y, w, h);
    const tabs = this.tabs(d);
    tabs.forEach((t, i) => {
      const tx = x + 8 + i * 76;
      zone(`stab:${i}`, tx, y + 7, 72, 16);
      const on = i === this.tab, lit = on || hot('stab') === i;
      const col = plaque(ui, tx, y + 7, 72, 16, on, lit && !on ? GOLD : undefined);
      drawTextCentered(ui, t, tx + 36, y + 12, on ? col : lit ? INK : INK2, 1, false);
    });
    drawText(ui, d.scope, x + w - 10 - textWidth(d.scope), y + 12, TRIM);
    P(ui, TRIM, x + 8, y + 27, w - 16, 1);
    const top = y + 33;
    if (this.tab === 0) this.summary(ui, d, x, top, w);
    else if (this.tab === 1) this.spells(ui, d, x, top, w);
    else this.timeline(ui, d, x, top, w, y + h - top - 6);
  }

  /** Ink color of a side, from its team color. */
  private sideInk(d: StatsData, side: Side): string {
    const f = d.fighters[side];
    return ink(teamColor(f.cls, f.skin, f.alt));
  }

  private summary(ui: Ctx, d: StatsData, x: number, y: number, w: number): void {
    const me = d.me, them = (1 - me) as Side;
    const [a, b] = [d.shown[me], d.shown[them]];
    const ca = x + w - 120, cb = x + w - 14;
    // column heads: name over class
    for (const [side, cx] of [[me, ca], [them, cb]] as Array<[Side, number]>) {
      const s = d.shown[side];
      drawText(ui, d.names[side], cx - textWidth(d.names[side]), y, this.sideInk(d, side));
      drawText(ui, CLASS_INFO[s.cls].name, cx - textWidth(CLASS_INFO[s.cls].name), y + 9, TRIM);
    }
    // a tug-of-war bar for the damage split
    const total = a.dealt + b.dealt, bx = x + 12, bw = ca - 76 - bx;
    if (bw > 40) {
      const fa = total > 0 ? a.dealt / total : 0.5;
      P(ui, '#000000', bx - 1, y + 2, bw + 2, 12);
      P(ui, teamColor(d.fighters[me].cls, d.fighters[me].skin, d.fighters[me].alt), bx, y + 3, Math.round(bw * fa), 10);
      P(ui, teamColor(d.fighters[them].cls, d.fighters[them].skin, d.fighters[them].alt), bx + Math.round(bw * fa), y + 3, bw - Math.round(bw * fa), 10);
      P(ui, '#fcfcfc', bx + Math.round(bw * fa), y + 3, 1, 10);
      drawText(ui, 'DAMAGE SHARE', bx, y + 17, TRIM);
    }
    const pct = (v: number | null): string => (v === null ? '-' : `${Math.round(v * 100)}%`);
    const secs = (v: number): string => `${v.toFixed(1)}S`;
    const n = (v: number): string => String(Math.round(v));
    // label, value per side, higher is better (false: lower is better, null: no winner)
    const rows: Array<[string, (s: SideStats) => string, (s: SideStats) => number, boolean | null]> = [
      ['DAMAGE DEALT', s => n(s.dealt), s => s.dealt, true],
      ['  FROM ATTACKS', s => n(s.basic), s => s.basic, null],
      ['  FROM SPELLS', s => n(s.spell), s => s.spell, null],
      ['  FROM EFFECTS', s => n(s.dot), s => s.dot, null],
      ['BIGGEST HIT', s => n(s.biggest), s => s.biggest, true],
      ['HEALING', s => n(s.healed), s => s.healed, true],
      ['ATTACK ACCURACY', s => pct(accuracy(s.attackHits, s.attacks)), s => accuracy(s.attackHits, s.attacks) ?? -1, true],
      ['SPELL ACCURACY', s => pct(accuracy(s.dmgCastHits, s.dmgCasts)), s => accuracy(s.dmgCastHits, s.dmgCasts) ?? -1, true],
      ['SPELLS CAST', s => n(s.casts), s => s.casts, null],
      ['CROWD CONTROL', s => (ccCount(s) ? `${ccCount(s)} (${secs(s.ccSecs)})` : '0'), s => s.ccSecs + ccCount(s) * 0.01, true],
      ['TIME DISABLED', s => secs(s.disabledSecs), s => s.disabledSecs, false],
      ['HITS BLOCKED', s => n(s.blocked), s => s.blocked, true],
      ['HITS EVADED', s => n(s.evaded), s => s.evaded, true],
    ];
    const rh = 13;
    rows.forEach(([label, text, val, higher], i) => {
      const yy = y + 28 + i * rh;
      if (i % 2 === 0) for (let xx = x + 6; xx < x + w - 6; xx++) if ((xx + yy) % 2 === 0) P(ui, PAPER2, xx, yy - 3, 1, rh);
      const sub = label.startsWith('  ');
      drawText(ui, label.trim(), x + 12 + (sub ? 10 : 0), yy, sub ? INK2 : INK);
      const va = val(a), vb = val(b);
      const win0 = higher !== null && va !== vb && (higher ? va > vb : va < vb);
      const win1 = higher !== null && va !== vb && !win0;
      const ta = text(a), tb = text(b);
      drawText(ui, ta, ca - textWidth(ta), yy, win0 ? RED_INK : sub ? INK2 : INK);
      drawText(ui, tb, cb - textWidth(tb), yy, win1 ? RED_INK : sub ? INK2 : INK);
      if (win0) drawText(ui, '●', ca - textWidth(ta) - 9, yy, RED_INK);
      if (win1) drawText(ui, '●', cb - textWidth(tb) - 9, yy, RED_INK);
    });
  }

  private spells(ui: Ctx, d: StatsData, x: number, y: number, w: number): void {
    const colW = Math.floor((w - 24) / 2);
    ([d.me, 1 - d.me] as Side[]).forEach((side, k) => {
      const s = d.shown[side], cx = x + 10 + k * (colW + 4);
      const fav = mostUsed(s);
      drawText(ui, `${d.names[side]}  ${CLASS_INFO[s.cls].name}`, cx, y, this.sideInk(d, side));
      drawText(ui, 'USES', cx + colW - 60, y + 11, TRIM);
      drawText(ui, 'DONE', cx + colW - 26, y + 11, TRIM);
      const list = rankedSources(s).slice(0, 12);
      if (!list.length) drawText(ui, 'NOTHING YET', cx, y + 24, INK2);
      list.forEach(([id, v], i) => {
        const yy = y + 24 + i * 13, card = CARDS[id];
        // a swatch of the spell's element; basics and effects get a plain ink one
        P(ui, '#000000', cx + 1, yy, 7, 7);
        P(ui, card ? ELEMENT_COLOR[card.element] : id === 'light' || id === 'heavy' ? INK2 : TRIM, cx + 2, yy + 1, 5, 5);
        const isFav = fav?.[0] === id;
        const name = sourceLabel(id, s.cls);
        const room = Math.floor((colW - 78) / 6);
        drawText(ui, name.length > room ? name.slice(0, room - 1) + '.' : name, cx + 13, yy, isFav ? RED_INK : card ? INK : INK2);
        if (v.casts) drawText(ui, `×${v.casts}`, cx + colW - 60, yy, INK2);
        const heal = v.heal > v.dmg;
        const done = heal ? `+${Math.round(v.heal)}` : String(Math.round(v.dmg));
        drawText(ui, done, cx + colW - 2 - textWidth(done), yy, heal ? GREEN_INK : v.dmg ? INK : TRIM);
      });
      if (fav) {
        const ty = y + 24 + 12 * 13 + 6;
        drawText(ui, 'RED: MOST USED SPELL', cx, ty, RED_INK);
      }
    });
    P(ui, TRIM, x + 10 + colW + 1, y, 1, 12 * 13 + 30);
  }

  /** Per-round table (when there are rounds) over a turn-by-turn damage chart. */
  private timeline(ui: Ctx, d: StatsData, x: number, y: number, w: number, h: number): void {
    const me = d.me, them = (1 - me) as Side;
    let chartTop = y;
    let shown = d.current;
    if (d.rounds.length) {
      const cols = [x + 12, x + 56, x + 132, x + 176];
      ['ROUND', 'WINNER', 'TIME', 'TURNS'].forEach((t, i) => drawText(ui, t, cols[i], y, TRIM));
      const rA = x + w - 76, rB = x + w - 14;
      drawText(ui, d.names[me], rA - textWidth(d.names[me]), y, this.sideInk(d, me));
      drawText(ui, d.names[them], rB - textWidth(d.names[them]), y, this.sideInk(d, them));
      const pick = this.round >= 0 && this.round < d.rounds.length ? this.round : d.rounds.length - 1;
      shown = d.rounds[pick].stats;
      d.rounds.forEach((r, i) => {
        const yy = y + 13 + i * 13;
        zone(`sround:${i}`, x + 6, yy - 3, w - 12, 13);
        if (i === pick) for (let xx = x + 6; xx < x + w - 6; xx++) if ((xx + yy) % 2 === 0) P(ui, PAPER2, xx, yy - 3, 1, 13);
        const winName = r.winner === null ? 'DRAW' : d.names[r.winner];
        const mins = `${Math.floor(r.secs / 60)}:${String(Math.floor(r.secs % 60)).padStart(2, '0')}`;
        drawText(ui, `R${i + 1}`, cols[0], yy, i === pick ? RED_INK : INK);
        drawText(ui, winName, cols[1], yy, r.winner === null ? INK2 : this.sideInk(d, r.winner));
        drawText(ui, mins, cols[2], yy, INK);
        drawText(ui, String(r.turns), cols[3], yy, INK);
        const da = String(Math.round(r.dealt[me])), db = String(Math.round(r.dealt[them]));
        drawText(ui, da, rA - textWidth(da), yy, INK);
        drawText(ui, db, rB - textWidth(db), yy, INK);
      });
      chartTop = y + 13 + d.rounds.length * 13 + 8;
      if (d.rounds.length > 1) drawText(ui, 'CLICK A ROUND TO CHART IT', x + 12, chartTop, TRIM);
      chartTop += 12;
    }
    this.chart(ui, d, shown, x + 12, chartTop, w - 24, y + h - chartTop);
  }

  /** Damage per Draw turn, a pair of bars per turn. */
  private chart(ui: Ctx, d: StatsData, s: BattleStats, x: number, y: number, w: number, h: number): void {
    const me = d.me, them = (1 - me) as Side;
    drawText(ui, 'DAMAGE PER TURN', x, y, INK);
    const colA = teamColor(d.fighters[me].cls, d.fighters[me].skin, d.fighters[me].alt);
    const colB = teamColor(d.fighters[them].cls, d.fighters[them].skin, d.fighters[them].alt);
    // legend
    let lx = x + w - textWidth(d.names[them]);
    drawText(ui, d.names[them], lx, y, INK2); P(ui, '#000000', lx - 10, y, 7, 7); P(ui, colB, lx - 9, y + 1, 5, 5);
    lx -= 22 + textWidth(d.names[me]);
    drawText(ui, d.names[me], lx, y, INK2); P(ui, '#000000', lx - 10, y, 7, 7); P(ui, colA, lx - 9, y + 1, 5, 5);
    const ta = s.side[me].turns, tb = s.side[them].turns;
    const n = Math.max(1, ta.length, tb.length);
    const top = y + 14, base = y + h - 12, ch = base - top;
    const max = Math.max(1, ...ta, ...tb);
    const gw = Math.min(44, Math.floor(w / n)), bw = Math.max(2, Math.floor((gw - 6) / 2));
    P(ui, INK2, x, base, w, 1);
    for (let i = 0; i < n; i++) {
      const gx = x + i * gw + Math.floor((gw - bw * 2 - 1) / 2);
      for (const [v, col, bx] of [[ta[i] ?? 0, colA, gx], [tb[i] ?? 0, colB, gx + bw + 1]] as Array<[number, string, number]>) {
        const bh = Math.round(ch * v / max);
        if (bh > 0) { P(ui, '#000000', bx - 1, base - bh - 1, bw + 2, bh + 1); P(ui, col, bx, base - bh, bw, bh); P(ui, mix(col, '#fcfcfc', 0.45), bx, base - bh, bw, 1); }
        if (v > 0 && bw >= 18) drawTextCentered(ui, String(Math.round(v)), bx + bw / 2, base - bh - 9, INK2, 1, false);
      }
      if (gw >= 14 || i % 2 === 0) drawTextCentered(ui, String(i + 1), x + i * gw + gw / 2, base + 4, TRIM, 1, false);
    }
    if (!ta.length && !tb.length) drawTextCentered(ui, 'NO DAMAGE YET', x + w / 2, top + ch / 2 - 4, INK2, 1, false);
  }
}
