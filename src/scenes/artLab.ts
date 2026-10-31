// Art Lab: the one place to review how the game looks and sounds, built from the real game code. A tab per class,
// in four sections: Spell FX (its light and heavy attacks and every spell, in the shipped look, the look before the
// last pass, or a draft waiting for a pick), Animations (every move the fighter makes, in any skin), Sprites (the
// drawn frames, tints, portrait and spell icons, big) and Sounds (voice lines, and every sound a move or spell
// fires, listed as it plays). Then a Stages tab (every registered stage, idle, with every panel state, or under a CPU fight),
// and a Screens tab that opens any screen of the game (src/dev/screens.ts, shared with the screen tests). Each class or stage folder brings its own lab
// entries, so new content shows up here on its own. Controls live in a DOM panel: docked right, or along the
// bottom in phone portrait.
import { popScene, setScene, type Scene } from './scene';
import { pauseSaves } from '../engine/save';
import { CLASSES, classRules, type ClassLab, type LabLook, type LabSpell } from '../content/classes';
import { Battle, NO_INTENT, type Intent, type Dir } from '../game/battle';
import type { BattleEvent, VoiceKind } from '../game/events';
import { SKINS, type ClassId } from '../art/sprites';
import { panelFoot } from '../art/arena';
import { drawSprites, spriteViews, SPRITE_ABOUT, type SpriteView } from './artLabSprites';
import { drawBattle, getArena, useStage } from '../game/battleView';
import { STAGES, getStage, stageMusic } from '../content/stages';
import { Cpu } from '../game/ai';
import { CARDS, cardsFor } from '../game/cards';
import { starterDeck, toList } from '../game/deck';
import { registerPfx, unregisterPfx, registerShotPfx, unregisterShotPfx } from '../game/pfx';
import { EFFECTS, PLAYS, SHOT_PLAYS } from '../fx';
import { playBattleEvent } from '../engine/battleAudio';
import { unlockAudio, playMusic, stopMusic, voiceLine } from '../engine/audio';
import { UW, UH, P, view, type Ctx } from '../engine/gfx';
import { drawTextCentered } from '../engine/font';
import { wasPressed, navPressed, k } from '../engine/input';
import { touchActive, viewport, type PadMode } from '../engine/touch';
import { h, btn, choice, check, reserveRight } from '../dev/dom';

const SPEEDS: Array<[number, string]> = [[0.1, '0.1×'], [0.25, '¼×'], [0.5, '½×'], [1, '1×']];
const STEP = 1 / 60;
/** Tabs after the classes; filled in one at a time. */
const STAGES_TAB = 'stages', SCREENS_TAB = 'screens';
/** Screen names from src/dev/screens.ts, loaded the first time the Screens tab opens. */
let screenNames: string[] | null = null;

/** One thing the lab plays on loop: a basic attack, a spell, an animation, a sprite view, a voice line or a stage scene. */
interface Entry {
  label: string; basic?: 'light' | 'heavy'; card?: string; foeCol: number; loop: number; hp?: number; scene?: StageScene; screen?: string;
  anim?: AnimKind; sprite?: SpriteView; voice?: VoiceKind;
}
/** A class tab's sections. */
type Section = 'fx' | 'anims' | 'sprites' | 'sounds';
const SECTIONS: Array<[Section, string]> = [['fx', 'SPELL FX'], ['anims', 'ANIMATIONS'], ['sprites', 'SPRITES'], ['sounds', 'SOUNDS']];
const SECTION_TITLE: Record<Section, string> = { fx: 'Spell FX', anims: 'Animations', sprites: 'Sprites', sounds: 'Sounds' };

/** Every move a fighter animates, each scripted on the real battle (see ArtLabScene.script). */
type AnimKind = 'idle' | 'steps' | 'knock' | 'hit' | 'bigHit' | 'light' | 'heavy' | 'charge' | 'cast' | 'frozen' | 'stunned' | 'ko';
const ANIMS: Array<[AnimKind, string, number, string]> = [
  ['idle', 'IDLE', 3, 'Standing: the idle breathing loop.'],
  ['steps', 'STEPS', 2.4, 'A step forward, back, up and down.'],
  ['knock', 'KNOCKBACK', 1.2, 'A knockback hit pushes the fighter a panel back.'],
  ['hit', 'HIT', 1, 'A small hit, under the flinch threshold.'],
  ['bigHit', 'BIG HIT', 1.4, 'A hit big enough to flinch.'],
  ['light', 'LIGHT ATTACK', 1.2, 'The light basic attack.'],
  ['heavy', 'HEAVY ATTACK', 1.6, 'The heavy basic attack, straight away.'],
  ['charge', 'CHARGE + RELEASE', 2.2, 'Holding attack to charge, then letting go.'],
  ['cast', 'CAST', 1.2, 'The casting pose (the element is the class\'s first spell\'s).'],
  ['frozen', 'FROZEN', 2.8, 'Frozen for 2 seconds.'],
  ['stunned', 'STUNNED', 2.8, 'Stunned for 2 seconds.'],
  ['ko', 'K.O.', 3.5, 'Knocked out.'],
];
const VOICES: VoiceKind[] = ['cast', 'castBig', 'death', 'win', 'grunt', 'hurt', 'hurtBig'];
const SOUND_ABOUT = 'Every sound the move fires is listed below as it plays; tap one to hear it alone. Voice lines play on their own. Sound is always on in this section.';
type StageScene = 'idle' | 'panels' | 'fight';
const STAGE_ENTRIES: Entry[] = [
  { label: 'IDLE', scene: 'idle', foeCol: 4, loop: Infinity },
  { label: 'PANEL STATES', scene: 'panels', foeCol: 4, loop: Infinity },
  { label: 'CPU FIGHT', scene: 'fight', foeCol: 4, loop: 40 },
];
/** In game: what ships. Before: the hand-drawn look the last pass replaced. A number: that draft. */
type Look = 'game' | 'before' | number;

// remembered while the page is open
const saved = {
  tab: 'warrior', cls: 'warrior' as ClassId, stage: '', entry: 0, look: 'game' as Look, speed: 1, auto: true, sound: true,
  section: 'fx' as Section, skins: {} as Record<string, string>, alt: false, grid: true, zoom: 1,
};
const skinOfLab = (cls: string): string => saved.skins[cls] ?? SKINS[cls as ClassId][0].id;

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

/** The corner button that leaves a previewed screen for the lab's Screens tab. */
function backButton(name: string): void {
  document.querySelector('.art-lab-back')?.remove();
  const b = btn(`◀ ART LAB · ${name} · saves paused till reload`, () => { b.remove(); setScene(new ArtLabScene(popScene, { tab: SCREENS_TAB, entry: (screenNames ?? []).indexOf(name) })); }, 'primary');
  b.className = 'art-lab-back';
  b.style.cssText = 'position:fixed;left:6px;top:6px;z-index:40;font:11px ui-monospace,monospace;opacity:.85;color:#f8b800;background:#000;border:1px solid #f8b800;padding:4px 8px;cursor:pointer';
  document.body.append(b);
}

const STAGE_ABOUT: Record<StageScene, string> = {
  idle: 'Both fighters standing: the stage and its animation on its own.',
  panels: 'Every panel state on this stage: cracked, hole, burning, toxic, blessed, cursed, smoke, cracked + burning.',
  fight: 'CPU vs CPU on normal, a new class pairing each loop.',
};
/** A stage's display name, built on first use. */
const stageName = (id: string): string => getStage(id).name.toUpperCase();

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

/** Blow the world layer up `z`× around the left fighter, whole pixels only. */
let zoomBuf: HTMLCanvasElement | null = null;
function zoomOn(c: Ctx, b: Battle, z: number): void {
  const cv = c.canvas, f = b.f[0], p = panelFoot(f.col, f.row);
  zoomBuf ??= document.createElement('canvas');
  if (zoomBuf.width !== cv.width || zoomBuf.height !== cv.height) { zoomBuf.width = cv.width; zoomBuf.height = cv.height; }
  const t = zoomBuf.getContext('2d')!;
  t.clearRect(0, 0, cv.width, cv.height);
  t.drawImage(cv, 0, 0);
  const sw = Math.floor(cv.width / z), sh = Math.floor(cv.height / z);
  const sx = Math.max(0, Math.min(cv.width - sw, Math.round(p.x + view.ox + 16 - sw / 2)));
  const sy = Math.max(0, Math.min(cv.height - sh, Math.round(p.y + view.oy - 14 - sh / 2)));
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.imageSmoothingEnabled = false;
  c.drawImage(zoomBuf, sx, sy, sw, sh, 0, 0, sw * z, sh * z);
  c.restore();
}

/** How the Sounds section names a battle event. */
function soundName(e: BattleEvent): string {
  if (e.type === 'sound') return e.name;
  if (e.type === 'fxSound') return `fx:${e.kind}`;
  if (e.type === 'voice') return `voice ${e.cls}:${e.kind}${e.element ? ` (${e.element})` : ''}`;
  return e.type;
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
  private cpus: [Cpu, Cpu] | null = null;
  private fights = 0;
  /** Sounds heard since the Sounds section's entry last restarted. */
  private heard: Array<{ t: number; e: BattleEvent }> = [];
  private logEl: HTMLElement | null = null;
  /** The stage shown when the lab opened, put back on exit. */
  private home = getArena().id;

  /** `opts` opens on a tab (a class id, 'stages' or 'screens'), section and entry, e.g. for the screen tests. */
  constructor(private back: () => void = popScene, opts: { tab?: string; section?: Section; entry?: number; zoom?: number; skin?: string } = {}) {
    if (opts.tab) { saved.tab = opts.tab; saved.entry = opts.entry ?? 0; if (CLASSES.has(opts.tab)) saved.cls = opts.tab as ClassId; }
    if (opts.section) saved.section = opts.section;
    if (opts.zoom) saved.zoom = opts.zoom;
    if (opts.skin) saved.skins[saved.cls] = opts.skin;
    if (!CLASSES.has(saved.cls)) saved.cls = CLASSES.ids[0] as ClassId;
    if (!STAGES.has(saved.stage)) saved.stage = this.home;
    this.restart();
    this.loadScreens();
  }

  /** The Screens tab's list comes from src/dev/screens.ts, which is loaded only when wanted. */
  private loadScreens(): void {
    if (!this.screensTab || screenNames) return;
    void import('../dev/screens').then(m => { screenNames = Object.keys(m.screens).filter(n => !n.startsWith('art-lab')); this.render(); });
  }

  /** The Stages and Screens tabs both play stage scenes on the canvas (Screens shows the stage idle behind its list). */
  private get stages(): boolean { return saved.tab === STAGES_TAB || saved.tab === SCREENS_TAB; }
  private get screensTab(): boolean { return saved.tab === SCREENS_TAB; }
  private tabs(): string[] { return [...CLASSES.ids, STAGES_TAB, SCREENS_TAB]; }

  pad(): PadMode { return 'none'; }

  enter(): void {
    playMusic(stageMusic(getArena().id));
    this.mount();
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('resize', this.onResize);
  }

  private exit(): void {
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('resize', this.onResize);
    this.root.remove();
    reserveRight(0);
    useStage(this.home);
    stopMusic();
    this.back();
  }

  private key(e: KeyboardEvent): void {
    if (e.code === 'KeyP') this.togglePause();
    const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
    if (n >= 0 && !this.stages) this.setSection(SECTIONS[n][0]);
    if (e.code === 'Period') { this.paused = true; this.step = true; this.render(); }
  }

  // ---------- the loop ----------
  private entries(): Entry[] {
    if (this.screensTab) return (screenNames ?? []).map(n => ({ label: n.toUpperCase(), screen: n, scene: 'idle', foeCol: 4, loop: Infinity }));
    if (this.stages) return STAGE_ENTRIES;
    const cls = saved.cls;
    switch (saved.section) {
      case 'anims': return ANIMS.map(([anim, label, loop]) => ({ label, anim, foeCol: 5, loop }));
      case 'sprites': return spriteViews(cls).map(([sprite, label]) => ({ label, sprite, foeCol: 5, loop: Infinity }));
      case 'sounds': return [...VOICES.map(voice => ({ label: `VOICE: ${voice.toUpperCase()}`, voice, foeCol: 4, loop: 2.5 })), ...entriesOf(cls)];
      default: return entriesOf(cls);
    }
  }
  private get sounds(): boolean { return !this.stages && saved.section === 'sounds'; }

  private restart(): void {
    const list = this.entries();
    saved.entry = Math.max(0, Math.min(saved.entry, list.length - 1));
    const en: Entry = list[saved.entry] ?? STAGE_ENTRIES[0];
    this.cpus = null;
    if (en.scene) { this.restartStage(en.scene); return; }
    useStage(this.home);
    const cls = saved.cls, foeCls = (cls === 'mage' ? 'warrior' : 'mage') as ClassId;
    const b = new Battle({ cls, deck: toList(starterDeck(cls)), name: 'YOU', skin: skinOfLab(cls) }, { cls: foeCls, deck: toList(starterDeck(foeCls)), name: 'DUMMY' }, 7);
    b.phase = 'fight';
    this.heard = [];
    this.showHeard();
    // the Sounds section always plays, and lists what it hears
    b.sink = this.sounds ? e => { this.hear(e); playBattleEvent(e); } : saved.sound ? playBattleEvent : null;
    b.costOf = () => 0;
    b.canAfford = () => true;
    const f = b.f[0], foe = b.f[1];
    f.col = 1; f.row = 1; foe.col = en.foeCol; foe.row = 1;
    if (en.hp) f.hp = Math.round(f.maxHp * en.hp);
    f.castCd = 0; f.lock = 0;
    if (en.voice) this.say(en.voice);
    else if (en.basic) classRules(cls).basic(b, f, en.basic);
    else if (en.card) {
      // spells that need stealth start in it
      if (CARDS[en.card].needsStealth) f.st.stealth = 1;
      f.queue = [en.card]; b.castTop(f, null);
    }
    this.b = b;
    this.t = 0;
  }

  /** A stage scene: the two fighters standing, every panel state laid out, or a CPU fight (a new pairing each loop). */
  private restartStage(scene: StageScene): void {
    useStage(saved.stage);
    const ids = CLASSES.ids as ClassId[];
    const a = scene === 'fight' ? ids[this.fights % ids.length] : 'warrior', bc = scene === 'fight' ? ids[(this.fights * 2 + 1) % ids.length] : 'mage';
    this.fights++;
    const b = new Battle({ cls: a, deck: toList(starterDeck(a)), name: 'P1' }, { cls: bc, deck: toList(starterDeck(bc)), name: 'P2' }, 7 + this.fights);
    b.phase = 'fight';
    b.sink = saved.sound ? playBattleEvent : null;
    b.f[0].col = 1; b.f[0].row = 1; b.f[1].col = 4; b.f[1].row = 1;
    if (scene === 'panels') {
      // one of each panel state, left to right
      const P = b.panels, long = 1e9;
      P[0][0].cracked = true;
      P[0][2].hole = long;
      P[2][0].burn = long;
      P[2][2].toxic = long; P[2][2].toxicSide = 1;
      P[3][0].bless = long;
      P[3][2].curse = long; P[3][2].curseSide = 0;
      P[5][0].smoke = long; P[5][0].smokeSide = 1;
      P[5][2].cracked = true; P[5][2].burn = long;
    }
    if (scene === 'fight') {
      this.cpus = [new Cpu('normal'), new Cpu('normal')];
      for (const f of b.f) f.queue = f.deck.slice(0, 5);
    }
    this.b = b;
    this.t = 0;
  }

  /** A voice line on its own (the Sounds section). */
  private say(kind: VoiceKind): void {
    const el = cardsFor(saved.cls)[0]?.element;
    unlockAudio();
    const e: BattleEvent = { type: 'voice', cls: saved.cls, kind, pan: 0, side: 0, element: kind === 'cast' ? el : undefined };
    this.hear(e);
    voiceLine(saved.cls, kind, 0, 0, e.type === 'voice' ? e.element : undefined);
  }

  private hear(e: BattleEvent): void {
    if (!this.sounds || e.type === 'hit' || e.type === 'cast' || e.type === 'ko') return;
    this.heard.push({ t: this.t, e });
    this.showHeard();
  }

  /** The Sounds section's list of what played, each a button that plays it again on its own. */
  private showHeard(): void {
    const el = this.logEl;
    if (!el) return;
    const en = this.entries()[saved.entry];
    const silent = en?.voice ? `No ${saved.cls} ${en.voice} clip yet: this line stays silent in game.` : 'Nothing yet.';
    el.replaceChildren(...(this.heard.length ? this.heard.map(({ t, e }) => {
      const b = btn(`${t.toFixed(2)}s  ${soundName(e)}`, () => {
        unlockAudio();
        if (e.type === 'voice') voiceLine(e.cls as ClassId, e.kind, 0, 0, e.element); else playBattleEvent(e);
      });
      b.style.cssText = 'min-height:28px;text-align:left;font:11px ui-monospace,monospace';
      return b;
    }) : [h('div', { class: 'muted' }, silent)]));
  }

  /** The Animations section: what the left fighter does this frame, by the clock. */
  private script(prev: number): Intent {
    const en = this.entries()[saved.entry], b = this.b, f = b.f[0], foe = b.f[1];
    const it: Intent = { ...NO_INTENT };
    if (!en?.anim) return it;
    const at = (s: number): boolean => prev < s && this.t >= s;
    const go = at(0.2);
    switch (en.anim) {
      case 'steps':
        for (const [s, d] of [[0.2, 'right'], [0.7, 'left'], [1.2, 'up'], [1.7, 'down']] as Array<[number, Dir]>) if (at(s)) it.move = d;
        break;
      case 'knock': if (go) b.damage(f, 300, foe, { knockback: true }); break;
      case 'hit': if (go) b.damage(f, 100, foe, {}); break;
      case 'bigHit': if (go) b.damage(f, 900, foe, {}); break;
      case 'light': case 'heavy': if (go) classRules(saved.cls).basic(b, f, en.anim); break;
      case 'charge': it.attackPressed = go; it.attackHeld = this.t > 0.2 && this.t < 1.6; break;
      case 'cast': if (go) { const el = cardsFor(saved.cls)[0]?.element ?? 'arcane'; b.addFx('cast', f.side, f.col, f.row, 0.3, { el }); b.voice(f, 'cast', el); } break;
      case 'frozen': if (go) b.freeze(f, 2); break;
      case 'stunned': if (go) b.stun(f, 2); break;
      case 'ko': if (go) b.damage(f, f.hp + 10, foe, {}); break;
      default: break;
    }
    return it;
  }

  update(dt: number): void {
    if (this.leaving) { this.exit(); return; }
    if (wasPressed('back')) { this.leaving = true; return; }
    const n = Math.max(1, this.entries().length);
    if (navPressed('down', dt)) this.pick((saved.entry + 1) % n);
    if (navPressed('up', dt)) this.pick((saved.entry + n - 1) % n);
    if (navPressed('right', dt)) this.cycleLook(1);
    if (navPressed('left', dt)) this.cycleLook(-1);
    if (wasPressed('confirm')) {
      unlockAudio();
      if (this.screensTab) { this.openScreen(); return; }
      this.restart();
    }
    if (wasPressed('lb') || wasPressed('rb')) {
      const ids = this.tabs(), i = ids.indexOf(saved.tab);
      this.setTab(ids[(i + (wasPressed('rb') ? 1 : ids.length - 1)) % ids.length]);
    }
    if (wasPressed('pause') && !wasPressed('back')) this.togglePause();
    if (wasPressed('reset') && !this.stages) this.setSection(SECTIONS[(SECTIONS.findIndex(([s]) => s === saved.section) + 1) % SECTIONS.length][0]);
    if (this.paused && !this.step) return;
    const sdt = this.step ? STEP : dt * saved.speed;
    this.step = false;
    const prev = this.t;
    this.t += sdt;
    const en = this.entries()[saved.entry] ?? STAGE_ENTRIES[0];
    if (this.t >= en.loop && saved.auto) this.restart();
    const b = this.b;
    b.gauge = 0;
    const cpus = this.cpus;
    b.update(sdt, cpus ? [cpus[0].intent(b, b.f[0], sdt), cpus[1].intent(b, b.f[1], sdt)] : [this.script(prev), NO_INTENT]);
    if (cpus) {
      // no Draw screens here: refill the queues instead
      for (const f of b.f) if (!f.queue.length) f.queue = f.deck.slice(0, 5);
      if (b.phase === 'ko' || b.phase === 'over') this.restart();
    } else b.f[1].hp = b.f[1].maxHp;
  }

  draw(c: Ctx, tick: number, ui: Ctx): void {
    const en = this.entries()[saved.entry] ?? STAGE_ENTRIES[0];
    if (this.stages) drawBattle(c, this.b, tick, 0, true);
    else if (en.sprite) { P(c, '#000000', -view.ox, -view.oy, view.w, view.h); drawSprites(ui, saved.cls, skinOfLab(saved.cls), saved.alt, en.sprite, saved.grid); }
    else {
      withLook(this.b, saved.cls, saved.section === 'fx' || saved.section === 'sounds' ? saved.look : 'game', () => drawBattle(c, this.b, tick, 0, true));
      if (saved.zoom > 1) zoomOn(c, this.b, saved.zoom);
    }
    const tag = [this.screensTab ? 'SCREENS' : en.label, this.stages ? getArena().name : this.skinned ? this.skinName() : this.lookName(saved.look), saved.speed !== 1 ? `${saved.speed}X` : '', this.paused ? 'PAUSED' : ''].filter(Boolean).join('   ');
    P(ui, '#000000', 0, UH - 16, UW, 16);
    drawTextCentered(ui, tag, UW / 2, UH - 12, this.paused ? '#f8b800' : '#fcfcfc', 1, false);
    drawTextCentered(ui, 'ART LAB', UW / 2, 6, '#f8b800', 1, true);
  }

  // ---------- picking ----------
  /** Animations and Sprites pick a skin with left / right; the other sections pick a look. */
  private get skinned(): boolean { return !this.stages && (saved.section === 'anims' || saved.section === 'sprites'); }
  private skinName(): string { const id = skinOfLab(saved.cls); return (SKINS[saved.cls].find(s => s.id === id)?.name ?? id).toUpperCase(); }
  private setSkin(id: string): void { saved.skins[saved.cls] = id; this.restart(); this.render(); }
  private setSection(s: Section): void { saved.section = s; saved.entry = 0; this.restart(); this.render(); }

  private looks(): Look[] { return ['game', 'before', ...(labOf(saved.cls).drafts ?? []).map((_, i) => i)]; }
  private lookName(l: Look): string { return l === 'game' ? 'IN GAME' : l === 'before' ? 'BEFORE' : (labOf(saved.cls).drafts?.[l]?.name ?? '?').toUpperCase(); }

  private pick(i: number): void {
    saved.entry = i;
    if (this.screensTab) { this.render(); return; }
    this.restart(); this.render();
  }

  /**
   * Leave the lab and open the picked screen of the game, full window, with saves paused (some screens make decks).
   * A button in the corner comes back to this tab.
   */
  private openScreen(): void {
    const name = screenNames?.[saved.entry];
    if (!name) return;
    void import('../dev/screens').then(({ screens }) => {
      pauseSaves();
      window.removeEventListener('keydown', this.onKey);
      window.removeEventListener('resize', this.onResize);
      this.root.remove();
      reserveRight(0);
      useStage(this.home);
      stopMusic();
      screens[name]();
      backButton(name);
    });
  }
  /** Left / right: the next look on a class tab, the next stage on the Stages tab. */
  private cycleLook(d: number): void {
    if (this.stages) {
      const ids = STAGES.ids, i = ids.indexOf(saved.stage);
      this.setStage(ids[(i + d + ids.length) % ids.length]);
      return;
    }
    if (this.skinned) {
      const ids = SKINS[saved.cls].map(s => s.id), i = ids.indexOf(skinOfLab(saved.cls));
      this.setSkin(ids[(i + d + ids.length) % ids.length]);
      return;
    }
    const ls = this.looks(), i = ls.indexOf(saved.look);
    saved.look = ls[(i + d + ls.length) % ls.length];
    this.render();
  }
  private setTab(tab: string): void {
    saved.tab = tab; saved.entry = 0;
    this.loadScreens();
    if (!this.stages) {
      saved.cls = tab as ClassId;
      if (!this.looks().includes(saved.look)) saved.look = 'game';
      playMusic(stageMusic(this.home));
    } else playMusic(stageMusic(saved.stage));
    this.restart(); this.render();
  }
  private setStage(id: string): void {
    saved.stage = id;
    playMusic(stageMusic(id));
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
    const grid = (...kids: HTMLElement[]): HTMLElement => h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:3px' }, ...kids);
    const tabs = h('div', { class: 'row' },
      ...this.tabs().map(id => { const b = btn(CLASSES.get(id)?.info.name ?? id.toUpperCase(), () => this.setTab(id), id === saved.tab ? 'on' : ''); b.style.cssText = big; return b; }),
    );
    const sections = h('div', { class: 'row' },
      ...SECTIONS.map(([id, name], i) => { const b = btn(touchActive() ? name : `${name} (${i + 1})`, () => this.setSection(id), id === saved.section ? 'on' : ''); b.style.cssText = big; return b; }),
    );
    const looks = choice(this.looks().map(l => [String(l), this.lookName(l)] as [string, string]), String(saved.look), v => {
      saved.look = v === 'game' || v === 'before' ? v : Number(v); this.render();
    });
    const skins = choice(SKINS[saved.cls].map(s => [s.id, s.name.toUpperCase()] as [string, string]), skinOfLab(saved.cls), v => this.setSkin(v));
    const speed = choice(SPEEDS, saved.speed, v => { saved.speed = v; this.render(); });
    const zoom = choice<number>([[1, '1×'], [2, '2×'], [3, '3×']], saved.zoom, v => { saved.zoom = v; this.render(); });
    const entries = this.entries(), en = entries[saved.entry];
    const list = grid(...entries.map((e, i) => { const b = btn(e.label, () => { unlockAudio(); this.pick(i); if (this.screensTab) this.openScreen(); }, i === saved.entry ? 'on' : ''); b.style.cssText = `${big}text-align:left`; return b; }));
    const card = en?.card;
    const drafts = labOf(saved.cls).drafts?.length ?? 0;
    const stageBtns = grid(...STAGES.ids.map(id => { const b = btn(stageName(id), () => this.setStage(id), id === saved.stage ? 'on' : ''); b.style.cssText = `${big}text-align:left`; return b; }));
    const sec = saved.section, sprites = !this.stages && sec === 'sprites';
    const what = this.screensTab ? ['screen', 'stage'] : this.stages ? ['stage scene', 'stage'] : [sec === 'fx' ? 'spell' : 'entry', this.skinned ? 'skin' : 'look'];
    const about = this.screensTab ? (screenNames ? 'Every screen of the game, set up the way the screen tests shoot it. Picking one opens it full window at this window\'s shape, with saves paused; ◀ ART LAB in the corner comes back.' : 'Loading…')
      : this.stages ? STAGE_ABOUT[en?.scene ?? 'idle']
      : en?.anim ? ANIMS.find(a => a[0] === en.anim)![3]
      : en?.sprite ? SPRITE_ABOUT[en.sprite] ?? SPRITE_ABOUT.frame
      : card ? `${CARDS[card].name}: ${CARDS[card].short}` : en?.voice ? `The ${saved.cls}'s ${en.voice} line.` : '';
    this.logEl = this.sounds ? h('div', { style: 'display:grid;gap:2px;margin:4px 0' }) : null;
    this.body.replaceChildren(
      h('div', { class: 'row', style: 'justify-content:space-between' }, h('h2', { style: 'margin:0' }, 'Art Lab'), btn('Exit (Esc)', () => { this.leaving = true; }, 'primary')),
      h('div', { class: 'muted' }, touchActive() ? 'Real game code. Tap what to play; it loops.' : `Real game code. ${k('up')}/${k('down')} ${what[0]} · ${k('left')}/${k('right')} ${what[1]} · ${k('attack')} replay · P pause · . step a frame · ${k('cast')} exit · Q/E or LB/RB tab${this.stages ? '' : ' · 1-4 or R/Y section'} · START pause.`),
      tabs,
      ...(this.stages ? [] : [sections]),
      ...(this.screensTab ? [] : this.stages ? [h('h3', {}, 'Stage'), stageBtns]
        : this.skinned ? [h('h3', {}, 'Skin'), skins.el, ...(sprites ? [h('div', { class: 'row' },
          check('Opponent colors', saved.alt, v => { saved.alt = v; }),
          check('Pixel grid', saved.grid, v => { saved.grid = v; }),
        )] : [])]
        : [
          h('h3', {}, 'Look'), looks.el,
          h('div', { class: 'muted' }, drafts ? `${drafts} draft${drafts > 1 ? 's' : ''} waiting for a pick.` : 'No drafts waiting. BEFORE shows the look the last pass replaced.'),
        ]),
      ...(this.screensTab || sprites ? [] : [h('h3', {}, 'Playback'),
      h('div', { class: 'row' },
        btn('Replay', () => { unlockAudio(); this.restart(); }),
        btn(this.paused ? 'Resume (P)' : 'Pause (P)', () => this.togglePause(), this.paused ? 'on' : ''),
        btn('Step (.)', () => { this.paused = true; this.step = true; this.render(); }),
        check('Loop', saved.auto, v => { saved.auto = v; }),
        ...(this.sounds ? [] : [check('Sound', saved.sound, v => { saved.sound = v; unlockAudio(); this.restart(); })]),
      ),
      speed.el,
      ...(this.stages ? [] : [h('div', { class: 'row' }, h('span', { class: 'muted' }, 'Zoom'), zoom.el)]),
      ]),
      ...(this.sounds ? [h('h3', {}, 'Heard'), h('div', { class: 'muted' }, SOUND_ABOUT), this.logEl!] : []),
      h('h3', {}, this.screensTab ? 'Screens' : this.stages ? 'Scene' : SECTION_TITLE[sec]),
      h('div', { class: 'muted' }, about),
      list,
    );
    this.showHeard();
  }
}
