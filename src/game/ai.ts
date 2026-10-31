// CPU opponent. Produces the same Intent a keyboard player would, so the battle can't tell the difference.
// Every roll comes from a generator seeded by the battle's seed and the CPU's side, so a CPU match replays
// exactly from its seed (sims, tests, the balance grid) without touching Math.random or the rules' own rolls.
import { NO_INTENT, heavyChargeOf, type Battle, type Dir, type Fighter, type Intent } from './battle';
import { CARDS } from './cards';
import { classModule } from '../content/classes';
import { TUNING, type Difficulty } from './tuning';
import { shuffle, substream, type Rng } from './rng';
import { BALANCED, playedAt, roleOf, type Playstyle } from './playstyles';

export class Cpu {
  private think = 0;
  private waitedOnTop = 0;
  private holding = false;
  private pendingMove: Dir | null = null;
  private wantCast = false;
  private wantTap = false;
  private cfg: (typeof TUNING.cpu)[Difficulty];
  /** The battle this CPU's rolls are seeded from; a new battle (next round, rematch) reseeds it. */
  private seededFor: Battle | null = null;
  private side = -1;
  private rand: Rng = Math.random;

  constructor(public difficulty: Difficulty, style: Playstyle = BALANCED) {
    this.cfg = TUNING.cpu[difficulty];
    this.style = playedAt(style, difficulty);
  }
  /** The style as this difficulty plays it (Easy only half commits to it). */
  style: Playstyle;

  /** Seed this CPU's rolls from the battle it is playing (once per battle and side). */
  private bind(b: Battle, f: Fighter): void {
    if (this.seededFor === b && this.side === f.side) return;
    this.seededFor = b;
    this.side = f.side;
    this.rand = substream(b.seed, 0xc0 + f.side);
  }

  /** Whether to open the Draw screen now that it can be opened (a little after it fills, like a player would). */
  wantsDraw(b: Battle, f: Fighter, dt: number): boolean {
    this.bind(b, f);
    // 2% a frame at 60fps, the same per second at any step
    return b.canOpenCustom() && this.rand() < 1 - Math.pow(0.98, dt * 60);
  }

  intent(b: Battle, f: Fighter, dt: number): Intent {
    this.bind(b, f);
    if (b.phase !== 'fight' || f.dead) { this.holding = false; return NO_INTENT; }
    this.think -= dt;
    this.waitedOnTop += dt;
    if (this.think <= 0) {
      this.think = this.cfg.think * (0.7 + this.rand() * 0.6);
      this.decide(b, f);
    }
    const out: Intent = {
      move: this.pendingMove, held: this.pendingMove,
      attackPressed: this.wantTap, attackHeld: this.holding,
      castPressed: this.wantCast,
    };
    this.pendingMove = null;
    this.wantTap = false;
    this.wantCast = false;
    return out;
  }

  private decide(b: Battle, f: Fighter): void {
    const foe = b.foe(f);
    const d = b.dir(f);
    const aligned = foe.row === f.row;

    // 1. Dodge telegraphs and incoming projectiles.
    const st = this.style;
    const hard = this.difficulty === 'hard';
    if (this.rand() < this.cfg.dodge * st.dodge && this.inDanger(b, f)) {
      const step = this.safeStep(b, f);
      if (step) { this.pendingMove = step; return; }
    }

    // 2. Spells.
    const top = f.queue[0] ? CARDS[f.queue[0]] : null;
    if (top) {
      if (b.canAfford(f, top) && f.st.evoLock <= 0 && f.castCd <= 0) {
        const good = top.ai ? top.ai(b, f, this.rand) : true;
        if (good || this.rand() < st.eager || this.waitedOnTop > this.cfg.castPatience * 3 * st.patience || (this.difficulty === 'easy' && this.rand() < 0.25)) {
          this.wantCast = true;
          this.waitedOnTop = 0;
          return;
        }
      }
    } else this.waitedOnTop = 0;

    // 3. Basic attacks.
    const dist = (foe.col - f.col) * d;
    const seen = foe.st.stealth <= 0;
    const cpu = classModule(f.cls).cpu;
    const { light: inReach, heavy: heavyReach } = cpu.reach(b, f, foe, dist, aligned, seen);
    const need = heavyChargeOf(f);
    // the press that started the hold never landed (we were flinching or locked): let go, or we'd hold forever
    if (this.holding && !f.charging && f.lock <= 0) this.holding = false;
    if (this.holding) {
      if (f.charge >= need && heavyReach) this.holding = false; // release fires the heavy
      else if (f.charge > need + 1.5) this.holding = false;
    } else if (cpu.windup && heavyReach && !inReach && f.lock <= 0) {
      // out of light-attack range: wind up the heavy instead (the Rogue's Throwing Knife)
      if (this.rand() < 0.08) { this.wantTap = true; this.holding = true; }
    } else if (inReach && f.lock <= 0 && this.rand() < st.attack) {
      this.wantTap = true;
      // Hard charges more heavies, except for classes whose damage and resource come from steady taps
      this.holding = this.rand() < (hard && !cpu.taps ? 0.6 : this.difficulty === 'easy' ? 0.15 : 0.35) * st.attack;
      if (this.rand() < 0.5) return;
    }
    // Hard doesn't stand in the enemy's row when it can't hit back
    if (hard && aligned && seen && !inReach && f.lock <= 0 && this.rand() < 0.3) {
      const side = this.sideSteps(b, f);
      if (side.length) { this.pendingMove = side[Math.floor(this.rand() * side.length)]; return; }
    }
    // defensive styles get out of the enemy's row rather than trade hits
    if (st.evade && aligned && seen && (Math.abs(dist) <= 3 || foe.charging) && this.rand() < st.evade) {
      const side = this.sideSteps(b, f);
      if (side.length) { this.pendingMove = side[Math.floor(this.rand() * side.length)]; return; }
    }
    // a Rogue in a backstab window holds its panel: any move would blink it home
    if (f.st.backstab > 0) return;
    // some classes reposition less: the Ranger earns Energy standing still, the Priest's blessings work only underfoot
    // (the chance is per second, however often this CPU thinks)
    const hold = cpu.stay?.(b, f, aligned, seen) ?? 0;
    if (hold > 0 && this.rand() < hold ** (this.cfg.think / TUNING.cpu.normal.think)) return;

    // 4. Positioning.
    const target = this.goal(b, f);
    const step = this.stepToward(b, f, target[0], target[1]);
    if (step) this.pendingMove = step;
  }

  private goal(b: Battle, f: Fighter): [number, number] {
    const foe = b.foe(f);
    const aim = this.rand() < this.cfg.aim;
    // a stealthed enemy can't be tracked: hold the current row
    const row = foe.st.stealth > 0 ? f.row : aim ? foe.row : Math.floor(this.rand() * 3);
    return classModule(f.cls).cpu.goal({ b, f, foe, row, range: this.style.range });
  }


  /** Up or down moves that are safe to take. */
  private sideSteps(b: Battle, f: Fighter): Dir[] {
    return ([['up', -1], ['down', 1]] as Array<[Dir, number]>)
      .filter(([, dr]) => b.canStand(f, f.col, f.row + dr) && !this.cursed(b, f, f.col, f.row + dr)).map(([d]) => d);
  }

  /** Would stepping here put us on a panel the enemy cursed? */
  private cursed(b: Battle, f: Fighter, col: number, row: number): boolean {
    const p = b.panel(col, row);
    return !!p && p.curse > 0 && p.curseSide !== f.side;
  }

  private stepToward(b: Battle, f: Fighter, col: number, row: number): Dir | null {
    const opts: Dir[] = [];
    if (row < f.row) opts.push('up');
    if (row > f.row) opts.push('down');
    if (col < f.col) opts.push('left');
    if (col > f.col) opts.push('right');
    for (const o of opts) {
      const [dc, dr] = o === 'up' ? [0, -1] : o === 'down' ? [0, 1] : o === 'left' ? [-1, 0] : [1, 0];
      if (b.canStand(f, f.col + dc, f.row + dr) && !this.cursed(b, f, f.col + dc, f.row + dr)) return o;
    }
    return null;
  }

  inDanger(b: Battle, f: Fighter): boolean {
    if (b.warned(f.col, f.row, f.side)) return true;
    if (b.onCurse(f)) return true;
    return b.projectiles.some(p => p.side !== f.side && !p.homing && p.row === f.row && Math.abs(p.x - f.col) < 3 && Math.sign(f.col - p.x) === Math.sign(p.speed));
  }

  safeStep(b: Battle, f: Fighter): Dir | null {
    const dirs: Array<[Dir, number, number]> = [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]];
    const safe = dirs.filter(([, dc, dr]) => {
      const c = f.col + dc, r = f.row + dr;
      if (!b.canStand(f, c, r) || this.cursed(b, f, c, r)) return false;
      if (b.warned(c, r, f.side)) return false;
      return dr !== 0 || !b.projectiles.some(p => p.side !== f.side && p.row === r);
    });
    if (!safe.length) return null;
    return safe[Math.floor(this.rand() * safe.length)][0];
  }

  /** Choose spells from the offer, in cast order. */
  pick(b: Battle, f: Fighter): number[] {
    this.bind(b, f);
    const offer = b.offer[f.side];
    const idx = offer.map((_, i) => i);
    if (this.difficulty === 'easy') {
      const n = 1 + Math.floor(this.rand() * 3);
      return shuffle(idx, this.rand).slice(0, n);
    }
    const cost = (i: number): number => { const c = CARDS[offer[i]].cost; return c === 'all' ? Math.max(1, f.res) : c; };
    // how much this style wants a card: its cost, nudged by the style's taste for its role
    const want = (i: number): number => cost(i) + this.style.prefer[roleOf(offer[i])];
    return classModule(f.cls).cpu.pick({ offer, idx, res: f.res, cost, want, role: i => roleOf(offer[i]), style: this.style, gain: i => CARDS[offer[i]].gain });
  }
}
