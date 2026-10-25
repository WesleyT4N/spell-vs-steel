// Interactive tutorial for players new to Battle Network: a scripted fight against a training dummy.
// It drives a regular BattleScene (so the fight and the Draw screen look and play exactly like a match)
// and layers lessons, goals and pointers on top. Every step can be skipped from the pause menu.
import { setScene, dim, drawMenu, hint, listMouse, isHot, showSel, resetSel, type Scene } from './scene';
import { BattleScene } from './battle';
import { TitleScene } from './title';
import { SetupScene } from './setup';
import { DeckBuilderScene } from './deckbuilder';
import { Battle, NO_INTENT, COLS, type Fighter, type Intent, type Mark, type Projectile } from '../game/battle';
import { drawBattle, getArena } from '../game/battleView';
import type { Cpu } from '../game/ai';
import { CARDS } from '../game/cards';
import { starterDeck, toList } from '../game/deck';
import { loadMatch, saveMatch, type MatchConfig } from '../game/match';
import { TUNING } from '../game/tuning';
import { getSprite, drawFighterSprite, defaultSkin, type ClassId } from '../art/sprites';
import { P, W, H, UW, UH, frame, type Ctx } from '../engine/gfx';
import { drawText, drawTextCentered, wrap } from '../engine/font';
import { wasPressed, navPressed, k, mouse } from '../engine/input';
import { touchText, type PadMode } from '../engine/touch';
import { playMusic, stopMusic, sfx, chargeHum } from '../engine/audio';
import { BATTLE_SONG } from '../engine/music';

const DONE_KEY = 'svs:tutorial';
export function tutorialDone(): boolean {
  try { return localStorage.getItem(DONE_KEY) === '1'; } catch { return false; }
}
function markDone(): void {
  try { localStorage.setItem(DONE_KEY, '1'); } catch { /* storage blocked */ }
}

/** The dummy's home column: the middle of its side, in reach of the Warrior's sword from the player's front column. */
const DUMMY_COL = 4;
const SHOT_DAMAGE = 30;
const FINALE_HP = 300;
/** Index of the Draw gauge lesson; the gauge stays empty before it so the Draw screen can't open early. */
const GAUGE_STEP = 4;
/** Basic hits dealing at least this much were heavies (light hits are 6-11 even on a frozen target). */
const HEAVY_MIN = 18;

/** Hands dealt on the tutorial's Draw screen: cheap spells that show off cost, order and aiming. */
const LESSON_HAND: Record<ClassId, string[]> = {
  warrior: ['battle_shout', 'step_slash', 'guard', 'lunge', 'execute'],
  mage: ['arcane_missiles', 'ignite', 'arcane_focus', 'frost_nova', 'fireball'],
};
const LESSON_TRY: Record<ClassId, string> = {
  warrior: 'TRY BATTLE SHOUT, THEN STEP SLASH',
  mage: 'TRY ARCANE MISSILES, THEN IGNITE',
};

interface Page { title: string; body: string[] }
interface Point { x: number; y: number; dir: '←' | '→' | '↑' | '↓' }

interface Step {
  /** Lesson pages shown (fight paused) when the step begins. */
  pages: (t: TutorialScene) => Page[];
  /** Short goal shown while playing. */
  goal: (t: TutorialScene) => string;
  tip?: (t: TutorialScene) => string;
  /** How many times the goal must happen, for the progress counter. */
  need?: number;
  /** The step happens on the Draw screen instead of in the fight. */
  draw?: boolean;
  /** Move on as soon as the goal is met, without the NICE! pause (for steps that change screens). */
  instant?: boolean;
  point?: (t: TutorialScene) => Point | null;
  start?: (t: TutorialScene) => void;
  /** Runs every frame before the fight updates. */
  tick?: (t: TutorialScene, dt: number) => void;
  /** Called with what happened this frame; return true when the step is complete. */
  check: (t: TutorialScene, ev: FrameEvents) => boolean;
}

interface FrameEvents { light: number; heavy: number; casts: number; dodged: number; hit: number }

// UI pointers at the HUD pieces a lesson talks about
const AT_RESOURCE: Point = { x: 106, y: 41, dir: '←' };
const AT_GAUGE: Point = { x: UW / 2 + 76, y: 8, dir: '←' };
const AT_NEXT_SPELL: Point = { x: 18, y: UH - 40, dir: '↓' };

const res = (t: TutorialScene): string => (t.cls === 'warrior' ? 'RAGE' : 'MANA');

const STEPS: Step[] = [
  // 1. the grid
  {
    pages: () => [
      {
        title: 'WELCOME TO THE ARENA',
        body: [
          'FIGHTS HAPPEN ON A GRID OF 18 PANELS, 6 ACROSS AND 3 DEEP.',
          'THE 3 RED COLUMNS ON THE LEFT ARE YOUR AREA. THE 3 BLUE COLUMNS ARE YOUR ENEMY\'S. YOU CAN NEVER STEP ONTO THEIR SIDE, AND THEY CAN NEVER STEP ONTO YOURS.',
          'EVERYTHING IS REAL TIME: YOU MOVE, ATTACK AND CAST SPELLS WHILE YOUR ENEMY DOES THE SAME.',
        ],
      },
    ],
    goal: () => 'STEP ONTO THE FLASHING PANEL',
    tip: () => `MOVE WITH ${k('up')} ${k('left')} ${k('down')} ${k('right')} (OR THE ARROWS)`,
    need: 4,
    start: t => { t.targets = [[0, 0], [2, 0], [2, 2], [0, 2]]; },
    tick: t => {
      const [c, r] = t.targets[t.progress] ?? [-1, -1];
      if (c >= 0) t.flash(c, r, '#f8b800');
    },
    check: t => {
      const [c, r] = t.targets[t.progress] ?? [-1, -1];
      if (t.me.col === c && t.me.row === r) { t.bump(); sfx('pip'); }
      return t.progress >= 4;
    },
  },
  // 2. light attacks
  {
    pages: t => [
      {
        title: 'LIGHT ATTACK',
        body: t.cls === 'warrior'
          ? [
            `TAP ${k('attack')} TO SWING YOUR SWORD. IT HITS THE 2 PANELS IN FRONT OF YOU.`,
            'THE DUMMY STANDS IN THE MIDDLE OF ITS SIDE, SO MOVE TO YOUR FRONT COLUMN (THE ONE NEXT TO THE BLUE PANELS) AND LINE UP IN ITS ROW.',
            'THE DUMMY HOPS TO A NEW ROW EVERY TIME YOU HIT IT. CHASE IT!',
          ]
          : [
            `TAP ${k('attack')} TO FIRE A BOLT FROM YOUR STAFF. IT FLIES DOWN YOUR WHOLE ROW AND HITS THE FIRST THING IN ITS WAY.`,
            'ALL THAT MATTERS IS BEING IN THE SAME ROW AS YOUR TARGET, SO YOU CAN STAY BACK WHERE IT IS SAFE.',
            'THE DUMMY HOPS TO A NEW ROW EVERY TIME YOU HIT IT. FOLLOW IT!',
          ],
      },
    ],
    goal: () => 'HIT THE DUMMY WITH LIGHT ATTACKS',
    tip: t => (t.cls === 'warrior' ? `GET IN ITS ROW, IN REACH, AND TAP ${k('attack')}` : `GET IN ITS ROW AND TAP ${k('attack')}`),
    need: 3,
    check: (t, ev) => {
      for (let i = 0; i < ev.light && t.progress < 3; i++) {
        t.bump();
        if (t.progress < 3) t.dummy.hop(t);
      }
      return t.progress >= 3;
    },
  },
  // 3. heavy attacks
  {
    pages: t => [
      {
        title: 'HEAVY ATTACK',
        body: [
          `HOLD ${k('attack')}. A METER FILLS UNDER YOUR FEET, AND WHEN IT FLASHES HEAVY! LET GO.`,
          'A HEAVY HITS ABOUT 4 TIMES HARDER THAN A LIGHT ATTACK, BUT WHILE YOU CHARGE IT YOU ARE EASY TO READ. A BIG ENOUGH HIT ALSO MAKES YOU FLINCH AND LOSE THE CHARGE.',
          ...(t.cls === 'warrior'
            ? ['WARRIORS RUN ON RAGE (TOP LEFT). EVERY HEAVY THAT LANDS BUILDS 1.5 RAGE. LIGHT ATTACKS BUILD NONE.']
            : ['MAGES RUN ON MANA (TOP LEFT). ATTACKS DON\'T BUILD MANA: IT COMES FROM THE DRAW SCREEN, WHICH YOU WILL SEE SOON.']),
        ],
      },
    ],
    goal: () => 'LAND HEAVY ATTACKS ON THE DUMMY',
    tip: t => `HOLD ${k('attack')} UNTIL HEAVY!, THEN RELEASE` + (t.cls === 'warrior' ? '. WATCH YOUR RAGE FILL' : ''),
    need: 2,
    point: t => (t.cls === 'warrior' ? AT_RESOURCE : null),
    check: (t, ev) => {
      for (let i = 0; i < ev.heavy; i++) t.bump();
      return t.progress >= 2;
    },
  },
  // 4. dodging
  {
    pages: t => [
      {
        title: 'DODGE!',
        body: [
          'ENEMIES FIGHT BACK. MOST ATTACKS TRAVEL STRAIGHT DOWN A ROW, SO THE ROW YOU STAND IN IS THE ROW YOU GET HIT IN.',
          'THE DUMMY WILL LINE UP WITH YOU AND SHOOT. ITS ROW FLASHES RED JUST BEFORE THE SHOT. STEP UP OR DOWN TO GET OUT OF THE WAY.',
          ...(t.cls === 'warrior' ? ['A SILVER LINING FOR WARRIORS: TAKING DAMAGE BUILDS RAGE TOO.'] : []),
        ],
      },
    ],
    goal: () => 'DODGE THE DUMMY\'S SHOTS',
    tip: () => 'WHEN A ROW FLASHES RED, LEAVE IT',
    need: 3,
    start: t => { t.dummy.shooting = true; t.dummy.shotCd = 0.6; },
    check: (t, ev) => {
      for (let i = 0; i < ev.dodged; i++) { t.bump(); t.b.text(t.me, 'DODGED!', '#58d854'); }
      if (ev.hit) t.b.text(t.me, 'TRY AGAIN', '#f83800');
      if (t.progress >= 3) { t.dummy.shooting = false; return true; }
      return false;
    },
  },
  // 5. the Draw gauge
  {
    pages: () => [
      {
        title: 'THE DRAW GAUGE',
        body: [
          'YOUR REAL POWER IS YOUR GRIMOIRE: A DECK OF 30 SPELLS YOU BUILD BEFORE THE MATCH.',
          'THE DRAW GAUGE AT THE TOP OF THE SCREEN FILLS OVER 10 SECONDS. WHEN IT IS FULL IT FLASHES, AND YOU CAN PAUSE THE FIGHT TO DRAW NEW SPELLS.',
          `KEEP FIGHTING WHILE IT FILLS, THEN PRESS ${k('custom')}.`,
        ],
      },
    ],
    goal: t => (t.b.gauge >= 1 ? `GAUGE FULL! PRESS ${k('custom')}` : 'WAIT FOR THE DRAW GAUGE TO FILL'),
    tip: t => (t.b.gauge >= 1 ? 'THIS OPENS THE DRAW SCREEN' : `${Math.ceil((1 - t.b.gauge) * TUNING.gaugeSeconds)}s TO GO. KEEP ATTACKING IF YOU LIKE`),
    point: () => AT_GAUGE,
    instant: true,
    start: t => {
      t.b.gauge = 0.4;
      if (t.cls === 'warrior') t.me.res = Math.max(t.me.res, 3);
    },
    check: t => t.b.phase === 'custom',
  },
  // 6. the Draw screen
  {
    draw: true,
    instant: true,
    pages: t => [
      {
        title: 'THE DRAW SCREEN',
        body: [
          'THE FIGHT IS PAUSED. YOU DREW 5 SPELLS FROM YOUR GRIMOIRE. THEY ARE THE CARDS ALONG THE BOTTOM.',
          `HOVER A CARD (OR USE ${k('left')}/${k('right')}) TO READ IT ON THE LEFT: WHAT IT DOES, ITS DAMAGE AND ITS ${res(t)} COST.`,
          'EVERY ROUND STARTS ON THIS SCREEN, AND YOU COME BACK EACH TIME THE GAUGE FILLS. IN A MATCH YOU HAVE 20 SECONDS TO CHOOSE. HERE THE CLOCK IS STOPPED.',
        ],
      },
      t.cls === 'warrior'
        ? {
          title: 'SPENDING RAGE',
          body: [
            'EVERY SPELL COSTS RAGE, PAID WHEN YOU CAST IT IN THE FIGHT. YOU HAVE THE RAGE FROM YOUR HEAVY HITS (TOP RIGHT).',
            'CHEAP SPELLS LIKE GUARD (0) AND STEP SLASH (1) KEEP YOU BUSY. SAVE UP FOR BIG ONES LIKE EXECUTE (3).',
            'NOT ENOUGH RAGE WHEN YOU CAST? NOTHING HAPPENS UNTIL YOU BUILD MORE, SO KEEP SWINGING.',
          ],
        }
        : {
          title: 'SPENDING MANA',
          body: [
            'EVERY SPELL COSTS MANA (TOP RIGHT). MANA REFILLS TO FULL EACH TIME YOU OPEN THIS SCREEN, AND YOUR MAX GROWS BY 1 EACH TIME, UP TO 5.',
            'YOU HAVE 2 MANA NOW. KEEP THE TOTAL COST OF YOUR PICKS WITHIN IT: IT TURNS RED WHEN YOU GO OVER.',
            'EARLY TURNS ARE SMALL, LATE TURNS ARE HUGE. THAT IS THE MAGE\'S GAME.',
          ],
        },
      {
        title: 'PICK YOUR SPELLS',
        body: [
          'CLICK CARDS TO QUEUE THEM. YOU CAST THEM IN THE ORDER YOU PICK THEM (CAST ORDER, RIGHT). RIGHT-CLICK UNDOES A PICK.',
          'SPELLS YOU SKIP GO BACK INTO YOUR GRIMOIRE. SPELLS YOU PICK BUT NEVER CAST ARE THROWN AWAY AT THE NEXT DRAW, SO DON\'T TAKE MORE THAN YOU CAN USE.',
          `${LESSON_TRY[t.cls]}. THEN CLICK FIGHT! OR PRESS ${k('custom')}.`,
        ],
      },
    ],
    goal: t => `PICK SPELLS, THEN FIGHT!   ${LESSON_TRY[t.cls]}`,
    start: t => {
      t.b.offer[0] = [...LESSON_HAND[t.cls]];
      t.b.offer[1] = [];
    },
    check: t => t.b.phase === 'fight',
  },
  // 7. casting
  {
    pages: t => [
      {
        title: 'CAST!',
        body: [
          `PRESS ${k('cast')} TO CAST THE NEXT SPELL IN YOUR QUEUE. IT IS SHOWN BOTTOM LEFT, WITH HOW MANY MORE ARE WAITING.`,
          'MOST SPELLS FIRE DOWN YOUR ROW OR HIT THE PANELS IN FRONT OF YOU, SO LINE UP WITH THE DUMMY FIRST.',
          ...(t.cls === 'warrior'
            ? ['BATTLE SHOUT MAKES YOUR NEXT SPELL HIT 50% HARDER. ORDER MATTERS!']
            : ['ARCANE MISSILES HOME IN WHEREVER THE TARGET IS. IGNITE SETS THE TARGET\'S COLUMN ON FIRE.']),
        ],
      },
    ],
    goal: t => (t.me.queue.length ? `CAST YOUR SPELLS WITH ${k('cast')}` : 'CAST YOUR SPELLS'),
    tip: t => {
      const top = t.me.queue[0] ? CARDS[t.me.queue[0]] : null;
      if (top && !t.b.canAfford(t.me, top)) return t.cls === 'warrior' ? 'NEED RAGE: LAND HEAVY HITS TO BUILD IT' : 'NOT ENOUGH MANA. IT REFILLS AT THE NEXT DRAW';
      return 'LINE UP WITH THE DUMMY FIRST';
    },
    point: t => (t.me.queue.length ? AT_NEXT_SPELL : null),
    start: t => {
      t.castCount = 0;
      t.stuckT = 0;
      if (!t.me.queue.length) t.me.queue = [LESSON_HAND[t.cls][1]];
    },
    check: (t, ev) => {
      t.castCount += ev.casts;
      // a Mage who queued more than their Mana can pay for is stuck until the next draw: count what they did
      const top = t.me.queue[0] ? CARDS[t.me.queue[0]] : null;
      if (top && t.cls === 'mage' && !t.b.canAfford(t.me, top) && t.castCount > 0) t.stuckT += 1 / 60;
      return t.me.queue.length === 0 || t.stuckT > 2.5;
    },
  },
  // 8. the real thing
  {
    pages: t => [
      {
        title: 'FREEZE AND STUN',
        body: [
          'SOME SPELLS FREEZE OR STUN. A FROZEN OR STUNNED FIGHTER CAN\'T MOVE OR ACT, AND TAKES 50% MORE DAMAGE FROM EVERYTHING.',
          t.cls === 'warrior'
            ? 'WARRIOR SPELLS LIKE CHAIN HOOK STUN. LAND ONE, THEN FOLLOW UP WITH YOUR HARDEST HITTER.'
            : 'MAGE FROST SPELLS LIKE FROST NOVA FREEZE. FREEZE FIRST, THEN HIT HARD.',
          'GUARDS AND SHIELDS ARE THE OTHER SIDE OF IT: THEY SOAK UP HITS FOR A FEW SECONDS.',
        ],
      },
      {
        title: 'FINAL TEST',
        body: [
          'THE DUMMY FIGHTS BACK FOR REAL NOW: IT MOVES AND SHOOTS. KNOCK IT OUT!',
          'DODGE THE RED ROWS, ATTACK WHEN YOU ARE LINED UP, OPEN THE DRAW SCREEN WHENEVER THE GAUGE FILLS, AND CAST YOUR SPELLS.',
          'FROM HERE THE DRAW SCREEN DEALS FROM YOUR STARTER GRIMOIRE, JUST LIKE A REAL MATCH.',
        ],
      },
    ],
    goal: () => 'KNOCK OUT THE DUMMY',
    tip: t => (t.b.gauge >= 1 ? `GAUGE FULL: PRESS ${k('custom')} TO DRAW` : 'DODGE, ATTACK, DRAW, CAST'),
    start: t => {
      t.finale = true;
      t.dummyF.maxHp = t.dummyF.hp = FINALE_HP;
      t.b.gauge = 1;
      t.dummy.shooting = true;
      t.dummy.roaming = true;
      t.dummy.shotCd = 2;
      t.inner.fightBanner = 0.9;
    },
    // the knockout ends the tutorial once the K.O. has played out (see update)
    check: () => false,
  },
];

/** Shots the dummy has fired, so the tutorial can tell a dodge from a hit. */
interface Shot { p: Projectile; hit: boolean }

/** Drives the training dummy in place of the CPU: walks to rows, telegraphs and fires slow shots. */
class Dummy {
  targetRow: number | null = null;
  moveT = 0;
  shooting = false;
  roaming = false;
  shotCd = 0;
  roamT = 1.5;
  /** Seconds left on the red warning before a shot, or -1 when not warning. */
  warn = -1;
  shots: Shot[] = [];

  /** Hop to a random other row (light attack lesson). */
  hop(t: TutorialScene): void {
    const f = t.dummyF;
    const rows = [0, 1, 2].filter(r => r !== f.row);
    this.targetRow = rows[Math.floor(Math.random() * rows.length)];
  }

  update(t: TutorialScene, dt: number): void {
    const b = t.b, f = t.dummyF;
    if (b.phase !== 'fight') return;
    if (this.roaming && this.warn < 0 && (this.roamT -= dt) <= 0) {
      this.roamT = 1.2 + Math.random() * 1.2;
      if (Math.random() < 0.6) this.hop(t);
    }
    if (this.shooting) {
      if (this.warn >= 0) {
        for (let c = 0; c < COLS; c++) t.flash(c, f.row, '#f83800');
        if ((this.warn -= dt) < 0) this.fire(t);
      } else if (!this.shots.length && (this.shotCd -= dt) <= 0) {
        // line up with the player, then warn
        this.targetRow = t.me.row;
        if (f.row === t.me.row) this.warn = 0.75;
      }
    }
  }

  private fire(t: TutorialScene): void {
    const b = t.b, f = t.dummyF;
    const shot: Shot = { p: null as unknown as Projectile, hit: false };
    b.shoot(f, {
      speed: 6 * b.dir(f), kind: 'fireball', reflectable: true,
      onHit: (bb, target, wall) => {
        if (wall) { bb.hitWall(wall, SHOT_DAMAGE, f, {}); return; }
        if (!target) return;
        const out = bb.damage(target, SHOT_DAMAGE, bb.f[1 - target.side], { element: 'fire' });
        if (!out.blocked) shot.hit = true;
      },
    });
    shot.p = b.projectiles[b.projectiles.length - 1];
    this.shots.push(shot);
    this.shotCd = this.roaming ? 1.6 + Math.random() * 1.6 : 1.1;
    sfx('fire');
  }

  /** Shots that left the field this frame. */
  resolved(b: Battle): Shot[] {
    const gone = this.shots.filter(s => !b.projectiles.includes(s.p));
    this.shots = this.shots.filter(s => b.projectiles.includes(s.p));
    return gone;
  }

  // the Cpu interface BattleScene calls
  intent(b: Battle, f: Fighter, dt: number): Intent {
    if (b.phase !== 'fight' || f.dead) return NO_INTENT;
    this.moveT -= dt;
    let move: Intent['move'] = null;
    if (this.moveT <= 0 && f.lock <= 0) {
      if (f.col !== DUMMY_COL && b.canStand(f, f.col + Math.sign(DUMMY_COL - f.col), f.row)) move = f.col > DUMMY_COL ? 'left' : 'right';
      else if (this.targetRow !== null && f.row !== this.targetRow) move = f.row < this.targetRow ? 'down' : 'up';
      if (move) this.moveT = 0.22;
    }
    return { ...NO_INTENT, move, held: move };
  }
  pick(): number[] { return []; }
}

export class TutorialScene implements Scene {
  cls: ClassId = 'warrior';
  /** Picking a class before the lessons start. */
  choosing = true;
  chooseSel = 0;
  inner!: BattleScene;
  dummy = new Dummy();
  step = 0;
  progress = 0;
  pages: Page[] = [];
  page = 0;
  /** Seconds left on the "NICE!" banner after a step is cleared. */
  clearT = 0;
  paused = false;
  pauseSel = 0;
  done = false;
  doneSel = 0;
  finale = false;
  denyT = 0;
  // per-step scratch
  targets: Array<[number, number]> = [];
  castCount = 0;
  stuckT = 0;
  private flashes: Array<[number, number, string]> = [];
  private myMarks: Mark[] = [];

  get b(): Battle { return this.inner.b; }
  get me(): Fighter { return this.b.f[0]; }
  get dummyF(): Fighter { return this.b.f[1]; }
  private get cur(): Step { return STEPS[this.step]; }

  enter(): void { playMusic('battle', BATTLE_SONG); }

  pad(): PadMode {
    if (this.choosing || this.paused) return 'back';
    if (this.done) return 'none';
    return this.b.phase === 'custom' ? 'none' : this.inner.pad();
  }

  private begin(cls: ClassId): void {
    this.cls = cls;
    this.choosing = false;
    const saved = loadMatch();
    const m: MatchConfig = { ...saved, p1: cls, p1Deck: 'starter', cpu: 'mage', difficulty: 'easy', bestOf: 1 };
    this.inner = new BattleScene(m);
    this.inner.b = new Battle(
      { cls, deck: toList(starterDeck(cls)), name: 'YOU', skin: saved.p1Skin[cls] ?? defaultSkin(cls) },
      { cls: 'mage', deck: toList(starterDeck('mage')), name: 'DUMMY' },
    );
    this.inner.cpu = this.dummy as unknown as Cpu;
    // matches open on the Draw screen; the tutorial starts straight in the fight and gets there later
    this.b.endCustom([[], []]);
    this.dummyF.col = DUMMY_COL;
    this.startStep(0);
  }

  bump(): void { this.progress++; }
  /** Blink a panel this frame. */
  flash(col: number, row: number, color: string): void { this.flashes.push([col, row, color]); }

  private startStep(i: number): void {
    this.step = i;
    this.progress = 0;
    this.clearT = 0;
    const s = this.cur;
    const b = this.b;
    // put the fight in the phase this step happens in
    if (s.draw && b.phase === 'fight') this.openDraw();
    if (!s.draw && b.phase === 'custom') { b.endCustom([this.inner.picks, []]); this.inner.fightBanner = 0.9; }
    if (!this.finale) {
      this.me.hp = this.me.maxHp;
      this.dummyF.hp = this.dummyF.maxHp;
    }
    this.dummy.targetRow = null;
    s.start?.(this);
    this.pages = s.pages(this);
    this.page = 0;
    if (this.pages.length) sfx('open');
  }

  private openDraw(): void {
    this.b.beginCustom();
    this.inner.cursor = 0;
    resetSel();
    this.inner.lift = [];
    this.inner.picks = [];
  }

  private next(): void {
    if (this.step + 1 < STEPS.length) this.startStep(this.step + 1);
    else this.finish();
  }

  private finish(): void {
    this.done = true;
    this.doneSel = 0;
    resetSel();
    markDone();
    stopMusic();
    sfx('win');
  }

  private quiet(): void { chargeHum(0, null); chargeHum(1, null); }

  update(dt: number): void {
    if (this.choosing) { this.updateChoose(dt); return; }
    if (this.done) { this.updateDone(dt); return; }
    if (this.paused) { this.updatePause(dt); return; }
    const b = this.b;
    this.denyT = Math.max(0, this.denyT - dt);

    if (wasPressed('pause') && !wasPressed('confirm') && b.phase !== 'custom') { this.paused = true; this.pauseSel = 0; resetSel(); this.quiet(); sfx('select'); return; }

    // lesson pages hold the fight still
    if (this.page < this.pages.length) {
      this.quiet();
      if (wasPressed('confirm') || wasPressed('custom') || mouse.click) {
        this.page++;
        sfx(this.page < this.pages.length ? 'move' : 'select');
      } else if ((wasPressed('back') || mouse.rclick) && this.page > 0) { this.page--; sfx('back'); }
      if (b.phase === 'custom') this.inner.timer = TUNING.customTimer;
      return;
    }

    const s = this.cur;
    // the Draw screen only opens once the lessons get there
    if (!this.finale && this.step !== GAUGE_STEP) b.gauge = 0;

    // the lesson's Draw screen needs at least one pick before the fight resumes
    if (s.draw && b.phase === 'custom' && !this.inner.picks.length && this.triesToFight()) {
      this.denyT = 1.5;
      sfx('deny');
      return;
    }

    this.flashes = [];
    s.tick?.(this, dt);
    if (this.clearT <= 0) this.dummy.update(this, dt);
    b.marks = b.marks.filter(m => !this.myMarks.includes(m));
    this.myMarks = this.flashes.map(([col, row, color]) => ({ col, row, color, t: 1 }));
    b.marks.push(...this.myMarks);

    const basic = b.stats[0].basic, queued = this.me.queue.length, phase = b.phase;
    // nobody gets knocked out before the final test
    if (!this.finale && this.dummyF.hp < this.dummyF.maxHp * 0.3) this.dummyF.hp = this.dummyF.maxHp;
    if (this.me.hp < this.me.maxHp * 0.25) { this.me.hp = this.me.maxHp; b.text(this.me, 'HEALED', '#58d854'); }

    this.inner.update(dt);
    if (b.phase === 'custom') this.inner.timer = TUNING.customTimer;
    if (b.phase === 'over') { this.finish(); return; }

    const dealt = b.stats[0].basic - basic;
    const gone = this.dummy.resolved(b);
    const ev: FrameEvents = {
      light: dealt > 0 && dealt < HEAVY_MIN ? 1 : 0,
      heavy: dealt >= HEAVY_MIN ? 1 : 0,
      casts: phase === 'fight' && b.phase === 'fight' ? Math.max(0, queued - this.me.queue.length) : 0,
      dodged: gone.filter(x => !x.hit).length,
      hit: gone.filter(x => x.hit).length,
    };
    if (this.clearT > 0) {
      if ((this.clearT -= dt) <= 0) this.next();
      return;
    }
    if (s.check(this, ev)) {
      if (s.instant) this.next();
      else { this.clearT = 1.1; sfx('confirm'); }
    }
  }

  /** Is the player trying to leave the Draw screen this frame? */
  private triesToFight(): boolean {
    const offer = this.b.offer[0];
    return wasPressed('custom') || (wasPressed('pause') && !wasPressed('confirm')) ||
      (mouse.click && isHot('fight')) || (wasPressed('confirm') && this.inner.cursor === offer.length);
  }

  private updateChoose(dt: number): void {
    const items = 3;
    if (navPressed('up', dt)) { this.chooseSel = (this.chooseSel + items - 1) % items; sfx('move'); }
    if (navPressed('down', dt)) { this.chooseSel = (this.chooseSel + 1) % items; sfx('move'); }
    const clicked = listMouse('menu', this.chooseSel, i => { this.chooseSel = i; sfx('move'); });
    if (clicked >= 0) this.chooseSel = clicked;
    if (wasPressed('back') || mouse.rclick) { sfx('back'); stopMusic(); setScene(new TitleScene()); return; }
    if (wasPressed('confirm') || wasPressed('custom') || clicked >= 0) {
      sfx('select');
      if (this.chooseSel === 2) { stopMusic(); setScene(new TitleScene()); return; }
      this.begin(this.chooseSel === 0 ? 'warrior' : 'mage');
    }
  }

  private static PAUSE = ['RESUME', 'SKIP THIS STEP', 'RESTART TUTORIAL', 'QUIT TO TITLE'];
  private updatePause(dt: number): void {
    const items = TutorialScene.PAUSE.length;
    const clicked = listMouse('menu', this.pauseSel, i => { this.pauseSel = i; sfx('move'); });
    if (clicked >= 0) this.pauseSel = clicked;
    if (mouse.rclick || (wasPressed('back') && !wasPressed('pause'))) { this.paused = false; return; }
    if (navPressed('up', dt)) { this.pauseSel = (this.pauseSel + items - 1) % items; sfx('move'); }
    if (navPressed('down', dt)) { this.pauseSel = (this.pauseSel + 1) % items; sfx('move'); }
    if (wasPressed('confirm') || clicked >= 0 || (wasPressed('pause') && this.pauseSel === 0)) {
      sfx('select');
      this.paused = false;
      if (this.pauseSel === 1) { this.dummy.shooting = false; this.dummy.warn = -1; this.next(); }
      if (this.pauseSel === 2) setScene(new TutorialScene());
      if (this.pauseSel === 3) { stopMusic(); setScene(new TitleScene()); }
    }
  }

  private static DONE = ['VERSUS CPU', 'DECK BUILDER', 'TRY THE OTHER CLASS', 'TITLE'];
  private updateDone(dt: number): void {
    const items = TutorialScene.DONE.length;
    const clicked = listMouse('menu', this.doneSel, i => { this.doneSel = i; sfx('move'); });
    if (clicked >= 0) this.doneSel = clicked;
    if (navPressed('up', dt)) { this.doneSel = (this.doneSel + items - 1) % items; sfx('move'); }
    if (navPressed('down', dt)) { this.doneSel = (this.doneSel + 1) % items; sfx('move'); }
    if (wasPressed('confirm') || wasPressed('custom') || clicked >= 0) {
      sfx('select');
      stopMusic();
      const choice = TutorialScene.DONE[this.doneSel];
      if (choice === 'VERSUS CPU') { const m = loadMatch(); m.p1 = this.cls; saveMatch(m); setScene(new SetupScene()); }
      if (choice === 'DECK BUILDER') setScene(new DeckBuilderScene(this.cls, () => setScene(new TitleScene())));
      if (choice === 'TRY THE OTHER CLASS') { const t = new TutorialScene(); setScene(t); t.begin(this.cls === 'warrior' ? 'mage' : 'warrior'); }
      if (choice === 'TITLE') setScene(new TitleScene());
    }
  }

  // ---------- drawing ----------
  draw(c: Ctx, tick: number, ui: Ctx): void {
    if (this.choosing) { this.drawChoose(c, tick, ui); return; }
    const b = this.b;
    // past the knockout the match's own results screen stays hidden behind ours
    if (this.done) { drawBattle(c, b, tick); this.drawDone(ui, tick); return; }
    this.inner.draw(c, tick, ui);
    const s = this.cur;
    if (this.page < this.pages.length) {
      this.drawPage(ui, tick);
    } else if (b.phase === 'custom') {
      // the goal replaces the Draw screen's footer, so the hand stays clear
      P(ui, '#000000', 0, UH - 14, UW, 14);
      const msg = this.denyT > 0 ? 'PICK AT LEAST ONE SPELL FIRST' : s.goal(this);
      drawTextCentered(ui, msg, UW / 2, UH - 11, this.denyT > 0 && tick % 4 < 2 ? '#f83800' : '#f8b800', 1, false);
    } else if (b.phase === 'fight') {
      this.drawGoal(ui, s, tick);
    }
    if (this.clearT > 0) drawTextCentered(ui, 'NICE!', UW / 2, 120, '#58d854', 5);
    if (this.paused) {
      dim(ui, 0.55);
      drawTextCentered(ui, 'PAUSED', UW / 2, 76, '#fcfcfc', 4);
      drawMenu(ui, TutorialScene.PAUSE, this.pauseSel, UW / 2, 130, tick, { width: 220, gap: 24 });
      hint(ui, `CLICK OR ${k('attack')}: SELECT   ${k('cast')} / RIGHT-CLICK: RESUME`);
    }
  }

  private lessonLabel(): string { return `LESSON ${this.step + 1}/${STEPS.length}`; }

  private drawGoal(ui: Ctx, s: Step, tick: number): void {
    const x = UW / 2 - 104, w = 208, y = 36;
    const lines = wrap(touchText(s.goal(this)), 32).slice(0, 2);
    const tip = s.tip ? wrap(touchText(s.tip(this)), 32).slice(0, 4 - lines.length) : [];
    const h = 16 + (lines.length + tip.length) * 9;
    frame(ui, x, y, w, h, '#000000', '#f8b800');
    drawText(ui, this.lessonLabel(), x + 6, y + 4, '#7c7c7c');
    if (s.need) {
      const pr = `${Math.min(this.progress, s.need)}/${s.need}`;
      drawText(ui, pr, x + w - 6 - pr.length * 6, y + 4, '#58d854');
    }
    lines.forEach((l, i) => drawText(ui, l, x + 6, y + 14 + i * 9, '#fcfcfc'));
    tip.forEach((l, i) => drawText(ui, l, x + 6, y + 14 + (lines.length + i) * 9, '#bcbcbc'));
    const pt = s.point?.(this);
    if (pt && this.clearT <= 0) {
      const bob = tick % 4 < 2 ? 0 : 2;
      const ox = pt.dir === '←' ? bob : pt.dir === '→' ? -bob : 0, oy = pt.dir === '↑' ? bob : pt.dir === '↓' ? -bob : 0;
      drawText(ui, pt.dir, pt.x + ox, pt.y + oy, '#f8b800', 2);
    }
  }

  private drawPage(ui: Ctx, tick: number): void {
    const pg = this.pages[this.page];
    dim(ui, 0.6);
    const x = 40, w = UW - 80;
    const paras = pg.body.map(p => wrap(touchText(p), Math.floor((w - 28) / 6)));
    const bodyH = paras.reduce((a, l) => a + l.length * 10 + 6, 0);
    const h = 52 + bodyH;
    const y = Math.max(40, Math.round((UH - 14 - h) / 2));
    frame(ui, x, y, w, h, '#000000', '#f8b800');
    drawText(ui, this.lessonLabel(), x + 14, y + 8, '#7c7c7c');
    if (this.pages.length > 1) {
      const n = `${this.page + 1}/${this.pages.length}`;
      drawText(ui, n, x + w - 14 - n.length * 6, y + 8, '#7c7c7c');
    }
    drawText(ui, pg.title, x + 14, y + 20, '#f8b800', 2);
    let yy = y + 42;
    for (const lines of paras) {
      lines.forEach((l, i) => drawText(ui, l, x + 14, yy + i * 10, '#fcfcfc'));
      yy += lines.length * 10 + 6;
    }
    const last = this.page === this.pages.length - 1;
    const more = last ? (this.cur.draw ? 'PICK SPELLS' : 'GO!') : 'NEXT';
    if (tick % 8 < 6) drawText(ui, `→ ${more}`, x + w - 14 - (more.length + 2) * 6, y + h - 14, '#f8b800');
    hint(ui, `CLICK OR ${k('attack')}: ${last ? 'START' : 'NEXT'}${this.page > 0 ? `   ${k('cast')}: BACK` : ''}   ESC: MENU`);
  }

  private drawChoose(c: Ctx, tick: number, ui: Ctx): void {
    getArena().draw(c, tick, 0);
    c.fillStyle = 'rgba(0,0,24,0.55)';
    c.fillRect(0, 0, W, H);
    const bob = Math.floor(performance.now() / 400) % 2;
    drawFighterSprite(c, getSprite('warrior', defaultSkin('warrior'), false), 36, 130 - (this.chooseSel === 0 && showSel() ? bob : 0), false, 'none', 2);
    drawFighterSprite(c, getSprite('mage', defaultSkin('mage'), false), 204, 130 - (this.chooseSel === 1 && showSel() ? bob : 0), true, 'none', 2);
    drawTextCentered(ui, 'TUTORIAL', UW / 2, 28, '#f8b800', 3);
    drawTextCentered(ui, 'LEARN TO FIGHT AGAINST A TRAINING DUMMY. ABOUT 5 MINUTES.', UW / 2, 60, '#bcbcbc', 1, false);
    drawTextCentered(ui, 'WHICH CLASS DO YOU WANT TO LEARN?', UW / 2, 74, '#fcfcfc', 1, false);
    drawMenu(ui, ['WARRIOR', 'MAGE', 'BACK'], this.chooseSel, UW / 2, 112, tick, { width: 160, gap: 24 });
    const blurb = !showSel() ? '' : this.chooseSel === 0
      ? 'SWORD AND SHIELD. FIGHTS UP CLOSE AND BUILDS RAGE BY LANDING HEAVY HITS AND TAKING DAMAGE.'
      : this.chooseSel === 1
        ? 'STAFF AND SPELLBOOK. FIGHTS FROM RANGE, WITH MANA THAT GROWS EVERY DRAW UNTIL MAGES HIT HARDEST OF ALL.'
        : '';
    if (blurb) {
      const lines = wrap(blurb, 34);
      frame(ui, UW / 2 - 110, 196, 220, 12 + lines.length * 10, '#000000', '#7c7c7c');
      lines.forEach((l, i) => drawTextCentered(ui, l, UW / 2, 203 + i * 10, '#bcbcbc', 1, false));
    }
    hint(ui, `CLICK OR ${k('up')}/${k('down')} + ${k('attack')} TO SELECT   ${k('cast')}: BACK`);
  }

  private drawDone(ui: Ctx, tick: number): void {
    dim(ui, 0.55);
    drawTextCentered(ui, 'TUTORIAL COMPLETE!', UW / 2, 44, '#f8b800', 3);
    const lines = [
      'YOU KNOW THE BASICS: MOVE, ATTACK, DODGE, DRAW AND CAST.',
      'NEXT, FIGHT THE CPU, OR BUILD YOUR OWN 30-SPELL GRIMOIRE.',
    ];
    lines.forEach((l, i) => drawTextCentered(ui, l, UW / 2, 82 + i * 12, '#fcfcfc', 1, false));
    drawMenu(ui, TutorialScene.DONE, this.doneSel, UW / 2, 130, tick, { width: 220, gap: 24 });
    hint(ui, `CLICK OR ${k('attack')}: SELECT`);
  }
}

