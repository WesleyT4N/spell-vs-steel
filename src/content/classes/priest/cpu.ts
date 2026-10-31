// Priest CPU: its three playstyles, Hard's pick per matchup, and how far its basic attacks reach.
import { TUNING, AGGRO, CONSERVATIVE, DEFENSIVE, type BlessKind, type Battle, type Fighter, poolPick, type ClassCpu } from '../../api';

/** The blessed panel worth standing on now (healing when hurt, the shield until the pool is full...). */
function bestBlessing(b: Battle, f: Fighter): [number, number] | null {
  const shield = f.shields.find(s => s.kind === 'holy')?.hp ?? 0;
  const worth: Record<BlessKind, number> = {
    all: 5,
    heal: f.maxHp - f.hp >= 300 ? 3 : 0.5,
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

const cpu: ClassCpu = {
  styles: [
    { ...AGGRO, id: 'priest_zealot', name: 'Zealot', cls: 'priest', deck: 'holy', desc: 'Holy Fire and Penance on cooldown, pushes up to Smite range.' },
    { ...CONSERVATIVE, id: 'priest_plaguelord', name: 'Plaguelord', cls: 'priest', deck: 'shadow', desc: 'Curses and DoTs first, waits for them to stack before spending big.' },
    { ...DEFENSIVE, id: 'priest_shepherd', name: 'Shepherd', cls: 'priest', deck: 'sanctum', desc: 'Shields, heals and blessed ground; outlasts the enemy.' },
  ],
  /** Hard's style against each player class, from `npm run balance -- --pools style-starter --cpu hard`. */
  counter: { warrior: 'priest_plaguelord', mage: 'priest_plaguelord', rogue: 'priest_plaguelord', ranger: 'priest_shepherd' },
  reach(b, _f, foe, dist, aligned, seen) {
    // Smite finds the enemy in any row within its reach, so the Priest releases its heavy whenever they're that close
    const light = seen && aligned;
    return { light, heavy: b.targetable(foe) && dist >= 1 && dist <= TUNING.priest.smiteRange };
  },
  stay: (b, f) => (b.blessUnder(f) ? 0.9 : 0),
  goal({ b, f, foe, row }) {
    // go stand on the most useful blessing we have
    const spot = bestBlessing(b, f);
    if (spot) return spot;
    // otherwise stand where Smite can reach the enemy, inside our own area
    const want = foe.col - TUNING.priest.smiteRange * b.dir(f);
    const lo = Math.min(b.backCol(f.side), b.frontCol(f.side)), hi = Math.max(b.backCol(f.side), b.frontCol(f.side));
    return [Math.max(lo, Math.min(hi, want)), row];
  },
  // lays its fields first, then curses and DoTs, then damage
  pick: x => poolPick(x, { first: {
    power_infusion: -10, holy_sanctum: -9, aegis_field: -8, sacred_ground: -8, sanctuary: -7, wellspring: -7, hallowed_ground: -6,
    shadowform: -5, void_rift: -5, mind_sear: -5, desecrate: -5, shadow_word_pain: -4, devouring_plague: -4,
  } }),
};
export default cpu;
