// Art Lab: the one place to review how the game looks and sounds, built from the real game code. A tab per class
// (its light and heavy attacks and every spell its lab.ts lists, in the shipped look, the look before the last
// pass, or a draft waiting for a pick), then stages and screens. Each class or stage folder brings its own lab
// entries, so new content shows up here on its own. Controls live in a DOM panel: docked right, or along the
// bottom in phone portrait.
import { popScene, type Scene } from './scene';
import { CLASSES, classRules, type ClassLab, type LabLook, type LabSpell } from '../content/classes';
import { Battle, NO_INTENT } from '../game/battle';
import { drawBattle, getArena } from '../game/battleView';
import { CARDS, cardsFor } from '../game/cards';
import { starterDeck, toList } from '../game/deck';
import { registerPfx, unregisterPfx, registerShotPfx, unregisterShotPfx } from '../game/pfx';
import { EFFECTS, PLAYS, SHOT_PLAYS } from '../fx';
import { playBattleEvent } from '../engine/battleAudio';
import { unlockAudio, playMusic, stopMusic, stageTrack } from '../engine/audio';
import { UW, UH, P, type Ctx } from '../engine/gfx';
import { drawTextCentered } from '../engine/font';
import { wasPressed, navPressed, k } from '../engine/input';
import { touchActive, viewport, type PadMode } from '../engine/touch';
import type { ClassId } from '../art/sprites';
import { h, btn, choice, check, reserveRight } from '../dev/dom';

const SPEEDS: Array<[number, string]> = [[0.1, '0.1×'], [0.25, '¼×'], [0.5, '½×'], [1, '1×']];
const STEP = 1 / 60;
/** Tabs after the classes; filled in one at a time. */
const LATER = ['STAGES', 'SCREENS'];

/** One thing the lab plays on loop: a basic attack or a spell. */
interface Entry { label: string; basic?: 'light' | 'heavy'; card?: string; foeCol: number; loop: number; hp?: number }
/** In game: what ships. Before: the hand-drawn look the last pass replaced. A number: that draft. */
type Look = 'game' | 'before' | number;

// remembered while the page is open
const saved = { cls: 'warrior' as ClassId, entry: 0, look: 'game' as Look, speed: 1, auto: true, sound: true };

const labOf = (cls: string): ClassLab => CLASSES.get(cls)?.lab ?? { spells: [] };

function entriesOf(cls: string): Entry[] {
  const m = CLASSES.get(cls)!, lab = labOf(cls);
  // melee classes fight from up close; the rest from across the field
  const near = m.info.melee ? 3 : 4;
  const col = lab.basicsFoeCol ?? near;
  // lab.ts tunes and orders spells; any spell it leaves out still shows, after them, with defaults
  const listed = lab.spells.filter(s => CARDS[s.card]);
  const rest = cardsFor(cls as ClassId).filter(c => !listed.some(s => s.card === c.id)).map(c => ({ card: c.id }) as LabSpell);
  return [
    { label: `LIGHT: ${m.info.basics[0]}`, basic: 'light', foeCol: col, loop: 1.2 },
    { label: `HEAVY: ${m.info.basics[1]}`, basic: 'heavy', foeCol: col, loop: 1.6 },
    ...[...listed, ...rest].map(s => ({ label: CARDS[s.card].name, card: s.card, foeCol: s.foeCol ?? near, loop: s.loop ?? 2, hp: s.hp })),
  ];
}

/** The fx kinds (and shot kinds) this class's shipped looks play. */
const ownKinds = (cls: string, table: Record<string, string>): string[] => Object.keys(table).filter(kd => table[kd].startsWith(`${cls}/`));

/** Draw with `look` swapped in, then put the shipped looks back. Render-only: the battle itself never changes. */
function withLook(b: Battle, cls: string, look: Look, draw: () => void): void {
  if (look === 'game') { draw(); return; }
  const lab = labOf(cls);
  const kinds: string[] = [], shots: string[] = [];
  const renamed: Array<[{ kind: string }, string]> = [];
  if (look === 'before') {
    for (const kd of ownKinds(cls, PLAYS)) { unregisterPfx(kd); kinds.push(kd); }
    for (const kd of ownKinds(cls, SHOT_PLAYS)) { unregisterShotPfx(kd); shots.push(kd); }
    for (const e of b.fx) if (lab.was && e.kind in lab.was) { renamed.push([e, e.kind]); e.kind = lab.was[e.kind] ?? 'none'; }
  } else {
    const d: LabLook | undefined = lab.drafts?.[look];
    for (const [kd, id] of Object.entries(d?.plays ?? {})) if (EFFECTS[id]) { registerPfx(kd, EFFECTS[id]); kinds.push(kd); }
    for (const [kd, id] of Object.entries(d?.shots ?? {})) if (EFFECTS[id]) { registerShotPfx(kd, EFFECTS[id]); shots.push(kd); }
  }
  try { draw(); } finally {
    for (const [e, kd] of renamed) e.kind = kd;
    for (const kd of kinds) { if (PLAYS[kd]) registerPfx(kd, EFFECTS[PLAYS[kd]]); else unregisterPfx(kd); }
    for (const kd of shots) { if (SHOT_PLAYS[kd]) registerShotPfx(kd, EFFECTS[SHOT_PLAYS[kd]]); else unregisterShotPfx(kd); }
  }
}

export class ArtLabScene implements Scene {
  private b!: Battle;
  private t = 0;
  private paused = false;
  private step = false;
  private leaving = false;
  private root!: HTMLElement;
  private body!: HTMLElement;
  private onKey = (e: KeyboardEvent): void => this.key(e);
  private onResize = (): void => this.layout();

  constructor(private back: () => void = popScene) {
    if (!CLASSES.has(saved.cls)) saved.cls = CLASSES.ids[0] as ClassId;
    this.restart();
  }

  pad(): PadMode { return 'none'; }

  enter(): void {
    playMusic(stageTrack(getArena().id));
    this.mount();
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('resize', this.onResize);
  }

  private exit(): void {
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('resize', this.onResize);
    this.root.remove();
    reserveRight(0);
    stopMusic();
    this.back();
  }

  private key(e: KeyboardEvent): void {
    if (e.code === 'KeyP') this.togglePause();
    if (e.code === 'Period') { this.paused = true; this.step = true; this.render(); }
  }

  // ---------- the loop ----------
  private entries(): Entry[] { return entriesOf(saved.cls); }

  private restart(): void {
    const list = this.entries();
    saved.entry = Math.min(saved.entry, list.length - 1);
    const en = list[saved.entry];
    const cls = saved.cls, foeCls = (cls === 'mage' ? 'warrior' : 'mage') as ClassId;
    const b = new Battle({ cls, deck: toList(starterDeck(cls)), name: 'YOU' }, { cls: foeCls, deck: toList(starterDeck(foeCls)), name: 'DUMMY' }, 7);
    b.phase = 'fight';
    b.sink = saved.sound ? playBattleEvent : null;
    b.costOf = () => 0;
    b.canAfford = () => true;
    const f = b.f[0], foe = b.f[1];
    f.col = 1; f.row = 1; foe.col = en.foeCol; foe.row = 1;
    if (en.hp) f.hp = Math.round(f.maxHp * en.hp);
    f.castCd = 0; f.lock = 0;
    if (en.basic) classRules(cls).basic(b, f, en.basic);
    else if (en.card) {
      // spells that need stealth start in it
      if (CARDS[en.card].needsStealth) f.st.stealth = 1;
      f.queue = [en.card]; b.castTop(f, null);
    }
    this.b = b;
    this.t = 0;
  }

  update(dt: number): void {
    if (this.leaving) { this.exit(); return; }
    if (wasPressed('back')) { this.leaving = true; return; }
    const n = this.entries().length;
    if (navPressed('down', dt)) this.pick((saved.entry + 1) % n);
    if (navPressed('up', dt)) this.pick((saved.entry + n - 1) % n);
    if (navPressed('right', dt)) this.cycleLook(1);
    if (navPressed('left', dt)) this.cycleLook(-1);
    if (wasPressed('confirm')) { unlockAudio(); this.restart(); }
    if (wasPressed('lb') || wasPressed('rb')) {
      const ids = CLASSES.ids, i = ids.indexOf(saved.cls);
      this.setClass(ids[(i + (wasPressed('rb') ? 1 : ids.length - 1)) % ids.length] as ClassId);
    }
    if (wasPressed('pause') && !wasPressed('back')) this.togglePause();
    if (this.paused && !this.step) return;
    const sdt = this.step ? STEP : dt * saved.speed;
    this.step = false;
    this.t += sdt;
    const en = this.entries()[saved.entry];
    if (this.t >= en.loop && saved.auto) this.restart();
    const b = this.b;
    b.gauge = 0;
    b.update(sdt, [NO_INTENT, NO_INTENT]);
    b.f[1].hp = b.f[1].maxHp;
  }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    withLook(this.b, saved.cls, saved.look, () => drawBattle(c, this.b, tick, 0, true));
    const en = this.entries()[saved.entry];
    const tag = [en.label, this.lookName(saved.look), saved.speed !== 1 ? `${saved.speed}X` : '', this.paused ? 'PAUSED' : ''].filter(Boolean).join('   ');
    P(ui, '#000000', 0, UH - 16, UW, 16);
    drawTextCentered(ui, tag, UW / 2, UH - 12, this.paused ? '#f8b800' : '#fcfcfc', 1, false);
    drawTextCentered(ui, 'ART LAB', UW / 2, 6, '#f8b800', 1, true);
  }

  // ---------- picking ----------
  private looks(): Look[] { return ['game', 'before', ...(labOf(saved.cls).drafts ?? []).map((_, i) => i)]; }
  private lookName(l: Look): string { return l === 'game' ? 'IN GAME' : l === 'before' ? 'BEFORE' : (labOf(saved.cls).drafts?.[l]?.name ?? '?').toUpperCase(); }

  private pick(i: number): void { saved.entry = i; this.restart(); this.render(); }
  private cycleLook(d: number): void {
    const ls = this.looks(), i = ls.indexOf(saved.look);
    saved.look = ls[(i + d + ls.length) % ls.length];
    this.render();
  }
  private setClass(cls: ClassId): void {
    saved.cls = cls; saved.entry = 0;
    if (!this.looks().includes(saved.look)) saved.look = 'game';
    this.restart(); this.render();
  }
  private togglePause(): void { this.paused = !this.paused; this.render(); }

  // ---------- the panel ----------
  /** Phone portrait: the panel takes the bottom half under the game; otherwise it docks on the right. */
  private portrait(): boolean { const [vw, vh] = touchActive() ? viewport() : [innerWidth, innerHeight]; return touchActive() && vh > vw; }

  private layout(): void {
    if (!this.root) return;
    // reserveRight fires a resize, which lands back here: only reserve when the width changes
    const reserve = (px: number): void => { if (Number(document.body.dataset.reserveRight ?? 0) !== px) reserveRight(px); };
    const [vw] = touchActive() ? viewport() : [innerWidth];
    if (this.portrait()) {
      reserve(0);
      this.root.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:50%;overflow:auto;background:#000;border-top:2px solid #3c3c3c;padding:8px 10px;z-index:20';
    } else {
      const w = Math.round(Math.min(340, vw * 0.42));
      reserve(w);
      this.root.style.cssText = `position:fixed;top:0;right:0;bottom:0;width:${w}px;overflow:auto;background:#000;border-left:2px solid #3c3c3c;padding:10px 12px;z-index:20`;
    }
  }

  private mount(): void {
    this.body = h('div');
    this.root = h('div', { class: 'dev art-lab' });
    this.root.append(this.body);
    document.body.append(this.root);
    this.layout();
    this.render();
  }

  private render(): void {
    if (!this.body) return;
    const big = 'min-height:32px;';
    const tabs = h('div', { class: 'row' },
      ...CLASSES.ids.map(id => { const b = btn(CLASSES.get(id)!.info.name, () => this.setClass(id as ClassId), id === saved.cls ? 'on' : ''); b.style.cssText = big; return b; }),
      ...LATER.map(t => { const b = btn(t, () => {}); b.disabled = true; b.title = 'Coming next'; b.style.cssText = big; return b; }),
    );
    const looks = choice(this.looks().map(l => [String(l), this.lookName(l)] as [string, string]), String(saved.look), v => {
      saved.look = v === 'game' || v === 'before' ? v : Number(v); this.render();
    });
    const speed = choice(SPEEDS, saved.speed, v => { saved.speed = v; this.render(); });
    const list = h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:3px' },
      ...this.entries().map((en, i) => { const b = btn(en.label, () => { unlockAudio(); this.pick(i); }, i === saved.entry ? 'on' : ''); b.style.cssText = `${big}text-align:left`; return b; }),
    );
    const card = this.entries()[saved.entry].card;
    const drafts = labOf(saved.cls).drafts?.length ?? 0;
    this.body.replaceChildren(
      h('div', { class: 'row', style: 'justify-content:space-between' }, h('h2', { style: 'margin:0' }, 'Art Lab'), btn('Exit (Esc)', () => { this.leaving = true; }, 'primary')),
      h('div', { class: 'muted' }, touchActive() ? 'Real game code. Tap a spell to play it on loop, pick a look to compare.' : `Real game code. ${k('up')}/${k('down')} spell · ${k('left')}/${k('right')} look · ${k('attack')} replay · P pause · . step a frame · ${k('cast')} exit · Q/E or LB/RB class · START pause.`),
      tabs,
      h('h3', {}, 'Look'), looks.el,
      h('div', { class: 'muted' }, drafts ? `${drafts} draft${drafts > 1 ? 's' : ''} waiting for a pick.` : 'No drafts waiting. BEFORE shows the look the last pass replaced.'),
      h('h3', {}, 'Playback'),
      h('div', { class: 'row' },
        btn('Replay', () => { unlockAudio(); this.restart(); }),
        btn(this.paused ? 'Resume (P)' : 'Pause (P)', () => this.togglePause(), this.paused ? 'on' : ''),
        btn('Step (.)', () => { this.paused = true; this.step = true; this.render(); }),
        check('Loop', saved.auto, v => { saved.auto = v; }),
        check('Sound', saved.sound, v => { saved.sound = v; unlockAudio(); this.restart(); }),
      ),
      speed.el,
      h('h3', {}, 'Spell FX'),
      h('div', { class: 'muted' }, card ? `${CARDS[card].name}: ${CARDS[card].short}` : ''),
      list,
    );
  }
}
