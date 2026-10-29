// Quick checks of the true combo counter: npx tsx scripts/combo-check.ts
import { Battle, NO_INTENT } from '../src/game/battle';
import { starterDeck, toList } from '../src/game/deck';

let fails = 0;
const expect = (name: string, got: unknown, want: unknown): void => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${JSON.stringify(got)}${ok ? '' : ` (want ${JSON.stringify(want)})`}`);
};
const fresh = (): Battle => { const b = new Battle({ cls: 'warrior', deck: toList(starterDeck('warrior')) }, { cls: 'mage', deck: toList(starterDeck('mage')) }, 1); b.phase = 'fight'; return b; };
const step = (b: Battle, s: number): void => { for (let t = 0; t < s; t += 1 / 60) b.update(1 / 60, [NO_INTENT, NO_INTENT]); };

// small hits on a target that can act never combo
let b = fresh(); const [w, m] = b.f;
for (let i = 0; i < 4; i++) { b.damage(m, 100, w, { basic: 'light' }); step(b, 0.2); }
expect('free hits', b.combo.count[0], 0);

// freeze, then three hits: opener + 3 = 4 hits
b = fresh();
b.damage(b.f[1], 100, b.f[0], { spell: true, freeze: 2 });
step(b, 0.5); b.damage(b.f[1], 100, b.f[0], { basic: 'light' });
step(b, 0.5); b.damage(b.f[1], 100, b.f[0], { basic: 'light' });
step(b, 0.5); b.damage(b.f[1], 100, b.f[0], { basic: 'light' });
expect('live combo hits', b.combo.shown(0)?.hits, 4);
expect('live combo dmg (frozen +50%)', b.combo.shown(0)?.dmg, 100 + 150 * 3);
step(b, 1); // thaws
expect('ended once target acts', [b.combo.cur[0].hits, b.combo.count[0], b.combo.best[0]], [0, 1, { hits: 4, dmg: 550 }]);
b.damage(b.f[1], 100, b.f[0], { basic: 'light' });
expect('hit after thaw starts fresh', b.combo.cur[0].hits, 1);

// hitstun: a 200+ hit flinches 0.3s; a follow-up inside it combos, one after it doesn't
b = fresh();
b.damage(b.f[1], 400, b.f[0], { basic: 'heavy' });
step(b, 0.1); b.damage(b.f[1], 100, b.f[0], { basic: 'light' });
expect('hit inside hitstun', b.combo.cur[0].hits, 2);
step(b, 0.5); b.damage(b.f[1], 100, b.f[0], { basic: 'light' });
expect('hit after hitstun', [b.combo.cur[0].hits, b.combo.count[0]], [1, 1]);

// the sides are tracked separately
b = fresh();
b.stun(b.f[0], 2);
b.damage(b.f[0], 100, b.f[1], { spell: true }); b.damage(b.f[0], 100, b.f[1], { spell: true });
expect('mage combo on stunned warrior', [b.combo.cur[1].hits, b.combo.cur[0].hits], [2, 0]);

process.exit(fails ? 1 : 0);
