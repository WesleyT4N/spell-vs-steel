// Rogue: Energy, topped up to 5 at every Draw (so it starts empty).
import { TUNING, type ClassRules } from '../../api';

export default {
  id: 'rogue',
  startRes: () => 0,
  startResMax: () => 5,
  pool: f => ({ cap: f.resMax, max: f.resMax }),
  basic(b, f, kind) {
    const d = b.dir(f);
    const T = TUNING.rogue;
    f.lock = kind === 'light' ? T.lightLock : T.heavyLock;
    if (kind === 'light') {
      // Stab: a dagger thrust that reaches the panels ahead
      const cells: Array<[number, number]> = [];
      for (let i = 1; i <= T.stabReach; i++) cells.push([f.col + i * d, f.row]);
      b.addFx('dagger', f.side, f.col, f.row, 0.18, { reach: T.stabReach });
      b.strike(f, cells, T.lightDamage, { basic: kind, element: 'steel' });
    } else {
      // Throwing Knife: a heavy knife down the row
      b.flyingShot(f, 'knife', T.heavyDamage, { basic: kind, element: 'steel' });
    }
  },
  onDraw(_b, f) {
    f.res = Math.max(f.res, TUNING.rogue.energyTopUp);
  },
} satisfies ClassRules;
