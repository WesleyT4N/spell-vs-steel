// CPU opponent. Produces the same Intent a keyboard player would, so the battle can't tell the difference.
import { NO_INTENT, type Battle, type Dir, type Fighter, type Intent } from './battle';
import { CARDS } from './cards';
import { TUNING, type Difficulty } from './tuning';

export class Cpu {
  private think = 0;
  private waitedOnTop = 0;
  private holding = false;
  private pendingMove: Dir | null = null;
  private wantCast = false;
  private wantTap = false;
  private cfg: (typeof TUNING.cpu)[Difficulty];

  constructor(public difficulty: Difficulty) {
    this.cfg = TUNING.cpu[difficulty];
  }

  intent(b: Battle, f: Fighter, dt: number): Intent {
    if (b.phase !== 'fight' || f.dead) { this.holding = false; return NO_INTENT; }
    this.think -= dt;
    this.waitedOnTop += dt;
    if (this.think <= 0) {
      this.think = this.cfg.think * (0.7 + Math.random() * 0.6);
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
    if (Math.random() < this.cfg.dodge && this.inDanger(b, f)) {
      const step = this.safeStep(b, f);
      if (step) { this.pendingMove = step; return; }
    }

    // 2. Spells.
    const top = f.queue[0] ? CARDS[f.queue[0]] : null;
    if (top) {
      if (b.canAfford(f, top) && f.st.evoLock <= 0) {
        const good = top.ai ? top.ai(b, f) : true;
        if (good || this.waitedOnTop > this.cfg.castPatience * 3 || (this.difficulty === 'easy' && Math.random() < 0.25)) {
          this.wantCast = true;
          this.waitedOnTop = 0;
          return;
        }
      }
    } else this.waitedOnTop = 0;

    // 3. Basic attacks.
    const dist = (foe.col - f.col) * d;
    const inReach = f.cls === 'warrior' ? aligned && dist >= 1 && dist <= 2 : aligned;
    if (this.holding) {
      if (f.charge >= TUNING.heavyCharge && inReach) this.holding = false; // release fires the heavy
      else if (f.charge > TUNING.heavyCharge + 1.5) this.holding = false;
    } else if (inReach && f.lock <= 0) {
      this.wantTap = true;
      this.holding = Math.random() < (this.difficulty === 'normal' ? 0.35 : 0.15);
      if (Math.random() < 0.5) return;
    }

    // 4. Positioning.
    const target = this.goal(b, f);
    const step = this.stepToward(b, f, target[0], target[1]);
    if (step) this.pendingMove = step;
  }

  private goal(b: Battle, f: Fighter): [number, number] {
    const foe = b.foe(f);
    const aim = Math.random() < this.cfg.aim;
    const row = aim ? foe.row : Math.floor(Math.random() * 3);
    if (f.cls === 'warrior') return [b.frontCol(f.side), row];
    // Mage: keep distance from a Warrior hugging the border, otherwise hold the middle.
    const threatened = foe.cls === 'warrior' && foe.col === b.frontCol(foe.side);
    const col = threatened ? b.backCol(f.side) : b.frontCol(f.side) - b.dir(f);
    return [col, row];
  }

  private stepToward(b: Battle, f: Fighter, col: number, row: number): Dir | null {
    const opts: Dir[] = [];
    if (row < f.row) opts.push('up');
    if (row > f.row) opts.push('down');
    if (col < f.col) opts.push('left');
    if (col > f.col) opts.push('right');
    for (const o of opts) {
      const [dc, dr] = o === 'up' ? [0, -1] : o === 'down' ? [0, 1] : o === 'left' ? [-1, 0] : [1, 0];
      if (b.canStand(f, f.col + dc, f.row + dr)) return o;
    }
    return null;
  }

  private inDanger(b: Battle, f: Fighter): boolean {
    if (b.marks.some(m => m.col === f.col && m.row === f.row)) return true;
    return b.projectiles.some(p => p.side !== f.side && !p.homing && p.row === f.row && Math.abs(p.x - f.col) < 3 && Math.sign(f.col - p.x) === Math.sign(p.speed));
  }

  private safeStep(b: Battle, f: Fighter): Dir | null {
    const dirs: Array<[Dir, number, number]> = [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]];
    const safe = dirs.filter(([, dc, dr]) => {
      const c = f.col + dc, r = f.row + dr;
      if (!b.canStand(f, c, r)) return false;
      if (b.marks.some(m => m.col === c && m.row === r)) return false;
      return dr !== 0 || !b.projectiles.some(p => p.side !== f.side && p.row === r);
    });
    if (!safe.length) return null;
    return safe[Math.floor(Math.random() * safe.length)][0];
  }

  /** Choose spells from the offer, in cast order. */
  pick(b: Battle, f: Fighter): number[] {
    const offer = b.offer[f.side];
    const idx = offer.map((_, i) => i);
    if (this.difficulty === 'easy') {
      const n = 1 + Math.floor(Math.random() * 3);
      return idx.sort(() => Math.random() - 0.5).slice(0, n);
    }
    const cost = (i: number): number => { const c = CARDS[offer[i]].cost; return c === 'all' ? Math.max(1, f.res) : c; };
    if (f.cls === 'mage') {
      let mana = f.res;
      const chosen: number[] = [];
      // Focus first (it pays for itself), then the most expensive things we can afford.
      for (const i of idx.filter(i => offer[i] === 'arcane_focus')) { chosen.push(i); mana += 1; }
      const rest = idx.filter(i => !chosen.includes(i)).sort((a, c) => cost(c) - cost(a));
      for (const i of rest) if (cost(i) <= mana) { chosen.push(i); mana -= cost(i); }
      // cast cheap control first, big damage last
      return chosen.sort((a, c) => (offer[a] === 'arcane_focus' ? -10 : cost(a)) - (offer[c] === 'arcane_focus' ? -10 : cost(c)));
    }
    // Warrior: builders first, then spenders we can expect to afford this turn.
    let budget = f.res + 3;
    const builders = idx.filter(i => cost(i) === 0);
    const spenders = idx.filter(i => cost(i) > 0).sort((a, c) => cost(a) - cost(c));
    const chosen = [...builders];
    for (const i of spenders) if (cost(i) <= budget) { chosen.push(i); budget -= cost(i); }
    return chosen;
  }
}
