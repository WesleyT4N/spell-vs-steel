// Warrior: Rage, max 5. Heavy Cleaves and taking damage build it; light attacks build none.
import { TUNING, effect, type Battle, type ClassRules, type Fighter } from '../../api';

/** Cleave (light) or Heavy Cleave on `cells`; a heavy hit builds Rage (double while Berserk). */
function cleave(b: Battle, f: Fighter, kind: 'light' | 'heavy', cells: Array<[number, number]>, dmg: number): void {
  const T = TUNING.warrior;
  b.addFx(kind === 'light' ? 'cleave' : 'cleaveHeavy', f.side, f.col + b.dir(f), f.row, kind === 'light' ? 0.32 : 0.56);
  const res = b.strike(f, cells, dmg, { basic: kind, element: 'steel' });
  if (res.fighter && kind === 'heavy') b.gainRage(f, T.rageHeavyHit * (f.st.berserk > 0 ? 2 : 1));
  if (res.fighter && kind === 'light' && T.rageLightHit) b.gainRage(f, T.rageLightHit * (f.st.berserk > 0 ? 2 : 1));
}
const cleaveAgain = effect('battle.cleave', (b, a: { side: 0 | 1; kind: 'light' | 'heavy'; cells: Array<[number, number]>; dmg: number }) => cleave(b, b.f[a.side], a.kind, a.cells, a.dmg));

export default {
  startRes: () => 0,
  startResMax: () => TUNING.warrior.rageMax,
  pool: () => ({ cap: TUNING.warrior.rageMax, max: TUNING.warrior.rageMax }),
  basic(b, f, kind) {
    const d = b.dir(f);
    const T = TUNING.warrior;
    const dmg = kind === 'light' ? T.lightDamage : T.heavyDamage;
    f.lock = kind === 'light' ? T.lightLock : T.heavyLock;
    const cells: Array<[number, number]> = [[f.col + d, f.row], [f.col + 2 * d, f.row]];
    cleave(b, f, kind, cells, dmg);
    // Avatar of War: every Cleave hits twice
    if (f.st.avatar > 0) b.later(0.12, cleaveAgain({ side: f.side, kind, cells, dmg }));
  },
  onHurt(b, f, amt) {
    b.gainRage(f, Math.min(TUNING.warrior.rageWhenHitMax, amt / TUNING.warrior.rageDamagePerPip));
  },
  gainRage(b, f, amt, fromCard) {
    if (amt <= 0) return;
    const before = Math.floor(f.res);
    f.res = Math.min(TUNING.warrior.rageMax, f.res + amt);
    if (Math.floor(f.res) > before && fromCard) b.sound('pip');
  },
  gainRes(b, f, amt) { b.gainRage(f, amt, true); },
} satisfies ClassRules;
