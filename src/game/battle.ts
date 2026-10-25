// Battle simulation. Pure game state and rules; drawing lives in battleView.ts.
import { TUNING } from './tuning';
import { CARDS, type CardDef, type Element } from './cards';
import { defaultSkin, mirrorSkin, type ClassId } from '../art/sprites';
import { sfx } from '../engine/audio';
import { seeded, randomSeed, shuffle } from './rng';
import { CLASS_INFO } from './classes';
export { shuffle };

export const COLS = 6, ROWS = 3;
export type Side = 0 | 1;

/** What a controller (keyboard or CPU) wants this frame. */
export interface Intent {
  /** Direction to step this frame (already edge/repeat filtered), or null. */
  move: Dir | null;
  /** Direction currently held, used to aim Blink. */
  held: Dir | null;
  attackPressed: boolean;
  attackHeld: boolean;
  castPressed: boolean;
}
export type Dir = 'up' | 'down' | 'left' | 'right';
export const NO_INTENT: Intent = { move: null, held: null, attackPressed: false, attackHeld: false, castPressed: false };

export interface Shield { kind: 'guard' | 'ironSkin' | 'barrier' | 'unbreakable' | 'holy'; hp: number; t: number; hits: number }

export interface Fighter {
  side: Side;
  cls: ClassId;
  /** Skin id (see art/sprites.ts) and whether the mirror-match alternate palette is on. */
  skin: string;
  alt: boolean;
  name: string;
  hp: number;
  maxHp: number;
  col: number;
  row: number;
  /** Pixel offset for dashes and leaps (drawing only). */
  dx: number;
  dy: number;
  /** Seconds of action lock (attacks, casts). */
  lock: number;
  moveCd: number;
  charging: boolean;
  charge: number;
  /** Rage pips (Warrior) or current Mana (Mage). */
  res: number;
  /** Mage max Mana (Warrior: always rageMax). */
  resMax: number;
  bonusManaNext: number;
  deck: string[];
  discard: string[];
  /** Spells picked on the custom screen, cast front to back. */
  queue: string[];
  shields: Shield[];
  st: Record<StatusKey, number>;
  /** Next-spell multipliers. */
  shout: number;
  rallyLeft: number;
  powerLeft: number;
  frostNovaUsed: boolean;
  lastStandAbsorbed: number;
  /** Time until Glacial Fortress can freeze this fighter again. */
  glacialCd: number;
  /** Poison stacks, seconds left on them and the tick accumulator. */
  poison: number;
  poisonT: number;
  poisonAcc: number;
  /** Evasion: hits left to dodge. */
  dodges: number;
  /** Ranger: seconds stood still on the current panel (for Energy). */
  stillT: number;
  lastCol: number;
  lastRow: number;
  /** Healing done since the last Draw screen (Atonement). */
  healedTurn: number;
  /** Damage this fighter took from the enemy while Death Marked. */
  deathMarkAcc: number;
  /** Prayer of Mending: heals left. */
  mending: number;
  /** Visual: seconds of hit flash. */
  flash: number;
  /** Visual: current pose. */
  pose: 'idle' | 'attack' | 'heavy' | 'cast' | 'hurt';
  poseT: number;
  dead: boolean;
}

export type StatusKey =
  | 'frozen' | 'stunned' | 'flinch' | 'iceBlock' | 'roared' | 'berserk' | 'avatar' | 'ascendance'
  | 'lastStand' | 'reflect' | 'counterspell' | 'mortal' | 'evoLock' | 'noKnock' | 'frostNova' | 'glacial'
  // Rogue, Ranger, Cleric
  | 'stealth' | 'silenced' | 'rooted' | 'sleep' | 'untargetable' | 'evasion' | 'spellImmune' | 'deadlyPoison'
  | 'deathMark' | 'hunted' | 'revealed' | 'shadowDance' | 'nightsEmbrace' | 'pandemic' | 'camo' | 'nest' | 'deadeye'
  | 'tripwire' | 'painSup' | 'guardian' | 'ascension' | 'avatarLight' | 'purified' | 'mending' | 'channel';

const STATUS_KEYS: StatusKey[] = ['frozen', 'stunned', 'flinch', 'iceBlock', 'roared', 'berserk', 'avatar', 'ascendance', 'lastStand', 'reflect', 'counterspell', 'mortal', 'evoLock', 'noKnock', 'frostNova', 'glacial',
  'stealth', 'silenced', 'rooted', 'sleep', 'untargetable', 'evasion', 'spellImmune', 'deadlyPoison', 'deathMark', 'hunted', 'revealed', 'shadowDance', 'nightsEmbrace', 'pandemic', 'camo', 'nest', 'deadeye',
  'tripwire', 'painSup', 'guardian', 'ascension', 'avatarLight', 'purified', 'mending', 'channel'];

/** Buffs a dispel (Purge) strips. */
export const BUFF_KEYS: StatusKey[] = ['berserk', 'avatar', 'ascendance', 'lastStand', 'reflect', 'counterspell', 'noKnock', 'frostNova', 'stealth', 'untargetable', 'evasion', 'spellImmune', 'deadlyPoison', 'shadowDance', 'nightsEmbrace', 'camo', 'nest', 'deadeye', 'tripwire', 'painSup', 'guardian', 'ascension', 'avatarLight', 'purified', 'mending'];
/** Debuffs a cleanse removes (and Purify blocks). */
const DEBUFF_KEYS: StatusKey[] = ['frozen', 'stunned', 'silenced', 'rooted', 'sleep', 'roared', 'mortal', 'deathMark', 'hunted', 'revealed'];

export interface Panel {
  owner: Side;
  baseOwner: Side;
  ownerT: number;
  burn: number;
  burnDps: number;
  burnAcc: number;
  cracked: boolean;
  hole: number;
  /** Toxic panels give 1 Poison stack per second to an enemy standing on them. */
  toxic: number;
  toxicSide: Side;
  toxicAcc: number;
  /** Blessed panels heal their owner standing on them. */
  bless: number;
  blessAcc: number;
  /** Holy fire (Consecration): like burning, drawn gold. */
  smite: number;
  smiteDps: number;
  smiteAcc: number;
}

export interface Wall { side: Side; col: number; row: number; hp: number; maxHp: number; t: number; kind: 'stone' | 'ice' | 'glacial' | 'holy' | 'bear'; invuln: boolean }

export interface Projectile {
  side: Side;
  row: number;
  /** Column position (float). */
  x: number;
  /** Panels per second, signed. */
  speed: number;
  kind: 'fireball' | 'hook' | 'gust' | 'missile' | 'reflected' | 'knife' | 'arrow' | 'net' | 'wolf' | 'hawk' | 'hammer' | 'sting' | 'vial';
  /** Piercing shots fly through walls (hitting them) instead of stopping. */
  pierce?: boolean;
  hitWalls?: Wall[];
  /** For homing missiles: progress 0..1 and start pixel. */
  homing?: { p: number; dur: number; sx: number; sy: number; target: Side };
  reflectable: boolean;
  onHit: (b: Battle, target: Fighter | null, wall: Wall | null, col: number, p: Projectile) => void;
  dead?: boolean;
}

export interface Mark { col: number; row: number; t: number; color: string }
/** A hidden Ranger trap. Only its owner sees it. */
export interface Trap { side: Side; col: number; row: number; arm: number; t: number; kind: 'freeze' | 'explode' | 'mine' | 'blast' }
/** A Ranger companion that acts on its own. `row` null follows the Ranger's row. */
export interface Pet { side: Side; kind: 'wolf' | 'hawk' | 'bear'; row: number | null; col: number; t: number; cd: number; period: number; dmg: number }
export interface FloatText { x: number; y: number; text: string; color: string; t: number }
export interface Fx { t: number; dur: number; kind: string; side: Side; col: number; row: number; data?: Record<string, number | string> }

interface Timer { t: number; fn: () => void }
interface Anim { t: number; dur: number; fn: (p: number) => void }

export interface HitOpts {
  spell?: boolean;
  basic?: 'light' | 'heavy';
  breaks?: boolean;
  element?: Element;
  knockback?: boolean;
  stun?: number;
  freeze?: number;
  noFlinch?: boolean;
  /** Picks the target wherever they are: misses a stealthed or untargetable fighter. */
  targeted?: boolean;
  /** Ignores barriers and shields (not Guard). */
  pierce?: boolean;
  /** Damage over time ticks (no dodges, no flinch). */
  dot?: boolean;
}

export interface HitResult { fighter: boolean; wall: boolean; dealt: number; broke: boolean; blocked: boolean }

export type Phase = 'custom' | 'fight' | 'ko' | 'over';

export class Battle {
  f: [Fighter, Fighter];
  panels: Panel[][] = [];
  walls: Wall[] = [];
  projectiles: Projectile[] = [];
  marks: Mark[] = [];
  traps: Trap[] = [];
  pets: Pet[] = [];
  texts: FloatText[] = [];
  fx: Fx[] = [];
  timers: Timer[] = [];
  anims: Anim[] = [];
  phase: Phase = 'custom';
  gauge = 0;
  turn = 0;
  time = 0;
  koT = 0;
  winner: Side | null = null;
  /** Offered cards on the current custom screen, per side. */
  offer: [string[], string[]] = [[], []];
  shake = 0;
  cheer = 0;
  /** Damage dealt by each side, split by source (for tuning). */
  stats = [{ basic: 0, spell: 0, other: 0 }, { basic: 0, spell: 0, other: 0 }];

  /** Every random roll in the rules comes from here, so two machines given the same seed play the same battle. */
  rand: ReturnType<typeof seeded>;

  constructor(a: FighterSpec, bSpec: FighterSpec, seed: number = randomSeed()) {
    this.rand = seeded(seed);
    // same class in the same color: the second fighter takes the next color
    const aSkin = a.skin ?? defaultSkin(a.cls);
    const bSkin = a.cls === bSpec.cls ? mirrorSkin(a.cls, aSkin, bSpec.skin ?? defaultSkin(bSpec.cls)) : bSpec.skin;
    this.f = [makeFighter(0, { ...a, skin: aSkin }, false, this.rand), makeFighter(1, { ...bSpec, skin: bSkin }, false, this.rand)];
    for (let c = 0; c < COLS; c++) {
      this.panels[c] = [];
      for (let r = 0; r < ROWS; r++) {
        const owner: Side = c < 3 ? 0 : 1;
        this.panels[c][r] = { owner, baseOwner: owner, ownerT: 0, burn: 0, burnDps: 0, burnAcc: 0, cracked: false, hole: 0, toxic: 0, toxicSide: 0, toxicAcc: 0, bless: 0, blessAcc: 0, smite: 0, smiteDps: 0, smiteAcc: 0 };
      }
    }
    this.beginCustom();
  }

  foe(f: Fighter): Fighter { return this.f[1 - f.side]; }
  dir(f: Fighter | Side): 1 | -1 { return (typeof f === 'number' ? f : f.side) === 0 ? 1 : -1; }
  inGrid(col: number, row: number): boolean { return col >= 0 && col < COLS && row >= 0 && row < ROWS; }
  panel(col: number, row: number): Panel | null { return this.inGrid(col, row) ? this.panels[col][row] : null; }
  wallAt(col: number, row: number): Wall | undefined { return this.walls.find(w => w.col === col && w.row === row); }
  fighterAt(col: number, row: number): Fighter | undefined { return this.f.find(x => !x.dead && x.col === col && x.row === row); }

  /** The column of `side`'s area that borders the enemy (BN "front column"). */
  frontCol(side: Side): number {
    let best = side === 0 ? -1 : COLS;
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
      if (this.panels[c][r].owner !== side) continue;
      if (side === 0 ? c > best : c < best) best = c;
    }
    return best;
  }
  backCol(side: Side): number { return side === 0 ? 0 : COLS - 1; }

  canStand(f: Fighter, col: number, row: number): boolean {
    const p = this.panel(col, row);
    if (!p || p.owner !== f.side || p.hole > 0) return false;
    if (this.wallAt(col, row)) return false;
    const o = this.fighterAt(col, row);
    return !o || o === f;
  }

  // ---------- scheduling ----------
  later(delay: number, fn: () => void): void { this.timers.push({ t: delay, fn }); }
  anim(dur: number, fn: (p: number) => void): void { fn(0); this.anims.push({ t: 0, dur, fn }); }
  addFx(kind: string, side: Side, col: number, row: number, dur: number, data?: Record<string, number | string>): void {
    this.fx.push({ t: 0, dur, kind, side, col, row, data });
  }
  mark(col: number, row: number, dur: number, color: string): void { if (this.inGrid(col, row)) this.marks.push({ col, row, t: dur, color }); }
  text(f: Fighter, s: string, color: string): void {
    this.texts.push({ x: f.col, y: f.row, text: s, color, t: 0 });
  }

  // ---------- custom screen ----------
  beginCustom(): void {
    this.phase = 'custom';
    this.turn++;
    for (const f of this.f) {
      // uncast picks from last turn are discarded
      f.discard.push(...f.queue);
      f.queue = [];
      if (f.cls === 'mage') {
        if (this.turn > 1) f.resMax = Math.min(TUNING.mage.manaCap, f.resMax + 1);
        f.res = f.resMax + f.bonusManaNext;
        f.bonusManaNext = 0;
      } else if (f.cls === 'rogue') {
        f.res = Math.max(f.res, TUNING.rogue.energyTopUp);
      } else if (f.cls === 'cleric' && this.turn > 1) {
        f.res = Math.min(TUNING.cleric.manaCap, f.res + TUNING.cleric.manaPerDraw);
      }
      f.healedTurn = 0;
      const hand: string[] = [];
      while (hand.length < TUNING.handSize) {
        if (!f.deck.length) {
          if (!f.discard.length) break;
          f.deck = shuffle(f.discard, this.rand);
          f.discard = [];
        }
        hand.push(f.deck.pop()!);
      }
      this.offer[f.side] = hand;
      f.charging = false;
      f.charge = 0;
    }
    sfx('open');
  }

  /** Apply both sides' picks (indices into the offer, in cast order) and resume the fight. */
  endCustom(picks: [number[], number[]]): void {
    for (const f of this.f) {
      const offer = this.offer[f.side];
      const chosen = picks[f.side].filter((i, k, a) => i >= 0 && i < offer.length && a.indexOf(i) === k);
      f.queue = chosen.map(i => offer[i]);
      // the rest go back into the grimoire, BN style
      const rest = offer.filter((_, i) => !chosen.includes(i));
      f.deck = shuffle([...f.deck, ...rest], this.rand);
      this.offer[f.side] = [];
    }
    this.gauge = 0;
    this.phase = 'fight';
    sfx('confirm');
  }

  canOpenCustom(): boolean { return this.phase === 'fight' && this.gauge >= 1; }

  // ---------- main update ----------
  update(dt: number, intents: [Intent, Intent]): void {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt);
    this.cheer = Math.max(0, this.cheer - dt);
    for (const t of this.texts) t.t += dt;
    this.texts = this.texts.filter(t => t.t < 0.9);
    for (const e of this.fx) e.t += dt;
    this.fx = this.fx.filter(e => e.t < e.dur);

    if (this.phase === 'custom' || this.phase === 'over') return;
    if (this.phase === 'ko') {
      this.koT += dt;
      for (const f of this.f) f.flash = Math.max(0, f.flash - dt);
      if (this.koT > 2.2) this.phase = 'over';
      return;
    }

    this.gauge = Math.min(1, this.gauge + dt / TUNING.gaugeSeconds);

    // timers and animations
    const due = this.timers.filter(t => (t.t -= dt) <= 0);
    this.timers = this.timers.filter(t => t.t > 0);
    for (const t of due) { if (this.phase === 'fight') t.fn(); }
    for (const a of this.anims) { a.t += dt; a.fn(Math.min(1, a.t / a.dur)); }
    this.anims = this.anims.filter(a => a.t < a.dur);
    for (const m of this.marks) m.t -= dt;
    this.marks = this.marks.filter(m => m.t > 0);

    this.updatePanels(dt);
    this.updateWalls(dt);
    for (const f of this.f) this.updateFighter(f, intents[f.side], dt);
    this.updateProjectiles(dt);
    this.updateTraps(dt);
    this.updatePets(dt);
    this.updateZones();

    for (const f of this.f) {
      if (!f.dead && f.hp <= 0) {
        f.dead = true;
        this.phase = 'ko';
        this.koT = 0;
        this.winner = (1 - f.side) as Side;
        this.cheer = 3;
        sfx('ko');
      }
    }
  }

  private updatePanels(dt: number): void {
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
      const p = this.panels[c][r];
      if (p.ownerT > 0 && (p.ownerT -= dt) <= 0) {
        p.owner = p.baseOwner;
        for (const f of this.f) if (f.col === c && f.row === r) this.relocate(f);
      }
      if (p.hole > 0 && (p.hole -= dt) <= 0) { p.hole = 0; p.cracked = false; }
      if (p.burn > 0) {
        p.burn -= dt;
        p.burnAcc += dt;
        if (p.burnAcc >= TUNING.burnTick) {
          p.burnAcc -= TUNING.burnTick;
          const v = this.fighterAt(c, r);
          if (v) this.damage(v, Math.round(p.burnDps * TUNING.burnTick), null, { element: 'fire', noFlinch: true, dot: true });
        }
        if (p.burn <= 0) { p.burn = 0; p.burnDps = 0; }
      }
      if (p.smite > 0) {
        p.smite -= dt;
        p.smiteAcc += dt;
        if (p.smiteAcc >= TUNING.burnTick) {
          p.smiteAcc -= TUNING.burnTick;
          const v = this.fighterAt(c, r);
          if (v && v.side === p.owner) this.damage(v, Math.round(p.smiteDps * TUNING.burnTick), this.foe(v), { element: 'holy', noFlinch: true, dot: true });
        }
        if (p.smite <= 0) { p.smite = 0; p.smiteDps = 0; }
      }
      if (p.toxic > 0) {
        p.toxic -= dt;
        p.toxicAcc += dt;
        const v = this.fighterAt(c, r);
        if (p.toxicAcc >= 1) {
          p.toxicAcc -= 1;
          if (v && v.side !== p.toxicSide) this.addPoison(v, 1);
        }
        if (p.toxic <= 0) p.toxic = 0;
      }
      if (p.bless > 0) {
        p.bless -= dt;
        p.blessAcc += dt;
        if (p.blessAcc >= 1) {
          p.blessAcc -= 1;
          const v = this.fighterAt(c, r);
          if (v && v.side === p.owner) this.heal(v, TUNING.blessHps);
        }
        if (p.bless <= 0) p.bless = 0;
      }
    }
  }

  private updateWalls(dt: number): void {
    for (const w of this.walls) w.t -= dt;
    this.walls = this.walls.filter(w => w.t > 0 && w.hp > 0);
  }

  private updateTraps(dt: number): void {
    for (const t of this.traps) {
      t.t -= dt;
      t.arm -= dt;
      if (t.arm > 0 || t.t <= 0) continue;
      const v = this.fighterAt(t.col, t.row);
      if (!v || v.side === t.side) continue;
      t.t = 0;
      const src = this.f[t.side];
      this.addFx('trapPop', t.side, t.col, t.row, 0.5, { kind: t.kind });
      if (t.kind === 'freeze') { this.damage(v, 20, src, { spell: true, element: 'frost' }); this.freeze(v, 1.5); }
      else if (t.kind === 'explode') {
        sfx('explode');
        const cells: Array<[number, number]> = [[t.col, t.row], [t.col - 1, t.row], [t.col + 1, t.row], [t.col, t.row - 1], [t.col, t.row + 1]];
        for (const [c, r] of cells) if (this.inGrid(c, r)) this.addFx('explode', t.side, c, r, 0.35);
        this.strike(src, cells, 90, { spell: true, element: 'fire' });
      } else if (t.kind === 'mine') { sfx('explode'); this.damage(v, 50, src, { spell: true, element: 'nature', knockback: true }); }
      else { sfx('explode'); this.addFx('explode', t.side, t.col, t.row, 0.35); this.damage(v, 60, src, { spell: true, element: 'fire' }); }
    }
    this.traps = this.traps.filter(t => t.t > 0);
  }

  private updatePets(dt: number): void {
    for (const p of this.pets) {
      p.t -= dt;
      p.cd -= dt;
      const owner = this.f[p.side], foe = this.foe(owner);
      if (owner.dead || foe.dead) continue;
      if (p.kind === 'bear' && !this.walls.some(w => w.kind === 'bear' && w.side === p.side)) { p.t = 0; continue; }
      if (p.cd > 0) continue;
      const row = p.row ?? owner.row;
      if (p.kind === 'hawk') {
        p.cd = p.period;
        this.addFx('hawkDive', p.side, foe.col, foe.row, 0.35);
        this.damage(foe, p.dmg, owner, { spell: true, element: 'nature', targeted: true, noFlinch: true });
      } else if (foe.row === row) {
        p.cd = p.period;
        this.addFx(p.kind === 'bear' ? 'claw' : 'bite', p.side, foe.col, foe.row, 0.3);
        this.damage(foe, p.dmg, owner, { spell: true, element: 'nature', noFlinch: p.kind !== 'bear' });
      }
    }
    this.pets = this.pets.filter(p => p.t > 0);
  }

  private updateZones(): void {
    for (const f of this.f) {
      const foe = this.foe(f);
      if (foe.dead) continue;
      // Frost Nova: the first time an enemy is within range of the caster, they are hit and frozen.
      if (f.st.frostNova > 0 && !f.frostNovaUsed) {
        if (Math.abs(foe.col - f.col) <= TUNING.frostNovaRange) {
          f.frostNovaUsed = true;
          f.st.frostNova = 0;
          this.damage(foe, TUNING.frostNovaDamage, f, { spell: true, element: 'frost' });
          this.freeze(foe, 1.5);
          this.addFx('nova', f.side, f.col, f.row, 0.5);
          this.addFx('nova', f.side, foe.col, foe.row, 0.5);
          this.shake = Math.max(this.shake, 0.2);
        }
      }
      // Glacial Fortress: an enemy standing right in front of the ice is frozen.
      if (f.st.glacial > 0 && foe.st.frozen <= 0 && foe.st.iceBlock <= 0) {
        const wallCol = this.walls.find(w => w.side === f.side && w.kind === 'glacial')?.col;
        if (wallCol !== undefined && foe.col === wallCol + this.dir(f) && foe.glacialCd <= 0) {
          this.freeze(foe, 2);
          foe.glacialCd = 3;
        }
      }
    }
  }

  private updateFighter(f: Fighter, intent: Intent, dt: number): void {
    f.glacialCd = Math.max(0, f.glacialCd - dt);
    for (const k of STATUS_KEYS) {
      if (f.st[k] > 0) {
        f.st[k] = Math.max(0, f.st[k] - dt);
        if (f.st[k] === 0) this.onStatusEnd(f, k);
      }
    }
    for (const s of f.shields) s.t -= dt;
    const expired = f.shields.filter(s => s.t <= 0 || s.hp <= 0);
    for (const s of expired) if (s.kind === 'unbreakable' && s.hits > 0) this.gainRage(f, Math.min(3, s.hits), true);
    f.shields = f.shields.filter(s => s.t > 0 && s.hp > 0);
    f.lock = Math.max(0, f.lock - dt);
    f.moveCd = Math.max(0, f.moveCd - dt);
    f.flash = Math.max(0, f.flash - dt);
    f.poseT = Math.max(0, f.poseT - dt);
    if (f.poseT === 0) f.pose = 'idle';
    if (f.dead) return;
    this.updatePoison(f, dt);
    if (f.cls === 'ranger') {
      // Energy comes from standing still; any change of panel restarts the count
      if (f.col !== f.lastCol || f.row !== f.lastRow) f.stillT = 0;
      else f.stillT += dt * (f.st.nest > 0 ? 2 : 1);
      const R = TUNING.ranger;
      while (f.stillT >= R.stillSeconds) {
        f.stillT -= R.stillSeconds;
        if (f.res < R.energyCap) { f.res = Math.min(R.energyCap, f.res + 1); sfx('pip'); }
      }
    }
    f.lastCol = f.col; f.lastRow = f.row;

    const disabled = f.st.frozen > 0 || f.st.stunned > 0 || f.st.iceBlock > 0 || f.st.sleep > 0 || f.st.channel > 0;
    if (disabled) { f.charging = false; f.charge = 0; return; }
    const busy = f.lock > 0 || f.st.flinch > 0;

    if (intent.move && !busy) this.tryMove(f, intent.move);

    if (intent.attackPressed && !busy) {
      this.basicAttack(f, 'light');
      f.charging = true;
      f.charge = 0;
    } else if (f.charging) {
      if (intent.attackHeld) {
        const before = f.charge;
        f.charge += dt;
        const need = heavyChargeOf(f);
        if (before < need && f.charge >= need) sfx('charged');
      } else {
        if (f.charge >= heavyChargeOf(f) && f.lock <= 0 && f.st.flinch <= 0) this.basicAttack(f, 'heavy');
        f.charging = false;
        f.charge = 0;
      }
    }

    if (intent.castPressed && !busy) this.castTop(f, intent.held);
  }

  private onStatusEnd(f: Fighter, k: StatusKey): void {
    if (k === 'lastStand') {
      const dmg = Math.round(f.lastStandAbsorbed);
      f.lastStandAbsorbed = 0;
      const foe = this.foe(f);
      this.addFx('shockwave', f.side, this.frontCol(foe.side), 1, 0.6);
      this.shake = 0.4;
      if (dmg > 0) this.damage(foe, dmg, f, { spell: true, element: 'steel' });
    }
    if (k === 'glacial') this.walls = this.walls.filter(w => !(w.side === f.side && w.kind === 'glacial'));
    if (k === 'deathMark') {
      const dmg = Math.round(f.deathMarkAcc * 0.5);
      f.deathMarkAcc = 0;
      if (dmg > 0) { this.addFx('stab', f.side, f.col, f.row, 0.4); this.damage(f, dmg, this.foe(f), { spell: true, element: 'shadow' }); }
    }
    if (k === 'camo' || k === 'nightsEmbrace') f.st.stealth = 0;
    if (k === 'mending') f.mending = 0;
  }

  tryMove(f: Fighter, d: Dir): boolean {
    const [dc, dr] = d === 'up' ? [0, -1] : d === 'down' ? [0, 1] : d === 'left' ? [-1, 0] : [1, 0];
    const nc = f.col + dc, nr = f.row + dr;
    if (f.st.rooted > 0 || f.st.nest > 0) return false;
    if (!this.canStand(f, nc, nr)) return false;
    if (f.st.camo > 0) { f.st.camo = 0; f.st.stealth = 0; }
    this.leavePanel(f.col, f.row);
    f.col = nc; f.row = nr;
    f.moveCd = TUNING.moveRepeat;
    sfx('step');
    return true;
  }

  private leavePanel(col: number, row: number): void {
    const p = this.panels[col][row];
    if (p.cracked && p.hole <= 0) p.hole = 6;
  }

  /** Put a fighter back on a legal panel of their area (after a stolen column reverts, etc). */
  relocate(f: Fighter): void {
    if (this.canStand(f, f.col, f.row)) return;
    let best: [number, number] | null = null, bestD = 99;
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
      if (!this.canStand(f, c, r)) continue;
      const d = Math.abs(c - f.col) * 1.1 + Math.abs(r - f.row);
      if (d < bestD) { bestD = d; best = [c, r]; }
    }
    if (best) { f.col = best[0]; f.row = best[1]; }
  }

  /** Push toward the fighter's own back column, one or more panels. Returns true if moved. */
  knockback(f: Fighter, panels = 1): boolean {
    if (f.st.noKnock > 0 || f.st.berserk > 0 || f.st.avatar > 0 || f.st.iceBlock > 0) return false;
    const back = -this.dir(f);
    let moved = false;
    for (let i = 0; i < panels; i++) {
      const nc = f.col + back;
      if (!this.canStand(f, nc, f.row)) break;
      this.leavePanel(f.col, f.row);
      f.col = nc;
      moved = true;
    }
    return moved;
  }

  // ---------- resources ----------
  gainRage(f: Fighter, amt: number, fromCard = false): void {
    if (f.cls !== 'warrior' || amt <= 0) return;
    const before = Math.floor(f.res);
    f.res = Math.min(TUNING.warrior.rageMax, f.res + amt);
    if (Math.floor(f.res) > before && fromCard) sfx('pip');
  }

  /** Energy, Mana or Rage from a card or effect, up to the class cap. */
  gainRes(f: Fighter, amt: number): void {
    if (f.cls === 'warrior') { this.gainRage(f, amt, true); return; }
    const cap = f.cls === 'mage' ? 99 : f.resMax;
    f.res = Math.min(cap, f.res + amt);
    sfx('pip');
  }

  costOf(f: Fighter, card: CardDef): number {
    if (f.st.avatar > 0 || f.st.ascendance > 0) return 0;
    if (f.st.nightsEmbrace > 0 && (card.id === 'shadowstep' || card.id === 'ambush')) return 0;
    if (card.cost === 'all') return Math.max(1, f.res);
    return Math.max(0, card.cost - (f.powerLeft > 0 ? 1 : 0));
  }

  canAfford(f: Fighter, card: CardDef): boolean {
    if (card.cost === 'all') return f.res >= 1 || f.st.ascendance > 0;
    return f.res >= this.costOf(f, card);
  }

  // ---------- attacks ----------
  basicAttack(f: Fighter, kind: 'light' | 'heavy'): void {
    const foe = this.foe(f);
    const d = this.dir(f);
    f.pose = kind === 'light' ? 'attack' : 'heavy';
    f.poseT = kind === 'light' ? 0.2 : 0.32;
    if (f.cls === 'warrior') {
      const T = TUNING.warrior;
      const dmg = kind === 'light' ? T.lightDamage : T.heavyDamage;
      f.lock = kind === 'light' ? T.lightLock : T.heavyLock;
      const cells: Array<[number, number]> = [[f.col + d, f.row], [f.col + 2 * d, f.row]];
      const swing = (): void => {
        this.addFx(kind === 'light' ? 'cleave' : 'cleaveHeavy', f.side, f.col + d, f.row, kind === 'light' ? 0.18 : 0.34);
        const res = this.strike(f, cells, dmg, { basic: kind, element: 'steel' });
        if (res.fighter && kind === 'heavy') this.gainRage(f, T.rageHeavyHit * (f.st.berserk > 0 ? 2 : 1));
        if (res.fighter && kind === 'light' && T.rageLightHit) this.gainRage(f, T.rageLightHit * (f.st.berserk > 0 ? 2 : 1));
      };
      sfx(kind === 'light' ? 'slash' : 'slashHeavy');
      swing();
      if (f.st.avatar > 0) this.later(0.12, swing);
    } else if (f.cls === 'mage') {
      const T = TUNING.mage;
      const dmg = kind === 'light' ? T.lightDamage : T.heavyDamage;
      f.lock = kind === 'light' ? T.lightLock : T.heavyLock;
      sfx(kind === 'light' ? 'bolt' : 'boltHeavy');
      const end = this.rowShot(f, dmg, { basic: kind, element: 'arcane' });
      this.addFx(kind === 'light' ? 'bolt' : 'boltHeavy', f.side, f.col, f.row, kind === 'light' ? 0.2 : 0.32, { to: end.col });
    } else if (f.cls === 'rogue') {
      const T = TUNING.rogue;
      f.lock = kind === 'light' ? T.lightLock : T.heavyLock;
      sfx(kind === 'light' ? 'bolt' : 'slash');
      const end = this.rowShot(f, kind === 'light' ? T.lightDamage : T.heavyDamage, { basic: kind, element: kind === 'light' ? 'steel' : 'poison' });
      if (end.hit && kind === 'heavy') this.addPoison(foe, 1);
      this.addFx(kind === 'light' ? 'knife' : 'knifeHeavy', f.side, f.col, f.row, 0.2, { to: end.col });
    } else if (f.cls === 'ranger') {
      const T = TUNING.ranger;
      f.lock = kind === 'light' ? T.lightLock : T.heavyLock;
      sfx(kind === 'light' ? 'bolt' : 'boltHeavy');
      const dmg = kind === 'light' ? T.lightDamage * (f.st.deadeye > 0 ? 3 : 1) : T.heavyDamage;
      const pierce = kind === 'heavy' && f.st.deadeye > 0;
      const end = this.rowShot(f, dmg, { basic: kind, element: 'steel', knockback: kind === 'heavy' }, pierce);
      this.addFx(kind === 'light' ? 'arrow' : 'aimed', f.side, f.col, f.row, kind === 'light' ? 0.2 : 0.3, { to: end.col });
    } else {
      const T = TUNING.cleric;
      f.lock = kind === 'light' ? T.lightLock : T.heavyLock;
      if (kind === 'light') {
        sfx('bolt');
        const end = this.rowShot(f, T.lightDamage, { basic: kind, element: 'holy' });
        this.addFx('holySpark', f.side, f.col, f.row, 0.2, { to: end.col });
      } else {
        // Smite: a pillar of light a fixed distance ahead
        sfx('boltHeavy');
        const c = f.col + T.smiteRange * d;
        this.addFx('holyPillar', f.side, c, f.row, 0.4);
        const res = this.strike(f, [[c, f.row]], T.heavyDamage, { basic: kind, element: 'holy' });
        if (res.fighter && res.dealt > 0) this.heal(f, T.smiteHeal);
      }
    }
    this.breakStealth(f);
    void foe;
  }

  /** Hit a set of cells for the attacker. Enemy walls in the cells take the hit too. */
  strike(att: Fighter, cells: Array<[number, number]>, dmg: number, opts: HitOpts): HitResult {
    const foe = this.foe(att);
    const res: HitResult = { fighter: false, wall: false, dealt: 0, broke: false, blocked: false };
    for (const [c, r] of cells) {
      if (!this.inGrid(c, r)) continue;
      const w = this.wallAt(c, r);
      if (w && w.side !== att.side) {
        res.wall = true;
        const broke = opts.breaks && !w.invuln;
        this.hitWall(w, broke ? w.hp : dmg, att, opts);
        if (broke) res.broke = true;
        if (w.kind === 'glacial' && att.glacialCd <= 0) { this.freeze(att, 2); att.glacialCd = 3; }
      }
      if (!foe.dead && foe.col === c && foe.row === r && !res.fighter) {
        const out = this.damage(foe, dmg, att, opts);
        res.fighter = true;
        res.dealt = out.dealt;
        res.broke = res.broke || out.broke;
        res.blocked = out.blocked;
      }
    }
    return res;
  }

  /** Hitscan down the attacker's row: the first enemy wall or fighter takes it (all of them when piercing). */
  rowShot(f: Fighter, dmg: number, opts: HitOpts, pierce = false): { col: number; hit: boolean } {
    const d = this.dir(f), foe = this.foe(f);
    let col = d > 0 ? COLS - 1 : 0, hit = false;
    for (let c = f.col + d; c >= 0 && c < COLS; c += d) {
      const w = this.wallAt(c, f.row);
      if (w && w.side !== f.side) { this.hitWall(w, dmg, f, opts); if (!pierce) { col = c; break; } }
      if (foe.col === c && foe.row === f.row && !foe.dead) {
        col = c;
        hit = this.damage(foe, dmg, f, opts).dealt > 0;
        break;
      }
    }
    return { col, hit };
  }

  /** Attacking or casting ends Stealth, unless Camouflage or Night's Embrace keep it. Shadow Dance brings it back. */
  breakStealth(f: Fighter): void {
    if (f.st.stealth <= 0 || f.st.camo > 0 || f.st.nightsEmbrace > 0) return;
    f.st.stealth = 0;
    if (f.st.shadowDance > 0) this.later(1, () => { if (f.st.shadowDance > 0) this.stealth(f, 2); });
  }

  stealth(f: Fighter, t: number): void {
    if (f.st.revealed > 0 || f.st.hunted > 0) { this.text(f, 'REVEALED', '#f8b800'); return; }
    f.st.stealth = Math.max(f.st.stealth, t);
    this.addFx('smoke', f.side, f.col, f.row, 0.4);
  }

  /** Can this fighter be picked by a targeted or homing effect? */
  targetable(f: Fighter): boolean { return f.st.stealth <= 0 && f.st.untargetable <= 0; }

  /** Blinking into the enemy area. Returns false (and the blink fails) when a Tripwire catches it. */
  blinkIn(f: Fighter): boolean {
    const foe = this.foe(f);
    if (foe.st.tripwire <= 0) return true;
    foe.st.tripwire = 0;
    f.st.stealth = 0;
    this.addFx('trapPop', foe.side, foe.col, foe.row, 0.5, { kind: 'mine' });
    this.damage(f, 40, foe, { spell: true, element: 'nature' });
    this.stun(f, 1);
    this.text(f, 'TRIPWIRE', '#f8b800');
    return false;
  }

  addPoison(t: Fighter, n: number): void {
    if (t.dead || t.st.iceBlock > 0 || t.st.purified > 0 || n <= 0) return;
    const cap = t.st.pandemic > 0 ? 5 : TUNING.poisonMaxStacks;
    t.poison = Math.min(cap, t.poison + n);
    t.poisonT = TUNING.poisonSeconds;
    this.text(t, `POISON ×${t.poison}`, '#b8f818');
  }

  private updatePoison(f: Fighter, dt: number): void {
    if (f.poison <= 0) return;
    const fast = f.st.pandemic > 0 ? 2 : 1;
    f.poisonT -= dt;
    f.poisonAcc += dt * fast;
    if (f.poisonAcc >= 1) {
      f.poisonAcc -= 1;
      this.damage(f, TUNING.poisonDps * f.poison, this.foe(f), { element: 'poison', noFlinch: true, dot: true });
    }
    if (f.poisonT <= 0) { f.poison = 0; f.poisonAcc = 0; }
  }

  /** Remove Poison, the fire under you, freeze and other debuffs. Pandemic Poison stays. */
  cleanse(f: Fighter): void {
    if (f.st.pandemic <= 0) { f.poison = 0; f.poisonT = 0; }
    const p = this.panels[f.col][f.row];
    p.burn = 0; p.burnDps = 0; p.smite = 0;
    for (const k of DEBUFF_KEYS) f.st[k] = 0;
    f.deathMarkAcc = 0;
    this.addFx('healBurst', f.side, f.col, f.row, 0.4);
  }

  silence(f: Fighter, t: number): void {
    if (f.dead || f.st.iceBlock > 0 || f.st.purified > 0) return;
    f.st.silenced = Math.max(f.st.silenced, t);
    this.text(f, 'SILENCED', '#9878f8');
  }

  root(f: Fighter, t: number): void {
    if (f.dead || f.st.iceBlock > 0 || f.st.purified > 0) return;
    f.st.rooted = Math.max(f.st.rooted, t);
    this.text(f, 'ROOTED', '#58d854');
  }

  /** A stun that any damage breaks (Blind, Wyvern Sting). */
  sleep(f: Fighter, t: number): void {
    if (f.dead || f.st.iceBlock > 0 || f.st.purified > 0) return;
    f.st.sleep = Math.max(f.st.sleep, t);
    f.charging = false;
    this.text(f, 'ASLEEP', '#9878f8');
  }

  /** Bless a panel of the owner's area for `t` seconds. */
  bless(col: number, row: number, t: number): void {
    const p = this.panel(col, row);
    if (p && p.hole <= 0) p.bless = Math.max(p.bless, t);
  }

  hitWall(w: Wall, dmg: number, _src: Fighter | null, _opts: HitOpts): void {
    if (w.invuln) { this.addFx('spark', w.side, w.col, w.row, 0.2); return; }
    w.hp -= dmg;
    this.addFx('spark', w.side, w.col, w.row, 0.2);
    sfx('block');
  }

  freeze(f: Fighter, t: number): void {
    if (f.dead || f.st.iceBlock > 0 || f.st.purified > 0) return;
    f.st.frozen = Math.max(f.st.frozen, t);
    f.charging = false;
    this.text(f, 'FROZEN', '#3cbcfc');
    sfx('freeze');
  }

  stun(f: Fighter, t: number): void {
    if (f.dead || f.st.iceBlock > 0 || f.st.purified > 0) return;
    f.st.stunned = Math.max(f.st.stunned, t);
    f.charging = false;
    this.text(f, 'STUN', '#f8b800');
  }

  heal(f: Fighter, amt: number): void {
    if (f.dead) return;
    if (f.st.avatarLight > 0) amt *= 2;
    if (f.st.mortal > 0) amt = Math.round(amt / 2);
    amt = Math.round(amt);
    f.hp = Math.min(f.maxHp, f.hp + amt);
    f.healedTurn += amt;
    this.text(f, '+' + amt, '#58d854');
    sfx('heal');
    // Avatar of Light: every heal also smites the enemy for the same amount
    if (f.st.avatarLight > 0) {
      const foe = this.foe(f);
      this.addFx('holyPillar', f.side, foe.col, foe.row, 0.35);
      this.damage(foe, amt, f, { spell: true, element: 'holy', noFlinch: true });
    }
  }

  /** Core damage pipeline: immunity, guard, multipliers, shields, last stand, Rage. */
  damage(target: Fighter, base: number, src: Fighter | null, opts: HitOpts): { dealt: number; broke: boolean; blocked: boolean } {
    const out = { dealt: 0, broke: false, blocked: false };
    if (target.dead || base <= 0) return out;
    if (target.st.iceBlock > 0) { this.text(target, 'IMMUNE', '#a4e4fc'); return out; }
    if (!opts.dot && (target.st.untargetable > 0 || (opts.targeted && target.st.stealth > 0))) { this.text(target, 'MISS', '#bcbcbc'); return out; }
    if (opts.spell && target.st.spellImmune > 0) { this.text(target, 'IMMUNE', '#9878f8'); return out; }
    if (!opts.dot && target.st.evasion > 0 && target.dodges > 0) {
      target.dodges--;
      if (target.dodges <= 0) target.st.evasion = 0;
      this.text(target, 'DODGE', '#fcfcfc');
      this.gainRes(target, 1);
      return out;
    }

    let amt = base;
    if (src && src.st.roared > 0) amt *= 0.7;
    if (target.st.frozen > 0 || target.st.stunned > 0 || target.st.sleep > 0) amt *= TUNING.frozenBonus;
    if (src && src.cls === 'ranger' && target.st.hunted > 0) amt *= 1.25;
    if (target.st.painSup > 0) amt *= 0.5;
    // any hit wakes a sleeping target (that hit still got the bonus)
    if (target.st.sleep > 0 && !opts.dot) target.st.sleep = 0;

    // Break effects shatter breakable shields first and double the hit.
    if (opts.breaks) {
      const breakable = target.shields.filter(s => s.kind !== 'unbreakable');
      if (breakable.length) {
        for (const s of breakable) { s.hp = 0; if (s.kind === 'barrier') target.bonusManaNext += 1; }
        out.broke = true;
        amt *= 2;
        this.text(target, 'BREAK', '#fcfcfc');
        sfx('break');
      }
    }

    const guard = target.shields.find(s => s.kind === 'guard' && s.hp > 0);
    if (guard) {
      guard.hp = 0;
      out.blocked = true;
      this.gainRage(target, 1, true);
      this.addFx('guard', target.side, target.col, target.row, 0.3);
      this.text(target, 'BLOCK', '#fcfcfc');
      sfx('block');
      return out;
    }

    amt = Math.round(amt);
    for (const s of target.shields) {
      if (amt <= 0 || opts.pierce) break;
      if (s.hp <= 0 || s.kind === 'guard') continue;
      const take = Math.min(s.hp, amt);
      s.hp -= take;
      amt -= take;
      s.hits++;
      if (s.kind === 'ironSkin' && s.hits <= 2) this.gainRage(target, 1, true);
      if (s.kind === 'barrier' && s.hp <= 0) { target.bonusManaNext += 1; this.text(target, '+1 MANA NEXT', '#f878f8'); }
      this.addFx('shieldHit', target.side, target.col, target.row, 0.25);
    }
    if (amt <= 0) { out.blocked = true; sfx('block'); return out; }

    if (target.st.lastStand > 0) {
      target.lastStandAbsorbed += amt;
      amt = Math.min(amt, target.hp - 1);
    }
    if (target.st.ascension > 0) amt = Math.min(amt, target.hp - 1);
    if (target.st.guardian > 0 && amt >= target.hp) {
      target.st.guardian = 0;
      target.hp = Math.max(target.hp, 200);
      this.text(target, 'GUARDIAN SPIRIT', '#f8d878');
      this.addFx('healBurst', target.side, target.col, target.row, 0.6);
      sfx('heal');
      return out;
    }
    target.hp = Math.max(0, target.hp - amt);
    out.dealt = amt;
    if (target.st.deathMark > 0 && src && src.side !== target.side) target.deathMarkAcc += amt;
    if (target.st.mending > 0 && target.mending > 0 && !opts.dot) {
      target.mending--;
      if (target.mending <= 0) target.st.mending = 0;
      this.later(0.05, () => this.heal(target, 30));
    }
    if (src && opts.basic && src.st.deadlyPoison > 0) this.addPoison(target, 1);
    const st = this.stats[1 - target.side];
    if (opts.basic) st.basic += amt; else if (opts.spell) st.spell += amt; else st.other += amt;
    target.flash = 0.12;
    target.pose = 'hurt';
    target.poseT = 0.15;
    this.texts.push({ x: target.col, y: target.row, text: String(amt), color: opts.element === 'fire' ? '#fca044' : opts.element === 'frost' ? '#a4e4fc' : opts.element === 'poison' ? '#b8f818' : opts.element === 'holy' ? '#f8d878' : '#fcfcfc', t: 0 });
    if (target.cls === 'warrior') this.gainRage(target, Math.min(TUNING.warrior.rageWhenHitMax, amt / TUNING.warrior.rageDamagePerPip));
    if (amt >= TUNING.flinchThreshold && !opts.noFlinch && target.st.noKnock <= 0 && target.st.avatar <= 0) {
      target.st.flinch = TUNING.flinchTime;
      target.charging = false;
      target.charge = 0;
    }
    if (amt >= 80) { this.shake = Math.max(this.shake, 0.25); this.cheer = 1.5; }
    if (opts.basic === 'heavy') this.shake = Math.max(this.shake, 0.18);
    if (opts.stun) this.stun(target, opts.stun);
    if (opts.freeze) this.freeze(target, opts.freeze);
    if (opts.knockback) this.knockback(target, 1);
    sfx(opts.basic === 'heavy' ? 'heavyImpact' : amt >= 60 ? 'hitBig' : 'hit');
    return out;
  }

  // ---------- spells ----------
  castTop(f: Fighter, held: Dir | null): void {
    if (!f.queue.length) return;
    const card = CARDS[f.queue[0]];
    if (f.st.evoLock > 0) { this.text(f, 'CAN\'T CAST', '#bcbcbc'); return; }
    if (f.st.silenced > 0) { this.text(f, 'SILENCED', '#9878f8'); sfx('deny'); f.lock = 0.15; return; }
    if (!this.canAfford(f, card)) {
      this.text(f, `NEED ${CLASS_INFO[f.cls].res}`, '#bcbcbc');
      sfx('deny');
      f.lock = 0.15;
      return;
    }
    f.queue.shift();
    f.discard.push(card.id);
    const cost = this.costOf(f, card);
    const spent = card.cost === 'all' ? (f.st.ascendance > 0 ? Math.max(1, f.resMax) : f.res) : cost;
    if (!(f.st.avatar > 0 || f.st.ascendance > 0)) f.res -= card.cost === 'all' ? f.res : cost;
    if (f.powerLeft > 0 && card.cost !== 'all' && card.cost > 0 && !(f.st.avatar > 0 || f.st.ascendance > 0)) f.powerLeft--;

    const foe = this.foe(f);
    const stealthed = f.st.stealth > 0;
    this.breakStealth(f);
    this.fx = this.fx.filter(e => !(e.kind === 'castName' && e.side === f.side));
    this.addFx('castName', f.side, f.col, f.row, 2.2, { id: card.id });
    f.pose = 'cast';
    f.poseT = 0.3;
    f.lock = Math.max(f.lock, card.lock ?? 0.3);

    if (foe.st.counterspell > 0 && card.id !== 'counterspell') {
      foe.st.counterspell = 0;
      this.text(f, 'COUNTERED', '#f878f8');
      const callout = this.fx.find(e => e.kind === 'castName' && e.side === f.side);
      if (callout?.data) callout.data.countered = 1;
      this.addFx('counter', f.side, f.col, f.row, 0.5);
      sfx('deny');
      return;
    }

    let mult = 1;
    if (card.damaging) {
      if (f.shout > 0) { mult *= f.shout; f.shout = 0; }
      if (f.rallyLeft > 0) { mult *= 1.3; f.rallyLeft--; }
    }
    sfx(card.element === 'fire' ? 'fire' : card.element === 'frost' ? 'frost' : card.element === 'arcane' ? 'arcane' : 'cast');
    const ctx: CastCtx = { b: this, f, foe, mult, dir: this.dir(f), held, spent, stealthed };
    card.cast(ctx);
    if (f.st.ascendance > 0 && card.id !== 'ascendance') this.later(0.45, () => { if (!f.dead) card.cast({ ...ctx }); });
  }

  /** Spawn a projectile from `f` down its row. */
  shoot(f: Fighter, p: Omit<Projectile, 'side' | 'row' | 'x'> & { row?: number }): void {
    this.projectiles.push({ side: f.side, row: p.row ?? f.row, x: f.col + this.dir(f) * 0.5, ...p });
  }

  private updateProjectiles(dt: number): void {
    for (const p of this.projectiles) {
      if (p.dead) continue;
      const target = this.f[1 - p.side];
      if (p.homing) {
        p.homing.p += dt / p.homing.dur;
        if (p.homing.p >= 1) {
          p.dead = true;
          const t = this.f[p.homing.target];
          if (!this.targetable(t)) { this.text(t, 'MISS', '#bcbcbc'); continue; }
          if (t.st.reflect > 0 && p.reflectable && t.side !== p.side) { this.reflect(p, t); continue; }
          p.onHit(this, t.dead ? null : t, null, t.col, p);
        }
        continue;
      }
      const prev = p.x;
      p.x += p.speed * dt;
      const lo = Math.min(prev, p.x), hi = Math.max(prev, p.x);
      // walk the columns crossed this frame
      const step = p.speed > 0 ? 1 : -1;
      for (let c = Math.round(prev); step > 0 ? c <= Math.round(hi) : c >= Math.round(lo); c += step) {
        if (c < 0 || c >= COLS) continue;
        if (Math.abs(c - p.x) > 0.5 && Math.abs(c - prev) > 0.5 && !(c > lo && c < hi)) continue;
        const w = this.wallAt(c, p.row);
        if (w && w.side !== p.side && p.pierce) {
          if (!p.hitWalls) p.hitWalls = [];
          if (!p.hitWalls.includes(w)) { p.hitWalls.push(w); this.hitWall(w, 60, this.f[p.side], {}); }
        } else if (w && w.side !== p.side) {
          p.dead = true;
          const owner = this.f[w.side];
          if (w.kind === 'stone' && owner.cls === 'warrior') this.gainRage(owner, 1, true);
          p.onHit(this, null, w, c, p);
          break;
        }
        if (!target.dead && target.col === c && target.row === p.row) {
          if (target.st.reflect > 0 && p.reflectable) { this.reflect(p, target); break; }
          p.dead = true;
          p.onHit(this, target, null, c, p);
          break;
        }
      }
      if (p.x < -1 || p.x > COLS) p.dead = true;
    }
    this.projectiles = this.projectiles.filter(p => !p.dead);
  }

  private reflect(p: Projectile, by: Fighter): void {
    by.st.reflect = 0;
    this.text(by, 'REFLECT', '#fcfcfc');
    sfx('reflect');
    const back: Projectile = { ...p, dead: false, side: by.side, reflectable: false };
    if (p.homing) {
      back.homing = { p: 0, dur: p.homing.dur, sx: by.col, sy: by.row, target: (1 - by.side) as Side };
    } else {
      back.speed = -p.speed;
      back.x = by.col + this.dir(by) * 0.5;
    }
    p.dead = true;
    this.projectiles.push(back);
  }

  burn(col: number, row: number, secs: number, dps: number): void {
    const p = this.panel(col, row);
    if (!p || p.hole > 0) return;
    p.burn = Math.max(p.burn, secs);
    p.burnDps = Math.max(p.burnDps, dps);
  }

  placeWall(f: Fighter, col: number, row: number, hp: number, kind: Wall['kind'], t: number, invuln = false): boolean {
    if (!this.inGrid(col, row) || this.wallAt(col, row) || this.fighterAt(col, row) || this.panels[col][row].hole > 0) return false;
    this.walls.push({ side: f.side, col, row, hp, maxHp: hp, t, kind, invuln });
    return true;
  }

  addShield(f: Fighter, kind: Shield['kind'], hp: number, t: number): void {
    f.shields = f.shields.filter(s => s.kind !== kind);
    f.shields.push({ kind, hp, t, hits: 0 });
  }
}

export interface CastCtx {
  b: Battle;
  f: Fighter;
  foe: Fighter;
  /** Damage multiplier from Battle Shout / Rallying Cry. */
  mult: number;
  dir: 1 | -1;
  held: Dir | null;
  /** Resource actually spent (Arcane Surge scales on this). */
  spent: number;
  /** Whether the caster was in Stealth when casting (Ambush). */
  stealthed: boolean;
}

/** Seconds to arm a fighter's heavy attack. */
export function heavyChargeOf(f: Fighter): number {
  if (f.cls !== 'ranger') return TUNING.heavyCharge;
  return f.st.nest > 0 || f.st.deadeye > 0 ? 0.35 : TUNING.ranger.heavyCharge;
}

export interface FighterSpec { cls: ClassId; deck: string[]; name: string; skin?: string }

// Rogue Energy tops up at the first Draw screen, so it starts empty here.
const START_RES: Record<ClassId, number> = { warrior: 0, mage: TUNING.mage.manaStart, rogue: 0, ranger: TUNING.ranger.energyStart, cleric: TUNING.cleric.manaStart };

function makeFighter(side: Side, spec: FighterSpec, alt: boolean, rand: () => number): Fighter {
  const { cls, deck, name } = spec;
  const st = {} as Record<StatusKey, number>;
  for (const k of STATUS_KEYS) st[k] = 0;
  const maxHp = TUNING.hp[cls];
  return {
    side, cls, skin: spec.skin ?? defaultSkin(cls), alt, name, hp: maxHp, maxHp,
    col: side === 0 ? 1 : 4, row: 1, dx: 0, dy: 0,
    lock: 0, moveCd: 0, charging: false, charge: 0,
    res: START_RES[cls],
    resMax: cls === 'mage' ? TUNING.mage.manaStart : cls === 'warrior' ? TUNING.warrior.rageMax : 5,
    bonusManaNext: 0,
    deck: shuffle(deck, rand), discard: [], queue: [], shields: [], st,
    shout: 0, rallyLeft: 0, powerLeft: 0, frostNovaUsed: false, lastStandAbsorbed: 0, glacialCd: 0,
    poison: 0, poisonT: 0, poisonAcc: 0, dodges: 0, stillT: 0, lastCol: -1, lastRow: -1, healedTurn: 0, deathMarkAcc: 0, mending: 0,
    flash: 0, pose: 'idle', poseT: 0, dead: false,
  };
}

