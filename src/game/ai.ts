// CPU opponent. Produces the same Intent a keyboard player would, so the battle can't tell the difference.
import { NO_INTENT, heavyChargeOf, type Battle, type BlessKind, type Dir, type Fighter, type Intent } from './battle';
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
      if (b.canAfford(f, top) && f.st.evoLock <= 0 && f.castCd <= 0) {
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
    const seen = foe.st.stealth <= 0;
    const inReach = seen && (f.cls === 'warrior' ? aligned && dist >= 1 && dist <= 2
      : f.cls === 'rogue' ? aligned && dist >= 1 && dist <= TUNING.rogue.stabReach
      // Hunter's Mark: the Ranger's shots home in from any row
      : aligned || (f.cls === 'ranger' && foe.st.hunted > 0));
    // Smite lands a fixed distance ahead, so the Priest only releases its heavy at that range;
    // the Rogue's Throwing Knife flies down the whole row
    const heavyReach = f.cls === 'rogue' ? seen && aligned : inReach && (f.cls !== 'priest' || dist === TUNING.priest.smiteRange);
    const need = heavyChargeOf(f);
    if (this.holding) {
      if (f.charge >= need && heavyReach) this.holding = false; // release fires the heavy
      else if (f.charge > need + 1.5) this.holding = false;
    } else if (f.cls === 'rogue' && heavyReach && !inReach && f.lock <= 0) {
      // out of stab range: wind up a Throwing Knife instead
      if (Math.random() < 0.08) { this.wantTap = true; this.holding = true; }
    } else if (inReach && f.lock <= 0) {
      this.wantTap = true;
      this.holding = Math.random() < (this.difficulty === 'normal' ? 0.35 : 0.15);
      if (Math.random() < 0.5) return;
    }
    // a Rogue in a backstab window holds its panel: any move would blink it home
    if (f.st.backstab > 0) return;
    // the Ranger earns Energy by standing still, so it repositions less
    if (f.cls === 'ranger' && (aligned || !seen) && Math.random() < 0.85) return;
    // the Priest's blessings only work while it stands on them
    if (f.cls === 'priest' && b.blessUnder(f) && Math.random() < 0.9) return;

    // 4. Positioning.
    const target = this.goal(b, f);
    const step = this.stepToward(b, f, target[0], target[1]);
    if (step) this.pendingMove = step;
  }

  private goal(b: Battle, f: Fighter): [number, number] {
    const foe = b.foe(f);
    const aim = Math.random() < this.cfg.aim;
    // a stealthed enemy can't be tracked: hold the current row
    const row = foe.st.stealth > 0 ? f.row : aim ? foe.row : Math.floor(Math.random() * 3);
    if (f.cls === 'warrior' || f.cls === 'rogue') return [b.frontCol(f.side), row];
    if (f.cls === 'priest') {
      // go stand on the most useful blessing we have
      const spot = this.bestBlessing(b, f);
      if (spot) return spot;
      // otherwise stand where Smite reaches the enemy, inside our own area
      const want = foe.col - TUNING.priest.smiteRange * b.dir(f);
      const lo = Math.min(b.backCol(f.side), b.frontCol(f.side)), hi = Math.max(b.backCol(f.side), b.frontCol(f.side));
      return [Math.max(lo, Math.min(hi, want)), row];
    }
    // Mage: keep distance from a Warrior hugging the border, otherwise hold the middle.
    const threatened = foe.cls === 'warrior' && foe.col === b.frontCol(foe.side);
    const col = threatened ? b.backCol(f.side) : b.frontCol(f.side) - b.dir(f);
    return [col, row];
  }

  /** Priest: the blessed panel worth standing on now (healing when hurt, the shield until the pool is full...). */
  private bestBlessing(b: Battle, f: Fighter): [number, number] | null {
    const shield = f.shields.find(s => s.kind === 'holy')?.hp ?? 0;
    const worth: Record<BlessKind, number> = {
      all: 5,
      heal: f.maxHp - f.hp >= 30 ? 3 : 0.5,
      shield: shield < TUNING.priest.shieldCap ? 2.5 : 0.5,
      power: 2,
      mana: f.res < TUNING.priest.manaCap ? 2 : 0.2,
    };
    let best: [number, number] | null = null, bestV = 0;
    for (let c = 0; c < 6; c++) for (let r = 0; r < 3; r++) {
      const p = b.panels[c][r];
      if (p.bless <= 0 || p.owner !== f.side || !b.canStand(f, c, r) && !(f.col === c && f.row === r)) continue;
      const v = worth[p.blessKind] - (Math.abs(c - f.col) + Math.abs(r - f.row)) * 0.2;
      if (v > bestV) { bestV = v; best = [c, r]; }
    }
    return best;
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
    if (b.marks.some(m => m.col === f.col && m.row === f.row)) return true;
    if (b.onCurse(f)) return true;
    return b.projectiles.some(p => p.side !== f.side && !p.homing && p.row === f.row && Math.abs(p.x - f.col) < 3 && Math.sign(f.col - p.x) === Math.sign(p.speed));
  }

  safeStep(b: Battle, f: Fighter): Dir | null {
    const dirs: Array<[Dir, number, number]> = [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]];
    const safe = dirs.filter(([, dc, dr]) => {
      const c = f.col + dc, r = f.row + dr;
      if (!b.canStand(f, c, r) || this.cursed(b, f, c, r)) return false;
      if (b.marks.some(m => m.col === c && m.row === r)) return false;
      return dr !== 0 || !b.projectiles.some(p => p.side !== f.side && p.row === r);
    });
    if (!safe.length) return null;
    return safe[Math.floor(Math.random() * safe.length)][0];
  }

  /** Rogue: spend the full Energy bar on a chain. Setup first, then a blink, then the finishers that want to be up close.
   *  Ambush only comes with a Stealth card cast before it. */
  private pickRogue(offer: string[], energy: number, cost: (i: number) => number): number[] {
    const STEALTH = ['vanish', 'shadow_clone', 'smokescreen', 'nights_embrace'];
    const RANK: Record<string, number> = {
      vanish: 0, shadow_clone: 0, smokescreen: 0, nights_embrace: 0, cold_blood: 0, deadly_poison: 0, adrenaline_rush: 0, shadow_dance: 0,
      pandemic: 0, death_mark: 0, poison_vial: 0, evasion: 0, riposte: 0, cloak_of_shadows: 0,
      shadowstep: 1, ambush: 1, blade_flurry: 1, killing_spree: 1,
    };
    const chosen: number[] = [];
    const take = (i: number): void => {
      if (chosen.includes(i) || cost(i) > energy) return;
      chosen.push(i);
      energy -= cost(i);
      if (offer[i] === 'pickpocket') energy += 1;
    };
    const idx = offer.map((_, i) => i);
    const hide = idx.find(i => STEALTH.includes(offer[i]));
    const ambush = idx.find(i => offer[i] === 'ambush');
    if (hide !== undefined && ambush !== undefined && cost(hide) + cost(ambush) <= energy) { take(hide); take(ambush); }
    for (const i of idx.filter(i => offer[i] !== 'ambush').sort((a, c) => cost(c) - cost(a))) take(i);
    // finishers (Shiv, Kidney Shot, Envenom, Eviscerate...) go last, after the chain is set up
    return chosen.sort((a, c) => (RANK[offer[a]] ?? 2) - (RANK[offer[c]] ?? 2));
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
    if (f.cls === 'rogue') return this.pickRogue(offer, f.res, cost);
    if (f.cls !== 'warrior') {
      // Energy and Mana are known up front (the Ranger will earn about 2 more while it stands still)
      let mana = f.res + (f.cls === 'ranger' ? 2 : 0);
      for (const i of idx) { const g = CARDS[offer[i]].gain; if (g?.res && offer[i] !== 'arcane_focus') mana += g.res; if (g?.refill) mana = Math.max(mana, 5); }
      const chosen: number[] = [];
      // Focus first (it pays for itself), then the most expensive things we can afford.
      for (const i of idx.filter(i => offer[i] === 'arcane_focus')) { chosen.push(i); mana += 1; }
      const rest = idx.filter(i => !chosen.includes(i)).sort((a, c) => cost(c) - cost(a));
      for (const i of rest) if (cost(i) <= mana) { chosen.push(i); mana -= cost(i); }
      // cast cheap control first, big damage last; the Ranger's core combo is Steady Focus, Hunter's Mark, Rapid Fire
      // the Priest lays its fields first, then curses and DoTs, then damage
      const FIRST: Record<string, number> = {
        arcane_focus: -10, steady_focus: -9, hunters_mark: -8, rapid_fire: -7,
        power_infusion: -10, holy_sanctum: -9, aegis_field: -8, sacred_ground: -8, sanctuary: -7, wellspring: -7, hallowed_ground: -6,
        shadowform: -5, void_rift: -5, mind_sear: -5, desecrate: -5, shadow_word_pain: -4, devouring_plague: -4,
      };
      return chosen.sort((a, c) => (FIRST[offer[a]] ?? cost(a)) - (FIRST[offer[c]] ?? cost(c)));
    }
    // Warrior: builders first, then spenders we can expect to afford this turn.
    let budget = f.res + 3;
    const builders = idx.filter(i => cost(i) === 0);
    const spenders = idx.filter(i => cost(i) > 0).sort((a, c) => cost(a) - cost(c));
    const chosen = [...builders];
    // a 4-5 Rage finisher is worth banking for: queue it last and keep only what still leaves room for it
    const big = spenders.filter(i => cost(i) >= 4).pop();
    if (big !== undefined) budget -= cost(big);
    for (const i of spenders) if (i !== big && cost(i) <= budget) { chosen.push(i); budget -= cost(i); }
    if (big !== undefined) chosen.push(big);
    return chosen;
  }
}
