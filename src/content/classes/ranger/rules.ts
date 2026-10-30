// Ranger: Energy. Starts at 2, +1 per Draw, and grows while standing still.
import { TUNING, basicShot, panOf, type ClassRules, type HitOpts } from '../../api';

export default {
  startRes: () => TUNING.ranger.energyStart,
  startResMax: () => 5,
  pool: f => ({ cap: f.resMax, max: f.resMax }),
  basic(b, f, kind) {
    const foe = b.foe(f), d = b.dir(f);
    const T = TUNING.ranger;
    // Hunter's Mark: both attacks home in on the enemy wherever they are
    const homing = foe.st.hunted > 0 && b.targetable(foe);
    if (kind === 'light') {
      // Arrow: a visible, dodgeable shot with travel time
      f.lock = f.st.rapidFire > 0 ? T.lightLock / 2 : T.lightLock;
      const dmg = T.lightDamage * (f.st.deadeye > 0 ? 3 : 1);
      const opts: HitOpts = { basic: kind, element: 'steel' };
      if (homing) {
        b.sound('shot_arrow', { pan: panOf(f.col), data: { dir: d } });
        b.projectiles.push({
          side: f.side, row: f.row, x: f.col, speed: 0, kind: 'arrow', reflectable: true,
          homing: { p: 0, dur: Math.max(0.15, Math.abs(foe.col - f.col) / T.arrowSpeed), sx: f.col, sy: f.row, target: foe.side },
          onHit: basicShot({ side: f.side, dmg, opts }),
        });
      } else {
        b.shoot(f, {
          speed: T.arrowSpeed * d, kind: 'arrow', reflectable: true,
          onHit: basicShot({ side: f.side, dmg, opts }),
        });
      }
    } else {
      // Aimed Shot: instant, pierces during Deadeye
      f.lock = T.heavyLock;
      if (homing) {
        b.sound('fx:aimed', { pan: panOf(f.col), data: { dir: d } });
        b.projectiles.push({
          side: f.side, row: f.row, x: f.col, speed: 0, kind: 'aimed', reflectable: false,
          homing: { p: 0, dur: Math.max(0.1, Math.abs(foe.col - f.col) / T.aimedSpeed), sx: f.col, sy: f.row, target: foe.side },
          onHit: basicShot({ side: f.side, dmg: T.heavyDamage, opts: { basic: kind, element: 'steel', targeted: true } }),
        });
      } else b.flyingShot(f, 'aimed', T.heavyDamage, { basic: kind, element: 'steel' }, f.st.deadeye > 0);
    }
  },
  onDraw(b, f) {
    if (b.turn > 1) f.res = Math.min(TUNING.ranger.energyCap, f.res + 1);
  },
  tick(b, f, dt) {
    // Energy comes from standing still; any change of panel restarts the count
    // (Light Footed keeps the count through moves; Deadeye doubles the rate)
    if ((f.col !== f.lastCol || f.row !== f.lastRow) && f.st.lightFoot <= 0) f.stillT = 0;
    else f.stillT += dt * (f.st.deadeye > 0 ? 2 : 1);
    const R = TUNING.ranger;
    while (f.stillT >= R.stillSeconds) {
      f.stillT -= R.stillSeconds;
      if (f.res < R.energyCap) { f.res = Math.min(R.energyCap, f.res + 1); b.sound('pip'); }
    }
  },
} satisfies ClassRules;
