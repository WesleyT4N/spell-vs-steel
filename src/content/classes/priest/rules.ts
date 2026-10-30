// Priest: Mana. Starts at 3, +3 per Draw (cap 5).
import { TUNING, type ClassRules } from '../../api';

export default {
  id: 'priest',
  startRes: () => TUNING.priest.manaStart,
  startResMax: () => 5,
  pool: f => ({ cap: f.resMax, max: f.resMax }),
  basic(b, f, kind) {
    const foe = b.foe(f), d = b.dir(f);
    const T = TUNING.priest;
    f.lock = kind === 'light' ? T.lightLock : T.heavyLock;
    if (kind === 'light') {
      b.flyingShot(f, 'spark', T.lightDamage, { basic: kind, element: 'holy' });
    } else {
      // Smite: a pillar of light on the enemy, in any row, when they're within smiteRange columns (and not stealthed);
      // otherwise it lands smiteRange panels ahead in our row and misses. The Priest can stay on its blessings and still hit.
      const near = !foe.dead && b.targetable(foe) && Math.abs(foe.col - f.col) <= T.smiteRange;
      const c = near ? foe.col : f.col + T.smiteRange * d, r = near ? foe.row : f.row;
      b.addFx('holyPillar', f.side, c, r, 0.4);
      b.strike(f, [[c, r]], T.heavyDamage, { basic: kind, element: 'holy', knockback: T.smiteKnock > 0 });
    }
  },
  onDraw(b, f) {
    if (b.turn > 1) f.res = Math.min(TUNING.priest.manaCap, f.res + TUNING.priest.manaPerDraw);
  },
} satisfies ClassRules;
