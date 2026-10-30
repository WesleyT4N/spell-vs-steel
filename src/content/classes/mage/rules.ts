// Mage: Mana. Max starts at 1 and grows by 1 each Draw (cap 5); the pool refills every Draw.
import { TUNING, type ClassRules } from '../../api';

export default {
  startRes: () => TUNING.mage.manaStart,
  startResMax: () => TUNING.mage.manaStart,
  pool: f => ({ cap: TUNING.mage.manaCap, max: f.resMax }),
  basic(b, f, kind) {
    const T = TUNING.mage;
    const dmg = kind === 'light' ? T.lightDamage : T.heavyDamage;
    f.lock = kind === 'light' ? T.lightLock : T.heavyLock;
    b.flyingShot(f, kind === 'light' ? 'orb' : 'beam', dmg, { basic: kind, element: 'arcane' });
  },
  onDraw(b, f) {
    if (b.turn > 1) f.resMax = Math.min(TUNING.mage.manaCap, f.resMax + 1);
    f.res = f.resMax + f.bonusManaNext;
    f.bonusManaNext = 0;
  },
  // cards and effects may overfill Mana past the max
  gainRes(b, f, amt) {
    f.res = Math.min(99, f.res + amt);
    b.sound('pip');
  },
} satisfies ClassRules;
