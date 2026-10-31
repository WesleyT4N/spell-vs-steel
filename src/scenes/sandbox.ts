// Debug sandbox: a fight with no rules in the way. Cast any spell on demand, park a training dummy,
// turn off dying and resource costs, slow time down, move fighters around and read every hit.
// The fight is the real Battle; the controls live in a DOM panel docked on the right.
import { classRules } from '../content/classes';
import { popScene, zone, hot, type Scene } from './scene';
import { CLASS_INFO } from '../game/classes';
import { Battle, NO_INTENT, heavyChargeOf, COLS, ROWS, type Dir, type Fighter, type Intent, type Side, type StatusKey } from '../game/battle';
import { drawBattle, drawBattleUi, getArena } from '../game/battleView';
import { Cpu } from '../game/ai';
import { CARDS, RARITY_COLOR, cardsFor, type CardDef } from '../game/cards';
import { starterDeck, toList } from '../game/deck';
import { TUNING } from '../game/tuning';
import type { ClassId } from '../art/sprites';
import { X0, Y0, PW, FACE, LIP, panelCenter } from '../art/arena';
import { UW, UH, P, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered } from '../engine/font';
import { wasPressed, isDown, heldDir, mouse, getKey, BINDABLE } from '../engine/input';
import type { PadMode } from '../engine/touch';
import { playMusic, stopMusic, stageTrack, chargeHum } from '../engine/audio';
import { instrument, sourceName, type Hit, type Probe } from '../dev/instrument';
import { classIds } from '../dev/simulate';
import { h, btn, choice, check, reserveRight } from '../dev/dom';

type Brain = 'still' | 'walk' | 'turret' | 'easy' | 'normal';
const BRAINS: Array<[Brain, string]> = [['still', 'Dummy'], ['walk', 'Walker'], ['turret', 'Turret'], ['easy', 'CPU easy'], ['normal', 'CPU normal']];
const SPEEDS: Array<[number, string]> = [[0.1, '0.1×'], [0.25, '¼×'], [0.5, '½×'], [1, '1×'], [2, '2×']];
const PANEL_W = 340;

export interface SandboxOpts { you?: ClassId; foe?: ClassId; brain?: Brain; queue?: string[] }

// remembered while the page is open, so leaving and coming back keeps the setup
const saved = { you: 'warrior' as ClassId, foe: 'mage' as ClassId, brain: 'still' as Brain, god: [true, true] as [boolean, boolean], free: [true, true] as [boolean, boolean], speed: 1, coords: false };

export class SandboxScene implements Scene {
  b!: Battle;
  probe!: Probe;
  cpu: Cpu | null = null;
  paused = false;
  private step = false;
  private brainT = 0;
  private lastHit: [number, number] = [-99, -99];
  private holdT = 0;
  private lastDir: Dir | null = null;
  private dealt: [Hit[], Hit[]] = [[], []];
  private meterFrom = 0;
  private spellSide: Side = 0;
  private placeSide: Side = 0;
  private koT = 0;
  /** Exit at the next update, so the key that closed us doesn't also reach the scene behind. */
  private leaving = false;

  private root!: HTMLElement;
  private stateEl!: HTMLElement;
  private logEl!: HTMLElement;
  private meterEl!: HTMLElement;
  private gridEl!: HTMLElement;
  private queueEl!: HTMLElement;
  private spellsEl!: HTMLElement;
  private uiT = 0;
  private onKey = (e: KeyboardEvent): void => this.key(e);

  constructor(private back: () => void = popScene, opts: SandboxOpts = {}) {
    if (opts.you) saved.you = opts.you;
    if (opts.foe) saved.foe = opts.foe;
    if (opts.brain) saved.brain = opts.brain;
    this.reset(opts.queue);
  }

  enter(): void {
    playMusic(stageTrack(getArena().id));
    this.mount();
    window.addEventListener('keydown', this.onKey);
  }

  private exit(): void {
    window.removeEventListener('keydown', this.onKey);
    this.root.remove();
    reserveRight(0);
    for (const s of [0, 1]) chargeHum(s, null);
    stopMusic();
    this.back();
  }

  private key(e: KeyboardEvent): void {
    if (e.target instanceof Element && e.target.closest('input, select, textarea')) return;
    if (e.code === 'Escape') this.leaving = true;
    if (BINDABLE.some(a => getKey(a) === e.code)) return; // a rebound game key wins over the sandbox shortcuts
    if (e.code === 'KeyP') this.togglePause();
    if (e.code === 'Period') { this.paused = true; this.step = true; this.renderTime?.(); }
    if (e.code === 'KeyR') this.reset();
  }

  // ---------- the fight ----------
  reset(queue: string[] = []): void {
    this.b = new Battle(
      { cls: saved.you, deck: toList(starterDeck(saved.you)), name: 'YOU' },
      { cls: saved.foe, deck: toList(starterDeck(saved.foe)), name: saved.brain === 'easy' || saved.brain === 'normal' ? 'CPU' : 'DUMMY' },
    );
    this.b.endCustom([[], []]);
    this.b.f[0].queue = [...queue];
    // free spells: costs read as 0 and everything is affordable, so the resource bar still shows real gains
    const b = this.b, costOf = b.costOf.bind(b), canAfford = b.canAfford.bind(b);
    b.costOf = (f, card) => (saved.free[f.side] ? 0 : costOf(f, card));
    b.canAfford = (f, card) => saved.free[f.side] || canAfford(f, card);
    this.probe = instrument(this.b, 400);
    this.probe.onHit = (hit, t) => this.onHit(hit, t);
    this.cpu = saved.brain === 'easy' || saved.brain === 'normal' ? new Cpu(saved.brain) : null;
    this.dealt = [[], []];
    this.meterFrom = 0;
    this.lastHit = [-99, -99];
    this.koT = 0;
    if (this.logEl) this.logEl.replaceChildren();
    this.renderSpells?.();
  }

  private onHit(hit: Hit, t: Fighter): void {
    if (hit.by !== null) this.dealt[hit.by].push(hit);
    this.lastHit[t.side] = this.b.time;
    // god mode: never below 1 HP (the KO check runs after the hit)
    if (saved.god[t.side] && t.hp < 1) t.hp = 1;
    this.logHit(hit);
  }

  private cheats(): void {
    for (const f of this.b.f) {
      // training dummies heal up after 2s without taking a hit
      if (saved.god[f.side] && this.b.time - this.lastHit[f.side] > 2) f.hp = f.maxHp;
    }
    // no Draw screen in the sandbox: spells come from the panel
    this.b.gauge = 0;
  }

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

  private brainIntent(dt: number): Intent {
    const b = this.b, f = b.f[1];
    if (this.cpu) return this.cpu.intent(b, f, dt);
    this.brainT += dt;
    if (saved.brain === 'walk' && this.brainT > 0.7) {
      this.brainT = 0;
      const dirs: Dir[] = ['up', 'down', 'left', 'right'];
      const d = dirs[Math.floor(Math.random() * 4)];
      return { ...NO_INTENT, move: d, held: d };
    }
    if (saved.brain === 'turret' && this.brainT > 1.2) {
      this.brainT = 0;
      return { ...NO_INTENT, attackPressed: true };
    }
    return NO_INTENT;
  }

  pad(): PadMode { return 'fight'; }

  update(dt: number): void {
    if (this.leaving) { this.exit(); return; }
    const b = this.b;
    // click a panel to move yourself there, right-click to move the enemy
    const cell = hot('cell');
    if (cell >= 0 && (mouse.click || mouse.rclick)) this.place(mouse.click ? 0 : 1, Math.floor(cell / ROWS), cell % ROWS);

    if (this.paused && !this.step) return;
    const sdt = this.step ? 1 / 60 : dt * saved.speed;
    this.step = false;
    this.cheats();
    const pi = b.phase === 'fight' ? this.playerIntent(sdt) : NO_INTENT;
    b.update(sdt, [pi, this.brainIntent(sdt)]);
    this.cheats();
    for (const f of b.f) chargeHum(f.side, b.phase === 'fight' && f.charging && f.charge > 0.15 ? Math.min(1, f.charge / heavyChargeOf(f)) : null);
    if (b.phase === 'ko' || b.phase === 'over') { this.koT += dt; if (this.koT > 2.5) this.reset(); }

    this.uiT -= dt;
    if (this.uiT <= 0) { this.uiT = 0.1; this.renderLive(); }
  }

  private place(side: Side, col: number, row: number): void {
    const f = this.b.f[side];
    if (!this.b.canStand(f, col, row)) return;
    f.col = col; f.row = row;
    f.dx = f.dy = 0;
  }

  private togglePause(): void { this.paused = !this.paused; this.renderTime?.(); }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    const b = this.b;
    drawBattle(c, b, tick, 'all', true);
    drawBattleUi(ui, b, tick);
    for (let col = 0; col < COLS; col++) for (let row = 0; row < ROWS; row++) {
      zone(`cell:${col * ROWS + row}`, (X0 + col * PW) * 2, (Y0 + row * (FACE + LIP)) * 2, PW * 2, (FACE + LIP) * 2);
      if (saved.coords) { const pc = panelCenter(col, row); drawTextCentered(ui, `${col},${row}`, pc.x * 2, pc.y * 2 - 3, '#fcfcfc'); }
    }
    const tags = [`SANDBOX`, saved.speed !== 1 ? `${saved.speed}X` : '', this.paused ? 'PAUSED' : ''].filter(Boolean).join('   ');
    P(ui, '#000000', UW / 2 - 70, UH - 14, 140, 12);
    drawTextCentered(ui, tags, UW / 2, UH - 12, this.paused ? '#f8b800' : '#bcbcbc', 1, false);
    if (this.paused && tick % 8 < 5) drawText(ui, 'P: RESUME   .: STEP', UW / 2 - 57, UH - 26, '#f8b800');
  }

  // ---------- the panel ----------
  private renderTime?: () => void;
  private renderSpells?: () => void;

  private mount(): void {
    reserveRight(PANEL_W);
    const sec = (title: string, ...kids: Array<Node | string>): HTMLElement => h('div', {}, h('h3', {}, title), ...kids);
    const cls = classIds().map(c => [c, c[0].toUpperCase() + c.slice(1)] as [ClassId, string]);

    const you = choice(cls, saved.you, v => { saved.you = v; this.reset(); });
    const foe = choice(cls, saved.foe, v => { saved.foe = v; this.reset(); });
    const brain = choice(BRAINS, saved.brain, v => { saved.brain = v; this.reset(); });
    const speed = choice(SPEEDS, saved.speed, v => { saved.speed = v; });
    const pauseBtn = btn('Pause (P)', () => this.togglePause());
    this.renderTime = () => { pauseBtn.textContent = this.paused ? 'Resume (P)' : 'Pause (P)'; pauseBtn.classList.toggle('on', this.paused); speed.set(saved.speed); };

    const fighterBtns = (side: Side): HTMLElement => h('div', { class: 'row' },
      h('span', { class: 'muted', style: 'width:44px' }, side ? 'Enemy' : 'You'),
      btn('Freeze 1.5s', () => this.b.freeze(this.b.f[side], 1.5)),
      btn('Stun 1s', () => this.b.stun(this.b.f[side], 1)),
      btn('Clear', () => this.clearStatus(this.b.f[side])),
      btn('Heal', () => { const f = this.b.f[side]; f.hp = f.maxHp; }),
    );
    const hpBtns = h('div', { class: 'row' }, h('span', { class: 'muted' }, 'Enemy HP'),
      ...[100, 50, 30, 10].map(p => btn(`${p}%`, () => { const f = this.b.f[1]; f.hp = Math.round(f.maxHp * p / 100); this.lastHit[1] = this.b.time + 9999; })),
    );

    this.gridEl = h('div', { style: `display:grid;grid-template-columns:repeat(${COLS},1fr);gap:2px;margin:4px 0` });
    const place = choice<Side>([[0, 'Place: you'], [1, 'Place: enemy']], this.placeSide, v => { this.placeSide = v; });

    this.queueEl = h('div', { class: 'row' });
    this.spellsEl = h('div', { style: 'max-height:260px;overflow:auto;border:1px solid #3c3c3c;padding:2px 4px' });
    const spellSide = choice<Side>([[0, 'Your spells'], [1, 'Enemy spells']], this.spellSide, v => { this.spellSide = v; this.renderSpells?.(); });
    this.renderSpells = () => this.drawSpells();

    this.stateEl = h('pre', { style: 'margin:0;white-space:pre-wrap;color:#bcbcbc' });
    this.meterEl = h('div', { class: 'row' });
    this.logEl = h('tbody');

    this.root = h('div', { class: 'dev', style: `position:fixed;top:0;right:0;bottom:0;width:${PANEL_W}px;overflow:auto;background:#000;border-left:2px solid #3c3c3c;padding:10px 12px;z-index:20` },
      h('div', { class: 'row', style: 'justify-content:space-between' }, h('h2', { style: 'margin:0' }, 'Sandbox'), btn('Exit (Esc)', () => { this.leaving = true; }, 'primary')),
      h('div', { class: 'muted' }, 'WASD move · J attack (hold: heavy) · K cast your queue · P pause · . step one frame · R reset. Click a panel in the arena to move there, right-click to move the enemy.'),
      sec('Fighters', h('div', { class: 'row' }, h('span', { class: 'muted', style: 'width:44px' }, 'You'), you.el), h('div', { class: 'row' }, h('span', { class: 'muted', style: 'width:44px' }, 'Enemy'), foe.el)),
      sec('Enemy behavior', brain.el),
      sec('Cheats',
        h('div', { class: 'row' }, check('You can\'t die', saved.god[0], v => { saved.god[0] = v; }), check('Enemy can\'t die', saved.god[1], v => { saved.god[1] = v; })),
        h('div', { class: 'row' }, check('Free spells (you)', saved.free[0], v => { saved.free[0] = v; }), check('Free spells (enemy)', saved.free[1], v => { saved.free[1] = v; }), btn('Max resource', () => this.maxRes())),
        h('div', { class: 'row' }, check('Panel coordinates', saved.coords, v => { saved.coords = v; }),
          btn('Next turn', () => this.nextTurn()), btn('Reset (R)', () => this.reset())),
        h('div', { class: 'muted' }, 'Can\'t die: HP stops at 1 and refills after 2s without a hit. Free spells cost nothing but the bar still moves. Next turn: Mana max +1 and refill, like a Draw screen.'),
        hpBtns,
      ),
      sec('Time', speed.el, h('div', { class: 'row' }, pauseBtn, btn('Step 1 frame (.)', () => { this.paused = true; this.step = true; this.renderTime?.(); }))),
      sec('Status', fighterBtns(0), fighterBtns(1)),
      sec('Grid', place.el, this.gridEl),
      sec('Spells', spellSide.el, this.queueEl, this.spellsEl),
      sec('Live state', this.stateEl),
      sec('Damage', this.meterEl, h('div', { style: 'max-height:220px;overflow:auto' },
        h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Source'), h('th', {}, 'Dmg'), h('th', {}, 'At'), h('th', {}, 'Notes'))), this.logEl))),
    );
    document.body.append(this.root);
    this.drawSpells();
    this.renderLive();
  }

  private clearStatus(f: Fighter): void {
    for (const k of Object.keys(f.st) as StatusKey[]) f.st[k] = 0;
    f.shields = [];
    f.shout = 0; f.rallyLeft = 0; f.powerLeft = 0; f.empowered = 0;
  }

  private maxRes(): void {
    for (const f of this.b.f) {
      // a max that grows (Mage Mana) jumps to its cap; then fill up
      f.resMax = Math.max(f.resMax, classRules(f.cls).pool(f).cap);
      f.res = f.resMax;
    }
  }

  private nextTurn(): void {
    const queues = this.b.f.map(f => [...f.queue]);
    this.b.beginCustom();
    this.b.endCustom([[], []]);
    this.b.f.forEach((f, i) => { f.queue = queues[i]; });
  }

  private castNow(side: Side, id: string): void {
    const f = this.b.f[side];
    if (this.b.phase !== 'fight') return;
    f.queue.unshift(id);
    f.lock = 0;
    f.castCd = 0;
    this.b.castTop(f, side === 0 ? heldDir() : null);
    if (f.queue[0] === id) f.queue.shift(); // couldn't afford it: don't leave it on top
  }

  private drawSpells(): void {
    if (!this.spellsEl) return;
    const side = this.spellSide;
    const f = this.b.f[side];
    const rank = { common: 0, uncommon: 1, legendary: 2, mythic: 3 };
    const list = cardsFor(f.cls).sort((a, c) => rank[a.rarity] - rank[c.rarity] || a.name.localeCompare(c.name));
    this.spellsEl.replaceChildren(...list.map((card: CardDef) => h('div', { class: 'row', title: card.short, style: 'justify-content:space-between;margin:1px 0' },
      h('span', { style: `color:${RARITY_COLOR[card.rarity]};flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap` }, `${card.cost === 'all' ? 'A' : card.cost} ${card.name}`),
      btn('Cast', () => this.castNow(side, card.id)),
      btn('+Queue', () => { f.queue.push(card.id); }),
    )));
  }

  private renderLive(): void {
    if (!this.stateEl) return;
    const b = this.b;
    const fmt = (f: Fighter): string => {
      const st = (Object.entries(f.st) as Array<[StatusKey, number]>).filter(([, v]) => v > 0).map(([k, v]) => `${k} ${v.toFixed(1)}`);
      const sh = f.shields.filter(s => s.hp > 0).map(s => `${s.kind} ${Math.ceil(s.hp)}`);
      const mods = [f.shout ? `shout ×${f.shout}` : '', f.rallyLeft ? `rally ×${f.rallyLeft}` : '', f.powerLeft ? `power ×${f.powerLeft}` : '', f.empowered ? `empower ×${f.empowered}` : '', f.bonusManaNext ? `+${f.bonusManaNext} mana next` : ''].filter(Boolean);
      const res = f.cls === 'warrior' ? `rage ${f.res.toFixed(1)}/${TUNING.warrior.rageMax}` : `${CLASS_INFO[f.cls].res.toLowerCase()} ${f.res}/${f.resMax}${f.poison ? `  poison ×${f.poison}` : ''}`;
      return [
        `${f.side ? 'ENEMY' : 'YOU'} ${f.cls}  hp ${Math.ceil(f.hp)}/${f.maxHp}  ${res}`,
        `  at ${f.col},${f.row}  lock ${f.lock.toFixed(2)}  ${f.charging ? `charge ${f.charge.toFixed(2)}` : ''}`,
        st.length ? `  status: ${st.join(', ')}` : '',
        sh.length ? `  shields: ${sh.join(', ')}` : '',
        mods.length ? `  next spell: ${mods.join(', ')}` : '',
        `  deck ${f.deck.length}  discard ${f.discard.length}`,
      ].filter(Boolean).join('\n');
    };
    this.stateEl.textContent = `turn ${b.turn}  time ${b.time.toFixed(1)}s  walls ${b.walls.length}  shots ${b.projectiles.length}\n${fmt(b.f[0])}\n${fmt(b.f[1])}`;

    // queues
    const q = b.f[this.spellSide].queue;
    this.queueEl.replaceChildren(h('span', { class: 'muted' }, 'Queue:'), ...(q.length ? q.map((id, i) => h('span', { class: 'chip', style: `color:${i ? '#bcbcbc' : '#f8b800'}` }, CARDS[id]?.name ?? id)) : [h('span', { class: 'muted' }, 'empty')]),
      q.length ? btn('Clear', () => { b.f[this.spellSide].queue = []; }) : '');

    // grid
    const cells: HTMLElement[] = [];
    for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
      const p = b.panels[col][row];
      const who = b.f.find(f => !f.dead && f.col === col && f.row === row);
      const wall = b.wallAt(col, row);
      const label = who ? (who.side ? 'E' : 'Y') : wall ? '▮' : p.hole > 0 ? '○' : p.burn > 0 ? '≈' : '';
      const bg = p.owner === 0 ? '#501010' : '#102050';
      cells.push(btn(label, () => this.place(this.placeSide, col, row)));
      const el = cells[cells.length - 1];
      el.style.cssText = `height:22px;padding:0;background:${bg};border-color:${p.ownerT > 0 ? '#f8b800' : '#3c3c3c'};color:${who ? '#fcfcfc' : p.burn > 0 ? '#fca044' : '#a4e4fc'}`;
      el.title = `${col},${row}${p.burn > 0 ? ` burning ${p.burn.toFixed(1)}s` : ''}${wall ? ` wall ${Math.ceil(wall.hp)}hp` : ''}${p.cracked ? ' cracked' : ''}`;
    }
    this.gridEl.replaceChildren(...cells);

    // meter: damage by each side since the last reset, and over the last 5 seconds
    const sum = (hs: Hit[]): number => hs.reduce((a, x) => a + x.dealt, 0);
    const line = (side: Side): string => {
      const hs = this.dealt[side].filter(x => x.time >= this.meterFrom);
      const recent = hs.filter(x => x.time > b.time - 5);
      return `${side ? 'Enemy' : 'You'}: ${sum(hs)} dmg, ${(sum(recent) / 5).toFixed(0)}/s (5s)`;
    };
    this.meterEl.replaceChildren(h('span', {}, line(0)), h('span', { class: 'muted' }, '·'), h('span', {}, line(1)), btn('Reset meter', () => { this.meterFrom = b.time; }));
  }

  private logHit(hit: Hit): void {
    if (!this.logEl) return;
    const notes = [hit.blocked && !hit.dealt ? 'blocked' : '', hit.disabled ? 'frozen/stunned ×1.5' : '', hit.base !== hit.dealt && hit.dealt ? `base ${Math.round(hit.base)}` : ''].filter(Boolean).join(', ');
    const who = hit.by === null ? '?' : hit.by ? 'E' : 'Y';
    const tr = h('tr', {},
      h('td', { style: `color:${hit.by === 0 ? '#f87858' : '#6888fc'}` }, `${who}→${hit.target ? 'E' : 'Y'} ${sourceName(hit.source)}`),
      h('td', {}, hit.dealt),
      h('td', { class: 'muted' }, hit.time.toFixed(2)),
      h('td', { class: 'muted', style: 'text-align:left' }, notes),
    );
    this.logEl.prepend(tr);
    while (this.logEl.childElementCount > 60) this.logEl.lastElementChild?.remove();
  }
}
