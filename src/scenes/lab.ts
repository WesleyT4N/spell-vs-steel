// Balance lab: run CPU-vs-CPU matches in the browser, read per-card stats, and tweak numbers live.
// Tuning edits apply to the whole game (Versus and the sandbox too) until the page reloads.
import { popScene, type Scene } from './scene';
import { getArena } from '../game/battleView';
import { drawStage } from '../art/arena';
import { screenRect, type Ctx } from '../engine/gfx';
import { withoutSfx } from '../engine/audio';
import { CARDS, RARITY_COLOR, cardsFor } from '../game/cards';
import { loadCustom, presetDeck, presetsFor, validate, type DeckCounts } from '../game/deck';
import type { Difficulty } from '../game/tuning';
import type { ClassId } from '../art/sprites';
import { addMatch, classIds, emptyStats, runMatch, wilson, type SeriesStats, type SideSpec } from '../dev/simulate';
import { cardPower } from '../dev/instrument';
import { defaultTuning, getTuning, isModified, onTuningChange, overrideCount, overrides, replaceOverrides, resetAll, setPower, setTuning, tuningPaths } from '../dev/tuningEdit';
import { parseScript, toScript } from '../dev/script';
import { planGrid, foldGrid, cellRate, cellRange, classTotal, favorable, ruleChecks, FAV, THIN, LOPSIDED, type GridPlan, type GridReport } from '../dev/grid';
import { runGrid, type GridRun } from '../dev/gridRunner';
import { archetypesFor, mythicOf, type PoolKind } from '../dev/archetypes';
import { styleById } from '../game/playstyles';
import { h, btn, choice, setBadge } from '../dev/dom';

// the corner badge, hooked up the first time the lab opens
let badgeHooked = false;
const hookBadge = (): void => { if (!badgeHooked) { badgeHooked = true; onTuningChange(showBadge); } };
const showBadge = (): void => {
  const o = overrides();
  const n = overrideCount(o);
  setBadge(n ? `DEV TUNING ON: ${n} change${n === 1 ? '' : 's'} (reload the page to undo)` : null);
};

interface Task { specs: [SideSpec, SideSpec]; n: number; stats: SeriesStats }
/** 'custom' or a ready-made deck id. */
type DeckChoice = string;
interface SideCfg { cls: ClassId; deck: DeckChoice; cpu: Difficulty }

const cap = (s: string): string => s[0].toUpperCase() + s.slice(1);
const pct = (v: number): string => `${Math.round(v * 100)}%`;

// remembered while the page is open
const cfg = {
  sides: [{ cls: 'warrior', deck: 'starter', cpu: 'normal' }, { cls: 'mage', deck: 'starter', cpu: 'normal' }] as [SideCfg, SideCfg],
  n: 100,
  grid: { kind: 'archetype' as PoolKind, n: 20, k: 3, hz: 60 },
};
let lastSingle: Task | null = null;
let lastMatrix: Map<string, Task> | null = null;
let lastGrid: { plan: GridPlan; run: GridRun; report: GridReport } | null = null;

const SCRIPT_KEY = 'svs:lab:script';
const SCRIPT_HELP = `# One edit per line. Runs from the shipped numbers every time.
# hp.mage = 700              any number from the Tuning list below
# warrior.heavyDamage *= 1.1 also += and -=
# fireball.power = 110%      a card's damage
# fireball.cost = 2          a card's cost
# mage.power = 95%           every card of a class
`;
const loadScript = (): string => { try { return localStorage.getItem(SCRIPT_KEY) ?? SCRIPT_HELP; } catch { return SCRIPT_HELP; } };
const saveScript = (t: string): void => { try { localStorage.setItem(SCRIPT_KEY, t); } catch { /* storage blocked */ } };

export class LabScene implements Scene {
  private root!: HTMLElement;
  private tasks: Task[] = [];
  private mode: 'single' | 'matrix' | 'grid' = 'single';
  private matrix = new Map<string, Task>();
  private progressEl!: HTMLElement;
  private scriptEl!: HTMLElement;
  private resultsEl!: HTMLElement;
  private tuningEl!: HTMLElement;
  private runBtns: HTMLButtonElement[] = [];
  /** Exit at the next update, so the key that closed us doesn't also reach the scene behind. */
  private leaving = false;
  private sortKey: 'dmg' | 'casts' | 'per' | 'wr' | 'name' = 'dmg';
  private onKey = (e: KeyboardEvent): void => {
    if (e.code === 'Escape' && !(e.target instanceof Element && e.target.closest('input, select, textarea'))) this.leaving = true;
  };

  constructor(private back: () => void = popScene) {}

  enter(): void {
    hookBadge();
    this.mount();
    window.addEventListener('keydown', this.onKey);
  }

  private exit(): void {
    window.removeEventListener('keydown', this.onKey);
    this.root.remove();
    this.back();
  }

  update(): void {
    if (this.leaving) { this.exit(); return; }
    if (!this.tasks.length) return;
    // run matches for a slice of each frame so the page stays responsive
    const end = performance.now() + 14;
    withoutSfx(() => {
      while (this.tasks.length && performance.now() < end) {
        const t = this.tasks[0];
        addMatch(t.stats, runMatch(t.specs[0], t.specs[1]), t.specs);
        if (t.stats.n >= t.n) this.tasks.shift();
      }
    });
    this.renderProgress();
    if (!this.tasks.length) this.finish();
  }

  draw(c: Ctx, tick: number): void {
    drawStage(c, getArena(), tick);
    c.fillStyle = 'rgba(0,0,24,0.85)';
    c.fillRect(...screenRect());
  }

  // ---------- running ----------
  private spec(s: SideCfg): SideSpec {
    let deck: DeckCounts = presetDeck(s.cls, s.deck);
    if (s.deck === 'custom') { const d = loadCustom(s.cls); if (d && !validate(d).length) deck = d; }
    return { cls: s.cls, deck, cpu: s.cpu };
  }

  private runSingle(): void {
    this.mode = 'single';
    this.tasks = [{ specs: [this.spec(cfg.sides[0]), this.spec(cfg.sides[1])], n: cfg.n, stats: emptyStats() }];
    lastSingle = this.tasks[0];
    this.started();
  }

  private runMatrix(): void {
    this.mode = 'matrix';
    this.matrix = new Map();
    const ids = classIds();
    // every ordered pair, so each class plays both sides; mirrors are skipped
    for (const a of ids) for (const b of ids) {
      if (a === b) continue;
      const t: Task = { specs: [this.spec({ cls: a, deck: 'starter', cpu: cfg.sides[0].cpu }), this.spec({ cls: b, deck: 'starter', cpu: cfg.sides[1].cpu })], n: Math.max(10, Math.round(cfg.n / 2)), stats: emptyStats() };
      this.matrix.set(`${a}:${b}`, t);
      this.tasks.push(t);
    }
    lastMatrix = this.matrix;
    this.started();
  }

  private started(): void {
    for (const b of this.runBtns) b.disabled = true;
    this.renderProgress();
  }

  private runFullGrid(): void {
    this.mode = 'grid';
    lastGrid?.run.stop();
    const g = cfg.grid;
    const plan = planGrid(classIds(), g.kind, g.k, 1, g.n, g.hz);
    let last = 0;
    const run = runGrid(plan, () => {
      // refold at most a few times a second; the table fills in as pairs finish
      if (performance.now() - last < 300 && run.done < run.total) { this.renderProgress(); return; }
      last = performance.now();
      if (lastGrid) lastGrid.report = foldGrid(plan, run.results);
      this.renderProgress();
      this.renderResults();
    });
    lastGrid = { plan, run, report: foldGrid(plan, []) };
    for (const b of this.runBtns) b.disabled = true;
    this.renderProgress();
    void run.finished.then(() => {
      if (lastGrid?.run !== run) return;
      lastGrid.report = foldGrid(plan, run.results);
      this.finish();
    });
  }

  private stop(): void { this.tasks = []; lastGrid?.run.stop(); this.finish(); }

  private finish(): void {
    for (const b of this.runBtns) b.disabled = false;
    this.renderProgress();
    this.renderResults();
  }

  // ---------- panel ----------
  private mount(): void {
    const sideRow = (i: 0 | 1): HTMLElement => {
      const s = cfg.sides[i];
      const deckSel = h('select', { tabindex: -1 });
      const fillDecks = (): void => {
        const custom = loadCustom(s.cls);
        const ok = !!custom && !validate(custom).length;
        const presets = presetsFor(s.cls);
        deckSel.replaceChildren(
          ...presets.map(p => h('option', { value: p.id }, p.id === 'starter' ? `Starter (${p.name})` : p.name)),
          h('option', { value: 'custom', disabled: !ok }, ok ? 'Your custom deck' : 'Custom deck (not ready)'),
        );
        if ((s.deck === 'custom' && !ok) || (s.deck !== 'custom' && !presets.some(p => p.id === s.deck))) s.deck = 'starter';
        deckSel.value = s.deck;
      };
      deckSel.addEventListener('change', () => { s.deck = deckSel.value as DeckChoice; });
      fillDecks();
      const cls = choice(classIds().map(c => [c, cap(c)] as [ClassId, string]), s.cls, v => { s.cls = v; fillDecks(); });
      const cpu = choice<Difficulty>([['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']], s.cpu, v => { s.cpu = v; });
      return h('div', { style: 'margin-bottom:6px' }, h('div', { class: 'muted' }, i ? 'Side B (right)' : 'Side A (left)'), cls.el, h('div', { class: 'row' }, deckSel, h('span', { class: 'muted' }, 'CPU'), cpu.el));
    };
    const n = choice<number>([[20, '20'], [50, '50'], [100, '100'], [250, '250'], [500, '500']], cfg.n, v => { cfg.n = v; });
    const run = btn('Run matchup', () => this.runSingle(), 'primary');
    const mat = btn('Run class matrix', () => this.runMatrix());
    const g = cfg.grid;
    const kind = choice<PoolKind>([['starter', 'Starters'], ['archetype', 'Archetypes'], ['variant', 'Archetype variants'], ['random', 'Random decks'], ['style', 'CPU styles + their decks'], ['style-starter', 'CPU styles, starters']], g.kind, v => { g.kind = v; });
    const gn = choice<number>([[10, '10'], [20, '20'], [40, '40'], [100, '100']], g.n, v => { g.n = v; });
    const gk = choice<number>([[2, '2'], [3, '3'], [5, '5'], [8, '8']], g.k, v => { g.k = v; });
    const hz = choice<number>([[60, '60 (exact)'], [30, '30 (fast)']], g.hz, v => { g.hz = v; });
    const grid = btn('Run full grid', () => this.runFullGrid(), 'primary');
    this.runBtns = [run, mat, grid];
    this.progressEl = h('div', { class: 'muted', style: 'min-height:16px' });
    this.resultsEl = h('div');
    this.tuningEl = h('div');
    this.scriptEl = this.scriptBox();

    const left = h('div', { style: 'flex:0 0 360px;min-width:0' },
      h('h2', {}, 'Matchup'),
      sideRow(0), sideRow(1),
      h('div', { class: 'row' }, h('span', { class: 'muted' }, 'Matches'), n.el),
      h('div', { class: 'row' }, run, mat, btn('Stop', () => this.stop())),
      this.progressEl,
      h('div', { class: 'muted' }, 'Both sides are CPUs. The class matrix plays every class against every other with starter decks, both sides of the grid.'),
      h('h2', {}, 'Full matchup grid'),
      h('div', { class: 'row' }, h('span', { class: 'muted' }, 'Decks'), kind.el),
      h('div', { class: 'row' }, h('span', { class: 'muted' }, 'Matches per deck pair'), gn.el),
      h('div', { class: 'row' }, h('span', { class: 'muted' }, 'Decks per class (random) / builds per archetype (variants)'), gk.el),
      h('div', { class: 'row' }, h('span', { class: 'muted' }, 'Steps per second'), hz.el),
      h('div', { class: 'row' }, grid),
      h('div', { class: 'muted' }, `Every deck plays every other class's decks, sides alternating, on all cores. Checks Wes's rules: 2+ favorable matchups (over ${FAV * 100}%, thin under ${THIN * 100}%), nothing past ${LOPSIDED * 100}-${100 - LOPSIDED * 100}, and the counter wheel. Uses the script and tuning below.`),
      h('h2', {}, 'Script'),
      this.scriptEl,
      h('h2', {}, 'Tuning'),
      h('div', { class: 'muted' }, 'Live: the whole game uses these until you reload. Changed values are yellow.'),
      this.tuningEl,
    );
    this.root = h('div', { class: 'dev', style: 'position:fixed;inset:0;overflow:auto;background:rgba(0,0,0,.92);z-index:20;padding:14px 18px' },
      h('div', { class: 'row', style: 'justify-content:space-between;max-width:1280px;margin:0 auto 8px' },
        h('h2', { style: 'margin:0;font-size:15px' }, 'Balance lab'), btn('Close (Esc)', () => { this.leaving = true; }, 'primary')),
      h('div', { style: 'display:flex;gap:24px;max-width:1280px;margin:0 auto;flex-wrap:wrap' }, left, h('div', { style: 'flex:1 1 560px;min-width:0' }, this.resultsEl)),
    );
    document.body.append(this.root);
    this.renderTuning();
    if (lastMatrix) { this.matrix = lastMatrix; this.mode = 'matrix'; }
    if (lastSingle) this.mode = 'single';
    if (lastGrid) this.mode = 'grid';
    this.renderResults();
  }

  private renderProgress(): void {
    if (this.mode === 'grid' && lastGrid) {
      const r = lastGrid.run, running = r.done < r.total && this.runBtns[0]?.disabled;
      this.progressEl.textContent = running ? `Running grid on ${r.how}… ${r.done}/${r.total} deck pairs` : `Grid done: ${lastGrid.report.matches} matches (${r.how}).`;
      return;
    }
    const all = this.mode === 'single' ? (lastSingle ? [lastSingle] : []) : [...this.matrix.values()];
    const done = all.reduce((a, t) => a + t.stats.n, 0), total = all.reduce((a, t) => a + t.n, 0);
    this.progressEl.textContent = this.tasks.length ? `Running… ${done}/${total} matches` : total ? `Done: ${done} matches.` : '';
  }

  private renderTuning(): void {
    const groups = new Map<string, string[]>();
    for (const p of tuningPaths()) {
      const g = p.includes('.') ? p.split('.').slice(0, -1).join('.') : 'general';
      (groups.get(g) ?? groups.set(g, []).get(g)!).push(p);
    }
    this.tuningEl.replaceChildren(
      h('div', { class: 'row' }, btn('Reset all', () => { resetAll(); this.renderTuning(); this.renderResults(); })),
      ...[...groups].map(([g, paths]) => h('div', {},
        h('h3', {}, g),
        ...paths.map(p => {
          const input = h('input', { type: 'number', step: 'any', value: getTuning(p), class: getTuning(p) !== defaultTuning(p) ? 'mod' : '' });
          input.addEventListener('change', () => {
            const v = Number(input.value);
            if (!Number.isFinite(v)) return;
            setTuning(p, v);
            input.classList.toggle('mod', v !== defaultTuning(p));
          });
          return h('div', { class: 'row', style: 'justify-content:space-between' }, h('span', {}, p.split('.').pop()!), h('span', { class: 'row' }, h('span', { class: 'muted' }, `(${defaultTuning(p)})`), input));
        }),
      )),
    );
  }

  /** Text box of balance edits (src/dev/script.ts). Also takes the old overrides JSON. */
  private scriptBox(): HTMLElement {
    const area = h('textarea', { rows: 9, spellcheck: false, style: 'width:100%;font:inherit;background:#000;color:#fcfcfc;border:1px solid #7c7c7c' });
    area.value = loadScript();
    const msg = h('div', { class: 'muted' });
    area.addEventListener('input', () => saveScript(area.value));
    const apply = (): void => {
      const text = area.value.trim();
      if (text.startsWith('{')) {
        try { replaceOverrides(JSON.parse(text)); msg.className = 'good'; msg.textContent = 'Applied the pasted JSON.'; } catch { msg.className = 'bad'; msg.textContent = 'Not valid JSON.'; return; }
      } else {
        const res = parseScript(area.value);
        if (res.errors.length) { msg.className = 'bad'; msg.textContent = res.errors.join(' · '); return; }
        replaceOverrides(res.overrides);
        msg.className = 'good';
        msg.textContent = `Applied ${overrideCount(res.overrides)} change${overrideCount(res.overrides) === 1 ? '' : 's'} from ${res.lines} line${res.lines === 1 ? '' : 's'}. The whole game uses them until reload.`;
      }
      this.renderTuning();
      this.renderResults();
    };
    return h('div', {},
      h('div', { class: 'muted' }, 'Edit class and card numbers as text, then Apply. Apply replaces earlier edits (sliders and Power % included).'),
      area,
      h('div', { class: 'row' },
        btn('Apply script', apply, 'primary'),
        btn('Current edits as script', () => { area.value = `${SCRIPT_HELP}${toScript(overrides())}\n`; saveScript(area.value); }),
        btn('Copy', () => { void navigator.clipboard?.writeText(area.value); }),
        btn('Clear', () => { area.value = SCRIPT_HELP; saveScript(area.value); replaceOverrides({}); msg.textContent = 'Back to the shipped numbers.'; this.renderTuning(); this.renderResults(); }),
      ),
      msg,
    );
  }

  private gridView(r: GridReport): HTMLElement {
    const ids = classIds();
    const color = (v: number): string => (v >= 0.6 ? '#58d854' : v > THIN ? '#b8f818' : v > 1 - THIN ? '#fcfcfc' : v > 0.4 ? '#fca044' : '#f83800');
    const cell = (a: string, b: string): HTMLElement => {
      if (a === b) return h('td', { class: 'muted' }, '-');
      const c = r.grid[a]?.[b], v = cellRate(c);
      if (Number.isNaN(v)) return h('td', { class: 'muted' }, '…');
      const [lo, hi] = cellRange(c);
      return h('td', { style: `color:${color(v)}`, title: `${c!.wins}-${c!.losses}, 95% ${pct(lo)}-${pct(hi)}` }, `${pct(v)} `, h('span', { class: 'muted' }, `±${Math.round((hi - lo) * 50)}`));
    };
    const deckRows = r.kind === 'starter' ? [] : r.decks.map(d => {
      const row = r.deckGrid[d.key] ?? {};
      const tot = Object.values(row).reduce((s, c) => ({ wins: s.wins + c.wins, losses: s.losses + c.losses, draws: s.draws + c.draws }), { wins: 0, losses: 0, draws: 0 });
      const arch = archetypesFor(d.cls).find(a => d.key.startsWith(`${d.cls}:${a.id}`));
      return h('tr', {}, h('td', { title: d.style ? styleById(d.style).desc : arch?.plan ?? '' }, `${cap(d.cls)} ${d.name}`), h('td', { class: 'muted' }, CARDS[mythicOf(d.deck)]?.name ?? '-'),
        ...ids.map(c => (c === d.cls ? h('td', { class: 'muted' }, '-') : h('td', { style: `color:${color(cellRate(row[c]))}` }, Number.isNaN(cellRate(row[c])) ? '…' : pct(cellRate(row[c]))))),
        h('td', {}, Number.isNaN(cellRate(tot)) ? '…' : pct(cellRate(tot))));
    });
    return h('div', {},
      h('h2', {}, `Full grid: ${r.kind} decks (row class win rate vs column class)`),
      h('div', { class: 'muted' }, `${r.decks.length} decks, ${r.matches} matches, average match ${r.avgTime.toFixed(0)}s.`),
      h('table', { style: 'width:auto' },
        h('thead', {}, h('tr', {}, h('th', {}, ''), ...ids.map(c => h('th', {}, cap(c))), h('th', {}, 'Overall'), h('th', {}, 'Fav'), h('th', {}, 'Rules'))),
        h('tbody', {}, ...ids.map(a => {
          const issues = ruleChecks(r, a, ids);
          return h('tr', {}, h('td', {}, cap(a)), ...ids.map(b => cell(a, b)), h('td', {}, pct(cellRate(classTotal(r, a)))),
            h('td', {}, favorable(r, a, ids).length), h('td', { class: issues.length ? 'warn' : 'good', style: 'text-align:left;white-space:normal' }, issues.join('; ') || 'ok'));
        })),
      ),
      deckRows.length ? h('h3', {}, 'By deck (hover a name for its plan)') : null,
      deckRows.length ? h('table', { style: 'width:auto' }, h('thead', {}, h('tr', {}, h('th', {}, 'Deck'), h('th', {}, 'Mythic'), ...ids.map(c => h('th', {}, cap(c))), h('th', {}, 'Overall'))), h('tbody', {}, ...deckRows)) : null,
    );
  }

  private renderResults(): void {
    const out: Node[] = [];
    if (this.mode === 'grid' && lastGrid) out.push(this.gridView(lastGrid.report));
    if (this.mode === 'matrix' && this.matrix.size) out.push(this.matrixView());
    const single = lastSingle;
    if (single && single.stats.n) out.push(this.singleView(single));
    if (!out.length) out.push(h('div', { class: 'muted', style: 'margin-top:30px' }, 'Pick two sides and run a matchup. Results show win rates with 95% ranges, match length, where damage comes from, and per-card stats.'));
    if (isModified()) out.unshift(h('div', { class: 'warn' }, 'Tuning overrides are on. Results reflect your changed numbers.'));
    this.resultsEl.replaceChildren(...out);
  }

  private matrixView(): HTMLElement {
    const ids = classIds();
    const rate = (a: ClassId, b: ClassId): [number, number] => {
      const x = this.matrix.get(`${a}:${b}`)?.stats, y = this.matrix.get(`${b}:${a}`)?.stats;
      const wins = (x?.wins[0] ?? 0) + (y?.wins[1] ?? 0), n = (x ? x.n - x.draws : 0) + (y ? y.n - y.draws : 0);
      return [wins, n];
    };
    const color = (v: number): string => (v >= 0.6 ? '#58d854' : v >= 0.55 ? '#b8f818' : v > 0.45 ? '#fcfcfc' : v > 0.4 ? '#fca044' : '#f83800');
    return h('div', {},
      h('h2', {}, 'Class matrix (row class win rate vs column class)'),
      h('table', { style: 'width:auto' },
        h('thead', {}, h('tr', {}, h('th', {}, ''), ...ids.map(c => h('th', {}, cap(c))))),
        h('tbody', {}, ...ids.map(a => h('tr', {}, h('td', {}, cap(a)), ...ids.map(b => {
          if (a === b) return h('td', { class: 'muted' }, '-');
          const [w, n] = rate(a, b);
          if (!n) return h('td', { class: 'muted' }, '…');
          const [lo, hi] = wilson(w, n);
          return h('td', { style: `color:${color(w / n)}`, title: `${w}/${n} wins, 95% ${pct(lo)}-${pct(hi)}` }, `${pct(w / n)} `, h('span', { class: 'muted' }, `±${Math.round((hi - lo) * 50)}`));
        })))),
      ),
      h('div', { class: 'muted' }, 'Hover a cell for the win count. Design target (see the soft-counter wheel): a counter should sit around 55-60%, never above ~65%.'),
    );
  }

  private singleView(t: Task): HTMLElement {
    const s = t.stats, [A, B] = t.specs;
    const decided = s.n - s.draws;
    const [lo, hi] = wilson(s.wins[0], decided);
    const name = (i: 0 | 1): string => `${cap(t.specs[i].cls)} (${t.specs[i].cpu})`;
    const splitBar = (i: 0 | 1): HTMLElement => {
      const sp = s.split[i], tot = sp.basic + sp.spell + sp.other || 1;
      const seg = (v: number, col: string, left: number): HTMLElement => h('div', { style: `left:${left * 100}%;width:${(v / tot) * 100}%;background:${col}` });
      return h('div', { class: 'row', style: 'flex-wrap:nowrap' },
        h('span', { style: 'width:150px' }, name(i)),
        h('div', { class: 'bar', style: 'flex:1' }, seg(sp.basic, '#bcbcbc', 0), seg(sp.spell, '#f8b800', sp.basic / tot), seg(sp.other, '#f878f8', (sp.basic + sp.spell) / tot)),
        h('span', { class: 'muted', style: 'width:270px;text-align:right' }, `basic ${pct(sp.basic / tot)} · spell ${pct(sp.spell / tot)} · other ${pct(sp.other / tot)}`),
      );
    };
    const winBar = h('div', { class: 'bar', style: 'height:14px;margin:4px 0' },
      h('div', { style: `width:${(s.wins[0] / Math.max(1, s.n)) * 100}%;background:#d82800` }),
      h('div', { style: `left:${(s.wins[0] / Math.max(1, s.n)) * 100}%;width:${(s.wins[1] / Math.max(1, s.n)) * 100}%;background:#0058f8` }));
    return h('div', {},
      h('h2', {}, `${name(0)} vs ${name(1)}`),
      h('div', {}, `${cap(A.cls)} wins ${s.wins[0]}/${s.n} (${pct(s.wins[0] / Math.max(1, decided))}, 95% range ${pct(lo)}-${pct(hi)}) · ${cap(B.cls)} wins ${s.wins[1]}`, s.draws ? ` · ${s.draws} timeouts` : ''),
      winBar,
      h('div', { class: 'muted' }, `Average match ${(s.time / s.n).toFixed(0)}s, ${(s.turns / s.n).toFixed(1)} Draw screens.`),
      h('h3', {}, 'Where damage comes from'),
      splitBar(0), splitBar(1),
      this.cardTable(t, 0), this.cardTable(t, 1),
    );
  }

  private cardTable(t: Task, side: 0 | 1): HTMLElement {
    const s = t.stats, spec = t.specs[side];
    const total = s.split[side].basic + s.split[side].spell + s.split[side].other || 1;
    const baseWr = s.wins[side] / Math.max(1, s.n);
    const rows = [...s.cards.values()].filter(c => c.side === side).map(c => ({
      c, card: CARDS[c.id], casts: c.casts / Math.max(1, c.matches), per: c.casts ? c.dmg / c.casts : 0, share: c.dmg / total,
      wr: c.castIn ? c.castWins / c.castIn : -1,
    }));
    const key = this.sortKey;
    rows.sort((a, b) => key === 'name' ? a.card.name.localeCompare(b.card.name) : key === 'casts' ? b.casts - a.casts : key === 'per' ? b.per - a.per : key === 'wr' ? b.wr - a.wr : b.c.dmg - a.c.dmg);
    // cards in the class but not in this deck can still be power-tuned, so list them at the end
    const missing = cardsFor(spec.cls).filter(c => !(c.id in spec.deck));
    const th = (label: string, k: typeof key, tip: string): HTMLElement => h('th', { title: tip, onclick: () => { this.sortKey = k; this.renderResults(); }, style: k === key ? 'color:#f8b800' : '' }, label);
    const power = (id: string): HTMLElement => {
      const input = h('input', { type: 'number', step: 5, value: Math.round(cardPower(id) * 100), class: cardPower(id) !== 1 ? 'mod' : '', style: 'width:58px' });
      input.addEventListener('change', () => { const v = Number(input.value); if (Number.isFinite(v) && v >= 0) { setPower(id, v / 100); input.classList.toggle('mod', v !== 100); } });
      return h('td', {}, input);
    };
    return h('div', {},
      h('h3', {}, `${cap(spec.cls)} cards (side ${side ? 'B' : 'A'}, won ${pct(baseWr)} overall)`),
      h('table', {},
        h('thead', {}, h('tr', {},
          th('Card', 'name', 'Sort by name'), h('th', { title: 'Copies in the deck' }, 'Copies'),
          th('Casts/match', 'casts', 'Average casts per match'), th('Dmg/cast', 'per', 'Average damage dealt per cast, including burns it lit'),
          th('Dmg share', 'dmg', 'Share of all damage this side dealt'), th('Win% when cast', 'wr', 'Win rate in matches where this card was cast at least once. Compare with the side\'s overall win rate.'),
          h('th', { title: 'Damage multiplier for this card, in percent. Applies everywhere until reload.' }, 'Power %'))),
        h('tbody', {},
          ...rows.map(r => h('tr', {},
            h('td', { style: `color:${RARITY_COLOR[r.card.rarity]}`, title: r.card.short }, r.card.name),
            h('td', {}, spec.deck[r.c.id] ?? 0),
            h('td', {}, r.casts.toFixed(2)),
            h('td', {}, r.per ? Math.round(r.per) : '-'),
            h('td', {}, r.c.dmg ? pct(r.share) : '-'),
            h('td', { style: r.wr < 0 ? '' : `color:${r.wr - baseWr > 0.08 ? '#58d854' : r.wr - baseWr < -0.08 ? '#f83800' : '#fcfcfc'}` }, r.wr < 0 ? '-' : pct(r.wr)),
            power(r.c.id),
          )),
          ...missing.map(c => h('tr', { class: 'muted' }, h('td', { title: c.short }, c.name), h('td', {}, 0), h('td', {}, '-'), h('td', {}, '-'), h('td', {}, '-'), h('td', {}, '-'), power(c.id))),
        ),
      ),
    );
  }
}
