// The Draw screen's cost preview (Battle.planCosts) agrees with what casting the queue really costs, including
// spells that change later costs (Arcane Power, Power Infusion, Ascendance). Usage: npx tsx tests/planCosts.ts
import { Battle } from '../src/game/battle';
import { CARDS } from '../src/game/cards';
import { starterDeck, toList } from '../src/game/deck';
import type { ClassId } from '../src/art/sprites';

let failed = 0;
function check(name: string, ok: boolean, detail = ''): void {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok || !detail ? '' : `: ${detail}`}`);
  if (!ok) failed++;
}

/** Plans `ids` from `res` Mana, then casts them one by one and records what each really cost. */
function compare(cls: ClassId, ids: string[], res: number): void {
  const b = new Battle({ cls, deck: toList(starterDeck(cls)), name: 'A' }, { cls: 'warrior', deck: toList(starterDeck('warrior')), name: 'B' }, 1);
  b.phase = 'fight';
  const f = b.f[0];
  f.resMax = Math.min(f.resMax, 5); f.res = res;
  const plan = b.planCosts(f, ids.map(id => CARDS[id])).cost;
  const real: number[] = [];
  f.queue = [...ids];
  for (let i = 0; i < ids.length; i++) {
    f.castCd = 0; f.lock = 0; f.st.evoLock = 0; f.st.silenced = 0; f.res = 9;
    b.castTop(f, null);
    real.push(9 - f.res);
  }
  check(`${cls} ${ids.join(' > ')}: plan ${plan.join(',')}`, plan.join() === real.join(), `real ${real.join(',')}`);
}

compare('mage', ['arcane_power', 'fireball', 'arcane_missiles', 'fireball', 'fireball'], 5);
compare('mage', ['fireball', 'arcane_power', 'arcane_power', 'fireball'], 5);
compare('mage', ['ascendance', 'fireball', 'meteor'], 5);
compare('priest', ['power_infusion', 'power_infusion'], 5);
compare('warrior', ['avatar_of_war', 'avatar_of_war'], 5);

if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log('plan costs: all match');
